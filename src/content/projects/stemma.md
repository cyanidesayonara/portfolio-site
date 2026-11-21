---
title: stemma
tagline: Mute your part. Play along. AI stem separation that runs on your own PC.
summary: A Windows music player that splits any song into stems, so you can drop the part you play and loop the bars you are learning.
kind: Desktop app
stack: [Python, PySide6, ONNX Runtime, HTDemucs, DirectML, librosa]
years: "2026"
cover: /img/projects/stemma-practice.png
coverAlt: The stemma practice view, with a stacked waveform per stem and a mixer below
coverDark: true
coverPosition: "88% 50%"
links:
  - label: Website and live demo
    href: https://cyanidesayonara.github.io/stemma/
  - label: Microsoft Store
    href: https://apps.microsoft.com/detail/9p2w12l8f381
  - label: Source on GitHub
    href: https://github.com/cyanidesayonara/stemma
featured: true
order: 2
color: turquoise
---

Import a song, separate it into stems (vocals, drums, bass, guitar, piano, other), mute or solo any of them, and play along with your instrument. No account, no subscription: everything runs on your own machine.

## The practice cockpit

- A tall stacked waveform with one colored lane per stem, sharing the playhead and the A-B loop region.
- **Loop Trainer**: with a loop set, the speed steps up one preset on each repeat until you're playing at full tempo.
- Pitch-preserving speed, transposition of ±7 semitones, and automatic tempo, key, beat and live chord detection.
- A metronome with tap tempo and beat sync, plus a count-in before playback and before each loop.

![Recording takes over the stems](/img/projects/stemma-takes.png)

## Separation

- **HTDemucs v4** four- and six-stem separation, and **MDX-Net** two-stem separation on the GPU via DirectML with automatic CPU fallback.
- ONNX Runtime inference, with no PyTorch. Models download on first use and are checksum-verified.
- Imports run in the background, from a file, by drag and drop, or from a YouTube URL.

## Playing along

Record takes over the stems through your audio interface. They appear as mixer rows you can nudge into line, and you can export the mix as you hear it, a single stem or just the loop, as WAV or MP3.
