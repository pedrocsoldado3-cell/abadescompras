// =====================================================================
// ARCHIVO: rutas/solicitudes.js
// Solicitudes de pedido
//   GET    /api/solicitudes              -> solicitudes de mis centros (admin: todas). ?centro=ID para filtrar
//   GET    /api/solicitudes/:id          -> una solicitud con sus líneas
//   POST   /api/solicitudes              -> crear (y opcionalmente generar pedidos)
//   PUT    /api/solicitudes/:id          -> modificar líneas (solo PENDIENTE)
//   DELETE /api/solicitudes/:id          -> eliminar (solo PENDIENTE)
//   POST   /api/solicitudes/:id/generar  -> ejecutar el motor de adjudicación
// =====================================================================

const express = require('express');
const pool = require('../bd');
const { verificarToken } = require('../middleware/auth');
const generarPedidos = require('../motor_adjudicacion');
const { idsCentrosUsuario, puedeUsarCentro, todosPedibles } = require('../acceso_centros');

const router = express.Router();
router.use(verificarToken);


// ---------------------------------------------------------------------
// validarLineas: comprueba el array de líneas que manda el frontend:
//   [ { id_articulo: 3, cantidad: 2, observaciones: 'sin gas' }, ... ]
// Devuelve un objeto { error, lineas } con las líneas ya limpias.
// Reglas: al menos una línea, cantidad > 0, observaciones de
// 255 caracteres como mucho y sin repetir artículos.
// ---------------------------------------------------------------------
function validarLineas(lista) {
    if (!Array.isArray(lista) || lista.length === 0) {
        return { error: 'Añade al menos un artículo con cantidad', lineas: [] };
    }

    const limpias = [];
    const vistos = [];

    for (const l of lista) {
        const idArticulo = parseInt(l.id_articulo);
        const cantidad = parseFloat(l.cantidad);
        const observaciones = (l.observaciones || '').trim();

        if (isNaN(idArticulo)) {
            return { error: 'Hay una línea sin artículo', lineas: [] };
        }
        if (isNaN(cantidad) || cantidad <= 0 || cantidad > 99999999) {
            return { error: 'Las cantidades deben ser números mayores que 0', lineas: [] };
        }
        if (observaciones.length > 255) {
            return { error: 'Las observaciones no pueden pasar de 255 caracteres', lineas: [] };
        }
        if (vistos.includes(idArticulo)) {
            return { error: 'Hay un artículo repetido en la solicitud', lineas: [] };
        }

        vistos.push(idArticulo);
        limpias.push({
            id_articulo: idArticulo,
            cantidad: cantidad,
            observaciones: observaciones === '' ? null : observaciones
        });
    }
    return { error: '', lineas: limpias };
}


// ---------------------------------------------------------------------
// validarFecha: la fecha de entrega llega como 'AAAA-MM-DD' (es lo que
// envía un <input type="date">). Comprobamos el formato y que no sea
// anterior a hoy. Comparar textos 'AAAA-MM-DD' funciona porque van
// ordenados de año a día.
// toISOString() devuelve '2026-10-20T19:22:00.000Z' y nos quedamos
// con los 10 primeros caracteres.
// ---------------------------------------------------------------------
function validarFecha(fecha) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) {
        return 'Indica una fecha de entrega válida';
    }
    const hoy = new Date().toISOString().substring(0, 10);
    if (fecha < hoy) {
        return 'La fecha de entrega no puede ser anterior a hoy';
    }
    return '';
}


// ---------------------------------------------------------------------
// listaNumeros: texto con los pedidos creados, ej. "3A/202600001, 3A/202600002".
// ---------------------------------------------------------------------
function listaNumeros(compras) {
    return compras.map(function (c) { return c.serie + '/' + c.numero; }).join(', ');
}


// ---------------------------------------------------------------------
// guardarLineas: inserta las líneas de una solicitud una a una.
// ---------------------------------------------------------------------
async function guardarLineas(cliente, idSolicitud, lineas) {
    for (const l of lineas) {
        await cliente.query(
            'INSERT INTO lineas_solicitud (id_solicitud, id_articulo, cantidad, observaciones) VALUES ($1, $2, $3, $4)',
            [idSolicitud, l.id_articulo, l.cantidad, l.observaciones]
        );
    }
}


// ---------------------------------------------------------------------
// puedeVer: el admin puede ver cualquier solicitud; un usuario, las de
// los centros que tiene asignados (aunque las haya hecho un compañero).
// ---------------------------------------------------------------------
async function puedeVer(usuario, solicitud, cliente) {
    return puedeUsarCentro(usuario, solicitud.id_centro, cliente);
}


