// =====================================================================
// ARCHIVO: rutas/importaciones.js
// Carga de proveedores, artículos y tarifas desde archivos. Solo ADMIN.
//
//   GET    /api/importaciones/campos          -> destinos y sus campos
//   POST   /api/importaciones/leer            -> columnas y primeras filas del archivo
//   POST   /api/importaciones/comprobar       -> qué se daría de alta / actualizaría / errores
//   POST   /api/importaciones/importar        -> guarda (todo o nada)
//   GET    /api/importaciones/plantillas      -> plantillas guardadas
//   POST   /api/importaciones/plantillas      -> crea una plantilla
//   PUT    /api/importaciones/plantillas/:id  -> modifica una plantilla
//   DELETE /api/importaciones/plantillas/:id  -> borra una plantilla
//
// El archivo viaja en el cuerpo JSON en base64: { formato, archivo, opciones }.
// =====================================================================

const express = require('express');
const pool = require('../bd');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { DESTINOS, FORMATOS, leerArchivo, procesar } = require('../importador');

const router = express.Router();
router.use(verificarToken, soloAdmin);

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILAS_RESPUESTA = 1000;


function archivoDeLaPeticion(body) {
    if (!FORMATOS.includes(body.formato)) {
        throw new Error('Elige el formato del archivo (CSV, Excel o XML)');
    }
    if (!body.archivo || typeof body.archivo !== 'string') {
        throw new Error('Falta el archivo');
    }
    const buffer = Buffer.from(body.archivo, 'base64');
    if (buffer.length === 0) {
        throw new Error('El archivo está vacío');
    }
    if (buffer.length > MAX_BYTES) {
        throw new Error('El archivo pasa de 10 MB');
    }
    return buffer;
}

function opcionesValidas(o) {
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
}

function mapeoValido(destino, mapeo) {
    const limpio = {};
    if (!DESTINOS[destino] || !mapeo || typeof mapeo !== 'object') {
        return limpio;
    }
    for (const c of DESTINOS[destino].campos) {
        if (typeof mapeo[c.campo] === 'string' && mapeo[c.campo].trim() !== '') {
            limpio[c.campo] = mapeo[c.campo];
        }
    }
    return limpio;
}


router.get('/campos', function (req, res) {
    res.json({ destinos: DESTINOS, formatos: FORMATOS });
});


router.post('/leer', async function (req, res) {
    try {
        const buffer = archivoDeLaPeticion(req.body);
        const t = await leerArchivo(req.body.formato, buffer, opcionesValidas(req.body.opciones));
        res.json({ columnas: t.columnas, muestra: t.filas.slice(0, 5), total: t.filas.length, opciones: t.opciones });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


// comprobar e importar comparten todo menos el guardado.
async function comprobarOImportar(req, res, aplicar) {
    let t;
    try {
        const buffer = archivoDeLaPeticion(req.body);
        t = await leerArchivo(req.body.formato, buffer, opcionesValidas(req.body.opciones));
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
    const destino = req.body.destino;
    const mapeo = mapeoValido(destino, req.body.mapeo);

    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');
        const r = await procesar(cliente, destino, t.filas, mapeo, aplicar);
        await cliente.query(r.guardado ? 'COMMIT' : 'ROLLBACK');

        // Las filas con error primero, para verlas sin buscar.
        const ordenadas = r.filas.filter(function (f) { return f.accion === 'ERROR'; })
            .concat(r.filas.filter(function (f) { return f.accion !== 'ERROR'; }));
        let mensaje = null;
        if (aplicar) {
            mensaje = r.guardado
                ? 'Importación terminada: ' + r.resumen.altas + ' altas y ' + r.resumen.actualizaciones + ' actualizaciones'
                : 'No se ha guardado nada: corrige los errores y vuelve a intentarlo';
        }
        res.status(aplicar && !r.guardado ? 400 : 200).json({
            mensaje: mensaje,
            error: aplicar && !r.guardado ? mensaje : undefined,
            resumen: r.resumen,
            guardado: r.guardado,
            filas: ordenadas.slice(0, MAX_FILAS_RESPUESTA)
        });
    } catch (error) {
        await cliente.query('ROLLBACK').catch(function () { });
        if (error.code) {
            console.error(error);
            return res.status(500).json({ error: 'Error al guardar los datos. No se ha guardado nada' });
        }
        res.status(400).json({ error: error.message });
    } finally {
        cliente.release();
    }
}

router.post('/comprobar', function (req, res) {
    comprobarOImportar(req, res, false);
});

router.post('/importar', function (req, res) {
    comprobarOImportar(req, res, true);
});


// ---------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------
function datosPlantilla(body) {
    const nombre = String(body.nombre_plantilla || '').trim();
    if (!nombre || nombre.length > 100) {
        throw new Error('El nombre de la plantilla es obligatorio (máximo 100 caracteres)');
    }
    if (!DESTINOS[body.destino]) {
        throw new Error('Destino no válido');
    }
    if (!FORMATOS.includes(body.formato)) {
        throw new Error('Formato no válido');
    }
    // Solo guardamos las opciones de lectura, no las listas informativas.
    const o = opcionesValidas(body.opciones);
    const opciones = {};
    for (const k of ['separador', 'hoja', 'elemento_fila']) {
        if (typeof o[k] === 'string' && o[k] !== '') {
            opciones[k] = o[k].substring(0, 100);
        }
    }
    return [nombre, body.destino, body.formato, JSON.stringify(opciones), JSON.stringify(mapeoValido(body.destino, body.mapeo))];
}

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

router.get('/plantillas', async function (req, res) {
    try {
        const r = await pool.query(
            `SELECT id_plantilla, nombre_plantilla, destino, formato, opciones, mapeo,
                    TO_CHAR(fecha_modificacion, 'DD/MM/YYYY HH24:MI') AS fecha_modificacion
             FROM plantillas_importacion ORDER BY nombre_plantilla`
        );
        res.json(r.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al leer las plantillas' });
    }
});

router.post('/plantillas', async function (req, res) {
    try {
        const r = await pool.query(
            `INSERT INTO plantillas_importacion (nombre_plantilla, destino, formato, opciones, mapeo)
             VALUES ($1, $2, $3, $4, $5) RETURNING id_plantilla`,
            datosPlantilla(req.body)
        );
        res.status(201).json({ mensaje: 'Plantilla guardada', id_plantilla: r.rows[0].id_plantilla });
    } catch (error) {
        errorPlantilla(res, error);
    }
});

router.put('/plantillas/:id', async function (req, res) {
    try {
        const r = await pool.query(
            `UPDATE plantillas_importacion
             SET nombre_plantilla = $1, destino = $2, formato = $3, opciones = $4, mapeo = $5, fecha_modificacion = NOW()
             WHERE id_plantilla = $6`,
            datosPlantilla(req.body).concat(parseInt(req.params.id, 10) || 0)
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
        const r = await pool.query('DELETE FROM plantillas_importacion WHERE id_plantilla = $1', [parseInt(req.params.id, 10) || 0]);
        if (r.rowCount === 0) {
            return res.status(404).json({ error: 'Plantilla no encontrada' });
        }
        res.json({ mensaje: 'Plantilla eliminada' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar la plantilla' });
    }
});


module.exports = router;
