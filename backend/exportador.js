// =====================================================================
// ARCHIVO: exportador.js
// Descarga de pedidos con una plantilla de exportación (CSV, Excel o
// XML) con las columnas que elija el administrador. Cada línea de
// pedido es una fila del archivo.
//
//   CAMPOS                       -> columnas disponibles
//   validarPlantilla(body)       -> datos limpios o lanza un Error
//   generarArchivos(plantilla, pedidos) -> [{ nombre, contenido }]
//       Un solo archivo con todos los pedidos, o uno por pedido,
//       según opciones.agrupar.
// =====================================================================

const ExcelJS = require('exceljs');
const { numeroPedido } = require('./documentos');


// ---------------------------------------------------------------------
// Columnas disponibles. tipo: texto | entero | decimal | fecha
// valor(pedido, linea, indice) devuelve el dato.
// ---------------------------------------------------------------------
const CAMPOS = [
    { campo: 'serie', etiqueta: 'Serie del pedido', tipo: 'texto', valor: function (p) { return p.serie_pedido; } },
    { campo: 'numero_pedido', etiqueta: 'Número de pedido', tipo: 'entero', valor: function (p) { return p.numero_pedido; } },
    { campo: 'pedido_completo', etiqueta: 'Serie-número (3A-202600001)', tipo: 'texto', valor: function (p) { return numeroPedido(p); } },
    { campo: 'fecha_pedido', etiqueta: 'Fecha del pedido', tipo: 'fecha', valor: function (p) { return p.fecha_creacion; } },
    { campo: 'fecha_envio', etiqueta: 'Fecha de envío', tipo: 'fecha', valor: function (p) { return p.fecha_envio; } },
    { campo: 'fecha_entrega', etiqueta: 'Fecha de entrega', tipo: 'fecha', valor: function (p) { return p.fecha_entrega; } },
    { campo: 'centro', etiqueta: 'Centro (nombre)', tipo: 'texto', valor: function (p) { return p.nombre_centro; } },
    { campo: 'codigo_almacen', etiqueta: 'Código de almacén', tipo: 'texto', valor: function (p) { return p.numero_almacen; } },
    { campo: 'sociedad', etiqueta: 'Sociedad (razón social)', tipo: 'texto', valor: function (p) { return p.sociedad_razon_social; } },
    { campo: 'sociedad_cif', etiqueta: 'CIF de la sociedad', tipo: 'texto', valor: function (p) { return p.sociedad_cif; } },
    { campo: 'proveedor_codigo', etiqueta: 'Código ERP del proveedor', tipo: 'entero', valor: function (p) { return p.proveedor_codigo; } },
    { campo: 'proveedor_nombre', etiqueta: 'Proveedor (nombre)', tipo: 'texto', valor: function (p) { return p.nombre_proveedor; } },
    { campo: 'proveedor_cif', etiqueta: 'CIF del proveedor', tipo: 'texto', valor: function (p) { return p.proveedor_cif; } },
    { campo: 'proveedor_email', etiqueta: 'Email del proveedor', tipo: 'texto', valor: function (p) { return p.email_proveedor; } },
    { campo: 'linea', etiqueta: 'Nº de línea', tipo: 'entero', valor: function (p, l, i) { return i + 1; } },
    { campo: 'articulo_codigo', etiqueta: 'Código ERP del artículo', tipo: 'entero', valor: function (p, l) { return l.articulo_codigo; } },
    { campo: 'referencia_proveedor', etiqueta: 'Referencia del proveedor', tipo: 'texto', valor: function (p, l) { return l.referencia_proveedor; } },
    { campo: 'descripcion', etiqueta: 'Descripción del artículo', tipo: 'texto', valor: function (p, l) { return l.descripcion_articulo; } },
    { campo: 'unidades', etiqueta: 'Unidades', tipo: 'decimal', valor: function (p, l) { return l.cantidad_compra; } },
    { campo: 'precio_tarifa', etiqueta: 'Precio de tarifa', tipo: 'decimal', valor: function (p, l) { return l.precio_tarifa; } },
    { campo: 'descuento', etiqueta: 'Descuento (%)', tipo: 'decimal', valor: function (p, l) { return l.descuento; } },
    { campo: 'precio_neto', etiqueta: 'Precio neto', tipo: 'decimal', valor: function (p, l) { return l.precio_coste; } },
    { campo: 'importe', etiqueta: 'Importe (unidades × neto)', tipo: 'decimal', valor: function (p, l) { return l.precio_coste === null ? null : Math.round(Number(l.cantidad_compra) * Number(l.precio_coste) * 100) / 100; } },
    { campo: 'observaciones_linea', etiqueta: 'Observaciones de la línea', tipo: 'texto', valor: function (p, l) { return l.observaciones_compra; } }
];
const POR_CAMPO = {};
for (const c of CAMPOS) {
    POR_CAMPO[c.campo] = c;
}

