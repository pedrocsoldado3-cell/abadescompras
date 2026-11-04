// =====================================================================
// ARCHIVO: rutas/usuarios.js
// Gestión de usuarios por parte del administrador.
//   GET    /api/usuarios        -> lista de usuarios
//   PUT    /api/usuarios/:id    -> activar/desactivar y asignar rol
//   DELETE /api/usuarios/:id    -> borrar (solo si no tiene solicitudes)
// =====================================================================

const express = require('express');
const pool = require('../bd');
const { verificarToken, soloAdmin } = require('../middleware/auth');

const router = express.Router();


// ---------------------------------------------------------------------
// Todas las rutas de este archivo necesitan sesión iniciada Y ser admin.
// Con router.use se aplican los dos middlewares a todas de golpe.
// ---------------------------------------------------------------------
router.use(verificarToken, soloAdmin);


// =====================================================================
// GET /api/usuarios
// Devuelve todos los usuarios SIN la contraseña. Primero salen los
// pendientes de activar (activo_usuario = FALSE) para verlos rápido.
// =====================================================================
router.get('/', async function (req, res) {
    try {
        const resultado = await pool.query(
            'SELECT u.id_usuario, u.nombre_usuario, u.nombre_completo, u.email_usuario, u.rol, u.activo_usuario, ' +
            '  COALESCE((SELECT ARRAY_AGG(uc.id_centro ORDER BY uc.id_centro) FROM usuario_centros uc ' +
            '            WHERE uc.id_usuario = u.id_usuario), \'{}\') AS centros ' +
            'FROM usuarios u ORDER BY u.activo_usuario, u.id_usuario'
        );
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los usuarios' });
    }
});


// =====================================================================
// PUT /api/usuarios/:id
// Cuerpo: { rol: 'ADMIN' | 'USUARIO', activo_usuario: true | false }
// =====================================================================
router.put('/:id', async function (req, res) {

    // -----------------------------------------------------------------
    // req.params.id es el número que va en la URL (/api/usuarios/7).
    // Llega como texto, por eso lo pasamos a número con parseInt.
    // -----------------------------------------------------------------
    const id = parseInt(req.params.id);
    const rol = req.body.rol;
    const activo = req.body.activo_usuario;

    // -----------------------------------------------------------------
    // Validamos: el rol solo puede ser ADMIN o USUARIO y "activo" tiene
    // que ser un booleano de verdad (true/false).
    // -----------------------------------------------------------------
    if (rol !== 'ADMIN' && rol !== 'USUARIO') {
        return res.status(400).json({ error: 'El rol debe ser ADMIN o USUARIO' });
    }
    if (typeof activo !== 'boolean') {
        return res.status(400).json({ error: 'Indica si la cuenta está activa o no' });
    }

    // -----------------------------------------------------------------
    // Un administrador no puede quitarse a sí mismo el rol de admin ni
    // desactivarse, porque se quedaría sin poder entrar a gestionar.
    // req.usuario.id viene del token (lo puso verificarToken).
    // -----------------------------------------------------------------
    if (id === req.usuario.id && (rol !== 'ADMIN' || activo === false)) {
        return res.status(400).json({ error: 'No puedes quitarte el rol de administrador ni desactivar tu propia cuenta' });
    }

    try {
        const resultado = await pool.query(
            'UPDATE usuarios SET rol = $1, activo_usuario = $2 WHERE id_usuario = $3',
            [rol, activo, id]
        );

        // -------------------------------------------------------------
        // rowCount dice cuántas filas se han modificado. Si es 0, ese id
        // no existe.
        // -------------------------------------------------------------
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ mensaje: 'Usuario actualizado' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar el usuario' });
    }
});


// =====================================================================
// DELETE /api/usuarios/:id
// Sirve para rechazar registros que no se van a activar.
// Si el usuario ya tiene solicitudes, PostgreSQL no deja borrarlo
// (clave foránea) y devuelve el código de error 23503.
// =====================================================================
router.delete('/:id', async function (req, res) {
    const id = parseInt(req.params.id);

    if (id === req.usuario.id) {
        return res.status(400).json({ error: 'No puedes borrar tu propia cuenta' });
    }

    try {
        const resultado = await pool.query('DELETE FROM usuarios WHERE id_usuario = $1', [id]);
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ mensaje: 'Usuario borrado' });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ error: 'No se puede borrar: el usuario tiene solicitudes. Desactívalo en su lugar.' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al borrar el usuario' });
    }
});


// =====================================================================
// PUT /api/usuarios/:id/centros   { ids: [1, 2] }
// Centros para los que puede pedir un USUARIO. Se sustituye la lista
// completa. (A los ADMIN no hace falta asignarles centros.)
// =====================================================================
router.put('/:id/centros', async function (req, res) {
    const id = parseInt(req.params.id);
    if (!Array.isArray(req.body.ids)) {
        return res.status(400).json({ error: 'Envía la lista de centros' });
    }
    const ids = [];
    for (const v of req.body.ids) {
        const n = parseInt(v);
        if (isNaN(n)) {
            return res.status(400).json({ error: 'Lista de centros no válida' });
        }
        if (!ids.includes(n)) {
            ids.push(n);
        }
    }

    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');
        const existe = await cliente.query('SELECT 1 FROM usuarios WHERE id_usuario = $1', [id]);
        if (existe.rows.length === 0) {
            await cliente.query('ROLLBACK');
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        await cliente.query('DELETE FROM usuario_centros WHERE id_usuario = $1', [id]);
        for (const idCentro of ids) {
            await cliente.query('INSERT INTO usuario_centros (id_usuario, id_centro) VALUES ($1, $2)', [id, idCentro]);
        }
        await cliente.query('COMMIT');
        res.json({ mensaje: 'Centros del usuario guardados' });
    } catch (error) {
        await cliente.query('ROLLBACK');
        if (error.code === '23503') {
            return res.status(400).json({ error: 'Alguno de los centros no existe' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al guardar los centros del usuario' });
    } finally {
        cliente.release();
    }
});


module.exports = router;
