// =====================================================================
// ARCHIVO: vite.config.js
// Configuración de Vite, la herramienta que arranca el servidor de
// desarrollo (npm run dev) y prepara la versión final (npm run build).
// Le añadimos dos "plugins":
//   - react()        -> entiende los archivos .jsx
//   - tailwindcss()  -> genera las clases de Tailwind que usamos
// =====================================================================
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: { port: 5173 }
});
