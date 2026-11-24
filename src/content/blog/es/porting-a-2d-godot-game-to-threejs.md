---
title: "Portando un paseo 2D de Godot a Three.js sin disparar las llamadas de dibujado"
description: "Notas de construir el frente marítimo interactivo /walk en este portfolio: pasar píxeles a metros, fusionar geometría con DirectBuilder, cargar distritos por tramos y portar las pruebas de la correa."
date: 2026-11-19
tags: [threejs, typescript, webgl, physics]
project: path-of-leash-resistance
cover: /img/projects/leash-eixample.jpg
coverAlt: Un paseo por el Eixample en Path of Leash Resistance
---

*Path of Leash Resistance* vive en el sitio del portfolio como una calle 2D en canvas en la portada y una localidad costera catalana caminable en 3D en `/walk`. Llevar el paseo marítimo, las manzanas urbanas, la plaza del mercado y la ladera a un canvas WebGL del navegador sin empaquetar arte 3D externo exigía resolver pronto dos problemas: escala física y disciplina de llamadas de dibujado.

## Traducir píxeles a metros (`68 px = 1 m`)

El juego 2D de Godot mide una correa retráctil de 340 px en píxeles de pantalla y avanza a 60 Hz. En `src/scripts/walk/leash.ts`, la simulación XZ reescala a metros (`68 px = 1 m`, dando una correa de 5 m) y avanza a 120 Hz.

Dos pequeños detalles de la adaptación marcaron la mayor diferencia en sensaciones:

- **Antitúnel por lado de segmento para farolas 3D.** En 3D, un mástil fino (`r = 0.06 m`) cae entre vértices Verlet separados por 0.2 m. Sin comprobar en qué lado del poste empezó cada segmento (`pushSegment()`), un esprint rápido hace pasar la cuerda recta a través del poste.
- **Bloquear siempre era demasiado estricto.** Cuando más tarde porté las comprobaciones de giro y deslizamiento de Godot a `tests/leash.test.ts`, la aserción de "tirar fuerte en sentido contrario suelta la vuelta" falló al principio: mantener el bloqueo de lado activo con estiramiento extremo impedía que las vueltas resbalasen fuera. Relajar los bloqueos de lado en `pushSegment()` por encima de `1.35x` de estiramiento y durante `whirl` / `freeSlip` activos mantuvo intacto el antitúnel en postes finos durante tirones normales mientras dejaba soltar con limpieza las vueltas sobreestiradas.

## Mantener planas las llamadas de dibujado WebGL por código

Todo en `/walk` se construye de forma procedural: texturas de panot, fachadas enlucidas, lienzos de cartelería, edificios, palmeras, bicicletas y personajes. Crear objetos `THREE.Mesh` por separado para cada ladrillo, escalón y marco de ventana bloquearía rápido las GPU móviles.

Tres reglas mantuvieron la escena alrededor de ~650–700 llamadas de dibujado en escritorio incluso con varios distritos cargados:

1. **Constructores directos de triángulos fusionados (`meshbuilder.ts`).** Las manzanas estáticas, mallas de terreno y siluetas lejanas emiten triángulos no indexados directamente en bloques con color por vértice mediante `DirectBuilder` en vez de reservar miles de `BoxGeometry` temporales.
2. **Generadores divididos y presupuestos por fotograma (`world.ts`, `bake.ts`).** Las construcciones pesadas (`buildLevelSteps()`, `makePlazaDistrict()`, `makeHillDistrict()`) ceden paso como generadores tras la pantalla de carga del tren/metro y bajo un presupuesto de streaming de 4 ms (`Streamer`), cambiando siluetas lejanas por bloques cocinados vivos cuando Millie entra dentro de 80 m y descargándolos más allá de 170 m.
3. **Tramado en línea de visión (`fade.ts`).** En lugar de ocultar fachadas de golpe entre la cámara de calle y Millie, un tramado personalizado en el shader vuelve semitransparente por tramos la geometría a lo largo del rayo cámara-perro mientras exime a los personajes y a la correa roja.

## Dividir el bucle de ejecución

A medida que los distritos y los pabellones interactivos de proyectos (`Coriolis`, `stemma`, `Eat Prey Nap`, `dopepod`) se acumulaban dentro de `game3d.ts`, el orquestador superó las 3.000 líneas. Extraer `particles.ts`, `sky.ts`, `goals.ts` y `boothPanels.ts` junto con pruebas unitarias automatizadas (`tests/leash.test.ts`) y una comprobación smoke headless por CDP (`tools/smoke-check.mjs`) acercó la vitrina 3D a las protecciones de ingeniería del juego real.
