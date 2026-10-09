# Actividad: pruebas unitarias y endpoints con SQLite
Alumno: Aldo Jair García Pacheco

## Instalación en Windows / Visual Studio Code
1. Instala Node.js 24 LTS. Verifica con `node --version`.
2. Extrae este ZIP y abre la carpeta api-sqlite en Visual Studio Code.
3. En Terminal > Nueva terminal, ejecuta desde esa carpeta:

```bash
npm ci
npm test
npm start
```

La API escucha en http://localhost:3000. No necesitas instalar SQLite ni configurar un servidor de base de datos: se crea automáticamente data/usuarios.sqlite. npm test no requiere iniciar el servidor. Para detenerlo: Ctrl+C.

Para el reporte de cobertura ejecuta `npm run coverage` y abre coverage/lcov-report/index.html.
Si Node muestra ExperimentalWarning por node:sqlite, es una advertencia del módulo; no significa que las pruebas hayan fallado.

## Los 12 endpoints
| # | Método | Ruta | Objetivo | Éxito | Fallos del usuario |
|---|---|---|---|---|---|
|1|GET|/api/salud|Verificar API|200|No recibe datos; ruta incorrecta da 404|
|2|GET|/api/usuarios|Listar usuarios|200|Lista vacía es válida|
|3|GET|/api/usuarios/:id|Consultar usuario|200|400 ID inválido; 404 inexistente|
|4|GET|/api/usuarios/buscar?nombre=Aldo|Buscar nombre|200|400 sin nombre; sin coincidencias devuelve []|
|5|GET|/api/usuarios/activos|Listar activos|200|Sin activos devuelve []|
|6|GET|/api/usuarios/estadisticas|Total y activos|200|Sin usuarios devuelve ceros|
|7|POST|/api/usuarios|Crear|201|400 campos inválidos; 409 correo duplicado|
|8|PUT|/api/usuarios/:id|Actualizar nombre, correo y edad completos|200|400 campos faltantes/ID inválido; 404 inexistente; 409 duplicado|
|9|PATCH|/api/usuarios/:id|Actualizar uno o más campos|200|400 cuerpo vacío/campo inválido; 404 inexistente; 409 duplicado|
|10|PATCH|/api/usuarios/:id/activar|Activar|200|400 ID inválido; 404 inexistente|
|11|PATCH|/api/usuarios/:id/desactivar|Desactivar|200|400 ID inválido; 404 inexistente|
|12|DELETE|/api/usuarios/:id|Eliminar|204|400 ID inválido; 404 inexistente|

UPDATE no es un método HTTP: es una operación SQL. En HTTP usamos PUT para actualizar todos los campos editables o PATCH para actualizar algunos. La activación se modifica mediante sus rutas específicas.

## Probar manualmente con Postman
Selecciona el método, pega la URL y en Body > raw > JSON pega:

POST http://localhost:3000/api/usuarios
```json
{"nombre":"Aldo García","correo":"aldo@mail.com","edad":21}
```
Obtendrás 201 y el ID generado. Usa ese ID en las siguientes peticiones.

PUT http://localhost:3000/api/usuarios/1
```json
{"nombre":"Aldo Jair","correo":"aldojair@mail.com","edad":22}
```
PATCH http://localhost:3000/api/usuarios/1
```json
{"edad":23}
```
GET http://localhost:3000/api/usuarios/1

DELETE http://localhost:3000/api/usuarios/1 (sin cuerpo)

Para reproducir el ejemplo del profesor, envía POST sin correo:
```json
{"nombre":"Aldo García","edad":21}
```
Devuelve 400. Repite un POST válido con el mismo correo y devuelve 409.

## Qué prueban los archivos
- tests/service.test.js: 23 pruebas unitarias de validación, sin HTTP ni SQLite.
- tests/endpoints.test.js: 43 pruebas de integración HTTP usando Supertest y SQLite real en memoria. Cada prueba inicia con una base nueva; no toca data/usuarios.sqlite.
- Se verifican respuestas, cambios persistidos, conservación de datos tras solicitudes inválidas, duplicados, IDs incorrectos, búsqueda, JSON mal formado, exceso de tamaño y error interno sin exponer SQL.
- src/app.js: rutas HTTP y manejo de errores.
- src/service.js: reglas de validación.
- src/database.js: conexión y creación de tabla.
- src/server.js: inicia el servidor y la base persistente.

## Resultado verificado
Se ejecutó npm run coverage con Node v24.19.0: 2 suites y 66 pruebas aprobadas. Cobertura del 100% en líneas, ramas, funciones y sentencias de src/app.js y src/service.js. La cobertura reportada no incluye server.js ni database.js; no significa que se haya probado todo posible comportamiento del sistema. Ver resultado-pruebas.txt.

## Evidencias para entregar
1. Captura de `npm test` con los casos y el total aprobados.
2. Captura de POST válido (201).
3. Captura de POST sin correo (400).
4. Captura de correo duplicado (409).
5. Capturas de GET, PUT, PATCH y DELETE.
6. Código del proyecto y explicación de pruebas unitarias frente a integración.

## Nota sobre el lenguaje solicitado
Este proyecto usa JavaScript con Express y Jest, siguiendo el ejemplo del profesor y la opción seleccionada. Si Rust o Visual Basic es obligatorio, esta versión no cumple ese requisito de lenguaje.

## Documentación oficial
- https://expressjs.com/en/starter/basic-routing/
- https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html
- https://jestjs.io/es-ES/docs/getting-started
