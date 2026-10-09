const express = require('express');
const { ApiError, validateId, validateUser } = require('./service');

function createApp(db) {
  const app = express();

  app.use(express.json({ limit: '16kb' }));

  function respond(res, statusCode, data, message) {
    return res.status(statusCode).json({
      statusCode,
      data,
      message
    });
  }

  const find = id => {
    const row = db
      .prepare('SELECT * FROM usuarios WHERE id = ?')
      .get(id);

    if (!row) {
      throw new ApiError(404, 'Usuario no encontrado');
    }

    return row;
  };

  app.get('/api/salud', (req, res) => {
    respond(
      res,
      200,
      { estado: 'OK' },
      'Despliegue automatico funcionando'
    );
  });

  app.get('/api/usuarios', (req, res) => {
    const usuarios = db
      .prepare('SELECT * FROM usuarios ORDER BY id')
      .all();

    respond(res, 200, usuarios, 'Usuarios consultados correctamente');
  });

  // Las rutas fijas deben ir antes de /:id.
  app.get('/api/usuarios/buscar', (req, res) => {
    if (
      typeof req.query.nombre !== 'string' ||
      !req.query.nombre.trim()
    ) {
      throw new ApiError(400, 'Se requiere nombre');
    }

    const nombre = req.query.nombre.trim();

    const usuarios = db.prepare(`
      SELECT * FROM usuarios
      WHERE instr(lower(nombre), lower(?)) > 0
      ORDER BY id
    `).all(nombre);

    respond(res, 200, usuarios, 'Busqueda realizada correctamente');
  });

  app.get('/api/usuarios/activos', (req, res) => {
    const usuarios = db
      .prepare('SELECT * FROM usuarios WHERE activo = 1 ORDER BY id')
      .all();

    respond(res, 200, usuarios, 'Usuarios activos consultados correctamente');
  });

  app.get('/api/usuarios/estadisticas', (req, res) => {
    const estadisticas = db.prepare(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(activo), 0) AS activos
      FROM usuarios
    `).get();

    respond(res, 200, estadisticas, 'Estadisticas consultadas correctamente');
  });

  app.get('/api/usuarios/:id', (req, res) => {
    const usuario = find(validateId(req.params.id));

    respond(res, 200, usuario, 'Usuario consultado correctamente');
  });

  app.post('/api/usuarios', (req, res) => {
    const usuario = validateUser(req.body);

    const resultado = db.prepare(`
      INSERT INTO usuarios(nombre, correo, edad)
      VALUES (?, ?, ?)
    `).run(usuario.nombre, usuario.correo, usuario.edad);

    const creado = find(Number(resultado.lastInsertRowid));

    respond(res, 201, creado, 'Usuario creado correctamente');
  });

  app.put('/api/usuarios/:id', (req, res) => {
    const id = validateId(req.params.id);
    find(id);

    const usuario = validateUser(req.body);

    db.prepare(`
      UPDATE usuarios
      SET nombre = ?, correo = ?, edad = ?
      WHERE id = ?
    `).run(usuario.nombre, usuario.correo, usuario.edad, id);

    respond(res, 200, find(id), 'Usuario actualizado correctamente');
  });

  app.patch('/api/usuarios/:id', (req, res) => {
    const id = validateId(req.params.id);

    const usuario = {
      ...find(id),
      ...validateUser(req.body, true)
    };

    db.prepare(`
      UPDATE usuarios
      SET nombre = ?, correo = ?, edad = ?
      WHERE id = ?
    `).run(usuario.nombre, usuario.correo, usuario.edad, id);

    respond(res, 200, find(id), 'Usuario actualizado parcialmente');
  });

  for (const [action, active] of [
    ['activar', 1],
    ['desactivar', 0]
  ]) {
    app.patch(`/api/usuarios/:id/${action}`, (req, res) => {
      const id = validateId(req.params.id);
      find(id);

      db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?')
        .run(active, id);

      const mensaje = active === 1
        ? 'Usuario activado correctamente'
        : 'Usuario desactivado correctamente';

      respond(res, 200, find(id), mensaje);
    });
  }

  app.delete('/api/usuarios/:id', (req, res) => {
    const id = validateId(req.params.id);
    find(id);

    db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);

    respond(res, 200, { id }, 'Usuario eliminado correctamente');
  });

  app.use((req, res) => {
    respond(res, 404, null, 'Ruta no encontrada');
  });

  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return respond(res, 400, null, 'JSON mal formado');
    }

    if (err.type === 'entity.too.large') {
      return respond(res, 413, null, 'JSON demasiado grande');
    }

    if (err instanceof ApiError) {
      return respond(res, err.status, null, err.message);
    }

    if (
      err.code === 'ERR_SQLITE_ERROR' &&
      typeof err.message === 'string' &&
      err.message.includes('UNIQUE constraint failed')
    ) {
      return respond(res, 409, null, 'El correo ya está registrado');
    }

    return respond(res, 500, null, 'Error interno del servidor');
  });

  return app;
}

module.exports = { createApp };