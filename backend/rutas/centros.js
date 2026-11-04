// =====================================================================
// ARCHIVO: rutas/centros.js
// Centros y lo que tienen habilitado.
//   GET    /api/centros/mios              -> centros para los que puede pedir el usuario
//   --- solo ADMIN ---
//   GET    /api/centros                   -> lista
//   GET    /api/centros/:id               -> ficha completa (emails CC, proveedores y artículos habilitados)
//   POST   /api/centros                   -> alta
//   PUT    /api/centros/:id               -> modificación
//   PUT    /api/centros/:id/activo        -> activar / desactivar
//   DELETE /api/centros/:id               -> borrado (si no tiene solicitudes ni pedidos)
//   PUT    /api/centros/:id/emails-cc     -> { emails: [...] }
//   PUT    /api/centros/:id/proveedores   -> { ids: [...] }
//   PUT    /api/centros/:id/articulos     -> { ids: [...] }
// La contraseña SMTP nunca se devuelve: solo si está configurada o no.
// =====================================================================

const express = require('express');
const pool = require('../bd');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { idsCentrosUsuario } = require('../acceso_centros');
const { cifrar } = require('../cifrado');

const router = express.Router();
router.use(verificarToken);

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Campos que se devuelven al admin (todos menos la contraseña SMTP).
const COLUMNAS =
    'c.id_centro, c.id_sociedad, c.numero_serie, c.numero_almacen, c.nombre_centro, c.telefono_1, c.telefono_2, ' +
    'c.responsable, c.dir_entrega, c.cp_entrega, c.localidad_entrega, c.provincia_entrega, c.observaciones_entrega, c.observaciones_pedido, ' +
    'c.email_envio, c.smtp_host, c.smtp_puerto, c.smtp_usuario, (c.smtp_contrasena IS NOT NULL) AS smtp_configurada, ' +
    'c.activo_centro, s.razon_social';


function textoOpcional(valor) {
    const texto = (valor === undefined || valor === null ? '' : String(valor)).trim();
    return texto === '' ? null : texto;
}

function texto(valor) {
    return (valor === undefined || valor === null ? '' : String(valor)).trim();
}


function limpiarCentro(body) {
    const puerto = texto(body.smtp_puerto);
    return {
        id_sociedad: parseInt(body.id_sociedad),
        numero_serie: texto(body.numero_serie).toUpperCase(),
        numero_almacen: texto(body.numero_almacen).toUpperCase(),
        nombre_centro: texto(body.nombre_centro),
        telefono_1: texto(body.telefono_1),
        telefono_2: textoOpcional(body.telefono_2),
        responsable: textoOpcional(body.responsable),
        dir_entrega: texto(body.dir_entrega),
        cp_entrega: texto(body.cp_entrega),
        localidad_entrega: texto(body.localidad_entrega),
        provincia_entrega: texto(body.provincia_entrega),
        observaciones_entrega: textoOpcional(body.observaciones_entrega),
        observaciones_pedido: textoOpcional(body.observaciones_pedido),
        email_envio: texto(body.email_envio).toLowerCase(),
        smtp_host: textoOpcional(body.smtp_host),
        smtp_puerto: puerto === '' ? null : parseInt(puerto),
        smtp_usuario: textoOpcional(body.smtp_usuario)
    };
}


