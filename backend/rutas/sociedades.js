// =====================================================================
// ARCHIVO: rutas/sociedades.js
// Mantenimiento de sociedades (razones sociales). Solo ADMIN.
//   GET    /api/sociedades             -> lista (con nº de centros)
//   POST   /api/sociedades             -> alta
//   PUT    /api/sociedades/:id         -> modificación
//   PUT    /api/sociedades/:id/activo  -> activar / desactivar
//   DELETE /api/sociedades/:id         -> borrado (si no tiene centros)
// =====================================================================

const express = require('express');
const pool = require('../bd');
const { verificarToken, soloAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken, soloAdmin);


function limpiarSociedad(body) {
    return {
        razon_social: (body.razon_social || '').trim(),
        cif: (body.cif || '').trim().toUpperCase(),
        dir_fiscal: (body.dir_fiscal || '').trim(),
        cp_fiscal: (body.cp_fiscal || '').trim(),
        localidad_fiscal: (body.localidad_fiscal || '').trim(),
        provincia_fiscal: (body.provincia_fiscal || '').trim()
    };
}


function validarSociedad(s) {
    if (s.razon_social === '' || s.razon_social.length > 150) {
        return 'La razón social es obligatoria (máx. 150 caracteres)';
    }
    if (!/^[A-Z0-9][0-9]{7}[A-Z0-9]$/.test(s.cif)) {
        return 'El CIF debe tener 9 caracteres (ej: B14000001)';
    }
    if (s.dir_fiscal === '' || s.dir_fiscal.length > 150) {
        return 'La dirección fiscal es obligatoria (máx. 150 caracteres)';
    }
    if (!/^[0-9]{5}$/.test(s.cp_fiscal)) {
        return 'El código postal fiscal debe tener 5 números';
    }
    if (s.localidad_fiscal === '' || s.localidad_fiscal.length > 80) {
        return 'La localidad fiscal es obligatoria (máx. 80 caracteres)';
    }
    if (s.provincia_fiscal === '' || s.provincia_fiscal.length > 50) {
        return 'La provincia fiscal es obligatoria (máx. 50 caracteres)';
    }
    return '';
}


router.get('/', async function (req, res) {
    try {
        const resultado = await pool.query(
            'SELECT s.*, (SELECT COUNT(*) FROM centros c WHERE c.id_sociedad = s.id_sociedad) AS num_centros ' +
            'FROM sociedades s ORDER BY s.razon_social'
        );
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener las sociedades' });
    }
});


router.post('/', async function (req, res) {
    const s = limpiarSociedad(req.body);
    const error = validarSociedad(s);
    if (error !== '') {
        return res.status(400).json({ error: error });
    }
    try {
        const resultado = await pool.query(
            'INSERT INTO sociedades (razon_social, cif, dir_fiscal, cp_fiscal, localidad_fiscal, provincia_fiscal) ' +
            'VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_sociedad',
            [s.razon_social, s.cif, s.dir_fiscal, s.cp_fiscal, s.localidad_fiscal, s.provincia_fiscal]
        );
        res.status(201).json({ mensaje: 'Sociedad creada', id: resultado.rows[0].id_sociedad });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ya existe una sociedad con ese CIF' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al crear la sociedad' });
    }
});


router.put('/:id', async function (req, res) {
    const id = parseInt(req.params.id);
    const s = limpiarSociedad(req.body);
    const error = validarSociedad(s);
    if (error !== '') {
        return res.status(400).json({ error: error });
    }
    try {
        const resultado = await pool.query(
            'UPDATE sociedades SET razon_social = $1, cif = $2, dir_fiscal = $3, cp_fiscal = $4, ' +
            'localidad_fiscal = $5, provincia_fiscal = $6 WHERE id_sociedad = $7',
            [s.razon_social, s.cif, s.dir_fiscal, s.cp_fiscal, s.localidad_fiscal, s.provincia_fiscal, id]
        );
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Sociedad no encontrada' });
        }
        res.json({ mensaje: 'Sociedad modificada' });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ya existe otra sociedad con ese CIF' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al modificar la sociedad' });
    }
});


router.put('/:id/activo', async function (req, res) {
    const id = parseInt(req.params.id);
    try {
        const resultado = await pool.query(
            'UPDATE sociedades SET activo_sociedad = NOT activo_sociedad WHERE id_sociedad = $1', [id]
        );
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Sociedad no encontrada' });
        }
        res.json({ mensaje: 'Estado de la sociedad cambiado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cambiar el estado' });
    }
});


router.delete('/:id', async function (req, res) {
    const id = parseInt(req.params.id);
    try {
        const resultado = await pool.query('DELETE FROM sociedades WHERE id_sociedad = $1', [id]);
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Sociedad no encontrada' });
        }
        res.json({ mensaje: 'Sociedad borrada' });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ error: 'No se puede borrar: tiene centros. Desactívala en su lugar.' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al borrar la sociedad' });
    }
});


module.exports = router;
