// =====================================================================
// ARCHIVO: src/paginas/Registro.jsx
// Registro público. La cuenta queda inactiva y sin
// rol hasta que un administrador la active.
// =====================================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../contexto/AppContext.jsx';
import { peticion } from '../servicios/api.js';
import Pagina from '../componentes/Pagina.jsx';
import Mensaje from '../componentes/Mensaje.jsx';


// ---------------------------------------------------------------------
// Valores iniciales del formulario, fuera del componente para poder
// reutilizarlos al vaciarlo después de registrarse.
// ---------------------------------------------------------------------
const FORM_VACIO = { nombre_usuario: '', nombre_completo: '', email_usuario: '', contrasena: '', contrasena2: '' };


export default function Registro() {
    const { t } = useApp();

    // -----------------------------------------------------------------
    // Aquí usamos UN estado con un objeto para todo el formulario (en
    // Login usamos un useState por campo, para que veas las dos formas).
    // -----------------------------------------------------------------
    const [form, setForm] = useState(FORM_VACIO);
    const [mensaje, setMensaje] = useState(null);


    // -----------------------------------------------------------------
    // cambiar(e): una sola función para todos los inputs. Usa el
    // atributo "name" del input para saber qué campo actualizar.
    // { ...form } copia el objeto (en React no se modifica el estado
    // directamente, se crea uno nuevo) y [nombre]: valor cambia solo ese.
    // CONTROL DE TECLAS: en el campo usuario quitamos al escribir todo lo
    // que no sea letra sin tilde, número, punto, guion o guion bajo.
    // -----------------------------------------------------------------
    function cambiar(e) {
        let valor = e.target.value;
        if (e.target.name === 'nombre_usuario') {
            valor = valor.replace(/[^A-Za-z0-9_.\-]/g, '');
        }
        setForm({ ...form, [e.target.name]: valor });
    }


    // -----------------------------------------------------------------
    // enviar(): comprobaciones en el navegador y llamada a la API.
    // El navegador ya valida required, minLength, pattern y type="email".
    // Aquí comprobamos además que las dos contraseñas coinciden.
    // No mandamos contrasena2 al servidor: sacamos los campos que sí.
    // -----------------------------------------------------------------
    async function enviar(e) {
        e.preventDefault();
        setMensaje(null);

        if (form.nombre_usuario.length < 3 || form.nombre_completo.trim().length < 3) {
            setMensaje({ texto: t('error_nombre_corto'), tipo: 'error' });
            return;
        }
        if (form.contrasena.length < 8) {
            setMensaje({ texto: t('error_contrasena_corta'), tipo: 'error' });
            return;
        }
        if (form.contrasena !== form.contrasena2) {
            setMensaje({ texto: t('error_contrasenas'), tipo: 'error' });
            return;
        }

        const datos = {
            nombre_usuario: form.nombre_usuario,
            nombre_completo: form.nombre_completo.trim(),
            email_usuario: form.email_usuario.trim(),
            contrasena: form.contrasena
        };

        try {
            const respuesta = await peticion('POST', '/auth/registro', datos);
            setForm(FORM_VACIO);
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }


    // -----------------------------------------------------------------
    // Formulario. aria-describedby une cada campo con su texto de ayuda
    // para que el lector de pantalla lo lea (WCAG).
    // -----------------------------------------------------------------
    return (
        <Pagina titulo={t('titulo_registro_h1')}>
            <Mensaje mensaje={mensaje} />

            <form onSubmit={enviar} className="caja max-w-md">
                <div className="mb-3">
                    <label htmlFor="nombre_usuario" className="etiqueta">{t('usuario')} <span className="text-red-700" aria-hidden="true">*</span></label>
                    <input id="nombre_usuario" name="nombre_usuario" type="text" required minLength={3} maxLength={50}
                        pattern="[A-Za-z0-9_.\-]{3,50}" autoComplete="username" aria-describedby="ayuda-usuario"
                        className="campo" value={form.nombre_usuario} onChange={cambiar} />
                    <p id="ayuda-usuario" className="mt-1 text-sm text-gray-600">{t('ayuda_usuario')}</p>
                </div>
                <div className="mb-3">
                    <label htmlFor="nombre_completo" className="etiqueta">{t('nombre_completo')} <span className="text-red-700" aria-hidden="true">*</span></label>
                    <input id="nombre_completo" name="nombre_completo" type="text" required minLength={3} maxLength={100}
                        autoComplete="name" className="campo" value={form.nombre_completo} onChange={cambiar} />
                </div>
                <div className="mb-3">
                    <label htmlFor="email_usuario" className="etiqueta">{t('email')} <span className="text-red-700" aria-hidden="true">*</span></label>
                    <input id="email_usuario" name="email_usuario" type="email" required maxLength={120}
                        autoComplete="email" className="campo" value={form.email_usuario} onChange={cambiar} />
                </div>
                <div className="mb-3">
                    <label htmlFor="contrasena" className="etiqueta">{t('contrasena')} <span className="text-red-700" aria-hidden="true">*</span></label>
                    <input id="contrasena" name="contrasena" type="password" required minLength={8}
                        autoComplete="new-password" aria-describedby="ayuda-contrasena"
                        className="campo" value={form.contrasena} onChange={cambiar} />
                    <p id="ayuda-contrasena" className="mt-1 text-sm text-gray-600">{t('ayuda_contrasena')}</p>
                </div>
                <div className="mb-3">
                    <label htmlFor="contrasena2" className="etiqueta">{t('repetir_contrasena')} <span className="text-red-700" aria-hidden="true">*</span></label>
                    <input id="contrasena2" name="contrasena2" type="password" required minLength={8}
                        autoComplete="new-password" className="campo" value={form.contrasena2} onChange={cambiar} />
                </div>
                <button type="submit" className="boton">{t('registrarme')}</button>
                <p className="mt-3">
                    {t('ya_cuenta')} <Link to="/login" className="text-blue-800 underline">{t('inicia_sesion')}</Link>
                </p>
            </form>
        </Pagina>
    );
}
