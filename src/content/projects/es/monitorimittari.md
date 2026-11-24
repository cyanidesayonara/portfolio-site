---
title: Monitorimittari
tagline: Un registrador de luminancia que mantiene dentro de norma los monitores de diagnóstico hospitalario.
summary: Una herramienta de escritorio en Python que lee un medidor de luminancia LXscan por USB y genera informes de cumplimiento para pantallas médicas.
kind: Tool
stack: [Python, PyQt5, PyInstaller]
cover: /img/projects/monitorimittari.png
coverAlt: La interfaz de Monitorimittari
links:
  - label: Código en GitHub
    href: https://github.com/cyanidesayonara/monitorimittari
order: 13
color: leaf
---

Una aplicación de escritorio creada para el equipo de ingeniería del Distrito Hospitalario de Helsinki. Se comunica con un fotómetro puntual LXscan para medir y registrar el brillo de los monitores, de modo que las pantallas médicas cumplan con los estándares de luminancia exigidos en el diagnóstico clínico.

- Integración directa con el medidor por USB
- Informes automatizados en Excel para documentación de cumplimiento
- Convierte un proceso manual tedioso en un flujo guiado
