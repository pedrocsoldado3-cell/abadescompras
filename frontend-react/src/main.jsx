// =====================================================================
// ARCHIVO: src/main.jsx  (punto de entrada del FRONT-END con React)
// Busca el <div id="root"> de index.html y dibuja dentro el componente
// <App />. También envuelve la app con:
//   - <BrowserRouter>: permite tener varias "páginas" con su URL
//     (/login, /pedidos...) sin recargar el navegador.
//   - <AppProvider>: comparte la sesión con toda la app.
// =====================================================================

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AppProvider } from './contexto/AppContext.jsx';
import './index.css';


// ---------------------------------------------------------------------
// createRoot(...).render(...) arranca React.
// <StrictMode> solo actúa en desarrollo: avisa de errores comunes en la
// consola (por eso en desarrollo algunos useEffect se ejecutan 2 veces).
// ---------------------------------------------------------------------
createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter>
            <AppProvider>
                <App />
            </AppProvider>
        </BrowserRouter>
    </StrictMode>
);