const FORMATOS = ['CSV', 'EXCEL', 'XML'];
const SEPARADORES = [';', ',', '\t', '|'];
const FECHAS = ['DD/MM/AAAA', 'AAAA-MM-DD', 'DD-MM-AAAA', 'DDMMAAAA', 'AAAAMMDD'];
const RE_NOMBRE_XML = /^[A-Za-z_][A-Za-z0-9_.-]{0,49}$/;


// ---------------------------------------------------------------------
// Comprueba y limpia una plantilla enviada desde el formulario.
// ---------------------------------------------------------------------
function validarPlantilla(body) {
    const nombre = String(body.nombre_plantilla || '').trim();
    if (!nombre || nombre.length > 100) {
        throw new Error('El nombre de la plantilla es obligatorio (máximo 100 caracteres)');
    }
    if (!FORMATOS.includes(body.formato)) {
        throw new Error('Formato no válido');
    }
    const lista = Array.isArray(body.columnas) ? body.columnas : [];
    if (lista.length === 0) {
        throw new Error('Añade al menos una columna');
    }
    if (lista.length > 60) {
        throw new Error('Demasiadas columnas');
    }
    const columnas = lista.map(function (c) {
        if (!c || !POR_CAMPO[c.campo]) {
            throw new Error('Hay una columna sin dato elegido');
        }
        const titulo = String(c.titulo || '').trim() || c.campo.toUpperCase();
        if (titulo.length > 50) {
            throw new Error('El nombre de columna "' + titulo + '" pasa de 50 caracteres');
        }
        if (body.formato === 'XML' && !RE_NOMBRE_XML.test(titulo)) {
            throw new Error('En XML el nombre de columna "' + titulo + '" solo puede llevar letras sin tilde, números, _ . o - y no empezar por número');
        }
        return { campo: c.campo, titulo: titulo };
    });

    const o = body.opciones && typeof body.opciones === 'object' ? body.opciones : {};
    const opciones = {
        separador: SEPARADORES.includes(o.separador) ? o.separador : ';',
        decimal: o.decimal === '.' ? '.' : ',',
        fecha: FECHAS.includes(o.fecha) ? o.fecha : 'DD/MM/AAAA',
        agrupar: o.agrupar === 'PEDIDO' ? 'PEDIDO' : 'UNO',
        cabecera: o.cabecera !== false,
        elemento_raiz: 'PEDIDOS',
        elemento_fila: 'LINEA',
        estilo_xml: o.estilo_xml === 'ATRIBUTOS' ? 'ATRIBUTOS' : 'ELEMENTOS'
    };
    for (const k of ['elemento_raiz', 'elemento_fila']) {
        const v = String(o[k] || '').trim();
        if (v) {
            if (!RE_NOMBRE_XML.test(v)) {
                throw new Error('El nombre del elemento XML "' + v + '" no es válido');
            }
            opciones[k] = v;
        }
    }
    return {
        nombre_plantilla: nombre,
        formato: body.formato,
        columnas: columnas,
        opciones: opciones,
        marcar_exportado: body.marcar_exportado !== false
    };
}


// ---------------------------------------------------------------------
// Formato de cada valor como texto (CSV y XML).
// ---------------------------------------------------------------------
function textoFecha(valor, formato) {
    if (!valor) {
        return '';
    }
    const d = valor instanceof Date ? valor : new Date(valor);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const aaaa = String(d.getFullYear());
    return formato.replace('DD', dd).replace('MM', mm).replace('AAAA', aaaa);
}

function texto(def, valor, opciones) {
    if (valor === null || valor === undefined) {
        return '';
    }
    if (def.tipo === 'fecha') {
        return textoFecha(valor, opciones.fecha);
    }
    if (def.tipo === 'decimal') {
        // Sin ceros de sobra: 480 -> "480", 1.2500 -> "1,25"
        const s = String(Number(valor));
        return opciones.decimal === ',' ? s.replace('.', ',') : s;
    }
    return String(valor);
}

