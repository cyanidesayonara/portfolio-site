---
title: dopepod
tagline: Un reproductor de pòdcasts gratuït que funciona del tot al teu navegador.
summary: Un reproductor de pòdcasts estàtic en Svelte, sense compte ni servidor. Va començar com el meu projecte final de CS50 i l'he refet dues vegades.
kind: Web app
stack: [Svelte, TypeScript, GitHub Actions, GitHub Pages]
years: "2017 fins avui"
cover: /img/projects/dopepod-web.webp
coverAlt: La pàgina d'inici de dopepod amb el catàleg de pòdcasts i filtres per categoria
links:
  - label: Obre dopepod
    href: https://cyanidesayonara.github.io/dop3pod/
  - label: Codi a GitHub
    href: https://github.com/cyanidesayonara/dop3pod
  - label: Codi versió web (v1)
    href: https://github.com/cyanidesayonara/dopepod
order: 10
color: magenta
---

Un reproductor de pòdcasts que va néixer com a aplicació web en Django, va esdevenir una app mòbil amb un backend complet i avui és un lloc estàtic sense cap servidor per mantenir.

## Avui: un reproductor estàtic

La versió actual està escrita en Svelte i TypeScript i allotjada a GitHub Pages. Explora un catàleg triat a mà, reprodueix i salta, canvia la velocitat, desa preferits i continua on ho vas deixar. Tot el que recorda es queda al teu navegador.

- **Sense backend:** una GitHub Action diària llegeix els 40 feeds de pòdcasts del catàleg i publica petits fitxers JSON i miniatures de les portades.
- **L'àudio arriba directe de qui el publica:** no es copia ni es torna a allotjar res.
- **Els feeds no són de fiar:** l'analitzador tolera XML defectuós, només accepta àudio per https i redueix les descripcions a text pla.

![La pàgina d'un pòdcast amb la llista d'episodis](/img/projects/dopepod-show.webp)

Les casetes de dopepod d'aquest web, al [carrer 2D](/ca/) i al [passeig 3D](/ca/walk), reprodueixen episodis reals del mateix catàleg.

## Versió web (v1)

El dopepod original va néixer com el meu projecte final de CS50. Utilitzava Django amb PostgreSQL al backend i jQuery al frontend. L'API d'iTunes proveïa el catàleg de pòdcasts i uns scrapers propis n'enriquien les metadades.

![La versió web original](/img/projects/dopepod.webp)

## Versió mòbil

La reescriptura següent, `dop3pod`, unia un backend en Django REST Framework dockeritzat amb un client en Flutter. Els workers de Celery, Redis i les aranyes d'Scrapy mantenien al dia el directori de pòdcasts i els episodis, i l'app tenia cerca, llistat d'episodis i un reproductor persistent amb llista de reproducció. El seu codi continua a l'[historial del repositori](https://github.com/cyanidesayonara/dop3pod/tree/92ffd4c002a9dc4c05a3980c5833b6c2e61c82ef).

![L'app mòbil en Flutter](/img/projects/dop3pod.webp)
