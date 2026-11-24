---
title: "Sense sprites: dibuixant tot un joc de Godot en codi"
description: "Cada gos, fanal, panot de vorera i cinemàtica de Path of Leash Resistance es dibuixa dins _draw(). Així és com es manté ràpid i verificable l'art vectorial procedural al navegador."
date: 2026-10-27
tags: [godot, rendering, performance, testing]
project: path-of-leash-resistance
cover: /img/projects/leash-eixample.jpg
coverAlt: Un gos i el seu humà en una cantonada de l'Eixample de Barcelona dibuixats íntegrament amb vectors procedurals
---

Fora de dues tipografies (`BricolageGrotesque.ttf` i `Inter.ttf`) i un `icon.png` generat, [Path of Leash Resistance](https://github.com/cyanidesayonara/path-of-leash-resistance) no carrega ni un fitxer d'imatge en tot el joc. Cada gos, vianant, aparador barceloní, panot de vorera i pel·lícula lateral de persecució es dibuixa de manera procedural en GDScript dins `_draw()`, compartint una única paleta Trencadís definida a `hud/ui_kit.gd`.

Dibuixar-ho tot per codi manté minúscul el repositori i fa que els agents de programació creïn i revisin nivells en diffs de text pla. El preu és el rendiment: si pintes una cruïlla animada de l'Eixample al navegador cridant `draw_circle()` i `draw_rect()` sense agrupar, els temps de fotograma s'enfonsen de seguida.

## El coll d'ampolla web en GL Compatibility

Path of Leash Resistance surt al web sobre el renderitzador GL Compatibility de Godot 4 perquè és el que exigeix l'exportació HTML5 de Godot. En Compatibility, les crides còmodes de dibuix no es fusionen soles com podries esperar: cada `draw_circle()` i `draw_colored_polygon()` es converteix en la seva pròpia crida de dibuix, i només alternar un `draw_rect()` amb un `draw_line()` talla el lot i n'obre un altre.

En un carrer de Barcelona ple de panots de quatre pètals, capçades d'arbres, trànsit i gent, aquestes crides extra són just el que paga la versió web.

## `ShapeBatch`: una sola crida de dibuix, sortida idèntica al píxel

Per conservar la comoditat de `_draw()` sense pagar el cost d'una crida per figura, vaig construir `systems/shape_batch.gd` (`ShapeBatch`). Ajunta ratxes de cercles omplerts, rectangles, línies amples i polígons triangulats en una única llista plana de triangles i l'envia d'una sola tirada.

Dos detalls permeten endollar-lo amb seguretat dins funcions de dibuix ja fetes:

- **Actua com un llenç intercanviable.** `ShapeBatch.new(self)` exposa `draw_circle`, `draw_rect`, `draw_line`, `draw_colored_polygon` i `draw_set_transform` amb exactament les signatures normals de `CanvasItem` a Godot. Qualsevol crida que no gestiona nativament —rectangles només amb contorn, línies fines de gruix `-1`, text o arcs— buida els triangles en cua i passa directe al llenç subjacent perquè l'ordre de pintat no es mogui.
- **Reprodueix les matemàtiques del motor fins al píxel.** `ShapeBatch` genera un ventall unitari de 64 segments seguint el mateix ordre de coma flotant de 32 bits que `RendererCanvasCull::canvas_item_add_ellipse` a Godot, el transforma amb multiplicació nativa `Transform2D`, triangula polígons amb `Geometry2D.triangulate_polygon` i fins i tot arrodoneix els colors de línia a half-float (`_as_half`) tal com desa el color per vèrtex el renderitzador. `tests/test_shape_batch.gd` dibuixa tots dos camins de costat i comprova que coincideixin píxel a píxel.

Per a escenes carregades com gespes, places enrajolades o multituds llunyanes, activar `lod` adapta la resolució dels cercles amb un pressupost `LOD_SAG` de 0,15 px —8 costats per a un punt de 2 px, 19 a 10 px i els 64 segments complets només un cop supera uns ~110 px—, evitant gastar vora un milió de vèrtexs per repintat en un prat ple de puntets. Mentrestant, capes estàtiques desades en memòria cau com `world/panot.gd` (`Panot.flor` i els hexàgons `Panot.gaudi` del Passeig de Gràcia) enregistren els triangles un sol cop i els reprodueixen directe dins el lot de qui crida amb zero crides extra.

## Il·luminació sense bandes

La llum vectorial té fama de fer anells concèntrics si apiles discs o franges semitransparents plans. En lloc d'això, les llums suaus passen per ajudants explícits de degradat —`ShapeBatch.glow` per a focus rodons, `ShapeBatch.band` per a tires difuminades i `IntroKit.vgrad` per a cels de cinemàtica—, mentre `world/light_layer.gd` agrupa tots els aparadors il·luminats i ventalls de portals en una sola passada modulada per `Game.lamp_glow()`. Finalment, `hud/grade.gdshader` aplica tramada (dithering) perquè les postes lentes tampoc esglaonin el color, vigilat per `tests/test_soft_light.gd`.

## Provar l'art procedural com codi

Quan el teu art *és* codi, pots comprovar canvis visuals de la mateixa manera que proves la física:

- **Rellotges de fotograma deterministes:** cap funció de dibuix llegeix `Time.get_ticks_msec()`. Totes llegeixen `AnimClock.msec()`, que en mode captura queda clavat al comptador de fotogrames. `tools/shot_sweep.sh` captura cada passeig i menú, a més del carrer en mides mòbils (`844×390` i `390×844`), i `tools/shot_diff.py` demostra que una refactorització del batching va canviar zero píxels.
- **Comprovació creuada entre física i superfície visual:** quan herba, grava, aigua i vorera es dibuixen per script, és fàcil que un pegat visual no lligui amb el que hi ha a sota. `tools/surface_map.sh` bolca punts de colors amb el tipus de superfície física real a cada punt, i `tools/surface_check.py` els compara amb el fotograma dibuixat per enxampar automàticament qualsevol vorera pintada com a sorra o aigua.
