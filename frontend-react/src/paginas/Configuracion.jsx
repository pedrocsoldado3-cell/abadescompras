// =====================================================================
// ARCHIVO: src/paginas/Configuracion.jsx
// Ajustes generales. Solo ADMIN. De momento: el texto general del pie
// del PDF de los pedidos ("Observaciones para pedidos").
// =====================================================================

import { useState, useEffect } from 'react';
import { useApp } from '../contexto/AppContext.jsx';
import { peticion } from '../servicios/api.js';
import Pagina from '../componentes/Pagina.jsx';
import Mensaje from '../componentes/Mensaje.jsx';


export default function Configuracion() {
    const { t } = useApp();
    const [observaciones, setObservaciones] = useState('');
    const [mensaje, setMensaje] = useState(null);

    useEffect(function () {
        peticion('GET', '/configuracion')
            .then(function (datos) { setObservaciones(datos.observaciones_pedidos || ''); })
            .catch(function (error) { setMensaje({ texto: error.message, tipo: 'error' }); });
    }, []);

    async function guardar(e) {
        e.preventDefault();
        setMensaje(null);
        try {
            const respuesta = await peticion('PUT', '/configuracion', { observaciones_pedidos: observaciones });
            setMensaje({ texto: respuesta.mensaje, tipo: 'ok' });
        } catch (error) {
            setMensaje({ texto: error.message, tipo: 'error' });
        }
    }

    return (
        <Pagina titulo={t('menu_configuracion')}>
            <Mensaje mensaje={mensaje} />
            <form onSubmit={guardar} className="caja">
                <label htmlFor="observaciones_pedidos" className="etiqueta">{t('observaciones_generales')}</label>
                <textarea id="observaciones_pedidos" rows={8} maxLength={2000} className="campo" aria-describedby="ayuda-obs"
                    value={observaciones} onChange={function (e) { setObservaciones(e.target.value); }} />
                <p id="ayuda-obs" className="mt-1 text-sm text-gray-700">{t('ayuda_observaciones_generales')}</p>
                <p className="mt-4">
                    <button type="submit" className="boton">{t('guardar')}</button>
                </p>
            </form>
        </Pagina>
    );
}
