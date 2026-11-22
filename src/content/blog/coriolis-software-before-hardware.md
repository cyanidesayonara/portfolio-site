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

Its successor, Coriolis, is four times the pixels: a 128×128 display made from four 64×64 HUB75 panels, driven by a Teensy 4.1. This time I did it the other way around. The software came first.

## The simulator is the main development environment

Coriolis is developed against a desktop simulator built on raylib. That's not a mock-up: the shell, which handles the splash screen, scene switching, launcher, settings, transitions, overlays, toasts, autoplay and night dimming, is shared line for line between the simulator and the firmware. The only things that differ are the backends, which map inputs and copy the finished frame to a window or to the panels.

Scenes never touch hardware. They draw into an abstract frame buffer through a context object, so the clock, the aurora or the game of snake I see on my monitor is the same code that will run on the wall.

## Designing for the room, not the screen

A 128×128 wall display built from four 64×64 HUB75E panels—about 51×51 cm at P4 pitch or 38×38 cm at P3—follows completely different rules than a desktop monitor two feet from your eyes. Small text disappears, intricate status bars turn into noise, and nobody wants to pull out a phone or walk up to the wall just to switch scenes.

Everything in Coriolis is designed to read from across the room and to operate from an IR remote—either an Apple Remote or a standard 17-key NEC remote talking to a receiver on Teensy pin 16. Tapping Menu opens the categorized 25-scene launcher (`CLOCKS & INFO`, `GUIDED FITNESS`, `GAMES`, `AMBIENT ART`) so you never have to step linearly through two dozen modes; holding Menu jumps directly into the active scene's settings section; holding Play/Pause returns home.

Audio solves what 128×128 pixels shouldn't try to carry alone. A DFPlayer Mini driven over serial adds start and finish chimes, halfway bells at 50% of a yoga pose hold, 3-2-1 countdown ticks, and spoken pose and rep cues from an offline voice pack on microSD—so when your head is down on a mat, you don't even have to look up for every transition.

The fitness suite is the best example. It's meant to replace workout videos, so everything has to read from the floor: high-contrast posture figures, huge timers, color cues, and a "NEXT" badge four seconds before each transition. Bilateral poses run on both sides automatically, and the remote can pause, skip or adjust reps without getting up.

## What the simulator can't tell you

A desktop simulator can prove out layout, timing, and shared navigation logic, but it can't catch electrical or optical quirks of physical HUB75 hardware. Three areas stay firmly on the bring-up checklist until the panels are powered on the bench:

- **Panel silicon and chaining order:** Four 64×64 HUB75E 1/32-scan panels look identical on a product page, yet driver chips behave differently. Plain shift registers work out of the box, FM6126A panels stay completely dark unless `SM_HUB75_OPTIONS_FM6126A_RESET_AT_START` is set, and ICN2038S or ICN2053 panels don't work with SmartMatrix at all. Even with compatible panels, C-shape stacking mounts the bottom row upside-down to shorten ribbon cables—which is why the firmware includes a serial `t` quadrant test pattern, and the build guide explains where to swap the color channels in `blit()` if a batch uses RBG or BGR order.
- **Power headroom and USB isolation:** Four 64×64 panels pull 4–5 A each at full white (16–20 A total), so the build specifies a fanless 40 A Mean Well LRS-200-5 with 1000–2200 µF bulk capacitors across each panel pair—and a compile-time brightness cap option (`CORIOLIS_MAX_BRIGHTNESS`) if running on a smaller supply. Cutting the `VUSB–VIN` pad bridge on the underside of the Teensy 4.1 is mandatory so USB power and the 5 V rail never fight.
- **Low-brightness refresh and diffusion:** SmartMatrix pushes 36/48-bit color at roughly 120 Hz, which keeps gradients smooth during the day, but long panel chains can still show faint flicker at the lowest night-dimming steps. The physical frame pairs magnetic panel mounts with a 3 mm smoked cast-acrylic sheet for crisp, high-contrast pixels; truly square pixels would need a grid louver behind the tinted sheet.

## Next: the build

The firmware already compiles cleanly for Teensy 4.1 (Teensyduino 1.62 with a patched SmartMatrix 4) with roughly 196 KB of fast RAM to spare, and the simulator lets me keep refining scenes without waiting on parts. The full shopping list, Teensy pin map, wiring notes, and staged bring-up sequence live in the repository's [hardware build guide](https://github.com/cyanidesayonara/coriolis/blob/master/docs/BUILD.md) (alongside a printable `Coriolis_Build_Guide.pdf`). Physical assembly and panel bring-up are queued up next—and once the wall is lit, we'll find out how closely reality matches the sim.
