#!/usr/bin/env bash
set -euo pipefail

IMAGE="${1:?Debes indicar la imagen con su etiqueta}"
CONFIG="/etc/nginx/sites-available/api-sqlite-cicd"
VOLUME="api-sqlite-cicd-data"

# Impide ejecutar dos despliegues simultaneamente.
exec 9>/var/lock/api-sqlite-deploy.lock
flock -n 9 || {
  echo "Ya hay otro despliegue en ejecucion"
  exit 1
}

# Identifica el contenedor que recibe las solicitudes.
if grep -q 'proxy_pass http://127.0.0.1:3001;' "$CONFIG"; then
  CURRENT_PORT=3001
  NEXT_PORT=3002
  NEXT_NAME="api-sqlite-green"
elif grep -q 'proxy_pass http://127.0.0.1:3002;' "$CONFIG"; then
  CURRENT_PORT=3002
  NEXT_PORT=3001
  NEXT_NAME="api-sqlite-blue"
else
  echo "No se reconoce el destino actual de Nginx"
  exit 1
fi

docker pull "$IMAGE"

BACKUP=$(mktemp)
cp "$CONFIG" "$BACKUP"
SWITCHED=false
CREATED=false

# Si falla el despliegue, recupera la configuracion anterior.
cleanup() {
  result=$?
  trap - EXIT

  if [ "$result" -ne 0 ]; then
    if [ "$SWITCHED" = true ]; then
      cp "$BACKUP" "$CONFIG"
      if nginx -t && systemctl reload nginx; then
        echo "Nginx restaurado a la version anterior"
      else
        echo "ERROR: no se pudo restaurar Nginx"
        rm -f "$BACKUP"
        exit "$result"
      fi
    fi

    if [ "$CREATED" = true ]; then
      docker rm -f "$NEXT_NAME" || true
    fi
  fi

  rm -f "$BACKUP"
  exit "$result"
}
trap cleanup EXIT

# Reemplaza solamente el contenedor que no recibe trafico.
if docker container inspect "$NEXT_NAME" >/dev/null 2>&1; then
  docker rm -f "$NEXT_NAME"
fi

docker run -d \
  --name "$NEXT_NAME" \
  --restart unless-stopped \
  -p "127.0.0.1:${NEXT_PORT}:3000" \
  -v "${VOLUME}:/app/data" \
  "$IMAGE"
CREATED=true

# Espera hasta que la nueva API responda.
READY=false
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 2 \
    "http://127.0.0.1:${NEXT_PORT}/api/salud"; then
    READY=true
    break
  fi
  sleep 2
done

if [ "$READY" != true ]; then
  docker logs --tail 50 "$NEXT_NAME"
  echo "La nueva version no supero la comprobacion de salud"
  exit 1
fi

SWITCHED=true
sed -i \
  "s/127\.0\.0\.1:${CURRENT_PORT}/127.0.0.1:${NEXT_PORT}/" \
  "$CONFIG"

nginx -t
systemctl reload nginx

curl --fail --silent --show-error --max-time 10 \
  http://127.0.0.1/api/salud

echo
echo "Despliegue completado: ${NEXT_NAME}, imagen ${IMAGE}"