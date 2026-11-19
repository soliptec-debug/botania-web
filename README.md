# BotanIA · Sitio web

Sitio estático (HTML + CSS + JS), sin dependencias ni build.

## Publicar en Vercel

**Opción A · GitHub (recomendada)**
1. En github.com, creá un repositorio nuevo (por ejemplo `botania-web`).
2. "Add file → Upload files" y arrastrá todo el contenido de esta carpeta (index.html, styles.css, script.js, favicon.svg, vercel.json y las imágenes .webp y .jpg). Todos los archivos van sueltos, sin carpetas..
3. En vercel.com → Add New → Project → importá el repositorio.
4. Framework Preset: **Other**. Build Command y Output Directory: vacíos. Deploy.
Cada cambio que subas al repo se publica solo.

**Opción B · Vercel CLI**
```
npx vercel        # vista previa
npx vercel --prod # producción
```

## Pendientes
- Links reales de Mercado Libre, locales y redes (hoy apuntan a secciones de la página).
- El botón "Comprar ahora" debería llevar a la tienda (Tiendanube) cuando exista.
- El formulario de mail es visual: para guardar los mails, conectarlo con un servicio (Mailchimp, Google Forms, etc.).

## QR y links de la app
- El QR se genera solo y apunta a `tu-dominio/app`. Esa página detecta el teléfono y manda a la App Store (iPhone) o a Google Play (Android).
- Los links de las tiendas están en `config.js`. Hoy llevan a una búsqueda de "BotanIA"; cuando la app esté publicada, pegá ahí los links reales y listo: se actualizan el QR, los botones y la página /app.
