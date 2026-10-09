const { validateUser, validateId } = require('../src/service');
describe('Pruebas unitarias: validación sin HTTP ni base de datos', () => {
  test('normaliza nombre y correo', () => expect(validateUser({nombre:' Aldo ',correo:' ALDO@mail.com ',edad:21})).toEqual({nombre:'Aldo',correo:'aldo@mail.com',edad:21}));
  test.each([undefined,null,[],{}, {nombre:'A',correo:'a@mail.com',edad:21}, {nombre:'Aldo',edad:21}, {nombre:'Aldo',correo:'mal',edad:21}, {nombre:'Aldo',correo:'a@mail.com',edad:'21'}, {nombre:'Aldo',correo:'a@mail.com',edad:0}, {nombre:'Aldo',correo:'a@mail.com',edad:121}, {nombre:'Aldo',correo:'a@mail.com',edad:2.5}, {nombre:'Aldo',correo:'a@mail.com',edad:21,rol:'admin'}])('rechaza entrada inválida %#', body => expect(() => validateUser(body)).toThrow());
  test('permite actualizar un solo campo', () => expect(validateUser({edad:22},true)).toEqual({edad:22}));
  test('rechaza PATCH vacío', () => expect(() => validateUser({},true)).toThrow());
  test.each(['abc','0','-1','1.5','1 OR 1=1','9007199254740993'])('rechaza ID %s', id => expect(() => validateId(id)).toThrow());
  test('acepta ID entero', () => expect(validateId('1')).toBe(1));
});
