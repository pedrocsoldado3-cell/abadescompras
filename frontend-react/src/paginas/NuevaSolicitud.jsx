// =====================================================================
// ARCHIVO: src/paginas/NuevaSolicitud.jsx
// Crear o editar una solicitud.
//   /nueva-solicitud           -> crear
//   /solicitudes/editar/:id    -> editar la solicitud :id (si PENDIENTE)
// Muestra el catálogo SIN precios; las filas sin cantidad se descartan.
// =====================================================================

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../contexto/AppContext.jsx';
import { peticion, fechaHoy } from '../servicios/api.js';
import Pagina from '../componentes/Pagina.jsx';
import Mensaje from '../componentes/Mensaje.jsx';


export default function NuevaSolicitud() {
    const { t } = useApp();
    const navegar = useNavigate();

    // -----------------------------------------------------------------
    // useParams() lee los parámetros de la URL. En /solicitudes/editar/7
    // id vale '7'; en /nueva-solicitud vale undefined (estamos creando).
    // -----------------------------------------------------------------
    const { id } = useParams();
    const editando = id !== undefined;

    // -----------------------------------------------------------------
    // Estado de la página:
    //   articulos -> catálogo que llega del backend
    //   lineas    -> lo que escribe el usuario, guardado por id de artículo:
    //                { 3: { cantidad: '2', observaciones: 'sin gas' }, ... }
    //   buscar    -> texto del buscador
    //   fecha     -> fecha de entrega (solo para "guardar y generar")
    //   bloqueada -> true si se intenta editar una solicitud ya procesada
    // -----------------------------------------------------------------
    const [articulos, setArticulos] = useState([]);
    const [centros, setCentros] = useState([]);
    const [idCentro, setIdCentro] = useState('');
    const [centroSolicitud, setCentroSolicitud] = useState(null);
    const [lineas, setLineas] = useState({});
    const [buscar, setBuscar] = useState('');
    const [fecha, setFecha] = useState('');
    const [bloqueada, setBloqueada] = useState(false);
    const [mensaje, setMensaje] = useState(null);


    // -----------------------------------------------------------------
    // Al abrir: cargamos los centros del usuario. Si editamos, el centro
    // es el de la solicitud (no se puede cambiar). Si es nueva, se elige
    // el primero (o el último usado, guardado en localStorage).
    // -----------------------------------------------------------------
    useEffect(function () {
        async function cargar() {
            try {
                setMensaje(null);
                setBloqueada(false);
                const lista = await peticion('GET', '/centros/mios');
                setCentros(lista);

                if (id !== undefined) {
                    const solicitud = await peticion('GET', '/solicitudes/' + id);
                    const iniciales = {};
                    for (const l of solicitud.lineas) {
                        iniciales[l.id_articulo] = { cantidad: String(Number(l.cantidad)), observaciones: l.observaciones || '' };
                    }
                    setLineas(iniciales);
                    setCentroSolicitud(solicitud);
                    setIdCentro(String(solicitud.id_centro));
                    if (solicitud.estado !== 'PENDIENTE') {
                        setBloqueada(true);
                        setMensaje({ texto: t('error_no_pendiente'), tipo: 'error' });
                    }
                } else {
                    setLineas({});
                    setCentroSolicitud(null);
                    if (lista.length === 0) {
                        setIdCentro('');
                        setMensaje({ texto: t('error_sin_centro'), tipo: 'error' });
                        return;
                    }
                    let guardado = '';
                    try { guardado = localStorage.getItem('ultimo_centro') || ''; } catch (e) { guardado = ''; }
                    const existe = lista.some(function (c) { return String(c.id_centro) === guardado; });
                    setIdCentro(existe ? guardado : String(lista[0].id_centro));
                }
            } catch (error) {
                setMensaje({ texto: error.message, tipo: 'error' });
            }
        }
        cargar();
    }, [id]);


    // -----------------------------------------------------------------
    // Cada vez que cambia el centro, cargamos SU catálogo.
    // -----------------------------------------------------------------
    useEffect(function () {
        if (idCentro === '') {
            setArticulos([]);
            return;
        }
        async function cargarCatalogo() {
            try {
                setArticulos(await peticion('GET', '/catalogo?centro=' + idCentro));
            } catch (error) {
                setMensaje({ texto: error.message, tipo: 'error' });
            }
        }
        cargarCatalogo();
    }, [idCentro]);


    function cambiarCentro(e) {
        const hayLineas = Object.values(lineas).some(function (l) { return l.cantidad !== ''; });
        if (hayLineas && !window.confirm(t('confirmar_cambiar_centro'))) {
            return;
        }
        setIdCentro(e.target.value);
        setLineas({});
        try { localStorage.setItem('ultimo_centro', e.target.value); } catch (err) { /* sin almacenamiento */ }
    }


    // -----------------------------------------------------------------
    // cambiarLinea(idArticulo, campo, valor): actualiza la cantidad o las
    // observaciones de un artículo. Copiamos el objeto (no se modifica
    // el estado directamente) y la línea de ese artículo.
    // -----------------------------------------------------------------
    function cambiarLinea(idArticulo, campo, valor) {
        const actual = lineas[idArticulo] || { cantidad: '', observaciones: '' };
        setLineas({ ...lineas, [idArticulo]: { ...actual, [campo]: valor } });
    }


    // -----------------------------------------------------------------
    // CONTROL DE TECLAS en las cantidades: bloqueamos e, E, + y - que
    // algunos navegadores dejan escribir en los <input type="number">.
    // -----------------------------------------------------------------
    function bloquearTeclas(e) {
        if (['e', 'E', '+', '-'].includes(e.key)) {
            e.preventDefault();
        }
    }


    // -----------------------------------------------------------------
    // recogerLineas(): convierte el objeto "lineas" en el array que
    // espera el backend, solo con cantidades mayores que 0.
    // Devuelve null si alguna cantidad es incorrecta.
    // Object.keys(lineas) da los ids de artículo como texto.
    // -----------------------------------------------------------------
    function recogerLineas() {
        const resultado = [];
        for (const idArticulo of Object.keys(lineas)) {
            const linea = lineas[idArticulo];
            if (linea.cantidad === '') {
                continue;
            }
            const cantidad = parseFloat(linea.cantidad);
            if (isNaN(cantidad) || cantidad < 0) {
                return null;
            }
            if (cantidad === 0) {
                continue;
            }
            resultado.push({
                id_articulo: parseInt(idArticulo),
                cantidad: cantidad,
                observaciones: linea.observaciones.trim()
            });
        }
        return resultado;
    }


    // -----------------------------------------------------------------
    // guardar(generar): común a los dos botones.
    //   generar = false -> guardar como PENDIENTE (o guardar cambios)
    //   generar = true  -> mandar también la fecha para crear los pedidos
    // Al generar, tras 2 segundos vamos a la página de pedidos.
    // -----------------------------------------------------------------
    async function guardar(generar) {
        setMensaje(null);
        const lista = recogerLineas();

        if (lista === null) {
            setMensaje({ texto: t('error_cantidad'), tipo: 'error' });
            return;
        }
        if (lista.length === 0) {
            setMensaje({ texto: t('error_sin_lineas'), tipo: 'error' });
            return;
        }

        if (idCentro === '') {
            setMensaje({ texto: t('error_sin_centro'), tipo: 'error' });
            return;
        }
        const datos = { lineas: lista, id_centro: parseInt(idCentro) };
        if (generar) {
            if (fecha === '' || fecha < fechaHoy()) {
                setMensaje({ texto: t('error_fecha'), tipo: 'error' });
                return;
            }
            datos.fecha_entrega = fecha;
        }

        try {
            let respuesta;
            if (editando) {
                respuesta = await peticion('PUT', '/solicitudes/' + id, datos);
            } else {
                respuesta = await peticion('POST', '/solicitudes', datos);
                setLineas({});
                setFecha('');
            }
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });

            if (generar) {
                setTimeout(function () { navegar('/pedidos'); }, 2000);
            }
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }


    // -----------------------------------------------------------------
    // Filtro del buscador: nos quedamos con los artículos cuyo nombre o
    // EAN contienen lo escrito. Como las cantidades se guardan en
    // "lineas" (no en la tabla), no se pierden al filtrar.
    // -----------------------------------------------------------------
    const texto = buscar.trim().toLowerCase();
    const visibles = articulos.filter(function (a) {
        return a.descripcion_articulo.toLowerCase().includes(texto) || (a.ean || '').includes(texto);
    });

    const titulo = editando ? t('editar_solicitud') + ' ' + id : t('menu_nueva');


    // -----------------------------------------------------------------
    // JSX. En la tabla, cada fila tiene dos inputs controlados cuyo valor
    // sale de "lineas". aria-label les da nombre (no hay <label> visible
    // en cada celda). La columna EAN se oculta en móvil (hidden sm:table-cell).
    // Usamos onSubmit en el formulario y el botón "generar" es type="button"
    // con su propio onClick.
    // -----------------------------------------------------------------
    return (
        <Pagina titulo={titulo}>
            <Mensaje mensaje={mensaje} />

            <div className="mb-3 max-w-md">
                <label htmlFor="centro" className="etiqueta">{t('elige_centro')}</label>
                {editando ? (
                    <p id="centro" className="font-bold">
                        {centroSolicitud ? centroSolicitud.numero_serie + ' · ' + centroSolicitud.nombre_centro : ''}
                    </p>
                ) : (
                    <select id="centro" className="campo" value={idCentro} onChange={cambiarCentro}
                        disabled={centros.length <= 1}>
                        {centros.map(function (c) {
                            return <option key={c.id_centro} value={c.id_centro}>{c.numero_serie} · {c.nombre_centro}</option>;
                        })}
                    </select>
                )}
            </div>

            <div className="mb-3 max-w-md">
                <label htmlFor="buscar" className="etiqueta">{t('buscar_articulo')}</label>
                <input id="buscar" type="search" autoComplete="off" className="campo"
                    value={buscar} onChange={function (e) { setBuscar(e.target.value); }} />
            </div>

            <form onSubmit={function (e) { e.preventDefault(); guardar(false); }}>
                <div className="caja overflow-x-auto">
                    <table className="tabla">
                        <caption>{t('catalogo_caption')}</caption>
                        <thead>
                            <tr>
                                <th scope="col">{t('articulo')}</th>
                                <th scope="col" className="hidden sm:table-cell">{t('ean')}</th>
                                <th scope="col">{t('cantidad')}</th>
                                <th scope="col">{t('observaciones')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibles.length === 0 && (
                                <tr><td colSpan={4}>{t('sin_articulos')}</td></tr>
                            )}
                            {visibles.map(function (a) {
                                const linea = lineas[a.id_articulo] || { cantidad: '', observaciones: '' };
                                return (
                                    <tr key={a.id_articulo} className="even:bg-gray-50">
                                        <td>{a.descripcion_articulo}</td>
                                        <td className="hidden sm:table-cell">{a.ean}</td>
                                        <td>
                                            <input type="number" min="0" step="0.01" max="99999999" inputMode="decimal"
                                                aria-label={t('cantidad') + ': ' + a.descripcion_articulo}
                                                className="campo min-w-20"
                                                value={linea.cantidad}
                                                onKeyDown={bloquearTeclas}
                                                onChange={function (e) { cambiarLinea(a.id_articulo, 'cantidad', e.target.value); }} />
                                        </td>
                                        <td>
                                            <input type="text" maxLength={255}
                                                aria-label={t('observaciones') + ': ' + a.descripcion_articulo}
                                                className="campo min-w-24"
                                                value={linea.observaciones}
                                                onChange={function (e) { cambiarLinea(a.id_articulo, 'observaciones', e.target.value); }} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* El bloque de fecha y el botón de generar solo salen al
                    CREAR. Al editar solo se guardan los cambios. */}
                {!editando && (
                    <fieldset className="caja">
                        <legend className="px-1">{t('generar_ahora')}</legend>
                        <div className="max-w-md">
                            <label htmlFor="fecha_entrega" className="etiqueta">{t('fecha_entrega')}</label>
                            <input id="fecha_entrega" type="date" min={fechaHoy()} aria-describedby="ayuda-fecha"
                                className="campo" value={fecha} onChange={function (e) { setFecha(e.target.value); }} />
                            <p id="ayuda-fecha" className="mt-1 text-sm text-gray-600">{t('ayuda_fecha')}</p>
                        </div>
                    </fieldset>
                )}

                <p>
                    <button type="submit" className="boton mr-2" disabled={bloqueada}>
                        {editando ? t('guardar_cambios') : t('guardar_pendiente')}
                    </button>
                    {!editando && (
                        <button type="button" className="boton-secundario" onClick={function () { guardar(true); }}>
                            {t('guardar_generar')}
                        </button>
                    )}
                </p>
            </form>
        </Pagina>
    );
}
