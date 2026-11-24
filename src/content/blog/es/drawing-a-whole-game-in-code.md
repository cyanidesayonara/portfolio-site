---
title: "Sin sprites: dibujando todo un juego de Godot en código"
description: "Cada perro, farola, baldosa de acera y cinemática de Path of Leash Resistance se dibuja en _draw(). Así es como se mantiene rápido y verificable el arte vectorial procedural en navegador."
date: 2026-10-27
tags: [godot, rendering, performance, testing]
project: path-of-leash-resistance
cover: /img/projects/leash-eixample.jpg
coverAlt: Un perro y su humano en una esquina del Eixample de Barcelona dibujados íntegramente con vectores procedurales
---

Salvo dos fuentes (`BricolageGrotesque.ttf` e `Inter.ttf`) y un `icon.png` generado, [Path of Leash Resistance](https://github.com/cyanidesayonara/path-of-leash-resistance) no carga ni un archivo de imagen en todo el juego. Cada perro, viandante, escaparate barcelonés, panot de acera y película lateral de persecución se dibuja de forma procedural en GDScript dentro de `_draw()`, compartiendo la misma paleta Trencadís definida en `hud/ui_kit.gd`.

Dibujarlo todo por código mantiene diminuto el repositorio y permite que los agentes de programación creen y revisen niveles en diffs de texto plano. La contrapartida está en el rendimiento: si pintas un cruce animado del Eixample en el navegador llamando a `draw_circle()` y `draw_rect()` sin agrupar, los tiempos por cuadro se desploman enseguida.

## El cuello de botella web en GL Compatibility

Path of Leash Resistance sale en web sobre el renderizador GL Compatibility de Godot 4 porque es el que exige la exportación HTML5 de Godot. En Compatibility, las llamadas cómodas de dibujo no se fusionan solas como cabría esperar: cada `draw_circle()` y `draw_colored_polygon()` genera su propia llamada de dibujo, y alternar un simple `draw_rect()` con un `draw_line()` corta el lote y abre otro nuevo.

En una calle de Barcelona llena de panots de cuatro pétalos, copas de árboles, tráfico y gente, esas llamadas extra son justo lo que paga la versión web.

## `ShapeBatch`: una sola llamada de dibujo, salida idéntica al píxel

Para conservar la comodidad de `_draw()` sin pagar el coste de dibujar forma por forma, creé `systems/shape_batch.gd` (`ShapeBatch`). Agrupa rachas de círculos rellenos, rectángulos, líneas gruesas y polígonos triangulados en una sola lista plana de triángulos y la envía de golpe.

Dos detalles permiten enchufarlo con seguridad en funciones de dibujo existentes:

- **Actúa como reemplazo directo del lienzo.** `ShapeBatch.new(self)` expone `draw_circle`, `draw_rect`, `draw_line`, `draw_colored_polygon` y `draw_set_transform` con exactamente las firmas habituales de `CanvasItem` en Godot. Cualquier cosa que no gestiona en lote —rectángulos solo con contorno, líneas finas de grosor `-1`, texto o arcos— vacía la cola acumulada y delega directo al lienzo subyacente para no alterar el orden de pintado.
- **Reproduce la matemática del motor hasta el último píxel.** `ShapeBatch` genera un abanico unitario de 64 segmentos siguiendo el mismo orden en coma flotante de 32 bits que `RendererCanvasCull::canvas_item_add_ellipse` en Godot, lo transforma con multiplicación nativa `Transform2D`, triangula polígonos con `Geometry2D.triangulate_polygon` e incluso redondea los colores de línea a half-float (`_as_half`) igual que guarda el color por vértice el motor. `tests/test_shape_batch.gd` renderiza ambas rutas lado a lado y comprueba que coinciden píxel a píxel.

En escenas cargadas como céspedes, plazas embaldosadas o multitudes lejanas, activar `lod` adapta los lados de cada círculo según un presupuesto `LOD_SAG` de 0,15 px —8 lados para un punto de 2 px, 19 a 10 px y los 64 segmentos completos solo cuando supera unos ~110 px—, evitando gastar casi un millón de vértices por repintado en un prado lleno de motas pequeñas. Mientras tanto, capas estáticas cacheadas como `world/panot.gd` (`Panot.flor` y los hexágonos `Panot.gaudi` de Passeig de Gràcia) graban los triángulos una sola vez y los reproducen directo dentro del lote de quien llama con cero llamadas extra.

## Iluminación sin bandas

La luz vectorial suele delatarse con anillos concéntricos si apilas discos o franjas semitransparentes planos. En su lugar, las luces suaves pasan por ayudantes explícitos de degradado —`ShapeBatch.glow` para focos circulares, `ShapeBatch.band` para tiras difuminadas e `IntroKit.vgrad` para cielos de cinemática—, mientras `world/light_layer.gd` agrupa todos los escaparates iluminados y abanicos de portales en una única pasada modulada por `Game.lamp_glow()`. Por último, `hud/grade.gdshader` aplica tramado (dithering) para que los atardeceres lentos tampoco escalonen el color, vigilado por `tests/test_soft_light.gd`.

## Probar el arte procedural igual que el código

Cuando tu arte *es* código, puedes verificar cambios visuales con las mismas herramientas que la física:

- **Relojes de cuadro deterministas:** ninguna función de dibujo consulta `Time.get_ticks_msec()`. Todas leen `AnimClock.msec()`, que en modo captura queda fijado al contador de cuadros. `tools/shot_sweep.sh` captura cada paseo y menú, además de la calle en tamaños móviles (`844×390` y `390×844`), y `tools/shot_diff.py` demuestra que una refactorización del batching cambió exactamente cero píxeles.
- **Comprobación cruzada entre física y superficie visual:** cuando hierba, grava, agua y acera se dibujan por script, es fácil que una mancha visual no coincida con lo que hay debajo. `tools/surface_map.sh` vuelca puntos de colores con la superficie física real en cada coordenada, y `tools/surface_check.py` los compara contra la imagen renderizada para cazar automáticamente cualquier acera pintada como arena o agua.
