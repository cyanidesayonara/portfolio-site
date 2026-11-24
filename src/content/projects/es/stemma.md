---
title: stemma
tagline: Silencia tu instrumento. Toca encima. Separación de pistas con IA que corre en tu propio PC.
summary: Un reproductor de música para Windows que separa cualquier canción en pistas para quitar tu instrumento y repetir en bucle los compases que estás practicando.
kind: Desktop app
stack: [Python, PySide6, ONNX Runtime, HTDemucs, DirectML, librosa]
years: "2026"
cover: /img/projects/stemma-practice.png
coverAlt: Vista de práctica de stemma con formas de onda apiladas por pista y mezclador abajo
coverDark: true
coverPosition: "88% 50%"
links:
  - label: Web y demo en vivo
    href: https://cyanidesayonara.github.io/stemma/
  - label: Microsoft Store
    href: https://apps.microsoft.com/detail/9p2w12l8f381
  - label: Código en GitHub
    href: https://github.com/cyanidesayonara/stemma
featured: true
order: 2
color: turquoise
---

Importa una canción, sepárala en pistas (voz, batería, bajo, guitarra, piano, otros), silencia o pon en solo cualquiera de ellas y toca encima con tu instrumento. Sin cuentas ni suscripciones: todo funciona en tu propio equipo.

## La cabina de práctica

- Forma de onda apilada alta con un carril de color por pista que comparte cabezal y región de bucle A-B. La propia forma de onda funciona como deslizador accesible por teclado, y el estado de la sesión (canción, posición, mezclador, bucle, velocidad, metrónomo y tomas) se restaura al abrir.
- **Carril de acordes y secciones de canción**: todos los acordes del tema a lo largo de la línea de tiempo con lectura anticipada en directo, más una regla experimental de secciones sobre los compases donde puedes hacer clic para saltar o doble clic (`Shift+L`) para fijar el bucle al compás exacto.
- **Entrenador de bucle**: con un bucle activo, la velocidad sube un escalón en cada repetición hasta alcanzar el tempo completo.
- Velocidad en vivo manteniendo el tono, transposición de ±7 semitonos, detección automática de tempo, tonalidad y pulso, metrónomo sincronizado con cuenta previa y temas claro y oscuro.

![Grabando tomas sobre las pistas](/img/projects/stemma-takes.png)

## Separación

- **HTDemucs v4** para separación en cuatro y seis pistas (CPU) y **MDX-Net** en dos pistas por GPU mediante DirectML con respaldo automático a CPU, más filtrado de Wiener y puerta suave para reducir residuos entre pistas.
- Inferencia con ONNX Runtime, sin PyTorch. Los modelos se descargan la primera vez y se verifican mediante suma de comprobación.
- Las importaciones corren en segundo plano, desde un archivo local, arrastrando y soltando o desde una URL de YouTube (con un runtime integrado de QuickJS-ng para `yt-dlp`).

## Tocar encima

Graba tomas sobre las pistas a través de tu interfaz de audio. Aparecen como filas adicionales en el mezclador que puedes alinear en el tiempo, y puedes exportar la mezcla tal como la escuchas, una pista suelta o solo el fragmento en bucle en WAV o MP3.
