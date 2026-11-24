---
title: Path of Leash Resistance
tagline: Una comèdia de físiques sobre un passeig amb gos. Tu ets el gos; el teu humà va enganxat al mòbil.
summary: Una comèdia zenital de físiques amb corretja ambientada a Barcelona i rodalies, feta amb Godot 4 i publicada al web, Windows i Microsoft Store.
kind: Game
stack: [Godot 4, GDScript, Física Verlet de corda, Àudio sintetitzat, GitHub Actions]
years: "2026"
cover: /img/projects/leash-street.jpg
coverAlt: Un gos estira el seu humà distret amb el mòbil pel paviment ondulat de La Rambla al costat d'un carril bici amb una corretja vermella
links:
  - label: Juga al navegador
    href: https://cyanidesayonara.github.io/path-of-leash-resistance/
  - label: itch.io
    href: https://cyanidesayonara.itch.io/path-of-leash-resistance
  - label: Microsoft Store
    href: https://apps.microsoft.com/detail/9p5d14v8rbqx
  - label: Codi a GitHub
    href: https://github.com/cyanidesayonara/path-of-leash-resistance
featured: true
order: 1
color: saffron
---

El teu humà va enganxat al mòbil i camina amb el pilot automàtic. Tu ets a l'altra punta de la corretja. Porta'l a casa amb el telèfon d'una peça i esgarrapa pel camí tants assumptes canins com puguis colar-li.

## Com s'hi juga

![Clip de joc de Path of Leash Resistance mostrant girs al voltant d'un pal i estrebades de corretja](/img/projects/leash-hero.webp)

El teu humà pesa quatre vegades més que tu i guanya qualsevol estrebada en línia recta. Així que guanyes com guanya un gos: planta't en el moment just, enrosca la corretja al voltant d'un fanal per ancorar-lo i borda per clavar-lo en sec a la vorera. Fes-li donar la volta a un pal i continua estirant perquè surti volant com en una baldufa.

La corretja és una corda real. La que veus en pantalla és la mateixa que calcula la física: s'enrotlla als pals, es tensa al límit, rellisca amb una sacsejada seca i s'embulla amb les corretges d'altres passejants.

![Un passeig per l'Eixample](/img/projects/leash-eixample.jpg)

## Què inclou

- **Cinquanta-un passeigs per Barcelona i rodalies**, des de La Rambla i El Gòtic fins a Montjuïc, Sitges, Girona, Tarragona, Vic i Montserrat, a més d'un passeig tutorial que ensenya cada truc d'un en un. Cada ruta es pot jugar amb qualsevol temps, de dia o de nit.
- **Deu persecucions**: una escombradora a trenc d'alba, senglars, els diables de foc del correfoc per Gràcia, la carrossa pirotècnica del Dimoni, seguretat de l'aeroport, la mascota de Les Atraccions, una màquina trepitjaneus desbocada baixant La Molina i cabres salvatges per Montserrat, entre altres.
- **Cinc estàtues cap**: El Mamut, El Drac la salamandra de mosaic, Els Lleons, La Lleona a Girona i El Gat.
- **Set gossos**, cadascun amb una traça i un objectiu d'habilitat propis, a més de troballes enterrades, ensinistrament, collars, mocadors i abrics.
- **Reptes i combos**: fes girar l'humà al voltant d'un pal, llisca per un ressalt, llança'l pels aires o accepta un repte amb música pròpia.
- **Nou cels i sis hores del dia**, en anglès, català i espanyol, amb intensitat de tremolor de pantalla, centelleigs, mida de text i controls ajustables.
- Sense anuncis, sense compres i sense compte. Juga fora de línia.

![Fugint de la persecució de l'escombradora](/img/projects/leash-sweeper.webp)

![Montserrat](/img/projects/leash-montserrat.jpg)

## Per dins

- **Godot 4, només GDScript**, sobre el renderitzador GL Compatibility perquè l'exportació web funcioni arreu.
- **Tot està dibuixat per codi.** No hi ha fitxers d'sprites: cada gos, fanal i panot de trencadís és un vector dibuixat dins `_draw()`, agrupat per lots perquè la versió web vagi fluida.
- **Tota la música i els efectes són sintetitzats en codi** i prerenderitzats per a les versions publicades.
- **Els llançaments són automatitzats**: una etiqueta de versió compila i puja les versions web i Windows a itch.io i empaqueta la versió de Microsoft Store.
- **Construït amb un equip d'agents de programació amb IA.** Cada passeig s'escriu com un encàrrec, el construeix un agent al seu propi worktree i branca, passa les proves automàtiques i CI, i cada canvi visible per al jugador es juga i s'accepta abans de fusionar-se. Més detalls a [Com construeixo](/ca/how-i-build).
