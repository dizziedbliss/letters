import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const dbPath = process.env.DB_PATH || 'data/letters.db';
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS letters (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
`);

const cols = 'id, title, body, created_at AS createdAt, updated_at AS updatedAt';

export const letters = {
  all: () => db.prepare(`SELECT ${cols} FROM letters ORDER BY updated_at DESC`).all(),
  get: (id) => db.prepare(`SELECT ${cols} FROM letters WHERE id = ?`).get(id),
  random: () => db.prepare(`SELECT ${cols} FROM letters ORDER BY RANDOM() LIMIT 1`).get(),
  create: (title, body) => {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO letters (title, body) VALUES (?, ?)')
      .run(title, body);
    return letters.get(Number(lastInsertRowid));
  },
  update: (id, title, body) => {
    const { changes } = db
      .prepare(
        "UPDATE letters SET title = ?, body = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?"
      )
      .run(title, body, id);
    return changes ? letters.get(id) : null;
  },
  remove: (id) => db.prepare('DELETE FROM letters WHERE id = ?').run(id).changes > 0,
};
