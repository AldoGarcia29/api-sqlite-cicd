const request = require('supertest');
const { createDatabase } = require('../src/database');
const { createApp } = require('../src/app');

let db, app, id;

const user = {
  nombre: 'Aldo García',
  correo: 'aldo@mail.com',
  edad: 21
};

// Comprueba que el código HTTP coincida con el cuerpo JSON.
function expectResponse(response, statusCode) {
  expect(response.status).toBe(statusCode);
  expect(response.body).toEqual({
    statusCode,
    data: expect.anything(),
    message: expect.any(String)
  });
}

function expectError(response, statusCode, message) {
  expect(response.status).toBe(statusCode);
  expect(response.body.statusCode).toBe(statusCode);
  expect(response.body.data).toBeNull();
  expect(typeof response.body.message).toBe('string');

  if (message !== undefined) {
    expect(response.body.message).toBe(message);
  }

  expect(Object.keys(response.body).sort()).toEqual([
    'data',
    'message',
    'statusCode'
  ]);
}

beforeEach(async () => {
  db = createDatabase();
  app = createApp(db);

  const response = await request(app)
    .post('/api/usuarios')
    .send(user);

  expectResponse(response, 201);
  id = response.body.data.id;
});

afterEach(() => db.close());

describe('Integración: 12 endpoints con Express + SQLite real en memoria', () => {
  test('GET salud: 200', async () => {
    const r = await request(app).get('/api/salud');

    expectResponse(r, 200);
    expect(r.body.data).toEqual({ estado: 'OK' });
    expect(r.body.message.length).toBeGreaterThan(0);
  });

  test('GET lista: incluye usuario', async () => {
    const r = await request(app).get('/api/usuarios');

    expectResponse(r, 200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0].correo).toBe(user.correo);
  });

  test('GET por ID: devuelve usuario', async () => {
    const r = await request(app).get(`/api/usuarios/${id}`);

    expectResponse(r, 200);
    expect(r.body.data.correo).toBe(user.correo);
  });

  test('GET buscar: encuentra por nombre', async () => {
    const r = await request(app)
      .get('/api/usuarios/buscar')
      .query({ nombre: 'Aldo' });

    expectResponse(r, 200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0].id).toBe(id);
  });

  test('GET activos: excluye desactivados', async () => {
    const desactivado = await request(app)
      .patch(`/api/usuarios/${id}/desactivar`);

    expectResponse(desactivado, 200);

    const r = await request(app).get('/api/usuarios/activos');

    expectResponse(r, 200);
    expect(r.body.data).toEqual([]);
  });

  test('GET estadísticas: cuenta usuarios', async () => {
    const r = await request(app).get('/api/usuarios/estadisticas');

    expectResponse(r, 200);
    expect(r.body.data).toEqual({ total: 1, activos: 1 });
  });

  test('POST: crea y persiste', async () => {
    const r = await request(app)
      .post('/api/usuarios')
      .send({ ...user, correo: 'nuevo@mail.com' });

    expectResponse(r, 201);

    const guardado = db
      .prepare('SELECT correo FROM usuarios WHERE id = ?')
      .get(r.body.data.id);

    expect(guardado.correo).toBe('nuevo@mail.com');
  });

  test('PUT: actualiza todos los campos', async () => {
    const actualizado = {
      nombre: 'Maite',
      correo: 'maite@mail.com',
      edad: 22
    };

    const r = await request(app)
      .put(`/api/usuarios/${id}`)
      .send(actualizado);

    expectResponse(r, 200);

    const consulta = await request(app).get(`/api/usuarios/${id}`);

    expectResponse(consulta, 200);
    expect(consulta.body.data).toMatchObject(actualizado);
  });

  test('PATCH: cambia edad y conserva correo', async () => {
    const r = await request(app)
      .patch(`/api/usuarios/${id}`)
      .send({ edad: 22 });

    expectResponse(r, 200);
    expect(r.body.data.edad).toBe(22);
    expect(r.body.data.correo).toBe(user.correo);
  });

  test('PATCH activar: activa usuario', async () => {
    const desactivado = await request(app)
      .patch(`/api/usuarios/${id}/desactivar`);

    expectResponse(desactivado, 200);

    const r = await request(app).patch(`/api/usuarios/${id}/activar`);

    expectResponse(r, 200);
    expect(r.body.data.activo).toBe(1);
  });

  test('PATCH desactivar: desactiva usuario', async () => {
    const r = await request(app)
      .patch(`/api/usuarios/${id}/desactivar`);

    expectResponse(r, 200);
    expect(r.body.data.activo).toBe(0);
  });

  test('DELETE: elimina y luego responde 404', async () => {
    const r = await request(app).delete(`/api/usuarios/${id}`);

    expectResponse(r, 200);
    expect(r.body.data).toEqual({ id });
    expect(r.body.message).toBe('Usuario eliminado correctamente');

    const consulta = await request(app).get(`/api/usuarios/${id}`);

    expectError(consulta, 404, 'Usuario no encontrado');
  });
});

