// =====================================================================
// ARCHIVO: src/componentes/RutaProtegida.jsx
// Envuelve las páginas privadas. Si no hay sesión, manda al login; si
// la página es solo para admin y el usuario no lo es, manda a inicio.
// La seguridad de verdad está en el backend (token y rol); esto solo
// evita enseñar pantallas que no van a funcionar.
// =====================================================================

import { Navigate } from 'react-router-dom';
import { useApp } from '../contexto/AppContext.jsx';


// ---------------------------------------------------------------------
// Props:
//   soloAdmin -> true si la página es de administración
//   children  -> la página que se quiere enseñar
// <Navigate> redirige a otra ruta. "replace" sustituye la entrada del
// historial, así el botón "atrás" no vuelve a la página prohibida.
// ---------------------------------------------------------------------
export default function RutaProtegida({ soloAdmin, children }) {
    const { usuario } = useApp();

    if (!usuario) {
        return <Navigate to="/login" replace />;
    }
    if (soloAdmin && usuario.rol !== 'ADMIN') {
        return <Navigate to="/inicio" replace />;
    }
    return children;
}
