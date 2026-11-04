// =====================================================================
// ARCHIVO: rutas/tarifas.js
// Mantenimiento de articulos_tarificados.
// Una "tarifa" es un artículo del catálogo tal y como lo vende un
// proveedor concreto, con su precio y su descuento.
// Solo para administradores.
//   GET    /api/tarifas              -> listar (con nombre de artículo y proveedor)
//   POST   /api/tarifas              -> crear
//   PUT    /api/tarifas/:id          -> modificar
//   PUT    /api/tarifas/:id/activo   -> activar / desactivar
//   DELETE /api/tarifas/:id          -> borrar (solo sin pedidos)
// =====================================================================

const express = require('express');
const pool = require('../bd');
const { verificarToken, soloAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken, soloAdmin);


// ---------------------------------------------------------------------
// leerTarifa: recoge y convierte los datos del formulario.
// Si el descuento viene vacío, ponemos 0 (igual que el DEFAULT de la BD).
// ---------------------------------------------------------------------
function leerTarifa(body) {
    const descripcion = (body.descripcion_proveedor || '').trim();
    return {
        id_articulo: parseInt(body.id_articulo),
        id_proveedor: parseInt(body.id_proveedor),
        descripcion_proveedor: descripcion === '' ? null : descripcion,
        referencia_proveedor: (body.referencia_proveedor || '').trim(),
        precio: parseFloat(body.precio),
        descuento: body.descuento === '' || body.descuento === undefined ? 0 : parseFloat(body.descuento)
    };
}


// ---------------------------------------------------------------------
// validarTarifa: precio >= 0 y descuento entre 0 y 100.
// ---------------------------------------------------------------------
function validarTarifa(t) {
    if (isNaN(t.id_articulo)) {
        return 'Elige un artículo';
    }
    if (isNaN(t.id_proveedor)) {
        return 'Elige un proveedor';
    }
    if (t.referencia_proveedor === '' || t.referencia_proveedor.length > 50) {
        return 'La referencia del proveedor es obligatoria (máx. 50 caracteres)';
    }
    if (t.descripcion_proveedor !== null && t.descripcion_proveedor.length > 150) {
        return 'La descripción del proveedor es demasiado larga (máx. 150)';
    }
    if (isNaN(t.precio) || t.precio < 0 || t.precio > 999999) {
        return 'El precio debe ser un número mayor o igual que 0';
    }
    if (isNaN(t.descuento) || t.descuento < 0 || t.descuento > 100) {
        return 'El descuento debe estar entre 0 y 100';
    }
    return '';
}


// ---------------------------------------------------------------------
// mensajeDuplicado: traduce el error 23505 a un texto entendible.
// error.constraint trae el nombre de la restricción UNIQUE que ha
// fallado; si contiene "referencia" es la de proveedor+referencia.
// ---------------------------------------------------------------------
function mensajeDuplicado(error) {
    if (error.constraint && error.constraint.includes('referencia')) {
        return 'Ese proveedor ya usa esa referencia en otro artículo';
    }
    return 'Ese artículo ya tiene una tarifa con ese proveedor';
}


// =====================================================================
// GET /api/tarifas
// Unimos (JOIN) con articulos y proveedores para mostrar nombres en vez
// de solo números. También calculamos el precio neto en la consulta:
//   neto = precio - precio * descuento / 100
// =====================================================================
router.get('/', async function (req, res) {
    try {
        const resultado = await pool.query(
            'SELECT t.*, a.descripcion_articulo, p.nombre_proveedor, ' +
            '       ROUND(t.precio - t.precio * t.descuento / 100, 4) AS precio_neto ' +
            'FROM articulos_tarificados t ' +
            'JOIN articulos a ON a.id_articulo = t.id_articulo ' +
            'JOIN proveedores p ON p.id_proveedor = t.id_proveedor ' +
            'ORDER BY a.descripcion_articulo, precio_neto'
        );
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener las tarifas' });
    }
});


// =====================================================================
// POST /api/tarifas
// =====================================================================
router.post('/', async function (req, res) {
    const t = leerTarifa(req.body);
    const error = validarTarifa(t);
    if (error !== '') {
        return res.status(400).json({ error: error });
    }

    try {
        const resultado = await pool.query(
            'INSERT INTO articulos_tarificados (id_articulo, id_proveedor, descripcion_proveedor, referencia_proveedor, precio, descuento) ' +
            'VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_articulo_tarificado',
            [t.id_articulo, t.id_proveedor, t.descripcion_proveedor, t.referencia_proveedor, t.precio, t.descuento]
        );
        res.status(201).json({ mensaje: 'Tarifa creada', id: resultado.rows[0].id_articulo_tarificado });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: mensajeDuplicado(error) });
        }
        if (error.code === '23503') {
            return res.status(400).json({ error: 'El artículo o el proveedor no existen' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al crear la tarifa' });
    }
});


// =====================================================================
// PUT /api/tarifas/:id
// Cambiar el precio aquí NO cambia los pedidos ya hechos, porque cada
// línea de compra guardó su propio precio_coste.
// =====================================================================
router.put('/:id', async function (req, res) {
    const id = parseInt(req.params.id);
    const t = leerTarifa(req.body);
    const error = validarTarifa(t);
    if (error !== '') {
        return res.status(400).json({ error: error });
    }

    try {
        const resultado = await pool.query(
            'UPDATE articulos_tarificados SET id_articulo = $1, id_proveedor = $2, descripcion_proveedor = $3, ' +
            'referencia_proveedor = $4, precio = $5, descuento = $6 WHERE id_articulo_tarificado = $7',
            [t.id_articulo, t.id_proveedor, t.descripcion_proveedor, t.referencia_proveedor, t.precio, t.descuento, id]
        );
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Tarifa no encontrada' });
        }
        res.json({ mensaje: 'Tarifa modificada' });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: mensajeDuplicado(error) });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al modificar la tarifa' });
    }
});


// =====================================================================
// PUT /api/tarifas/:id/activo  -> invierte el estado
// =====================================================================
router.put('/:id/activo', async function (req, res) {
    const id = parseInt(req.params.id);
    try {
        const resultado = await pool.query(
            'UPDATE articulos_tarificados SET activo_articulo_tarificado = NOT activo_articulo_tarificado WHERE id_articulo_tarificado = $1', [id]
        );
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Tarifa no encontrada' });
        }
        res.json({ mensaje: 'Estado de la tarifa cambiado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cambiar el estado' });
    }
});


// =====================================================================
// DELETE /api/tarifas/:id  -> solo si no está en ninguna línea de compra
// =====================================================================
router.delete('/:id', async function (req, res) {
    const id = parseInt(req.params.id);
    try {
        const resultado = await pool.query('DELETE FROM articulos_tarificados WHERE id_articulo_tarificado = $1', [id]);
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Tarifa no encontrada' });
        }
        res.json({ mensaje: 'Tarifa borrada' });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ error: 'No se puede borrar: ya se ha usado en pedidos. Desactívala en su lugar.' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al borrar la tarifa' });
    }
});


module.exports = router;
