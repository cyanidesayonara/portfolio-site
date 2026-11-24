---
title: "La corda és la restricció: substituint llistes de pivots per una corretja Verlet"
description: "Per què l'estat separat de voltes i pivots es trencava en girs múltiples i desenganxaments a Path of Leash Resistance, i com una corda Verlet de 24 punts va resoldre pals, embolics i lliscaments amb un sol solver."
date: 2026-10-20
tags: [godot, physics, verlet, testing]
project: path-of-leash-resistance
cover: /img/projects/leash-street.jpg
coverAlt: Un gos estira el seu humà amb una corretja vermella llarga pel paviment ondulat de La Rambla
---

En un joc anomenat *Path of Leash Resistance*, la corretja no pot ser decorativa. Si la cinta dibuixada volta un fanal mentre la física estira en línia recta entre el gos i l'humà, cada volta se sent falsa.

Les primeres versions van provar la drecera habitual en vista zenital: mantenir una llista de punts de pivot cada cop que el segment gos-humà creuava un obstacle i escurçar la llargada restant en conseqüència. A la pràctica, aquest estat dividit fallava una vegada rere l'altra.

## On fallava el registre de pivots

Tres errors tornaven sense parar als primers commits:

1. **Deriva entre allò visual i allò físic.** La corba renderitzada aplicava el seu propi suavitzat mentre la pila de pivots seguia les interseccions per una altra banda. En girs ràpids, la cinta semblava enrotllada mentre la tensió continuava apuntant recta a través d'un pal.
2. **Desenganxaments en múltiples voltes.** Donar dues voltes al voltant d'un pal i desfer el camí en ordre invers sovint treia el pivot equivocat o deixava una cantonada fantasma clavada quan el gos ja n'havia sortit lliure.
3. **Les corretges d'altres passejants.** Afegir parelles de NPC amb gos implicava dues cordes mòbils creuant-se en espai obert. Les llistes de pivots assumeixen centres circulars estàtics; no tenen cap resposta neta quan el "pal" és una altra corretja en moviment.

## Convertir la corda visible en la restricció

La solució a `entities/leash.gd` va ser eliminar del tot l'estat separat de voltes. La corretja és una única cadena Verlet de 24 punts (`N = 24`, `ITER = 11` passades de restricció per tick), i els punts dibuixats a la pantalla són exactament els mateixos que generen les forces:

- **Col·lisió segment contra cercle.** Cada iteració empeny tant segments (`_collide_circles`) com punts fora dels obstacles propers (`POLE_PAD = 13 px` o radis propis per obstacle). Com que els mateixos segments col·lisionen, els trams estirats no poden travessar fanals prims fent túnel.
- **Adherència i lliscament al voltant d'obstacles.** Els punts en contacte resisteixen el lliscament amb poc estirament (`STATIC_SLIP_MIN = 0.15` per a pals), de manera que les voltes intencionades s'ajusten amb fermesa. Passada la llargada en repòs, el lliscament en pals puja gradualment, mentre que el mobiliari i els enganxaments amb cordes dinàmiques pugen fins a `1.0` a `STRETCH_CAP = 1.15`, permetent deixar anar enganxaments amb netedat en lloc de deixar l'humà enganxat a les taules de terrassa.
- **Estrebada tangent i entrada suau en tensió.** `tension_force()` suavitza la força de la molla durant el primer 5% d'estirament (`TAUT_ONSET_END = 1.05`) mitjançant `taut_amount()`, llegint les tangents dels extrems al llarg de `TANGENT_RUN = 3` segments (o el segment de contacte immediat quan està enrotllada). En voltar un pal, el vector d'estrebada de l'humà gira de manera natural descrivint un arc al seu voltant.
- **Embolics amb NPC de franc.** Els obstacles dinàmics simplement alimenten punts de corretges veïnes dins el mateix array de col·lisió circular amb lliscament `K_DYNAMIC`, així que dues corretges es creuen i recolzen sense cap màquina d'estats especial.

## Fixar la física amb proves headless

Com que les regressions de la corda solien amagar-se rere retocs de sensacions, els invariants viuen ara en scripts de prova headless a Godot (`tests/test_wrap.gd` i `tests/test_leash_taut_transition.gd`):

- Les estrebades en línia recta segueixen la distància de la corda tibant i orienten les tangents dels extrems de tornada cap a ella.
- Entrar en espiral volta un pal amb netedat, ajusta els contactes un cop tibant i corba el vector d'estrebada de l'humà apartant-lo de la línia directa.
- Estirar amb força cap al mateix costat fa lliscar la volta cap enfora en comptes d'enganxar l'humà al pal.
- Els enganxaments dinàmics registren `winding()` sense acumular `static_winding()`, de manera que els embolics amb vianants mai no disparen el multiplicador de politja dels pals.

Res no garanteix que la física d'un joc no et sorprengui mai, però fer que la corda renderitzada i la restricció física comparteixin exactament el mateix array va eliminar de cop tota una classe d'errors de dessincronització.
