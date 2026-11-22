---
title: "Four months, 42 walks: building Path of Leash Resistance with a crew of coding agents"
description: How one developer shipped a Godot project to the web, itch.io and the Microsoft Store by writing briefs instead of code and reviewing everything that came back.
date: 2026-11-21
tags: [godot, ai, agents, workflow]
cover: /img/projects/leash-street.jpg
coverAlt: A dog pulls its phone-distracted owner across a Barcelona bike lane
draft: true
---

<!-- DRAFT: written from the repository's history and docs. Check the facts, add your own voice and opinions, then set draft to false. -->

On July 10, 2026, I committed a top-down prototype with three things in it: a leash, a human glued to their phone, and some bikes. Four months later, at the v1.75 release, Path of Leash Resistance had 42 walks, eight chases, four statue bosses and five dogs, and it's out on the web, itch.io and the Microsoft Store. The repository has over 2,000 commits and over 600 merged pull requests.

I didn't type most of that code. I wrote briefs, ran agents in parallel, and reviewed everything they sent back. This post is about how that works in practice, and what I had to learn to make it work.

## The prototype phase: one agent, tight loop

At first it looked like most people's experience of AI coding. One agent, one conversation, short tasks: make the pole wrapping a real leash constraint, make the human slow down when the leash is taut, add a cafe terrace. The physics needed constant hands-on tuning, so this stayed a tight loop of ask, play, adjust.

The biggest surprise was how quickly an agent will invent extra state when physics feels slightly off. We went through three separate generations of pivot and angle bookkeeping layers to track leash wraps around lampposts. Every one of them looked tidy on paper and immediately drifted out of sync with the drawn rope in real play. That only stopped once we made it a hard rule in `entities/leash.gd`: the visible Verlet rope *is* the constraint—segment-vs-circle collisions, stick-slip friction, and the rendered `visible_path()` all read the same solver points, with no shadow state behind them.

Game feel also resisted delegation. Knowing on paper that the human is four times the dog's weight, that tension eases across a 1.00–1.05 stretch ratio, that planting multiplies resistance 14×, or that every owner pull needs a 0.8-second speech-bubble telegraph doesn't tell you whether a tug feels fair or muddy. An agent can wire up those constants and write tests for them; figuring out which numbers feel right still means picking up the controller and playing.

## Writing it down: AGENTS.md and PROJECT.md

The turning point was treating the project's documentation as the real interface. `PROJECT.md` holds the design pillars and the roadmap. `AGENTS.md` holds everything an agent needs before touching the code: the stack, the conventions, the game's voice, and the rules that are not up for negotiation. All art is vectors drawn in code. All music is synthesized. Player-facing text says "your human", never "the owner".

Every time an agent got something wrong, the fix went into those files as well as the code, so the next agent wouldn't repeat it.

## Going parallel: briefs, batches and worktrees

Once the rules were written down, I could hand out work in batches. A batch is a file of prompts: a shared preamble with the house rules, a shared brief for the kind of work (for example, how to build a walk), then one prompt per task. Each agent gets its own git worktree and branch, so new walks can be built side by side. I run at most two walks at a time, because each one still touches a few shared lists.

The briefs carry lessons forward. The latest batch opens with a list of what earlier batches got wrong: a test that assumed its walk was the last one in the list, poles that all grew street lamp heads. Those mistakes don't come back.

Parallel work has one real enemy: everyone editing the same list. The fix was structural. Each walk lives in its own module and declares its own hooks, each new test goes in its own file, and the changelog is assembled from one fragment per pull request.

## The review gate

None of this works without a gate that nothing skips. Every pull request carries a feel card and a changelog fragment, and a new walk has to show:

- the walk's own tests and the full suite passing, plus a headless smoke run;
- a scripted playtest from start to finish, logging anyone stuck in a wall;
- screenshots of the whole route, in clear weather and in its own sky;
- a "feel card": three to five things to try by hand, which I play;
- a changelog fragment, checked by a script.

With several branches landing a day, the real trap isn't bad syntax—it's shipping player-facing changes faster than you can play them. To keep quality from drifting, the repo enforces a hard WIP limit of **eight** merged player-facing changes in the "Awaiting acceptance" column on the project board. Merging a PR is not acceptance; once the queue hits eight, only bug fixes, tests, tooling, or refactors can land until I've played through the feel cards and signed off on them.

Automated checks catch structural drift before I ever launch a build. Any refactor of `main.gd` has to leave `tools/behaviour_snapshot.sh` byte-identical. `tools/bench_leash.gd` and `tools/bench_leash_draw.gd` guard solver microsecond budgets and geometry hashes. `tools/surface_check.py` overlays the physics surface map onto screenshots to catch spots where sidewalk was drawn like grass or sand reads like water, and `tools/shot_diff.py` compares deterministic render sweeps pixel for pixel. That frees my review time for reading tricky state transitions line by line and actually playing the feel cards.

## What I'd tell someone starting out

- **The bottleneck moves from typing to deciding and reviewing.** Generating code is fast; knowing whether a change makes the game better, and capping unplayed work at a firm WIP limit, is what actually protects the product.
- **Write rules down the moment you repeat yourself.** Every correction that stays only in chat gets lost on the next context window. Put it in `AGENTS.md` or the batch preamble once, and it holds across every future branch.
- **Structure the codebase so parallel work doesn't collide.** Central registries, shared test manifests, and top-of-file changelogs turn parallel branches into merge conflicts. Per-module `HOOKS`, per-feature test files under `tests/ci.d/`, and `changelog.d/` fragments let independent tasks land cleanly.
- **Keep game feel in human hands.** Let agents implement the physics solver, deterministic benchmarks, and screenshot harnesses, while keeping tuning constants and feel cards on your side of the loop.
