// =====================================================================
// ARCHIVO: src/componentes/Menu.jsx
// Menú lateral, agrupado por secciones. Solo se muestra con sesión.
// En pantallas grandes está siempre visible; en móvil se abre con el
// botón de la cabecera y se cierra al elegir una opción.
// =====================================================================

import { NavLink } from 'react-router-dom';
import { useApp } from '../contexto/AppContext.jsx';


// [título del grupo (clave de texto) o null, [ [ruta, clave], ... ], soloAdmin]
const GRUPOS = [
    [null, [['/inicio', 'menu_inicio']], false],
    ['grupo_pedidos', [
        ['/nueva-solicitud', 'menu_nueva'],
        ['/solicitudes', 'menu_solicitudes'],
        ['/pedidos', 'menu_pedidos']
    ], false],
    ['grupo_catalogo', [
        ['/proveedores', 'menu_proveedores'],
        ['/articulos', 'menu_articulos'],
        ['/tarifas', 'menu_tarifas'],
        ['/importar', 'menu_importar']
    ], true],
    ['grupo_organizacion', [
        ['/sociedades', 'menu_sociedades'],
        ['/centros', 'menu_centros'],
        ['/usuarios', 'menu_usuarios']
    ], true],
    ['grupo_erp', [
        ['/exportar-erp', 'menu_exportar'],
        ['/plantillas-exportacion', 'plantillas_exportacion'],
        ['/configuracion', 'menu_configuracion']
    ], true],
    [null, [['/ayuda', 'menu_ayuda']], false]
];


export default function Menu({ abierto, cerrar }) {
    const { usuario, t } = useApp();
    const esAdmin = usuario && usuario.rol === 'ADMIN';

    return (
        <>
            {/* Fondo oscuro detrás del menú en móvil; al pulsarlo se cierra. */}
            {abierto && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" aria-hidden="true" onClick={cerrar}></div>}

            {/* La columna gris llega hasta abajo aunque la página sea larga. */}
            <div className="lg:w-64 lg:shrink-0 lg:bg-marca-gris">
            <nav id="menu-principal" aria-label="Menú principal"
                className={'fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto bg-marca-gris px-3 py-4 text-white transition-transform '
                    + 'lg:sticky lg:top-16 lg:z-10 lg:h-[calc(100vh-4rem)] lg:translate-x-0 '
                    + (abierto ? 'translate-x-0' : '-translate-x-full invisible lg:visible')}>
                <div className="mb-3 flex justify-end lg:hidden">
                    <button type="button" onClick={cerrar} className="rounded-lg px-3 py-1 text-sm font-semibold text-white hover:bg-white/10">
                        {t('cerrar_menu')} ✕
                    </button>
                </div>
                {GRUPOS.filter(function (g) { return !g[2] || esAdmin; }).map(function (grupo, i) {
                    return (
                        <div key={i} className="mb-3">
                            {grupo[0] && (
                                <p className="mb-1 px-3 text-xs font-bold tracking-wider text-white/70 uppercase">{t(grupo[0])}</p>
                            )}
                            <ul>
                                {grupo[1].map(function (enlace) {
                                    return (
                                        <li key={enlace[0]}>
                                            <NavLink to={enlace[0]} onClick={cerrar}
                                                className="block rounded-lg border-l-4 border-transparent px-3 py-2 font-medium text-white no-underline hover:bg-white/10 aria-[current=page]:border-marca-rojo aria-[current=page]:bg-white/15 aria-[current=page]:font-bold">
                                                {t(enlace[1])}
                                            </NavLink>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    );
                })}
            </nav>
            </div>
        </>
    );
}
