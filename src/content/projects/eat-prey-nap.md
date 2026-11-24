---
title: Eat Prey Nap
tagline: A free tablet game for cats, formerly Trivial Purrsuit. The player is the cat.
summary: A Godot 4.7 tablet game built around how cats actually see and hunt, rebuilt from an earlier Flutter prototype.
kind: Game
stack: [Godot 4, GDScript, Android, Multi-touch, Procedural art]
years: "2025 to now"
cover: /img/projects/eat-prey-nap-cover.png
coverAlt: An ink-blue mouse creeping from a hiding mound toward crumbs on a straw-colored field in Eat Prey Nap
coverDark: false
links:
  - label: Source on GitHub
    href: https://github.com/cyanidesayonara/eat-prey-nap
  - label: Flutter prototype (flutter-legacy)
    href: https://github.com/cyanidesayonara/eat-prey-nap/tree/flutter-legacy
order: 11
color: saffron
---

A free tablet game for cats, formerly **Trivial Purrsuit**. It started in 2025 as a Flutter prototype (still kept under the `flutter-legacy` tag) and is now being rebuilt from scratch in **Godot 4.7** around a simple rule: **the player is the cat**. If a choice pleases humans but not cats, the cat wins.

Right now it is at milestone **M0**, a playable one-mouse prototype for PC testing and Android tablets, with no ads, accounts, purchases, or internet permission.

## Built for how cats actually see and hunt

Instead of bouncing bright arcade sprites across a dark screen, the game borrows what works in real cat prey behavior: one calm, plain surface, a few fixed hiding mounds a cat can stake out, crumbs that give the mouse a reason to emerge, and long stillness followed by sudden bursts of motion.

- **Dichromatic palettes and real-world sizing:** cats see brightness contrast first and blue against yellow best, with little sensitivity around teal. The game ships three high-contrast palettes (straw with ink blue, ink blue with pale yellow, and mid-grey with near black) and three calibrated mouse lengths (28, 40, and 55 mm), paired with an on-screen 50 mm ruler on the start screen so sizes stay physically accurate across tablets.
- **Stalking and burst physics:** each mouse follows a `hidden -> tell -> peek -> sniff -> creep -> freeze -> dart -> hide` state machine driven by irregular log-normal timing. Subtle ear or tail tells precede every peek, a nearby paw triggers fright or freezing, and direct hits can pin the mouse before it either wriggles free or is caught.
- **Adaptive catch rate and boldness:** catch odds lean toward roughly one catch in three good tries—with a guaranteed catch after five misses so a cat doesn't walk away frustrated—while a mouse left undisturbed gradually grows bolder and ventures farther out.
- **Multi-touch and a cat-proof exit:** every paw press acts independently, resting paw pads are ignored, and leaving a match requires holding two opposite corners for two seconds so frantic batting won't close the game.

<div class="gallery">

![Ink-blue field palette with pale-yellow mouse](/img/projects/eat-prey-nap-night.png)
![Start screen with palette selector, mouse sizes and 50 mm calibration ruler](/img/projects/eat-prey-nap-start.png)

</div>

## What's next

After testing M0 with real cats, the roadmap adds full **prey -> eat -> nap** sessions (ending on a catch, a prompt for the human to give a real treat, and a dimmed resting screen alongside the watch-only mode already in M0), plus bug and fish prey types ahead of a Google Play release.
