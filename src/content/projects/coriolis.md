---
title: Coriolis
tagline: An LED wall display, ten years in the making. A clock first, then ambient art, workouts and games.
summary: A 128×128 HUB75 LED panel driven by a Teensy 4.1, developed against a desktop simulator. The third generation of an LED wall that started as Borealis in 2016.
kind: Hardware
stack: [C++, Teensy 4.1, HUB75 LED matrix, CMake, Desktop simulator, Arduino]
years: 2016 to now
cover: /img/projects/coriolis-aurora.png
coverAlt: An aurora scene glowing green on the 128 by 128 LED matrix
coverDark: true
links:
  - label: Coriolis on GitHub
    href: https://github.com/cyanidesayonara/coriolis
  - label: Borealis on GitHub
    href: https://github.com/cyanidesayonara/borealis
featured: true
order: 3
color: led
---

Aurora, then Borealis, then Coriolis. This is the third generation of my LED wall: a 128×128 HUB75 panel driven by a Teensy 4.1. It's a wall clock first, with ambient art, a guided-fitness suite and games on top.

## Coriolis: 128×128

The whole thing was developed against a desktop simulator, so every scene can be built and tested on a PC before it goes near the hardware. All the images here were captured from that simulator.

<div class="gallery">

![Digital clock](/img/projects/coriolis-clock.png)
![Weather](/img/projects/coriolis-weather.png)
![Lava lamp](/img/projects/coriolis-lava.png)
![Fireplace](/img/projects/coriolis-fireplace.png)
![Mandala](/img/projects/coriolis-mandala.png)
![Snake](/img/projects/coriolis-snake.png)

</div>

- **Clocks**: digital, analog and a word clock, plus weather and a calendar.
- **Ambient art**: aurora, lava, fireplace, rain, starfield, mandala, an aquarium and the Game of Life.
- **Fitness**: guided exercise, tabata, breathing and focus timers.
- **Games**: snake, pong, a labyrinth and more.

The project comes with a user's manual and a build guide, both in the repository.

## Where it started: Borealis, 64×64

Borealis was a fork of the [Aurora project](https://github.com/pixelmatix/aurora) by Pixelmatix, a visualizer for LED matrix displays. I built it from two 64×32 HUB75 panels screwed onto a custom aluminum frame, making a single 64×64 display four times the size of the original, driven by a Teensy 3.2.

I first built it in the spring of 2016, before I knew how to code at all. All I really did was change some values and comment out unused features to save memory: at 64×64 it ran dangerously close to the Teensy's 64 KB of RAM. Years later I came back to it with real programming skills to clean up the code I'd left behind, and that eventually grew into Coriolis.

<div class="gallery">

![Borealis pattern](/img/projects/borealis-1.webp)
![Borealis pattern](/img/projects/borealis-2.webp)
![Borealis pattern](/img/projects/borealis-3.webp)

</div>
