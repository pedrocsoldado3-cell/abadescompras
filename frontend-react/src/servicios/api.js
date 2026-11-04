// =====================================================================
// ARCHIVO: src/servicios/api.js
// Todo lo que habla con el BACK-END pasa por aquí: las páginas nunca
// usan fetch() directamente, siempre llaman a peticion().
// =====================================================================


// ---------------------------------------------------------------------
// Dirección del backend. Vite deja leer variables de entorno que
// empiecen por VITE_ con import.meta.env. Si no hay archivo .env,
// usamos localhost:3000.
// ---------------------------------------------------------------------
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';


// ---------------------------------------------------------------------
// Funciones para la sesión en localStorage (memoria del navegador que
// no se borra al cerrarlo). El usuario es un objeto: se guarda como
// texto con JSON.stringify y se recupera con JSON.parse.
// ---------------------------------------------------------------------
export function guardarSesion(token, usuario) {
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(usuario));
}

export function leerToken() {
    return localStorage.getItem('token');
}

export function leerUsuario() {
    const texto = localStorage.getItem('usuario');
    return texto ? JSON.parse(texto) : null;
}

export function borrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
}


// ---------------------------------------------------------------------
// peticion(metodo, ruta, datos)
//   metodo -> 'GET', 'POST', 'PUT' o 'DELETE'
//   ruta   -> por ejemplo '/proveedores'
//   datos  -> objeto a enviar en POST/PUT (opcional)
// Añade el token en la cabecera Authorization si existe. Si el servidor
// responde con error, lanza una excepción con su mensaje para que el
// componente la capture con try/catch y la muestre.
// Si la sesión caduca (401 teniendo token), borramos la sesión y
// volvemos al login recargando la web.
// ---------------------------------------------------------------------
export async function peticion(metodo, ruta, datos) {
    const opciones = {
        method: metodo,
        headers: { 'Content-Type': 'application/json' }
    };

    const token = leerToken();
    if (token) {
        opciones.headers['Authorization'] = 'Bearer ' + token;
    }
    if (datos !== undefined) {
        opciones.body = JSON.stringify(datos);
    }

    // -----------------------------------------------------------------
    // Si el servidor está apagado, fetch falla sin respuesta.
    // -----------------------------------------------------------------
    let respuesta;
    try {
        respuesta = await fetch(API_URL + ruta, opciones);
    } catch (error) {
        throw new Error('No se puede conectar con el servidor. Comprueba que el backend está arrancado.');
    }

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
        if (respuesta.status === 401 && token) {
            alert(resultado.error);
            borrarSesion();
            window.location.href = '/login';
        }
        throw new Error(resultado.error || 'Error');
    }
    return resultado;
}


// ---------------------------------------------------------------------
// descargar(metodo, ruta, datos): pide un archivo al backend (PDF, XML,
// ZIP) con el token y hace que el navegador lo guarde con el nombre que
// indique el servidor.
// ---------------------------------------------------------------------
export async function descargar(metodo, ruta, datos) {
    const opciones = { method: metodo, headers: {} };
    const token = leerToken();
    if (token) {
        opciones.headers['Authorization'] = 'Bearer ' + token;
    }
    if (datos !== undefined) {
        opciones.headers['Content-Type'] = 'application/json';
        opciones.body = JSON.stringify(datos);
    }

    let respuesta;
    try {
        respuesta = await fetch(API_URL + ruta, opciones);
    } catch (error) {
        throw new Error('No se puede conectar con el servidor. Comprueba que el backend está arrancado.');
    }
    if (!respuesta.ok) {
        let mensaje = 'Error al descargar';
        try { mensaje = (await respuesta.json()).error || mensaje; } catch (e) { /* no era JSON */ }
        throw new Error(mensaje);
    }

    const cabecera = respuesta.headers.get('Content-Disposition') || '';
    const coincide = cabecera.match(/filename="([^"]+)"/);
    const nombre = coincide ? coincide[1] : 'descarga';

    const blob = await respuesta.blob();
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}


// ---------------------------------------------------------------------
// Funciones pequeñas de formato que usan varias páginas.
//   formatoNumero(12.6, 2) -> '12,60' (estilo español)
//   fechaHoy()             -> '2026-10-25' (formato de <input type="date">)
// ---------------------------------------------------------------------
export function formatoNumero(valor, decimales) {
    return Number(valor).toLocaleString('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

export function fechaHoy() {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return hoy.getFullYear() + '-' + mes + '-' + dia;
}
