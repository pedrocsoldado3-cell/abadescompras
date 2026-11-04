// =====================================================================
// ARCHIVO: correo.js
// Envía el correo de un pedido desde la cuenta SMTP de su centro.
// Gmail: servidor smtp.gmail.com, puerto 465 (SSL) y una "contraseña de
// aplicación" de la cuenta (requiere verificación en dos pasos).
// =====================================================================

const nodemailer = require('nodemailer');
const { descifrar } = require('./cifrado');
const { numeroPedido, fechaES } = require('./documentos');


// ---------------------------------------------------------------------
// comprobarSmtp: devuelve un texto de error si al centro le falta algo
// para poder enviar, o '' si está todo.
// ---------------------------------------------------------------------
function comprobarSmtp(pedido) {
    if (!pedido.smtp_host || !pedido.smtp_puerto || !pedido.smtp_usuario || !pedido.smtp_contrasena) {
        return 'El centro "' + pedido.nombre_centro + '" no tiene completa la configuración de envío ' +
            '(servidor, puerto, usuario y contraseña SMTP). Un administrador debe completarla en Centros.';
    }
    return '';
}


// ---------------------------------------------------------------------
// enviarPedido: manda el correo con el PDF adjunto. Lanza un Error con
// un mensaje entendible si el servidor de correo lo rechaza.
// ---------------------------------------------------------------------
async function enviarPedido(pedido, pdf, esReenvio) {
    const puerto = parseInt(pedido.smtp_puerto);
    const transporte = nodemailer.createTransport({
        host: pedido.smtp_host,
        port: puerto,
        secure: puerto === 465,
        auth: { user: pedido.smtp_usuario, pass: descifrar(pedido.smtp_contrasena) },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 30000
    });

    const numero = numeroPedido(pedido);
    const cc = [pedido.email_envio].concat(pedido.emails_cc)
        .filter(function (e, i, lista) { return e && lista.indexOf(e) === i; });

    const texto = [
        'Buenos días,',
        '',
        (esReenvio ? 'Les reenviamos' : 'Les enviamos') + ' adjunto nuestro pedido nº ' + numero + '.',
        'Fecha de entrega: ' + fechaES(pedido.fecha_entrega) + '.',
        pedido.observaciones_entrega ? pedido.observaciones_entrega : '',
        '',
        'Por favor, indiquen el número de pedido en el albarán.',
        '',
        'Un saludo,',
        pedido.nombre_centro,
        'Tlf: ' + [pedido.telefono_1, pedido.telefono_2].filter(Boolean).join(' / ')
    ].filter(function (l, i, a) { return !(l === '' && a[i - 1] === ''); }).join('\n');

    try {
        await transporte.sendMail({
            from: { name: pedido.nombre_centro, address: pedido.email_envio },
            to: pedido.email_proveedor,
            cc: cc,
            replyTo: pedido.email_envio,
            subject: (esReenvio ? '[REENVÍO] ' : '') + 'Pedido ' + numero + ' - ' + pedido.nombre_centro,
            text: texto,
            attachments: [{ filename: 'Pedido_' + numero + '.pdf', content: pdf, contentType: 'application/pdf' }]
        });
    } catch (error) {
        console.error('Error SMTP:', error.message);
        if (error.code === 'EAUTH') {
            throw new Error('El servidor de correo ha rechazado el usuario o la contraseña SMTP del centro. ' +
                'Con Gmail hay que usar una contraseña de aplicación.');
        }
        if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS'].includes(error.code)) {
            throw new Error('No se ha podido conectar con el servidor de correo (' + pedido.smtp_host + ':' + puerto + '). Revisa servidor y puerto.');
        }
        throw new Error('No se ha podido enviar el correo: ' + error.message);
    }
}


module.exports = { comprobarSmtp, enviarPedido };
