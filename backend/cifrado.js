// =====================================================================
// ARCHIVO: cifrado.js
// Cifra y descifra textos sensibles (contraseñas SMTP de los centros)
// con AES-256-GCM. La clave sale de la variable CLAVE_CIFRADO del .env:
// si se pierde o cambia, las contraseñas guardadas dejan de valer y
// habrá que volver a escribirlas.
// =====================================================================

const crypto = require('crypto');


function obtenerClave() {
    const secreto = process.env.CLAVE_CIFRADO;
    if (!secreto) {
        throw new Error('Falta la variable CLAVE_CIFRADO en el .env');
    }
    // Derivamos 32 bytes fijos a partir del texto de la variable.
    return crypto.createHash('sha256').update(secreto).digest();
}


// Devuelve "iv:tag:datos" en base64.
function cifrar(texto) {
    const iv = crypto.randomBytes(12);
    const cifrador = crypto.createCipheriv('aes-256-gcm', obtenerClave(), iv);
    const datos = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
    const tag = cifrador.getAuthTag();
    return [iv, tag, datos].map(function (b) { return b.toString('base64'); }).join(':');
}


function descifrar(guardado) {
    const [iv, tag, datos] = guardado.split(':').map(function (p) { return Buffer.from(p, 'base64'); });
    const descifrador = crypto.createDecipheriv('aes-256-gcm', obtenerClave(), iv);
    descifrador.setAuthTag(tag);
    return Buffer.concat([descifrador.update(datos), descifrador.final()]).toString('utf8');
}


module.exports = { cifrar, descifrar };
