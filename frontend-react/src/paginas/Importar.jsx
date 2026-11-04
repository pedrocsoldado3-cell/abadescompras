// =====================================================================
// ARCHIVO: src/paginas/Importar.jsx
// Carga de proveedores, artículos y tarifas desde un archivo (CSV,
// Excel o XML). Solo ADMIN.
//   1. Qué se carga (o una plantilla guardada)
//   2. El archivo (y cómo leerlo: separador, hoja, elemento de fila)
//   3. Qué columna del archivo va a cada campo
//   4. Comprobar (no guarda nada) e Importar (todo o nada)
// La plantilla guarda los pasos 1 a 3 para la próxima vez.
// =====================================================================

import { useState, useEffect } from 'react';
import { useApp } from '../contexto/AppContext.jsx';
import { peticion } from '../servicios/api.js';
import Pagina from '../componentes/Pagina.jsx';
import Mensaje from '../componentes/Mensaje.jsx';
import Estado from '../componentes/Estado.jsx';


const SEPARADORES = [[';', 'Punto y coma ( ; )'], [',', 'Coma ( , )'], ['\t', 'Tabulador'], ['|', 'Barra ( | )']];
const ACEPTA = { CSV: '.csv,.txt', EXCEL: '.xlsx', XML: '.xml' };

