// =====================================================================
// ARCHIVO: src/paginas/Sociedades.jsx
// Mantenimiento de sociedades (razones sociales): alta, edición,
// activar/desactivar y borrado. Solo ADMIN.
// =====================================================================

import { useState, useEffect } from 'react';
import { useApp } from '../contexto/AppContext.jsx';
import { peticion } from '../servicios/api.js';
import Pagina from '../componentes/Pagina.jsx';
import Mensaje from '../componentes/Mensaje.jsx';
import Estado from '../componentes/Estado.jsx';


const VACIO = {
    razon_social: '', cif: '', dir_fiscal: '', cp_fiscal: '', localidad_fiscal: '', provincia_fiscal: ''
};


export default function Sociedades() {
    const { t } = useApp();
    const [sociedades, setSociedades] = useState([]);
    const [form, setForm] = useState(VACIO);
    const [idEditando, setIdEditando] = useState(null);
    const [mensaje, setMensaje] = useState(null);


    async function cargar() {
        try {
            setSociedades(await peticion('GET', '/sociedades'));
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    useEffect(function () {
        cargar();
    }, []);


    function cambiar(e) {
        let valor = e.target.value;
        if (e.target.name === 'cp_fiscal') {
            valor = valor.replace(/[^0-9]/g, '');
        } else if (e.target.name === 'cif') {
            valor = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
        }
        setForm({ ...form, [e.target.name]: valor });
    }

    function editar(s) {
        const datos = {};
        for (const campo of Object.keys(VACIO)) {
            datos[campo] = s[campo] || '';
        }
        setForm(datos);
        setIdEditando(s.id_sociedad);
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
            const respuesta = idEditando === null
                ? await peticion('POST', '/sociedades', form)
                : await peticion('PUT', '/sociedades/' + idEditando, form);
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
            cancelar();
            cargar();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    async function cambiarActivo(id) {
        try {
            const respuesta = await peticion('PUT', '/sociedades/' + id + '/activo');
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
            const respuesta = await peticion('DELETE', '/sociedades/' + id);
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
            cargar();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }


    // [nombre del campo, clave del texto, tipo, atributos extra]
    const CAMPOS = [
        ['razon_social', 'razon_social', 'text', { maxLength: 150 }],
        ['cif', 'cif', 'text', { maxLength: 9, pattern: '[A-Z0-9][0-9]{7}[A-Z0-9]', title: t('ayuda_cif') }],
        ['dir_fiscal', 'dir_fiscal', 'text', { maxLength: 150 }],
        ['cp_fiscal', 'cp_fiscal', 'text', { maxLength: 5, pattern: '[0-9]{5}', inputMode: 'numeric' }],
        ['localidad_fiscal', 'localidad_fiscal', 'text', { maxLength: 80 }],
        ['provincia_fiscal', 'provincia_fiscal', 'text', { maxLength: 50 }]
    ];

    return (
        <Pagina titulo={t('menu_sociedades')}>
            <Mensaje mensaje={mensaje} />

            <form onSubmit={enviar} className="caja">
                <h2 className="subtitulo">
                    {idEditando === null ? t('nueva_sociedad') : t('editar_sociedad') + ': ' + form.razon_social}
                </h2>
                <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    {CAMPOS.map(function (c) {
                        return (
                            <div key={c[0]}>
                                <label htmlFor={c[0]} className="etiqueta">
                                    {t(c[1])} <span className="text-red-700" aria-hidden="true">*</span>
                                </label>
                                <input id={c[0]} name={c[0]} type={c[2]} required {...c[3]}
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
                    <caption>{t('sociedades_caption')}</caption>
                    <thead>
                        <tr>
                            <th scope="col">{t('razon_social')}</th>
                            <th scope="col">{t('cif')}</th>
                            <th scope="col">{t('localidad_fiscal')}</th>
                            <th scope="col">{t('num_centros')}</th>
                            <th scope="col">{t('estado')}</th>
                            <th scope="col">{t('acciones')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sociedades.length === 0 && <tr><td colSpan={6}>{t('sin_datos')}</td></tr>}
                        {sociedades.map(function (s) {
                            return (
                                <tr key={s.id_sociedad} className="even:bg-marca-fondo">
                                    <td>{s.razon_social}</td>
                                    <td>{s.cif}</td>
                                    <td>{s.localidad_fiscal}</td>
                                    <td>{s.num_centros}</td>
                                    <td>
                                        {s.activo_sociedad
                                            ? <Estado tipo="hecho" texto={t('activo')} />
                                            : <Estado tipo="inactivo" texto={t('inactivo')} />}
                                    </td>
                                    <td>
                                        <button type="button" className="boton-secundario boton-pequeno"
                                            onClick={function () { editar(s); }}>{t('editar')}</button>
                                        <button type="button" className="boton-secundario boton-pequeno"
                                            onClick={function () { cambiarActivo(s.id_sociedad); }}>
                                            {s.activo_sociedad ? t('desactivar') : t('activar')}
                                        </button>
                                        <button type="button" className="boton-peligro boton-pequeno"
                                            onClick={function () { borrar(s.id_sociedad); }}>{t('borrar')}</button>
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
