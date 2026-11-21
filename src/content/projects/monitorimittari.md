---
title: Monitorimittari
tagline: A luminance logger that keeps hospital diagnostic displays within standard.
summary: A Python desktop tool that reads an LXscan luminance meter over USB and produces compliance reports for medical displays.
kind: Tool
stack: [Python, PyQt5, PyInstaller]
cover: /img/projects/monitorimittari.png
coverAlt: The Monitorimittari interface
links:
  - label: Source on GitHub
    href: https://github.com/cyanidesayonara/monitorimittari
order: 13
color: leaf
---

A GUI application built for the Hospital District of Helsinki's engineering team. It talks to an LXscan spot luminance meter to measure and log monitor brightness, so medical displays can be checked against the luminance standards diagnostic work depends on.

- Direct integration with the meter over USB
- Automated Excel reports for compliance documentation
- Turns a tedious manual process into a guided one
