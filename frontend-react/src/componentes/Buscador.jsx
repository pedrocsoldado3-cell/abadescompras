// =====================================================================
// ARCHIVO: src/componentes/Buscador.jsx
// Campo para elegir un elemento de una lista larga escribiendo: según
// escribes va mostrando las coincidencias (sin distinguir mayúsculas ni
// tildes; todas las palabras escritas deben aparecer). Se elige con el
// ratón, con el dedo o con las flechas + Enter. Escape cierra la lista.
//
// Sigue el patrón "combobox" de WAI-ARIA para que funcione con lector
// de pantalla.
//
//   opciones: [{ valor, texto, detalle?, busqueda? }]
//     texto    -> lo que se ve al elegir
//     detalle  -> línea pequeña debajo (código, EAN...)
//     busqueda -> texto extra por el que también se puede buscar
//   valor / onChange(valor) -> el valor elegido ('' si ninguno)
// =====================================================================

import { useState, useEffect, useRef } from 'react';

const MAX_RESULTADOS = 50;

function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}


export default function Buscador({ id, opciones, valor, onChange, required, placeholder, sinResultados }) {
    const elegida = opciones.find(function (o) { return String(o.valor) === String(valor); });
    const [texto, setTexto] = useState(elegida ? elegida.texto : '');
    const [abierto, setAbierto] = useState(false);
    const [activa, setActiva] = useState(0);
    const campo = useRef(null);
    const lista = useRef(null);
    const cambioInterno = useRef(false);

    // Si el valor cambia desde fuera (editar otra fila, vaciar el
    // formulario), el texto del campo se pone al día.
    useEffect(function () {
        if (cambioInterno.current) {
            cambioInterno.current = false;
            return;
        }
        setTexto(elegida ? elegida.texto : '');
    }, [valor, opciones.length]);

    // Texto escrito que no corresponde a ninguna opción elegida: el
    // formulario no se puede enviar hasta que se elija una de la lista.
    useEffect(function () {
        if (campo.current) {
            campo.current.setCustomValidity(texto && !elegida ? 'Elige una opción de la lista' : '');
        }
    }, [texto, valor]);

    const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
    const filtradas = (elegida && texto === elegida.texto ? opciones : opciones.filter(function (o) {
        const donde = normalizar(o.texto + ' ' + (o.detalle || '') + ' ' + (o.busqueda || ''));
        return palabras.every(function (p) { return donde.includes(p); });
    })).slice(0, MAX_RESULTADOS);

    // Mantiene visible la opción activa al moverse con las flechas.
    useEffect(function () {
        const el = lista.current && lista.current.querySelector('[data-indice="' + activa + '"]');
        if (el) {
            el.scrollIntoView({ block: 'nearest' });
        }
    }, [activa, abierto]);

    function elegir(o) {
        cambioInterno.current = String(o.valor) !== String(valor);
        setTexto(o.texto);
        setAbierto(false);
        onChange(o.valor);
    }

    function escribir(e) {
        setTexto(e.target.value);
        setAbierto(true);
        setActiva(0);
        if (valor !== '' && valor !== null && valor !== undefined) {
            cambioInterno.current = true;
            onChange('');
        }
    }

    function tecla(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setAbierto(true);
            setActiva(Math.min(activa + 1, filtradas.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiva(Math.max(activa - 1, 0));
        } else if (e.key === 'Enter' && abierto && filtradas[activa]) {
            e.preventDefault();
            elegir(filtradas[activa]);
        } else if (e.key === 'Escape' && abierto) {
            e.stopPropagation();
            setAbierto(false);
        }
    }

    return (
        <div className="relative">
            <input id={id} ref={campo} type="text" role="combobox" autoComplete="off" required={required}
                aria-expanded={abierto} aria-controls={id + '-lista'} aria-autocomplete="list"
                aria-activedescendant={abierto && filtradas[activa] ? id + '-op-' + activa : undefined}
                className="campo pr-9" placeholder={placeholder} value={texto}
                onChange={escribir} onKeyDown={tecla}
                onFocus={function (e) { e.target.select(); setAbierto(true); setActiva(0); }}
                onBlur={function () { setTimeout(function () { setAbierto(false); }, 150); }} />
            <svg aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-marca-gris-medio"
                width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
            </svg>

            {abierto && (
                <ul id={id + '-lista'} ref={lista} role="listbox"
                    className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-marca-borde bg-white py-1 shadow-lg">
                    {filtradas.length === 0 && (
                        <li className="px-3 py-2 text-sm text-marca-gris-medio">{sinResultados || 'Sin coincidencias'}</li>
                    )}
                    {filtradas.map(function (o, i) {
                        const marcada = String(o.valor) === String(valor);
                        return (
                            <li key={o.valor} id={id + '-op-' + i} data-indice={i} role="option" aria-selected={marcada}
                                className={'cursor-pointer px-3 py-2 ' + (i === activa ? 'bg-marca-rojo-suave' : '') + (marcada ? ' font-bold' : '')}
                                onMouseDown={function (e) { e.preventDefault(); elegir(o); }}
                                onMouseEnter={function () { setActiva(i); }}>
                                <span className="block">{o.texto}</span>
                                {o.detalle && <span className="block text-xs text-marca-gris-medio">{o.detalle}</span>}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
