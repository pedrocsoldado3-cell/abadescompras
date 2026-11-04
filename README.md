# Pedidos HORECA

Aplicación web para gestionar los pedidos de compra de hostelería. El personal pide lo que necesita **sin ver precios**; el backend adjudica cada artículo al proveedor con el **precio neto más bajo**, crea **un pedido por proveedor** y, al enviarlo, el servidor manda el email al proveedor con el **PDF** adjunto, genera el **XML para el ERP** y lo marca como **TRAMITADO**.

Tecnologías: **React + Tailwind CSS** (frontend), **Node.js + Express** (backend), **PostgreSQL en Supabase** (base de datos), JWT y bcrypt.

## Estructura

```
app-pedidos/
├── base_datos/
│   ├── 01_tablas.sql          ← crea las tablas, restricciones y RLS
│   └── 02_datos_prueba.sql    ← usuarios, proveedores, artículos y tarifas de ejemplo
├── backend/                   ← API REST (Node.js + Express)
│   ├── servidor.js            ← punto de entrada
│   ├── bd.js                  ← conexión a PostgreSQL (Supabase)
│   ├── motor_adjudicacion.js  ← elige el proveedor más barato y crea los pedidos
│   ├── acceso_centros.js      ← qué centros puede usar cada usuario y qué artículos se pueden pedir
│   ├── cifrado.js             ← cifra las contraseñas SMTP de los centros
│   ├── documentos.js          ← genera el PDF y el XML de cada pedido
│   ├── correo.js              ← envía el pedido por SMTP desde el email del centro
│   ├── importador.js          ← lee CSV/Excel/XML y carga proveedores, artículos y tarifas
│   ├── exportador.js          ← genera CSV/Excel/XML de pedidos según una plantilla
│   ├── middleware/auth.js     ← comprueba el token JWT y el rol
│   ├── rutas/                 ← una ruta por tabla / funcionalidad
│   ├── .env.example           ← plantilla de configuración
│   └── package.json
├── frontend-react/            ← interfaz web (React + Tailwind)
│   ├── index.html
│   ├── vite.config.js
│   ├── .env.example           ← URL del backend
│   ├── public/_redirects      ← necesario en Netlify para las rutas de React
│   └── src/
│       ├── main.jsx           ← arranca React, el router y el contexto
│       ├── App.jsx            ← estructura común y rutas (React Router)
│       ├── index.css          ← importa Tailwind y define .boton, .campo, .tabla...
│       ├── contexto/AppContext.jsx  ← sesión compartida y función t()
│       ├── servicios/api.js   ← peticion() al backend y funciones de formato
│       ├── idioma/textos.js   ← textos de la interfaz
│       ├── componentes/       ← Cabecera, Menu, Mensaje, Estado, Pagina, RutaProtegida
│       └── paginas/           ← una página por pantalla (Login, Pedidos, Tarifas...)
├── DESPLIEGUE.md              ← paso a paso para publicarla
└── README.md
```

## Funcionalidades

