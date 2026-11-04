// =====================================================================
// ARCHIVO: rutas/configuracion.js
// Ajustes generales. Solo ADMIN.
//   GET /api/configuracion   -> { observaciones_pedidos: '...' }
//   PUT /api/configuracion   -> guarda los ajustes enviados
// =====================================================================

const express = require('express');
const pool = require('../bd');
const { verificarToken, soloAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken, soloAdmin);

// Claves permitidas y su longitud máxima.
const CLAVES = { observaciones_pedidos: 2000 };


router.get('/', async function (req, res) {
    try {
        const r = await pool.query('SELECT clave, valor FROM configuracion');
        const datos = {};
        for (const clave of Object.keys(CLAVES)) {
            datos[clave] = '';
        }
        for (const fila of r.rows) {
            datos[fila.clave] = fila.valor;
        }
        res.json(datos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al leer la configuración' });
    }
});


router.put('/', async function (req, res) {
    try {
        for (const clave of Object.keys(CLAVES)) {
            if (req.body[clave] === undefined) {
                continue;
            }
            const valor = String(req.body[clave]).trim();
            if (valor.length > CLAVES[clave]) {
                return res.status(400).json({ error: 'El texto no puede pasar de ' + CLAVES[clave] + ' caracteres' });
            }
            await pool.query(
                'INSERT INTO configuracion (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor',
                [clave, valor]
            );
        }
        res.json({ mensaje: 'Configuración guardada' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al guardar la configuración' });
    }
});


module.exports = router;
