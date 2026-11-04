// =====================================================================
// ARCHIVO: motor_adjudicacion.js
// MOTOR DE ADJUDICACIÓN.
//
// Recibe una solicitud (de un centro concreto) y:
//   1. Para cada línea busca la tarifa activa con el precio NETO más bajo
//      entre los proveedores HABILITADOS en ese centro (en empate gana el
//      proveedor con el id más bajo). Las tarifas son globales.
//   2. Agrupa las líneas ganadoras por proveedor.
//   3. Crea un pedido (tabla compra) por proveedor con su fecha de entrega
//      y su número AAAANNNNN (año + contador del centro).
//   4. Crea las líneas de compra copiando ("congelando") el precio neto.
//   5. Marca la solicitud como PROCESADO.
//
// IMPORTANTE: esta función NO abre ni cierra la transacción. Recibe un
// "cliente" que ya ha hecho BEGIN; quien la llama hace COMMIT si todo va
// bien o ROLLBACK si algo falla. Así, o se guarda TODO o NADA.
// =====================================================================


// ---------------------------------------------------------------------
// siguienteNumero: reserva el siguiente número de pedido del centro
// para el año actual (hora de España) con formato AAAANNNNN, por
// ejemplo 202600001. El INSERT ... ON CONFLICT DO UPDATE es atómico:
// dos pedidos simultáneos nunca reciben el mismo número. Si el número
// no llega a guardarse (ROLLBACK), el contador también vuelve atrás.
// ---------------------------------------------------------------------
const MAX_POR_ANIO = 99999;

async function siguienteNumero(cliente, idCentro) {
    const r = await cliente.query(
        'INSERT INTO contadores_pedido (id_centro, anio, ultimo_numero) ' +
        "VALUES ($1, EXTRACT(YEAR FROM NOW() AT TIME ZONE 'Europe/Madrid')::INTEGER, 1) " +
        'ON CONFLICT (id_centro, anio) DO UPDATE SET ultimo_numero = contadores_pedido.ultimo_numero + 1 ' +
        'RETURNING anio, ultimo_numero',
        [idCentro]
    );
    const { anio, ultimo_numero } = r.rows[0];
    if (ultimo_numero > MAX_POR_ANIO) {
        throw new Error('Este centro ha superado los ' + MAX_POR_ANIO + ' pedidos del año ' + anio);
    }
    return anio * 100000 + ultimo_numero;
}


