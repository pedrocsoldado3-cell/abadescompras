// =====================================================================
// ARCHIVO: src/componentes/Pagina.jsx
// Envoltorio que usan todas las páginas. Pone:
//   - el título de la pestaña del navegador (document.title)
//   - el <h1> de la página
//   - y debajo, el contenido de la página (children)
// Uso:  <Pagina titulo={t('menu_pedidos')}> ...contenido... </Pagina>
// =====================================================================

import { useEffect } from 'react';


// ---------------------------------------------------------------------
// useEffect con [titulo]: se ejecuta al mostrar la página y cada vez
// que cambia el título. Cada página
// tiene un título distinto (WCAG: "páginas tituladas").
// ---------------------------------------------------------------------
// oculto: la página pone su propio <h1> (p. ej. la de entrar).
export default function Pagina({ titulo, oculto, children }) {
    useEffect(function () {
        document.title = titulo + ' · Abades Compras';
    }, [titulo]);

    return (
        <>
            {!oculto && <h1 className="titulo">{titulo}</h1>}
            {children}
        </>
    );
}
