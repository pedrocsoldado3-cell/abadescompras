// =====================================================================
// ARCHIVO: documentos.js
// Genera los documentos de un pedido:
//   - leerPedidoCompleto(cliente, idCompra) -> todos los datos necesarios
//   - generarPdf(pedido, conPrecios)        -> Buffer con el PDF (A4)
//   - generarXml(pedido)                    -> { nombre, contenido } para el ERP
// El XML sigue el formato DATAPACKET que exporta el ERP (ver
// propuestas/ejemplos/QA_1138.xml).
// =====================================================================

const PDFDocument = require('pdfkit');


// ---------------------------------------------------------------------
// leerPedidoCompleto: cabecera (centro, sociedad, proveedor), líneas y
// textos del pie. Devuelve null si el pedido no existe.
// ---------------------------------------------------------------------
async function leerPedidoCompleto(cliente, idCompra) {
    const cab = await cliente.query(
        "SELECT c.id_compra, c.id_centro, c.serie_pedido, c.numero_pedido, c.estado, c.fecha_entrega, c.fecha_envio, c.fecha_creacion, " +
        '       p.codigo_erp AS proveedor_codigo, p.nombre_proveedor, p.razon_social AS proveedor_razon_social, ' +
        '       p.cif AS proveedor_cif, p.direccion AS proveedor_direccion, p.cod_postal AS proveedor_cp, ' +
        '       p.localidad AS proveedor_localidad, p.provincia AS proveedor_provincia, p.telefono AS proveedor_telefono, ' +
        '       p.email_proveedor, ' +
        '       ce.nombre_centro, ce.numero_almacen, ce.telefono_1, ce.telefono_2, ce.responsable, ' +
        '       ce.dir_entrega, ce.cp_entrega, ce.localidad_entrega, ce.provincia_entrega, ' +
        '       ce.observaciones_entrega, ce.observaciones_pedido, ' +
        '       ce.email_envio, ce.smtp_host, ce.smtp_puerto, ce.smtp_usuario, ce.smtp_contrasena, ' +
        '       so.razon_social AS sociedad_razon_social, so.cif AS sociedad_cif, so.dir_fiscal, so.cp_fiscal, ' +
        '       so.localidad_fiscal, so.provincia_fiscal ' +
        'FROM compra c ' +
        'JOIN proveedores p ON p.id_proveedor = c.id_proveedor ' +
        'JOIN centros ce ON ce.id_centro = c.id_centro ' +
        'JOIN sociedades so ON so.id_sociedad = ce.id_sociedad ' +
        'WHERE c.id_compra = $1',
        [idCompra]
    );
    if (cab.rows.length === 0) {
        return null;
    }

    const lineas = await cliente.query(
        'SELECT l.id_linea_compra, l.cantidad_compra, l.precio_tarifa, l.descuento, l.precio_coste, l.observaciones_compra, ' +
        '       t.referencia_proveedor, a.codigo_erp AS articulo_codigo, a.descripcion_articulo ' +
        'FROM lineas_compra l ' +
        'JOIN articulos_tarificados t ON t.id_articulo_tarificado = l.id_articulo_tarificado ' +
        'JOIN articulos a ON a.id_articulo = t.id_articulo ' +
        'WHERE l.id_compra = $1 ORDER BY l.id_linea_compra',
        [idCompra]
    );

    const emails = await cliente.query(
        'SELECT email FROM centro_emails_cc WHERE id_centro = $1 ORDER BY email', [cab.rows[0].id_centro]
    );
    const conf = await cliente.query("SELECT valor FROM configuracion WHERE clave = 'observaciones_pedidos'");

    const pedido = cab.rows[0];
    pedido.lineas = lineas.rows;
    pedido.emails_cc = emails.rows.map(function (f) { return f.email; });
    pedido.observaciones_generales = conf.rows.length ? conf.rows[0].valor : '';
    return pedido;
}


// ---------------------------------------------------------------------
// Utilidades de formato.
// ---------------------------------------------------------------------
function fechaES(fecha) {
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return dd + '/' + mm + '/' + d.getFullYear();
}

