const express = require('express');
const { ApiError, validateId, validateUser } = require('./service');
function createApp(db) {
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  const find = id => {
    const row = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
    if (!row) throw new ApiError(404, 'Usuario no encontrado');
    return row;
  };
  app.get('/api/salud', (req, res) => res.json({ estado: 'OK' }));
  app.get('/api/usuarios', (req, res) => res.json(db.prepare('SELECT * FROM usuarios ORDER BY id').all()));
  // Rutas fijas antes de /:id para evitar interpretarlas como identificadores.
  app.get('/api/usuarios/buscar', (req, res) => {
    if (typeof req.query.nombre !== 'string' || !req.query.nombre.trim()) throw new ApiError(400, 'Se requiere nombre');
    const name = req.query.nombre.trim();
    res.json(db.prepare('SELECT * FROM usuarios WHERE instr(lower(nombre), lower(?)) > 0 ORDER BY id').all(name));
  });
  app.get('/api/usuarios/activos', (req, res) => res.json(db.prepare('SELECT * FROM usuarios WHERE activo = 1 ORDER BY id').all()));
  app.get('/api/usuarios/estadisticas', (req, res) => res.json(db.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(activo),0) AS activos FROM usuarios').get()));
  app.get('/api/usuarios/:id', (req, res) => res.json(find(validateId(req.params.id))));
  app.post('/api/usuarios', (req, res) => {
    const u = validateUser(req.body);
    const r = db.prepare('INSERT INTO usuarios(nombre,correo,edad) VALUES(?,?,?)').run(u.nombre, u.correo, u.edad);
    res.status(201).json(find(Number(r.lastInsertRowid)));
  });
  app.put('/api/usuarios/:id', (req, res) => {
    const id = validateId(req.params.id); find(id);
    const u = validateUser(req.body);
    db.prepare('UPDATE usuarios SET nombre=?,correo=?,edad=? WHERE id=?').run(u.nombre,u.correo,u.edad,id);
    res.json(find(id));
  });
  app.patch('/api/usuarios/:id', (req, res) => {
    const id = validateId(req.params.id);
    const u = { ...find(id), ...validateUser(req.body, true) };
    db.prepare('UPDATE usuarios SET nombre=?,correo=?,edad=? WHERE id=?').run(u.nombre,u.correo,u.edad,id);
    res.json(find(id));
  });
  for (const [action, active] of [['activar',1],['desactivar',0]]) {
    app.patch(`/api/usuarios/:id/${action}`, (req,res) => {
      const id = validateId(req.params.id); find(id);
      db.prepare('UPDATE usuarios SET activo=? WHERE id=?').run(active,id);
      res.json(find(id));
    });
  }
  app.delete('/api/usuarios/:id', (req,res) => {
    const id = validateId(req.params.id); find(id);
    db.prepare('DELETE FROM usuarios WHERE id=?').run(id);
    res.status(204).end();
  });
  app.use((req,res) => res.status(404).json({ error: 'Ruta no encontrada' }));
  app.use((err,req,res,next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON mal formado' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'JSON demasiado grande' });
    if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
    if (err.code === 'ERR_SQLITE_ERROR' && err.message.includes('UNIQUE constraint failed'))
      return res.status(409).json({ error: 'El correo ya está registrado' });
    res.status(500).json({ error: 'Error interno del servidor' });
  });
  return app;
}
module.exports = { createApp };
