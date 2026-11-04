// =====================================================================
// ARCHIVO: src/paginas/Articulos.jsx   (solo ADMIN)
// Catálogo maestro de artículos. Mismo esquema
// que Proveedores.jsx: formulario de alta/edición y tabla.
// =====================================================================

import { useState, useEffect } from 'react';
import { useApp } from '../contexto/AppContext.jsx';
import { peticion, formatoNumero } from '../servicios/api.js';
import Pagina from '../componentes/Pagina.jsx';
import Mensaje from '../componentes/Mensaje.jsx';
import Estado from '../componentes/Estado.jsx';


const VACIO = { codigo_erp: '', descripcion_articulo: '', ean: '', iva: '' };


export default function Articulos() {
    const { t } = useApp();
    const [articulos, setArticulos] = useState([]);
    const [form, setForm] = useState(VACIO);
    const [idEditando, setIdEditando] = useState(null);
    const [mensaje, setMensaje] = useState(null);


    async function cargar() {
        try {
            setArticulos(await peticion('GET', '/articulos'));
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    useEffect(function () {
        cargar();
    }, []);


    // -----------------------------------------------------------------
    // cambiar(e): el EAN solo admite números (control de teclas). Es un
    // campo de texto y no type="number" para no perder ceros iniciales.
    // -----------------------------------------------------------------
    function cambiar(e) {
        let valor = e.target.value;
        if (e.target.name === 'ean' || e.target.name === 'codigo_erp') {
            valor = valor.replace(/[^0-9]/g, '');
        }
        setForm({ ...form, [e.target.name]: valor });
    }


    // -----------------------------------------------------------------
    // editar(a): rellena el formulario. String(Number(a.iva)) convierte
    // '10.00' en '10' para que se vea limpio en el input.
    // -----------------------------------------------------------------
    function editar(a) {
        setForm({ codigo_erp: String(a.codigo_erp), descripcion_articulo: a.descripcion_articulo, ean: a.ean || '', iva: String(Number(a.iva)) });
        setIdEditando(a.id_articulo);
        window.scrollTo(0, 0);
    }

    function cancelar() {
        setForm(VACIO);
        setIdEditando(null);
    }

    async function enviar(e) {
        e.preventDefault();
        setMensaje(null);
        try {
            let respuesta;
            if (idEditando === null) {
                respuesta = await peticion('POST', '/articulos', form);
            } else {
                respuesta = await peticion('PUT', '/articulos/' + idEditando, form);
            }
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
            cancelar();
            cargar();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    async function cambiarActivo(id) {
        try {
            const respuesta = await peticion('PUT', '/articulos/' + id + '/activo');
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
            cargar();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    async function borrar(id) {
        if (!window.confirm(t('confirmar_borrar'))) {
            return;
        }
        try {
            const respuesta = await peticion('DELETE', '/articulos/' + id);
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
            cargar();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }


    // -----------------------------------------------------------------
    // En la tabla, si un artículo no tiene ninguna tarifa activa lo
    // marcamos con un aviso: no saldrá en el catálogo del usuario.
    // parseInt porque COUNT(*) llega del backend como texto ('0').
    // -----------------------------------------------------------------
    return (
        <Pagina titulo={t('menu_articulos')}>
            <Mensaje mensaje={mensaje} />

            <form onSubmit={enviar} className="caja">
                <h2 className="subtitulo">
                    {idEditando === null ? t('nuevo_articulo') : t('editar_articulo') + ': ' + form.descripcion_articulo}
                </h2>
                <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <label htmlFor="codigo_erp" className="etiqueta">{t('codigo_erp')} <span className="text-red-700" aria-hidden="true">*</span></label>
                        <input id="codigo_erp" name="codigo_erp" type="text" required maxLength={10} pattern="[0-9]+" inputMode="numeric"
                            className="campo" value={form.codigo_erp} onChange={cambiar} />
                    </div>
                    <div>
                        <label htmlFor="descripcion_articulo" className="etiqueta">{t('descripcion')} <span className="text-red-700" aria-hidden="true">*</span></label>
                        <input id="descripcion_articulo" name="descripcion_articulo" type="text" required maxLength={150}
                            className="campo" value={form.descripcion_articulo} onChange={cambiar} />
                    </div>
                    <div>
                        <label htmlFor="ean" className="etiqueta">{t('ean')}</label>
                        <input id="ean" name="ean" type="text" maxLength={14} pattern="[0-9]{8,14}" inputMode="numeric"
                            aria-describedby="ayuda-ean" className="campo" value={form.ean} onChange={cambiar} />
                        <p id="ayuda-ean" className="mt-1 text-sm text-gray-600">{t('ayuda_ean')}</p>
                    </div>
                    <div>
                        <label htmlFor="iva" className="etiqueta">{t('iva')} <span className="text-red-700" aria-hidden="true">*</span></label>
                        <input id="iva" name="iva" type="number" required min="0" max="99.99" step="0.01" inputMode="decimal"
                            className="campo" value={form.iva} onChange={cambiar} />
                    </div>
                </div>
                <p className="mt-4">
                    <button type="submit" className="boton mr-2">{t('guardar')}</button>
                    <button type="button" className="boton-secundario" onClick={cancelar}>{t('cancelar')}</button>
                </p>
            </form>

            <div className="caja overflow-x-auto">
                <table className="tabla">
                    <caption>{t('articulos_caption')}</caption>
                    <thead>
                        <tr>
                            <th scope="col">{t('codigo_erp')}</th>
                            <th scope="col">{t('descripcion')}</th>
                            <th scope="col">{t('ean')}</th>
                            <th scope="col" className="text-right">{t('iva')}</th>
                            <th scope="col" className="text-right">{t('tarifas')}</th>
                            <th scope="col">{t('estado')}</th>
                            <th scope="col">{t('acciones')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {articulos.length === 0 && <tr><td colSpan={7}>{t('sin_datos')}</td></tr>}
                        {articulos.map(function (a) {
                            const sinTarifa = parseInt(a.num_tarifas) === 0;
                            return (
                                <tr key={a.id_articulo} className="even:bg-gray-50">
                                    <td>{a.codigo_erp}</td>
                                    <td>{a.descripcion_articulo}</td>
                                    <td>{a.ean}</td>
                                    <td className="text-right">{formatoNumero(a.iva, 2)}</td>
                                    <td className="text-right">
                                        {sinTarifa ? <Estado tipo="pendiente" texto={'0 - ' + t('sin_tarifa')} /> : a.num_tarifas}
                                    </td>
                                    <td>
                                        {a.activo_articulo
                                            ? <Estado tipo="hecho" texto={t('activo')} />
                                            : <Estado tipo="inactivo" texto={t('inactivo')} />}
                                    </td>
                                    <td>
                                        <button type="button" className="boton-secundario boton-pequeno"
                                            onClick={function () { editar(a); }}>{t('editar')}</button>
                                        <button type="button" className="boton-secundario boton-pequeno"
                                            onClick={function () { cambiarActivo(a.id_articulo); }}>
                                            {a.activo_articulo ? t('desactivar') : t('activar')}
                                        </button>
                                        <button type="button" className="boton-peligro boton-pequeno"
                                            onClick={function () { borrar(a.id_articulo); }}>{t('borrar')}</button>
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