function validarCentro(c) {
    if (isNaN(c.id_sociedad)) {
        return 'Elige la sociedad del centro';
    }
    if (!/^[A-Z0-9]{1,8}$/.test(c.numero_serie)) {
        return 'El número de serie es obligatorio: letras y números, máx. 8 (como en el ERP)';
    }
    if (!/^[A-Z0-9]{1,3}$/.test(c.numero_almacen)) {
        return 'El número de almacén es obligatorio: letras y números, máx. 3 (como en el ERP)';
    }
    if (c.nombre_centro === '' || c.nombre_centro.length > 100) {
        return 'El nombre del centro es obligatorio (máx. 100 caracteres)';
    }
    if (!/^\+?[0-9]{9,15}$/.test(c.telefono_1)) {
        return 'El teléfono 1 es obligatorio y solo puede tener números (mínimo 9)';
    }
    if (c.telefono_2 !== null && !/^\+?[0-9]{9,15}$/.test(c.telefono_2)) {
        return 'El teléfono 2 solo puede tener números (mínimo 9)';
    }
    if (c.responsable !== null && c.responsable.length > 100) {
        return 'El responsable no puede pasar de 100 caracteres';
    }
    if (c.dir_entrega === '' || c.dir_entrega.length > 150) {
        return 'La dirección de entrega es obligatoria (máx. 150 caracteres)';
    }
    if (!/^[0-9]{5}$/.test(c.cp_entrega)) {
        return 'El código postal de entrega debe tener 5 números';
    }
    if (c.localidad_entrega === '' || c.localidad_entrega.length > 80) {
        return 'La localidad de entrega es obligatoria (máx. 80 caracteres)';
    }
    if (c.provincia_entrega === '' || c.provincia_entrega.length > 50) {
        return 'La provincia de entrega es obligatoria (máx. 50 caracteres)';
    }
    if (c.observaciones_entrega !== null && c.observaciones_entrega.length > 500) {
        return 'Las observaciones de entrega no pueden pasar de 500 caracteres';
    }
    if (c.observaciones_pedido !== null && c.observaciones_pedido.length > 1000) {
        return 'Las observaciones del pie del pedido no pueden pasar de 1000 caracteres';
    }
    if (!REGEX_EMAIL.test(c.email_envio) || c.email_envio.length > 120) {
        return 'El email de envío de pedidos no es válido';
    }
    if (c.smtp_puerto !== null && (isNaN(c.smtp_puerto) || c.smtp_puerto < 1 || c.smtp_puerto > 65535)) {
        return 'El puerto SMTP debe ser un número entre 1 y 65535';
    }
    if ((c.smtp_host && c.smtp_host.length > 120) || (c.smtp_usuario && c.smtp_usuario.length > 120)) {
        return 'Servidor o usuario SMTP demasiado largos';
    }
    return '';
}


function errorUnico(error) {
    if (error.constraint === 'centros_numero_serie_key') {
        return 'Ya existe otro centro con ese número de serie';
    }
    if (error.constraint === 'centros_numero_almacen_key') {
        return 'Ya existe otro centro con ese número de almacén';
    }
    return 'Dato repetido';
}


// =====================================================================
// GET /api/centros/mios  (cualquier usuario con sesión)
// =====================================================================
router.get('/mios', async function (req, res) {
    try {
        const ids = await idsCentrosUsuario(req.usuario);
        let sql = 'SELECT id_centro, numero_serie, nombre_centro FROM centros WHERE activo_centro = TRUE ';
        const valores = [];
        if (ids !== null) {
            sql += 'AND id_centro = ANY($1) ';
            valores.push(ids);
        }
        sql += 'ORDER BY nombre_centro';
        const resultado = await pool.query(sql, valores);
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener tus centros' });
    }
});


// A partir de aquí, todo es solo para ADMIN.
router.use(soloAdmin);


router.get('/', async function (req, res) {
    try {
        const resultado = await pool.query(
            'SELECT ' + COLUMNAS + ' FROM centros c JOIN sociedades s ON s.id_sociedad = c.id_sociedad ' +
            'ORDER BY c.nombre_centro'
        );
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los centros' });
    }
});


router.get('/:id', async function (req, res) {
    const id = parseInt(req.params.id);
    try {
        const resultado = await pool.query(
            'SELECT ' + COLUMNAS + ' FROM centros c JOIN sociedades s ON s.id_sociedad = c.id_sociedad WHERE c.id_centro = $1',
            [id]
        );
        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Centro no encontrado' });
        }
        const centro = resultado.rows[0];

        const emails = await pool.query('SELECT email FROM centro_emails_cc WHERE id_centro = $1 ORDER BY email', [id]);
        const proveedores = await pool.query('SELECT id_proveedor FROM centro_proveedores WHERE id_centro = $1', [id]);
        const articulos = await pool.query('SELECT id_articulo FROM centro_articulos WHERE id_centro = $1', [id]);

        centro.emails_cc = emails.rows.map(function (f) { return f.email; });
        centro.proveedores = proveedores.rows.map(function (f) { return f.id_proveedor; });
        centro.articulos = articulos.rows.map(function (f) { return f.id_articulo; });
        res.json(centro);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener el centro' });
    }
});


