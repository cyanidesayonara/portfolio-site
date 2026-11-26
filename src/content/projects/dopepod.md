---
title: dopepod
tagline: A free podcast player that runs entirely in your browser.
summary: A static Svelte podcast player with no account and no server. Started as my CS50 final project and rebuilt twice since.
kind: Web app
stack: [Svelte, TypeScript, GitHub Actions, GitHub Pages, Podcast Index]
years: "2017 to now"
cover: /img/projects/dopepod-web.webp
coverAlt: The dopepod home page with its catalog of podcasts and category filters
links:
  - label: Open dopepod
    href: https://cyanidesayonara.github.io/dop3pod/
  - label: Source on GitHub
    href: https://github.com/cyanidesayonara/dop3pod
  - label: Web version (v1) source
    href: https://github.com/cyanidesayonara/dopepod
order: 10
color: magenta
---

A podcast player that began as a Django web app, became a mobile app with a full backend, and now runs as a static site with no server to look after.

## Today: a static player

The current version is written in Svelte and TypeScript and hosted on GitHub Pages. Browse a hand-picked catalog in four languages, search a directory of about 27,000 more shows, queue episodes, change speed, set a sleep timer, keep favorites and pick up where you left off. Everything it remembers stays in your browser.

- **No backend:** a daily GitHub Action reads the catalog's feeds and publishes small JSON files and cover thumbnails.
- **A directory and charts from Podcast Index:** once a month the same Action builds the searchable directory from Podcast Index's public data dump, and once a day it fetches the New and rising charts by category and language. Its API key stays in the Action; the site only receives the finished lists.
- **Audio straight from the publishers:** nothing is copied or re-hosted.
- **Feeds are untrusted:** the parser tolerates broken XML, accepts only https audio and reduces descriptions to plain text.

![A show page with its episode list](/img/projects/dopepod-show.webp)

The dopepod booths on this site, on the [2D street](/) and the [3D walk](/walk), play real episodes from the same catalog.

## Web version (v1)

The original dopepod started life as my CS50 final project. It used Django with PostgreSQL on the backend and jQuery on the frontend. The iTunes API provided the podcast catalog, and custom scrapers enriched the metadata.

![The original web version](/img/projects/dopepod.webp)

## Mobile version

The next rebuild, `dop3pod`, paired a Dockerized Django REST Framework backend with a Flutter client. Celery workers, Redis and Scrapy spiders kept the podcast directory and episode feeds updated, and the app had search, episode listings and a persistent player with a playlist. Its code lives on in the [repository's history](https://github.com/cyanidesayonara/dop3pod/tree/92ffd4c002a9dc4c05a3980c5833b6c2e61c82ef).

![The Flutter mobile app](/img/projects/dop3pod.webp)
