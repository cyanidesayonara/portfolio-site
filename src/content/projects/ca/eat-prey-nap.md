---
title: Eat Prey Nap
tagline: Un joc gratuït de tauleta per a gats, abans Trivial Purrsuit. El jugador és el gat.
summary: Un joc per a tauleta en Godot 4.7 dissenyat segons com veuen i cacen de debò els gats, refet a partir d'un prototip anterior en Flutter.
kind: Game
stack: [Godot 4, GDScript, Android, Multitàctil, Art procedural]
years: "2025 fins avui"
cover: /img/projects/eat-prey-nap-cover.png
coverAlt: Un ratolí blau tinta traient el cap d'un cau cap a unes molles en un camp color palla a Eat Prey Nap
coverDark: false
links:
  - label: Codi a GitHub
    href: https://github.com/cyanidesayonara/eat-prey-nap
  - label: Prototip Flutter (flutter-legacy)
    href: https://github.com/cyanidesayonara/eat-prey-nap/tree/flutter-legacy
order: 11
color: saffron
---

Un joc gratuït de tauleta per a gats, abans **Trivial Purrsuit**. Va començar el 2025 com un prototip en Flutter (conservat amb l'etiqueta `flutter-legacy`) i ara s'està refent des de zero amb **Godot 4.7** al voltant d'una regla clara: **el jugador és el gat**. Si una decisió agrada als humans però no als gats, guanya el gat.

Ara mateix és a la fita **M0**, un prototip jugable d'un sol ratolí per provar en PC i tauletes Android, sense anuncis, comptes, compres ni permís d'internet.

## Dissenyat per a com veuen i cacen els gats

En lloc de fer rebotar sprites llampants damunt un fons negre, el joc recull allò que funciona en la caça real: una superfície tranquil·la i llisa, uns quants caus fixos on el gat pugui aguaitar, molles que donin al ratolí un motiu per sortir i llargues pauses seguides de ràfegues sobtades de moviment.

- **Paletes dicromàtiques i mida real en mil·límetres:** els gats distingeixen primer el contrast de brillantor i després el blau respecte al groc, amb poca sensibilitat prop del turquesa. Porta tres paletes d'alt contrast (palla amb blau tinta, blau tinta amb groc pàl·lid i gris mitjà amb gairebé negre) i tres mides de ratolí (28, 40 i 55 mm), calibrables amb un regle de 50 mm a la pantalla inicial perquè les dimensions físiques siguin exactes a cada tauleta.
- **Aguait i moviment a ràfegues:** el ratolí segueix la màquina d'estats `hidden -> tell -> peek -> sniff -> creep -> freeze -> dart -> hide` amb temps irregulars log-normals. Un senyal discret d'orelles o cua precedeix cada sortida; una pota a prop el fa espantar o quedar-se glaçat, i una urpada directa el pot immobilitzar fins que s'escapa o queda atrapat.
- **Dificultat adaptativa i atreviment:** la probabilitat de captura tendeix a una de cada tres bones temptatives —garantint la captura després de cinc intents fallits seguits perquè el gat no es frustri—, mentre que un ratolí ignorat es torna més agosarat i s'allunya més.
- **Multitàctil i sortida a prova de potes:** cada dit o pota actua de manera independent, els coixinets recolzats s'ignoren i sortir d'una partida demana mantenir premudes dues cantonades oposades durant dos segons perquè el gat no tanqui el joc a urpades.

<div class="gallery">

![Paleta nocturna blau tinta amb ratolí groc pàl·lid](/img/projects/eat-prey-nap-night.png)
![Pantalla inicial amb selector de paleta, mides i regle de calibratge de 50 mm](/img/projects/eat-prey-nap-start.png)

</div>

## Properes passes

Després de provar M0 amb gats reals, el pla hi afegeix sessions completes de **presa -> menjar -> migdiada** (acabant en una captura, un avís per donar-li una llaminadura real i la pantalla atenuada, a banda del mode només observació ja inclòs a M0), i preses d'insecte i peix abans de sortir a Google Play.
