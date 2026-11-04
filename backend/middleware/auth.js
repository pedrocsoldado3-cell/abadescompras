// =====================================================================
// ARCHIVO: middleware/auth.js
// "Middlewares" de seguridad. Un middleware es una función que se
// ejecuta ANTES de la ruta y decide si se deja pasar la petición o no.
//   - verificarToken: comprueba que el usuario ha iniciado sesión.
//   - soloAdmin: comprueba que además es administrador.
// =====================================================================

const jwt = require('jsonwebtoken');


// ---------------------------------------------------------------------
// verificarToken
// 1) Lee la cabecera "Authorization", que el frontend envía así:
//      Authorization: Bearer eyJhbGciOi...
// 2) Si no viene, responde 401 (no autorizado).
// 3) Separa la palabra "Bearer" del token con split(' ') y se queda
//    con la segunda parte [1].
// ---------------------------------------------------------------------
function verificarToken(req, res, next) {
    const cabecera = req.headers['authorization'];

    if (!cabecera) {
        return res.status(401).json({ error: 'Debes iniciar sesión' });
    }

    const token = cabecera.split(' ')[1];

    // -----------------------------------------------------------------
    // jwt.verify comprueba la firma con nuestra clave secreta y que no
    // haya caducado. Si todo va bien devuelve los datos que metimos al
    // crear el token (id, nombre y rol) y los guardamos en req.usuario
    // para que las rutas sepan quién hace la petición.
    // IMPORTANTE: el rol se coge del token, no de lo que mande el
    // usuario en el formulario.
    // Si el token es falso o está caducado, jwt.verify lanza un error
    // y lo capturamos con try/catch.
    // -----------------------------------------------------------------
    try {
        const datos = jwt.verify(token, process.env.JWT_SECRETO);
        req.usuario = datos;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Sesión caducada o no válida. Vuelve a entrar.' });
    }
}


// ---------------------------------------------------------------------
// soloAdmin
// Se usa siempre DESPUÉS de verificarToken (así req.usuario ya existe).
// Si el rol no es ADMIN devuelve 403 (prohibido).
// ---------------------------------------------------------------------
function soloAdmin(req, res, next) {
    if (req.usuario.rol !== 'ADMIN') {
        return res.status(403).json({ error: 'Solo los administradores pueden hacer esto' });
    }
    next();
}


// ---------------------------------------------------------------------
// Exportamos las dos funciones en un objeto.
// ---------------------------------------------------------------------
module.exports = { verificarToken, soloAdmin };
