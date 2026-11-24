---
title: Coriolis
tagline: Una pantalla LED de paret, deu anys fent-se. Primer rellotge; després art ambiental, entrenaments i jocs.
summary: Un mural LED de 128×128 pensat per a Teensy 4.1, desenvolupat primer en un simulador d'escriptori. La tercera generació d'un mural que va començar com a Borealis el 2016.
kind: Hardware
stack: [C++, WebAssembly, Teensy 4.1, Matriu LED HUB75, CMake, Simulador d'escriptori, Arduino]
years: "2016 fins avui"
cover: /img/projects/coriolis-aurora.png
coverAlt: Escena d'aurora brillant en verd a la matriu LED de 128 per 128
coverDark: true
links:
  - label: Web i emulador en directe
    href: https://cyanidesayonara.github.io/coriolis/
  - label: Coriolis a GitHub
    href: https://github.com/cyanidesayonara/coriolis
  - label: Borealis a GitHub
    href: https://github.com/cyanidesayonara/borealis
featured: true
order: 3
color: led
---

Aurora, després Borealis i ara Coriolis. Aquesta és la tercera generació del meu mural LED: una pantalla de 128×128 feta amb quatre panells HUB75 de 64×64 i un Teensy 4.1. És abans que res un rellotge de paret, amb art ambiental, una suite guiada d'exercici i jocs al damunt. El programari va al davant del maquinari: tot el motor en C++11 ja funciona avui en un simulador d'escriptori i aquí mateix al navegador amb WebAssembly mentre pren forma el muntatge físic.

## Coriolis: 128×128

El simulador d'escriptori és l'entorn principal de desenvolupament, i exactament el mateix motor C++11 de `core/` i `scenes/` compila net a WebAssembly tant per a l'emulador interactiu de dalt com per al [web independent de Coriolis](https://cyanidesayonara.github.io/coriolis/). El canvi d'escena, el llançador, els ajustos, les transicions suaus i les capes superposades són idèntics línia per línia entre escriptori, navegador i firmware, perquè les escenes dibuixen sobre un buffer abstracte sense tocar el maquinari.

<div class="gallery">

![Rellotge digital](/img/projects/coriolis-clock.png)
![Temps](/img/projects/coriolis-weather.png)
![Ioga](/img/projects/coriolis-yoga.png)
![Exercici](/img/projects/coriolis-exercise.png)
![Respirar](/img/projects/coriolis-breathe.png)
![Laberint](/img/projects/coriolis-labyrinth.png)
![Làmpada de lava](/img/projects/coriolis-lava.png)
![Llar de foc](/img/projects/coriolis-fireplace.png)
![Mandala](/img/projects/coriolis-mandala.png)
![Snake](/img/projects/coriolis-snake.png)

</div>

- **Rellotges i horari**: rellotges digital, analògic i de paraules, previsió i calendari, mode nit programat amb atenuació automàtica i un rellotge superposat mòbil i redimensionable damunt qualsevol escena.
- **Art ambiental**: aurora, lava, llar de foc, pluja, camp d'estrelles, mandala, un aquari, espirògrafs i el Joc de la Vida, amb transicions suaus per lliscament i esvaïment.
- **Exercici físic**: seqüències bilaterals de ioga i rutines guiades amb figures cinemàtiques suavitzades, tabata, respiració, temporitzadors de concentració i veu amb DFPlayer Mini.
- **Jocs i maquinari**: Tetris, snake, pong i un laberint amb raycasting, a més d'un receptor IR NEC i limitació dinàmica de brillantor per fotograma per al maquinari amb Teensy 4.1.

El [web de Coriolis](https://cyanidesayonara.github.io/coriolis/) i el repositori inclouen els manuals descarregables `Coriolis_User_Manual.pdf` i `Coriolis_Build_Guide.pdf`, al costat de les notes del diari de muntatge.

## On va començar: Borealis, 64×64

Borealis va ser un fork del [projecte Aurora](https://github.com/pixelmatix/aurora) de Pixelmatix, un visualitzador per a pantalles LED. El vaig construir amb dos panells HUB75 de 64×32 cargolats a un marc d'alumini fet a mida, aconseguint una pantalla de 64×64 quatre vegades més gran que l'original controlada per un Teensy 3.2.

El vaig muntar la primavera del 2016, abans de saber programar. Tot el que vaig fer llavors va ser canviar alguns números i comentar funcions que no feia servir per estalviar memòria: a 64×64 anava perillosament a prop dels 64 KB de RAM del Teensy. Anys més tard hi vaig tornar ja sabent programar per netejar aquell codi, i allò va acabar creixent fins a Coriolis.

<div class="gallery">
  <a class="anim-toggle" href="/img/projects/borealis-1.webp" data-anim="/img/projects/borealis-1.webp" data-poster="/img/projects/borealis-1-poster.jpg" data-label-play="Mostra l'animació" data-label-stop="Mostra la imatge"><img src="/img/projects/borealis-1-poster.jpg" alt="Patró de Borealis 1" loading="lazy" decoding="async" /><span class="anim-badge">Mostra l'animació</span></a>
  <a class="anim-toggle" href="/img/projects/borealis-2.webp" data-anim="/img/projects/borealis-2.webp" data-poster="/img/projects/borealis-2-poster.jpg" data-label-play="Mostra l'animació" data-label-stop="Mostra la imatge"><img src="/img/projects/borealis-2-poster.jpg" alt="Patró de Borealis 2" loading="lazy" decoding="async" /><span class="anim-badge">Mostra l'animació</span></a>
  <a class="anim-toggle" href="/img/projects/borealis-3.webp" data-anim="/img/projects/borealis-3.webp" data-poster="/img/projects/borealis-3-poster.jpg" data-label-play="Mostra l'animació" data-label-stop="Mostra la imatge"><img src="/img/projects/borealis-3-poster.jpg" alt="Patró de Borealis 3" loading="lazy" decoding="async" /><span class="anim-badge">Mostra l'animació</span></a>
</div>
