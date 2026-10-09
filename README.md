# API REST de usuarios con SQLite y CI/CD

API REST desarrollada con Node.js, Express y SQLite. Incluye pruebas automatizadas, cobertura de código, contenedorización y un pipeline de GitHub Actions que publica imágenes en Docker Hub y despliega la aplicación en AWS EC2.

## Tecnologías

- Node.js 24.
- Express 5.
- SQLite mediante `node:sqlite`.
- Jest y Supertest.
- Docker y Docker Hub.
- GitHub Actions.
- AWS EC2 con Ubuntu Server.
- Nginx como proxy inverso.

## Arquitectura

GitHub Actions ejecuta las pruebas antes de construir y publicar la imagen. Si estas etapas finalizan correctamente, se conecta a EC2 mediante SSH y ejecuta `scripts/deploy.sh`.

En EC2, Nginx recibe las solicitudes HTTP en el puerto 80 y las dirige al contenedor activo.

| Componente | Función |
|---|---|
| GitHub | Almacena el código y el workflow |
| GitHub Actions | Ejecuta pruebas, publica imágenes y despliega |
| Docker Hub | Almacena las imágenes de la aplicación |
| AWS EC2 | Ejecuta Docker y Nginx |
| Nginx | Dirige las solicitudes hacia la versión activa |
| Contenedor azul | Expone la API en `127.0.0.1:3001` |
| Contenedor verde | Expone la API en `127.0.0.1:3002` |
| Volumen Docker | Conserva la base SQLite entre despliegues |

Cada contenedor ejecuta la API internamente en el puerto 3000.

## Estructura del proyecto

- `src/app.js`: endpoints y manejo de errores.
- `src/database.js`: conexión y creación de la tabla SQLite.
- `src/service.js`: validación de identificadores y usuarios.
- `src/server.js`: inicio del servidor y base persistente.
- `tests/endpoints.test.js`: pruebas de integración.
- `tests/service.test.js`: pruebas unitarias.
- `scripts/deploy.sh`: despliegue azul/verde.
- `.github/workflows/main.yml`: pipeline CI/CD.
- `Dockerfile`: construcción de la imagen.
- `.dockerignore`: exclusiones del contexto de construcción.
- `.gitignore`: exclusiones del repositorio.

## Ejecución local

Se requiere Node.js 24 y npm.

```bash
git clone https://github.com/AldoGarcia29/api-sqlite-cicd.git
cd api-sqlite-cicd
npm ci
npm start
```

La API estará disponible en:

```text
http://localhost:3000/api/salud
```

La base persistente se crea en `data/usuarios.sqlite`.

## Endpoints

| Método | Ruta | Descripción | Código exitoso |
|---|---|---|---|
| GET | `/api/salud` | Comprueba el estado de la API | 200 |
| GET | `/api/usuarios` | Lista los usuarios | 200 |
| GET | `/api/usuarios/buscar?nombre=Aldo` | Busca usuarios por nombre | 200 |
| GET | `/api/usuarios/activos` | Lista los usuarios activos | 200 |
| GET | `/api/usuarios/estadisticas` | Devuelve total de usuarios y activos | 200 |
| GET | `/api/usuarios/:id` | Consulta un usuario | 200 |
| POST | `/api/usuarios` | Crea un usuario | 201 |
| PUT | `/api/usuarios/:id` | Actualiza nombre, correo y edad | 200 |
| PATCH | `/api/usuarios/:id` | Actualiza uno o varios campos | 200 |
| PATCH | `/api/usuarios/:id/activar` | Activa un usuario | 200 |
| PATCH | `/api/usuarios/:id/desactivar` | Desactiva un usuario | 200 |
| DELETE | `/api/usuarios/:id` | Elimina un usuario | 200 |

### Formato de respuestas

Todas las respuestas JSON utilizan `statusCode`, `data` y `message`. El valor de `statusCode` coincide con el código HTTP real.

Respuesta de salud:

```json
{
  "statusCode": 200,
  "data": {
    "estado": "OK"
  },
  "message": "Despliegue automatico funcionando"
}
```

Respuesta de error:

```json
{
  "statusCode": 404,
  "data": null,
  "message": "Usuario no encontrado"
}
```

DELETE devuelve HTTP 200 para incluir la confirmación en el cuerpo JSON.

### Datos para crear un usuario

```json
{
  "nombre": "Aldo García",
  "correo": "aldo@example.com",
  "edad": 21
}
```

Validaciones:

- Nombre de entre 2 y 100 caracteres después de eliminar espacios exteriores.
- Correo válido y único, normalizado a minúsculas.
- Edad entera de entre 1 y 120.
- Identificador entero positivo dentro del rango seguro de JavaScript.
- No se permiten campos desconocidos.
- PATCH debe incluir al menos un campo permitido.

### Ejemplo en PowerShell

```powershell
$usuario = @{
    nombre = "Prueba API"
    correo = "prueba@example.com"
    edad = 21
} | ConvertTo-Json

Invoke-RestMethod `
    -Method Post `
    -Uri http://localhost:3000/api/usuarios `
    -ContentType "application/json" `
    -Body $usuario

Invoke-RestMethod http://localhost:3000/api/usuarios |
    ConvertTo-Json -Depth 5
```

