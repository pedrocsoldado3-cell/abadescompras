// =====================================================================
// ARCHIVO: src/paginas/PlantillasExportacion.jsx
// Plantillas para descargar los pedidos en CSV, Excel o XML con las
// columnas que se elijan. Solo ADMIN. Se usan en Exportar ERP.
// =====================================================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../contexto/AppContext.jsx';
import { peticion } from '../servicios/api.js';
import Pagina from '../componentes/Pagina.jsx';
import Mensaje from '../componentes/Mensaje.jsx';


const VACIA = {
    nombre_plantilla: '',
    formato: 'CSV',
    marcar_exportado: true,
    opciones: { separador: ';', decimal: ',', fecha: 'DD/MM/AAAA', agrupar: 'UNO', cabecera: true, elemento_raiz: 'PEDIDOS', elemento_fila: 'LINEA', estilo_xml: 'ELEMENTOS' },
    columnas: []
};
const SEPARADORES = [[';', 'Punto y coma ( ; )'], [',', 'Coma ( , )'], ['\t', 'Tabulador'], ['|', 'Barra ( | )']];
const NOMBRES_FORMATO = { CSV: 'CSV', EXCEL: 'Excel', XML: 'XML' };

// Nombre de columna propuesto: el del dato en mayúsculas, sin tildes ni espacios.
function tituloPorDefecto(campo) {
    return campo.toUpperCase();
}


