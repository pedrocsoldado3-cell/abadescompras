// =====================================================================
// ARCHIVO: rutas/compras.js
// Pedidos a proveedores ya generados.
//   GET /api/compras                 -> lista de pedidos de mis centros (admin: todos)
//   GET /api/compras/:id             -> un pedido con sus líneas
//   POST /api/compras/:id/enviar     -> PDF + XML + correo y pasa a TRAMITADO
//   POST /api/compras/:id/reenviar   -> (ADMIN) reenvía el correo con el mismo número
//   GET  /api/compras/:id/pdf        -> descarga el último PDF enviado
// Los usuarios normales NUNCA reciben precios. El admin sí.
// =====================================================================

const express = require('express');
const pool = require('../bd');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { leerPedidoCompleto, generarPdf, generarXml, numeroPedido } = require('../documentos');
const { comprobarSmtp, enviarPedido } = require('../correo');
const { idsCentrosUsuario, puedeUsarCentro } = require('../acceso_centros');

const router = express.Router();
router.use(verificarToken);


// =====================================================================
// GET /api/compras   (opcional: ?estado=PENDIENTE|TRAMITADO y ?centro=ID)
// Montamos el SQL por partes. El importe total solo se añade si quien
// pregunta es ADMIN, así al usuario no le llega ningún precio.
// SUM(cantidad * precio_coste) suma el importe de todas las líneas.
// =====================================================================
router.get('/', async function (req, res) {
    let sql =
        "SELECT c.id_compra, c.serie_pedido, c.numero_pedido, c.id_centro, ce.nombre_centro, c.estado, " +
        "  TO_CHAR(c.fecha_entrega, 'DD/MM/YYYY') AS fecha_entrega, p.nombre_proveedor, " +
        '  (SELECT COUNT(*) FROM lineas_compra l WHERE l.id_compra = c.id_compra) AS num_lineas ';

    if (req.usuario.rol === 'ADMIN') {
        sql += ', (SELECT ROUND(SUM(l.cantidad_compra * l.precio_coste), 2) FROM lineas_compra l WHERE l.id_compra = c.id_compra) AS importe ';
    }

    sql += ", TO_CHAR(c.fecha_envio, 'DD/MM/YYYY HH24:MI') AS fecha_envio ";
    sql += 'FROM compra c JOIN proveedores p ON p.id_proveedor = c.id_proveedor ' +
        'JOIN centros ce ON ce.id_centro = c.id_centro WHERE TRUE ';

    // -----------------------------------------------------------------
    // Filtro por estado. Solo aceptamos los dos valores válidos; si llega
    // otra cosa, lo ignoramos y se devuelven todos.
    // -----------------------------------------------------------------
    const valores = [];
    const estado = req.query.estado;
    if (estado === 'PENDIENTE' || estado === 'TRAMITADO') {
        valores.push(estado);
        sql += 'AND c.estado = $' + valores.length + ' ';
    }
    const filtroCentro = parseInt(req.query.centro);
    if (!isNaN(filtroCentro)) {
        valores.push(filtroCentro);
        sql += 'AND c.id_centro = $' + valores.length + ' ';
    }

    try {
        const ids = await idsCentrosUsuario(req.usuario);
        if (ids !== null) {
            valores.push(ids);
            sql += 'AND c.id_centro = ANY($' + valores.length + ') ';
        }
        sql += 'ORDER BY c.id_compra DESC';

        const resultado = await pool.query(sql, valores);
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los pedidos' });
    }
});


