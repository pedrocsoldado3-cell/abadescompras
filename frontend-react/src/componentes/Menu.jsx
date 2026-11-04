// =====================================================================
// ARCHIVO: src/componentes/Menu.jsx
// Menú de navegación. Cambia según haya sesión o no y según el rol.
// =====================================================================

import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../contexto/AppContext.jsx';


export default function Menu() {
    const { usuario, cerrarSesion, t } = useApp();
    const navegar = useNavigate();

    // -----------------------------------------------------------------
    // Lista de enlaces: [ruta, clave de traducción].
    // Sin sesión: entrar, registrarse. Con sesión: las de trabajo, y si
    // es ADMIN además las de administración. Ayuda, siempre.
    // -----------------------------------------------------------------
    let enlaces = [];
    if (usuario) {
        enlaces = [
            ['/inicio', 'menu_inicio'],
            ['/nueva-solicitud', 'menu_nueva'],
            ['/solicitudes', 'menu_solicitudes'],
            ['/pedidos', 'menu_pedidos']
        ];
        if (usuario.rol === 'ADMIN') {
            enlaces.push(['/usuarios', 'menu_usuarios']);
            enlaces.push(['/sociedades', 'menu_sociedades']);
            enlaces.push(['/centros', 'menu_centros']);
            enlaces.push(['/proveedores', 'menu_proveedores']);
            enlaces.push(['/articulos', 'menu_articulos']);
            enlaces.push(['/tarifas', 'menu_tarifas']);
            enlaces.push(['/importar', 'menu_importar']);
            enlaces.push(['/exportar-erp', 'menu_exportar']);
            enlaces.push(['/configuracion', 'menu_configuracion']);
        }
    } else {
        enlaces = [
            ['/login', 'menu_login'],
            ['/registro', 'menu_registro']
        ];
    }
    enlaces.push(['/ayuda', 'menu_ayuda']);


    // -----------------------------------------------------------------
    // salir(): cierra la sesión y lleva al login.
    // useNavigate() devuelve una función para cambiar de página por código.
    // -----------------------------------------------------------------
    function salir() {
        cerrarSesion();
        navegar('/login');
    }


    // -----------------------------------------------------------------
    // map() convierte cada elemento del array en un <li>. React necesita
    // una "key" única en cada elemento de una lista; usamos la ruta.
    // <NavLink> es como <a>, pero no recarga la página, y pone solo
    // aria-current="page" en el enlace activo; con la clase de Tailwind
    // aria-[current=page]:underline lo subrayamos.
    // En móvil (por defecto) la lista va en columna (flex-col) y desde
    // el tamaño "sm" (640px) en fila (sm:flex-row).
    // -----------------------------------------------------------------
    return (
        <nav aria-label="Menú principal" className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-300 bg-blue-50 px-3 py-2 sm:px-5">
            <ul className="flex flex-col gap-x-4 gap-y-1 sm:flex-row sm:flex-wrap">
                {enlaces.map(function (enlace) {
                    return (
                        <li key={enlace[0]}>
                            <NavLink
                                to={enlace[0]}
                                className="font-bold text-blue-800 hover:underline aria-[current=page]:underline focus-visible:outline-3 focus-visible:outline-orange-500"
                            >
                                {t(enlace[1])}
                            </NavLink>
                        </li>
                    );
                })}
            </ul>

            {/* Nombre del usuario y botón de salir, solo con sesión.
                {condicion && <elemento>} solo dibuja el elemento si la
                condición es verdadera.
                */}
            {usuario && (
                <p className="text-gray-700">
                    {usuario.nombre} ({usuario.rol}){' '}
                    <button type="button" onClick={salir} className="boton boton-pequeno">{t('menu_salir')}</button>
                </p>
            )}
        </nav>
    );
}
