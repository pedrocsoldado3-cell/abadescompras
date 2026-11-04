// =====================================================================
// ARCHIVO: rutas/auth.js
// Registro público e inicio de sesión con token JWT.
//   POST /api/auth/registro
//   POST /api/auth/login
// =====================================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../bd');


// ---------------------------------------------------------------------
// Creamos un "router": un mini-servidor solo con las rutas de este
// archivo. En servidor.js se monta bajo /api/auth.
// ---------------------------------------------------------------------
const router = express.Router();


// ---------------------------------------------------------------------
// Expresión regular sencilla para comprobar que un email tiene la forma
// algo@algo.algo  (sin espacios).
// ---------------------------------------------------------------------
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


// =====================================================================
// POST /api/auth/registro
// Cuerpo esperado: { nombre_usuario, nombre_completo, email_usuario, contrasena }
// =====================================================================
router.post('/registro', async function (req, res) {

    // -----------------------------------------------------------------
    // Sacamos los datos que llegan del formulario y quitamos espacios
    // sobrantes con trim(). El "|| ''" evita errores si algún campo no
    // viene (undefined.trim() rompería el programa).
    // -----------------------------------------------------------------
    const nombreUsuario = (req.body.nombre_usuario || '').trim();
    const nombreCompleto = (req.body.nombre_completo || '').trim();
    const email = (req.body.email_usuario || '').trim().toLowerCase();
    const contrasena = req.body.contrasena || '';

    // -----------------------------------------------------------------
    // Control de entrada de datos en el servidor. Aunque el frontend ya
    // valida, aquí se vuelve a comprobar porque alguien podría saltarse
    // el formulario y llamar a la API directamente (con Postman, p. ej.).
    // -----------------------------------------------------------------
    if (nombreUsuario.length < 3 || nombreUsuario.length > 50) {
        return res.status(400).json({ error: 'El nombre de usuario debe tener entre 3 y 50 caracteres' });
    }
    if (nombreCompleto.length < 3 || nombreCompleto.length > 100) {
        return res.status(400).json({ error: 'El nombre completo debe tener entre 3 y 100 caracteres' });
    }
    if (!REGEX_EMAIL.test(email) || email.length > 120) {
        return res.status(400).json({ error: 'El correo electrónico no es válido' });
    }
    if (contrasena.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    // -----------------------------------------------------------------
    // Ciframos la contraseña con bcrypt. El 10 es el "coste":
    // cuántas vueltas da el algoritmo. Nunca se guarda la contraseña real.
    // Luego insertamos el usuario SIN rol y SIN activar. Usamos
    // $1, $2... (consultas parametrizadas) para evitar inyección SQL.
    // -----------------------------------------------------------------
    try {
        const hash = await bcrypt.hash(contrasena, 10);

        await pool.query(
            'INSERT INTO usuarios (nombre_usuario, nombre_completo, email_usuario, contrasena, rol, activo_usuario) ' +
            'VALUES ($1, $2, $3, $4, NULL, FALSE)',
            [nombreUsuario, nombreCompleto, email, hash]
        );

        res.status(201).json({ mensaje: 'Registro completado. Un administrador debe activar tu cuenta antes de entrar.' });

    } catch (error) {
        // -------------------------------------------------------------
        // El código 23505 de PostgreSQL significa "valor duplicado" (se
        // ha saltado un UNIQUE): el usuario o el email ya existen.
        // -------------------------------------------------------------
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ese nombre de usuario o correo ya está registrado' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al registrar el usuario' });
    }
});


// =====================================================================
// POST /api/auth/login
// Cuerpo esperado: { nombre_usuario, contrasena }
// Devuelve: { token, usuario: { id, nombre, rol } }
// =====================================================================
router.post('/login', async function (req, res) {
    const nombreUsuario = (req.body.nombre_usuario || '').trim();
    const contrasena = req.body.contrasena || '';

    if (nombreUsuario === '' || contrasena === '') {
        return res.status(400).json({ error: 'Escribe usuario y contraseña' });
    }

    try {
        // -------------------------------------------------------------
        // Buscamos al usuario por su nombre. Si no hay ninguna fila, el
        // usuario no existe. Damos el mismo mensaje que si la contraseña
        // es incorrecta para no dar pistas a un atacante.
        // -------------------------------------------------------------
        const resultado = await pool.query('SELECT * FROM usuarios WHERE nombre_usuario = $1', [nombreUsuario]);

        if (resultado.rows.length === 0) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }

        const usuario = resultado.rows[0];

        // -------------------------------------------------------------
        // bcrypt.compare cifra la contraseña escrita y la compara con el
        // hash guardado. Devuelve true o false.
        // -------------------------------------------------------------
        const correcta = await bcrypt.compare(contrasena, usuario.contrasena);

        if (!correcta) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }

        // -------------------------------------------------------------
        // Aunque la contraseña sea buena, si la cuenta no está activada o
        // no tiene rol, no puede entrar.
        // -------------------------------------------------------------
        if (!usuario.activo_usuario || !usuario.rol) {
            return res.status(403).json({ error: 'Tu cuenta todavía no ha sido activada por un administrador' });
        }

        // -------------------------------------------------------------
        // Creamos el token JWT con el id, el nombre y el ROL dentro.
        // expiresIn hace que caduque, por ejemplo a las 8 horas.
        // -------------------------------------------------------------
        const token = jwt.sign(
            { id: usuario.id_usuario, nombre: usuario.nombre_completo, rol: usuario.rol },
            process.env.JWT_SECRETO,
            { expiresIn: process.env.JWT_DURACION || '8h' }
        );

        // -------------------------------------------------------------
        // Devolvemos el token y algunos datos para mostrar en pantalla.
        // ¡Nunca devolvemos la contraseña (ni su hash)!
        // -------------------------------------------------------------
        res.json({
            token: token,
            usuario: { id: usuario.id_usuario, nombre: usuario.nombre_completo, rol: usuario.rol }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});


module.exports = router;