router.post('/', async function (req, res) {
    const c = limpiarCentro(req.body);
    const error = validarCentro(c);
    if (error !== '') {
        return res.status(400).json({ error: error });
    }
    const contrasena = texto(req.body.smtp_contrasena);

    try {
        const resultado = await pool.query(
            'INSERT INTO centros (id_sociedad, numero_serie, numero_almacen, nombre_centro, telefono_1, telefono_2, responsable, ' +
            '  dir_entrega, cp_entrega, localidad_entrega, provincia_entrega, observaciones_entrega, email_envio, ' +
            '  smtp_host, smtp_puerto, smtp_usuario, smtp_contrasena, observaciones_pedido) ' +
            'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id_centro',
            [c.id_sociedad, c.numero_serie, c.numero_almacen, c.nombre_centro, c.telefono_1, c.telefono_2, c.responsable,
                c.dir_entrega, c.cp_entrega, c.localidad_entrega, c.provincia_entrega, c.observaciones_entrega, c.email_envio,
                c.smtp_host, c.smtp_puerto, c.smtp_usuario, contrasena === '' ? null : cifrar(contrasena), c.observaciones_pedido]
        );
        res.status(201).json({ mensaje: 'Centro creado', id: resultado.rows[0].id_centro });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: errorUnico(error) });
        }
        if (error.code === '23503') {
            return res.status(400).json({ error: 'La sociedad elegida no existe' });
        }
        console.error(error);
        res.status(500).json({ error: error.message.includes('CLAVE_CIFRADO') ? error.message : 'Error al crear el centro' });
    }
});


// ---------------------------------------------------------------------
// PUT /api/centros/:id
// Contraseña SMTP: si llega vacía se conserva la que había; si llega
// borrar_smtp_contrasena = true se elimina.
// ---------------------------------------------------------------------
router.put('/:id', async function (req, res) {
    const id = parseInt(req.params.id);
    const c = limpiarCentro(req.body);
    const error = validarCentro(c);
    if (error !== '') {
        return res.status(400).json({ error: error });
    }
    const contrasena = texto(req.body.smtp_contrasena);

    try {
        const valores = [c.id_sociedad, c.numero_serie, c.numero_almacen, c.nombre_centro, c.telefono_1, c.telefono_2, c.responsable,
            c.dir_entrega, c.cp_entrega, c.localidad_entrega, c.provincia_entrega, c.observaciones_entrega, c.email_envio,
            c.smtp_host, c.smtp_puerto, c.smtp_usuario, id, c.observaciones_pedido];
        let sql =
            'UPDATE centros SET id_sociedad = $1, numero_serie = $2, numero_almacen = $3, nombre_centro = $4, telefono_1 = $5, ' +
            'telefono_2 = $6, responsable = $7, dir_entrega = $8, cp_entrega = $9, localidad_entrega = $10, provincia_entrega = $11, ' +
            'observaciones_entrega = $12, email_envio = $13, smtp_host = $14, smtp_puerto = $15, smtp_usuario = $16, ' +
            'observaciones_pedido = $18';

        if (req.body.borrar_smtp_contrasena === true) {
            sql += ', smtp_contrasena = NULL';
        } else if (contrasena !== '') {
            valores.push(cifrar(contrasena));
            sql += ', smtp_contrasena = $19';
        }
        sql += ' WHERE id_centro = $17';

        const resultado = await pool.query(sql, valores);
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Centro no encontrado' });
        }
        res.json({ mensaje: 'Centro modificado' });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: errorUnico(error) });
        }
        if (error.code === '23503') {
            return res.status(400).json({ error: 'La sociedad elegida no existe' });
        }
        console.error(error);
        res.status(500).json({ error: error.message.includes('CLAVE_CIFRADO') ? error.message : 'Error al modificar el centro' });
    }
});


