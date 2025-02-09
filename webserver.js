const express = require('express');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(express.json());

const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run("CREATE TABLE clients (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT)");
    db.run("CREATE TABLE commands (id INTEGER PRIMARY KEY AUTOINCREMENT, command TEXT, target TEXT, clientKey TEXT, room TEXT)");
});

function genkey(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

app.post('/addclient', (req, res) => {
    const key = genkey(16);
    db.run("INSERT INTO clients (key) VALUES (?)", [key], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ index: this.lastID, key });
    });
});

app.get('/clients', (req, res) => {
    db.all("SELECT * FROM clients", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/removeclient', (req, res) => {
    const { key } = req.body;

    if (!key) {
        return res.status(400).json({ error: "no client key" });
    }

    db.run("DELETE FROM commands WHERE clientKey = ?", [key], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        db.run("DELETE FROM clients WHERE key = ?", [key], function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: "client not found" });
            }
            res.json({ success: true, message: `client with key ${key} removed` });
        });
    });
});

app.post('/joinroom', (req, res) => {
    const { room, target, clientKey } = req.body;

    if (!room || !target) {
        return res.status(400).json({ error: "invalid params" });
    }

    db.run("INSERT INTO commands (command, target, clientKey, room) VALUES (?, ?, ?, ?)", 
        ["joinroom", target, clientKey || null, room], 
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, commandID: this.lastID });
        }
    );
});

app.get('/commands', (req, res) => {
    db.get("SELECT * FROM commands ORDER BY id DESC LIMIT 1", [], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(row || {});
    });
});


// Listen on the correct port (defaults to 3000 if not set)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
