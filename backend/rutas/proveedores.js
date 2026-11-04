// =====================================================================
// ARCHIVO: rutas/proveedores.js
// Mantenimiento de la tabla proveedores.
// Solo para administradores.
//   GET    /api/proveedores              -> listar
//   POST   /api/proveedores              -> crear
//   PUT    /api/proveedores/:id          -> modificar
//   PUT    /api/proveedores/:id/activo   -> activar / desactivar
//   DELETE /api/proveedores/:id          -> borrar (solo sin historial)
// =====================================================================

const express = require('express');
const pool = require('../bd');
const { verificarToken, soloAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken, soloAdmin);

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


// ---------------------------------------------------------------------
// limpiarProveedor: recoge del cuerpo de la petición solo los campos
// que nos interesan y les quita los espacios. Los campos opcionales
// vacíos se guardan como null (en vez de texto vacío '').
// ---------------------------------------------------------------------
function textoOpcional(valor) {
    const texto = (valor || '').trim();
    return texto === '' ? null : texto;
}

function limpiarProveedor(body) {
    const codigo = String(body.codigo_erp === undefined || body.codigo_erp === null ? '' : body.codigo_erp).trim();
    return {
        codigo_erp: /^[0-9]+$/.test(codigo) ? parseInt(codigo) : NaN,
        nombre_proveedor: (body.nombre_proveedor || '').trim(),
        razon_social: (body.razon_social || '').trim(),
        cif: (body.cif || '').trim().toUpperCase(),
        direccion: textoOpcional(body.direccion),
        cod_postal: textoOpcional(body.cod_postal),
        provincia: textoOpcional(body.provincia),
        localidad: textoOpcional(body.localidad),
        telefono: textoOpcional(body.telefono),
        email_proveedor: (body.email_proveedor || '').trim().toLowerCase()
    };
}


// ---------------------------------------------------------------------
// validarProveedor: devuelve un texto con el error o '' si todo está bien.
// Comprueba obligatorios, longitudes máximas (las de la tabla) y formatos.
// El CIF español: una letra o número + 7 números + letra o número (9).
// El código postal: 5 números. El teléfono: 9 números (con + opcional).
// ---------------------------------------------------------------------
function validarProveedor(p) {
    if (!Number.isInteger(p.codigo_erp) || p.codigo_erp <= 0 || p.codigo_erp > 2147483647) {
        return 'El código ERP es obligatorio y debe ser un número entero positivo';
    }
    if (p.nombre_proveedor === '' || p.nombre_proveedor.length > 100) {
        return 'El nombre comercial es obligatorio (máx. 100 caracteres)';
    }
    if (p.razon_social === '' || p.razon_social.length > 150) {
        return 'La razón social es obligatoria (máx. 150 caracteres)';
    }
    if (!/^[A-Z0-9][0-9]{7}[A-Z0-9]$/.test(p.cif)) {
        return 'El CIF debe tener 9 caracteres (ej: B14000001)';
    }
    if (p.cod_postal !== null && !/^[0-9]{5}$/.test(p.cod_postal)) {
        return 'El código postal debe tener 5 números';
    }
    if (p.telefono !== null && !/^\+?[0-9]{9,15}$/.test(p.telefono)) {
        return 'El teléfono solo puede tener números (mínimo 9)';
    }
    if (!REGEX_EMAIL.test(p.email_proveedor) || p.email_proveedor.length > 120) {
        return 'El correo del proveedor no es válido';
    }
    if ((p.direccion && p.direccion.length > 150) || (p.provincia && p.provincia.length > 50) || (p.localidad && p.localidad.length > 80)) {
        return 'Dirección, provincia o localidad demasiado largas';
    }
    return '';
}


// =====================================================================
// GET /api/proveedores  -> todos, ordenados por nombre
// =====================================================================
router.get('/', async function (req, res) {
    try {
        const resultado = await pool.query('SELECT * FROM proveedores ORDER BY nombre_proveedor');
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los proveedores' });
    }
});


