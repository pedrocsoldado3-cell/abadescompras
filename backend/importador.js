// =====================================================================
// ARCHIVO: importador.js
// Carga de datos desde archivos (CSV, Excel o XML) en proveedores,
// artículos y tarifas.
//
//   leerArchivo(formato, buffer, opciones) -> { columnas, filas, opciones }
//       Convierte cualquier archivo en una tabla: una lista de columnas
//       y una lista de filas { columna: texto }.
//   procesar(cliente, destino, filas, mapeo, aplicar) -> resultado
//       Comprueba cada fila con el mapeo (campo -> columna) y, si
//       aplicar es true y no hay errores, guarda todo de una vez.
//
// Reglas de la carga:
//   - Cada registro se identifica por su código del ERP: si ya existe se
//     ACTUALIZA, si no se da de ALTA.
//   - Una celda vacía en un campo no obligatorio no borra el valor que
//     ya hubiera (solo se escribe lo que trae el archivo).
//   - Todo o nada: si alguna fila tiene errores no se guarda ninguna.
// =====================================================================

const ExcelJS = require('exceljs');
const { parse: parseCsv } = require('csv-parse/sync');
const { XMLParser } = require('fast-xml-parser');


// ---------------------------------------------------------------------
// Campos que se pueden cargar en cada destino.
//   tipo: texto | entero | decimal | email
//   max:  longitud máxima (texto) o valor máximo (decimal)
// ---------------------------------------------------------------------
const DESTINOS = {
    PROVEEDORES: {
        nombre: 'Proveedores',
        campos: [
            { campo: 'codigo_erp', etiqueta: 'Código ERP del proveedor', tipo: 'entero', obligatorio: true },
            { campo: 'nombre_proveedor', etiqueta: 'Nombre comercial', tipo: 'texto', max: 100, obligatorio: true },
            { campo: 'razon_social', etiqueta: 'Razón social', tipo: 'texto', max: 150, obligatorio: true },
            { campo: 'cif', etiqueta: 'CIF', tipo: 'texto', max: 15, obligatorio: true },
            { campo: 'email_proveedor', etiqueta: 'Email de pedidos', tipo: 'email', max: 120, obligatorio: true },
            { campo: 'direccion', etiqueta: 'Dirección', tipo: 'texto', max: 150 },
            { campo: 'cod_postal', etiqueta: 'Código postal', tipo: 'texto', max: 10 },
            { campo: 'localidad', etiqueta: 'Localidad', tipo: 'texto', max: 80 },
            { campo: 'provincia', etiqueta: 'Provincia', tipo: 'texto', max: 50 },
            { campo: 'telefono', etiqueta: 'Teléfono', tipo: 'texto', max: 20 }
        ]
    },
    ARTICULOS: {
        nombre: 'Artículos',
        campos: [
            { campo: 'codigo_erp', etiqueta: 'Código ERP del artículo', tipo: 'entero', obligatorio: true },
            { campo: 'descripcion_articulo', etiqueta: 'Descripción', tipo: 'texto', max: 150, obligatorio: true },
            { campo: 'iva', etiqueta: 'IVA (%)', tipo: 'decimal', max: 99.99, obligatorio: true },
            { campo: 'ean', etiqueta: 'EAN (código de barras)', tipo: 'texto', max: 20 }
        ]
    },
    TARIFAS: {
        nombre: 'Tarifas',
        campos: [
            { campo: 'codigo_erp_proveedor', etiqueta: 'Código ERP del proveedor', tipo: 'entero', obligatorio: true },
            { campo: 'codigo_erp_articulo', etiqueta: 'Código ERP del artículo', tipo: 'entero', obligatorio: true },
            { campo: 'referencia_proveedor', etiqueta: 'Referencia del proveedor', tipo: 'texto', max: 50, obligatorio: true },
            { campo: 'precio', etiqueta: 'Precio', tipo: 'decimal', max: 999999.9999, obligatorio: true },
            { campo: 'descuento', etiqueta: 'Descuento (%)', tipo: 'decimal', max: 100 },
            { campo: 'descripcion_proveedor', etiqueta: 'Descripción del proveedor', tipo: 'texto', max: 150 }
        ]
    }
};

const FORMATOS = ['CSV', 'EXCEL', 'XML'];
const MAX_FILAS = 50000;


// =====================================================================
// LECTURA DE ARCHIVOS
// =====================================================================