// ---------------------------------------------------------------------
// Función asíncrona que exportamos. Parámetros:
//   cliente      -> conexión de la BD con la transacción abierta
//   idSolicitud  -> número de la solicitud a procesar
//   fechaEntrega -> texto 'AAAA-MM-DD'
// Devuelve un array con los pedidos creados: { id_compra, serie, numero }.
// ---------------------------------------------------------------------
async function generarPedidos(cliente, idSolicitud, fechaEntrega) {

    // -----------------------------------------------------------------
    // PASO 0: pasamos la solicitud a PROCESADO, pero SOLO si sigue
    // PENDIENTE. Si rowCount es 0 es que no existe o ya se procesó
    // (por ejemplo si alguien pulsa dos veces el botón). Hacerlo lo
    // primero evita generar los pedidos dos veces.
    // -----------------------------------------------------------------
    const actualizada = await cliente.query(
        "UPDATE solicitud_pedido SET estado = 'PROCESADO' WHERE id_solicitud = $1 AND estado = 'PENDIENTE' RETURNING id_centro",
        [idSolicitud]
    );
    if (actualizada.rowCount === 0) {
        throw new Error('La solicitud no existe o ya estaba procesada');
    }
    const idCentro = actualizada.rows[0].id_centro;

    const centro = await cliente.query(
        'SELECT numero_serie, activo_centro FROM centros WHERE id_centro = $1', [idCentro]
    );
    if (!centro.rows[0].activo_centro) {
        throw new Error('El centro de esta solicitud está desactivado');
    }
    const serie = centro.rows[0].numero_serie;

    // -----------------------------------------------------------------
    // PASO 1: leemos las líneas de la solicitud.
    // -----------------------------------------------------------------
    const lineas = await cliente.query(
        'SELECT * FROM lineas_solicitud WHERE id_solicitud = $1 ORDER BY id_linea_solicitud',
        [idSolicitud]
    );
    if (lineas.rows.length === 0) {
        throw new Error('La solicitud no tiene líneas');
    }

    // -----------------------------------------------------------------
    // "pedidosPorProveedor" es un objeto que usamos como agenda:
    //   la clave es el id del proveedor y el valor un array con sus líneas.
    //   Ejemplo: { 1: [linea, linea], 2: [linea] }
    // -----------------------------------------------------------------
    const pedidosPorProveedor = {};

    // -----------------------------------------------------------------
    // PASO 2: bucle por cada línea pedida (subasta del precio más bajo).
    // La consulta busca las tarifas ACTIVAS del artículo cuyo proveedor
    // esté activo y habilitado en el centro (y el artículo habilitado en
    // el centro), calcula el neto y las ordena de más barata a
    // más cara; en empate ordena por id_proveedor. LIMIT 1 se queda con
    // la primera = la ganadora.
    // -----------------------------------------------------------------
    for (const linea of lineas.rows) {
        const tarifa = await cliente.query(
            'SELECT t.id_articulo_tarificado, t.id_proveedor, t.precio, t.descuento, ' +
            '       ROUND(t.precio - t.precio * t.descuento / 100, 4) AS neto ' +
            'FROM articulos_tarificados t ' +
            'JOIN proveedores p ON p.id_proveedor = t.id_proveedor ' +
            'JOIN centro_proveedores cp ON cp.id_proveedor = t.id_proveedor AND cp.id_centro = $2 ' +
            'JOIN centro_articulos ca ON ca.id_articulo = t.id_articulo AND ca.id_centro = $2 ' +
            'JOIN articulos a ON a.id_articulo = t.id_articulo ' +
            'WHERE t.id_articulo = $1 ' +
            '  AND t.activo_articulo_tarificado = TRUE ' +
            '  AND p.activo_proveedor = TRUE ' +
            '  AND a.activo_articulo = TRUE ' +
            'ORDER BY neto ASC, t.id_proveedor ASC ' +
            'LIMIT 1',
            [linea.id_articulo, idCentro]
        );

        // -------------------------------------------------------------
        // Si un artículo no tiene ninguna tarifa activa, no se puede
        // comprar: lanzamos un error y la transacción se deshace entera.
        // -------------------------------------------------------------
        if (tarifa.rows.length === 0) {
            const art = await cliente.query('SELECT descripcion_articulo FROM articulos WHERE id_articulo = $1', [linea.id_articulo]);
            const nombre = art.rows.length ? art.rows[0].descripcion_articulo : 'id ' + linea.id_articulo;
            throw new Error('"' + nombre + '" no está habilitado en este centro o no tiene ningún proveedor habilitado con tarifa activa');
        }

        const ganadora = tarifa.rows[0];

        // -------------------------------------------------------------
        // Metemos la línea en el "cajón" de su proveedor. Si es la
        // primera vez que sale ese proveedor, creamos el array vacío.
        // -------------------------------------------------------------
        if (pedidosPorProveedor[ganadora.id_proveedor] === undefined) {
            pedidosPorProveedor[ganadora.id_proveedor] = [];
        }
        pedidosPorProveedor[ganadora.id_proveedor].push({
            id_articulo_tarificado: ganadora.id_articulo_tarificado,
            cantidad: linea.cantidad,
            precio_tarifa: ganadora.precio,
            descuento: ganadora.descuento,
            precio_coste: ganadora.neto,
            observaciones: linea.observaciones
        });
    }

    // -----------------------------------------------------------------
    // PASO 3 y 4: recorremos cada proveedor del objeto. Object.keys nos
    // da un array con sus claves (los id de proveedor, como texto).
    // Por cada uno creamos la compra y después sus líneas, numerándolas
    // 1, 2, 3... (id_linea_compra) porque es una entidad débil.
    // -----------------------------------------------------------------
    const comprasCreadas = [];

    for (const idProveedor of Object.keys(pedidosPorProveedor)) {
        const numeroPedido = await siguienteNumero(cliente, idCentro);
        const compra = await cliente.query(
            'INSERT INTO compra (id_centro, id_solicitud, id_proveedor, serie_pedido, numero_pedido, estado, fecha_entrega) ' +
            'VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_compra',
            [idCentro, idSolicitud, idProveedor, serie, numeroPedido, 'PENDIENTE', fechaEntrega]
        );
        const idCompra = compra.rows[0].id_compra;
        comprasCreadas.push({ id_compra: idCompra, serie: serie, numero: numeroPedido });

        // -------------------------------------------------------------
        // Insertamos cada línea de este proveedor. "numero" empieza en 1
        // y sube en cada vuelta. precio_coste se COPIA aquí: aunque la
        // tarifa cambie mañana, este pedido conserva su precio.
        // -------------------------------------------------------------
        let numero = 1;
        for (const l of pedidosPorProveedor[idProveedor]) {
            await cliente.query(
                'INSERT INTO lineas_compra (id_compra, id_linea_compra, id_articulo_tarificado, cantidad_compra, precio_tarifa, descuento, precio_coste, observaciones_compra) ' +
                'VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [idCompra, numero, l.id_articulo_tarificado, l.cantidad, l.precio_tarifa, l.descuento, l.precio_coste, l.observaciones]
            );
            numero++;
        }
    }

    return comprasCreadas;
}


// ---------------------------------------------------------------------
// Exportamos la función para usarla desde rutas/solicitudes.js
// ---------------------------------------------------------------------
module.exports = generarPedidos;