// ---------------------------------------------------------------------
// NOTA sobre fechas: en los SELECT usamos TO_CHAR(fecha, 'DD/MM/YYYY')
// para que PostgreSQL nos dé la fecha ya escrita en formato español.
// Así evitamos líos de zonas horarias al pasarla a JavaScript.
// ---------------------------------------------------------------------
// leerCompra: función auxiliar que devuelve la cabecera del pedido con
// los datos del proveedor y sus líneas (para la ruta de detalle).
// Devuelve null si el pedido no existe.
// ---------------------------------------------------------------------
async function leerCompra(id) {
    const cabecera = await pool.query(
        "SELECT c.id_compra, c.id_proveedor, c.id_centro, c.serie_pedido, c.numero_pedido, c.estado, " +
        "       TO_CHAR(c.fecha_entrega, 'DD/MM/YYYY') AS fecha_entrega, " +
        '       p.nombre_proveedor, p.razon_social, p.cif, p.email_proveedor, ' +
        '       ce.nombre_centro, ce.numero_almacen, ce.telefono_1, ce.telefono_2, ce.responsable, ce.email_envio, ' +
        '       ce.dir_entrega, ce.cp_entrega, ce.localidad_entrega, ce.provincia_entrega, ce.observaciones_entrega, ' +
        '       so.razon_social AS sociedad_razon_social, so.cif AS sociedad_cif, so.dir_fiscal, so.cp_fiscal, ' +
        '       so.localidad_fiscal, so.provincia_fiscal ' +
        'FROM compra c JOIN proveedores p ON p.id_proveedor = c.id_proveedor ' +
        'JOIN centros ce ON ce.id_centro = c.id_centro ' +
        'JOIN sociedades so ON so.id_sociedad = ce.id_sociedad ' +
        'WHERE c.id_compra = $1',
        [id]
    );
    if (cabecera.rows.length === 0) {
        return null;
    }

    const lineas = await pool.query(
        'SELECT l.id_linea_compra, l.cantidad_compra, l.precio_tarifa, l.descuento, l.precio_coste, l.observaciones_compra, ' +
        '       t.referencia_proveedor, t.descripcion_proveedor, a.descripcion_articulo ' +
        'FROM lineas_compra l ' +
        'JOIN articulos_tarificados t ON t.id_articulo_tarificado = l.id_articulo_tarificado ' +
        'JOIN articulos a ON a.id_articulo = t.id_articulo ' +
        'WHERE l.id_compra = $1 ORDER BY l.id_linea_compra',
        [id]
    );

    const compra = cabecera.rows[0];
    compra.lineas = lineas.rows;
    return compra;
}


// =====================================================================
// GET /api/compras/:id
// Si NO es admin, recorremos las líneas y les borramos el precio con
// "delete" antes de enviarlas.
// =====================================================================
router.get('/:id', async function (req, res) {
    try {
        const compra = await leerCompra(parseInt(req.params.id));
        if (compra === null) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }
        if (!(await puedeUsarCentro(req.usuario, compra.id_centro))) {
            return res.status(403).json({ error: 'No tienes acceso al centro de este pedido' });
        }

        if (req.usuario.rol !== 'ADMIN') {
            for (const linea of compra.lineas) {
                delete linea.precio_coste;
                delete linea.precio_tarifa;
                delete linea.descuento;
            }
        }
        res.json(compra);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener el pedido' });
    }
});


// =====================================================================
// POST /api/compras/:id/enviar   { con_precios: true|false }
// Genera el PDF y el XML, envía el correo desde la cuenta del centro
// y, si todo va bien, deja el pedido TRAMITADO y el XML PENDIENTE de
// exportar. Si el correo falla, no se cambia nada.
// con_precios solo se tiene en cuenta si quien envía es ADMIN.
// =====================================================================
router.post('/:id/enviar', async function (req, res) {
    await enviar(req, res, false);
});


// =====================================================================
// POST /api/compras/:id/reenviar   (solo ADMIN, pedidos TRAMITADOS)
// Vuelve a generar el PDF y a enviar el correo con el MISMO número.
// No crea un XML nuevo (así el ERP no recibe el pedido dos veces).
// =====================================================================
router.post('/:id/reenviar', soloAdmin, async function (req, res) {
    await enviar(req, res, true);
});


