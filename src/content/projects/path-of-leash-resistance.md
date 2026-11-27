---
title: Path of Leash Resistance
tagline: A physics comedy about a dog walk. You are the dog; your human is glued to their phone.
summary: A top-down leash-physics comedy set in and around Barcelona, built in Godot 4 and released on the web, Windows and the Microsoft Store.
kind: Game
stack: [Godot 4, GDScript, Verlet rope physics, Synthesized audio, GitHub Actions]
years: "2026"
cover: /img/projects/leash-street.jpg
coverAlt: A dog pulling its phone-distracted human along La Rambla's wavy paving next to a bike lane on a red leash
links:
  - label: Play in the browser
    href: https://cyanidesayonara.github.io/path-of-leash-resistance/
  - label: itch.io
    href: https://cyanidesayonara.itch.io/path-of-leash-resistance
  - label: Microsoft Store
    href: https://apps.microsoft.com/detail/9p5d14v8rbqx
  - label: Source on GitHub
    href: https://github.com/cyanidesayonara/path-of-leash-resistance
featured: true
order: 1
color: saffron
---

Your human is glued to their phone and walking on autopilot. You are on the other end of the leash. Get them home with the phone in one piece, and sneak in as much dog business on the way as you can get away with.

## How it plays

![Path of Leash Resistance gameplay clip showing pole whirling and leash pulls](/img/projects/leash-hero.webp)

Your human is four times your weight and wins every straight tug. So you win the way a dog does: dig in at the right moment, wind the leash round a lamppost to hold them fast, and bark to stop them dead at the curb. Wind them round a pole and keep pulling, and they whirl off the coil like a tetherball.

The leash is real rope. The one you see is the one doing the physics: it wraps poles, cinches when taut, slips off under a hard wrench, and tangles with other people's leashes.

![A walk through the Eixample](/img/projects/leash-eixample.jpg)

## What's in it

- **Fifty-five main walks across five chapters**, plus a First Walk tutorial, from La Rambla and El Gòtic out to Sitges, Girona, Montserrat and new stops such as Rambla del Poblenou, Les Tres Xemeneies, Fira de Santa Llúcia and Santa Coloma. Each walk can be played in any weather, by day or at night.
- **Ten chase walks and five statue bosses**, from La Neteja's dawn sweeper to El Mamut, El Drac, Els Lleons, La Lleona and El Gat.
- **Seven dogs**, each with a knack and skill goal of her own, plus buried finds, training, collars, bandanas and coats.
- **Dares and combo tricks**: swing round a pole, grind a ledge, fling your human, or take a dare for its own tune.
- **Per-action control rebinding** for keyboard, gamepad buttons, sticks and triggers, with automatic Xbox and PlayStation prompt detection.
- **English, Catalan and Spanish**, with adjustable screen shake, flashes, text size and controls.
- No ads, no purchases, no account. Plays offline.

The game keeps growing, so the full list of walks, dogs, chases and bosses, along with what's new, lives on [the game's own site](https://cyanidesayonara.github.io/path-of-leash-resistance/).

![Outrunning the street sweeper chase](/img/projects/leash-sweeper.webp)

![Montserrat](/img/projects/leash-montserrat.jpg)

## Under the hood

- **Godot 4, GDScript only**, on the GL Compatibility renderer so the web export runs everywhere.
- **Everything is drawn in code.** There are no sprite files: every dog, lamppost and tile of trencadís is a vector drawn in `_draw()`, batched to keep the web build fast.
- **All music and sound is synthesized in code**, then pre-rendered for release builds.
- **Releases are automated**: a version tag builds and pushes the web and Windows builds to itch.io and packages the Microsoft Store version.
- **Built with a team of AI coding agents.** Each walk is written up as a brief, built by an agent in its own worktree and branch, gated by automated tests and CI, with every player-facing change played and accepted before it merges. More on that in [How I build](/how-i-build).
