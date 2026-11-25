# Casa La Micaelita

Página de presentación del proyecto de vivienda en San Pedro Tlaquepaque, Jalisco (concurso 2025).
Sitio estático en HTML, CSS y JavaScript, sin compilación. Usa GSAP + ScrollTrigger y Lenis desde CDN.

## Archivos

- `index.html`: la página.
- `remote.html`: control remoto para presentar en vivo.
- `css/styles.css`: diseño (variables de color y tipografía al inicio).
- `js/main.js`: escenas, scroll, planos, video y animaciones.
- `js/remote.js`: lógica del control remoto.
- `assets/`: renders (cada uno en 400, 800 px y tamaño completo), planos, axonometría y lámina.
- `assets/recorrido.mp4` y `assets/recorrido-poster.webp`: video del recorrido (1080p, H.264, 21 MB) y su portada. Para cambiar el video, reemplaza el archivo con el mismo nombre.
- `version-anterior/`: copia de la página anterior.
- `favicon.svg`, `apple-touch-icon.png`, `assets/og-image.jpg`: iconos y vista previa al compartir.

## Datos por completar

Busca `[DATO:` en `index.html`. Están marcados en amarillo en la página:

1. **Correo de contacto**: en la sección Contacto, cambia `href="#"` por `href="mailto:tu@correo.com"`, borra `data-pending` y reemplaza el marcador.
2. **Texto sobre Tlaquepaque**: en la sección Ubicación.
3. **Nombre del organizador**: confirma "Arquitectura Avanza" o "Arquitectura Avanzada" y borra el marcador.

## Modo presentación

1. Abre la página desde un servidor (GitHub Pages o local), no con doble clic en el archivo.
2. Abre `index.html` en una ventana y llévala al proyector. Pulsa **F** para pantalla completa.
3. En tu pantalla, abre `remote.html` en otra ventana del **mismo navegador**.
4. El control se conecta solo y pausa el autoplay. Usa los botones, las miniaturas o las flechas del teclado.

## Vista local

```
python -m http.server 8000
```

Luego abre `http://localhost:8000` y `http://localhost:8000/remote.html`.

## Publicación

Dirección pública: **https://lamicaelitacccp.github.io/**
Control remoto: **https://lamicaelitacccp.github.io/remote.html**

El sitio vive en el repositorio `lamicaelitacccp.github.io` de la cuenta de GitHub `lamicaelitacccp`.
GitHub publica automáticamente cada cambio que se sube a la rama `main` (tarda uno o dos minutos).

La carpeta `version-anterior` se queda solo en tu computadora: está excluida en `.gitignore`.