// =====================================================================
// GET /api/solicitudes
// El usuario ve las de sus centros; el admin ve TODAS, con el
// nombre de quién la hizo, el centro y cuántas líneas tiene.
// =====================================================================
router.get('/', async function (req, res) {
    let sql =
        "SELECT s.id_solicitud, TO_CHAR(s.fecha_solicitud, 'DD/MM/YYYY HH24:MI') AS fecha_solicitud, s.estado, s.id_usuario, u.nombre_completo, " +
        '  s.id_centro, c.numero_serie, c.nombre_centro, ' +
        '  (SELECT COUNT(*) FROM lineas_solicitud l WHERE l.id_solicitud = s.id_solicitud) AS num_lineas ' +
        'FROM solicitud_pedido s JOIN usuarios u ON u.id_usuario = s.id_usuario ' +
        'JOIN centros c ON c.id_centro = s.id_centro WHERE TRUE ';
    const valores = [];

    try {
        const ids = await idsCentrosUsuario(req.usuario);
        if (ids !== null) {
            valores.push(ids);
            sql += 'AND s.id_centro = ANY($' + valores.length + ') ';
        }
        const filtroCentro = parseInt(req.query.centro);
        if (!isNaN(filtroCentro)) {
            valores.push(filtroCentro);
            sql += 'AND s.id_centro = $' + valores.length + ' ';
        }
        sql += 'ORDER BY s.id_solicitud DESC';

        const resultado = await pool.query(sql, valores);
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener las solicitudes' });
    }
});


// =====================================================================
// GET /api/solicitudes/:id  -> cabecera + líneas (sin precios)
// =====================================================================
router.get('/:id', async function (req, res) {
    const id = parseInt(req.params.id);
    try {
        const cabecera = await pool.query(
            "SELECT s.id_solicitud, s.id_usuario, s.id_centro, s.estado, TO_CHAR(s.fecha_solicitud, 'DD/MM/YYYY HH24:MI') AS fecha_solicitud, " +
            '       u.nombre_completo, c.numero_serie, c.nombre_centro ' +
            'FROM solicitud_pedido s JOIN usuarios u ON u.id_usuario = s.id_usuario ' +
            'JOIN centros c ON c.id_centro = s.id_centro WHERE s.id_solicitud = $1',
            [id]
        );
        if (cabecera.rows.length === 0) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }
        if (!(await puedeVer(req.usuario, cabecera.rows[0]))) {
            return res.status(403).json({ error: 'No tienes acceso al centro de esta solicitud' });
        }

        const lineas = await pool.query(
            'SELECT l.id_linea_solicitud, l.id_articulo, a.descripcion_articulo, l.cantidad, l.observaciones ' +
            'FROM lineas_solicitud l JOIN articulos a ON a.id_articulo = l.id_articulo ' +
            'WHERE l.id_solicitud = $1 ORDER BY l.id_linea_solicitud',
            [id]
        );

        // -------------------------------------------------------------
        // Juntamos cabecera y líneas en un solo objeto para el frontend.
        // -------------------------------------------------------------
        const solicitud = cabecera.rows[0];
        solicitud.lineas = lineas.rows;
        res.json(solicitud);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener la solicitud' });
    }
});


// =====================================================================
// POST /api/solicitudes
// Cuerpo: { lineas: [...], fecha_entrega: 'AAAA-MM-DD' (opcional) }
// Si viene fecha_entrega, en la MISMA transacción se crea la solicitud
// y se generan los pedidos. Si no viene, la solicitud
// queda PENDIENTE para editarla o generar los pedidos más tarde.
// =====================================================================
router.post('/', async function (req, res) {
    const idCentro = parseInt(req.body.id_centro);
    if (isNaN(idCentro)) {
        return res.status(400).json({ error: 'Elige el centro para el que pides' });
    }
    const validacion = validarLineas(req.body.lineas);
    if (validacion.error !== '') {
        return res.status(400).json({ error: validacion.error });
    }

    const fecha = req.body.fecha_entrega;
    if (fecha) {
        const errorFecha = validarFecha(fecha);
        if (errorFecha !== '') {
            return res.status(400).json({ error: errorFecha });
        }
    }

    // -----------------------------------------------------------------
    // TRANSACCIÓN: pedimos una conexión propia del pool (connect), porque
    // BEGIN, los INSERT y el COMMIT tienen que ir por la MISMA conexión.
    //   BEGIN    -> empieza
    //   COMMIT   -> guarda todo
    //   ROLLBACK -> deshace todo si hubo un error
    // finally se ejecuta siempre y devuelve la conexión al pool.
    // -----------------------------------------------------------------
    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');

        if (!(await puedeUsarCentro(req.usuario, idCentro, cliente))) {
            throw new Error('No tienes acceso a ese centro');
        }
        const ids = validacion.lineas.map(function (l) { return l.id_articulo; });
        if (!(await todosPedibles(cliente, idCentro, ids))) {
            throw new Error('Algún artículo no está disponible en el catálogo de este centro');
        }

        const nueva = await cliente.query(
            'INSERT INTO solicitud_pedido (id_usuario, id_centro) VALUES ($1, $2) RETURNING id_solicitud',
            [req.usuario.id, idCentro]
        );
        const idSolicitud = nueva.rows[0].id_solicitud;

        await guardarLineas(cliente, idSolicitud, validacion.lineas);

        let compras = [];
        if (fecha) {
            compras = await generarPedidos(cliente, idSolicitud, fecha);
        }

        await cliente.query('COMMIT');

        // -------------------------------------------------------------
        // Mensaje distinto según se hayan generado pedidos o no.
        // -------------------------------------------------------------
        const mensaje = fecha
            ? 'Solicitud nº ' + idSolicitud + ' creada. Pedidos generados: ' + listaNumeros(compras)
            : 'Solicitud nº ' + idSolicitud + ' guardada como PENDIENTE';

        res.status(201).json({ mensaje: mensaje, id: idSolicitud, compras: compras });

    } catch (error) {
        await cliente.query('ROLLBACK');
        console.error(error.message);
        res.status(400).json({ error: error.message });
    } finally {
        cliente.release();
    }
});


