// =====================================================================
// ARCHIVO: src/componentes/Estado.jsx
// "Pastilla" de color con el estado: PENDIENTE (amarillo), PROCESADO /
// TRAMITADO / Activo (verde) o Inactivo (gris). Siempre lleva texto,
// así la información no depende solo del color (WCAG).
// Uso:  <Estado tipo="pendiente" texto="PENDIENTE" />
// =====================================================================


// ---------------------------------------------------------------------
// Objeto que relaciona cada tipo con sus clases de Tailwind.
// ---------------------------------------------------------------------
const COLORES = {
    pendiente: 'bg-yellow-100 text-yellow-900',
    hecho: 'bg-green-100 text-green-800',
    inactivo: 'bg-gray-200 text-gray-700'
};

export default function Estado({ tipo, texto }) {
    return (
        <span className={'inline-block rounded-full px-2 py-0.5 text-sm font-bold ' + COLORES[tipo]}>
            {texto}
        </span>
    );
}