// =====================================================================
// POST /api/proveedores  -> crea un proveedor nuevo (activo por defecto)
// =====================================================================
router.post('/', async function (req, res) {
    const p = limpiarProveedor(req.body);
    const error = validarProveedor(p);
    if (error !== '') {
        return res.status(400).json({ error: error });
    }

    // -----------------------------------------------------------------
    // INSERT con 9 parámetros. RETURNING id_proveedor nos devuelve el id
    // que PostgreSQL le ha dado al nuevo proveedor.
    // -----------------------------------------------------------------
    try {
        const resultado = await pool.query(
            'INSERT INTO proveedores (nombre_proveedor, razon_social, cif, direccion, cod_postal, provincia, localidad, telefono, email_proveedor, codigo_erp) ' +
            'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id_proveedor',
            [p.nombre_proveedor, p.razon_social, p.cif, p.direccion, p.cod_postal, p.provincia, p.localidad, p.telefono, p.email_proveedor, p.codigo_erp]
        );
        res.status(201).json({ mensaje: 'Proveedor creado', id: resultado.rows[0].id_proveedor });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: error.constraint === 'proveedores_codigo_erp_key' ? 'Ya existe un proveedor con ese código ERP' : 'Ya existe un proveedor con ese CIF' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al crear el proveedor' });
    }
});


// =====================================================================
// PUT /api/proveedores/:id  -> modifica todos los datos del proveedor
// =====================================================================
router.put('/:id', async function (req, res) {
    const id = parseInt(req.params.id);
    const p = limpiarProveedor(req.body);
    const error = validarProveedor(p);
    if (error !== '') {
        return res.status(400).json({ error: error });
    }

    try {
        const resultado = await pool.query(
            'UPDATE proveedores SET nombre_proveedor = $1, razon_social = $2, cif = $3, direccion = $4, cod_postal = $5, ' +
            'provincia = $6, localidad = $7, telefono = $8, email_proveedor = $9, codigo_erp = $10 WHERE id_proveedor = $11',
            [p.nombre_proveedor, p.razon_social, p.cif, p.direccion, p.cod_postal, p.provincia, p.localidad, p.telefono, p.email_proveedor, p.codigo_erp, id]
        );
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }
        res.json({ mensaje: 'Proveedor modificado' });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: error.constraint === 'proveedores_codigo_erp_key' ? 'Ya existe otro proveedor con ese código ERP' : 'Ya existe otro proveedor con ese CIF' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al modificar el proveedor' });
    }
});


// =====================================================================
// PUT /api/proveedores/:id/activo  -> cambia activo a TRUE o FALSE
// "NOT activo_proveedor" invierte el valor que tenga: si estaba activo
// se desactiva y al revés (baja lógica).
// =====================================================================
router.put('/:id/activo', async function (req, res) {
    const id = parseInt(req.params.id);
    try {
        const resultado = await pool.query(
            'UPDATE proveedores SET activo_proveedor = NOT activo_proveedor WHERE id_proveedor = $1', [id]
        );
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }
        res.json({ mensaje: 'Estado del proveedor cambiado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cambiar el estado' });
    }
});


// =====================================================================
// DELETE /api/proveedores/:id
// Solo se puede borrar si no tiene tarifas ni pedidos (historial).
// Si los tiene, la clave foránea lo impide (error 23503) y avisamos
// de que lo desactive en su lugar.
// =====================================================================
router.delete('/:id', async function (req, res) {
    const id = parseInt(req.params.id);
    try {
        const resultado = await pool.query('DELETE FROM proveedores WHERE id_proveedor = $1', [id]);
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }
        res.json({ mensaje: 'Proveedor borrado' });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ error: 'No se puede borrar: tiene artículos tarificados o pedidos. Desactívalo en su lugar.' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al borrar el proveedor' });
    }
});


module.exports = router;
