# Cómo desplegar Abades Compras

El orden es: **1) Supabase (base de datos) → 2) GitHub (código) → 3) Render (backend) → 4) Netlify (frontend)**.
GitHub no ejecuta la aplicación: solo guarda el código. Render y Netlify leen el código de GitHub y lo publican. Cada vez que subas un cambio a GitHub, se vuelven a publicar solos.

---

## 1. Base de datos en Supabase

1. Entra en <https://supabase.com>, crea una cuenta y pulsa **New project**. En **Region** elige **Central EU (Frankfurt)** para que los datos queden en la UE. Apunta la contraseña de la base de datos que te pide.
2. En el menú de la izquierda abre **SQL Editor**, pega el contenido de `base_datos/01_tablas.sql` y pulsa **Run**. Después haz lo mismo con `base_datos/02_datos_prueba.sql`.
3. Ve a **Project Settings → Database → Connection string → URI** y copia la del **Session pooler** (Render no tiene IPv6, por eso no vale la conexión directa). Es algo así:
   ```
   postgresql://postgres.abcdefgh:TU_CONTRASENA@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
   ```
   Cambia `[YOUR-PASSWORD]` por tu contraseña. Esta es tu `DATABASE_URL`.

## 2. Código en GitHub

El código está en el repositorio privado `pedrocsoldado3-cell/abadescompras`. Ahí **nunca** se suben los `.env` (lo impide `.gitignore`): las contraseñas y claves solo se escriben en Render.

## 3. Backend en Render

1. Entra en <https://render.com> con tu cuenta de GitHub.
2. **New → Web Service** y elige el repositorio `abadescompras`.
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
   | `JWT_SECRETO` | una cadena aleatoria (ver abajo) |
   | `JWT_DURACION` | `8h` |
   | `CLAVE_CIFRADO` | otra cadena aleatoria distinta (ver abajo) |

   Para generar cada cadena aleatoria, en una terminal con Node instalado:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   **Guarda `CLAVE_CIFRADO` en un sitio seguro y no la cambies**: con ella se cifran las contraseñas SMTP de los centros. Si se cambia o se pierde, habrá que volver a escribir esas contraseñas en cada centro.

   No añadas `PORT`: Render lo pone solo.
5. Pulsa **Create Web Service** y espera a que salga *Live*. Te dará una dirección como `https://abadescompras.onrender.com`. Ábrela: debe salir `{"mensaje":"API de Pedidos HORECA funcionando"}`.

> En el plan gratuito Render "duerme" el servidor si no se usa durante 15 minutos. La primera petición después tarda unos 30-50 segundos. Es normal.

## 4. Frontend (React + Tailwind) en Netlify

El frontend de React hay que "construirlo" (`npm run build`) antes de publicarlo: Vite convierte los `.jsx` y Tailwind en HTML, CSS y JS normales dentro de la carpeta `dist`. Netlify lo hace solo cada vez que subes cambios a GitHub.

1. Entra en <https://netlify.com> con tu cuenta de GitHub → **Add new site → Import an existing project → GitHub** → elige `abadescompras`.
2. Rellena:
   | Campo | Valor |
   |---|---|
   | Base directory | `frontend-react` |
   | Build command | `npm run build` |
   | Publish directory | `frontend-react/dist` |
3. En **Environment variables** (o *Site configuration → Environment variables*) añade:
   | Clave | Valor |
   |---|---|
   | `VITE_API_URL` | la dirección de Render terminada en `/api`, por ejemplo `https://abadescompras.onrender.com/api` |

   No hace falta tocar el código: `src/servicios/api.js` lee esta variable.
4. **Deploy**. Te dará una dirección como `https://abadescompras.netlify.app`.

El archivo `frontend-react/public/_redirects` ya está preparado: hace que al recargar en `/pedidos` o `/proveedores` no salga un error 404 (React tiene una sola página real, `index.html`).

> Si cambias `VITE_API_URL` después, vuelve a desplegar (*Deploys → Trigger deploy*): Vite mete el valor al construir, no al abrir la web.

### Alternativa: GitHub Pages
GitHub Pages solo sirve archivos ya construidos y no entiende las rutas de React sin trucos extra, por eso Netlify es más cómodo para este proyecto.

## 5. Comprobar que todo funciona

1. Abre la dirección de Netlify y entra con `admin` / `Admin1234`.
2. Si sale *"No se puede conectar con el servidor"*: revisa `VITE_API_URL` en Netlify (y vuelve a desplegar) y espera a que Render despierte.
3. Si Render da error al arrancar: mira **Logs** en Render. Lo más habitual es una `DATABASE_URL` mal copiada o con `[YOUR-PASSWORD]` sin cambiar.
4. Cambia la contraseña del usuario `admin` de prueba (o crea tu propio admin) antes de empezar a usarla.

## 6. Correo de los centros (Gmail)

Cada centro envía sus pedidos desde su propio email. Con Gmail:

1. En la cuenta de Google del centro activa la **verificación en dos pasos** y crea una **contraseña de aplicación** (Cuenta de Google → Seguridad → Contraseñas de aplicaciones).
2. En la app, ficha del centro: servidor `smtp.gmail.com`, puerto `465`, usuario = el email completo y contraseña = la contraseña de aplicación (16 letras). Se guarda cifrada.
3. Haz la primera prueba con un proveedor cuyo email sea tuyo, para no mandar pedidos de prueba a un proveedor real.