// =====================================================================
// PUT /api/solicitudes/:id
// Cuerpo: { lineas: [...] }  -> sustituye todas las líneas.
// Solo si está PENDIENTE. Para simplificar, borramos las líneas
// antiguas y metemos las nuevas, dentro de una transacción.
// =====================================================================
router.put('/:id', async function (req, res) {
    const id = parseInt(req.params.id);
    const validacion = validarLineas(req.body.lineas);
    if (validacion.error !== '') {
        return res.status(400).json({ error: validacion.error });
    }

    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');

        const r = await cliente.query('SELECT * FROM solicitud_pedido WHERE id_solicitud = $1', [id]);
        if (r.rows.length === 0) {
            throw new Error('Solicitud no encontrada');
        }
        if (!(await puedeVer(req.usuario, r.rows[0], cliente))) {
            throw new Error('No tienes acceso al centro de esta solicitud');
        }
        if (r.rows[0].estado !== 'PENDIENTE') {
            throw new Error('Solo se pueden modificar solicitudes PENDIENTES');
        }

        const ids = validacion.lineas.map(function (l) { return l.id_articulo; });
        if (!(await todosPedibles(cliente, r.rows[0].id_centro, ids))) {
            throw new Error('Algún artículo no está disponible en el catálogo de este centro');
        }

        await cliente.query('DELETE FROM lineas_solicitud WHERE id_solicitud = $1', [id]);
        await guardarLineas(cliente, id, validacion.lineas);

        await cliente.query('COMMIT');
        res.json({ mensaje: 'Solicitud nº ' + id + ' modificada' });

    } catch (error) {
        await cliente.query('ROLLBACK');
        res.status(400).json({ error: error.message });
    } finally {
        cliente.release();
    }
});


// =====================================================================
// DELETE /api/solicitudes/:id  -> solo PENDIENTE (las líneas se borran
// solas por el ON DELETE CASCADE).
// Metemos la condición del estado y del centro en el propio DELETE.
// =====================================================================
router.delete('/:id', async function (req, res) {
    const id = parseInt(req.params.id);
    try {
        let sql = "DELETE FROM solicitud_pedido WHERE id_solicitud = $1 AND estado = 'PENDIENTE'";
        const valores = [id];

        const ids = await idsCentrosUsuario(req.usuario);
        if (ids !== null) {
            sql += ' AND id_centro = ANY($2)';
            valores.push(ids);
        }

        const resultado = await pool.query(sql, valores);
        if (resultado.rowCount === 0) {
            return res.status(400).json({ error: 'No se puede eliminar: no existe, no es de tus centros o ya está procesada' });
        }
        res.json({ mensaje: 'Solicitud nº ' + id + ' eliminada' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar la solicitud' });
    }
});


// =====================================================================
// POST /api/solicitudes/:id/generar
// Cuerpo: { fecha_entrega: 'AAAA-MM-DD' }
// Ejecuta el motor de adjudicación sobre una solicitud PENDIENTE.
// =====================================================================
router.post('/:id/generar', async function (req, res) {
    const id = parseInt(req.params.id);
    const fecha = req.body.fecha_entrega;

    const errorFecha = validarFecha(fecha);
    if (errorFecha !== '') {
        return res.status(400).json({ error: errorFecha });
    }

    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');

        // -------------------------------------------------------------
        // Comprobamos permisos antes de llamar al motor.
        // -------------------------------------------------------------
        const r = await cliente.query('SELECT * FROM solicitud_pedido WHERE id_solicitud = $1', [id]);
        if (r.rows.length === 0) {
            throw new Error('Solicitud no encontrada');
        }
        if (!(await puedeVer(req.usuario, r.rows[0], cliente))) {
            throw new Error('No tienes acceso al centro de esta solicitud');
        }

        const compras = await generarPedidos(cliente, id, fecha);

        await cliente.query('COMMIT');
        res.json({ mensaje: 'Pedidos generados: ' + listaNumeros(compras), compras: compras });

    } catch (error) {
        await cliente.query('ROLLBACK');
        res.status(400).json({ error: error.message });
    } finally {
        cliente.release();
    }
});


module.exports = router;
