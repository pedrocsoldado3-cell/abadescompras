// =====================================================================
// ARCHIVO: rutas/articulos.js
// Mantenimiento del catálogo maestro de artículos.
// Solo para administradores.
//   GET    /api/articulos              -> listar
//   POST   /api/articulos              -> crear
//   PUT    /api/articulos/:id          -> modificar
//   PUT    /api/articulos/:id/activo   -> activar / desactivar
//   DELETE /api/articulos/:id          -> borrar (solo sin historial)
// =====================================================================

const express = require('express');
const pool = require('../bd');
const { verificarToken, soloAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken, soloAdmin);


// ---------------------------------------------------------------------
// leerArticulo: coge los datos del cuerpo y los deja limpios.
//   - ean: opcional, si está vacío se guarda null
//   - iva: se convierte a número con parseFloat
// ---------------------------------------------------------------------
function leerArticulo(body) {
    const ean = (body.ean || '').trim();
    const codigo = String(body.codigo_erp === undefined || body.codigo_erp === null ? '' : body.codigo_erp).trim();
    return {
        codigo_erp: /^[0-9]+$/.test(codigo) ? parseInt(codigo) : NaN,
        ean: ean === '' ? null : ean,
        descripcion_articulo: (body.descripcion_articulo || '').trim(),
        iva: parseFloat(body.iva)
    };
}


// ---------------------------------------------------------------------
// validarArticulo: '' si está bien o el texto del error.
// isNaN(x) es true cuando x NO es un número (por ejemplo si escribieron
// letras). El EAN, si se pone, tiene que tener de 8 a 14 números.
// ---------------------------------------------------------------------
function validarArticulo(a) {
    if (!Number.isInteger(a.codigo_erp) || a.codigo_erp <= 0 || a.codigo_erp > 2147483647) {
        return 'El código ERP es obligatorio y debe ser un número entero positivo';
    }
    if (a.descripcion_articulo === '' || a.descripcion_articulo.length > 150) {
        return 'La descripción es obligatoria (máx. 150 caracteres)';
    }
    if (isNaN(a.iva) || a.iva < 0 || a.iva >= 100) {
        return 'El IVA debe ser un número entre 0 y 99,99';
    }
    if (a.ean !== null && !/^[0-9]{8,14}$/.test(a.ean)) {
        return 'El EAN debe tener entre 8 y 14 números';
    }
    return '';
}


// =====================================================================
// GET /api/articulos
// Además de los datos del artículo, contamos cuántas tarifas activas
// tiene, para que el admin vea si aparecerá en el catálogo del usuario.
// La subconsulta (SELECT COUNT(*) ...) se ejecuta para cada artículo.
// =====================================================================
router.get('/', async function (req, res) {
    try {
        const resultado = await pool.query(
            'SELECT a.*, ' +
            '  (SELECT COUNT(*) FROM articulos_tarificados t ' +
            '   WHERE t.id_articulo = a.id_articulo AND t.activo_articulo_tarificado = TRUE) AS num_tarifas ' +
            'FROM articulos a ORDER BY a.descripcion_articulo'
        );
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los artículos' });
    }
});


// =====================================================================
// POST /api/articulos
// =====================================================================
router.post('/', async function (req, res) {
    const a = leerArticulo(req.body);
    const error = validarArticulo(a);
    if (error !== '') {
        return res.status(400).json({ error: error });
    }

    try {
        const resultado = await pool.query(
            'INSERT INTO articulos (codigo_erp, ean, descripcion_articulo, iva) VALUES ($1, $2, $3, $4) RETURNING id_articulo',
            [a.codigo_erp, a.ean, a.descripcion_articulo, a.iva]
        );
        res.status(201).json({ mensaje: 'Artículo creado', id: resultado.rows[0].id_articulo });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: error.constraint === 'articulos_codigo_erp_key' ? 'Ya existe un artículo con ese código ERP' : 'Ya existe un artículo con ese EAN' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al crear el artículo' });
    }
});


// =====================================================================
// PUT /api/articulos/:id
// =====================================================================
router.put('/:id', async function (req, res) {
    const id = parseInt(req.params.id);
    const a = leerArticulo(req.body);
    const error = validarArticulo(a);
    if (error !== '') {
        return res.status(400).json({ error: error });
    }

    try {
        const resultado = await pool.query(
            'UPDATE articulos SET codigo_erp = $1, ean = $2, descripcion_articulo = $3, iva = $4 WHERE id_articulo = $5',
            [a.codigo_erp, a.ean, a.descripcion_articulo, a.iva, id]
        );
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Artículo no encontrado' });
        }
        res.json({ mensaje: 'Artículo modificado' });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: error.constraint === 'articulos_codigo_erp_key' ? 'Ya existe otro artículo con ese código ERP' : 'Ya existe otro artículo con ese EAN' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al modificar el artículo' });
    }
});


// =====================================================================
// PUT /api/articulos/:id/activo  -> invierte el estado (baja lógica)
// =====================================================================
router.put('/:id/activo', async function (req, res) {
    const id = parseInt(req.params.id);
    try {
        const resultado = await pool.query(
            'UPDATE articulos SET activo_articulo = NOT activo_articulo WHERE id_articulo = $1', [id]
        );
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Artículo no encontrado' });
        }
        res.json({ mensaje: 'Estado del artículo cambiado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cambiar el estado' });
    }
});


// =====================================================================
// DELETE /api/articulos/:id
// Si el artículo tiene tarifas o aparece en solicitudes, la base de
// datos no deja borrarlo (23503) y pedimos desactivarlo.
// =====================================================================
router.delete('/:id', async function (req, res) {
    const id = parseInt(req.params.id);
    try {
        const resultado = await pool.query('DELETE FROM articulos WHERE id_articulo = $1', [id]);
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Artículo no encontrado' });
        }
        res.json({ mensaje: 'Artículo borrado' });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ error: 'No se puede borrar: tiene tarifas o está en solicitudes. Desactívalo en su lugar.' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al borrar el artículo' });
    }
});


module.exports = router;
