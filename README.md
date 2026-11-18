# BotanIA · Sitio web

Sitio estático (HTML + CSS + JS), sin dependencias ni build.

## Publicar en Vercel

**Opción A · GitHub (recomendada)**
1. En github.com, creá un repositorio nuevo (por ejemplo `botania-web`).
2. "Add file → Upload files" y arrastrá todo el contenido de esta carpeta (index.html, styles.css, script.js, favicon.svg, vercel.json y la carpeta img).
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
