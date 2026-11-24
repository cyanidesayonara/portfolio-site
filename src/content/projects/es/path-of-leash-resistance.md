---
title: Path of Leash Resistance
tagline: Una comedia de físicas sobre un paseo con perro. Tú eres el perro; tu humano va pegado al móvil.
summary: Una comedia cenital de físicas con correa ambientada en Barcelona y alrededores, hecha con Godot 4 y publicada en web, Windows y Microsoft Store.
kind: Game
stack: [Godot 4, GDScript, Física Verlet de cuerda, Audio sintetizado, GitHub Actions]
years: "2026"
cover: /img/projects/leash-street.jpg
coverAlt: Un perro tira de su humano distraído con el móvil sobre el pavimento ondulado de La Rambla junto a un carril bici con una correa roja
links:
  - label: Jugar en el navegador
    href: https://cyanidesayonara.github.io/path-of-leash-resistance/
  - label: itch.io
    href: https://cyanidesayonara.itch.io/path-of-leash-resistance
  - label: Microsoft Store
    href: https://apps.microsoft.com/detail/9p5d14v8rbqx
  - label: Código en GitHub
    href: https://github.com/cyanidesayonara/path-of-leash-resistance
featured: true
order: 1
color: saffron
---

Tu humano va pegado al móvil y camina en piloto automático. Tú estás al otro lado de la correa. Llévalo a casa con el teléfono de una pieza y cuela por el camino tantos asuntos perrunos como te salgan gratis.

## Cómo se juega

![Clip de juego de Path of Leash Resistance mostrando giros alrededor de un poste y tirones de correa](/img/projects/leash-hero.webp)

Tu humano pesa cuatro veces más que tú y gana cualquier tirón recto. Así que ganas como gana un perro: plántate en el momento justo, enreda la correa alrededor de una farola para dejarlo anclado y ladra para frenarlo en seco en el bordillo. Enróllalo alrededor de un poste y sigue tirando para que salga girando como un tethered ball.

La correa es una cuerda real. La que ves en pantalla es la misma que hace la física: se enrolla en los postes, se tensa al límite, resbala con un tirón seco y se enreda con las correas de otros paseantes.

![Un paseo por el Eixample](/img/projects/leash-eixample.jpg)

## Qué incluye

- **Paseos por Barcelona y alrededores**, desde La Rambla y El Gòtic hasta Montjuïc, Sitges, Girona y Montserrat, además de un tutorial que enseña cada truco poco a poco. Cada ruta se puede jugar con cualquier clima, de día o de noche.
- **Persecuciones y estatuas jefe**, desde una barredora al amanecer hasta El Drac, la salamandra de mosaico.
- **Varios perros para elegir**, cada uno con su propia habilidad y objetivo técnico, además de objetos enterrados, adiestramiento, collares, pañuelos y abrigos.
- **Retos y combos**: da la vuelta a un poste, desliza por un bordillo, lanza a tu humano o acepta un reto con sintonía propia.
- **Inglés, catalán y español**, con sacudida de pantalla, destellos, tamaño de texto y controles ajustables.
- Sin anuncios, sin compras y sin cuenta. Funciona sin conexión.

El juego sigue creciendo, así que la lista completa de paseos, perros, persecuciones y jefes, junto con las novedades, está en [la web del juego](https://cyanidesayonara.github.io/path-of-leash-resistance/es/).

![Escapando de la persecución de la barredora](/img/projects/leash-sweeper.webp)

![Montserrat](/img/projects/leash-montserrat.jpg)

## Por dentro

- **Godot 4, solo GDScript**, sobre el renderizador GL Compatibility para que la exportación web funcione en todas partes.
- **Todo está dibujado por código.** No hay archivos de sprites: cada perro, farola y baldosa de trencadís es un vector dibujado en `_draw()`, agrupado en lotes para que la versión web vaya fluida.
- **Toda la música y los efectos están sintetizados en código** y prerrenderizados para las versiones publicadas.
- **Las entregas están automatizadas**: una etiqueta de versión compila y sube las versiones web y Windows a itch.io y empaqueta la entrega para Microsoft Store.
- **Construido con un equipo de agentes de programación con IA.** Cada paseo se redacta como un encargo, lo construye un agente en su propio worktree y rama, pasa las pruebas automáticas y CI, y cada cambio visible para el jugador se juega y acepta antes de fusionarse. Más detalles en [Cómo construyo](/es/how-i-build).
