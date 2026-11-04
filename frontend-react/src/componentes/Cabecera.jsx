// =====================================================================
// ARCHIVO: src/componentes/Cabecera.jsx
// Barra superior: logo, botón del menú (en móvil) y, con sesión, el
// nombre del usuario y el botón de salir.
// =====================================================================

import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../contexto/AppContext.jsx';


export default function Cabecera({ menuAbierto, alternarMenu }) {
    const { usuario, cerrarSesion, t } = useApp();
    const navegar = useNavigate();

    function salir() {
        cerrarSesion();
        navegar('/login');
    }

    return (
        <header className="sticky top-0 z-30 bg-white shadow-sm">
            <div className="flex h-[60px] items-center justify-between gap-3 px-3 sm:px-5">
                <div className="flex items-center gap-2">
                    {usuario && (
                        <button type="button" className="rounded-lg p-2 text-marca-gris hover:bg-marca-suave lg:hidden"
                            aria-expanded={menuAbierto} aria-controls="menu-principal" onClick={alternarMenu}>
                            <span className="sr-only">{menuAbierto ? t('cerrar_menu') : t('abrir_menu')}</span>
                            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                {menuAbierto
                                    ? <path d="M6 6l12 12M18 6L6 18" />
                                    : <path d="M4 7h16M4 12h16M4 17h16" />}
                            </svg>
                        </button>
                    )}
                    <Link to={usuario ? '/inicio' : '/login'} className="flex items-center gap-2 no-underline" aria-label="Abades Compras, inicio">
                        <img src="/icono-abades.png" alt="" className="h-9 w-9" />
                        <span aria-hidden="true" className="font-marca text-lg leading-none font-bold tracking-tight">
                            <span className="text-marca-gris">ABADES</span> <span className="text-marca-rojo">COMPRAS</span>
                        </span>
                    </Link>
                </div>

                {usuario && (
                    <div className="flex items-center gap-3">
                        <div className="hidden text-right leading-tight sm:block">
                            <p className="text-sm font-semibold text-marca-gris">{usuario.nombre}</p>
                            <p className="text-xs text-marca-gris-medio">{usuario.rol === 'ADMIN' ? t('rol_admin') : t('rol_usuario')}</p>
                        </div>
                        <span aria-hidden="true" className="hidden h-9 w-9 shrink-0 items-center sm:flex justify-center rounded-full bg-marca-gris text-sm font-bold text-white">
                            {String(usuario.nombre || '?').trim().charAt(0).toUpperCase()}
                        </span>
                        <button type="button" onClick={salir} className="boton-secundario boton-pequeno m-0 whitespace-nowrap">{t('menu_salir')}</button>
                    </div>
                )}
            </div>
            <div className="linea-marca" aria-hidden="true"></div>
        </header>
    );
}