### Códigos de error

| Código | Situación |
|---|---|
| 400 | Datos inválidos, identificador inválido o JSON mal formado |
| 404 | Usuario o ruta inexistente |
| 409 | Correo duplicado |
| 413 | Cuerpo de solicitud demasiado grande |
| 500 | Error interno sin exponer detalles SQL |

## Pruebas y cobertura

Ejecutar las pruebas:

```bash
npm test
```

Ejecutar las pruebas con cobertura:

```bash
npm run coverage
```

El conjunto incluye 66 pruebas unitarias y de integración. Las pruebas de integración utilizan una base SQLite real en memoria, independiente para cada prueba.

Se comprueban operaciones exitosas, validaciones, usuarios inexistentes, correos duplicados, entradas SQL tratadas como texto y errores HTTP.

El umbral mínimo configurado es 70% para:

- Sentencias.
- Ramas.
- Funciones.
- Líneas.

La última ejecución local reportó 100% en las cuatro métricas para `app.js`, `database.js` y `service.js`. `server.js` no forma parte de los archivos medidos.

El resumen aparece en la terminal y en los logs de GitHub Actions. Los archivos de cobertura se generan en `coverage/`.

## Ejecución con Docker

Construir la imagen:

```bash
docker build -t api-sqlite:local .
```

Crear el volumen persistente:

```bash
docker volume create api-sqlite-data
```

Ejecutar el contenedor:

```bash
docker run -d --name api-sqlite-local -p 8081:3000 -v api-sqlite-data:/app/data api-sqlite:local
```

Consultar la API:

```text
http://localhost:8081/api/salud
```

Revisar los logs:

```bash
docker logs api-sqlite-local
```

El volumen conserva los datos al eliminar y recrear el contenedor, siempre que se vuelva a montar el mismo volumen.

### Características de la imagen

- Utiliza `node:24-bookworm-slim`.
- Instala dependencias mediante `npm ci --omit=dev`.
- Ejecuta la aplicación con el usuario `node`.
- Copia los manifiestos antes del código para aprovechar la caché.
- Excluye dependencias locales, pruebas, cobertura, datos y secretos mediante `.dockerignore`.

## Pipeline de GitHub Actions

El workflow se encuentra en:

```text
.github/workflows/main.yml
```

Se ejecuta en eventos `push` y `pull_request` dirigidos a `main`.

### Pruebas y cobertura

1. Descarga el código.
2. Prepara Node.js 24.
3. Instala dependencias con `npm ci`.
4. Ejecuta `npm run coverage`.

Si las pruebas fallan o la cobertura no alcanza el umbral, las etapas posteriores no se ejecutan.

### Construcción y publicación

Esta etapa se ejecuta únicamente para un push a `main`, después de aprobar las pruebas.

1. Se autentica en Docker Hub mediante un Personal Access Token.
2. Construye la imagen para `linux/amd64`.
3. Publica dos etiquetas:

```text
<DOCKERHUB_USERNAME>/api-sqlite-cicd:latest
<DOCKERHUB_USERNAME>/api-sqlite-cicd:<HASH_DEL_COMMIT>
```

### Despliegue

1. Verifica la huella ED25519 del servidor.
2. Se conecta por SSH con la clave privada almacenada en GitHub Secrets.
3. Envía `scripts/deploy.sh` a EC2.
4. Ejecuta el script con la imagen etiquetada con el hash del commit.

El despliegue utiliza el hash para ejecutar la versión correspondiente al código que aprobó las pruebas.

Los pull requests ejecutan las pruebas, pero no publican imágenes ni despliegan.

## GitHub Secrets

Configurar los siguientes secretos en:

```text
Settings → Secrets and variables → Actions → New repository secret
```

| Secret | Contenido |
|---|---|
| `DOCKERHUB_USERNAME` | Usuario de Docker Hub |
| `DOCKERHUB_TOKEN` | Personal Access Token con permiso de publicación |
| `EC2_HOST` | Dirección pública de la instancia |
| `EC2_USER` | Usuario SSH, normalmente `ubuntu` |
| `EC2_SSH_KEY` | Clave privada completa en formato PEM |
| `EC2_FINGERPRINT` | Huella SHA256 de la clave de host ED25519 |

La clave pública correspondiente a `EC2_SSH_KEY` debe estar autorizada en `~/.ssh/authorized_keys` del usuario de EC2.

La huella del servidor se obtiene desde una terminal confiable de EC2:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256
```

Guardar únicamente el valor que comienza con `SHA256:` en `EC2_FINGERPRINT`.

## Preparación de AWS EC2

Utilizar una instancia Ubuntu Server con arquitectura x86_64 y acceso SSH.

### Reglas de entrada

| Puerto | Uso |
|---|---|
| 22/TCP | Conexión SSH desde los orígenes autorizados |
| 80/TCP | Acceso HTTP público a la API |

El runner de GitHub Actions debe poder alcanzar el puerto 22. Permitir solamente la IP de una computadora personal no permite necesariamente la conexión del runner.

Los puertos 3001 y 3002 se enlazan a `127.0.0.1` y no requieren acceso público.

### Dependencias del servidor

En una instalación nueva de Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y docker.io nginx curl openssh-client util-linux
sudo systemctl enable --now docker
sudo systemctl enable --now nginx
```

