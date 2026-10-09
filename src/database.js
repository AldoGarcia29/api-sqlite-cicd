const { DatabaseSync } = require('node:sqlite');
function createDatabase(filename = ':memory:') {
  const db = new DatabaseSync(filename);
  db.exec(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL, correo TEXT NOT NULL UNIQUE,
    edad INTEGER NOT NULL CHECK(edad BETWEEN 1 AND 120),
    activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1))
  )`);
  return db;
}
module.exports = { createDatabase };
