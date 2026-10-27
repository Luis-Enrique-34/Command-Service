# `public/` — Vista (la "V" de MVC)

Las **páginas** están en la raíz (sus URLs no cambian) y los **recursos** en `assets/`.

```
public/
├── landing.html  login.html  registro.html  app.html   ← páginas
└── assets/
    ├── css/      theme.css (tokens de color: tema claro/oscuro) · app.css · landing.css · auth.css
    ├── js/
    │   ├── theme.js           aplica el tema antes de pintar (sin parpadeo)
    │   ├── pages/             landing.js · auth-form.js · login.js · registro.js
    │   └── app/               aplicación del panel (SPA con módulos ES)
    │       ├── core.js        utilidades: api(), html`` (escapa XSS), modal, toast, formatos
    │       ├── main.js        router por hash + menú por rol (tabla VISTAS)
    │       └── views/         11 vistas: inicio, catálogo, solicitudes, agenda, perfil, admin…
    ├── img/      logos e isotipos por tema (marca/: archivos originales)
    └── vendor/   fuentes Montserrat/Open Sans y Font Awesome locales (sin CDN)
```

La vista **no tiene reglas de negocio ni SQL**: pide datos a la API con `fetch` (la cookie de sesión viaja sola) y los muestra.
