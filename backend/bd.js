// =====================================================================
// ARCHIVO: bd.js
// Crea la conexión con la base de datos PostgreSQL (Supabase).
// El resto de archivos hacen require('./bd') para lanzar consultas.
// =====================================================================


// ---------------------------------------------------------------------
// Cargamos la librería "pg" (el conector oficial de PostgreSQL para
// Node.js) y sacamos de ella la clase Pool. Un Pool es un "grupo de
// conexiones" que se reutilizan, así no abrimos una nueva cada vez.
// ---------------------------------------------------------------------
const { Pool } = require('pg');


// ---------------------------------------------------------------------
// Creamos el Pool con la cadena de conexión que está en el archivo .env
// (variable DATABASE_URL). Si DB_SSL vale "true" activamos SSL, que es
// obligatorio para conectarse a Supabase desde fuera.
// rejectUnauthorized: false acepta el certificado de Supabase.
// ---------------------------------------------------------------------
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});


// ---------------------------------------------------------------------
// Exportamos el pool para usarlo en las rutas así:
//   const pool = require('../bd');
//   const resultado = await pool.query('SELECT * FROM articulos');
//   resultado.rows  -> array con las filas
// ---------------------------------------------------------------------
module.exports = pool;