describe('Escenarios de fallos al consumir la API', () => {
  test.each(['get', 'put', 'patch', 'delete'])(
    '%s: ID inválido 400',
    async method => {
      const r = await request(app)[method]('/api/usuarios/abc')
        .send(user);

      expectError(r, 400, 'El ID debe ser un entero positivo');
    }
  );

  test.each(['get', 'put', 'patch', 'delete'])(
    '%s: usuario inexistente 404',
    async method => {
      const r = await request(app)[method]('/api/usuarios/999')
        .send(user);

      expectError(r, 404, 'Usuario no encontrado');
    }
  );

  test.each(['activar', 'desactivar'])(
    'PATCH %s: ID inválido e inexistente',
    async action => {
      const invalido = await request(app)
        .patch(`/api/usuarios/abc/${action}`);

      expectError(invalido, 400);

      const inexistente = await request(app)
        .patch(`/api/usuarios/999/${action}`);

      expectError(inexistente, 404, 'Usuario no encontrado');
    }
  );

  test.each([
    { nombre: 'Aldo', edad: 21 },
    { ...user, correo: 'invalido' },
    { ...user, edad: -1 },
    { ...user, edad: '21' },
    { ...user, nombre: '' },
    { ...user, rol: 'admin' },
    []
  ])('POST: cuerpo inválido %#', async body => {
    const r = await request(app).post('/api/usuarios').send(body);

    expectError(r, 400);
    expect(db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n)
      .toBe(1);
  });

  test('POST: correo duplicado 409', async () => {
    const r = await request(app)
      .post('/api/usuarios')
      .send({ ...user, correo: 'ALDO@mail.com' });

    expectError(r, 409, 'El correo ya está registrado');
  });

  test('PUT: faltan campos 400 y no modifica datos', async () => {
    const r = await request(app)
      .put(`/api/usuarios/${id}`)
      .send({ nombre: 'Maite' });

    expectError(r, 400);

    const consulta = await request(app).get(`/api/usuarios/${id}`);

    expectResponse(consulta, 200);
    expect(consulta.body.data).toMatchObject(user);
  });

  test.each([{}, { edad: 0 }, { activo: 0 }])(
    'PATCH inválido %#: 400',
    async body => {
      const r = await request(app)
        .patch(`/api/usuarios/${id}`)
        .send(body);

      expectError(r, 400);
    }
  );

  test.each(['put', 'patch'])(
    '%s correo duplicado: 409 y sin cambios',
    async method => {
      const creado = await request(app)
        .post('/api/usuarios')
        .send({ ...user, correo: 'otro@mail.com' });

      expectResponse(creado, 201);

      const body = method === 'put'
        ? { ...user, correo: 'otro@mail.com' }
        : { correo: 'otro@mail.com' };

      const r = await request(app)[method](`/api/usuarios/${id}`)
        .send(body);

      expectError(r, 409, 'El correo ya está registrado');

      const consulta = await request(app).get(`/api/usuarios/${id}`);

      expectResponse(consulta, 200);
      expect(consulta.body.data).toMatchObject(user);
    }
  );

  test('GET buscar: falta parámetro 400', async () => {
    const r = await request(app).get('/api/usuarios/buscar');

    expectError(r, 400, 'Se requiere nombre');
  });

  test('GET buscar: sin coincidencias 200 y lista vacía', async () => {
    const r = await request(app)
      .get('/api/usuarios/buscar')
      .query({ nombre: 'Desconocido' });

    expectResponse(r, 200);
    expect(r.body.data).toEqual([]);
  });

  test('GET buscar: entrada SQL se trata como texto', async () => {
    const r = await request(app)
      .get('/api/usuarios/buscar')
      .query({ nombre: "' OR 1=1 --" });

    expectResponse(r, 200);
    expect(r.body.data).toEqual([]);
  });

  test('POST JSON mal formado: 400', async () => {
    const r = await request(app)
      .post('/api/usuarios')
      .set('Content-Type', 'application/json')
      .send('{"nombre":');

    expectError(r, 400, 'JSON mal formado');
  });

  test('POST cuerpo demasiado grande: 413', async () => {
    const r = await request(app)
      .post('/api/usuarios')
      .send({ nombre: 'x'.repeat(20000) });

    expectError(r, 413, 'JSON demasiado grande');
  });

  test('Ruta desconocida: 404', async () => {
    const r = await request(app).get('/api/no-existe');

    expectError(r, 404, 'Ruta no encontrada');
  });

  test('Lista y estadísticas con base vacía', async () => {
    db.exec('DELETE FROM usuarios');

    const lista = await request(app).get('/api/usuarios');

    expectResponse(lista, 200);
    expect(lista.body.data).toEqual([]);

    const estadisticas = await request(app)
      .get('/api/usuarios/estadisticas');

    expectResponse(estadisticas, 200);
    expect(estadisticas.body.data).toEqual({
      total: 0,
      activos: 0
    });
  });

  test('Fallo interno: 500 sin detalles SQL', async () => {
    db.exec('DROP TABLE usuarios');

    const r = await request(app).get('/api/usuarios');

    expectError(r, 500, 'Error interno del servidor');
    expect(r.body).toEqual({
      statusCode: 500,
      data: null,
      message: 'Error interno del servidor'
    });
  });
});