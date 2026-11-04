// =====================================================================
// ARCHIVO: servidor.js  (punto de entrada del BACK-END)
// Arranca un servidor web con Express que ofrece una API REST.
// El FRONT-END (carpeta /frontend-react) le hace peticiones con fetch().
// Para arrancarlo:  npm start   (o: node servidor.js)
// =====================================================================


// ---------------------------------------------------------------------
// Cargamos las variables del archivo .env (DATABASE_URL, JWT_SECRETO...)
// dentro de process.env. Tiene que ser lo PRIMERO, antes de usar bd.js.
// ---------------------------------------------------------------------
require('dotenv').config({ quiet: true });


// ---------------------------------------------------------------------
// Librerías:
//   express -> crea el servidor y las rutas
//   cors    -> permite que el frontend (otro dominio, p. ej. Netlify)
//              pueda llamar a esta API
// ---------------------------------------------------------------------
const express = require('express');
const cors = require('cors');


// ---------------------------------------------------------------------
// Creamos la aplicación y le decimos:
//   app.use(cors(...))       -> acepta peticiones de otros dominios y deja
//                               leer el nombre de los archivos descargados
//   app.use(express.json())  -> entiende el cuerpo de las peticiones
//                               en formato JSON (req.body)
// ---------------------------------------------------------------------
const app = express();
app.use(cors({ exposedHeaders: ['Content-Disposition'] }));
// La importación de datos recibe archivos (hasta 10 MB en base64), así
// que su ruta admite cuerpos más grandes. Va antes del express.json()
// general, que deja el límite normal (100 KB) para el resto.
app.use('/api/importaciones', express.json({ limit: '15mb' }));
app.use(express.json());


// ---------------------------------------------------------------------
// Ruta de prueba para saber si el servidor está vivo.
// Si abres http://localhost:3000/ en el navegador verás el mensaje.
// ---------------------------------------------------------------------
app.get('/', function (req, res) {
    res.json({ mensaje: 'API de Pedidos HORECA funcionando' });
});


// ---------------------------------------------------------------------
// Conectamos cada grupo de rutas con su archivo. Por ejemplo, todo lo
// que empiece por /api/proveedores lo gestiona rutas/proveedores.js
// ---------------------------------------------------------------------
app.use('/api/auth', require('./rutas/auth'));
app.use('/api/usuarios', require('./rutas/usuarios'));
app.use('/api/sociedades', require('./rutas/sociedades'));
app.use('/api/centros', require('./rutas/centros'));
app.use('/api/proveedores', require('./rutas/proveedores'));
app.use('/api/articulos', require('./rutas/articulos'));
app.use('/api/tarifas', require('./rutas/tarifas'));
app.use('/api/catalogo', require('./rutas/catalogo'));
app.use('/api/solicitudes', require('./rutas/solicitudes'));
app.use('/api/compras', require('./rutas/compras'));
app.use('/api/exportaciones', require('./rutas/exportaciones'));
app.use('/api/configuracion', require('./rutas/configuracion'));
app.use('/api/importaciones', require('./rutas/importaciones'));


// ---------------------------------------------------------------------
// Si llega una petición a una ruta que no existe respondemos 404.
// Va DESPUÉS de todas las rutas, porque Express las revisa en orden.
// ---------------------------------------------------------------------
app.use(function (req, res) {
    res.status(404).json({ error: 'Ruta no encontrada' });
});


// ---------------------------------------------------------------------
// Arrancamos el servidor en el puerto del .env (o el 3000 si no hay).
// Render y Railway rellenan process.env.PORT automáticamente.
// ---------------------------------------------------------------------
const PUERTO = process.env.PORT || 3000;

app.listen(PUERTO, function () {
    console.log('Servidor escuchando en http://localhost:' + PUERTO);
});
