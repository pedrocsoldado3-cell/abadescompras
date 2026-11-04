// =====================================================================
// ARCHIVO: src/paginas/Tarifas.jsx   (solo ADMIN)
// Artículos tarificados: qué proveedor vende cada
// artículo, con qué referencia, precio y descuento.
// =====================================================================

import { useState, useEffect } from 'react';
import { useApp } from '../contexto/AppContext.jsx';
import { peticion, formatoNumero } from '../servicios/api.js';
import Pagina from '../componentes/Pagina.jsx';
import Mensaje from '../componentes/Mensaje.jsx';
import Estado from '../componentes/Estado.jsx';
import Buscador from '../componentes/Buscador.jsx';


const VACIO = { id_articulo: '', id_proveedor: '', referencia_proveedor: '', descripcion_proveedor: '', precio: '', descuento: '0' };


export default function Tarifas() {
    const { t } = useApp();
    const [tarifas, setTarifas] = useState([]);
    const [articulos, setArticulos] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [form, setForm] = useState(VACIO);
    const [idEditando, setIdEditando] = useState(null);
    const [mensaje, setMensaje] = useState(null);


    async function cargarTarifas() {
        try {
            setTarifas(await peticion('GET', '/tarifas'));
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }


    // -----------------------------------------------------------------
    // Al abrir la página pedimos artículos y proveedores (para los dos
    // desplegables) y las tarifas (para la tabla).
    // -----------------------------------------------------------------
    useEffect(function () {
        async function cargarTodo() {
            try {
                setArticulos(await peticion('GET', '/articulos'));
                setProveedores(await peticion('GET', '/proveedores'));
            } catch (error) {
                setMensaje({ texto: error.message, tipo: 'error' });
            }
            cargarTarifas();
        }
        cargarTodo();
    }, []);


    function cambiar(e) {
        setForm({ ...form, [e.target.name]: e.target.value });
    }


    // -----------------------------------------------------------------
    // Precio neto calculado EN CADA DIBUJO a partir del formulario:
    //   neto = precio - precio * descuento / 100
    // No hace falta un useState: es un valor "derivado" de otros datos,
    // y React lo recalcula cada vez que cambia el formulario.
    // -----------------------------------------------------------------
    const precio = parseFloat(form.precio);
    const descuento = parseFloat(form.descuento) || 0;
    const neto = isNaN(precio) ? '-' : formatoNumero(precio - precio * descuento / 100, 4) + ' €';


    function editar(tf) {
        setForm({
            id_articulo: String(tf.id_articulo),
            id_proveedor: String(tf.id_proveedor),
            referencia_proveedor: tf.referencia_proveedor,
            descripcion_proveedor: tf.descripcion_proveedor || '',
            precio: String(Number(tf.precio)),
            descuento: String(Number(tf.descuento))
        });
        setIdEditando(tf.id_articulo_tarificado);
        window.scrollTo(0, 0);
    }

    function cancelar() {
        setForm(VACIO);
        setIdEditando(null);
    }


    // -----------------------------------------------------------------
    // enviar(e): comprobamos el descuento también aquí (0-100) antes de
    // mandarlo, y elegimos POST o PUT.
    // -----------------------------------------------------------------
    async function enviar(e) {
        e.preventDefault();
        setMensaje(null);
        if (descuento < 0 || descuento > 100) {
            setMensaje({ texto: t('error_descuento'), tipo: 'error' });
            return;
        }
        try {
            let respuesta;
            if (idEditando === null) {
                respuesta = await peticion('POST', '/tarifas', form);
            } else {
                respuesta = await peticion('PUT', '/tarifas/' + idEditando, form);
            }
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
            cancelar();
            cargarTarifas();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    async function cambiarActivo(id) {
        try {
            const respuesta = await peticion('PUT', '/tarifas/' + id + '/activo');
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
            cargarTarifas();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    async function borrar(id) {
        if (!window.confirm(t('confirmar_borrar'))) {
            return;
        }
        try {
            const respuesta = await peticion('DELETE', '/tarifas/' + id);
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
            cargarTarifas();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }


    // -----------------------------------------------------------------
    // Artículo y proveedor se eligen con <Buscador>: se escribe y va
    // mostrando coincidencias. A los inactivos se les añade "(Inactivo)".
    // <output> con aria-live: el lector de pantalla lee el precio neto
    // cuando cambia.
    // -----------------------------------------------------------------
    return (
        <Pagina titulo={t('menu_tarifas')}>
            <Mensaje mensaje={mensaje} />

            <form onSubmit={enviar} className="caja">
                <h2 className="subtitulo">
                    {idEditando === null ? t('nueva_tarifa') : t('editar_tarifa') + ': ' + form.referencia_proveedor}
                </h2>
                <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                        <label htmlFor="id_articulo" className="etiqueta">{t('articulo')} <span className="text-red-700" aria-hidden="true">*</span></label>
                        <Buscador id="id_articulo" required placeholder={t('escribe_para_buscar')} sinResultados={t('sin_coincidencias')}
                            valor={form.id_articulo}
                            onChange={function (v) { setForm(function (f) { return { ...f, id_articulo: v }; }); }}
                            opciones={articulos.map(function (a) {
                                return {
                                    valor: a.id_articulo,
                                    texto: a.descripcion_articulo + (a.activo_articulo ? '' : ' (' + t('inactivo') + ')'),
                                    detalle: t('codigo_erp') + ' ' + a.codigo_erp + (a.ean ? ' · EAN ' + a.ean : '')
                                };
                            })} />
                    </div>
                    <div>
                        <label htmlFor="id_proveedor" className="etiqueta">{t('proveedor')} <span className="text-red-700" aria-hidden="true">*</span></label>
                        <Buscador id="id_proveedor" required placeholder={t('escribe_para_buscar')} sinResultados={t('sin_coincidencias')}
                            valor={form.id_proveedor}
                            onChange={function (v) { setForm(function (f) { return { ...f, id_proveedor: v }; }); }}
                            opciones={proveedores.map(function (p) {
                                return {
                                    valor: p.id_proveedor,
                                    texto: p.nombre_proveedor + (p.activo_proveedor ? '' : ' (' + t('inactivo') + ')'),
                                    detalle: t('codigo_erp') + ' ' + p.codigo_erp + ' · ' + p.razon_social,
                                    busqueda: p.cif
                                };
                            })} />
                    </div>
                    <div>
                        <label htmlFor="referencia_proveedor" className="etiqueta">{t('referencia')} <span className="text-red-700" aria-hidden="true">*</span></label>
                        <input id="referencia_proveedor" name="referencia_proveedor" type="text" required maxLength={50}
                            className="campo" value={form.referencia_proveedor} onChange={cambiar} />
                    </div>
                    <div>
                        <label htmlFor="descripcion_proveedor" className="etiqueta">{t('descripcion_proveedor')}</label>
                        <input id="descripcion_proveedor" name="descripcion_proveedor" type="text" maxLength={150}
                            className="campo" value={form.descripcion_proveedor} onChange={cambiar} />
                    </div>
                    <div>
                        <label htmlFor="precio" className="etiqueta">{t('precio')} <span className="text-red-700" aria-hidden="true">*</span></label>
                        <input id="precio" name="precio" type="number" required min="0" max="999999" step="0.0001" inputMode="decimal"
                            className="campo" value={form.precio} onChange={cambiar} />
                    </div>
                    <div>
                        <label htmlFor="descuento" className="etiqueta">{t('descuento')}</label>
                        <input id="descuento" name="descuento" type="number" min="0" max="100" step="0.01" inputMode="decimal"
                            className="campo" value={form.descuento} onChange={cambiar} />
                    </div>
                </div>
                <p className="mt-3">{t('precio_neto')}: <output aria-live="polite" className="font-bold">{neto}</output></p>
                <p className="mt-4">
                    <button type="submit" className="boton mr-2">{t('guardar')}</button>
                    <button type="button" className="boton-secundario" onClick={cancelar}>{t('cancelar')}</button>
                </p>
            </form>

            <div className="caja overflow-x-auto">
                <table className="tabla">
                    <caption>{t('tarifas_caption')}</caption>
                    <thead>
                        <tr>
                            <th scope="col">{t('articulo')}</th>
                            <th scope="col">{t('proveedor')}</th>
                            <th scope="col">{t('referencia')}</th>
                            <th scope="col" className="text-right">{t('precio')}</th>
                            <th scope="col" className="text-right">{t('descuento')}</th>
                            <th scope="col" className="text-right">{t('precio_neto')}</th>
                            <th scope="col">{t('estado')}</th>
                            <th scope="col">{t('acciones')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tarifas.length === 0 && <tr><td colSpan={8}>{t('sin_datos')}</td></tr>}
                        {tarifas.map(function (tf) {
                            const id = tf.id_articulo_tarificado;
                            return (
                                <tr key={id} className="even:bg-marca-fondo">
                                    <td>{tf.descripcion_articulo}</td>
                                    <td>{tf.nombre_proveedor}</td>
                                    <td>{tf.referencia_proveedor}</td>
                                    <td className="text-right">{formatoNumero(tf.precio, 4)}</td>
                                    <td className="text-right">{formatoNumero(tf.descuento, 2)}</td>
                                    <td className="text-right font-bold">{formatoNumero(tf.precio_neto, 4)}</td>
                                    <td>
                                        {tf.activo_articulo_tarificado
                                            ? <Estado tipo="hecho" texto={t('activo')} />
                                            : <Estado tipo="inactivo" texto={t('inactivo')} />}
                                    </td>
                                    <td>
                                        <button type="button" className="boton-secundario boton-pequeno"
                                            onClick={function () { editar(tf); }}>{t('editar')}</button>
                                        <button type="button" className="boton-secundario boton-pequeno"
                                            onClick={function () { cambiarActivo(id); }}>
                                            {tf.activo_articulo_tarificado ? t('desactivar') : t('activar')}
                                        </button>
                                        <button type="button" className="boton-peligro boton-pequeno"
                                            onClick={function () { borrar(id); }}>{t('borrar')}</button>
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
