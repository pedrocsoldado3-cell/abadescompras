# Cómo desplegar Pedidos HORECA con GitHub

El orden es: **1) Supabase (base de datos) → 2) GitHub (código) → 3) Render (backend) → 4) Netlify (frontend)**.
GitHub no ejecuta la aplicación: solo guarda el código. Render y Netlify leen el código de GitHub y lo publican. Cada vez que subas un cambio a GitHub, se vuelven a publicar solos.

---

## 1. Base de datos en Supabase

1. Entra en <https://supabase.com>, crea una cuenta y pulsa **New project**. Apunta la contraseña de la base de datos que te pide.
2. En el menú de la izquierda abre **SQL Editor**, pega el contenido de `base_datos/01_tablas.sql` y pulsa **Run**. Después haz lo mismo con `base_datos/02_datos_prueba.sql`.
3. Ve a **Project Settings → Database → Connection string → URI** y copia la del **Session pooler** (Render no tiene IPv6, por eso no vale la conexión directa). Es algo así:
   ```
   postgresql://postgres.abcdefgh:TU_CONTRASENA@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
   ```
   Cambia `[YOUR-PASSWORD]` por tu contraseña. Esta es tu `DATABASE_URL`.

## 2. Subir el código a GitHub

1. Crea una cuenta en <https://github.com> y pulsa **New repository**. Nombre: `pedidos-horeca`. Déjalo **vacío** (sin README) y pulsa **Create repository**.
2. En tu ordenador, abre una terminal dentro de la carpeta `app-pedidos` y escribe:
   ```bash
   git init
   git add .
   git commit -m "Primera versión de Pedidos HORECA"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/pedidos-horeca.git
   git push -u origin main
   ```
3. Comprueba en GitHub que **no** se ha subido `backend/.env` ni `backend/node_modules` (el archivo `backend/.gitignore` lo evita). La contraseña de la base de datos nunca debe estar en GitHub.

Si prefieres no usar la terminal: instala **GitHub Desktop**, *File → Add local repository* (elige `app-pedidos`), *Publish repository*.

## 3. Backend en Render

1. Entra en <https://render.com> con tu cuenta de GitHub.
2. **New → Web Service** y elige el repositorio `pedidos-horeca`.
3. Rellena:
   | Campo | Valor |
   |---|---|
   | Root Directory | `backend` |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance Type | Free |
4. En **Environment Variables** añade una por una (las mismas que en `.env.example`):
   | Clave | Valor |
   |---|---|
   | `DATABASE_URL` | la URI del paso 1.3 |
   | `DB_SSL` | `true` |
   | `JWT_SECRETO` | una frase larga inventada |
   | `JWT_DURACION` | `8h` |
   | `EMPRESA_NOMBRE`, `EMPRESA_CIF`, `EMPRESA_DIRECCION`, `EMPRESA_TELEFONO`, `EMPRESA_HORARIO` | los datos del restaurante |

   No añadas `PORT`: Render lo pone solo.
5. Pulsa **Create Web Service** y espera a que salga *Live*. Te dará una dirección como `https://pedidos-horeca.onrender.com`. Ábrela: debe salir `{"mensaje":"API de Pedidos HORECA funcionando"}`.

> En el plan gratuito Render "duerme" el servidor si no se usa durante 15 minutos. La primera petición después tarda unos 30-50 segundos. Es normal.

## 4. Frontend (React + Tailwind) en Netlify

El frontend de React hay que "construirlo" (`npm run build`) antes de publicarlo: Vite convierte los `.jsx` y Tailwind en HTML, CSS y JS normales dentro de la carpeta `dist`. Netlify lo hace solo cada vez que subes cambios a GitHub.

1. Entra en <https://netlify.com> con tu cuenta de GitHub → **Add new site → Import an existing project → GitHub** → elige `pedidos-horeca`.
2. Rellena:
   | Campo | Valor |
   |---|---|
   | Base directory | `frontend-react` |
   | Build command | `npm run build` |
   | Publish directory | `frontend-react/dist` |
3. En **Environment variables** (o *Site configuration → Environment variables*) añade:
   | Clave | Valor |
   |---|---|
   | `VITE_API_URL` | la dirección de Render terminada en `/api`, por ejemplo `https://pedidos-horeca.onrender.com/api` |

   No hace falta tocar el código: `src/servicios/api.js` lee esta variable.
4. **Deploy**. Te dará una dirección como `https://pedidos-horeca.netlify.app`.

El archivo `frontend-react/public/_redirects` ya está preparado: hace que al recargar en `/pedidos` o `/proveedores` no salga un error 404 (React tiene una sola página real, `index.html`).

> Si cambias `VITE_API_URL` después, vuelve a desplegar (*Deploys → Trigger deploy*): Vite mete el valor al construir, no al abrir la web.

### Alternativa: GitHub Pages
GitHub Pages solo sirve archivos ya construidos y no entiende las rutas de React sin trucos extra, por eso Netlify es más cómodo para este proyecto.

## 5. Comprobar que todo funciona

1. Abre la dirección de Netlify y entra con `admin` / `Admin1234`.
2. Si sale *"No se puede conectar con el servidor"*: revisa `VITE_API_URL` en Netlify (y vuelve a desplegar) y espera a que Render despierte.
3. Si Render da error al arrancar: mira **Logs** en Render. Lo más habitual es una `DATABASE_URL` mal copiada o con `[YOUR-PASSWORD]` sin cambiar.
4. Cambia la contraseña del usuario `admin` de prueba (o crea tu propio admin) antes de empezar a usarla.
