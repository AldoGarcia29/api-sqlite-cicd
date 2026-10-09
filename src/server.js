const path = require('node:path');
const fs = require('node:fs');
const { createDatabase } = require('./database');
const { createApp } = require('./app');
const data = path.join(__dirname, '..', 'data');
fs.mkdirSync(data, { recursive: true });
const db = createDatabase(path.join(data, 'usuarios.sqlite'));
const server = createApp(db).listen(3000, () => console.log('API en http://localhost:3000'));
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
