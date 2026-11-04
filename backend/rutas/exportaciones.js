// =====================================================================
// ARCHIVO: rutas/exportaciones.js
// XML de pedidos para importar en el ERP. Solo ADMIN.
//   GET    /api/exportaciones            -> lista (?estado=PENDIENTE|EXPORTADO, ?centro=ID,
//                                           ?desde=AAAA-MM-DD, ?hasta=AAAA-MM-DD por fecha del pedido)
//   GET    /api/exportaciones/:id/xml    -> descarga un XML y lo marca EXPORTADO
//   POST   /api/exportaciones/zip        -> { ids: [...] } descarga un ZIP y los marca EXPORTADOS
//   POST   /api/exportaciones/descargar  -> { ids, plantilla: 'ERP' | id } descarga con
//                                           el XML del ERP o con una plantilla de exportación
//   DELETE /api/exportaciones/:id        -> elimina el XML (el pedido y su PDF se conservan)
//   GET/POST/PUT/DELETE /api/exportaciones/plantillas[/:id] -> plantillas de exportación
//   GET    /api/exportaciones/campos     -> columnas disponibles para las plantillas
// Descargar NO borra: se puede volver a descargar.
// =====================================================================

const express = require('express');
const { ZipArchive } = require('archiver');
const pool = require('../bd');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { leerPedidoCompleto } = require('../documentos');
const exportador = require('../exportador');

const router = express.Router();
router.use(verificarToken, soloAdmin);


