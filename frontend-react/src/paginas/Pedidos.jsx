// =====================================================================
// ARCHIVO: src/paginas/Pedidos.jsx
// Pedidos a proveedores.
// Lista con filtros, detalle, envío del pedido (correo con PDF desde la
// cuenta del centro, que lo deja TRAMITADO), descarga del PDF y, para el
// admin, reenvío. El usuario normal no ve precios.
// =====================================================================

import { useState, useEffect } from 'react';
import { useApp } from '../contexto/AppContext.jsx';
import { peticion, descargar, formatoNumero } from '../servicios/api.js';
import Pagina from '../componentes/Pagina.jsx';
import Mensaje from '../componentes/Mensaje.jsx';
import Estado from '../componentes/Estado.jsx';


export default function Pedidos() {
    const { usuario, t } = useApp();
    const esAdmin = usuario.rol === 'ADMIN';

    const [pedidos, setPedidos] = useState([]);
    const [filtro, setFiltro] = useState('PENDIENTE');
    const [centros, setCentros] = useState([]);
    const [filtroCentro, setFiltroCentro] = useState('');
    const [detalle, setDetalle] = useState(null);
    const [conPrecios, setConPrecios] = useState(false);
    const [enviando, setEnviando] = useState(null);
    const [mensaje, setMensaje] = useState(null);


    // -----------------------------------------------------------------
    // cargar(): pide la lista según el filtro. Si el filtro está vacío
    // ('Todos') no se añade nada a la URL.
    // El useEffect depende de [filtro]: cada vez que el usuario cambia
    // el desplegable, el filtro cambia y la lista se vuelve a pedir sola.
    // -----------------------------------------------------------------
    async function cargar() {
        const ruta = '/compras?estado=' + filtro + '&centro=' + filtroCentro;
        try {
            const lista = await peticion('GET', ruta);
            setPedidos(lista);
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    useEffect(function () {
        cargar();
    }, [filtro, filtroCentro]);

    useEffect(function () {
        peticion('GET', '/centros/mios').then(setCentros).catch(function () { setCentros([]); });
    }, []);


    async function verDetalle(id) {
        try {
            const pedido = await peticion('GET', '/compras/' + id);
            setDetalle(pedido);
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }


    // -----------------------------------------------------------------
    // enviar(id, reenvio): el servidor genera PDF y XML y manda el correo
    // desde la cuenta del centro. Tarda unos segundos: mientras, el botón
    // queda desactivado para no enviarlo dos veces.
    // -----------------------------------------------------------------
    async function enviar(p, reenvio) {
        const numero = p.serie_pedido + '/' + p.numero_pedido;
        const pregunta = (reenvio ? t('confirmar_reenviar') : t('confirmar_enviar')) + ' ' + numero + ' → ' + p.nombre_proveedor +
            (esAdmin ? '\n' + (conPrecios ? t('pdf_con_precios') : t('pdf_sin_precios')) : '');
        if (!window.confirm(pregunta)) {
            return;
        }
        setMensaje(null);
        setEnviando(p.id_compra);
        try {
            const ruta = '/compras/' + p.id_compra + (reenvio ? '/reenviar' : '/enviar');
            const respuesta = await peticion('POST', ruta, { con_precios: esAdmin && conPrecios });
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
            cargar();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        } finally {
            setEnviando(null);
        }
    }

    async function descargarPdf(id) {
        try {
            await descargar('GET', '/compras/' + id + '/pdf');
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }


    return (
        <Pagina titulo={t('menu_pedidos')}>
            <Mensaje mensaje={mensaje} />

            <div className="mb-3 max-w-md">
                <label htmlFor="filtro-estado" className="etiqueta">{t('filtrar_estado')}</label>
                <select id="filtro-estado" className="campo" value={filtro}
                    onChange={function (e) { setFiltro(e.target.value); }}>
                    <option value="PENDIENTE">{t('solo_pendientes')}</option>
                    <option value="TRAMITADO">{t('solo_tramitados')}</option>
                    <option value="">{t('todos')}</option>
                </select>
            </div>

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

            {esAdmin && (
                <p className="mb-3">
                    <input id="con_precios" type="checkbox" className="mr-2 h-4 w-4 align-middle"
                        checked={conPrecios} onChange={function (e) { setConPrecios(e.target.checked); }} />
                    <label htmlFor="con_precios">{t('incluir_precios')}</label>
                </p>
            )}

            <div className="caja overflow-x-auto">
                <table className="tabla">
                    <caption>{t('pedidos_caption')}</caption>
                    <thead>
                        <tr>
                            <th scope="col">{t('numero')}</th>
                            <th scope="col">{t('centro')}</th>
                            <th scope="col">{t('proveedor')}</th>
                            <th scope="col">{t('fecha_entrega')}</th>
                            <th scope="col">{t('lineas')}</th>
                            {esAdmin && <th scope="col" className="text-right">{t('importe')}</th>}
                            <th scope="col">{t('estado')}</th>
                            <th scope="col">{t('acciones')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pedidos.length === 0 && (
                            <tr><td colSpan={8}>{t('sin_pedidos')}</td></tr>
                        )}
                        {pedidos.map(function (p) {
                            const pendiente = p.estado === 'PENDIENTE';
                            return (
                                <tr key={p.id_compra} className="even:bg-gray-50">
                                    <td className="whitespace-nowrap">{p.serie_pedido}/{p.numero_pedido}</td>
                                    <td>{p.nombre_centro}</td>
                                    <td>{p.nombre_proveedor}</td>
                                    <td>{p.fecha_entrega}</td>
                                    <td>{p.num_lineas}</td>
                                    {esAdmin && <td className="text-right">{formatoNumero(p.importe, 2)} €</td>}
                                    <td>
                                        <Estado tipo={pendiente ? 'pendiente' : 'hecho'} texto={t(p.estado)} />
                                        {p.fecha_envio && <span className="block text-xs text-gray-700">{t('enviado_el')} {p.fecha_envio}</span>}
                                    </td>
                                    <td>
                                        <button type="button" className="boton-secundario boton-pequeno"
                                            onClick={function () { verDetalle(p.id_compra); }}>{t('ver')}</button>
                                        {pendiente && (
                                            <button type="button" className="boton boton-pequeno" disabled={enviando !== null}
                                                onClick={function () { enviar(p, false); }}>
                                                {enviando === p.id_compra ? t('enviando') : t('enviar_pedido')}
                                            </button>
                                        )}
                                        {!pendiente && (
                                            <button type="button" className="boton-secundario boton-pequeno"
                                                onClick={function () { descargarPdf(p.id_compra); }}>{t('pdf')}</button>
                                        )}
                                        {!pendiente && esAdmin && (
                                            <button type="button" className="boton-secundario boton-pequeno" disabled={enviando !== null}
                                                onClick={function () { enviar(p, true); }}>
                                                {enviando === p.id_compra ? t('enviando') : t('reenviar')}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {detalle !== null && (
                <section className="caja overflow-x-auto" aria-live="polite">
                    <h2 className="subtitulo">{t('detalle_pedido')} {detalle.serie_pedido}/{detalle.numero_pedido}</h2>
                    <p className="mb-2">{t('centro')}: <strong>{detalle.nombre_centro}</strong></p>
                    <p className="mb-2">{t('proveedor')}: <strong>{detalle.nombre_proveedor} ({detalle.email_proveedor})</strong></p>
                    <table className="tabla">
                        <thead>
                            <tr>
                                <th scope="col">{t('referencia')}</th>
                                <th scope="col">{t('articulo')}</th>
                                <th scope="col" className="text-right">{t('cantidad')}</th>
                                {esAdmin && <th scope="col" className="text-right">{t('precio_coste')}</th>}
                                <th scope="col">{t('observaciones')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {detalle.lineas.map(function (l) {
                                return (
                                    <tr key={l.id_linea_compra}>
                                        <td>{l.referencia_proveedor}</td>
                                        <td>{l.descripcion_proveedor || l.descripcion_articulo}</td>
                                        <td className="text-right">{formatoNumero(l.cantidad_compra, 2)}</td>
                                        {esAdmin && <td className="text-right">{formatoNumero(l.precio_coste, 4)} €</td>}
                                        <td>{l.observaciones_compra}</td>
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