// Filas [ [valor, valor...], ... ] de una lista de pedidos.
function filas(plantilla, pedidos) {
    const resultado = [];
    for (const p of pedidos) {
        p.lineas.forEach(function (l, i) {
            resultado.push(plantilla.columnas.map(function (c) {
                return { def: POR_CAMPO[c.campo], valor: POR_CAMPO[c.campo].valor(p, l, i) };
            }));
        });
    }
    return resultado;
}


function generarCsv(plantilla, pedidos) {
    const o = plantilla.opciones;
    const escapar = function (t) {
        return /["\r\n]/.test(t) || t.includes(o.separador) ? '"' + t.replace(/"/g, '""') + '"' : t;
    };
    const lineas = [];
    if (o.cabecera !== false) {
        lineas.push(plantilla.columnas.map(function (c) { return escapar(c.titulo); }).join(o.separador));
    }
    for (const fila of filas(plantilla, pedidos)) {
        lineas.push(fila.map(function (x) { return escapar(texto(x.def, x.valor, o)); }).join(o.separador));
    }
    // BOM para que Excel abra bien las tildes.
    return '﻿' + lineas.join('\r\n') + '\r\n';
}


async function generarExcel(plantilla, pedidos) {
    const o = plantilla.opciones;
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Pedidos');
    if (o.cabecera !== false) {
        const cab = hoja.addRow(plantilla.columnas.map(function (c) { return c.titulo; }));
        cab.font = { bold: true };
    }
    for (const fila of filas(plantilla, pedidos)) {
        // Números como números (Excel los suma); fechas como texto con el formato elegido.
        hoja.addRow(fila.map(function (x) {
            if (x.valor === null || x.valor === undefined) return null;
            if (x.def.tipo === 'entero' || x.def.tipo === 'decimal') return Number(x.valor);
            return texto(x.def, x.valor, o);
        }));
    }
    plantilla.columnas.forEach(function (c, i) {
        hoja.getColumn(i + 1).width = Math.min(40, Math.max(10, c.titulo.length + 2));
    });
    return Buffer.from(await libro.xlsx.writeBuffer());
}


function escaparXml(t) {
    return t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generarXmlGenerico(plantilla, pedidos) {
    const o = plantilla.opciones;
    const salida = ['<?xml version="1.0" encoding="utf-8"?>', '<' + o.elemento_raiz + '>'];
    for (const fila of filas(plantilla, pedidos)) {
        if (o.estilo_xml === 'ATRIBUTOS') {
            salida.push('  <' + o.elemento_fila + fila.map(function (x, i) {
                return ' ' + plantilla.columnas[i].titulo + '="' + escaparXml(texto(x.def, x.valor, o)) + '"';
            }).join('') + ' />');
        } else {
            salida.push('  <' + o.elemento_fila + '>');
            fila.forEach(function (x, i) {
                const t = plantilla.columnas[i].titulo;
                salida.push('    <' + t + '>' + escaparXml(texto(x.def, x.valor, o)) + '</' + t + '>');
            });
            salida.push('  </' + o.elemento_fila + '>');
        }
    }
    salida.push('</' + o.elemento_raiz + '>');
    return salida.join('\n') + '\n';
}


const EXTENSION = { CSV: 'csv', EXCEL: 'xlsx', XML: 'xml' };

async function generarUno(plantilla, pedidos) {
    if (plantilla.formato === 'CSV') return generarCsv(plantilla, pedidos);
    if (plantilla.formato === 'EXCEL') return generarExcel(plantilla, pedidos);
    return generarXmlGenerico(plantilla, pedidos);
}

// Nombre de archivo seguro a partir del nombre de la plantilla.
function nombreSeguro(texto) {
    return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 50) || 'pedidos';
}

async function generarArchivos(plantilla, pedidos, sello) {
    const ext = EXTENSION[plantilla.formato];
    if (plantilla.opciones.agrupar === 'PEDIDO') {
        const archivos = [];
        for (const p of pedidos) {
            archivos.push({ nombre: p.serie_pedido + '_' + p.numero_pedido + '.' + ext, contenido: await generarUno(plantilla, [p]) });
        }
        return archivos;
    }
    return [{ nombre: nombreSeguro(plantilla.nombre_plantilla) + '_' + sello + '.' + ext, contenido: await generarUno(plantilla, pedidos) }];
}


module.exports = {
    CAMPOS: CAMPOS.map(function (c) { return { campo: c.campo, etiqueta: c.etiqueta }; }),
    FORMATOS, SEPARADORES, FECHAS, validarPlantilla, generarArchivos, nombreSeguro
};
