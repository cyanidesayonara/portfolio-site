---
title: stemma
tagline: Mute your part. Play along. AI stem separation that runs on your own PC.
summary: A Windows music player that splits any song into stems, so you can drop the part you play and loop the bars you are learning.
kind: Desktop app
stack: [Python, PySide6, ONNX Runtime, HTDemucs, DirectML, librosa]
years: "2026"
cover: /img/projects/stemma-practice.webp
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

- A tall stacked waveform with one colored lane per stem, sharing the playhead and the A-B loop region. The waveform itself acts as a keyboard-accessible position slider, and session state (song, position, mixer, loop, speed, metronome and takes) is restored on launch.
- **Chord Lane & Song Sections**: the whole song's chords along the timeline with a live look-ahead readout, plus an experimental sections ruler on bar lines where you can click to jump or double-click (`Shift+L`) to loop bar-accurately.
- **Loop Trainer**: with a loop set, the speed steps up one preset on each repeat until you're playing at full tempo.
- Live pitch-preserving speed, transposition of ±7 semitones, automatic tempo, key and beat detection, a synced metronome with count-in, and light and dark themes.

![Recording takes over the stems](/img/projects/stemma-takes.webp)

## Library, setlists and queue

- Tags and a practice status per song (learning, practicing or ready), and each song keeps its own loop, speed and pitch.
- Ordered setlists for a lesson or a gig, and a play queue apart from the library.
- Select several songs to queue, tag, add to a setlist, export or remove them together, or import several files at once.

## Separation

- **HTDemucs v4** four- and six-stem separation and **MDX-Net** two-stem separation, all on the GPU via DirectML when Windows supports it, with automatic CPU fallback. Wiener filtering and soft gating reduce bleed between stems.
- From v3.3.0, a five-minute song separates into four or six stems in about a minute on a supported graphics card; two-stem mode is quicker still.
- ONNX Runtime inference, with no PyTorch. Models download on first use and are checksum-verified.
- Imports run in the background, from a file, by drag and drop, or from a YouTube URL (with a bundled QuickJS-ng runtime for `yt-dlp`).

## Playing along

Record takes over the stems through your audio interface. They appear as mixer rows you can nudge into line, and you can export the mix as you hear it, a single stem or just the loop, as WAV or MP3.