// Para emparejar columnas y campos sin tildes, mayúsculas ni signos.
function normalizar(texto) {
    return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function formatoPorExtension(nombre) {
    const ext = nombre.split('.').pop().toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') return 'EXCEL';
    if (ext === 'xml') return 'XML';
    if (ext === 'csv' || ext === 'txt') return 'CSV';
    return null;
}

function leerComoBase64(archivo) {
    return new Promise(function (resolver, rechazar) {
        const lector = new FileReader();
        lector.onload = function () { resolver(String(lector.result).split(',')[1] || ''); };
        lector.onerror = function () { rechazar(new Error('No se ha podido leer el archivo')); };
        lector.readAsDataURL(archivo);
    });
}


export default function Importar() {
    const { t } = useApp();
    const [destinos, setDestinos] = useState({});
    const [plantillas, setPlantillas] = useState([]);
    const [idPlantilla, setIdPlantilla] = useState('');
    const [nombrePlantilla, setNombrePlantilla] = useState('');
    const [destino, setDestino] = useState('PROVEEDORES');
    const [formato, setFormato] = useState('CSV');
    const [opciones, setOpciones] = useState({});
    const [mapeo, setMapeo] = useState({});
    const [archivo, setArchivo] = useState(null);       // { nombre, base64 }
    const [lectura, setLectura] = useState(null);       // { columnas, muestra, total, opciones }
    const [resultado, setResultado] = useState(null);   // respuesta de comprobar
    const [ocupado, setOcupado] = useState(false);
    const [mensaje, setMensaje] = useState(null);

    const campos = destinos[destino] ? destinos[destino].campos : [];


    useEffect(function () {
        peticion('GET', '/importaciones/campos')
            .then(function (d) { setDestinos(d.destinos); })
            .catch(function (error) { setMensaje({ texto: error.message, tipo: 'error' }); });
        cargarPlantillas();
    }, []);

    function cargarPlantillas() {
        return peticion('GET', '/importaciones/plantillas').then(setPlantillas)
            .catch(function (error) { setMensaje({ texto: error.message, tipo: 'error' }); });
    }


    // -----------------------------------------------------------------
    // Leer el archivo en el servidor (columnas y primeras filas).
    // -----------------------------------------------------------------
    async function leer(datosArchivo, fmt, opc) {
        setResultado(null);
        setLectura(null);
        setMensaje(null);
        setOcupado(true);
        try {
            const r = await peticion('POST', '/importaciones/leer', { formato: fmt, archivo: datosArchivo.base64, opciones: opc });
            setLectura(r);
            // Guardamos lo que ha usado el servidor (separador detectado, hoja...).
            const usadas = {};
            if (r.opciones.separador) usadas.separador = r.opciones.separador;
            if (r.opciones.hoja) usadas.hoja = r.opciones.hoja;
            if (r.opciones.elemento_fila) usadas.elemento_fila = r.opciones.elemento_fila;
            setOpciones(usadas);
            emparejar(r.columnas);
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        } finally {
            setOcupado(false);
        }
    }

    // Rellena los campos sin columna con la columna de nombre parecido.
    function emparejar(columnas) {
        setMapeo(function (actual) {
            const nuevo = Object.assign({}, actual);
            for (const c of campos) {
                if (nuevo[c.campo]) {
                    continue;
                }
                const encontrada = columnas.find(function (col) {
                    const n = normalizar(col);
                    return n === normalizar(c.campo) || n === normalizar(c.etiqueta);
                });
                if (encontrada) {
                    nuevo[c.campo] = encontrada;
                }
            }
            return nuevo;
        });
    }

    async function elegirArchivo(e) {
        const fichero = e.target.files[0];
        if (!fichero) {
            return;
        }
        if (fichero.size > 10 * 1024 * 1024) {
            setMensaje({ texto: t('importar_archivo_grande'), tipo: 'error' });
            return;
        }
        let fmt = formato;
        const porExtension = formatoPorExtension(fichero.name);
        if (porExtension && porExtension !== formato) {
            fmt = porExtension;
            setFormato(fmt);
        }
        try {
            const datos = { nombre: fichero.name, base64: await leerComoBase64(fichero) };
            setArchivo(datos);
            leer(datos, fmt, fmt === formato ? opciones : {});
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    function cambiarOpcion(clave, valor) {
        const nuevas = Object.assign({}, opciones, { [clave]: valor });
        setOpciones(nuevas);
        if (archivo) {
            leer(archivo, formato, nuevas);
        }
    }


    // -----------------------------------------------------------------
    // Plantillas
    // -----------------------------------------------------------------
    function elegirPlantilla(id) {
        setIdPlantilla(id);
        setResultado(null);
        const p = plantillas.find(function (x) { return String(x.id_plantilla) === id; });
        if (!p) {
            setNombrePlantilla('');
            return;
        }
        setNombrePlantilla(p.nombre_plantilla);
        setDestino(p.destino);
        setFormato(p.formato);
        setOpciones(p.opciones || {});
        setMapeo(p.mapeo || {});
        setLectura(null);
        setArchivo(null);
    }

    async function guardarPlantilla() {
        setMensaje(null);
        const datos = { nombre_plantilla: nombrePlantilla, destino: destino, formato: formato, opciones: opciones, mapeo: mapeo };
        try {
            let r;
            if (idPlantilla) {
                r = await peticion('PUT', '/importaciones/plantillas/' + idPlantilla, datos);
            } else {
                r = await peticion('POST', '/importaciones/plantillas', datos);
                setIdPlantilla(String(r.id_plantilla));
            }
            setMensaje({ texto: r.mensaje, tipo: 'ok' });
            cargarPlantillas();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    async function eliminarPlantilla() {
        if (!window.confirm(t('confirmar_eliminar_plantilla') + ' "' + nombrePlantilla + '"?')) {
            return;
        }
        try {
            const r = await peticion('DELETE', '/importaciones/plantillas/' + idPlantilla);
            setMensaje({ texto: r.mensaje, tipo: 'ok' });
            setIdPlantilla('');
            setNombrePlantilla('');
            cargarPlantillas();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }


    // -----------------------------------------------------------------
    // Comprobar e importar
    // -----------------------------------------------------------------
    function cuerpo() {
        return { formato: formato, archivo: archivo.base64, opciones: opciones, destino: destino, mapeo: mapeo };
    }

    async function comprobar() {
        setMensaje(null);
        setOcupado(true);
        try {
            setResultado(await peticion('POST', '/importaciones/comprobar', cuerpo()));
        } catch (error) {
            setResultado(null);
            setMensaje({ texto: error.message, tipo: 'error' });
        } finally {
            setOcupado(false);
        }
    }

    async function importar() {
        const r = resultado.resumen;
        if (!window.confirm(t('confirmar_importar') + ' ' + r.altas + ' ' + t('altas') + ', ' + r.actualizaciones + ' ' + t('actualizaciones') + '.')) {
            return;
        }
        setMensaje(null);
        setOcupado(true);
        try {
            const respuesta = await peticion('POST', '/importaciones/importar', cuerpo());
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
            setResultado(null);
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        } finally {
            setOcupado(false);
        }
    }

    function cambiarMapeo(campo, columna) {
        setMapeo(Object.assign({}, mapeo, { [campo]: columna }));
        setResultado(null);
    }

    function cambiarDestino(valor) {
        setDestino(valor);
        setMapeo({});
        setResultado(null);
    }

    function cambiarFormato(valor) {
        setFormato(valor);
        setOpciones({});
        setArchivo(null);
        setLectura(null);
        setResultado(null);
    }


    const columnas = lectura ? lectura.columnas : [];
    const faltan = campos.filter(function (c) { return c.obligatorio && !mapeo[c.campo]; });

    return (
        <Pagina titulo={t('menu_importar')}>
            <Mensaje mensaje={mensaje} />
            <p className="mb-3 max-w-3xl text-gray-700">{t('ayuda_importar')}</p>

            {/* 1. Qué se carga */}
            <section className="caja mb-4" aria-labelledby="paso1">
                <h2 id="paso1" className="mb-2 text-lg font-bold">1. {t('importar_paso1')}</h2>
                <div className="flex flex-wrap gap-4">
                    <div className="w-full max-w-xs">
                        <label htmlFor="plantilla" className="etiqueta">{t('plantilla')}</label>
                        <select id="plantilla" className="campo" value={idPlantilla}
                            onChange={function (e) { elegirPlantilla(e.target.value); }}>
                            <option value="">{t('sin_plantilla')}</option>
                            {plantillas.map(function (p) {
                                return <option key={p.id_plantilla} value={p.id_plantilla}>{p.nombre_plantilla}</option>;
                            })}
                        </select>
                    </div>
                    <div className="w-full max-w-xs">
                        <label htmlFor="destino" className="etiqueta">{t('importar_destino')}</label>
                        <select id="destino" className="campo" value={destino}
                            onChange={function (e) { cambiarDestino(e.target.value); }}>
                            {Object.keys(destinos).map(function (d) {
                                return <option key={d} value={d}>{destinos[d].nombre}</option>;
                            })}
                        </select>
                    </div>
                    <div className="w-full max-w-xs">
                        <label htmlFor="formato" className="etiqueta">{t('formato')}</label>
                        <select id="formato" className="campo" value={formato}
                            onChange={function (e) { cambiarFormato(e.target.value); }}>
                            <option value="CSV">CSV</option>
                            <option value="EXCEL">Excel (.xlsx)</option>
                            <option value="XML">XML</option>
                        </select>
                    </div>
                </div>
            </section>

            {/* 2. Archivo */}
            <section className="caja mb-4" aria-labelledby="paso2">
                <h2 id="paso2" className="mb-2 text-lg font-bold">2. {t('importar_paso2')}</h2>
                <label htmlFor="archivo" className="etiqueta">{t('archivo')}</label>
                <input id="archivo" type="file" accept={ACEPTA[formato]} className="campo" onChange={elegirArchivo} />

                {lectura && (
                    <div className="mt-3">
                        <div className="flex flex-wrap gap-4">
                            {formato === 'CSV' && (
                                <div className="w-full max-w-xs">
                                    <label htmlFor="separador" className="etiqueta">{t('separador')}</label>
                                    <select id="separador" className="campo" value={opciones.separador || ';'}
                                        onChange={function (e) { cambiarOpcion('separador', e.target.value); }}>
                                        {SEPARADORES.map(function (s) { return <option key={s[0]} value={s[0]}>{s[1]}</option>; })}
                                    </select>
                                </div>
                            )}
                            {formato === 'EXCEL' && lectura.opciones.hojas && (
                                <div className="w-full max-w-xs">
                                    <label htmlFor="hoja" className="etiqueta">{t('hoja')}</label>
                                    <select id="hoja" className="campo" value={opciones.hoja || ''}
                                        onChange={function (e) { cambiarOpcion('hoja', e.target.value); }}>
                                        {lectura.opciones.hojas.map(function (h) { return <option key={h} value={h}>{h}</option>; })}
                                    </select>
                                </div>
                            )}
                            {formato === 'XML' && lectura.opciones.elementos && (
                                <div className="w-full max-w-xs">
                                    <label htmlFor="elemento" className="etiqueta">{t('elemento_fila')}</label>
                                    <select id="elemento" className="campo" value={opciones.elemento_fila || ''}
                                        onChange={function (e) { cambiarOpcion('elemento_fila', e.target.value); }}>
                                        {lectura.opciones.elementos.map(function (el) {
                                            return <option key={el.nombre} value={el.nombre}>&lt;{el.nombre}&gt; ({el.filas})</option>;
                                        })}
                                    </select>
                                </div>
                            )}
                        </div>
                        <p className="mt-2 font-bold">{archivo.nombre}: {lectura.total} {t('filas')}</p>
                        <div className="mt-2 overflow-x-auto">
                            <table className="tabla">
                                <caption>{t('primeras_filas')}</caption>
                                <thead>
                                    <tr>{lectura.columnas.map(function (c) { return <th key={c} scope="col">{c}</th>; })}</tr>
                                </thead>
                                <tbody>
                                    {lectura.muestra.map(function (fila, i) {
                                        return (
                                            <tr key={i} className="even:bg-gray-50">
                                                {lectura.columnas.map(function (c) { return <td key={c}>{fila[c]}</td>; })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </section>

            {/* 3. Columnas */}
            <section className="caja mb-4" aria-labelledby="paso3">
                <h2 id="paso3" className="mb-2 text-lg font-bold">3. {t('importar_paso3')}</h2>
                <p className="mb-2 text-sm text-gray-700">{t('ayuda_columnas')}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {campos.map(function (c) {
                        const valor = mapeo[c.campo] || '';
                        const noEsta = valor && lectura && !columnas.includes(valor);
                        return (
                            <div key={c.campo}>
                                <label htmlFor={'campo-' + c.campo} className="etiqueta">
                                    {c.etiqueta}{c.obligatorio ? ' *' : ''}
                                </label>
                                <select id={'campo-' + c.campo} className="campo" value={valor}
                                    onChange={function (e) { cambiarMapeo(c.campo, e.target.value); }}>
                                    <option value="">{t('sin_asignar')}</option>
                                    {valor && !columnas.includes(valor) && (
                                        <option value={valor}>{valor}{lectura ? ' (' + t('no_esta_archivo') + ')' : ''}</option>
                                    )}
                                    {columnas.map(function (col) { return <option key={col} value={col}>{col}</option>; })}
                                </select>
                                {noEsta && <p className="text-sm font-bold text-red-700">{t('columna_no_esta')}</p>}
                            </div>
                        );
                    })}
                </div>
                <p className="mt-2 text-sm text-gray-700">* {t('obligatorio')}</p>

                <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-gray-300 pt-3">
                    <div className="w-full max-w-xs">
                        <label htmlFor="nombre-plantilla" className="etiqueta">{t('nombre_plantilla')}</label>
                        <input id="nombre-plantilla" className="campo" maxLength={100} value={nombrePlantilla}
                            placeholder={t('ejemplo_plantilla')}
                            onChange={function (e) { setNombrePlantilla(e.target.value); }} />
                    </div>
                    <button type="button" className="boton-secundario" onClick={guardarPlantilla}>
                        {idPlantilla ? t('actualizar_plantilla') : t('guardar_plantilla')}
                    </button>
                    {idPlantilla && (
                        <button type="button" className="boton-peligro" onClick={eliminarPlantilla}>{t('eliminar_plantilla')}</button>
                    )}
                </div>
            </section>

            {/* 4. Comprobar e importar */}
            <section className="caja mb-4" aria-labelledby="paso4">
                <h2 id="paso4" className="mb-2 text-lg font-bold">4. {t('importar_paso4')}</h2>
                {faltan.length > 0 && (
                    <p className="mb-2 text-gray-700">{t('faltan_columnas')} {faltan.map(function (c) { return c.etiqueta; }).join(', ')}.</p>
                )}
                <p>
                    <button type="button" className="boton mr-2 mb-2" disabled={!lectura || faltan.length > 0 || ocupado}
                        onClick={comprobar}>{ocupado ? t('procesando') : t('comprobar')}</button>
                    <button type="button" className="boton mb-2"
                        disabled={!resultado || resultado.resumen.errores > 0 || resultado.resumen.total === 0 || ocupado}
                        onClick={importar}>{t('importar')}</button>
                </p>

                {resultado && (
                    <div aria-live="polite">
                        <p className="mb-2 font-bold">
                            {resultado.resumen.total} {t('filas')}: {resultado.resumen.altas} {t('altas')}, {resultado.resumen.actualizaciones} {t('actualizaciones')}, {' '}
                            <span className={resultado.resumen.errores > 0 ? 'text-red-700' : ''}>{resultado.resumen.errores} {t('con_errores')}</span>
                        </p>
                        {resultado.resumen.errores > 0 && <p className="mb-2 text-red-700">{t('corrige_errores')}</p>}
                        <div className="overflow-x-auto">
                            <table className="tabla">
                                <caption>{t('resultado_comprobacion')}</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">{t('fila')}</th>
                                        <th scope="col">{t('resultado')}</th>
                                        {campos.map(function (c) { return <th key={c.campo} scope="col">{c.etiqueta}</th>; })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {resultado.filas.map(function (f) {
                                        const error = f.accion === 'ERROR';
                                        return (
                                            <tr key={f.fila} className={error ? 'bg-red-50' : 'even:bg-gray-50'}>
                                                <td>{f.fila}</td>
                                                <td>
                                                    <Estado tipo={error ? 'pendiente' : f.accion === 'ALTA' ? 'hecho' : 'inactivo'} texto={t('accion_' + f.accion)} />
                                                    {error && <span className="block text-sm text-red-700">{f.errores.join('. ')}</span>}
                                                </td>
                                                {campos.map(function (c) {
                                                    const v = f.registro[c.campo];
                                                    return <td key={c.campo}>{v === null || v === undefined ? '' : String(v)}</td>;
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {resultado.resumen.total > resultado.filas.length && (
                            <p className="mt-2 text-sm text-gray-700">{t('solo_primeras')} {resultado.filas.length}.</p>
                        )}
                    </div>
                )}
            </section>
        </Pagina>
    );
}
