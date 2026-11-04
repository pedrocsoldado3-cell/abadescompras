// =====================================================================
// ARCHIVO: src/componentes/Cabecera.jsx
// Barra superior con el nombre de la aplicación.
// =====================================================================

export default function Cabecera() {
    return (
        <header className="flex flex-wrap items-center justify-between gap-2 bg-blue-800 px-3 py-2 text-white sm:px-5">
            <p className="text-xl font-bold">Pedidos HORECA</p>
        </header>
    );
}
