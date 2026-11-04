// =====================================================================
// ARCHIVO: src/paginas/Login.jsx
// Inicio de sesión.
// =====================================================================

import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../contexto/AppContext.jsx';
import { peticion } from '../servicios/api.js';
import Pagina from '../componentes/Pagina.jsx';
import Mensaje from '../componentes/Mensaje.jsx';


export default function Login() {
    const { usuario, iniciarSesion, t } = useApp();
    const navegar = useNavigate();

    // -----------------------------------------------------------------
    // Estado del formulario. Cada campo tiene su useState y el <input>
    // muestra ese valor (value) y lo actualiza al escribir (onChange).
    // Esto se llama "componente controlado".
    // -----------------------------------------------------------------
    const [nombre, setNombre] = useState('');
    const [contrasena, setContrasena] = useState('');
    const [mensaje, setMensaje] = useState(null);

    // Si ya hay sesión, no tiene sentido ver el login.
    if (usuario) {
        return <Navigate to="/inicio" replace />;
    }


    // -----------------------------------------------------------------
    // enviar(): se ejecuta al enviar el formulario.
    // e.preventDefault() evita que el navegador recargue la página.
    // Si el login va bien guardamos la sesión en el contexto y vamos a
    // /inicio; si no, mostramos el error del servidor.
    // -----------------------------------------------------------------
    async function enviar(e) {
        e.preventDefault();
        setMensaje(null);

        if (nombre.trim() === '' || contrasena === '') {
            setMensaje({ texto: t('error_campos_login'), tipo: 'error' });
            return;
        }

        try {
            const respuesta = await peticion('POST', '/auth/login', { nombre_usuario: nombre.trim(), contrasena: contrasena });
            iniciarSesion(respuesta.token, respuesta.usuario);
            navegar('/inicio');
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }


    // -----------------------------------------------------------------
    // JSX del formulario. "required" y autoComplete son atributos HTML
    // normales (en JSX se escriben en camelCase: autoComplete).
    // max-w-md limita el ancho del formulario a un tamaño cómodo.
    // El asterisco rojo lleva aria-hidden para que el lector de pantalla
    // no lea "asterisco" (ya sabe que es obligatorio por "required").
    // -----------------------------------------------------------------
    return (
        <Pagina titulo={t('titulo_login_h1')} oculto>
            <div className="mx-auto max-w-md pt-2 sm:pt-8">
            <Mensaje mensaje={mensaje} />

            <form onSubmit={enviar} className="caja">
                <img src="/logo-abades-compras-sm.png" alt="Abades Compras, webapp de compras internas" className="mx-auto mb-5 w-full max-w-[280px]" />
                <h1 className="subtitulo border-t border-marca-borde pt-5 text-center text-xl">{t('titulo_login_h1')}</h1>
                <div className="mb-3">
                    <label htmlFor="nombre_usuario" className="etiqueta">
                        {t('usuario')} <span className="text-red-700" aria-hidden="true">*</span>
                    </label>
                    <input id="nombre_usuario" type="text" required maxLength={50} autoComplete="username"
                        className="campo" value={nombre} onChange={function (e) { setNombre(e.target.value); }} />
                </div>
                <div className="mb-3">
                    <label htmlFor="contrasena" className="etiqueta">
                        {t('contrasena')} <span className="text-red-700" aria-hidden="true">*</span>
                    </label>
                    <input id="contrasena" type="password" required autoComplete="current-password"
                        className="campo" value={contrasena} onChange={function (e) { setContrasena(e.target.value); }} />
                </div>
                <button type="submit" className="boton mt-2 w-full">{t('entrar')}</button>
                <p className="mt-4 text-center text-sm">
                    {t('no_cuenta')} <Link to="/registro" className="font-semibold underline">{t('registrate')}</Link>
                </p>
            </form>
            </div>
        </Pagina>
    );
}
