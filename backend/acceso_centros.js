// =====================================================================
// ARCHIVO: acceso_centros.js
// Reglas de acceso por centro:
//   - ADMIN   -> puede trabajar con cualquier centro.
//   - USUARIO -> solo con los centros activos que tenga asignados en
//                usuario_centros.
// =====================================================================

const pool = require('./bd');


// ---------------------------------------------------------------------
// idsCentrosUsuario: devuelve null si el usuario es ADMIN (= todos) o
// la lista de ids de centros activos que tiene asignados.
// ---------------------------------------------------------------------
async function idsCentrosUsuario(usuario, cliente) {
    if (usuario.rol === 'ADMIN') {
        return null;
    }
    const r = await (cliente || pool).query(
        'SELECT uc.id_centro FROM usuario_centros uc ' +
        'JOIN centros c ON c.id_centro = uc.id_centro ' +
        'WHERE uc.id_usuario = $1 AND c.activo_centro = TRUE',
        [usuario.id]
    );
    return r.rows.map(function (f) { return f.id_centro; });
}


// ---------------------------------------------------------------------
// puedeUsarCentro: true si el usuario puede pedir / ver datos del centro.
// Para ADMIN basta con que el centro exista.
// ---------------------------------------------------------------------
async function puedeUsarCentro(usuario, idCentro, cliente) {
    if (!Number.isInteger(idCentro)) {
        return false;
    }
    const ids = await idsCentrosUsuario(usuario, cliente);
    if (ids === null) {
        const r = await (cliente || pool).query('SELECT 1 FROM centros WHERE id_centro = $1', [idCentro]);
        return r.rows.length > 0;
    }
    return ids.includes(idCentro);
}


// ---------------------------------------------------------------------
// SQL_PEDIBLE: condición que cumple un artículo "a" que se puede pedir
// en el centro $1:
//   - el artículo está activo y habilitado en el centro, y
//   - hay al menos una tarifa activa de un proveedor activo que esté
//     habilitado en ese centro (si no, el motor no podría adjudicarlo).
// ---------------------------------------------------------------------
const SQL_PEDIBLE =
    'a.activo_articulo = TRUE ' +
    'AND EXISTS (SELECT 1 FROM centro_articulos ca WHERE ca.id_centro = $1 AND ca.id_articulo = a.id_articulo) ' +
    'AND EXISTS (SELECT 1 FROM articulos_tarificados t ' +
    '            JOIN proveedores p ON p.id_proveedor = t.id_proveedor ' +
    '            JOIN centro_proveedores cp ON cp.id_proveedor = t.id_proveedor AND cp.id_centro = $1 ' +
    '            WHERE t.id_articulo = a.id_articulo ' +
    '              AND t.activo_articulo_tarificado = TRUE ' +
    '              AND p.activo_proveedor = TRUE)';


// ---------------------------------------------------------------------
// todosPedibles: true si todos los artículos de la lista se pueden
// pedir en el centro.
// ---------------------------------------------------------------------
async function todosPedibles(cliente, idCentro, idsArticulos) {
    const r = await cliente.query(
        'SELECT COUNT(*) AS total FROM articulos a WHERE a.id_articulo = ANY($2) AND ' + SQL_PEDIBLE,
        [idCentro, idsArticulos]
    );
    return parseInt(r.rows[0].total) === idsArticulos.length;
}


module.exports = { idsCentrosUsuario, puedeUsarCentro, SQL_PEDIBLE, todosPedibles };