function numeroES(valor, decimales) {
    return Number(valor).toLocaleString('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

function numeroPedido(pedido) {
    return pedido.serie_pedido + '-' + pedido.numero_pedido;
}

function juntar(partes, separador) {
    return partes.filter(function (p) { return p; }).join(separador);
}


// =====================================================================
// PDF
// =====================================================================

// Columnas de la tabla de líneas: [título, x, ancho, alineación]
const COLUMNAS = [
    ['REF. PROV.', 40, 70, 'left'],
    ['CÓDIGO', 112, 50, 'left'],
    ['UDS', 164, 44, 'right'],
    ['DESCRIPCIÓN', 214, 186, 'left'],
    ['PRECIO', 402, 52, 'right'],
    ['%', 456, 30, 'right'],
    ['IMPORTE', 488, 67, 'right']
];
const MARGEN_INFERIOR = 790;


function cabeceraTabla(doc, y) {
    doc.lineWidth(0.8).rect(40, y, 515, 20).stroke();
    doc.font('Helvetica-Bold').fontSize(7.5);
    for (const c of COLUMNAS) {
        doc.text(c[0], c[1] + 3, y + 7, { width: c[2] - 6, align: c[3] });
    }
    return y + 26;
}


function caja(doc, x, y, w, h) {
    doc.lineWidth(0.8).rect(x, y, w, h).stroke();
}


// ---------------------------------------------------------------------
// generarPdf: devuelve una Promise con el Buffer del PDF.
// conPrecios = false -> PRECIO, % e IMPORTE en blanco (pedido sin valorar).
// ---------------------------------------------------------------------
function generarPdf(pedido, conPrecios) {
    return new Promise(function (resolver, rechazar) {
        const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true,
            info: { Title: 'Pedido ' + numeroPedido(pedido), Author: pedido.nombre_centro } });
        const trozos = [];
        doc.on('data', function (t) { trozos.push(t); });
        doc.on('end', function () { resolver(Buffer.concat(trozos)); });
        doc.on('error', rechazar);

        // --- Recuadro 1: facturación (sociedad) -----------------------
        caja(doc, 40, 40, 190, 92);
        doc.font('Helvetica-Bold').fontSize(8.5).text('Este pedido lo tiene que facturar a:', 45, 45, { width: 180 });
        doc.font('Helvetica').fontSize(8).text(
            juntar([
                pedido.sociedad_razon_social,
                'CIF: ' + pedido.sociedad_cif,
                pedido.dir_fiscal,
                pedido.cp_fiscal + ' ' + pedido.localidad_fiscal + ' (' + pedido.provincia_fiscal + ')'
            ], '\n'), 45, 60, { width: 180, lineGap: 2 });

        // --- Recuadro 2: dirección de entrega (centro) ----------------
        caja(doc, 235, 40, 160, 92);
        doc.font('Helvetica-Bold').fontSize(8.5).text('DIRECCIÓN DE ENTREGA', 240, 45, { width: 150 });
        doc.font('Helvetica-Bold').fontSize(8).text(pedido.nombre_centro, 240, 60, { width: 150 });
        doc.font('Helvetica').fontSize(8).text(
            juntar([
                pedido.dir_entrega,
                pedido.cp_entrega + ' ' + pedido.localidad_entrega + ' (' + pedido.provincia_entrega + ')',
                'Tlf: ' + juntar([pedido.telefono_1, pedido.telefono_2], ' / ')
            ], '\n'), 240, doc.y + 2, { width: 150, lineGap: 2 });

        // --- Recuadro 3: proveedor -----------------------------------
        caja(doc, 400, 40, 155, 120);
        doc.font('Helvetica-Oblique').fontSize(8.5).text(
            juntar([
                pedido.proveedor_razon_social,
                '',
                pedido.proveedor_cif,
                pedido.proveedor_direccion,
                juntar([pedido.proveedor_cp, pedido.proveedor_localidad], ' '),
                pedido.proveedor_provincia,
                '',
                pedido.proveedor_telefono ? 'TELF: ' + pedido.proveedor_telefono : ''
            ].map(function (t) { return t === '' ? ' ' : t; }), '\n'),
            406, 47, { width: 145, lineGap: 1.5 });

        // --- "Este pedido es para" -----------------------------------
        doc.font('Helvetica').fontSize(8.5).text('Este pedido es para:', 40, 140);
        if (pedido.responsable) {
            doc.fontSize(7).text('Para cualquier duda pregunte por ' + pedido.responsable, 130, 141, { width: 265 });
        }
        doc.font('Helvetica-Bold').fontSize(11).text(pedido.nombre_centro.toUpperCase(), 40, 154, { width: 355 });

        // --- Fila de datos del pedido --------------------------------
        const yDatos = 172;
        caja(doc, 40, yDatos, 355, 40);
        doc.moveTo(40, yDatos + 16).lineTo(395, yDatos + 16).stroke();
        const celdas = [
            ['FECHA', 40, 70, fechaES(pedido.fecha_envio || new Date())],
            ['NÚMERO', 110, 85, numeroPedido(pedido)],
            ['Nº PROVEEDOR', 195, 75, String(pedido.proveedor_codigo)],
            ['', 270, 125, '** PEDIDO COMPRA **']
        ];
        for (const c of celdas) {
            if (c[1] > 40) {
                doc.moveTo(c[1], yDatos).lineTo(c[1], yDatos + 40).stroke();
            }
            doc.font('Helvetica-Bold').fontSize(7).text(c[0], c[1], yDatos + 5, { width: c[2], align: 'center' });
            doc.font('Helvetica').fontSize(8.5).text(c[3], c[1], yDatos + 24, { width: c[2], align: 'center' });
        }
        doc.font('Helvetica-Bold').fontSize(8.5).text('FECHA DE ENTREGA:', 405, 172);
        doc.font('Helvetica').fontSize(9).text(fechaES(pedido.fecha_entrega), 405, 185);

        let y = yDatos + 46;
        if (pedido.observaciones_entrega) {
            doc.font('Helvetica-Oblique').fontSize(7.5).text('Entrega: ' + pedido.observaciones_entrega, 40, y, { width: 515 });
            y = doc.y + 4;
        }

        // --- Líneas --------------------------------------------------
        y = cabeceraTabla(doc, y);
        let total = 0;

        for (const l of pedido.lineas) {
            const cantidad = Number(l.cantidad_compra);
            const importe = cantidad * Number(l.precio_coste);
            total += importe;

            doc.font('Helvetica').fontSize(8);
            const alto = Math.max(11, doc.heightOfString(l.descripcion_articulo, { width: COLUMNAS[3][2] }));
            const altoObs = l.observaciones_compra
                ? doc.fontSize(7).heightOfString(l.observaciones_compra, { width: 300 }) + 2 : 0;

            if (y + alto + altoObs > MARGEN_INFERIOR - 20) {
                doc.addPage();
                y = cabeceraTabla(doc, 40);
            }

            const valores = [
                l.referencia_proveedor,
                String(l.articulo_codigo),
                numeroES(cantidad, 2),
                l.descripcion_articulo,
                conPrecios ? numeroES(l.precio_tarifa, 4) : '',
                conPrecios && Number(l.descuento) !== 0 ? numeroES(l.descuento, 2) : '',
                conPrecios ? numeroES(importe, 2) + ' €' : ''
            ];
            doc.font('Helvetica').fontSize(8);
            COLUMNAS.forEach(function (c, i) {
                doc.text(valores[i], c[1] + 3, y, { width: c[2] - 6, align: c[3] });
            });
            y += alto + 2;

            if (l.observaciones_compra) {
                doc.font('Helvetica-Oblique').fontSize(7).text(l.observaciones_compra, COLUMNAS[3][1], y, { width: 300 });
                y += altoObs;
            }
        }

        if (conPrecios) {
            doc.lineWidth(0.5).moveTo(400, y + 2).lineTo(555, y + 2).stroke();
            doc.font('Helvetica-Bold').fontSize(8.5)
                .text('TOTAL (sin IVA): ' + numeroES(total, 2) + ' €', 300, y + 6, { width: 255, align: 'right' });
            y += 22;
        }

        // --- Pie: observaciones generales + del centro ---------------
        const pie = juntar([pedido.observaciones_generales, pedido.observaciones_pedido], '\n');
        if (pie.trim() !== '') {
            doc.font('Helvetica').fontSize(6.5);
            const altoPie = doc.heightOfString(pie, { width: 515 }) + 14;
            let yPie = MARGEN_INFERIOR - altoPie;
            if (yPie < y + 10) {
                doc.addPage();
                yPie = MARGEN_INFERIOR - altoPie;
            }
            doc.font('Helvetica-Bold').fontSize(7).text('OBSERVACIONES PARA PEDIDOS', 40, yPie);
            doc.font('Helvetica').fontSize(6.5).text(pie, 40, yPie + 11, { width: 515, lineGap: 1 });
        }

        // --- Numeración de páginas -----------------------------------
        const paginas = doc.bufferedPageRange();
        for (let i = 0; i < paginas.count; i++) {
            doc.switchToPage(i);
            doc.page.margins.bottom = 0; // si no, escribir tan abajo crea otra página
            doc.font('Helvetica').fontSize(7).text(
                'Pedido ' + numeroPedido(pedido) + ' · Página ' + (i + 1) + ' de ' + paginas.count,
                40, 805, { width: 515, align: 'right', lineBreak: false });
        }

        doc.end();
    });
}


