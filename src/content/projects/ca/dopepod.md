---
title: dopepod
tagline: Un reproductor de pòdcasts que va créixer d'aplicació web en Django a app mòbil en Flutter.
summary: Descobreix i escolta milers de pòdcasts gratuïts. Va començar com el meu projecte final de CS50 i es va refer amb Flutter i Django REST Framework.
kind: Mobile app
stack: [Flutter, Django REST Framework, PostgreSQL, Celery, Redis, Scrapy, Docker]
years: "2017 fins avui"
cover: /img/projects/dop3pod.png
coverAlt: L'aplicació mòbil dopepod
links:
  - label: Google Play
    href: https://play.google.com/store/apps/details?id=com.cyanidesayonara.dopepod
  - label: Codi versió web
    href: https://github.com/cyanidesayonara/dopepod
  - label: Codi versió mòbil
    href: https://github.com/cyanidesayonara/dop3pod
order: 10
color: magenta
---

Un reproductor de pòdcasts que ha evolucionat des d'una aplicació web fins a una app mòbil multiplataforma per descobrir i gaudir de milers de pòdcasts gratuïts fàcilment.

## Versió web (v1)

El dopepod original va néixer com el meu projecte final de CS50. Utilitzava Django amb PostgreSQL al backend i jQuery al frontend. L'API d'iTunes proveïa el catàleg de pòdcasts i uns scrapers propis n'enriquien les metadades.

![La versió web original](/img/projects/dopepod.png)

## Versió mòbil (`dop3pod`)

La versió 3 (`dop3pod`) va refer el projecte al voltant d'un backend en Django REST Framework dockeritzat i un client en Flutter:

- **Backend i indexació:** Django REST Framework amb PostgreSQL, workers de Celery, Redis com a memòria cau i bròquer de missatges i aranyes d'Scrapy mantenint al dia el directori de pòdcasts i les llistes d'episodis.
- **Client mòbil:** aplicació Flutter connectada a l'API REST amb cerca de pòdcasts, llistat d'episodis i un reproductor superposat persistent amb controls de llista de reproducció.
- **Desenvolupament en marxa:** després de les actualitzacions de Docker i dependències a `dop3pod` (juntament amb millores prèvies d'autenticació i del reproductor), he reprès la feina activa sobre aquesta tercera generació.
