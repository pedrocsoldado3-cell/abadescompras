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

            <section className="caja" aria-labelledby="titulo-resumen">
                <h2 id="titulo-resumen" className="subtitulo">{t('resumen')}</h2>
                <p>{t('solicitudes_pendientes')}: <strong>{solicitudes}</strong></p>
                <p>{t('pedidos_pendientes')}: <strong>{pedidos}</strong></p>
                {usuario.rol === 'ADMIN' && (
                    <p>{t('usuarios_pendientes')}: <strong>{cuentas}</strong></p>
                )}
            </section>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {tarjetas.map(function (tarjeta) {
                    return (
                        <Link key={tarjeta[0]} to={tarjeta[0]}
                            className="block rounded-md border border-gray-300 bg-white p-4 hover:border-blue-800 focus-visible:outline-3 focus-visible:outline-orange-500">
                            <strong className="block text-lg text-blue-800">{t(tarjeta[1])}</strong>
                            <span>{t(tarjeta[2])}</span>
                        </Link>
                    );
                })}
            </div>
        </Pagina>
    );
}
