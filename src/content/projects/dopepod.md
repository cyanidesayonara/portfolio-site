---
title: dopepod
tagline: A podcast player that grew from a Django web app into a Flutter mobile app.
summary: Discover and listen to thousands of free podcasts. Started as my CS50 final project, rebuilt with Flutter and Django REST Framework.
kind: Mobile app
stack: [Flutter, Django REST Framework, PostgreSQL, Celery, Redis, Scrapy]
cover: /img/projects/dop3pod.png
coverAlt: The dopepod mobile app
links:
  - label: Google Play
    href: https://play.google.com/store/apps/details?id=com.cyanidesayonara.dopepod
  - label: Web version source
    href: https://github.com/cyanidesayonara/dopepod
  - label: Mobile version source
    href: https://github.com/cyanidesayonara/dop3pod
order: 10
color: magenta
---

A podcast player that has evolved from a web application into a cross-platform mobile app, giving an easy way to discover and enjoy thousands of free podcasts.

## Web version (v1)

The original dopepod started life as my CS50 final project. It used Django with PostgreSQL on the backend and jQuery on the frontend. The iTunes API provided the podcast catalog, and custom scrapers enriched the metadata.

![The original web version](/img/projects/dopepod.png)

## Mobile version (v3)

Version 3 is a complete rebuild with Flutter and Django. The backend uses Django REST Framework with PostgreSQL, Celery and Redis handle background tasks, and Scrapy spiders keep the podcast directory fresh.
