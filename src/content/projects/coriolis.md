---
title: Coriolis
tagline: An LED wall display, ten years in the making. A clock first, then ambient art, workouts and games.
summary: A 128×128 LED wall display designed for a Teensy 4.1, developed first against a desktop simulator. The third generation of an LED wall that started as Borealis in 2016.
kind: Hardware
stack: [C++, WebAssembly, Teensy 4.1, HUB75 LED matrix, CMake, Desktop simulator, Arduino]
years: 2016 to now
cover: /img/projects/coriolis-aurora.png
coverAlt: An aurora scene glowing green on the 128 by 128 LED matrix
coverDark: true
links:
  - label: Website and live emulator
    href: https://cyanidesayonara.github.io/coriolis/
  - label: Coriolis on GitHub
    href: https://github.com/cyanidesayonara/coriolis
  - label: Borealis on GitHub
    href: https://github.com/cyanidesayonara/borealis
featured: true
order: 3
color: led
---

Aurora, then Borealis, then Coriolis. This is the third generation of my LED wall: a 128×128 display built from four 64×64 HUB75 panels and a Teensy 4.1. It's a wall clock first, with ambient art, a guided-fitness suite and games on top. The software is ahead of the hardware: the full C++11 engine runs today in a desktop simulator and right in your browser via WebAssembly while the physical build comes together.

## Coriolis: 128×128

The desktop simulator is the main development environment, and the exact same C++11 `core/` and `scenes/` engine compiles cleanly to WebAssembly for the browser emulator above and on [Coriolis's standalone showcase site](https://cyanidesayonara.github.io/coriolis/). The scene switching, launcher, settings, smooth transitions and overlays are shared line for line across desktop, browser and firmware, because scenes draw into an abstract frame buffer instead of touching hardware.

<div class="gallery">

![Digital clock](/img/projects/coriolis-clock.png)
![Weather](/img/projects/coriolis-weather.png)
![Yoga](/img/projects/coriolis-yoga.png)
![Exercise](/img/projects/coriolis-exercise.png)
![Breathe](/img/projects/coriolis-breathe.png)
![Labyrinth](/img/projects/coriolis-labyrinth.png)
![Lava lamp](/img/projects/coriolis-lava.png)
![Fireplace](/img/projects/coriolis-fireplace.png)
![Mandala](/img/projects/coriolis-mandala.png)
![Snake](/img/projects/coriolis-snake.png)

</div>

- **Clocks & schedule**: digital, analog and word clocks, weather and calendar, scheduled Night Mode with auto-dimming, and a movable, resizable clock overlay on top of any scene.
- **Ambient art**: aurora, lava, fireplace, rain, starfield, mandala, an aquarium, spirographs and the Game of Life, with smooth slide and crossfade scene transitions.
- **Fitness**: bilateral yoga flows and guided exercise routines with smoothed kinematic figures, tabata, breathing, focus timers and a DFPlayer Mini voice pack for spoken cues.
- **Games & hardware**: Tetris, snake, pong and a raycast labyrinth, plus an NEC IR remote driver and dynamic frame brightness limiting for the Teensy 4.1 hardware.

The [Coriolis site](https://cyanidesayonara.github.io/coriolis/) and repository include the downloadable `Coriolis_User_Manual.pdf` and `Coriolis_Build_Guide.pdf`, alongside the hardware build-log notes.

## Where it started: Borealis, 64×64

Borealis was a fork of the [Aurora project](https://github.com/pixelmatix/aurora) by Pixelmatix, a visualizer for LED matrix displays. I built it from two 64×32 HUB75 panels screwed onto a custom aluminum frame, making a single 64×64 display four times the size of the original, driven by a Teensy 3.2.

I first built it in the spring of 2016, before I knew how to code at all. All I really did was change some values and comment out unused features to save memory: at 64×64 it ran dangerously close to the Teensy's 64 KB of RAM. Years later I came back to it with real programming skills to clean up the code I'd left behind, and that eventually grew into Coriolis.

<div class="gallery">

![Borealis pattern](/img/projects/borealis-1.webp)
![Borealis pattern](/img/projects/borealis-2.webp)
![Borealis pattern](/img/projects/borealis-3.webp)

</div>