router.put('/:id/activo', async function (req, res) {
    const id = parseInt(req.params.id);
    try {
        const resultado = await pool.query('UPDATE centros SET activo_centro = NOT activo_centro WHERE id_centro = $1', [id]);
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Centro no encontrado' });
        }
        res.json({ mensaje: 'Estado del centro cambiado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cambiar el estado' });
    }
});


router.delete('/:id', async function (req, res) {
    const id = parseInt(req.params.id);
    try {
        const resultado = await pool.query('DELETE FROM centros WHERE id_centro = $1', [id]);
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Centro no encontrado' });
        }
        res.json({ mensaje: 'Centro borrado' });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ error: 'No se puede borrar: el centro tiene solicitudes o pedidos. Desactívalo en su lugar.' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al borrar el centro' });
    }
});


// ---------------------------------------------------------------------
// reemplazarLista: borra las filas del centro en la tabla indicada e
// inserta las nuevas, todo en una transacción.
// ---------------------------------------------------------------------
async function reemplazarLista(res, idCentro, tabla, columna, valores, mensaje) {
    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');
        const existe = await cliente.query('SELECT 1 FROM centros WHERE id_centro = $1', [idCentro]);
        if (existe.rows.length === 0) {
            await cliente.query('ROLLBACK');
            return res.status(404).json({ error: 'Centro no encontrado' });
        }
        await cliente.query('DELETE FROM ' + tabla + ' WHERE id_centro = $1', [idCentro]);
        for (const v of valores) {
            await cliente.query('INSERT INTO ' + tabla + ' (id_centro, ' + columna + ') VALUES ($1, $2)', [idCentro, v]);
        }
        await cliente.query('COMMIT');
        res.json({ mensaje: mensaje });
    } catch (error) {
        await cliente.query('ROLLBACK');
        if (error.code === '23503') {
            return res.status(400).json({ error: 'Alguno de los elementos elegidos no existe' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al guardar los cambios' });
    } finally {
        cliente.release();
    }
}


router.put('/:id/emails-cc', async function (req, res) {
    const lista = Array.isArray(req.body.emails) ? req.body.emails : null;
    if (lista === null) {
        return res.status(400).json({ error: 'Envía la lista de emails' });
    }
    const emails = [];
    for (const e of lista) {
        const email = texto(e).toLowerCase();
        if (email === '') {
            continue;
        }
        if (!REGEX_EMAIL.test(email) || email.length > 120) {
            return res.status(400).json({ error: 'Email no válido: ' + email });
        }
        if (!emails.includes(email)) {
            emails.push(email);
        }
    }
    await reemplazarLista(res, parseInt(req.params.id), 'centro_emails_cc', 'email', emails, 'Emails en copia guardados');
});


function listaIds(body) {
    if (!Array.isArray(body.ids)) {
        return null;
    }
    const ids = [];
    for (const v of body.ids) {
        const n = parseInt(v);
        if (isNaN(n)) {
            return null;
        }
        if (!ids.includes(n)) {
            ids.push(n);
        }
    }
    return ids;
}


router.put('/:id/proveedores', async function (req, res) {
    const ids = listaIds(req.body);
    if (ids === null) {
        return res.status(400).json({ error: 'Lista de proveedores no válida' });
    }
    await reemplazarLista(res, parseInt(req.params.id), 'centro_proveedores', 'id_proveedor', ids, 'Proveedores habilitados guardados');
});


router.put('/:id/articulos', async function (req, res) {
    const ids = listaIds(req.body);
    if (ids === null) {
        return res.status(400).json({ error: 'Lista de artículos no válida' });
    }
    await reemplazarLista(res, parseInt(req.params.id), 'centro_articulos', 'id_articulo', ids, 'Catálogo del centro guardado');
});


module.exports = router;
