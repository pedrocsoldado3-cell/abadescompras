// =====================================================================
// ARCHIVO: src/paginas/Centros.jsx
// Mantenimiento de centros. Solo ADMIN.
//   - Ficha del centro: identificación, contacto, entrega y envío.
//   - Al editar un centro existente, además:
//       * emails en copia
//       * proveedores habilitados
//       * artículos habilitados (catálogo del centro)
// =====================================================================

import { useState, useEffect } from 'react';
import { useApp } from '../contexto/AppContext.jsx';
import { peticion } from '../servicios/api.js';
import Pagina from '../componentes/Pagina.jsx';
import Mensaje from '../componentes/Mensaje.jsx';
import Estado from '../componentes/Estado.jsx';


const VACIO = {
    id_sociedad: '', numero_serie: '', numero_almacen: '', nombre_centro: '',
    telefono_1: '', telefono_2: '', responsable: '',
    dir_entrega: '', cp_entrega: '', localidad_entrega: '', provincia_entrega: '', observaciones_entrega: '', observaciones_pedido: '',
    email_envio: '', smtp_host: '', smtp_puerto: '', smtp_usuario: '', smtp_contrasena: ''
};


// ---------------------------------------------------------------------
// Campo: etiqueta + input. "obligatorio" pinta el asterisco y required.
// ---------------------------------------------------------------------
function Campo({ nombre, texto, obligatorio, form, cambiar, ...extra }) {
    return (
        <div>
            <label htmlFor={nombre} className="etiqueta">
                {texto} {obligatorio && <span className="text-red-700" aria-hidden="true">*</span>}
            </label>
            <input id={nombre} name={nombre} required={obligatorio} className="campo"
                value={form[nombre]} onChange={cambiar} {...extra} />
        </div>
    );
}


// ---------------------------------------------------------------------
// ListaSeleccion: lista de casillas con buscador, "marcar todos" y
// botón de guardar. elementos = [{ id, texto, inactivo }].
// ---------------------------------------------------------------------
function ListaSeleccion({ titulo, elementos, inicial, onGuardar, t }) {
    const [marcados, setMarcados] = useState(inicial);
    const [buscar, setBuscar] = useState('');

    useEffect(function () {
        setMarcados(inicial);
    }, [inicial]);

    const filtro = buscar.trim().toLowerCase();
    const visibles = elementos.filter(function (e) {
        return e.texto.toLowerCase().includes(filtro);
    });

    function alternar(id) {
        setMarcados(marcados.includes(id)
            ? marcados.filter(function (m) { return m !== id; })
            : marcados.concat(id));
    }

    function marcarVisibles(valor) {
        const ids = visibles.map(function (e) { return e.id; });
        if (valor) {
            setMarcados(Array.from(new Set(marcados.concat(ids))));
        } else {
            setMarcados(marcados.filter(function (m) { return !ids.includes(m); }));
        }
    }

    const idBuscar = 'buscar-' + titulo.replace(/\W/g, '');

    return (
        <section className="caja">
            <h3 className="subtitulo">{titulo} <span className="text-base font-normal text-marca-gris-medio">({marcados.length} {t('seleccionados')})</span></h3>
            <div className="mb-2 flex flex-wrap items-end gap-2">
                <div className="max-w-xs grow">
                    <label htmlFor={idBuscar} className="etiqueta">{t('buscar')}</label>
                    <input id={idBuscar} type="search" className="campo" value={buscar}
                        onChange={function (e) { setBuscar(e.target.value); }} />
                </div>
                <button type="button" className="boton-secundario boton-pequeno" onClick={function () { marcarVisibles(true); }}>{t('marcar_todos')}</button>
                <button type="button" className="boton-secundario boton-pequeno" onClick={function () { marcarVisibles(false); }}>{t('desmarcar_todos')}</button>
            </div>
            <ul className="max-h-72 overflow-y-auto rounded border border-marca-borde p-2">
                {visibles.length === 0 && <li>{t('sin_datos')}</li>}
                {visibles.map(function (e) {
                    const id = 'sel-' + idBuscar + '-' + e.id;
                    return (
                        <li key={e.id} className="py-0.5">
                            <input id={id} type="checkbox" className="mr-2 h-4 w-4 align-middle"
                                checked={marcados.includes(e.id)} onChange={function () { alternar(e.id); }} />
                            <label htmlFor={id} className={e.inactivo ? 'text-marca-gris-medio' : ''}>
                                {e.texto}{e.inactivo ? ' (' + t('inactivo') + ')' : ''}
                            </label>
                        </li>
                    );
                })}
            </ul>
            <p className="mt-3">
                <button type="button" className="boton" onClick={function () { onGuardar(marcados); }}>{t('guardar_seleccion')}</button>
            </p>
        </section>
    );
}