// Texto de un archivo: UTF-8 si es válido; si no, Windows-1252/Latin-1
// (lo habitual en los CSV que guarda Excel en español).
function decodificar(buffer) {
    let texto;
    try {
        texto = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch (e) {
        texto = new TextDecoder('windows-1252').decode(buffer);
    }
    return texto.replace(/^﻿/, '');
}

function limpiar(valor) {
    if (valor === null || valor === undefined) {
        return '';
    }
    return String(valor).trim();
}

// Quita columnas sin nombre y filas vacías, y pone nombre único a cada columna.
function tabla(cabecera, filasCrudas) {
    const columnas = [];
    const indices = [];
    cabecera.forEach(function (nombre, i) {
        let n = limpiar(nombre);
        if (!n) {
            return;
        }
        let final = n;
        let k = 2;
        while (columnas.includes(final)) {
            final = n + ' (' + k++ + ')';
        }
        columnas.push(final);
        indices.push(i);
    });
    const filas = [];
    for (const cruda of filasCrudas) {
        const fila = {};
        let vacia = true;
        columnas.forEach(function (col, j) {
            fila[col] = limpiar(cruda[indices[j]]);
            if (fila[col] !== '') {
                vacia = false;
            }
        });
        if (!vacia) {
            filas.push(fila);
        }
    }
    return { columnas: columnas, filas: filas };
}


function leerCsv(buffer, opciones) {
    const texto = decodificar(buffer);
    let separador = opciones.separador;
    if (!separador) {
        // El separador que más aparece en la primera línea.
        const primera = texto.split(/\r?\n/)[0] || '';
        separador = [';', ',', '\t', '|'].sort(function (a, b) {
            return primera.split(b).length - primera.split(a).length;
        })[0];
    }
    const registros = parseCsv(texto, {
        delimiter: separador,
        relax_column_count: true,
        relax_quotes: true,
        skip_empty_lines: true
    });
    if (registros.length === 0) {
        throw new Error('El archivo CSV está vacío');
    }
    const t = tabla(registros[0], registros.slice(1));
    t.opciones = { separador: separador };
    return t;
}


// Valor de una celda de Excel como texto.
function textoCelda(valor) {
    if (valor === null || valor === undefined) {
        return '';
    }
    if (valor instanceof Date) {
        const d = String(valor.getUTCDate()).padStart(2, '0');
        const m = String(valor.getUTCMonth() + 1).padStart(2, '0');
        return d + '/' + m + '/' + valor.getUTCFullYear();
    }
    if (typeof valor === 'object') {
        if (valor.richText) {
            return valor.richText.map(function (r) { return r.text; }).join('');
        }
        if (valor.result !== undefined) {
            return textoCelda(valor.result);
        }
        if (valor.text !== undefined) {
            return textoCelda(valor.text);
        }
        if (valor.error) {
            return '';
        }
        return '';
    }
    return String(valor);
}

async function leerExcel(buffer, opciones) {
    const libro = new ExcelJS.Workbook();
    try {
        await libro.xlsx.load(buffer);
    } catch (e) {
        throw new Error('No se puede leer el Excel. Guárdalo como .xlsx (el formato antiguo .xls no se admite)');
    }
    const hojas = libro.worksheets.map(function (h) { return h.name; });
    if (hojas.length === 0) {
        throw new Error('El Excel no tiene hojas');
    }
    const nombreHoja = hojas.includes(opciones.hoja) ? opciones.hoja : hojas[0];
    const hoja = libro.getWorksheet(nombreHoja);
    const filas = [];
    hoja.eachRow({ includeEmpty: false }, function (fila) {
        // fila.values empieza en el índice 1 (columna A).
        const valores = [];
        for (let c = 1; c <= fila.cellCount; c++) {
            valores.push(textoCelda(fila.getCell(c).value));
        }
        if (valores.some(function (v) { return limpiar(v) !== ''; })) {
            filas.push(valores);
        }
    });
    if (filas.length === 0) {
        throw new Error('La hoja "' + nombreHoja + '" está vacía');
    }
    const t = tabla(filas[0], filas.slice(1));
    t.opciones = { hoja: nombreHoja, hojas: hojas };
    return t;
}


// ---------------------------------------------------------------------
// XML: buscamos los elementos que se repiten (cada uno es una fila).
// Sus columnas son los atributos y los hijos con texto. Por defecto se
// usa el elemento que más se repite; se puede elegir otro.
// ---------------------------------------------------------------------
function leerXml(buffer, opciones) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseTagValue: false,
        parseAttributeValue: false,
        trimValues: true,
        processEntities: true,
        ignoreDeclaration: true,
        ignorePiTags: true,
        isArray: function (nombre, ruta, esHoja, esAtributo) { return !esAtributo; }
    });
    let arbol;
    try {
        arbol = parser.parse(decodificar(buffer));
    } catch (e) {
        throw new Error('El XML no es válido');
    }

    // candidatos[nombre] = lista de elementos con ese nombre que tienen atributos o hijos
    const candidatos = {};
    (function recorrer(nodo) {
        for (const clave of Object.keys(nodo)) {
            if (clave.startsWith('@_') || clave === '#text' || !Array.isArray(nodo[clave])) {
                continue;
            }
            for (const hijo of nodo[clave]) {
                if (hijo && typeof hijo === 'object') {
                    const claves = Object.keys(hijo).filter(function (k) { return k !== '#text'; });
                    if (claves.length > 0) {
                        (candidatos[clave] = candidatos[clave] || []).push(hijo);
                    }
                    recorrer(hijo);
                }
            }
        }
    })(arbol);

    const lista = Object.keys(candidatos)
        .map(function (n) { return { nombre: n, filas: candidatos[n].length }; })
        .sort(function (a, b) { return b.filas - a.filas; });
    if (lista.length === 0) {
        throw new Error('No se han encontrado filas en el XML');
    }
    // En los DATAPACKET del ERP (Delphi) las filas son siempre <ROW>, aunque
    // haya más <FIELD> en la cabecera.
    const porDefecto = candidatos.ROW && candidatos.FIELD ? 'ROW' : lista[0].nombre;
    const elemento = candidatos[opciones.elemento_fila] ? opciones.elemento_fila : porDefecto;

    const cabecera = [];
    const filas = candidatos[elemento].map(function (nodo) {
        const fila = {};
        for (const clave of Object.keys(nodo)) {
            let nombre;
            let valor;
            if (clave.startsWith('@_')) {
                nombre = clave.substring(2);
                valor = nodo[clave];
            } else if (clave === '#text') {
                nombre = elemento;
                valor = Array.isArray(nodo[clave]) ? nodo[clave].join('') : nodo[clave];
            } else {
                // Hijo con solo texto: <NOMBRE>valor</NOMBRE>
                const primero = nodo[clave][0];
                if (primero !== null && typeof primero === 'object') {
                    if (primero['#text'] === undefined) {
                        continue;
                    }
                    valor = primero['#text'];
                } else {
                    valor = primero;
                }
                nombre = clave;
            }
            if (!cabecera.includes(nombre)) {
                cabecera.push(nombre);
            }
            fila[nombre] = valor;
        }
        return fila;
    });
    const t = tabla(cabecera, filas.map(function (f) { return cabecera.map(function (c) { return f[c]; }); }));
    t.opciones = { elemento_fila: elemento, elementos: lista };
    return t;
}


