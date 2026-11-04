// =====================================================================
// ARCHIVO: rutas/catalogo.js
// Catálogo de un centro para crear solicitudes.
// Lo pueden ver usuarios y administradores, pero SIN precios ni
// proveedores: solo id, EAN y descripción.
//   GET /api/catalogo?centro=ID
// =====================================================================

const express = require('express');
const pool = require('../bd');
const { verificarToken } = require('../middleware/auth');
const { puedeUsarCentro, SQL_PEDIBLE } = require('../acceso_centros');

const router = express.Router();


router.get('/', verificarToken, async function (req, res) {
    const idCentro = parseInt(req.query.centro);
    try {
        if (!(await puedeUsarCentro(req.usuario, idCentro))) {
            return res.status(403).json({ error: 'No tienes acceso a ese centro' });
        }
        const resultado = await pool.query(
            'SELECT a.id_articulo, a.ean, a.descripcion_articulo FROM articulos a ' +
            'WHERE ' + SQL_PEDIBLE + ' ORDER BY a.descripcion_articulo',
            [idCentro]
        );
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener el catálogo' });
    }
});


module.exports = router;
