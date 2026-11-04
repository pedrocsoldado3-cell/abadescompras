// =====================================================================
// ARCHIVO: src/paginas/Ayuda.jsx
// Página de AYUDA. Se puede abrir sin sesión.
// <details>/<summary> crea apartados plegables sin
// JavaScript y se pueden abrir con el teclado (Intro o espacio).
// =====================================================================

import { useApp } from '../contexto/AppContext.jsx';
import Pagina from '../componentes/Pagina.jsx';


// ---------------------------------------------------------------------
// Texto de la ayuda. Es un componente que solo devuelve JSX.
// ---------------------------------------------------------------------
function AyudaEs() {
    return (
        <div>
            <p className="caja">Esta aplicación sirve para pedir mercancía a los proveedores del restaurante. El personal pide lo que necesita <strong>sin ver precios</strong> y el sistema elige automáticamente el proveedor más barato para cada artículo.</p>

            <details className="caja" open>
                <summary className="cursor-pointer"><strong>1. Registrarse y entrar</strong></summary>
                <ol className="mt-2 list-decimal pl-6">
                    <li>Pulsa <em>Regístrate aquí</em> en la pantalla de inicio de sesión y rellena tus datos.</li>
                    <li>Tu cuenta queda <strong>pendiente</strong>: un administrador tiene que activarla y darte un rol.</li>
                    <li>Cuando esté activa, entra con tu usuario y contraseña. La sesión dura unas horas; después tendrás que volver a entrar.</li>
                </ol>
            </details>

            <details className="caja">
                <summary className="cursor-pointer"><strong>2. Crear una solicitud de pedido</strong></summary>
                <ol className="mt-2 list-decimal pl-6">
                    <li>Ve a <em>Nueva solicitud</em>. Verás los artículos disponibles.</li>
                    <li>Escribe la <strong>cantidad</strong> solo en lo que necesites (puedes usar el buscador). Las filas vacías no se guardan.</li>
                    <li>Si quieres, añade una observación (por ejemplo: "sin gas").</li>
                    <li>Pulsa <em>Guardar como pendiente</em> para revisarla más tarde, o elige una fecha de entrega y pulsa <em>Guardar y generar pedidos</em> para hacerlo todo de una vez.</li>
                </ol>
            </details>

            <details className="caja">
                <summary className="cursor-pointer"><strong>3. Modificar, eliminar o procesar una solicitud</strong></summary>
                <p className="mt-2">En <em>Solicitudes</em> puedes ver el detalle de cada una. Mientras esté <strong>PENDIENTE</strong> puedes editarla, eliminarla o pulsar <em>Generar pedidos</em> (te pedirá la fecha de entrega). Una vez procesada ya no se puede cambiar.</p>
            </details>

            <details className="caja">
                <summary className="cursor-pointer"><strong>4. ¿Cómo se eligen los proveedores?</strong></summary>
                <p className="mt-2">Para cada artículo, el sistema calcula el precio neto de cada proveedor (precio menos descuento) y elige el más barato. Si hay empate, gana el proveedor más antiguo. Después agrupa los artículos y crea <strong>un pedido por proveedor</strong>.</p>
            </details>

            <details className="caja">
                <summary className="cursor-pointer"><strong>5. Enviar un pedido y marcarlo como tramitado</strong></summary>
                <ol className="mt-2 list-decimal pl-6">
                    <li>En <em>Pedidos</em>, pulsa <em>Enviar correo</em>. Se abrirá tu programa de correo con el pedido escrito (sin precios), el proveedor como destinatario y los administradores en copia.</li>
                    <li>Revisa y envía el correo desde tu programa.</li>
                    <li>Vuelve a la aplicación y pulsa <em>Marcar tramitado</em>. <strong>Esta acción no se puede deshacer.</strong></li>
                </ol>
                <p className="mt-2">Si no se abre nada al pulsar <em>Enviar correo</em>, configura un programa de correo predeterminado en tu equipo (Outlook, Thunderbird...).</p>
            </details>

            <details className="caja">
                <summary className="cursor-pointer"><strong>6. Solo para administradores</strong></summary>
                <ul className="mt-2 list-disc pl-6">
                    <li><em>Usuarios</em>: activa las cuentas nuevas y elige su rol (USUARIO o ADMIN).</li>
                    <li><em>Proveedores</em> y <em>Artículos</em>: alta, edición, activar/desactivar y borrar. Solo se puede borrar lo que no tiene historial; si no, desactívalo.</li>
                    <li><em>Tarifas</em>: indica qué proveedor vende cada artículo, su referencia, precio y descuento. Un artículo solo aparece a los usuarios si tiene al menos una tarifa activa.</li>
                    <li>Los administradores ven las solicitudes de todos los usuarios y los importes de los pedidos.</li>
                </ul>
            </details>

            <details className="caja">
                <summary className="cursor-pointer"><strong>7. Accesibilidad</strong></summary>
                <p className="mt-2">Puedes usar toda la aplicación con el teclado: <kbd className="rounded border border-marca-borde px-1">Tab</kbd> para avanzar, <kbd className="rounded border border-marca-borde px-1">Mayús</kbd>+<kbd className="rounded border border-marca-borde px-1">Tab</kbd> para retroceder e <kbd className="rounded border border-marca-borde px-1">Intro</kbd> para pulsar. El primer enlace de cada página permite saltar directamente al contenido. Los mensajes de error se anuncian a los lectores de pantalla.</p>
            </details>
        </div>
    );
}


// ---------------------------------------------------------------------
// Componente de la página.
// ---------------------------------------------------------------------
export default function Ayuda() {
    const { t } = useApp();
    return (
        <Pagina titulo={t('menu_ayuda')}>
            <AyudaEs />
        </Pagina>
    );
}
