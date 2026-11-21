---
title: "Software before hardware: building an LED wall in a simulator first"
description: Coriolis has 25 scenes, a launcher, settings and a fitness suite, and the hardware isn't built yet. Here's why I started with a desktop simulator.
date: 2026-11-21
tags: [hardware, c++, teensy, led, simulation]
cover: /img/projects/coriolis-aurora.png
coverAlt: An aurora scene on the Coriolis LED matrix simulator
draft: true
---

<!-- DRAFT: written from the Coriolis PROJECT.md and README. Check the facts, add your own voice, then set draft to false. -->

In 2016 I built Borealis, a 64×64 LED wall, before I knew how to program. I changed some numbers in someone else's code and commented out features until it fit into 64 KB of RAM. It still hangs on my wall.

Its successor, Coriolis, is four times the pixels: a 128×128 display made from four 64×64 HUB75 panels, driven by a Teensy 4.1. This time I did it the other way round. The software came first.

## The simulator is the product

Coriolis is developed against a desktop simulator built on raylib. That's not a mock-up: the shell, which handles the splash screen, scene switching, launcher, settings, transitions, overlays, toasts, autoplay and night dimming, is shared line for line between the simulator and the firmware. The only things that differ are the backends, which map inputs and copy the finished frame to a window or to the panels.

Scenes never touch hardware. They draw into an abstract frame buffer through a context object, so the clock, the aurora or the game of snake I see on my monitor is the same code that will run on the wall.

## Designing for the room, not the screen

<!-- TODO: what changed when you designed for a wall instead of a monitor? Glanceability from across the room, the fitness suite readable from a yoga mat, IR remote controls. -->

The fitness suite is the best example. It's meant to replace workout videos, so everything has to read from the floor: high-contrast posture figures, huge timers, color cues, and a "NEXT" badge four seconds before each transition. Bilateral poses run on both sides automatically, and the remote can pause, skip or adjust reps without getting up.

## What the simulator can't tell you

<!-- TODO: the risks you expect at bring-up. Refresh rate and color depth at 128×128, power, brightness at night, how the panels actually look compared to the sim. Write this part after the hardware build, or turn it into a second post. -->

## Next: the build

<!-- TODO: link the build guide and say when the hardware build happens. -->
