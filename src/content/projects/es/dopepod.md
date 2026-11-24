---
title: dopepod
tagline: Un reproductor de podcasts que creció de aplicación web en Django a app móvil en Flutter.
summary: Descubre y escucha miles de podcasts gratuitos. Empezó como mi proyecto final de CS50 y se rehízo con Flutter y Django REST Framework.
kind: Mobile app
stack: [Flutter, Django REST Framework, PostgreSQL, Celery, Redis, Scrapy, Docker]
years: "2017 hasta hoy"
cover: /img/projects/dop3pod.png
coverAlt: La aplicación móvil dopepod
links:
  - label: Google Play
    href: https://play.google.com/store/apps/details?id=com.cyanidesayonara.dopepod
  - label: Código versión web
    href: https://github.com/cyanidesayonara/dopepod
  - label: Código versión móvil
    href: https://github.com/cyanidesayonara/dop3pod
order: 10
color: magenta
---

Un reproductor de podcasts que ha evolucionado desde una aplicación web hasta una app móvil multiplataforma para descubrir y escuchar miles de podcasts gratuitos con facilidad.

## Versión web (v1)

El dopepod original nació como mi proyecto final de CS50. Usaba Django con PostgreSQL en el servidor y jQuery en el cliente. La API de iTunes aportaba el catálogo de podcasts y unos scrapers propios enriquecían los metadatos.

![La versión web original](/img/projects/dopepod.png)

## Versión móvil (`dop3pod`)

La versión 3 (`dop3pod`) rehízo el proyecto alrededor de un backend en Django REST Framework dockerizado y un cliente en Flutter:

- **Backend e indexación:** Django REST Framework sobre PostgreSQL, con workers de Celery, Redis como caché y bróker de mensajería y arañas de Scrapy manteniendo actualizados el directorio de podcasts y las listas de episodios.
- **Cliente móvil:** aplicación Flutter conectada a la API REST con búsqueda de podcasts, listado de episodios y un reproductor superpuesto persistente con controles de lista de reproducción.
- **Desarrollo en curso:** tras las actualizaciones de Docker y dependencias en `dop3pod` (junto con mejoras previas en autenticación de usuarios y el reproductor), he retomado el desarrollo activo sobre esta tercera generación.
