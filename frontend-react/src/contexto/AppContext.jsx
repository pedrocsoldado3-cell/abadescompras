// =====================================================================
// ARCHIVO: src/contexto/AppContext.jsx
// "Contexto" de React: un almacén de datos al que puede acceder
// cualquier componente sin tener que pasarle props de padre a hijo.
// Aquí guardamos lo que necesita toda la aplicación:
//   - usuario   -> quién ha iniciado sesión (o null)
//   - funciones -> iniciarSesion, cerrarSesion y t()
// =====================================================================

import { createContext, useContext, useState } from 'react';
import TEXTOS from '../idioma/textos.js';
import { guardarSesion, leerUsuario, borrarSesion } from '../servicios/api.js';


// ---------------------------------------------------------------------
// Creamos el contexto vacío. Lo rellenará el componente AppProvider.
// ---------------------------------------------------------------------
const AppContext = createContext(null);


// ---------------------------------------------------------------------
// AppProvider: componente que envuelve a toda la app (ver main.jsx) y
// le "provee" los datos. {children} son los componentes de dentro.
// ---------------------------------------------------------------------
export function AppProvider({ children }) {

    // -----------------------------------------------------------------
    // useState guarda un dato que, al cambiar, hace que React vuelva a
    // dibujar los componentes que lo usan.
    // El valor inicial se lee de localStorage, así al recargar la página
    // se conserva la sesión.
    // -----------------------------------------------------------------
    const [usuario, setUsuario] = useState(leerUsuario());


    // -----------------------------------------------------------------
    // Funciones que podrán usar los componentes.
    // iniciarSesion guarda en localStorage Y en el estado (para que el
    // menú se redibuje al momento con las opciones del rol).
    // -----------------------------------------------------------------
    function iniciarSesion(token, datosUsuario) {
        guardarSesion(token, datosUsuario);
        setUsuario(datosUsuario);
    }

    function cerrarSesion() {
        borrarSesion();
        setUsuario(null);
    }

    // -----------------------------------------------------------------
    // t('clave'): devuelve el texto de la interfaz. Si la clave no
    // existe, devuelve la propia clave para ver qué falta.
    // -----------------------------------------------------------------
    function t(clave) {
        return TEXTOS[clave] || clave;
    }


    // -----------------------------------------------------------------
    // Todo lo que pongamos en "value" estará disponible en la app.
    // -----------------------------------------------------------------
    return (
        <AppContext.Provider value={{ usuario, t, iniciarSesion, cerrarSesion }}>
            {children}
        </AppContext.Provider>
    );
}


// ---------------------------------------------------------------------
// useApp(): atajo para leer el contexto desde cualquier componente:
//   const { usuario, t } = useApp();
// ---------------------------------------------------------------------
export function useApp() {
    return useContext(AppContext);
}
