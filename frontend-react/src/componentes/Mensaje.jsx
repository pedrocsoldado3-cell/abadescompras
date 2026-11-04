// =====================================================================
// ARCHIVO: src/componentes/Mensaje.jsx
// Caja de aviso verde (todo bien) o roja (error). La usan todas las
// páginas: <Mensaje mensaje={mensaje} />
// donde mensaje es un objeto { texto: '...', tipo: 'ok' | 'error' } o null.
// =====================================================================


// ---------------------------------------------------------------------
// Si no hay mensaje, se dibuja igualmente el <div> vacío con
// role="alert": así, cuando aparezca texto, el lector de pantalla lo
// leerá en voz alta (WCAG). Además del color lleva un borde a la
// izquierda, para no depender solo del color.
// Las clases cambian según el tipo con el operador ternario.
// ---------------------------------------------------------------------
export default function Mensaje({ mensaje }) {
    if (!mensaje) {
        return <div role="alert"></div>;
    }

    const colores = mensaje.tipo === 'ok'
        ? 'border-green-800 bg-green-50 text-green-800'
        : 'border-red-700 bg-red-50 text-red-700';

    return (
        <div role="alert" className={'mb-4 rounded border-l-8 px-4 py-2 ' + colores}>
            {mensaje.texto}
        </div>
    );
}
