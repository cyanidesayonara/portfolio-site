---
title: "La cuerda es la restricción: sustituyendo listas de pivotes por una correa Verlet"
description: "Por qué el estado separado de giros y pivotes se rompía en múltiples vueltas y desenganches en Path of Leash Resistance, y cómo una cuerda Verlet de 24 puntos resolvió postes, enredos y deslizamientos con un solo solver."
date: 2026-10-20
tags: [godot, physics, verlet, testing]
project: path-of-leash-resistance
cover: /img/projects/leash-street.jpg
coverAlt: Un perro tira de su humano con una correa roja larga sobre el pavimento ondulado de La Rambla
---

En un juego llamado *Path of Leash Resistance*, la correa no puede ser decorativa. Si la cinta dibujada rodea una farola mientras la física tira en línea recta entre el perro y el humano, cada vuelta se siente falsa.

Las primeras versiones probaron el atajo habitual en vista cenital: mantener una lista de puntos de pivote cada vez que el segmento perro-humano cruzaba un obstáculo y acortar la longitud restante en consecuencia. En la práctica, ese estado dividido fallaba una y otra vez.

## Dónde se rompía el registro de pivotes

Tres errores volvían sin parar en los primeros commits:

1. **Deriva entre lo visual y lo físico.** La curva renderizada aplicaba su propio suavizado mientras la pila de pivotes seguía las intersecciones por otro lado. En giros rápidos, la cinta parecía enrollada mientras la tensión seguía apuntando recta a través de un poste.
2. **Desenganches en múltiples vueltas.** Dar dos vueltas alrededor de un poste y deshacer el camino en orden inverso a menudo sacaba el pivote equivocado o dejaba una esquina fantasma clavada cuando el perro ya había salido libre.
3. **Las correas de otros paseantes.** Añadir parejas de NPC con perro implicaba dos cuerdas móviles cruzándose en espacio abierto. Las listas de pivotes suponen centros circulares estáticos; no tienen una respuesta limpia cuando el "poste" es otra correa en movimiento.

## Convertir la cuerda visible en la restricción

La solución en `entities/leash.gd` fue eliminar por completo el estado separado de giros. La correa es una única cadena Verlet de 24 puntos (`N = 24`, `ITER = 11` pasadas de restricción por tick), y los puntos dibujados en pantalla son exactamente los mismos que generan las fuerzas:

- **Colisión segmento contra círculo.** Cada iteración empuja tanto segmentos (`_collide_circles`) como puntos fuera de los obstáculos cercanos (`POLE_PAD = 13 px` o radios propios por obstáculo). Como los propios segmentos colisionan, los tramos estirados no pueden atravesar farolas finas haciendo túnel.
- **Adherencia y deslizamiento alrededor de obstáculos.** Los puntos en contacto resisten el deslizamiento con poco estiramiento (`STATIC_SLIP_MIN = 0.15` para postes), de modo que las vueltas intencionadas se ciñen con firmeza. Pasada la longitud en reposo, el deslizamiento en postes sube de forma gradual, mientras que el mobiliario y los enganches con cuerdas dinámicas suben hasta `1.0` en `STRETCH_CAP = 1.15`, permitiendo soltar enganches con limpieza en lugar de dejar al humano pegado a las mesas de terraza.
- **Tirón tangente y entrada suave en tensión.** `tension_force()` suaviza la fuerza del muelle durante el primer 5% de estiramiento (`TAUT_ONSET_END = 1.05`) mediante `taut_amount()`, leyendo las tangentes de los extremos a lo largo de `TANGENT_RUN = 3` segmentos (o el segmento de contacto inmediato cuando está enrollada). Al rodear un poste, el vector de tirón del humano gira de forma natural describiendo un arco a su alrededor.
- **Enredos con NPC gratis.** Los obstáculos dinámicos simplemente alimentan puntos de correas vecinas dentro del mismo array de colisión circular con deslizamiento `K_DYNAMIC`, así que dos correas se cruzan y apoyan sin ninguna máquina de estados especial.

## Fijar la física con pruebas headless

Como las regresiones de la cuerda solían esconderse tras ajustes de sensaciones, los invariantes viven ahora en scripts de prueba headless en Godot (`tests/test_wrap.gd` y `tests/test_leash_taut_transition.gd`):

- Los tirones en línea recta siguen la distancia de la cuerda tensa y orientan las tangentes de los extremos de vuelta hacia ella.
- Entrar en espiral rodea un poste con limpieza, ciñe los contactos cuando se tensa y curva el vector de tirón del humano apartándolo de la recta directa.
- Tirar con fuerza hacia el mismo lado desliza la vuelta hacia fuera en lugar de dejar al humano pegado al poste.
- Los enganches dinámicos registran `winding()` sin acumular `static_winding()`, de modo que los enredos con transeúntes nunca disparan el multiplicador de polea de los postes.

Nada garantiza que la física de un juego no te sorprenda nunca, pero hacer que la cuerda renderizada y la restricción física compartan exactamente el mismo array eliminó de golpe toda una clase de errores de desincronización.
