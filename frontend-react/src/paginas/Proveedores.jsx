// =====================================================================
// ARCHIVO: src/paginas/Proveedores.jsx   (solo ADMIN)
// Mantenimiento de proveedores: alta, edición,
// activar/desactivar y borrado. Formulario arriba y tabla abajo.
// El mismo formulario sirve para crear y editar: si "idEditando" tiene
// un número se edita; si es null, se crea.
// =====================================================================

import { useState, useEffect } from 'react';
import { useApp } from '../contexto/AppContext.jsx';
import { peticion } from '../servicios/api.js';
import Pagina from '../componentes/Pagina.jsx';
import Mensaje from '../componentes/Mensaje.jsx';
import Estado from '../componentes/Estado.jsx';


// ---------------------------------------------------------------------
// Formulario vacío. Los nombres coinciden con las columnas de la tabla
// proveedores, así podemos mandar el objeto tal cual al backend.
// ---------------------------------------------------------------------
const VACIO = {
    codigo_erp: '', nombre_proveedor: '', razon_social: '', cif: '', email_proveedor: '', telefono: '',
    direccion: '', cod_postal: '', localidad: '', provincia: ''
};


export default function Proveedores() {
    const { t } = useApp();
    const [proveedores, setProveedores] = useState([]);
    const [form, setForm] = useState(VACIO);
    const [idEditando, setIdEditando] = useState(null);
    const [mensaje, setMensaje] = useState(null);


    async function cargar() {
        try {
            setProveedores(await peticion('GET', '/proveedores'));
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    useEffect(function () {
        cargar();
    }, []);


    // -----------------------------------------------------------------
    // cambiar(e): actualiza el campo por su "name". CONTROL DE TECLAS:
    //   - cod_postal: solo números
    //   - telefono: números y +
    //   - cif: mayúsculas, solo letras y números
    // -----------------------------------------------------------------
    function cambiar(e) {
        let valor = e.target.value;
        if (e.target.name === 'cod_postal' || e.target.name === 'codigo_erp') {
            valor = valor.replace(/[^0-9]/g, '');
        } else if (e.target.name === 'telefono') {
            valor = valor.replace(/[^0-9+]/g, '');
        } else if (e.target.name === 'cif') {
            valor = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
        }
        setForm({ ...form, [e.target.name]: valor });
    }


    // -----------------------------------------------------------------
    // editar(p): copia los datos del proveedor al formulario. Los campos
    // opcionales pueden venir como null; los pasamos a '' porque un
    // <input> controlado no admite null.
    // -----------------------------------------------------------------
    function editar(p) {
        const datos = {};
        for (const campo of Object.keys(VACIO)) {
            datos[campo] = p[campo] === null || p[campo] === undefined ? '' : String(p[campo]);
        }
        setForm(datos);
        setIdEditando(p.id_proveedor);
        window.scrollTo(0, 0);
    }

    function cancelar() {
        setForm(VACIO);
        setIdEditando(null);
    }


    // -----------------------------------------------------------------
    // enviar(e): POST si es nuevo, PUT si estamos editando.
    // -----------------------------------------------------------------
    async function enviar(e) {
        e.preventDefault();
        setMensaje(null);
        try {
            let respuesta;
            if (idEditando === null) {
                respuesta = await peticion('POST', '/proveedores', form);
            } else {
                respuesta = await peticion('PUT', '/proveedores/' + idEditando, form);
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
            const respuesta = await peticion('PUT', '/proveedores/' + id + '/activo');
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
            const respuesta = await peticion('DELETE', '/proveedores/' + id);
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
            cargar();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }


    // -----------------------------------------------------------------
    // Lista de campos del formulario: [name, clave de texto, tipo,
    // obligatorio, atributos extra]. Con map() generamos los 9 campos
    // sin repetir el mismo JSX 9 veces.
    // grid sm:grid-cols-2 lg:grid-cols-3 -> 1, 2 o 3 columnas según ancho.
    // -----------------------------------------------------------------
    const CAMPOS = [
        ['codigo_erp', 'codigo_erp', 'text', true, { maxLength: 10, pattern: '[0-9]+', inputMode: 'numeric' }],
        ['nombre_proveedor', 'nombre_comercial', 'text', true, { maxLength: 100 }],
        ['razon_social', 'razon_social', 'text', true, { maxLength: 150 }],
        ['cif', 'cif', 'text', true, { maxLength: 9, pattern: '[A-Z0-9][0-9]{7}[A-Z0-9]', title: t('ayuda_cif') }],
        ['email_proveedor', 'email_pedidos', 'email', true, { maxLength: 120 }],
        ['telefono', 'telefono', 'tel', false, { maxLength: 15, pattern: '\\+?[0-9]{9,15}', inputMode: 'tel' }],
        ['direccion', 'direccion', 'text', false, { maxLength: 150 }],
        ['cod_postal', 'cod_postal', 'text', false, { maxLength: 5, pattern: '[0-9]{5}', inputMode: 'numeric' }],
        ['localidad', 'localidad', 'text', false, { maxLength: 80 }],
        ['provincia', 'provincia', 'text', false, { maxLength: 50 }]
    ];

    return (
        <Pagina titulo={t('menu_proveedores')}>
            <Mensaje mensaje={mensaje} />

            <form onSubmit={enviar} className="caja">
                <h2 className="subtitulo">
                    {idEditando === null ? t('nuevo_proveedor') : t('editar_proveedor') + ': ' + form.nombre_proveedor}
                </h2>
                <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    {CAMPOS.map(function (c) {
                        return (
                            <div key={c[0]}>
                                <label htmlFor={c[0]} className="etiqueta">
                                    {t(c[1])} {c[3] && <span className="text-red-700" aria-hidden="true">*</span>}
                                </label>
                                {/* {...c[4]} "esparce" los atributos extra
                                    (maxLength, pattern...) sobre el input.
                                    */}
                                <input id={c[0]} name={c[0]} type={c[2]} required={c[3]} {...c[4]}
                                    className="campo" value={form[c[0]]} onChange={cambiar} />
                            </div>
                        );
                    })}
                </div>
                <p className="mt-4">
                    <button type="submit" className="boton mr-2">{t('guardar')}</button>
                    <button type="button" className="boton-secundario" onClick={cancelar}>{t('cancelar')}</button>
                </p>
            </form>

            <div className="caja overflow-x-auto">
                <table className="tabla">
                    <caption>{t('proveedores_caption')}</caption>
                    <thead>
                        <tr>
                            <th scope="col">{t('codigo_erp')}</th>
                            <th scope="col">{t('nombre_comercial')}</th>
                            <th scope="col">{t('cif')}</th>
                            <th scope="col">{t('email_pedidos')}</th>
                            <th scope="col">{t('telefono')}</th>
                            <th scope="col">{t('estado')}</th>
                            <th scope="col">{t('acciones')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {proveedores.length === 0 && <tr><td colSpan={7}>{t('sin_datos')}</td></tr>}
                        {proveedores.map(function (p) {
                            return (
                                <tr key={p.id_proveedor} className="even:bg-marca-fondo">
                                    <td>{p.codigo_erp}</td>
                                    <td>{p.nombre_proveedor}</td>
                                    <td>{p.cif}</td>
                                    <td>{p.email_proveedor}</td>
                                    <td>{p.telefono}</td>
                                    <td>
                                        {p.activo_proveedor
                                            ? <Estado tipo="hecho" texto={t('activo')} />
                                            : <Estado tipo="inactivo" texto={t('inactivo')} />}
                                    </td>
                                    <td>
                                        <button type="button" className="boton-secundario boton-pequeno"
                                            onClick={function () { editar(p); }}>{t('editar')}</button>
                                        <button type="button" className="boton-secundario boton-pequeno"
                                            onClick={function () { cambiarActivo(p.id_proveedor); }}>
                                            {p.activo_proveedor ? t('desactivar') : t('activar')}
                                        </button>
                                        <button type="button" className="boton-peligro boton-pequeno"
                                            onClick={function () { borrar(p.id_proveedor); }}>{t('borrar')}</button>
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