router.get('/', async function (req, res) {
    let sql =
        'SELECT e.id_exportacion, e.id_compra, e.nombre_archivo, e.estado, ' +
        "       TO_CHAR(e.fecha_creacion, 'DD/MM/YYYY HH24:MI') AS fecha_creacion, " +
        "       TO_CHAR(e.fecha_exportacion, 'DD/MM/YYYY HH24:MI') AS fecha_exportacion, " +
        '       u.nombre_completo AS exportado_por, c.serie_pedido, c.numero_pedido, ' +
        "       TO_CHAR(c.fecha_creacion, 'DD/MM/YYYY') AS fecha_pedido, " +
        "       TO_CHAR(c.fecha_entrega, 'DD/MM/YYYY') AS fecha_entrega, " +
        '       ce.nombre_centro, p.nombre_proveedor ' +
        'FROM exportaciones_xml e ' +
        'JOIN compra c ON c.id_compra = e.id_compra ' +
        'JOIN centros ce ON ce.id_centro = c.id_centro ' +
        'JOIN proveedores p ON p.id_proveedor = c.id_proveedor ' +
        'LEFT JOIN usuarios u ON u.id_usuario = e.id_usuario_exportacion WHERE TRUE ';
    const valores = [];
    if (req.query.estado === 'PENDIENTE' || req.query.estado === 'EXPORTADO') {
        valores.push(req.query.estado);
        sql += 'AND e.estado = $' + valores.length + ' ';
    }
    const centro = parseInt(req.query.centro);
    if (!isNaN(centro)) {
        valores.push(centro);
        sql += 'AND c.id_centro = $' + valores.length + ' ';
    }
    // Periodo por fecha del pedido (ambos extremos incluidos).
    const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
    if (RE_FECHA.test(req.query.desde || '')) {
        valores.push(req.query.desde);
        sql += 'AND c.fecha_creacion >= $' + valores.length + '::date ';
    }
    if (RE_FECHA.test(req.query.hasta || '')) {
        valores.push(req.query.hasta);
        sql += "AND c.fecha_creacion < $" + valores.length + "::date + INTERVAL '1 day' ";
    }
    sql += 'ORDER BY c.fecha_creacion DESC, e.id_exportacion DESC';

    try {
        const r = await pool.query(sql, valores);
        res.json(r.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los XML' });
    }
});


async function marcarExportados(ids, idUsuario) {
    await pool.query(
        "UPDATE exportaciones_xml SET estado = 'EXPORTADO', fecha_exportacion = NOW(), id_usuario_exportacion = $2 " +
        'WHERE id_exportacion = ANY($1)',
        [ids, idUsuario]
    );
}


// Junta varios archivos [{ nombre, contenido }] en un ZIP en memoria.
async function crearZip(archivos) {
    const zip = new ZipArchive({ zlib: { level: 9 } });
    const trozos = [];
    zip.on('data', function (t) { trozos.push(t); });
    const terminado = new Promise(function (resolver, rechazar) {
        zip.on('end', resolver);
        zip.on('error', rechazar);
    });
    for (const a of archivos) {
        zip.append(a.contenido, { name: a.nombre });
    }
    await zip.finalize();
    await terminado;
    return Buffer.concat(trozos);
}

function sello() {
    return new Date().toISOString().substring(0, 16).replace(/[-:]/g, '').replace('T', '_');
}

const TIPOS = {
    xml: 'application/xml; charset=utf-8',
    csv: 'text/csv; charset=utf-8',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    zip: 'application/zip'
};

function enviarArchivo(res, nombre, contenido) {
    res.set('Content-Type', TIPOS[nombre.split('.').pop()] || 'application/octet-stream');
    res.set('Content-Disposition', 'attachment; filename="' + nombre + '"');
    res.send(contenido);
}


router.get('/:id/xml', async function (req, res) {
    const id = parseInt(req.params.id);
    try {
        const r = await pool.query('SELECT nombre_archivo, contenido FROM exportaciones_xml WHERE id_exportacion = $1', [id]);
        if (r.rows.length === 0) {
            return res.status(404).json({ error: 'XML no encontrado' });
        }
        await marcarExportados([id], req.usuario.id);
        res.set('Content-Type', 'application/xml; charset=utf-8');
        res.set('Content-Disposition', 'attachment; filename="' + r.rows[0].nombre_archivo + '"');
        res.send(r.rows[0].contenido);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al descargar el XML' });
    }
});


router.post('/zip', async function (req, res) {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(function (v) { return parseInt(v); }).filter(function (n) { return !isNaN(n); }) : [];
    if (ids.length === 0) {
        return res.status(400).json({ error: 'Marca al menos un XML' });
    }
    try {
        const r = await pool.query(
            'SELECT id_exportacion, nombre_archivo, contenido FROM exportaciones_xml WHERE id_exportacion = ANY($1)', [ids]
        );
        if (r.rows.length === 0) {
            return res.status(404).json({ error: 'No se ha encontrado ningún XML' });
        }

        const zip = await crearZip(r.rows.map(function (f) { return { nombre: f.nombre_archivo, contenido: f.contenido }; }));
        await marcarExportados(r.rows.map(function (f) { return f.id_exportacion; }), req.usuario.id);
        enviarArchivo(res, 'pedidos_erp_' + sello() + '.zip', zip);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al generar el ZIP' });
    }
});


// ---------------------------------------------------------------------
// Descargar con el XML del ERP o con una plantilla.
// Uno solo -> el archivo; varios -> ZIP.
// ---------------------------------------------------------------------
router.post('/descargar', async function (req, res) {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(function (v) { return parseInt(v); }).filter(function (n) { return !isNaN(n); }) : [];
    if (ids.length === 0) {
        return res.status(400).json({ error: 'Marca al menos un pedido' });
    }
    const cliente = await pool.connect();
    try {
        const r = await cliente.query(
            'SELECT id_exportacion, id_compra, nombre_archivo, contenido FROM exportaciones_xml WHERE id_exportacion = ANY($1) ORDER BY id_exportacion',
            [ids]
        );
        if (r.rows.length === 0) {
            return res.status(404).json({ error: 'No se ha encontrado ningún pedido' });
        }
        const idsEncontrados = r.rows.map(function (f) { return f.id_exportacion; });

        let archivos;
        let marcar = true;
        let prefijoZip = 'pedidos_erp_';
        if (req.body.plantilla === 'ERP' || req.body.plantilla === undefined || req.body.plantilla === '') {
            archivos = r.rows.map(function (f) { return { nombre: f.nombre_archivo, contenido: f.contenido }; });
        } else {
            const pl = await cliente.query('SELECT * FROM plantillas_exportacion WHERE id_plantilla = $1', [parseInt(req.body.plantilla) || 0]);
            if (pl.rows.length === 0) {
                return res.status(404).json({ error: 'Plantilla no encontrada' });
            }
            const plantilla = pl.rows[0];
            const pedidos = [];
            for (const f of r.rows) {
                const p = await leerPedidoCompleto(cliente, f.id_compra);
                if (p) {
                    pedidos.push(p);
                }
            }
            archivos = await exportador.generarArchivos(plantilla, pedidos, sello());
            marcar = plantilla.marcar_exportado;
            prefijoZip = exportador.nombreSeguro(plantilla.nombre_plantilla) + '_';
        }

        if (marcar) {
            await marcarExportados(idsEncontrados, req.usuario.id);
        }
        if (archivos.length === 1) {
            return enviarArchivo(res, archivos[0].nombre, archivos[0].contenido);
        }
        enviarArchivo(res, prefijoZip + sello() + '.zip', await crearZip(archivos));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al generar la descarga' });
    } finally {
        cliente.release();
    }
});


// ---------------------------------------------------------------------
// Plantillas de exportación
// ---------------------------------------------------------------------
router.get('/campos', function (req, res) {
    res.json({ campos: exportador.CAMPOS, fechas: exportador.FECHAS });
});

router.get('/plantillas', async function (req, res) {
    try {
        const r = await pool.query(
            "SELECT id_plantilla, nombre_plantilla, formato, columnas, opciones, marcar_exportado, " +
            "       TO_CHAR(fecha_modificacion, 'DD/MM/YYYY HH24:MI') AS fecha_modificacion " +
            'FROM plantillas_exportacion ORDER BY nombre_plantilla'
        );
        res.json(r.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al leer las plantillas' });
    }
});

function errorPlantilla(res, error) {
    if (error.code === '23505') {
        return res.status(400).json({ error: 'Ya existe una plantilla con ese nombre' });
    }
    if (error.code) {
        console.error(error);
        return res.status(500).json({ error: 'Error al guardar la plantilla' });
    }
    res.status(400).json({ error: error.message });
}

router.post('/plantillas', async function (req, res) {
    try {
        const d = exportador.validarPlantilla(req.body);
        const r = await pool.query(
            'INSERT INTO plantillas_exportacion (nombre_plantilla, formato, columnas, opciones, marcar_exportado) ' +
            'VALUES ($1, $2, $3, $4, $5) RETURNING id_plantilla',
            [d.nombre_plantilla, d.formato, JSON.stringify(d.columnas), JSON.stringify(d.opciones), d.marcar_exportado]
        );
        res.status(201).json({ mensaje: 'Plantilla guardada', id_plantilla: r.rows[0].id_plantilla });
    } catch (error) {
        errorPlantilla(res, error);
    }
});

router.put('/plantillas/:id', async function (req, res) {
    try {
        const d = exportador.validarPlantilla(req.body);
        const r = await pool.query(
            'UPDATE plantillas_exportacion SET nombre_plantilla = $1, formato = $2, columnas = $3, opciones = $4, ' +
            '       marcar_exportado = $5, fecha_modificacion = NOW() WHERE id_plantilla = $6',
            [d.nombre_plantilla, d.formato, JSON.stringify(d.columnas), JSON.stringify(d.opciones), d.marcar_exportado, parseInt(req.params.id) || 0]
        );
        if (r.rowCount === 0) {
            return res.status(404).json({ error: 'Plantilla no encontrada' });
        }
        res.json({ mensaje: 'Plantilla actualizada' });
    } catch (error) {
        errorPlantilla(res, error);
    }
});

router.delete('/plantillas/:id', async function (req, res) {
    try {
        const r = await pool.query('DELETE FROM plantillas_exportacion WHERE id_plantilla = $1', [parseInt(req.params.id) || 0]);
        if (r.rowCount === 0) {
            return res.status(404).json({ error: 'Plantilla no encontrada' });
        }
        res.json({ mensaje: 'Plantilla eliminada' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar la plantilla' });
    }
});


router.delete('/:id', async function (req, res) {
    const id = parseInt(req.params.id);
    try {
        const r = await pool.query('DELETE FROM exportaciones_xml WHERE id_exportacion = $1', [id]);
        if (r.rowCount === 0) {
            return res.status(404).json({ error: 'XML no encontrado' });
        }
        res.json({ mensaje: 'XML eliminado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar el XML' });
    }
});


module.exports = router;
