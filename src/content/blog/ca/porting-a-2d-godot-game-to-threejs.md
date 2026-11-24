---
title: "Portant un passeig 2D de Godot a Three.js sense disparar les crides de dibuixat"
description: "Notes de construir el front marítim interactiu /walk en aquest portfoli: passar píxels a metres, fusionar geometria amb DirectBuilder, carregar districtes per trams i portar les proves de la corretja."
date: 2026-11-19
tags: [threejs, typescript, webgl, physics]
project: path-of-leash-resistance
cover: /img/projects/leash-eixample.jpg
coverAlt: Un passeig per l'Eixample a Path of Leash Resistance
---

*Path of Leash Resistance* viu al lloc del portfoli com un carrer 2D en canvas a la portada i una vila costanera catalana caminable en 3D a `/walk`. Portar el passeig marítim, les illes urbanes, la plaça del mercat i el turó a un canvas WebGL del navegador sense empaquetar art 3D extern exigia resoldre aviat dos problemes: escala física i disciplina de crides de dibuixat.

## Traduir píxels a metres (`68 px = 1 m`)

El joc 2D de Godot mesura una corretja retràctil de 340 px en píxels de pantalla i avança a 60 Hz. A `src/scripts/walk/leash.ts`, la simulació XZ reescala a metres (`68 px = 1 m`, donant una corretja de 5 m) i avança a 120 Hz.

Dos petits detalls del port van marcar la diferència més gran en sensacions:

- **Antitúnel per costat de segment per a fanals 3D.** En 3D, un pal prim (`r = 0.06 m`) cau entre vèrtexs Verlet separats per 0.2 m. Sense comprovar a quin costat del pal va començar cada segment (`pushSegment()`), un esprint ràpid fa passar la corda recta a través del pal.
- **Bloquejar sempre era massa estricte.** Quan més endavant vaig portar les comprovacions de volta i lliscament de Godot a `tests/leash.test.ts`, l'asserció de "estirar fort cap al mateix costat fa lliscar la volta" va fallar al principi: mantenir el bloqueig de costat actiu amb estirament extrem impedia que les voltes rellisquessin fora. Relaxar els bloquejos de costat a `pushSegment()` per sobre d'`1.35x` d'estirament i durant `whirl` / `freeSlip` actius va mantenir intacte l'antitúnel en pals prims durant estrebades normals mentre deixava desfer amb netedat les voltes sobreestirades.

## Mantenir planes les crides de dibuixat WebGL en codi

Tot a `/walk` es construeix de manera procedural: textures de panot, façanes arrebossades, rètols en canvas, edificis, palmeres, bicicletes i personatges. Instanciar objectes `THREE.Mesh` separats per a cada maó, graó i marc de finestra encallaria ràpid les GPU mòbils.

Tres regles van mantenir l'escena al voltant d'uns ~650–700 crides de dibuixat en escriptori fins i tot amb diversos districtes carregats:

1. **Constructors directes de triangles fusionats (`meshbuilder.ts`).** Les illes estàtiques, malles de terreny i siluetes llunyanes emeten triangles no indexats directament en blocs amb color per vèrtex mitjançant `DirectBuilder` en comptes de reservar milers de `BoxGeometry` temporals.
2. **Generadors partits i pressupostos per fotograma (`world.ts`, `bake.ts`).** Les construccions pesants (`buildLevelSteps()`, `makePlazaDistrict()`, `makeHillDistrict()`) cedeixen el pas com a generadors rere la pantalla de càrrega del tren/metro i sota un pressupost de streaming de 4 ms (`Streamer`), bescanviant siluetes llunyanes per blocs cuits vius quan la Millie entra dins els 80 m i descarregant-los més enllà dels 170 m.
3. **Tramat en línia de visió (`fade.ts`).** En lloc d'amagar façanes de cop entre la càmera de carrer i la Millie, un tramat personalitzat al shader esvaeix amb puntets la geometria al llarg del raig càmera-gos mentre eximeix els personatges i la corretja vermella.

## Partir el bucle d'execució

A mesura que els districtes i els pavellons interactius de projectes (`Coriolis`, `stemma`, `Eat Prey Nap`, `dopepod`) s'acumulaven dins `game3d.ts`, l'orquestrador va superar les 3.000 línies. Extreure `particles.ts`, `sky.ts`, `goals.ts` i `boothPanels.ts` juntament amb proves unitàries automatitzades (`tests/leash.test.ts`) i una comprovació smoke headless per CDP (`tools/smoke-check.mjs`) va acostar l'aparador 3D a les proteccions d'enginyeria del joc real.
