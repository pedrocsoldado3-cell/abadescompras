// =====================================================================
// ARCHIVO: src/App.jsx
// Componente principal. Dibuja la estructura que se repite en todas
// las páginas (cabecera, menú, pie) y decide qué página mostrar según
// la URL, con React Router.
// =====================================================================

import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Cabecera from './componentes/Cabecera.jsx';
import Menu from './componentes/Menu.jsx';
import RutaProtegida from './componentes/RutaProtegida.jsx';
import { useApp } from './contexto/AppContext.jsx';

import Login from './paginas/Login.jsx';
import Registro from './paginas/Registro.jsx';
import Inicio from './paginas/Inicio.jsx';
import NuevaSolicitud from './paginas/NuevaSolicitud.jsx';
import Solicitudes from './paginas/Solicitudes.jsx';
import Pedidos from './paginas/Pedidos.jsx';
import Usuarios from './paginas/Usuarios.jsx';
import Proveedores from './paginas/Proveedores.jsx';
import Articulos from './paginas/Articulos.jsx';
import Tarifas from './paginas/Tarifas.jsx';
import Sociedades from './paginas/Sociedades.jsx';
import Centros from './paginas/Centros.jsx';
import ExportarErp from './paginas/ExportarErp.jsx';
import Importar from './paginas/Importar.jsx';
import PlantillasExportacion from './paginas/PlantillasExportacion.jsx';
import Configuracion from './paginas/Configuracion.jsx';
import Ayuda from './paginas/Ayuda.jsx';


export default function App() {
    const { t, usuario } = useApp();
    const [menuAbierto, setMenuAbierto] = useState(false);
    const ubicacion = useLocation();

    // Al cambiar de página se cierra el menú del móvil; con Escape también.
    useEffect(function () {
        setMenuAbierto(false);
    }, [ubicacion.pathname]);

    useEffect(function () {
        function tecla(e) {
            if (e.key === 'Escape') {
                setMenuAbierto(false);
            }
        }
        window.addEventListener('keydown', tecla);
        return function () { window.removeEventListener('keydown', tecla); };
    }, []);

    // -----------------------------------------------------------------
    // Estructura de la página:
    //   - Enlace "Saltar al contenido" (WCAG). Con las clases sr-only
    //     está oculto, y focus:not-sr-only lo enseña al llegar con Tab.
    //   - Cabecera y menú.
    //   - <main> con la página que toca según la URL.
    // -----------------------------------------------------------------
    return (
        <>
            <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2 focus:text-marca-rojo">
                {t('saltar')}
            </a>
            <Cabecera menuAbierto={menuAbierto} alternarMenu={function () { setMenuAbierto(!menuAbierto); }} />

            {/* Con sesión: menú lateral + contenido. Sin sesión: contenido
                centrado y estrecho (entrar, registrarse, ayuda). */}
            <div className={usuario ? 'lg:flex' : ''}>
            {usuario && <Menu abierto={menuAbierto} cerrar={function () { setMenuAbierto(false); }} />}

            <main id="contenido" className={usuario ? 'mx-auto w-full max-w-7xl min-w-0 flex-1 p-4 sm:p-6 lg:p-8' : 'mx-auto max-w-3xl p-4 sm:p-8'}>
                {/* -----------------------------------------------------
                    <Routes> mira la URL y dibuja el <Route> que coincide.
                    Las páginas privadas van dentro de <RutaProtegida>,
                    que comprueba la sesión (y el rol si soloAdmin).
                    ":id" en la ruta es un parámetro: /solicitudes/editar/5
                    La ruta "*" atrapa cualquier URL que no exista.
                    ----------------------------------------------------- */}
                <Routes>
                    <Route path="/" element={<Navigate to={usuario ? '/inicio' : '/login'} />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/registro" element={<Registro />} />
                    <Route path="/ayuda" element={<Ayuda />} />

                    <Route path="/inicio" element={<RutaProtegida><Inicio /></RutaProtegida>} />
                    <Route path="/nueva-solicitud" element={<RutaProtegida><NuevaSolicitud /></RutaProtegida>} />
                    <Route path="/solicitudes/editar/:id" element={<RutaProtegida><NuevaSolicitud /></RutaProtegida>} />
                    <Route path="/solicitudes" element={<RutaProtegida><Solicitudes /></RutaProtegida>} />
                    <Route path="/pedidos" element={<RutaProtegida><Pedidos /></RutaProtegida>} />

                    <Route path="/usuarios" element={<RutaProtegida soloAdmin><Usuarios /></RutaProtegida>} />
                    <Route path="/proveedores" element={<RutaProtegida soloAdmin><Proveedores /></RutaProtegida>} />
                    <Route path="/articulos" element={<RutaProtegida soloAdmin><Articulos /></RutaProtegida>} />
                    <Route path="/tarifas" element={<RutaProtegida soloAdmin><Tarifas /></RutaProtegida>} />
                    <Route path="/sociedades" element={<RutaProtegida soloAdmin><Sociedades /></RutaProtegida>} />
                    <Route path="/centros" element={<RutaProtegida soloAdmin><Centros /></RutaProtegida>} />
                    <Route path="/importar" element={<RutaProtegida soloAdmin><Importar /></RutaProtegida>} />
                    <Route path="/plantillas-exportacion" element={<RutaProtegida soloAdmin><PlantillasExportacion /></RutaProtegida>} />
                    <Route path="/exportar-erp" element={<RutaProtegida soloAdmin><ExportarErp /></RutaProtegida>} />
                    <Route path="/configuracion" element={<RutaProtegida soloAdmin><Configuracion /></RutaProtegida>} />

                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </main>
            </div>
        </>
    );
}
