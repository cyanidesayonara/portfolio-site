---
title: "Software antes que hardware: construyendo primero un mural LED en simulador"
description: Coriolis tiene 25 escenas, lanzador, ajustes y una suite de ejercicio físico antes incluso de montar el hardware. Así es por qué empecé por un simulador de escritorio.
date: 2026-11-23
tags: [hardware, c++, teensy, led, simulation]
cover: /img/projects/coriolis-aurora.png
coverAlt: Una escena de aurora en el simulador de matriz LED Coriolis
---

En 2016 construí Borealis, un mural LED de 64×64, antes de saber programar. Cambié unos cuantos números en código ajeno y comenté funciones hasta que cupo en 64 KB de RAM. Sigue colgado en mi pared.

Su sucesor, Coriolis, cuadruplica los píxeles: una pantalla de 128×128 armada con cuatro paneles HUB75 de 64×64 y controlada por un Teensy 4.1. Esta vez lo planteé justo al revés. Primero fue el software.

## El simulador como entorno principal de desarrollo

Coriolis se desarrolla contra un simulador de escritorio apoyado en raylib, y exactamente el mismo motor C++11 de `core/` y `scenes/` se compila ahora a WebAssembly para el emulador interactivo de la [web de Coriolis](https://cyanidesayonara.github.io/coriolis/). No es una maqueta aparte: la carcasa común —que gestiona pantalla inicial, cambio de escena, lanzador, ajustes, transiciones, capas superpuestas, avisos, reproducción automática y atenuación nocturna— es idéntica línea por línea entre el simulador, la versión WebAssembly y el firmware. Solo cambian los adaptadores finales, que mapean entradas y copian el cuadro terminado a una ventana, un lienzo de navegador o los paneles LED físicos.

Las escenas nunca tocan hardware. Dibujan dentro de un búfer de cuadro abstracto a través de un objeto contexto, de modo que el reloj, la aurora o la partida de snake que veo en el monitor es exactamente el mismo código que correrá en la pared.

## Diseñar para la habitación, no para la mesa

Una pantalla de pared de 128×128 con cuatro paneles HUB75E de 64×64 —unos 51×51 cm en paso P4 o 38×38 cm en P3— sigue reglas completamente distintas a un monitor a medio metro de la cara. Los textos diminutos desaparecen, las barras de estado recargadas se vuelven ruido y nadie quiere sacar el móvil ni acercarse a la pared cada vez que cambia de modo.

Todo en Coriolis está pensado para leerse desde el otro lado de la sala y manejarse con mando IR —ya sea un Apple Remote o un mando NEC estándar de 17 teclas conectado al receptor en el pin 16 del Teensy—. Pulsar Menú abre el lanzador categorizado de 25 escenas (`CLOCKS & INFO`, `GUIDED FITNESS`, `GAMES`, `AMBIENT ART`) para no recorrer dos docenas de modos en fila; mantener Menú salta directo a los ajustes de la escena activa; mantener Play/Pause vuelve al inicio.

El sonido resuelve lo que 128×128 píxeles no deberían intentar cargar a solas. Un módulo DFPlayer Mini conectado por serie añade campanadas de inicio y cierre, avisos a mitad de una postura de yoga al 50 %, cuentas atrás 3-2-1 y voces grabadas desde microSD con cada postura y repetición —así, cuando tienes la cabeza apoyada en la esterilla, ni siquiera necesitas levantar la vista en cada transición.

La suite de ejercicio físico es el mejor ejemplo. Busca sustituir vídeos guiados, así que todo debe entenderse desde el suelo: figuras anti-aliased con transiciones cinemáticas y columnas curvadas, temporizadores enormes, señales de color y un aviso "NEXT" cuatro segundos antes de cada cambio. Las posturas bilaterales corren por ambos lados automáticamente y el mando permite pausar, saltar o ajustar repeticiones sin levantarse.

## Lo que el simulador no alcanza a contar

Un simulador de escritorio valida composición, tiempos y navegación compartida, pero no descubre caprichos eléctricos ni ópticos del hardware HUB75 físico. Tres frentes siguen anotados en la lista de pruebas hasta encender los paneles sobre la mesa:

- **Silicio de los paneles y orden de cadena:** cuatro paneles HUB75E de 64×64 y barrido 1/32 parecen gemelos en la tienda, pero cada controlador responde distinto. Los registros de desplazamiento sencillos funcionan sin más; los paneles FM6126A quedan totalmente apagados salvo que se active `SM_HUB75_OPTIONS_FM6126A_RESET_AT_START`, y los ICN2038S o ICN2053 directamente no funcionan con SmartMatrix. Incluso con paneles compatibles, el cableado en C monta la fila inferior boca abajo para acortar fajas: por eso el firmware incluye un patrón serie de prueba por cuadrantes (`t`), y la guía explica dónde permutar canales de color en `blit()` si un lote viene en orden RBG o BGR.
- **Margen de alimentación y aislamiento USB:** cuatro paneles de 64×64 consumen 4–5 A cada uno en blanco pleno (16–20 A en total), así que el montaje especifica una fuente Mean Well LRS-200-5 de 40 A sin ventilador con condensadores de 1000–2200 µF por par de paneles, respaldada por un limitador dinámico de corriente por cuadro (`powerLimitedBrightness`) y un tope opcional en compilación (`CORIOLIS_MAX_BRIGHTNESS`) si se alimenta con una fuente menor. Cortar el puente `VUSB–VIN` bajo el Teensy 4.1 es obligatorio para que USB y el carril de 5 V no peleen entre sí.
- **Refresco a brillo mínimo y difusión:** SmartMatrix saca color de 36/48 bits cerca de 120 Hz para suavizar degradados de día, pero cadenas largas de paneles pueden mostrar un ligero parpadeo en los peldaños más bajos del modo nocturno. El marco físico combina imanes para los paneles con una plancha de metacrilato colado ahumado de 3 mm para lograr píxeles contrastados y nítidos; unos píxeles perfectamente cuadrados exigirían además una rejilla detrás del difusor.

## Lo siguiente: el montaje

El firmware ya compila limpio para Teensy 4.1 (Teensyduino 1.62 con SmartMatrix 4 parcheado) dejando unos 196 KB de RAM rápida libres, y el simulador permite seguir afinando escenas sin esperar piezas. La lista completa de materiales, el pinout del Teensy, el esquema de cableado y la secuencia escalonada de encendido viven en la [guía de montaje de hardware](https://github.com/cyanidesayonara/coriolis/blob/master/docs/BUILD.md) del repositorio (junto con `Coriolis_Build_Guide.pdf`). El ensamblaje físico y las primeras pruebas en banco vienen a continuación, y en cuanto el mural se ilumine comprobaremos qué tan cerca queda la realidad del simulador.
