// =====================================================================
// ARCHIVO: src/paginas/Solicitudes.jsx
// Lista de solicitudes.
// El usuario ve las de sus centros; el admin, las de todos. Desde aquí se ve el
// detalle, se edita, se elimina o se generan los pedidos.
// =====================================================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../contexto/AppContext.jsx';
import { peticion, formatoNumero, fechaHoy } from '../servicios/api.js';
import Pagina from '../componentes/Pagina.jsx';
import Mensaje from '../componentes/Mensaje.jsx';
import Estado from '../componentes/Estado.jsx';


export default function Solicitudes() {
    const { t } = useApp();

    // -----------------------------------------------------------------
    // Estado:
    //   solicitudes -> lista que llega del backend
    //   detalle     -> solicitud abierta con sus líneas (o null)
    //   idGenerar   -> id de la solicitud a procesar (o null = formulario oculto)
    //   fecha       -> fecha de entrega para generar
    // -----------------------------------------------------------------
    const [solicitudes, setSolicitudes] = useState([]);
    const [centros, setCentros] = useState([]);
    const [filtroCentro, setFiltroCentro] = useState('');
    const [detalle, setDetalle] = useState(null);
    const [idGenerar, setIdGenerar] = useState(null);
    const [fecha, setFecha] = useState('');
    const [mensaje, setMensaje] = useState(null);


    // -----------------------------------------------------------------
    // cargar(): pide la lista. La usamos al abrir la página y después de
    // eliminar o generar, para refrescar la tabla.
    // -----------------------------------------------------------------
    async function cargar() {
        try {
            const lista = await peticion('GET', filtroCentro === '' ? '/solicitudes' : '/solicitudes?centro=' + filtroCentro);
            setSolicitudes(lista);
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    useEffect(function () {
        cargar();
    }, [filtroCentro]);

    useEffect(function () {
        peticion('GET', '/centros/mios').then(setCentros).catch(function () { setCentros([]); });
    }, []);


    // -----------------------------------------------------------------
    // verDetalle(id): pide la solicitud con sus líneas y la guarda en
    // "detalle"; React dibuja entonces la sección de abajo.
    // -----------------------------------------------------------------
    async function verDetalle(id) {
        try {
            const solicitud = await peticion('GET', '/solicitudes/' + id);
            setDetalle(solicitud);
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }


    // -----------------------------------------------------------------
    // eliminar(id): confirmación con window.confirm y DELETE.
    // -----------------------------------------------------------------
    async function eliminar(id) {
        if (!window.confirm(t('confirmar_eliminar_solicitud') + ' ' + id + '?')) {
            return;
        }
        try {
            const respuesta = await peticion('DELETE', '/solicitudes/' + id);
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
            setDetalle(null);
            cargar();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }


    // -----------------------------------------------------------------
    // generar(e): envía la fecha al motor de adjudicación. Al terminar
    // ocultamos el formulario (idGenerar = null) y recargamos la lista.
    // -----------------------------------------------------------------
    async function generar(e) {
        e.preventDefault();
        if (fecha === '' || fecha < fechaHoy()) {
            setMensaje({ texto: t('error_fecha'), tipo: 'error' });
            return;
        }
        try {
            const respuesta = await peticion('POST', '/solicitudes/' + idGenerar + '/generar', { fecha_entrega: fecha });
            setMensaje({ texto: respuesta.mensaje + '. ' + t('ve_a_pedidos'), tipo: 'ok' });
            setIdGenerar(null);
            setFecha('');
            cargar();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }


    return (
        <Pagina titulo={t('menu_solicitudes')}>
            <Mensaje mensaje={mensaje} />

            {/* ---------------------------------------------------------
                Formulario para generar pedidos: solo se dibuja si hay
                una solicitud elegida (idGenerar distinto de null).
                --------------------------------------------------------- */}
            {idGenerar !== null && (
                <form onSubmit={generar} className="caja">
                    <h2 className="subtitulo">{t('generar_pedidos_de')} {idGenerar}</h2>
                    <div className="mb-3 max-w-md">
                        <label htmlFor="fecha_entrega" className="etiqueta">{t('fecha_entrega')} <span className="text-red-700" aria-hidden="true">*</span></label>
                        <input id="fecha_entrega" type="date" required min={fechaHoy()} autoFocus className="campo"
                            value={fecha} onChange={function (e) { setFecha(e.target.value); }} />
                    </div>
                    <button type="submit" className="boton mr-2">{t('generar_pedidos')}</button>
                    <button type="button" className="boton-secundario" onClick={function () { setIdGenerar(null); }}>{t('cancelar')}</button>
                </form>
            )}

            {/* ---------------------------------------------------------
                Filtro por centro y tabla.
                Los botones de editar, generar y eliminar solo salen si la
                solicitud está PENDIENTE.
                Para pasar el id a la función del onClick usamos una
                función que la llama: onClick={function () { eliminar(id); }}
                --------------------------------------------------------- */}
            <div className="mb-3 max-w-md">
                <label htmlFor="filtro-centro" className="etiqueta">{t('centro')}</label>
                <select id="filtro-centro" className="campo" value={filtroCentro}
                    onChange={function (e) { setFiltroCentro(e.target.value); }}>
                    <option value="">{t('todos_centros')}</option>
                    {centros.map(function (c) {
                        return <option key={c.id_centro} value={c.id_centro}>{c.numero_serie} · {c.nombre_centro}</option>;
                    })}
                </select>
            </div>

            <div className="caja overflow-x-auto">
                <table className="tabla">
                    <caption>{t('solicitudes_caption')}</caption>
                    <thead>
                        <tr>
                            <th scope="col">{t('numero')}</th>
                            <th scope="col">{t('fecha')}</th>
                            <th scope="col">{t('centro')}</th>
                            <th scope="col">{t('usuario')}</th>
                            <th scope="col">{t('lineas')}</th>
                            <th scope="col">{t('estado')}</th>
                            <th scope="col">{t('acciones')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {solicitudes.length === 0 && (
                            <tr><td colSpan={7}>{t('sin_solicitudes')}</td></tr>
                        )}
                        {solicitudes.map(function (s) {
                            const pendiente = s.estado === 'PENDIENTE';
                            return (
                                <tr key={s.id_solicitud} className="even:bg-gray-50">
                                    <td>{s.id_solicitud}</td>
                                    <td>{s.fecha_solicitud}</td>
                                    <td>{s.numero_serie} · {s.nombre_centro}</td>
                                    <td>{s.nombre_completo}</td>
                                    <td>{s.num_lineas}</td>
                                    <td><Estado tipo={pendiente ? 'pendiente' : 'hecho'} texto={t(s.estado)} /></td>
                                    <td>
                                        <button type="button" className="boton-secundario boton-pequeno"
                                            onClick={function () { verDetalle(s.id_solicitud); }}>{t('ver')}</button>
                                        {pendiente && (
                                            <>
                                                <Link to={'/solicitudes/editar/' + s.id_solicitud} className="boton-secundario boton-pequeno">{t('editar')}</Link>
                                                <button type="button" className="boton boton-pequeno"
                                                    onClick={function () { setIdGenerar(s.id_solicitud); }}>{t('generar_pedidos')}</button>
                                                <button type="button" className="boton-peligro boton-pequeno"
                                                    onClick={function () { eliminar(s.id_solicitud); }}>{t('eliminar')}</button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Detalle de la solicitud elegida (solo si detalle no es null). */}
            {detalle !== null && (
                <section className="caja overflow-x-auto" aria-live="polite">
                    <h2 className="subtitulo">{t('detalle_solicitud')} {detalle.id_solicitud}</h2>
                    <p className="mb-2">{t('centro')}: <strong>{detalle.numero_serie} · {detalle.nombre_centro}</strong></p>
                    <table className="tabla">
                        <thead>
                            <tr>
                                <th scope="col">{t('articulo')}</th>
                                <th scope="col" className="text-right">{t('cantidad')}</th>
                                <th scope="col">{t('observaciones')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {detalle.lineas.map(function (l) {
                                return (
                                    <tr key={l.id_linea_solicitud}>
                                        <td>{l.descripcion_articulo}</td>
                                        <td className="text-right">{formatoNumero(l.cantidad, 2)}</td>
                                        <td>{l.observaciones}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </section>
            )}
        </Pagina>
    );
}
