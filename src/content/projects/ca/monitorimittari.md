---
title: Monitorimittari
tagline: Un registrador de luminància que manté dins de norma les pantalles de diagnòstic hospitalari.
summary: Una eina d'escriptori en Python que llegeix un mesurador de luminància LXscan per USB i genera informes de compliment per a monitors mèdics.
kind: Tool
stack: [Python, PyQt5, PyInstaller]
cover: /img/projects/monitorimittari.png
coverAlt: La interfície de Monitorimittari
links:
  - label: Codi a GitHub
    href: https://github.com/cyanidesayonara/monitorimittari
order: 13
color: leaf
---

Una aplicació d'escriptori creada per a l'equip d'enginyeria del Districte Hospitalari d'Hèlsinki. Es comunica amb un fotòmetre puntual LXscan per mesurar i registrar la brillantor dels monitors, de manera que les pantalles mèdiques es verifiquin respecte als estàndards de luminància de què depèn el diagnòstic.

- Integració directa amb el mesurador per USB
- Informes automatitzats en Excel per a documentació de compliment
- Converteix un procés manual pesat en un flux guiat
