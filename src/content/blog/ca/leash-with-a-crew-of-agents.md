---
title: "Quatre mesos, 42 passeigs: fent Path of Leash Resistance amb un equip d'agents"
description: Com un sol desenvolupador va publicar un joc de Godot a web, itch.io i Microsoft Store escrivint encàrrecs en lloc de codi i revisant tot el que tornava.
date: 2026-11-15
tags: [godot, ai, agents, workflow]
project: path-of-leash-resistance
cover: /img/projects/leash-street.jpg
coverAlt: Un gos estira el seu humà distret amb el mòbil travessant un carril bici a Barcelona
---

El 10 de juliol del 2026 vaig fer el primer commit d'un prototip zenital amb tres coses a dins: una corretja, un humà enganxat al mòbil i unes bicis. Quatre mesos després, a la versió v1.75, Path of Leash Resistance tenia 42 passeigs, vuit persecucions, quatre estàtues cap i cinc gossos, i era publicat al web, itch.io i Microsoft Store. El repositori tenia més de 2.000 commits i més de 600 pull requests fusionades.

No vaig teclejar la major part d'aquest codi. Vaig escriure encàrrecs, vaig llançar agents en paral·lel i vaig revisar tot el que tornaven. Aquest article explica com funciona això a la pràctica i què vaig haver d'aprendre perquè rutllés.

## La fase de prototip: un agent, cicle curt

Al començament semblava l'experiència habitual programant amb IA. Un agent, una conversa, tasques curtes: fer que voltar un pal sigui una restricció real de corretja, fer que l'humà freni quan la corretja és tensa, afegir la terrassa d'un cafè. La física demanava ajust manual constant, així que es va mantenir un llaç tancat de demanar, jugar i polir.

La sorpresa grossa va ser veure com de ràpid s'inventa estat extra un agent quan una física no acaba d'encaixar. Vam passar per tres generacions diferents de capes comptadores de pivots i angles per seguir les voltes al voltant dels fanals. Cadascuna feia bona pinta sobre el paper i al cap d'un segon es dessincronitzava de la corda dibuixada. Això només es va acabar quan vam posar una regla estricta a `entities/leash.gd`: la corda Verlet visible *és* la restricció —col·lisions segment-cercle, fricció per adherència i el camí `visible_path()` dibuixat llegeixen exactament els mateixos punts del solver, sense cap estat fantasma al darrere.

Les sensacions de joc també es resistien a delegar-se. Saber sobre el paper que l'humà pesa quatre vegades més que el gos, que la tensió cedeix entre una ràtio d'estirament d'1,00–1,05, que plantar-se multiplica la resistència per 14× o que cada estrebada avisa amb un globus 0,8 segons abans no et diu si una estrebada se sent justa o pastosa. Un agent pot connectar aquestes constants i fer-ne proves; trobar quins números fan clic segueix obligant a agafar el comandament i jugar.

## Escriure-ho primer: AGENTS.md i PROJECT.md

El punt d'inflexió va ser tractar la documentació del projecte com la interfície real. `PROJECT.md` guarda els pilars de disseny i el full de ruta. `AGENTS.md` conté tot el que qualsevol agent necessita abans de tocar codi: l'stack, les convencions, la veu del joc i les regles que no es negocien. Tot l'art són vectors dibuixats en codi. Tota la música és sintetitzada. Els textos de cara al jugador diuen "el teu humà", mai "el propietari".

Cada cop que un agent s'equivocava en alguna cosa, l'esmena entrava en aquests fitxers tant com al codi perquè el següent no hi caigués.

## En paral·lel: encàrrecs, lots i worktrees

Un cop escrites les normes, vaig poder repartir feina en lots. Un lot és un document de prompts: un preàmbul comú amb les normes de la casa, una guia compartida per a aquell tipus de tasca (per exemple, com fer un passeig nou) i després un prompt per tasca. Cada agent rep el seu propi git worktree i branca, així diversos passeigs es fan de costat. Acostumo a llançar com a molt dos passeigs alhora perquè cadascun encara toca un grapat de llistes compartides.

Els encàrrecs arrosseguen lliçons anteriors. L'últim lot comença llistant errors dels lots previs: un test que assumia que el seu passeig era l'últim de la llista, o pals als quals els sortien fanals al capdamunt. Aquestes errades no tornen.

Treballar en paral·lel té un sol enemic real: tothom editant la mateixa llista. La sortida va ser estructural. Cada passeig viu dins el seu propi mòdul i declara els seus hooks, cada test nou va al seu propi fitxer i el changelog s'assembla reunint un fragment per pull request.

## La porta de revisió

Res d'això no aguanta sense un filtre que no se salti ningú. Cada pull request porta una fitxa de sensacions i un fragment de changelog, i qualsevol passeig nou ha d'ensenyar:

- els seus propis tests i tota la suite en verd, més una execució headless de fum;
- una partida guiada de punta a punta que registra si algú s'encalla dins d'una paret;
- captures de tot el recorregut, amb cel clar i amb el seu propi clima;
- una "fitxa de sensacions": de tres a cinc coses per provar a mà, que jugo jo mateix;
- un fragment de changelog comprovat per script.

Amb diverses branques arribant cada dia, la trampa de veritat no és la sintaxi trencada: és fusionar canvis visibles més de pressa del que els pots jugar. Per evitar que la qualitat derivi, el repositori aplica un límit estricte de WIP de **vuit** canvis visibles fusionats a la columna "Pendent d'acceptació". Fusionar una PR no vol dir acceptar-la; un cop la cua arriba a vuit només hi poden entrar correccions d'errors, proves, eines o refactoritzacions fins que jugo les fitxes pendents i les dono per bones.

Comprovacions automàtiques cacen desviacions estructurals abans ni d'obrir cap build. Qualsevol refactor de `main.gd` ha de deixar idèntic byte per byte `tools/behaviour_snapshot.sh`. `tools/bench_leash.gd` i `tools/bench_leash_draw.gd` vigilen pressupostos de microsegons del solver i hashes geomètrics. `tools/surface_check.py` superposa el mapa físic de superfícies damunt captures per enxampar llocs on la vorera s'ha pintat com herba o la sorra es llegeix com aigua, i `tools/shot_diff.py` compara escombrats deterministes píxel per píxel. Això m'allibera el temps de revisió per llegir transicions d'estat delicades línia per línia i jugar de debò les fitxes de sensacions.

## Què diria a qui comença ara

- **El coll d'ampolla passa de picar codi a decidir i revisar.** Generar codi és molt ràpid; saber si un canvi millora el joc i posar un límit ferm de feina pendent de provar és el que protegeix el producte.
- **Escriu la regla en el moment que et repeteixis.** Tota correcció que es queda només en un xat es perd a la finestra de context següent. Posa-la a `AGENTS.md` o al preàmbul comú un cop i aguantarà en cada branca futura.
- **Estructura el codi perquè el treball en paral·lel no topi.** Registres centrals, manifestos compartits de proves i changelogs a dalt de fitxer converteixen branques paral·leles en conflictes. `HOOKS` per mòdul, fitxers de prova sota `tests/ci.d/` i fragments a `changelog.d/` deixen que tasques independents aterrin netes.
- **Mantingues el tacte final en mans humanes.** Deixa que els agents implementin el solver de física, els benchmarks deterministes i les bateries de captures, mentre guardes les constants d'ajust i les fitxes de joc a la teva banda del cercle.
