---
title: "Programari abans que maquinari: construint primer un mural LED en simulador"
description: Coriolis té 25 escenes, llançador, ajustos i una suite d'exercici físic abans fins i tot de muntar el maquinari. Així és per què vaig començar per un simulador d'escriptori.
date: 2026-11-23
tags: [hardware, c++, teensy, led, simulation]
cover: /img/projects/coriolis-aurora.png
coverAlt: Una escena d'aurora al simulador de matriu LED Coriolis
---

El 2016 vaig construir Borealis, un mural LED de 64×64, abans de saber programar. Vaig canviar uns quants números al codi d'algú altre i vaig comentar funcions fins que va cabre dins 64 KB de RAM. Encara penja a la paret.

El seu successor, Coriolis, quadruplica els píxels: una pantalla de 128×128 muntada amb quatre panells HUB75 de 64×64 i moguda per un Teensy 4.1. Aquesta vegada ho vaig fer a l'inrevés. Primer va anar el programari.

## El simulador com a entorn principal de desenvolupament

Coriolis es desenvolupa sobre un simulador d'escriptori fet amb raylib, i exactament el mateix motor C++11 de `core/` i `scenes/` es compila ara a WebAssembly per a l'emulador interactiu del [web de Coriolis](https://cyanidesayonara.github.io/coriolis/). No és cap maqueta apart: l'embolcall comú —que gestiona pantalla d'inici, canvi d'escena, llançador, ajustos, transicions, capes superposades, avisos, reproducció automàtica i atenuació nocturna— és idèntic línia per línia entre simulador, WebAssembly i firmware. Només canvien els adaptadors finals, que mapegen entrades i copien el fotograma acabat a una finestra, un llenç de navegador o els panells LED físics.

Les escenes no toquen mai maquinari. Dibuixen dins un buffer de fotograma abstracte a través d'un objecte context, de manera que el rellotge, l'aurora o la partida de snake que veig al monitor és el mateix codi que correrà a la paret.

## Dissenyar per a l'habitació, no per a la taula

Una pantalla de paret de 128×128 amb quatre panells HUB75E de 64×64 —uns 51×51 cm en pas P4 o 38×38 cm en P3— segueix regles ben diferents d'un monitor a mig metre dels ulls. El text menut desapareix, les barres d'estat carregades es tornen soroll i ningú vol treure el mòbil ni acostar-se a la paret només per canviar de mode.

Tot a Coriolis està pensat per llegir-se des de l'altra punta de la sala i manejar-se amb un comandament IR —sigui un Apple Remote o un comandament NEC estàndard de 17 tecles connectat al receptor al pin 16 del Teensy—. Tocar Menú obre el llançador categoritzat de 25 escenes (`CLOCKS & INFO`, `GUIDED FITNESS`, `GAMES`, `AMBIENT ART`) perquè no calgui recórrer dues dotzenes de modes en fila; mantenir premut Menú salta directe als ajustos de l'escena activa; mantenir Play/Pause torna a l'inici.

L'àudio resol el que 128×128 píxels no haurien d'intentar carregar sols. Un mòdul DFPlayer Mini connectat per sèrie afegeix campanades d'inici i final, avisos a mig camí al 50 % d'una postura de ioga, comptes enrere 3-2-1 i veus gravades en microSD amb cada postura i repetició —així, quan tens el cap a baix sobre l'estora, no has ni d'aixecar la vista a cada transició.

La suite d'exercici físic n'és el millor exemple. Vol substituir vídeos guiats, així que tot s'ha d'entendre des de terra: figures anti-aliased amb transicions cinemàtiques i columnes corbades, temporitzadors gegants, senyals de color i una etiqueta "NEXT" quatre segons abans de cada canvi. Les postures bilaterals corren pels dos costats automàticament i el comandament deixa pausar, saltar o ajustar repeticions sense aixecar-se.

## El que el simulador no arriba a explicar

Un simulador d'escriptori valida composició, ritmes i navegació compartida, però no enxampa rareses elèctriques o òptiques del maquinari HUB75 físic. Tres àrees segueixen a la llista de comprovacions fins que els panells s'encenguin al banc de proves:

- **Silici dels panells i ordre en cadena:** quatre panells HUB75E de 64×64 i escombrat 1/32 semblen idèntics al catàleg, però cada xip controlador respon diferent. Els registres de desplaçament senzills funcionen de sèrie; els panells FM6126A queden completament foscos si no s'activa `SM_HUB75_OPTIONS_FM6126A_RESET_AT_START`, i els ICN2038S o ICN2053 directament no van amb SmartMatrix. Fins i tot amb panells compatibles, el muntatge en C col·loca la fila inferior cap per avall per escurçar cables plans: per això el firmware inclou un patró sèrie de prova per quadrants (`t`), i la guia explica on intercanviar canals de color dins `blit()` si un lot arriba en ordre RBG o BGR.
- **Marge d'alimentació i aïllament USB:** quatre panells de 64×64 demanen 4–5 A cadascun en blanc ple (16–20 A en total), així que el muntatge especifica una font Mean Well LRS-200-5 de 40 A sense ventilador amb condensadors de 1000–2200 µF per cada parell de panells, acompanyada d'un limitador dinàmic de corrent per fotograma (`powerLimitedBrightness`) i un topall opcional en compilació (`CORIOLIS_MAX_BRIGHTNESS`) si es fa servir una font més petita. Tallar el pont `VUSB–VIN` sota el Teensy 4.1 és obligatori perquè l'USB i el carril de 5 V no barallin mai.
- **Refresc a brillantor mínima i difusió:** SmartMatrix treu color de 36/48 bits a prop de 120 Hz perquè els degradats vagin suaus de dia, però cadenes llargues de panells poden mostrar un lleu parpelleig als graons més baixos del mode nit. El marc físic combina suports magnètics amb una làmina de metacrilat fumat de 3 mm per a píxels contrastats i nítids; uns píxels ben quadrats demanarien a més una reixeta darrere el difusor.

## El següent: el muntatge

El firmware ja compila net per a Teensy 4.1 (Teensyduino 1.62 amb SmartMatrix 4 apedaçat) deixant uns 196 KB de RAM ràpida lliures, i el simulador permet continuar afinant escenes sense esperar peces. La llista sencera de materials, el mapa de pins del Teensy, el cablejat i la seqüència d'arrencada pas a pas són a la [guia de muntatge de maquinari](https://github.com/cyanidesayonara/coriolis/blob/master/docs/BUILD.md) del repositori (al costat de `Coriolis_Build_Guide.pdf`). El muntatge físic i les proves al banc van a continuació, i tan bon punt s'encengui el mural veurem com s'acosta la realitat al simulador.