export default function Centros() {
    const { t } = useApp();
    const [centros, setCentros] = useState([]);
    const [sociedades, setSociedades] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [articulos, setArticulos] = useState([]);
    const [form, setForm] = useState(VACIO);
    const [idEditando, setIdEditando] = useState(null);
    const [ficha, setFicha] = useState(null);
    const [emailsCc, setEmailsCc] = useState('');
    const [borrarContrasena, setBorrarContrasena] = useState(false);
    const [mensaje, setMensaje] = useState(null);


    async function cargar() {
        try {
            setCentros(await peticion('GET', '/centros'));
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    useEffect(function () {
        async function cargarListas() {
            try {
                setSociedades(await peticion('GET', '/sociedades'));
                setProveedores(await peticion('GET', '/proveedores'));
                setArticulos(await peticion('GET', '/articulos'));
            } catch (error) {
                setMensaje({ texto: error.message, tipo: 'error' });
            }
        }
        cargar();
        cargarListas();
    }, []);


    function cambiar(e) {
        let valor = e.target.value;
        const n = e.target.name;
        if (n === 'cp_entrega' || n === 'smtp_puerto') {
            valor = valor.replace(/[^0-9]/g, '');
        } else if (n === 'telefono_1' || n === 'telefono_2') {
            valor = valor.replace(/[^0-9+]/g, '');
        } else if (n === 'numero_serie' || n === 'numero_almacen') {
            valor = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
        }
        setForm({ ...form, [n]: valor });
    }


    async function editar(id) {
        setMensaje(null);
        try {
            const c = await peticion('GET', '/centros/' + id);
            const datos = {};
            for (const campo of Object.keys(VACIO)) {
                datos[campo] = c[campo] === null || c[campo] === undefined ? '' : String(c[campo]);
            }
            datos.smtp_contrasena = '';
            setForm(datos);
            setFicha(c);
            setEmailsCc(c.emails_cc.join('\n'));
            setBorrarContrasena(false);
            setIdEditando(id);
            window.scrollTo(0, 0);
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    function cancelar() {
        setForm(VACIO);
        setIdEditando(null);
        setFicha(null);
        setEmailsCc('');
        setBorrarContrasena(false);
    }


    async function enviar(e) {
        e.preventDefault();
        setMensaje(null);
        try {
            const datos = { ...form, borrar_smtp_contrasena: borrarContrasena };
            if (idEditando === null) {
                const respuesta = await peticion('POST', '/centros', datos);
                setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
                await cargar();
                // Abrimos el centro recién creado para poder habilitar cosas.
                await editar(respuesta.id);
            } else {
                const respuesta = await peticion('PUT', '/centros/' + idEditando, datos);
                await cargar();
                await editar(idEditando);
                setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
            }
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }


    async function guardarLista(ruta, cuerpo) {
        setMensaje(null);
        try {
            const respuesta = await peticion('PUT', '/centros/' + idEditando + '/' + ruta, cuerpo);
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
            const c = await peticion('GET', '/centros/' + idEditando);
            setFicha(c);
            setEmailsCc(c.emails_cc.join('\n'));
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
        window.scrollTo(0, 0);
    }


    async function cambiarActivo(id) {
        try {
            const respuesta = await peticion('PUT', '/centros/' + id + '/activo');
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
            const respuesta = await peticion('DELETE', '/centros/' + id);
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
            if (id === idEditando) {
                cancelar();
            }
            cargar();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }


    const listaProveedores = proveedores.map(function (p) {
        return { id: p.id_proveedor, texto: p.nombre_proveedor + ' (' + p.cif + ')', inactivo: !p.activo_proveedor };
    });
    const listaArticulos = articulos.map(function (a) {
        return { id: a.id_articulo, texto: a.descripcion_articulo + (a.ean ? ' · ' + a.ean : ''), inactivo: !a.activo_articulo };
    });

    const p = { form: form, cambiar: cambiar };

    return (
        <Pagina titulo={t('menu_centros')}>
            <Mensaje mensaje={mensaje} />

            <form onSubmit={enviar} className="caja">
                <h2 className="subtitulo">
                    {idEditando === null ? t('nuevo_centro') : t('editar_centro') + ': ' + form.numero_serie + ' · ' + form.nombre_centro}
                </h2>

                <fieldset className="mb-4">
                    <legend className="mb-2 font-bold text-marca-rojo">{t('datos_centro')}</legend>
                    <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                            <label htmlFor="id_sociedad" className="etiqueta">
                                {t('sociedad')} <span className="text-red-700" aria-hidden="true">*</span>
                            </label>
                            <select id="id_sociedad" name="id_sociedad" required className="campo"
                                value={form.id_sociedad} onChange={cambiar}>
                                <option value="">{t('elige_sociedad')}</option>
                                {sociedades.map(function (s) {
                                    return <option key={s.id_sociedad} value={s.id_sociedad}>{s.razon_social} ({s.cif})</option>;
                                })}
                            </select>
                        </div>
                        <Campo nombre="numero_serie" texto={t('numero_serie')} obligatorio maxLength={8} {...p} />
                        <Campo nombre="numero_almacen" texto={t('numero_almacen')} obligatorio maxLength={3} {...p} />
                        <Campo nombre="nombre_centro" texto={t('nombre_centro')} obligatorio maxLength={100} {...p} />
                        <Campo nombre="telefono_1" texto={t('telefono_1')} obligatorio type="tel" maxLength={15} pattern="\+?[0-9]{9,15}" {...p} />
                        <Campo nombre="telefono_2" texto={t('telefono_2')} type="tel" maxLength={15} pattern="\+?[0-9]{9,15}" {...p} />
                        <Campo nombre="responsable" texto={t('responsable')} maxLength={100} {...p} />
                    </div>
                </fieldset>

                <fieldset className="mb-4">
                    <legend className="mb-2 font-bold text-marca-rojo">{t('datos_entrega')}</legend>
                    <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Campo nombre="dir_entrega" texto={t('dir_entrega')} obligatorio maxLength={150} {...p} />
                        <Campo nombre="cp_entrega" texto={t('cod_postal')} obligatorio maxLength={5} pattern="[0-9]{5}" inputMode="numeric" {...p} />
                        <Campo nombre="localidad_entrega" texto={t('localidad')} obligatorio maxLength={80} {...p} />
                        <Campo nombre="provincia_entrega" texto={t('provincia')} obligatorio maxLength={50} {...p} />
                    </div>
                    <div className="mt-3">
                        <label htmlFor="observaciones_entrega" className="etiqueta">{t('observaciones_entrega')}</label>
                        <textarea id="observaciones_entrega" name="observaciones_entrega" rows={2} maxLength={500}
                            className="campo" value={form.observaciones_entrega} onChange={cambiar} />
                    </div>
                </fieldset>

                <fieldset className="mb-4">
                    <legend className="mb-2 font-bold text-marca-rojo">{t('envio_pedidos')}</legend>
                    <div className="mb-3">
                        <label htmlFor="observaciones_pedido" className="etiqueta">{t('observaciones_pedido_centro')}</label>
                        <textarea id="observaciones_pedido" name="observaciones_pedido" rows={2} maxLength={1000}
                            className="campo" value={form.observaciones_pedido} onChange={cambiar} />
                    </div>
                    <p className="mb-2 text-sm text-marca-gris-medio">{t('ayuda_smtp')}</p>
                    <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                        <Campo nombre="email_envio" texto={t('email_envio')} obligatorio type="email" maxLength={120} {...p} />
                        <Campo nombre="smtp_host" texto={t('smtp_host')} maxLength={120} placeholder="smtp.gmail.com" {...p} />
                        <Campo nombre="smtp_puerto" texto={t('smtp_puerto')} maxLength={5} inputMode="numeric" placeholder="465" {...p} />
                        <Campo nombre="smtp_usuario" texto={t('smtp_usuario')} maxLength={120} autoComplete="off" {...p} />
                        <div>
                            <Campo nombre="smtp_contrasena" texto={t('smtp_contrasena')} type="password" autoComplete="new-password"
                                disabled={borrarContrasena} aria-describedby="ayuda-smtp-pass" {...p} />
                            <p id="ayuda-smtp-pass" className="mt-1 text-sm text-marca-gris-medio">
                                {ficha && ficha.smtp_configurada ? t('smtp_configurada') : t('smtp_sin_configurar')}
                            </p>
                            {ficha && ficha.smtp_configurada && (
                                <p className="mt-1">
                                    <input id="borrar_pass" type="checkbox" className="mr-2 h-4 w-4 align-middle"
                                        checked={borrarContrasena} onChange={function (e) { setBorrarContrasena(e.target.checked); }} />
                                    <label htmlFor="borrar_pass">{t('smtp_borrar')}</label>
                                </p>
                            )}
                        </div>
                    </div>
                </fieldset>

                <p>
                    <button type="submit" className="boton mr-2">{t('guardar')}</button>
                    <button type="button" className="boton-secundario" onClick={cancelar}>{t('cancelar')}</button>
                </p>
                {idEditando === null && <p className="mt-2 text-sm text-marca-gris-medio">{t('habilitaciones_tras_crear')}</p>}
            </form>

            {ficha !== null && (
                <>
                    <section className="caja">
                        <h3 className="subtitulo">{t('emails_cc')}</h3>
                        <label htmlFor="emails_cc" className="etiqueta">{t('ayuda_emails_cc')}</label>
                        <textarea id="emails_cc" rows={4} className="campo" value={emailsCc}
                            onChange={function (e) { setEmailsCc(e.target.value); }} />
                        <p className="mt-3">
                            <button type="button" className="boton"
                                onClick={function () { guardarLista('emails-cc', { emails: emailsCc.split(/[\n,;]+/) }); }}>
                                {t('guardar')}
                            </button>
                        </p>
                    </section>

                    <ListaSeleccion titulo={t('proveedores_habilitados')} elementos={listaProveedores} inicial={ficha.proveedores} t={t}
                        onGuardar={function (ids) { guardarLista('proveedores', { ids: ids }); }} />

                    <ListaSeleccion titulo={t('articulos_habilitados')} elementos={listaArticulos} inicial={ficha.articulos} t={t}
                        onGuardar={function (ids) { guardarLista('articulos', { ids: ids }); }} />
                </>
            )}

            <div className="caja overflow-x-auto">
                <table className="tabla">
                    <caption>{t('centros_caption')}</caption>
                    <thead>
                        <tr>
                            <th scope="col">{t('numero_serie')}</th>
                            <th scope="col">{t('nombre_centro')}</th>
                            <th scope="col">{t('numero_almacen')}</th>
                            <th scope="col">{t('sociedad')}</th>
                            <th scope="col">{t('email_envio')}</th>
                            <th scope="col">{t('estado')}</th>
                            <th scope="col">{t('acciones')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {centros.length === 0 && <tr><td colSpan={7}>{t('sin_datos')}</td></tr>}
                        {centros.map(function (c) {
                            return (
                                <tr key={c.id_centro} className="even:bg-marca-fondo">
                                    <td>{c.numero_serie}</td>
                                    <td>{c.nombre_centro}</td>
                                    <td>{c.numero_almacen}</td>
                                    <td>{c.razon_social}</td>
                                    <td>{c.email_envio}</td>
                                    <td>
                                        {c.activo_centro
                                            ? <Estado tipo="hecho" texto={t('activo')} />
                                            : <Estado tipo="inactivo" texto={t('inactivo')} />}
                                    </td>
                                    <td>
                                        <button type="button" className="boton-secundario boton-pequeno"
                                            onClick={function () { editar(c.id_centro); }}>{t('editar')}</button>
                                        <button type="button" className="boton-secundario boton-pequeno"
                                            onClick={function () { cambiarActivo(c.id_centro); }}>
                                            {c.activo_centro ? t('desactivar') : t('activar')}
                                        </button>
                                        <button type="button" className="boton-peligro boton-pequeno"
                                            onClick={function () { borrar(c.id_centro); }}>{t('borrar')}</button>
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