async function leerArchivo(formato, buffer, opciones) {
    opciones = opciones || {};
    let t;
    if (formato === 'CSV') {
        t = leerCsv(buffer, opciones);
    } else if (formato === 'EXCEL') {
        t = await leerExcel(buffer, opciones);
    } else if (formato === 'XML') {
        t = leerXml(buffer, opciones);
    } else {
        throw new Error('Formato no admitido');
    }
    if (t.columnas.length === 0) {
        throw new Error('No se han encontrado columnas en el archivo');
    }
    if (t.filas.length > MAX_FILAS) {
        throw new Error('El archivo tiene más de ' + MAX_FILAS + ' filas. Divídelo en varios');
    }
    return t;
}


// =====================================================================
// COMPROBACIÓN DE VALORES
// =====================================================================

function aEntero(texto) {
    if (!/^\d+([.,]0+)?$/.test(texto)) {
        return null;
    }
    const n = parseInt(texto, 10);
    return n > 2147483647 ? null : n;
}

// Acepta 1234.56, 1234,56, 1.234,56 y 1,234.56 (y el símbolo % o €).
function aDecimal(texto) {
    let t = texto.replace(/[\s€%]/g, '');
    const coma = t.lastIndexOf(',');
    const punto = t.lastIndexOf('.');
    if (coma > punto) {
        t = t.replace(/\./g, '').replace(',', '.');
    } else if (punto > coma && coma !== -1) {
        t = t.replace(/,/g, '');
    }
    if (!/^-?\d+(\.\d+)?$/.test(t)) {
        return null;
    }
    return Number(t);
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Convierte una fila del archivo en un registro { campo: valor } o da errores.
function convertir(fila, campos, mapeo) {
    const registro = {};
    const errores = [];
    for (const def of campos) {
        const columna = mapeo[def.campo];
        const texto = columna ? limpiar(fila[columna]) : '';
        if (texto === '') {
            if (def.obligatorio) {
                errores.push(def.etiqueta + ' está vacío');
            }
            registro[def.campo] = null;
            continue;
        }
        let valor = texto;
        if (def.tipo === 'entero') {
            valor = aEntero(texto);
            if (valor === null) {
                errores.push(def.etiqueta + ' no es un número entero: "' + texto + '"');
            }
        } else if (def.tipo === 'decimal') {
            valor = aDecimal(texto);
            if (valor === null) {
                errores.push(def.etiqueta + ' no es un número: "' + texto + '"');
            } else if (valor < 0 || valor > def.max) {
                errores.push(def.etiqueta + ' fuera de rango: ' + texto);
            }
        } else {
            if (texto.length > def.max) {
                errores.push(def.etiqueta + ' pasa de ' + def.max + ' caracteres');
            }
            if (def.tipo === 'email' && !RE_EMAIL.test(texto)) {
                errores.push(def.etiqueta + ' no es un email válido: "' + texto + '"');
            }
        }
        registro[def.campo] = valor;
    }
    return { registro: registro, errores: errores };
}


// =====================================================================
// PROCESO POR DESTINO
// Cada uno comprueba duplicados y referencias contra la base de datos
// (que se lee una sola vez) y, si se pide, guarda todo con una única
// sentencia INSERT ... ON CONFLICT DO UPDATE.
// =====================================================================

async function mapa(cliente, sql) {
    const r = await cliente.query(sql);
    const m = new Map();
    for (const f of r.rows) {
        m.set(f.clave, f.valor);
    }
    return m;
}

// Recorre las filas: convierte, comprueba y anota ALTA / ACTUALIZAR / ERROR.
function recorrerFilas(filas, campos, mapeo, comprobar) {
    const resultado = [];
    filas.forEach(function (fila, i) {
        const c = convertir(fila, campos, mapeo);
        if (c.errores.length === 0) {
            comprobar(c.registro, c.errores);
        }
        resultado.push({
            fila: i + 2,   // +1 por empezar en 0 y +1 por la cabecera
            registro: c.registro,
            errores: c.errores,
            accion: c.errores.length > 0 ? 'ERROR' : c.registro._accion
        });
    });
    return resultado;
}


async function procesarProveedores(cliente, filas, mapeo, aplicar) {
    const campos = DESTINOS.PROVEEDORES.campos;
    const existentes = await mapa(cliente, 'SELECT codigo_erp AS clave, id_proveedor AS valor FROM proveedores');
    const cifs = await mapa(cliente, 'SELECT UPPER(cif) AS clave, codigo_erp AS valor FROM proveedores');
    const vistos = new Set();
    const cifsArchivo = new Map();

    const res = recorrerFilas(filas, campos, mapeo, function (r, errores) {
        r.cif = r.cif.toUpperCase();
        if (vistos.has(r.codigo_erp)) {
            errores.push('El código ERP ' + r.codigo_erp + ' está repetido en el archivo');
        }
        vistos.add(r.codigo_erp);
        const otro = cifsArchivo.has(r.cif) ? cifsArchivo.get(r.cif) : cifs.get(r.cif);
        if (otro !== undefined && otro !== r.codigo_erp) {
            errores.push('El CIF ' + r.cif + ' ya es del proveedor con código ERP ' + otro);
        }
        cifsArchivo.set(r.cif, r.codigo_erp);
        r._accion = existentes.has(r.codigo_erp) ? 'ACTUALIZAR' : 'ALTA';
    });

    if (aplicar) {
        const buenos = res.map(function (x) { return x.registro; });
        const col = function (c) { return buenos.map(function (r) { return r[c]; }); };
        await cliente.query(
            `INSERT INTO proveedores (codigo_erp, nombre_proveedor, razon_social, cif, email_proveedor,
                                      direccion, cod_postal, localidad, provincia, telefono)
             SELECT * FROM UNNEST($1::int[], $2::text[], $3::text[], $4::text[], $5::text[],
                                  $6::text[], $7::text[], $8::text[], $9::text[], $10::text[])
             ON CONFLICT (codigo_erp) DO UPDATE SET
                nombre_proveedor = EXCLUDED.nombre_proveedor,
                razon_social     = EXCLUDED.razon_social,
                cif              = EXCLUDED.cif,
                email_proveedor  = EXCLUDED.email_proveedor,
                direccion        = COALESCE(EXCLUDED.direccion,  proveedores.direccion),
                cod_postal       = COALESCE(EXCLUDED.cod_postal, proveedores.cod_postal),
                localidad        = COALESCE(EXCLUDED.localidad,  proveedores.localidad),
                provincia        = COALESCE(EXCLUDED.provincia,  proveedores.provincia),
                telefono         = COALESCE(EXCLUDED.telefono,   proveedores.telefono)`,
            ['codigo_erp', 'nombre_proveedor', 'razon_social', 'cif', 'email_proveedor',
                'direccion', 'cod_postal', 'localidad', 'provincia', 'telefono'].map(col)
        );
    }
    return res;
}


async function procesarArticulos(cliente, filas, mapeo, aplicar) {
    const campos = DESTINOS.ARTICULOS.campos;
    const existentes = await mapa(cliente, 'SELECT codigo_erp AS clave, id_articulo AS valor FROM articulos');
    const eans = await mapa(cliente, 'SELECT ean AS clave, codigo_erp AS valor FROM articulos WHERE ean IS NOT NULL');
    const vistos = new Set();
    const eansArchivo = new Map();

    const res = recorrerFilas(filas, campos, mapeo, function (r, errores) {
        if (vistos.has(r.codigo_erp)) {
            errores.push('El código ERP ' + r.codigo_erp + ' está repetido en el archivo');
        }
        vistos.add(r.codigo_erp);
        if (r.ean !== null) {
            const otro = eansArchivo.has(r.ean) ? eansArchivo.get(r.ean) : eans.get(r.ean);
            if (otro !== undefined && otro !== r.codigo_erp) {
                errores.push('El EAN ' + r.ean + ' ya es del artículo con código ERP ' + otro);
            }
            eansArchivo.set(r.ean, r.codigo_erp);
        }
        r._accion = existentes.has(r.codigo_erp) ? 'ACTUALIZAR' : 'ALTA';
    });

    if (aplicar) {
        const buenos = res.map(function (x) { return x.registro; });
        const col = function (c) { return buenos.map(function (r) { return r[c]; }); };
        await cliente.query(
            `INSERT INTO articulos (codigo_erp, descripcion_articulo, iva, ean)
             SELECT * FROM UNNEST($1::int[], $2::text[], $3::numeric[], $4::text[])
             ON CONFLICT (codigo_erp) DO UPDATE SET
                descripcion_articulo = EXCLUDED.descripcion_articulo,
                iva                  = EXCLUDED.iva,
                ean                  = COALESCE(EXCLUDED.ean, articulos.ean)`,
            ['codigo_erp', 'descripcion_articulo', 'iva', 'ean'].map(col)
        );
    }
    return res;
}


async function procesarTarifas(cliente, filas, mapeo, aplicar) {
    const campos = DESTINOS.TARIFAS.campos;
    const proveedores = await mapa(cliente, 'SELECT codigo_erp AS clave, id_proveedor AS valor FROM proveedores');
    const articulos = await mapa(cliente, 'SELECT codigo_erp AS clave, id_articulo AS valor FROM articulos');
    const existentes = await mapa(cliente,
        "SELECT id_proveedor || '-' || id_articulo AS clave, id_articulo_tarificado AS valor FROM articulos_tarificados");
    // Referencia de proveedor -> artículo, para que no se repita en el mismo proveedor.
    const referencias = await mapa(cliente,
        "SELECT id_proveedor || '-' || referencia_proveedor AS clave, id_articulo AS valor FROM articulos_tarificados");
    const vistos = new Set();

    const res = recorrerFilas(filas, campos, mapeo, function (r, errores) {
        r.id_proveedor = proveedores.get(r.codigo_erp_proveedor);
        r.id_articulo = articulos.get(r.codigo_erp_articulo);
        if (r.id_proveedor === undefined) {
            errores.push('No existe el proveedor con código ERP ' + r.codigo_erp_proveedor);
        }
        if (r.id_articulo === undefined) {
            errores.push('No existe el artículo con código ERP ' + r.codigo_erp_articulo);
        }
        if (errores.length > 0) {
            return;
        }
        const clave = r.id_proveedor + '-' + r.id_articulo;
        if (vistos.has(clave)) {
            errores.push('La tarifa del artículo ' + r.codigo_erp_articulo + ' con el proveedor ' + r.codigo_erp_proveedor + ' está repetida en el archivo');
        }
        vistos.add(clave);
        const claveRef = r.id_proveedor + '-' + r.referencia_proveedor;
        const otro = referencias.get(claveRef);
        if (otro !== undefined && otro !== r.id_articulo) {
            errores.push('La referencia ' + r.referencia_proveedor + ' ya la usa otro artículo de este proveedor');
        }
        referencias.set(claveRef, r.id_articulo);
        r._accion = existentes.has(clave) ? 'ACTUALIZAR' : 'ALTA';
    });

    if (aplicar) {
        const buenos = res.map(function (x) { return x.registro; });
        const col = function (c) { return buenos.map(function (r) { return r[c]; }); };
        await cliente.query(
            `INSERT INTO articulos_tarificados (id_proveedor, id_articulo, referencia_proveedor, precio, descuento, descripcion_proveedor)
             SELECT p, a, ref, pre, COALESCE(des, 0), dp
             FROM UNNEST($1::int[], $2::int[], $3::text[], $4::numeric[], $5::numeric[], $6::text[]) AS x(p, a, ref, pre, des, dp)
             ON CONFLICT (id_articulo, id_proveedor) DO UPDATE SET
                referencia_proveedor  = EXCLUDED.referencia_proveedor,
                precio                = EXCLUDED.precio,
                descuento             = CASE WHEN $5::numeric[] IS NULL THEN articulos_tarificados.descuento
                                             ELSE EXCLUDED.descuento END,
                descripcion_proveedor = COALESCE(EXCLUDED.descripcion_proveedor, articulos_tarificados.descripcion_proveedor)`,
            [col('id_proveedor'), col('id_articulo'), col('referencia_proveedor'), col('precio'),
                mapeo.descuento ? col('descuento') : null, col('descripcion_proveedor')]
        );
    }
    return res;
}


// ---------------------------------------------------------------------
// procesar(): punto de entrada. Devuelve un resumen y las filas.
// Si aplicar es true y hay errores, no guarda nada.
// ---------------------------------------------------------------------
async function procesar(cliente, destino, filas, mapeo, aplicar) {
    const def = DESTINOS[destino];
    if (!def) {
        throw new Error('Destino no válido');
    }
    for (const c of def.campos) {
        if (c.obligatorio && !mapeo[c.campo]) {
            throw new Error('Falta indicar la columna de "' + c.etiqueta + '"');
        }
    }
    const funciones = { PROVEEDORES: procesarProveedores, ARTICULOS: procesarArticulos, TARIFAS: procesarTarifas };

    // Primero solo comprobamos; si se pide guardar y no hay errores,
    // se vuelve a pasar guardando.
    const filasRes = await funciones[destino](cliente, filas, mapeo, false);
    const resumen = { total: filasRes.length, altas: 0, actualizaciones: 0, errores: 0 };
    for (const f of filasRes) {
        if (f.accion === 'ALTA') resumen.altas++;
        else if (f.accion === 'ACTUALIZAR') resumen.actualizaciones++;
        else resumen.errores++;
    }
    let guardado = false;
    if (aplicar && resumen.errores === 0 && resumen.total > 0) {
        await funciones[destino](cliente, filas, mapeo, true);
        guardado = true;
    }
    return {
        resumen: resumen,
        guardado: guardado,
        filas: filasRes.map(function (f) {
            const registro = {};
            for (const c of def.campos) {
                registro[c.campo] = f.registro[c.campo];
            }
            return { fila: f.fila, accion: f.accion, errores: f.errores, registro: registro };
        })
    };
}


module.exports = { DESTINOS, FORMATOS, leerArchivo, procesar };