- Registro de usuarios con activación y asignación de rol por un administrador (ADMIN / USUARIO).
- **Multicentro**: sociedades (razones sociales) con uno o varios centros. Cada centro tiene su nº de serie y de almacén del ERP, datos de entrega, email de envío (con su SMTP) y emails en copia.
- El administrador habilita en cada centro qué **proveedores** puede usar y qué **artículos** forman su catálogo.
- Los USUARIOS piden solo para los centros que tengan asignados; los ADMIN (central) para cualquiera.
- Mantenimiento de proveedores, artículos y tarifas. Las tarifas son **globales** (iguales para todos los centros).
- Solicitudes de pedido del personal, sin precios visibles.
- Motor de adjudicación: cada artículo al proveedor habilitado en el centro con el precio neto más bajo, un pedido por proveedor.
- Numeración de pedidos compatible con el ERP: `serie / AAAANNNNN` (ej. `3A / 202600001`), contador por centro que se reinicia cada año.
- **Envío del pedido** desde la propia aplicación (SMTP del centro, p. ej. Gmail con contraseña de aplicación: `smtp.gmail.com`, puerto 465), con el PDF adjunto y copia al centro y a sus emails CC. Al enviarse queda TRAMITADO. El administrador puede reenviarlo.
- **PDF del pedido**: sin precios para los usuarios; el administrador elige si incluirlos. Pie con observaciones generales (menú *Configuración*) y del centro.
- **XML para el ERP** (formato DATAPACKET) generado al enviar cada pedido. En *Exportar ERP* el administrador los descarga (uno o varios en ZIP); al descargarlos quedan EXPORTADOS y solo se borran si él lo decide.
- **Plantillas de exportación**: además del XML del ERP, los pedidos se pueden descargar en CSV, Excel o XML con las columnas, orden y nombres que se elijan. Cada plantilla indica si marca los pedidos como exportados.
- Proveedores y artículos con su **código del ERP**.
- **Importar datos**: carga de proveedores, artículos y tarifas desde CSV, Excel (.xlsx) o XML. El administrador indica qué columna va a cada campo y lo guarda como plantilla reutilizable. Se comprueba antes de guardar y se carga todo o nada.
- Ayuda integrada y accesibilidad WCAG (etiquetas, foco visible, enlace "Saltar al contenido", tablas con `caption` y `scope`).

## Puesta en marcha en local

1. **Base de datos** (Supabase): crea un proyecto, abre *SQL Editor* y ejecuta `base_datos/01_tablas.sql` y después `base_datos/02_datos_prueba.sql`.
2. **Backend**:
   ```bash
   cd backend
   npm install
   cp .env.example .env      # en Windows: copy .env.example .env. Rellena DATABASE_URL, JWT_SECRETO y CLAVE_CIFRADO
   npm start                 # http://localhost:3000
   ```
   La `DATABASE_URL` está en Supabase → *Project Settings* → *Database* → *Connection string* (URI). Con Supabase pon `DB_SSL=true`.
3. **Frontend React**:
   ```bash
   cd frontend-react
   npm install
   npm run dev               # http://localhost:5173
   ```
   Si el backend no está en `localhost:3000`, crea `frontend-react/.env` (copia de `.env.example`) con `VITE_API_URL=https://tu-backend/api`.

Usuarios de prueba:

| Usuario | Contraseña | Rol |
|---|---|---|
| admin | Admin1234 | ADMIN |
| empleado | Usuario1234 | USUARIO (centros 3A y 4A) |
| invitado | Usuario1234 | sin activar (para probar la activación) |

## Despliegue (hosting remoto)

- **Backend en Render**: *New → Web Service*, conecta el repositorio, *Root directory* `backend`, *Build command* `npm install`, *Start command* `npm start`. En *Environment* añade las variables del `.env` (no subas el `.env` a GitHub).
- **Frontend en Netlify**: conéctalo al repositorio con *Base directory* `frontend-react`, *Build command* `npm run build`, *Publish directory* `frontend-react/dist` y la variable `VITE_API_URL` = URL de Render terminada en `/api`. Pasos detallados en `DESPLIEGUE.md`.

## Seguridad

- Contraseñas guardadas con **bcrypt**; nunca se devuelven al frontend.
- **JWT** con caducidad (`JWT_DURACION`, 8 h por defecto). El rol se lee del token, no de lo que manda el navegador.
- **RLS activado** en todas las tablas y sin políticas: la clave pública de Supabase no puede leer ni escribir nada. Solo el backend (usuario `postgres`) accede a los datos.
- Consultas parametrizadas (`$1, $2...`) para evitar inyección SQL. En React, el texto entre llaves `{dato}` se escapa solo (evita XSS).
- Los usuarios normales no reciben ningún precio desde la API.
