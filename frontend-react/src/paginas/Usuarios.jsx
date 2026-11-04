// =====================================================================
// ARCHIVO: src/paginas/Usuarios.jsx   (solo ADMIN)
// Activar cuentas, asignar rol y borrar.
// =====================================================================

import { useState, useEffect } from 'react';
import { useApp } from '../contexto/AppContext.jsx';
import { peticion } from '../servicios/api.js';
import Pagina from '../componentes/Pagina.jsx';
import Mensaje from '../componentes/Mensaje.jsx';
import Estado from '../componentes/Estado.jsx';


export default function Usuarios() {
    const { t } = useApp();

    // -----------------------------------------------------------------
    // usuarios  -> lista del backend
    // cambios   -> lo que el admin va eligiendo en cada fila antes de
    //              pulsar Guardar: { 7: { rol: 'USUARIO', activo: true } }
    // -----------------------------------------------------------------
    const [usuarios, setUsuarios] = useState([]);
    const [centros, setCentros] = useState([]);
    const [editandoCentros, setEditandoCentros] = useState(null);
    const [marcados, setMarcados] = useState([]);
    const [cambios, setCambios] = useState({});
    const [mensaje, setMensaje] = useState(null);


    // -----------------------------------------------------------------
    // cargar(): pide la lista y prepara "cambios" con los valores
    // actuales de cada usuario (rol vacío si no tiene).
    // -----------------------------------------------------------------
    async function cargar() {
        try {
            const lista = await peticion('GET', '/usuarios');
            setCentros(await peticion('GET', '/centros'));
            const iniciales = {};
            for (const u of lista) {
                iniciales[u.id_usuario] = { rol: u.rol || '', activo: u.activo_usuario };
            }
            setUsuarios(lista);
            setCambios(iniciales);
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    useEffect(function () {
        cargar();
    }, []);


    // -----------------------------------------------------------------
    // cambiar(id, campo, valor): actualiza el rol o la casilla de una fila.
    // -----------------------------------------------------------------
    function cambiar(id, campo, valor) {
        setCambios({ ...cambios, [id]: { ...cambios[id], [campo]: valor } });
    }


    // -----------------------------------------------------------------
    // guardar(id): manda el rol y si está activa. Una cuenta necesita rol.
    // -----------------------------------------------------------------
    async function guardar(id) {
        const datos = cambios[id];
        if (datos.rol === '') {
            setMensaje({ texto: t('error_rol'), tipo: 'error' });
            return;
        }
        try {
            const respuesta = await peticion('PUT', '/usuarios/' + id, { rol: datos.rol, activo_usuario: datos.activo });
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
            cargar();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    // -----------------------------------------------------------------
    // Centros de un USUARIO: se abre un panel con casillas.
    // -----------------------------------------------------------------
    function abrirCentros(u) {
        setEditandoCentros(u);
        setMarcados(u.centros);
    }

    function alternarCentro(id) {
        setMarcados(marcados.includes(id)
            ? marcados.filter(function (m) { return m !== id; })
            : marcados.concat(id));
    }

    async function guardarCentros() {
        try {
            const respuesta = await peticion('PUT', '/usuarios/' + editandoCentros.id_usuario + '/centros', { ids: marcados });
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
            setEditandoCentros(null);
            cargar();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    function nombresCentros(u) {
        if (u.rol === 'ADMIN') {
            return t('centros_admin');
        }
        const nombres = centros
            .filter(function (c) { return u.centros.includes(c.id_centro); })
            .map(function (c) { return c.numero_serie; });
        return nombres.length ? nombres.join(', ') : t('sin_centros');
    }


    async function borrar(id) {
        if (!window.confirm(t('confirmar_borrar'))) {
            return;
        }
        try {
            const respuesta = await peticion('DELETE', '/usuarios/' + id);
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
            cargar();
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }


    // -----------------------------------------------------------------
    // Tabla. El <select> y el checkbox son controlados por "cambios".
    // En el checkbox se usa checked (no value) y e.target.checked.
    // "cambios[u.id_usuario] || {}" evita un error en el primer dibujo,
    // antes de que cambios esté relleno.
    // -----------------------------------------------------------------
    return (
        <Pagina titulo={t('menu_usuarios')}>
            <Mensaje mensaje={mensaje} />

            {editandoCentros !== null && (
                <section className="caja" aria-live="polite">
                    <h2 className="subtitulo">{t('editar_centros_de')}: {editandoCentros.nombre_completo}</h2>
                    <ul className="mb-3">
                        {centros.map(function (c) {
                            const idCasilla = 'centro-' + c.id_centro;
                            return (
                                <li key={c.id_centro} className="py-0.5">
                                    <input id={idCasilla} type="checkbox" className="mr-2 h-4 w-4 align-middle"
                                        checked={marcados.includes(c.id_centro)}
                                        onChange={function () { alternarCentro(c.id_centro); }} />
                                    <label htmlFor={idCasilla} className={c.activo_centro ? '' : 'text-gray-500'}>
                                        {c.numero_serie} · {c.nombre_centro}{c.activo_centro ? '' : ' (' + t('inactivo') + ')'}
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                    <button type="button" className="boton mr-2" onClick={guardarCentros}>{t('guardar')}</button>
                    <button type="button" className="boton-secundario" onClick={function () { setEditandoCentros(null); }}>{t('cancelar')}</button>
                </section>
            )}

            <div className="caja overflow-x-auto">
                <table className="tabla">
                    <caption>{t('usuarios_caption')}</caption>
                    <thead>
                        <tr>
                            <th scope="col">{t('usuario')}</th>
                            <th scope="col">{t('nombre_completo')}</th>
                            <th scope="col">{t('email')}</th>
                            <th scope="col">{t('rol')}</th>
                            <th scope="col">{t('activa')}</th>
                            <th scope="col">{t('centros_usuario')}</th>
                            <th scope="col">{t('acciones')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {usuarios.map(function (u) {
                            const id = u.id_usuario;
                            const fila = cambios[id] || { rol: '', activo: false };
                            return (
                                <tr key={id} className="even:bg-gray-50">
                                    <td>
                                        {u.nombre_usuario}{' '}
                                        {!u.activo_usuario && <Estado tipo="pendiente" texto={t('pendiente_activar')} />}
                                    </td>
                                    <td>{u.nombre_completo}</td>
                                    <td>{u.email_usuario}</td>
                                    <td>
                                        <select className="campo" value={fila.rol} aria-label={t('rol') + ' ' + u.nombre_usuario}
                                            onChange={function (e) { cambiar(id, 'rol', e.target.value); }}>
                                            <option value="">{t('sin_rol')}</option>
                                            <option value="USUARIO">USUARIO</option>
                                            <option value="ADMIN">ADMIN</option>
                                        </select>
                                    </td>
                                    <td>
                                        <input type="checkbox" className="h-5 w-5" checked={fila.activo}
                                            aria-label={t('activa') + ' ' + u.nombre_usuario}
                                            onChange={function (e) { cambiar(id, 'activo', e.target.checked); }} />
                                    </td>
                                    <td>
                                        {nombresCentros(u)}{' '}
                                        {u.rol === 'USUARIO' && (
                                            <button type="button" className="boton-secundario boton-pequeno"
                                                onClick={function () { abrirCentros(u); }}>{t('editar')}</button>
                                        )}
                                    </td>
                                    <td>
                                        <button type="button" className="boton boton-pequeno"
                                            onClick={function () { guardar(id); }}>{t('guardar')}</button>
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
