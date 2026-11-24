---
title: Coriolis
tagline: Una pantalla LED de pared, diez años gestándose. Primero reloj; luego arte ambiental, entrenamientos y juegos.
summary: Un mural LED de 128×128 pensado para Teensy 4.1, desarrollado primero sobre simulador de escritorio. La tercera generación de un mural que empezó como Borealis en 2016.
kind: Hardware
stack: [C++, WebAssembly, Teensy 4.1, Matriz LED HUB75, CMake, Simulador de escritorio, Arduino]
years: "2016 hasta hoy"
cover: /img/projects/coriolis-aurora.png
coverAlt: Escena de aurora brillando en verde sobre la matriz LED de 128 por 128
coverDark: true
links:
  - label: Web y emulador en vivo
    href: https://cyanidesayonara.github.io/coriolis/
  - label: Coriolis en GitHub
    href: https://github.com/cyanidesayonara/coriolis
  - label: Borealis en GitHub
    href: https://github.com/cyanidesayonara/borealis
featured: true
order: 3
color: led
---

Aurora, luego Borealis y ahora Coriolis. Esta es la tercera generación de mi mural LED: una pantalla de 128×128 hecha con cuatro paneles HUB75 de 64×64 y un Teensy 4.1. Es ante todo un reloj de pared, con arte ambiental, una suite guiada de ejercicio y juegos encima. El software va por delante del hardware: el motor completo en C++11 ya corre hoy en un simulador de escritorio y aquí mismo en tu navegador con WebAssembly mientras toma forma el montaje físico.

## Coriolis: 128×128

El simulador de escritorio es el entorno principal de desarrollo, y exactamente el mismo motor C++11 de `core/` y `scenes/` se compila limpio a WebAssembly tanto para el emulador interactivo de arriba como para la [web independiente de Coriolis](https://cyanidesayonara.github.io/coriolis/). El cambio de escena, el lanzador, los ajustes, las transiciones suaves y las capas superpuestas son idénticos línea por línea entre escritorio, navegador y firmware, porque las escenas dibujan sobre un búfer de cuadro abstracto sin tocar el hardware directamente.

<div class="gallery">

![Reloj digital](/img/projects/coriolis-clock.png)
![Tiempo](/img/projects/coriolis-weather.png)
![Yoga](/img/projects/coriolis-yoga.png)
![Ejercicio](/img/projects/coriolis-exercise.png)
![Respirar](/img/projects/coriolis-breathe.png)
![Laberinto](/img/projects/coriolis-labyrinth.png)
![Lámpara de lava](/img/projects/coriolis-lava.png)
![Chimenea](/img/projects/coriolis-fireplace.png)
![Mandala](/img/projects/coriolis-mandala.png)
![Snake](/img/projects/coriolis-snake.png)

</div>

- **Relojes y horario**: relojes digital, analógico y de palabras, previsión y calendario, modo noche programado con atenuación automática y un reloj superpuesto movible y redimensionable sobre cualquier escena.
- **Arte ambiental**: aurora, lava, chimenea, lluvia, campo estelar, mandala, un acuario, espirógrafos y el Juego de la Vida, con transiciones suaves deslizantes y fundidos.
- **Ejercicio físico**: secuencias bilaterales de yoga y rutinas guiadas con figuras cinemáticas suavizadas, tabata, respiración, temporizadores de concentración y paquete de voz en DFPlayer Mini.
- **Juegos y hardware**: Tetris, snake, pong y un laberinto con raycasting, además de receptor IR NEC y limitador dinámico de corriente por cuadro para el hardware con Teensy 4.1.

La [web de Coriolis](https://cyanidesayonara.github.io/coriolis/) y el repositorio incluyen los manuales descargables `Coriolis_User_Manual.pdf` y `Coriolis_Build_Guide.pdf`, junto con las notas del diario de montaje.

## Dónde empezó: Borealis, 64×64

Borealis fue un fork del [proyecto Aurora](https://github.com/pixelmatix/aurora) de Pixelmatix, un visualizador para paneles LED. Lo construí con dos paneles HUB75 de 64×32 atornillados a un marco de aluminio a medida, logrando una pantalla de 64×64 cuatro veces mayor que la original gobernada por un Teensy 3.2.

Lo monté en la primavera de 2016, antes de saber programar. Todo lo que hice entonces fue tocar algunos números y comentar funciones que no usaba para ahorrar memoria: a 64×64 iba peligrosamente cerca de los 64 KB de RAM del Teensy. Años después volví ya sabiendo programar para limpiar aquel código, y aquello acabó convirtiéndose en Coriolis.

<div class="gallery">
  <a class="anim-toggle" href="/img/projects/borealis-1.mp4" data-anim="/img/projects/borealis-1.mp4" data-poster="/img/projects/borealis-1-poster.jpg" data-label-play="Ver animación" data-label-stop="Ver imagen"><img src="/img/projects/borealis-1-poster.jpg" alt="Patrón de Borealis 1" loading="lazy" decoding="async" /><span class="anim-badge">Ver animación</span></a>
  <a class="anim-toggle" href="/img/projects/borealis-2.mp4" data-anim="/img/projects/borealis-2.mp4" data-poster="/img/projects/borealis-2-poster.jpg" data-label-play="Ver animación" data-label-stop="Ver imagen"><img src="/img/projects/borealis-2-poster.jpg" alt="Patrón de Borealis 2" loading="lazy" decoding="async" /><span class="anim-badge">Ver animación</span></a>
  <a class="anim-toggle" href="/img/projects/borealis-3.mp4" data-anim="/img/projects/borealis-3.mp4" data-poster="/img/projects/borealis-3-poster.jpg" data-label-play="Ver animación" data-label-stop="Ver imagen"><img src="/img/projects/borealis-3-poster.jpg" alt="Patrón de Borealis 3" loading="lazy" decoding="async" /><span class="anim-badge">Ver animación</span></a>
</div>
