import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("database.sqlite");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS erphs (
    id TEXT PRIMARY KEY,
    teacherId TEXT,
    data TEXT,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    data TEXT,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/erphs", (req, res) => {
    const teacherId = req.query.teacherId;
    let rows;
    if (teacherId) {
      rows = db.prepare("SELECT data FROM erphs WHERE teacherId = ?").all(teacherId);
    } else {
      rows = db.prepare("SELECT data FROM erphs").all();
    }
    res.json(rows.map((row: any) => JSON.parse(row.data)));
  });

  app.post("/api/erphs", (req, res) => {
    const erph = req.body;
    const stmt = db.prepare("INSERT OR REPLACE INTO erphs (id, teacherId, data, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)");
    stmt.run(erph.id, erph.teacherId, JSON.stringify(erph));
    res.json({ success: true });
  });

  app.post("/api/erphs/batch", (req, res) => {
    const erphs = req.body;
    const insert = db.prepare("INSERT OR REPLACE INTO erphs (id, teacherId, data, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)");
    const insertMany = db.transaction((items) => {
      for (const item of items) insert.run(item.id, item.teacherId, JSON.stringify(item));
    });
    insertMany(erphs);
    res.json({ success: true });
  });

  app.get("/api/users", (req, res) => {
    const rows = db.prepare("SELECT data FROM users").all();
    res.json(rows.map((row: any) => JSON.parse(row.data)));
  });

  app.post("/api/users", (req, res) => {
    const user = req.body;
    const stmt = db.prepare("INSERT OR REPLACE INTO users (id, data, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP)");
    stmt.run(user.id, JSON.stringify(user));
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