async function enviar(req, res, esReenvio) {
    const id = parseInt(req.params.id);
    const conPrecios = req.usuario.rol === 'ADMIN' && req.body.con_precios === true;

    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');

        // Bloqueamos la fila: si dos personas pulsan "Enviar" a la vez,
        // la segunda espera y luego ve que ya está TRAMITADO.
        const bloqueo = await cliente.query('SELECT estado, id_centro FROM compra WHERE id_compra = $1 FOR UPDATE', [id]);
        if (bloqueo.rows.length === 0) {
            await cliente.query('ROLLBACK');
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }
        if (!(await puedeUsarCentro(req.usuario, bloqueo.rows[0].id_centro, cliente))) {
            await cliente.query('ROLLBACK');
            return res.status(403).json({ error: 'No tienes acceso al centro de este pedido' });
        }
        const estado = bloqueo.rows[0].estado;
        if (!esReenvio && estado !== 'PENDIENTE') {
            await cliente.query('ROLLBACK');
            return res.status(400).json({ error: 'Este pedido ya se envió. Un administrador puede reenviarlo.' });
        }
        if (esReenvio && estado !== 'TRAMITADO') {
            await cliente.query('ROLLBACK');
            return res.status(400).json({ error: 'Solo se pueden reenviar pedidos ya enviados' });
        }

        if (!esReenvio) {
            await cliente.query('UPDATE compra SET fecha_envio = NOW() WHERE id_compra = $1', [id]);
        }
        const pedido = await leerPedidoCompleto(cliente, id);
        const faltaSmtp = comprobarSmtp(pedido);
        if (faltaSmtp !== '') {
            await cliente.query('ROLLBACK');
            return res.status(400).json({ error: faltaSmtp });
        }

        const pdf = await generarPdf(pedido, conPrecios);
        await enviarPedido(pedido, pdf, esReenvio);

        await cliente.query(
            'INSERT INTO pedido_pdf (id_compra, pdf, con_precios, fecha_generacion) VALUES ($1, $2, $3, NOW()) ' +
            'ON CONFLICT (id_compra) DO UPDATE SET pdf = EXCLUDED.pdf, con_precios = EXCLUDED.con_precios, fecha_generacion = NOW()',
            [id, pdf, conPrecios]
        );
        if (!esReenvio) {
            const xml = generarXml(pedido);
            await cliente.query(
                'INSERT INTO exportaciones_xml (id_compra, nombre_archivo, contenido) VALUES ($1, $2, $3)',
                [id, xml.nombre, xml.contenido]
            );
            await cliente.query("UPDATE compra SET estado = 'TRAMITADO' WHERE id_compra = $1", [id]);
        }

        await cliente.query('COMMIT');
        res.json({
            mensaje: 'Pedido ' + numeroPedido(pedido) + (esReenvio ? ' reenviado' : ' enviado') + ' a ' + pedido.email_proveedor +
                (esReenvio ? '' : ' y marcado como TRAMITADO')
        });
    } catch (error) {
        await cliente.query('ROLLBACK');
        console.error(error.message);
        res.status(400).json({ error: error.message });
    } finally {
        cliente.release();
    }
}


// =====================================================================
// GET /api/compras/:id/pdf  -> descarga el último PDF enviado.
// =====================================================================
router.get('/:id/pdf', async function (req, res) {
    const id = parseInt(req.params.id);
    try {
        const r = await pool.query(
            'SELECT c.id_centro, c.serie_pedido, c.numero_pedido, d.pdf FROM compra c ' +
            'LEFT JOIN pedido_pdf d ON d.id_compra = c.id_compra WHERE c.id_compra = $1',
            [id]
        );
        if (r.rows.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }
        if (!(await puedeUsarCentro(req.usuario, r.rows[0].id_centro))) {
            return res.status(403).json({ error: 'No tienes acceso al centro de este pedido' });
        }
        if (!r.rows[0].pdf) {
            return res.status(404).json({ error: 'Este pedido todavía no se ha enviado, no tiene PDF' });
        }
        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', 'attachment; filename="Pedido_' + r.rows[0].serie_pedido + '-' + r.rows[0].numero_pedido + '.pdf"');
        res.send(r.rows[0].pdf);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al descargar el PDF' });
    }
});


module.exports = router;
