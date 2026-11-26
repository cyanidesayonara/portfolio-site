---
title: dopepod
tagline: Un reproductor de podcasts gratuito que funciona por completo en tu navegador.
summary: Un reproductor de podcasts estático en Svelte, sin cuenta ni servidor. Empezó como mi proyecto final de CS50 y lo he rehecho dos veces.
kind: Web app
stack: [Svelte, TypeScript, GitHub Actions, GitHub Pages, Podcast Index]
years: "2017 hasta hoy"
cover: /img/projects/dopepod-web.webp
coverAlt: La página de inicio de dopepod con su catálogo de podcasts y filtros por categoría
links:
  - label: Abrir dopepod
    href: https://cyanidesayonara.github.io/dop3pod/
  - label: Código en GitHub
    href: https://github.com/cyanidesayonara/dop3pod
  - label: Código versión web (v1)
    href: https://github.com/cyanidesayonara/dopepod
order: 10
color: magenta
---

Un reproductor de podcasts que nació como aplicación web en Django, pasó a ser una app móvil con un backend completo y hoy es un sitio estático sin servidor que mantener.

## Hoy: un reproductor estático

La versión actual está escrita en Svelte y TypeScript y alojada en GitHub Pages. Explora un catálogo elegido a mano en cuatro idiomas, busca en un directorio de unos 27.000 podcasts más, pon episodios en cola, cambia la velocidad, programa un temporizador, guarda favoritos y sigue donde lo dejaste. Todo lo que recuerda se queda en tu navegador.

- **Sin backend:** una GitHub Action diaria lee los feeds del catálogo y publica pequeños archivos JSON y miniaturas de las portadas.
- **Un directorio y listas de Podcast Index:** una vez al mes la misma Action construye el directorio a partir del volcado público de Podcast Index, y cada día descarga las listas de novedades en auge por categoría e idioma. Su clave de API se queda en la Action; la web solo recibe las listas ya hechas.
- **El audio llega directo de quien lo publica:** no se copia ni se vuelve a alojar nada.
- **Los feeds no son de fiar:** el analizador tolera XML defectuoso, solo acepta audio por https y reduce las descripciones a texto plano.

![La página de un podcast con su lista de episodios](/img/projects/dopepod-show.webp)

Las casetas de dopepod de esta web, en la [calle 2D](/es/) y el [paseo 3D](/es/walk), reproducen episodios reales del mismo catálogo.

## Versión web (v1)

El dopepod original nació como mi proyecto final de CS50. Usaba Django con PostgreSQL en el servidor y jQuery en el cliente. La API de iTunes aportaba el catálogo de podcasts y unos scrapers propios enriquecían los metadatos.

![La versión web original](/img/projects/dopepod.webp)

## Versión móvil

La siguiente reescritura, `dop3pod`, unía un backend en Django REST Framework dockerizado con un cliente en Flutter. Los workers de Celery, Redis y las arañas de Scrapy mantenían al día el directorio de podcasts y los episodios, y la app tenía búsqueda, listado de episodios y un reproductor persistente con lista de reproducción. Su código sigue en el [historial del repositorio](https://github.com/cyanidesayonara/dop3pod/tree/92ffd4c002a9dc4c05a3980c5833b6c2e61c82ef).

![La app móvil en Flutter](/img/projects/dop3pod.webp)