El usuario utilizado por el workflow debe tener permiso para ejecutar el despliegue con `sudo -n`, sin una solicitud interactiva de contraseña.

### Primer contenedor

Sustituir `<DOCKERHUB_USERNAME>` por el usuario correspondiente:

```bash
sudo docker pull <DOCKERHUB_USERNAME>/api-sqlite-cicd:latest

sudo docker volume create api-sqlite-cicd-data

sudo docker run -d \
  --name api-sqlite-blue \
  --restart unless-stopped \
  -p 127.0.0.1:3001:3000 \
  -v api-sqlite-cicd-data:/app/data \
  <DOCKERHUB_USERNAME>/api-sqlite-cicd:latest
```

Comprobar la API:

```bash
curl --fail --show-error http://127.0.0.1:3001/api/salud
```

El repositorio de Docker Hub utilizado en este proyecto es público, por lo que EC2 puede descargar las imágenes sin iniciar sesión.

### Configuración de Nginx

Crear el archivo:

```text
/etc/nginx/sites-available/api-sqlite-cicd
```

Contenido inicial:

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

En una instancia nueva con el sitio predeterminado de Ubuntu:

```bash
sudo ln -s /etc/nginx/sites-available/api-sqlite-cicd /etc/nginx/sites-enabled/api-sqlite-cicd
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Comprobar el acceso mediante Nginx:

```bash
curl --fail --show-error http://127.0.0.1/api/salud
```

## Despliegue azul/verde

El script identifica el puerto configurado en Nginx y prepara el contenedor del color contrario.

1. Bloquea despliegues simultáneos mediante `flock`.
2. Descarga la imagen del commit.
3. Respalda la configuración de Nginx.
4. Reemplaza el contenedor inactivo.
5. Inicia la nueva versión con el volumen persistente.
6. Comprueba su endpoint de salud con hasta 30 intentos.
7. Cambia el destino de Nginx.
8. Valida y recarga Nginx.
9. Comprueba la API a través del proxy.

La versión activa continúa atendiendo mientras se prepara la nueva. La versión anterior queda encendida y se reemplaza cuando vuelve a ser el contenedor inactivo en un despliegue posterior.

Si el script detecta un fallo durante el cambio, intenta restaurar la configuración anterior y retirar el nuevo contenedor.

Ambos contenedores comparten la misma base SQLite. Esta estrategia requiere que las versiones sean compatibles con el esquema existente; el script no revierte cambios de datos o migraciones.

El procedimiento busca evitar una interrupción al cambiar de versión. Una comprobación de salud exitosa no constituye por sí sola una medición de disponibilidad continua.

Guardar `scripts/deploy.sh` con finales de línea LF.

## URL pública

La API se consulta mediante:

```text
http://<IP_PUBLICA_EC2>/api/salud
http://<IP_PUBLICA_EC2>/api/usuarios
```

La dirección real se proporciona por separado para la entrega y se configura como `EC2_HOST` en GitHub Secrets.

## Demostración práctica

1. Consultar la respuesta pública de `/api/salud`.
2. Cambiar únicamente el texto de `message` en esa ruta.
3. Ejecutar las pruebas localmente:

```bash
npm run coverage
```

4. Guardar y publicar el cambio:

```bash
git add src/app.js
git commit -m "Actualiza mensaje para demostrar despliegue automatico"
git push origin main
```

5. Mostrar en GitHub Actions las etapas de pruebas, publicación y despliegue.
6. Mostrar en Docker Hub la etiqueta del nuevo commit.
7. Consultar nuevamente la API pública y comprobar el nuevo mensaje.

La prueba de salud verifica el estado y la estructura de la respuesta, permitiendo cambiar el mensaje durante la demostración.

## Seguridad

- Contraseñas, tokens, direcciones del servidor y claves privadas se gestionan mediante GitHub Secrets.
- No se incluyen archivos `.pem`, `.key` ni `.env` en el repositorio o la imagen.
- La conexión SSH verifica la huella del servidor y utiliza comprobación estricta de la clave de host.
- Las consultas SQL utilizan parámetros para los valores recibidos.
- Los errores internos no exponen detalles SQL.
- La imagen ejecuta la aplicación con un usuario sin privilegios de administrador.

## Entregables

- Repositorio: https://github.com/AldoGarcia29/api-sqlite-cicd
- Código fuente y pruebas.
- Workflow `.github/workflows/main.yml`.
- `Dockerfile` y `.dockerignore`.
- Script `scripts/deploy.sh`.
- Documentación en `README.md`.
- URL pública proporcionada por separado.
- Demostración en vivo mediante un push que actualiza el mensaje de la API.
