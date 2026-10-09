// Validación independiente de HTTP: estas funciones tienen pruebas unitarias.
class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function validateId(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)))
    throw new ApiError(400, 'El ID debe ser un entero positivo');
  return Number(value);
}
function validateUser(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'Se requiere un objeto JSON');
  const keys = Object.keys(body);
  if (keys.some(k => !['nombre', 'correo', 'edad'].includes(k))) throw new ApiError(400, 'Hay campos desconocidos');
  if (partial && keys.length === 0) throw new ApiError(400, 'Envía al menos un campo');
  const result = {};
  if (!partial || 'nombre' in body) {
    if (typeof body.nombre !== 'string' || body.nombre.trim().length < 2 || body.nombre.trim().length > 100)
      throw new ApiError(400, 'El nombre debe tener entre 2 y 100 caracteres');
    result.nombre = body.nombre.trim();
  }
  if (!partial || 'correo' in body) {
    if (typeof body.correo !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.correo.trim()) || body.correo.length > 254)
      throw new ApiError(400, 'El correo es obligatorio y debe ser válido');
    result.correo = body.correo.trim().toLowerCase();
  }
  if (!partial || 'edad' in body) {
    if (!Number.isInteger(body.edad) || body.edad < 1 || body.edad > 120)
      throw new ApiError(400, 'La edad debe ser un entero entre 1 y 120');
    result.edad = body.edad;
  }
  return result;
}
module.exports = { ApiError, validateId, validateUser };
