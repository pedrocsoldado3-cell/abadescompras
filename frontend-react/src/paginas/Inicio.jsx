// =====================================================================
// ARCHIVO: src/paginas/Inicio.jsx
// Panel de inicio: saludo, resumen de pendientes y accesos directos.
// =====================================================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../contexto/AppContext.jsx';
import { peticion } from '../servicios/api.js';
import Pagina from '../componentes/Pagina.jsx';
import Mensaje from '../componentes/Mensaje.jsx';


export default function Inicio() {
    const { usuario, t } = useApp();

    // -----------------------------------------------------------------
    // Los contadores empiezan en '-' hasta que llegan los datos.
    // -----------------------------------------------------------------
    const [solicitudes, setSolicitudes] = useState('-');
    const [pedidos, setPedidos] = useState('-');
    const [cuentas, setCuentas] = useState('-');
    const [mensaje, setMensaje] = useState(null);


    // -----------------------------------------------------------------
    // useEffect con [] se ejecuta UNA vez, al mostrar la página: es el
    // sitio para pedir datos al backend.
    // useEffect no puede ser async directamente, por eso creamos dentro
    // la función cargar() y la llamamos.
    // filter() se queda con los elementos que cumplen la condición.
    // -----------------------------------------------------------------
    useEffect(function () {
        async function cargar() {
            try {
                const listaSolicitudes = await peticion('GET', '/solicitudes');
                setSolicitudes(listaSolicitudes.filter(function (s) { return s.estado === 'PENDIENTE'; }).length);

                const listaPedidos = await peticion('GET', '/compras?estado=PENDIENTE');
                setPedidos(listaPedidos.length);

                if (usuario.rol === 'ADMIN') {
                    const listaUsuarios = await peticion('GET', '/usuarios');
                    setCuentas(listaUsuarios.filter(function (u) { return !u.activo_usuario; }).length);
                }
            } catch (error) {
                setMensaje({ texto: error.message, tipo: 'error' });
            }
        }
        cargar();
    }, [usuario.rol]);


    // -----------------------------------------------------------------
    // Tarjetas de acceso directo. Las generamos con map() a partir de un
    // array para no repetir el mismo JSX cuatro veces.
    // grid + sm:grid-cols-2 + lg:grid-cols-4: 1 columna en móvil, 2 en
    // tablet y 4 en pantallas grandes.
    // -----------------------------------------------------------------
    const tarjetas = [
        ['/nueva-solicitud', 'menu_nueva', 'desc_nueva'],
        ['/solicitudes', 'menu_solicitudes', 'desc_solicitudes'],
        ['/pedidos', 'menu_pedidos', 'desc_pedidos'],
        ['/ayuda', 'menu_ayuda', 'desc_ayuda']
    ];

    return (
        <Pagina titulo={t('hola') + ', ' + usuario.nombre}>
            <Mensaje mensaje={mensaje} />

            <section aria-labelledby="titulo-resumen" className="mb-6">
                <h2 id="titulo-resumen" className="sr-only">{t('resumen')}</h2>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <li className="caja mb-0 border-l-4 border-l-marca-rojo">
                        <p className="text-sm font-semibold text-marca-gris-medio">{t('solicitudes_pendientes')}</p>
                        <p className="font-marca text-3xl font-bold text-marca-gris">{solicitudes}</p>
                    </li>
                    <li className="caja mb-0 border-l-4 border-l-marca-rojo">
                        <p className="text-sm font-semibold text-marca-gris-medio">{t('pedidos_pendientes')}</p>
                        <p className="font-marca text-3xl font-bold text-marca-gris">{pedidos}</p>
                    </li>
                    {usuario.rol === 'ADMIN' && (
                        <li className="caja mb-0 border-l-4 border-l-marca-rojo">
                            <p className="text-sm font-semibold text-marca-gris-medio">{t('usuarios_pendientes')}</p>
                            <p className="font-marca text-3xl font-bold text-marca-gris">{cuentas}</p>
                        </li>
                    )}
                </ul>
            </section>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {tarjetas.map(function (tarjeta) {
                    return (
                        <Link key={tarjeta[0]} to={tarjeta[0]}
                            className="block rounded-xl border border-marca-borde bg-white p-5 text-marca-gris no-underline shadow-sm transition hover:-translate-y-0.5 hover:border-marca-rojo hover:shadow-md">
                            <strong className="mb-1 block font-marca text-lg text-marca-rojo">{t(tarjeta[1])}</strong>
                            <span>{t(tarjeta[2])}</span>
                        </Link>
                    );
                })}
            </div>
        </Pagina>
    );
}