// =====================================================================
// XML para el ERP (formato DATAPACKET)
// =====================================================================

function atributo(valor, ancho) {
    let texto = valor === null || valor === undefined ? '' : String(valor);
    if (ancho) {
        texto = texto.substring(0, ancho);
    }
    return texto.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function unidades(valor) {
    const n = Number(valor);
    return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

const CABECERA_XML =
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<DATAPACKET>\n' +
    '<METADATA>\n' +
    '<FIELDS>\n' +
    '<FIELD attrname="FECHAENTREGA" fieldtype="dateTime" WIDTH="0" />\n' +
    '<FIELD attrname="CODARTICULO" fieldtype="i4" WIDTH="0" />\n' +
    '<FIELD attrname="CODPROVEEDOR" fieldtype="i4" WIDTH="0" />\n' +
    '<FIELD attrname="NUMPEDIDO" fieldtype="i4" WIDTH="0" />\n' +
    '<FIELD attrname="UNIDADESTOTAL" fieldtype="r8" WIDTH="0" />\n' +
    '<FIELD attrname="CODALMACEN" fieldtype="string.uni" WIDTH="3" />\n' +
    '<FIELD attrname="NUMSERIE" fieldtype="string.uni" WIDTH="8" />\n' +
    '<FIELD attrname="COLOR" fieldtype="string.uni" WIDTH="20" />\n' +
    '<FIELD attrname="TALLA" fieldtype="string.uni" WIDTH="20" />\n' +
    '<FIELD attrname="REFERENCIA" fieldtype="string.uni" WIDTH="30" />\n' +
    '<FIELD attrname="CODBARRAS" fieldtype="string.uni" WIDTH="100" />\n' +
    '<FIELD attrname="CODBARRAS2" fieldtype="string.uni" WIDTH="100" />\n' +
    '<FIELD attrname="CODBARRAS3" fieldtype="string.uni" WIDTH="100" />\n' +
    '<FIELD attrname="NOMBREALMACEN" fieldtype="string.uni" WIDTH="100" />\n' +
    '</FIELDS>\n' +
    '</METADATA>\n';


function generarXml(pedido) {
    const filas = pedido.lineas.map(function (l) {
        return '<ROW' +
            ' NUMSERIE="' + atributo(pedido.serie_pedido, 8) + '"' +
            ' NUMPEDIDO="' + pedido.numero_pedido + '"' +
            ' REFERENCIA="' + atributo(l.referencia_proveedor, 30) + '"' +
            ' CODARTICULO="' + l.articulo_codigo + '"' +
            ' TALLA="." COLOR="."' +
            ' UNIDADESTOTAL="' + unidades(l.cantidad_compra) + '"' +
            ' CODPROVEEDOR="' + pedido.proveedor_codigo + '"' +
            ' FECHAENTREGA="' + fechaES(pedido.fecha_entrega) + '"' +
            ' CODALMACEN="' + atributo(pedido.numero_almacen, 3) + '"' +
            ' NOMBREALMACEN="' + atributo(pedido.nombre_centro, 100) + '"' +
            ' />';
    });

    return {
        nombre: pedido.serie_pedido + '_' + pedido.numero_pedido + '.xml',
        contenido: CABECERA_XML + '<ROWDATA>\n' + filas.join('\n') + '\n</ROWDATA>\n</DATAPACKET>\n'
    };
}


module.exports = { leerPedidoCompleto, generarPdf, generarXml, numeroPedido, fechaES };
