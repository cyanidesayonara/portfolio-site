---
title: Eat Prey Nap
tagline: Un juego gratuito de tableta para gatos, antes Trivial Purrsuit. El jugador es el gato.
summary: Un juego para tablet en Godot 4.7 diseñado según cómo ven y cazan de verdad los gatos, reconstruido desde un prototipo previo en Flutter.
kind: Game
stack: [Godot 4, GDScript, Android, Multitáctil, Arte procedural]
years: "2025 hasta hoy"
cover: /img/projects/eat-prey-nap-cover.png
coverAlt: Un ratón azul tinta asomándose desde un montículo hacia migas en un campo color paja en Eat Prey Nap
coverDark: false
links:
  - label: Código en GitHub
    href: https://github.com/cyanidesayonara/eat-prey-nap
  - label: Prototipo Flutter (flutter-legacy)
    href: https://github.com/cyanidesayonara/eat-prey-nap/tree/flutter-legacy
order: 11
color: saffron
---

Un juego gratuito de tableta para gatos, anteriormente **Trivial Purrsuit**. Empezó en 2025 como un prototipo en Flutter (conservado bajo la etiqueta `flutter-legacy`) y ahora se está reconstruyendo desde cero en **Godot 4.7** alrededor de una regla simple: **el jugador es el gato**. Si una decisión agrada a un humano pero no a un gato, gana el gato.

Actualmente está en el hito **M0**, un prototipo jugable de un solo ratón para probar en PC y tabletas Android, sin anuncios, cuentas, compras ni permiso de internet.

## Diseñado para cómo ven y cazan los gatos

En lugar de hacer rebotar sprites brillantes sobre fondo negro, el juego toma lo que funciona en la conducta real de caza: una superficie lisa y tranquila, unos pocos montículos fijos donde el gato puede acechar, migas que dan al ratón un motivo para salir y largos ratos de quietud seguidos de carreras repentinas.

- **Paletas dicromáticas y tamaño real en milímetros:** los gatos distinguen primero el contraste de brillo y luego el azul frente al amarillo, con poca sensibilidad cerca del turquesa. Incluye tres paletas de alto contraste (paja con azul tinta, azul tinta con amarillo pálido y gris medio con casi negro) y tres tamaños de ratón (28, 40 y 55 mm), calibrables con una regla de 50 mm en la pantalla inicial para que el tamaño físico sea exacto en cualquier tableta.
- **Acecho y movimiento en ráfagas:** el ratón sigue la máquina de estados `hidden -> tell -> peek -> sniff -> creep -> freeze -> dart -> hide` con tiempos irregulares log-normales. Un leve asomo de orejas o cola avisa antes de aparecer; una pata cerca provoca susto o congelación, y un zarpazo certero lo inmoviliza hasta que escapa o cae atrapado.
- **Dificultad adaptativa y descaro:** la probabilidad de captura tiende a una de cada tres buenas intentonas —garantizando la captura tras cinco fallos seguidos para que el gato no se frustre—, mientras que un ratón ignorado gana confianza poco a poco y sale más lejos.
- **Multitáctil y salida a prueba de patas:** cada dedo o pata actúa de forma independiente, las almohadillas apoyadas se ignoran y salir de la partida exige mantener pulsadas dos esquinas opuestas durante dos segundos para que el gato no cierre el juego a zarpazos.

<div class="gallery">

![Paleta nocturna azul tinta con ratón amarillo pálido](/img/projects/eat-prey-nap-night.png)
![Pantalla inicial con selector de paleta, tamaños y regla de calibración de 50 mm](/img/projects/eat-prey-nap-start.png)

</div>

## Próximos pasos

Tras probar M0 con gatos reales, el plan incorpora sesiones completas de **presa -> premio -> siesta** (terminando en una captura, un aviso para darle una golosina real y una pantalla atenuada, además del modo solo observación ya incluido en M0), así como presas de insecto y pez antes de llegar a Google Play.
