---
title: stemma
tagline: Silencia el teu instrument. Toca-hi a sobre. Separació de pistes amb IA que corre al teu propi PC.
summary: Un reproductor de música per a Windows que separa qualsevol cançó en pistes per treure el teu instrument i repetir en bucle els compassos que practiques.
kind: Desktop app
stack: [Python, PySide6, ONNX Runtime, HTDemucs, DirectML, librosa]
years: "2026"
cover: /img/projects/stemma-practice.webp
coverAlt: Vista de pràctica de stemma amb formes d'ona apilades per pista i mesclador a sota
coverDark: true
coverPosition: "88% 50%"
links:
  - label: Web i demo en directe
    href: https://cyanidesayonara.github.io/stemma/
  - label: Microsoft Store
    href: https://apps.microsoft.com/detail/9p2w12l8f381
  - label: Codi a GitHub
    href: https://github.com/cyanidesayonara/stemma
featured: true
order: 2
color: turquoise
---

Importa una cançó, separa-la en pistes (veu, bateria, baix, guitarra, piano, altres), silencia o posa en solo qualsevol d'elles i toca-hi a sobre amb el teu instrument. Sense comptes ni subscripcions: tot corre al teu propi ordinador.

## La cabina de pràctica

- Una forma d'ona apilada alta amb un carril de color per pista que comparteix capçal i regió de bucle A-B. La mateixa forma d'ona fa de control lliscant accessible per teclat, i l'estat de la sessió (cançó, posició, mesclador, bucle, velocitat, metrònom i preses) es restaura en obrir.
- **Carril d'acords i seccions de cançó**: tots els acords de la peça al llarg de la línia temporal amb lectura anticipada en directe, més un regle experimental de seccions sobre les línies de compàs on pots clicar per saltar o fer doble clic (`Shift+L`) per posar el bucle exacte al compàs.
- **Entrenador de bucle**: amb un bucle actiu, la velocitat puja un graó a cada repetició fins que toques al tempo complet.
- Velocitat en directe preservant l'afinació, transposició de ±7 semitons, detecció automàtica de tempo, tonalitat i pols, metrònom sincronitzat amb compte previ i temes clar i fosc.

![Enregistrant preses damunt les pistes](/img/projects/stemma-takes.webp)

## Biblioteca, setlists i cua

- Etiquetes i un estat de pràctica per cançó (aprenent, practicant o a punt), i cada cançó desa el seu propi bucle, velocitat i to.
- Setlists ordenades per a una classe o un concert, i una cua de reproducció a part de la biblioteca.
- Selecciona diverses cançons per posar-les a la cua, etiquetar-les, afegir-les a una setlist, exportar-les o treure-les alhora, o importa diversos fitxers de cop.

## Separació

- **HTDemucs v4** de quatre i sis pistes (CPU) i **MDX-Net** de dues pistes per GPU amb DirectML amb retorn automàtic a CPU, més filtratge de Wiener i porta suau per reduir restes entre pistes.
- Inferència amb ONNX Runtime, sense PyTorch. Els models es baixen en el primer ús i es verifiquen per suma de control.
- Les importacions corren en segon pla, des d'un fitxer local, arrossegant-hi o des d'un enllaç de YouTube (amb un runtime integrat de QuickJS-ng per a `yt-dlp`).

## Tocar-hi a sobre

Enregistra preses damunt les pistes amb la teva interfície d'àudio. Surten com a files pròpies al mesclador que pots ajustar al temps, i pots exportar la mescla tal com sona, una pista sola o només el tros del bucle en WAV o MP3.
