// =====================================================================
// ARCHIVO: src/paginas/ExportarErp.jsx
// XML de los pedidos enviados, para importarlos en el ERP. Solo ADMIN.
// Se descargan con el XML fijo del ERP o con una plantilla de
// exportación (CSV, Excel, XML). Descargar (uno o varios en ZIP) los
// marca como EXPORTADOS sin borrarlos, salvo que la plantilla diga lo
// contrario. Eliminar es una acción aparte.
// =====================================================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../contexto/AppContext.jsx';
import { peticion, descargar } from '../servicios/api.js';
import Pagina from '../componentes/Pagina.jsx';
import Mensaje from '../componentes/Mensaje.jsx';
import Estado from '../componentes/Estado.jsx';


export default function ExportarErp() {
    const { t } = useApp();
    const [lista, setLista] = useState([]);
    const [centros, setCentros] = useState([]);
    const [filtroEstado, setFiltroEstado] = useState('PENDIENTE');
    const [filtroCentro, setFiltroCentro] = useState('');
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [marcados, setMarcados] = useState([]);
    const [mensaje, setMensaje] = useState(null);
    const [plantillas, setPlantillas] = useState([]);
    const [plantilla, setPlantilla] = useState(function () {
        try { return localStorage.getItem('plantilla_exportacion') || 'ERP'; } catch (e) { return 'ERP'; }
    });


    // Filtros comunes (centro y periodo por fecha del pedido).
    function filtros() {
        return '&centro=' + filtroCentro + '&desde=' + desde + '&hasta=' + hasta;
    }

    async function cargar() {
        try {
            setLista(await peticion('GET', '/exportaciones?estado=' + filtroEstado + filtros()));
            setMarcados([]);
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    useEffect(function () {
        cargar();
    }, [filtroEstado, filtroCentro, desde, hasta]);

    useEffect(function () {
        peticion('GET', '/centros/mios').then(setCentros).catch(function () { setCentros([]); });
        peticion('GET', '/exportaciones/plantillas').then(function (lista) {
            setPlantillas(lista);
            // Si la plantilla recordada ya no existe, volvemos al XML del ERP.
            setPlantilla(function (actual) {
                return actual === 'ERP' || lista.some(function (p) { return String(p.id_plantilla) === actual; }) ? actual : 'ERP';
            });
        }).catch(function () { setPlantillas([]); });
    }, []);

    function elegirPlantilla(valor) {
        setPlantilla(valor);
        try { localStorage.setItem('plantilla_exportacion', valor); } catch (e) { /* sin almacenamiento */ }
    }


    // Atajos de periodo: mes actual y mes anterior.
    function iso(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function periodoMes(salto) {
        const hoy = new Date();
        const inicio = new Date(hoy.getFullYear(), hoy.getMonth() + salto, 1);
        const fin = new Date(hoy.getFullYear(), hoy.getMonth() + salto + 1, 0);
        setDesde(iso(inicio));
        setHasta(iso(fin));
    }


    function alternar(id) {
        setMarcados(marcados.includes(id)
            ? marcados.filter(function (m) { return m !== id; })
            : marcados.concat(id));
    }

    function alternarTodos(e) {
        setMarcados(e.target.checked ? lista.map(function (x) { return x.id_exportacion; }) : []);
    }


    async function bajar(accion) {
        setMensaje(null);
        try {
            await accion();
            cargar();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    function descargarUno(id) {
        descargarZip([id]);
    }

    // Uno solo llega como archivo; varios, en un ZIP.
    function descargarZip(ids) {
        if (ids.length === 0) {
            setMensaje({ texto: t('sin_pendientes'), tipo: 'error' });
            return;
        }
        bajar(function () { return descargar('POST', '/exportaciones/descargar', { ids: ids, plantilla: plantilla }); });
    }

    async function descargarPendientes() {
        try {
            const pendientes = await peticion('GET', '/exportaciones?estado=PENDIENTE' + filtros());
            descargarZip(pendientes.map(function (x) { return x.id_exportacion; }));
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    async function eliminar(id) {
        if (!window.confirm(t('confirmar_eliminar_xml'))) {
            return;
        }
        try {
            const respuesta = await peticion('DELETE', '/exportaciones/' + id);
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
            cargar();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }


    return (
        <Pagina titulo={t('menu_exportar')}>
            <Mensaje mensaje={mensaje} />
            <p className="mb-3 max-w-3xl text-gray-700">{t('ayuda_exportar')}</p>

            <div className="mb-3 flex flex-wrap gap-4">
                <div className="w-full max-w-xs">
                    <label htmlFor="filtro-estado" className="etiqueta">{t('filtrar_estado')}</label>
                    <select id="filtro-estado" className="campo" value={filtroEstado}
                        onChange={function (e) { setFiltroEstado(e.target.value); }}>
                        <option value="PENDIENTE">{t('solo_pendientes')}</option>
                        <option value="EXPORTADO">{t('solo_exportados')}</option>
                        <option value="">{t('todos')}</option>
                    </select>
                </div>
                <div className="w-full max-w-xs">
                    <label htmlFor="filtro-centro" className="etiqueta">{t('centro')}</label>
                    <select id="filtro-centro" className="campo" value={filtroCentro}
                        onChange={function (e) { setFiltroCentro(e.target.value); }}>
                        <option value="">{t('todos_centros')}</option>
                        {centros.map(function (c) {
                            return <option key={c.id_centro} value={c.id_centro}>{c.numero_serie} · {c.nombre_centro}</option>;
                        })}
                    </select>
                </div>
            </div>

            <fieldset className="mb-3">
                <legend className="etiqueta">{t('periodo_pedido')}</legend>
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label htmlFor="desde" className="text-sm">{t('desde')}</label>
                        <input id="desde" type="date" className="campo" value={desde} max={hasta || undefined}
                            onChange={function (e) { setDesde(e.target.value); }} />
                    </div>
                    <div>
                        <label htmlFor="hasta" className="text-sm">{t('hasta')}</label>
                        <input id="hasta" type="date" className="campo" value={hasta} min={desde || undefined}
                            onChange={function (e) { setHasta(e.target.value); }} />
                    </div>
                    <button type="button" className="boton-secundario boton-pequeno mb-1" onClick={function () { periodoMes(0); }}>{t('este_mes')}</button>
                    <button type="button" className="boton-secundario boton-pequeno mb-1" onClick={function () { periodoMes(-1); }}>{t('mes_anterior')}</button>
                    <button type="button" className="boton-secundario boton-pequeno mb-1" disabled={!desde && !hasta}
                        onClick={function () { setDesde(''); setHasta(''); }}>{t('quitar_fechas')}</button>
                </div>
            </fieldset>

            <div className="mb-3 flex flex-wrap items-end gap-3">
                <div className="w-full max-w-sm">
                    <label htmlFor="plantilla-exportacion" className="etiqueta">{t('descargar_con')}</label>
                    <select id="plantilla-exportacion" className="campo" value={plantilla}
                        onChange={function (e) { elegirPlantilla(e.target.value); }}>
                        <option value="ERP">{t('xml_erp_fijo')}</option>
                        {plantillas.map(function (p) {
                            return <option key={p.id_plantilla} value={p.id_plantilla}>{p.nombre_plantilla} ({p.formato === 'EXCEL' ? 'Excel' : p.formato}){p.marcar_exportado ? '' : ' · ' + t('no_marca')}</option>;
                        })}
                    </select>
                </div>
                <Link to="/plantillas-exportacion" className="boton-secundario mb-0.5">{t('gestionar_plantillas')}</Link>
            </div>

            <p className="mb-3">
                <button type="button" className="boton mr-2 mb-2" onClick={descargarPendientes}>{t('descargar_pendientes')}</button>
                <button type="button" className="boton-secundario mb-2" disabled={marcados.length === 0}
                    onClick={function () { descargarZip(marcados); }}>
                    {t('descargar_seleccion')} {marcados.length > 0 ? '(' + marcados.length + ')' : ''}
                </button>
            </p>

            <div className="caja overflow-x-auto">
                <table className="tabla">
                    <caption>{t('exportar_caption')}</caption>
                    <thead>
                        <tr>
                            <th scope="col">
                                <input type="checkbox" className="h-4 w-4" aria-label={t('marcar_todos')}
                                    checked={lista.length > 0 && marcados.length === lista.length} onChange={alternarTodos} />
                            </th>
                            <th scope="col">{t('archivo')}</th>
                            <th scope="col">{t('centro')}</th>
                            <th scope="col">{t('proveedor')}</th>
                            <th scope="col">{t('fecha_pedido')}</th>
                            <th scope="col">{t('fecha_entrega_col')}</th>
                            <th scope="col">{t('estado')}</th>
                            <th scope="col">{t('acciones')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lista.length === 0 && <tr><td colSpan={8}>{t('sin_datos')}</td></tr>}
                        {lista.map(function (x) {
                            const pendiente = x.estado === 'PENDIENTE';
                            return (
                                <tr key={x.id_exportacion} className="even:bg-gray-50">
                                    <td>
                                        <input type="checkbox" className="h-4 w-4" aria-label={t('marcar_fila') + ' ' + x.nombre_archivo}
                                            checked={marcados.includes(x.id_exportacion)}
                                            onChange={function () { alternar(x.id_exportacion); }} />
                                    </td>
                                    <td className="whitespace-nowrap">{x.nombre_archivo}</td>
                                    <td>{x.nombre_centro}</td>
                                    <td>{x.nombre_proveedor}</td>
                                    <td>{x.fecha_pedido}</td>
                                    <td>{x.fecha_entrega}</td>
                                    <td>
                                        <Estado tipo={pendiente ? 'pendiente' : 'hecho'} texto={t(x.estado)} />
                                        {!pendiente && (
                                            <span className="block text-xs text-gray-700">{x.fecha_exportacion}{x.exportado_por ? ' · ' + x.exportado_por : ''}</span>
                                        )}
                                    </td>
                                    <td>
                                        <button type="button" className="boton-secundario boton-pequeno"
                                            onClick={function () { descargarUno(x.id_exportacion); }}>{t('descargar')}</button>
                                        <button type="button" className="boton-peligro boton-pequeno"
                                            onClick={function () { eliminar(x.id_exportacion); }}>{t('eliminar')}</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Pagina>
    );
}