export default function PlantillasExportacion() {
    const { t } = useApp();
    const [lista, setLista] = useState([]);
    const [campos, setCampos] = useState([]);
    const [fechas, setFechas] = useState([]);
    const [form, setForm] = useState(null);        // null = no se está editando
    const [idEditando, setIdEditando] = useState(null);
    const [mensaje, setMensaje] = useState(null);

    function cargar() {
        peticion('GET', '/exportaciones/plantillas').then(setLista)
            .catch(function (error) { setMensaje({ texto: error.message, tipo: 'error' }); });
    }

    useEffect(function () {
        cargar();
        peticion('GET', '/exportaciones/campos')
            .then(function (d) { setCampos(d.campos); setFechas(d.fechas); })
            .catch(function (error) { setMensaje({ texto: error.message, tipo: 'error' }); });
    }, []);

    const etiqueta = {};
    for (const c of campos) {
        etiqueta[c.campo] = c.etiqueta;
    }


    function nueva() {
        setMensaje(null);
        setIdEditando(null);
        setForm(JSON.parse(JSON.stringify(VACIA)));
    }

    function editar(p) {
        setMensaje(null);
        setIdEditando(p.id_plantilla);
        setForm({
            nombre_plantilla: p.nombre_plantilla,
            formato: p.formato,
            marcar_exportado: p.marcar_exportado,
            opciones: Object.assign({}, VACIA.opciones, p.opciones),
            columnas: p.columnas.map(function (c) { return Object.assign({}, c); })
        });
    }

    function cambiar(clave, valor) {
        setForm(Object.assign({}, form, { [clave]: valor }));
    }

    function cambiarOpcion(clave, valor) {
        setForm(Object.assign({}, form, { opciones: Object.assign({}, form.opciones, { [clave]: valor }) }));
    }

    function cambiarColumnas(columnas) {
        setForm(Object.assign({}, form, { columnas: columnas }));
    }

    function cambiarColumna(i, clave, valor) {
        const columnas = form.columnas.slice();
        const anterior = columnas[i];
        columnas[i] = Object.assign({}, anterior, { [clave]: valor });
        // Si se cambia el dato y el nombre era el propuesto, se propone el nuevo.
        if (clave === 'campo' && (!anterior.titulo || anterior.titulo === tituloPorDefecto(anterior.campo || ''))) {
            columnas[i].titulo = tituloPorDefecto(valor);
        }
        cambiarColumnas(columnas);
    }

    function mover(i, salto) {
        const j = i + salto;
        if (j < 0 || j >= form.columnas.length) {
            return;
        }
        const columnas = form.columnas.slice();
        const x = columnas[i];
        columnas[i] = columnas[j];
        columnas[j] = x;
        cambiarColumnas(columnas);
    }

    function anadir() {
        const usados = form.columnas.map(function (c) { return c.campo; });
        const libre = campos.find(function (c) { return !usados.includes(c.campo); }) || campos[0];
        cambiarColumnas(form.columnas.concat({ campo: libre.campo, titulo: tituloPorDefecto(libre.campo) }));
    }

    function anadirTodas() {
        const usados = form.columnas.map(function (c) { return c.campo; });
        const nuevas = campos.filter(function (c) { return !usados.includes(c.campo); })
            .map(function (c) { return { campo: c.campo, titulo: tituloPorDefecto(c.campo) }; });
        cambiarColumnas(form.columnas.concat(nuevas));
    }


    async function guardar(e) {
        e.preventDefault();
        setMensaje(null);
        try {
            const r = idEditando
                ? await peticion('PUT', '/exportaciones/plantillas/' + idEditando, form)
                : await peticion('POST', '/exportaciones/plantillas', form);
            setMensaje({ texto: r.mensaje, tipo: 'ok' });
            setForm(null);
            setIdEditando(null);
            cargar();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    async function eliminar(p) {
        if (!window.confirm(t('confirmar_eliminar_plantilla') + ' "' + p.nombre_plantilla + '"?')) {
            return;
        }
        try {
            const r = await peticion('DELETE', '/exportaciones/plantillas/' + p.id_plantilla);
            setMensaje({ texto: r.mensaje, tipo: 'ok' });
            if (idEditando === p.id_plantilla) {
                setForm(null);
                setIdEditando(null);
            }
            cargar();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }


    return (
        <Pagina titulo={t('plantillas_exportacion')}>
            <Mensaje mensaje={mensaje} />
            <p className="mb-3 max-w-3xl text-marca-gris-medio">{t('ayuda_plantillas_exportacion')}</p>
            <p className="mb-3">
                <button type="button" className="boton mr-2 mb-2" onClick={nueva}>{t('nueva_plantilla')}</button>
                <Link to="/exportar-erp" className="boton-secundario mb-2">{t('volver_exportar')}</Link>
            </p>

            <div className="caja mb-4 overflow-x-auto">
                <table className="tabla">
                    <caption>{t('plantillas_exportacion')}</caption>
                    <thead>
                        <tr>
                            <th scope="col">{t('nombre_plantilla')}</th>
                            <th scope="col">{t('formato')}</th>
                            <th scope="col">{t('columnas')}</th>
                            <th scope="col">{t('marca_exportado_col')}</th>
                            <th scope="col">{t('modificada')}</th>
                            <th scope="col">{t('acciones')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lista.length === 0 && <tr><td colSpan={6}>{t('sin_plantillas')}</td></tr>}
                        {lista.map(function (p) {
                            return (
                                <tr key={p.id_plantilla} className="even:bg-marca-fondo">
                                    <td className="font-bold">{p.nombre_plantilla}</td>
                                    <td>{NOMBRES_FORMATO[p.formato]}</td>
                                    <td className="text-sm">{p.columnas.map(function (c) { return c.titulo; }).join(', ')}</td>
                                    <td>{p.marcar_exportado ? t('texto_si') : t('texto_no')}</td>
                                    <td>{p.fecha_modificacion}</td>
                                    <td className="whitespace-nowrap">
                                        <button type="button" className="boton-secundario boton-pequeno" onClick={function () { editar(p); }}>{t('editar')}</button>
                                        <button type="button" className="boton-peligro boton-pequeno" onClick={function () { eliminar(p); }}>{t('eliminar')}</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {form && (
                <form onSubmit={guardar} className="caja" aria-labelledby="titulo-form">
                    <h2 id="titulo-form" className="mb-3 text-lg font-bold">
                        {idEditando ? t('editar_plantilla') + ': ' + form.nombre_plantilla : t('nueva_plantilla')}
                    </h2>

                    <div className="flex flex-wrap gap-4">
                        <div className="w-full max-w-sm">
                            <label htmlFor="nombre" className="etiqueta">{t('nombre_plantilla')} *</label>
                            <input id="nombre" className="campo" required maxLength={100} value={form.nombre_plantilla}
                                onChange={function (e) { cambiar('nombre_plantilla', e.target.value); }} />
                        </div>
                        <div className="w-full max-w-xs">
                            <label htmlFor="formato-exp" className="etiqueta">{t('formato')}</label>
                            <select id="formato-exp" className="campo" value={form.formato}
                                onChange={function (e) { cambiar('formato', e.target.value); }}>
                                <option value="CSV">CSV</option>
                                <option value="EXCEL">Excel (.xlsx)</option>
                                <option value="XML">XML</option>
                            </select>
                        </div>
                        <div className="w-full max-w-xs">
                            <label htmlFor="agrupar" className="etiqueta">{t('agrupar')}</label>
                            <select id="agrupar" className="campo" value={form.opciones.agrupar}
                                onChange={function (e) { cambiarOpcion('agrupar', e.target.value); }}>
                                <option value="UNO">{t('agrupar_uno')}</option>
                                <option value="PEDIDO">{t('agrupar_pedido')}</option>
                            </select>
                        </div>
                        {form.formato === 'CSV' && (
                            <div className="w-full max-w-xs">
                                <label htmlFor="separador-exp" className="etiqueta">{t('separador')}</label>
                                <select id="separador-exp" className="campo" value={form.opciones.separador}
                                    onChange={function (e) { cambiarOpcion('separador', e.target.value); }}>
                                    {SEPARADORES.map(function (s) { return <option key={s[0]} value={s[0]}>{s[1]}</option>; })}
                                </select>
                            </div>
                        )}
                        {form.formato !== 'EXCEL' && (
                            <div className="w-full max-w-xs">
                                <label htmlFor="decimal" className="etiqueta">{t('separador_decimal')}</label>
                                <select id="decimal" className="campo" value={form.opciones.decimal}
                                    onChange={function (e) { cambiarOpcion('decimal', e.target.value); }}>
                                    <option value=",">Coma (1,25)</option>
                                    <option value=".">Punto (1.25)</option>
                                </select>
                            </div>
                        )}
                        <div className="w-full max-w-xs">
                            <label htmlFor="fecha" className="etiqueta">{t('formato_fecha')}</label>
                            <select id="fecha" className="campo" value={form.opciones.fecha}
                                onChange={function (e) { cambiarOpcion('fecha', e.target.value); }}>
                                {fechas.map(function (f) { return <option key={f} value={f}>{f}</option>; })}
                            </select>
                        </div>
                        {form.formato === 'XML' && (
                            <>
                                <div className="w-full max-w-xs">
                                    <label htmlFor="raiz" className="etiqueta">{t('elemento_raiz')}</label>
                                    <input id="raiz" className="campo" maxLength={50} value={form.opciones.elemento_raiz}
                                        onChange={function (e) { cambiarOpcion('elemento_raiz', e.target.value); }} />
                                </div>
                                <div className="w-full max-w-xs">
                                    <label htmlFor="fila-xml" className="etiqueta">{t('elemento_fila_xml')}</label>
                                    <input id="fila-xml" className="campo" maxLength={50} value={form.opciones.elemento_fila}
                                        onChange={function (e) { cambiarOpcion('elemento_fila', e.target.value); }} />
                                </div>
                                <div className="w-full max-w-xs">
                                    <label htmlFor="estilo" className="etiqueta">{t('estilo_xml')}</label>
                                    <select id="estilo" className="campo" value={form.opciones.estilo_xml}
                                        onChange={function (e) { cambiarOpcion('estilo_xml', e.target.value); }}>
                                        <option value="ELEMENTOS">{t('estilo_elementos')}</option>
                                        <option value="ATRIBUTOS">{t('estilo_atributos')}</option>
                                    </select>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="mt-3 flex flex-col gap-2">
                        {form.formato !== 'XML' && (
                            <label className="flex items-center gap-2">
                                <input type="checkbox" className="h-4 w-4" checked={form.opciones.cabecera !== false}
                                    onChange={function (e) { cambiarOpcion('cabecera', e.target.checked); }} />
                                {t('fila_cabecera')}
                            </label>
                        )}
                        <label className="flex items-center gap-2">
                            <input type="checkbox" className="h-4 w-4" checked={form.marcar_exportado}
                                onChange={function (e) { cambiar('marcar_exportado', e.target.checked); }} />
                            {t('marcar_exportado')}
                        </label>
                    </div>

                    <fieldset className="mt-4">
                        <legend className="etiqueta">{t('columnas_archivo')}</legend>
                        <ol className="flex flex-col gap-2">
                            {form.columnas.map(function (c, i) {
                                return (
                                    <li key={i} className="flex flex-wrap items-end gap-2 border-b border-marca-borde pb-2">
                                        <span className="w-6 pb-2 text-marca-gris-medio">{i + 1}.</span>
                                        <div className="w-full max-w-xs">
                                            <label htmlFor={'dato-' + i} className="text-sm">{t('dato')}</label>
                                            <select id={'dato-' + i} className="campo" value={c.campo}
                                                onChange={function (e) { cambiarColumna(i, 'campo', e.target.value); }}>
                                                {campos.map(function (x) { return <option key={x.campo} value={x.campo}>{x.etiqueta}</option>; })}
                                            </select>
                                        </div>
                                        <div className="w-full max-w-xs">
                                            <label htmlFor={'titulo-' + i} className="text-sm">{t('nombre_columna')}</label>
                                            <input id={'titulo-' + i} className="campo" maxLength={50} value={c.titulo}
                                                onChange={function (e) { cambiarColumna(i, 'titulo', e.target.value); }} />
                                        </div>
                                        <button type="button" className="boton-secundario boton-pequeno" disabled={i === 0}
                                            aria-label={t('subir') + ' ' + (etiqueta[c.campo] || '')} onClick={function () { mover(i, -1); }}>↑</button>
                                        <button type="button" className="boton-secundario boton-pequeno" disabled={i === form.columnas.length - 1}
                                            aria-label={t('bajar') + ' ' + (etiqueta[c.campo] || '')} onClick={function () { mover(i, 1); }}>↓</button>
                                        <button type="button" className="boton-peligro boton-pequeno"
                                            aria-label={t('quitar') + ' ' + (etiqueta[c.campo] || '')}
                                            onClick={function () { cambiarColumnas(form.columnas.filter(function (x, j) { return j !== i; })); }}>✕</button>
                                    </li>
                                );
                            })}
                        </ol>
                        <p className="mt-2">
                            <button type="button" className="boton-secundario mr-2" onClick={anadir} disabled={campos.length === 0}>{t('anadir_columna')}</button>
                            <button type="button" className="boton-secundario" onClick={anadirTodas} disabled={campos.length === 0}>{t('anadir_todas')}</button>
                        </p>
                    </fieldset>

                    <p className="mt-4">
                        <button type="submit" className="boton mr-2">{t('guardar')}</button>
                        <button type="button" className="boton-secundario" onClick={function () { setForm(null); setIdEditando(null); }}>{t('cancelar_edicion')}</button>
                    </p>
                </form>
            )}
        </Pagina>
    );
}
