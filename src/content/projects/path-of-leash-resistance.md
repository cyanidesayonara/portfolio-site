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

- **Fifty-one walks in and around Barcelona**, from La Rambla and El Gòtic to Montjuïc, Sitges, Girona, Tarragona, Vic and Montserrat, plus a tutorial walk that teaches one trick at a time. Each walk can be played in any weather, by day or at night.
- **Ten chases**: a street sweeper at dawn, wild boars, the correfoc's fire devils through Gràcia, the Dimoni's firework float, airport security, Les Atraccions' mascot chase, a runaway snow groomer down La Molina, and wild goats down Montserrat among them.
- **Five statue bosses**: El Mamut, El Drac the mosaic salamander, Els Lleons, La Lleona in Girona, and El Gat.
- **Seven dogs**, each with a knack and skill goal of her own, plus buried finds, training, collars, bandanas and coats.
- **Dares and combo tricks**: swing round a pole, grind a ledge, fling your human, or take a dare for its own tune.
- **Nine skies and six times of day**, in English, Catalan and Spanish, with adjustable screen shake, flashes, text size and controls.
- No ads, no purchases, no account. Plays offline.

![Outrunning the street sweeper chase](/img/projects/leash-sweeper.webp)

![Montserrat](/img/projects/leash-montserrat.jpg)

## Under the hood

- **Godot 4, GDScript only**, on the GL Compatibility renderer so the web export runs everywhere.
- **Everything is drawn in code.** There are no sprite files: every dog, lamppost and tile of trencadís is a vector drawn in `_draw()`, batched to keep the web build fast.
- **All music and sound is synthesized in code**, then pre-rendered for release builds.
- **Releases are automated**: a version tag builds and pushes the web and Windows builds to itch.io and packages the Microsoft Store version.
- **Built with a team of AI coding agents.** Each walk is written up as a brief, built by an agent in its own worktree and branch, gated by automated tests and CI, with every player-facing change played and accepted before it merges. More on that in [How I build](/how-i-build).
