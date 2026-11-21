---
title: "Four months, 42 walks: building Path of Leash Resistance with a crew of coding agents"
description: How one developer with a day job shipped a physics comedy game to three stores, by writing briefs instead of code and reviewing everything that came back.
date: 2026-11-21
tags: [godot, ai, agents, workflow, gamedev]
cover: /img/projects/leash-street.jpg
coverAlt: A dog pulls its phone-distracted owner across a Barcelona bike lane
draft: true
---

<!-- DRAFT: written from the repository's history and docs. Check the facts, add your own voice and opinions, then set draft to false. -->

On 10 July 2026 I committed a top-down prototype with three things in it: a leash, a human glued to their phone, and some bikes. Four months later Path of Leash Resistance has 42 walks, eight chases, four statue bosses and five dogs, and it's out on the web, itch.io and the Microsoft Store. The repository has close to 2,000 commits and 467 merged pull requests.

I didn't type most of that code. I wrote briefs, ran agents in parallel, and reviewed everything they sent back. This post is about how that works in practice, and what I had to learn to make it work.

## The prototype phase: one agent, tight loop

The first weeks looked like most people's experience of AI coding. One agent, one conversation, short tasks: make the pole wrapping a real leash constraint, make the human slow down when the leash is taut, add a cafe terrace. The physics needed constant hands-on tuning, so this stayed a tight loop of ask, play, adjust.

<!-- TODO: what surprised you about this phase? What did the agent get wrong about game feel? -->

## Writing it down: AGENTS.md and PROJECT.md

The turning point was treating the project's documentation as the real interface. `PROJECT.md` holds the design pillars and the roadmap. `AGENTS.md` holds everything an agent needs before touching the code: the stack, the conventions, the game's voice, and the rules that are not up for negotiation. All art is vectors drawn in code. All music is synthesized. Player-facing text says "your human", never "the owner".

Every time an agent got something wrong, the fix went into those files as well as the code, so the next agent wouldn't repeat it.

## Going parallel: briefs, batches and worktrees

Once the rules were written down, I could hand out work in batches. A batch is a file of prompts: a shared preamble with the house rules, a shared brief for the kind of work (for example, how to build a walk), then one prompt per task. Each agent gets its own git worktree and branch, so four walks or a polish pass across a dozen districts can be built at the same time.

The briefs carry lessons forward. The latest batch opens with a list of what earlier batches got wrong: a test that assumed its walk was the last one in the list, poles that all grew street lamp heads. Those mistakes don't come back.

Parallel work has one real enemy: everyone editing the same list. The fix was structural. Each walk lives in its own module and declares its own hooks, each new test goes in its own file, and the changelog is assembled from one fragment per pull request.

## The review gate

None of this works without a gate that nothing skips. Every pull request has to show:

- the walk's own tests and the full suite passing, plus a headless smoke run;
- a scripted playtest from start to finish, logging anyone stuck in a wall;
- screenshots of the whole route, in clear weather and in its own sky;
- a "feel card": three to five things to try by hand, which I play;
- a changelog fragment, checked by a script.

<!-- TODO: how much do you actually read line by line? Where did the review catch real problems? -->

## What I'd tell someone starting out

<!-- TODO: your conclusions. Some candidates:
- The bottleneck moves from typing to deciding and reviewing.
- Write rules down the moment you repeat yourself.
- Structure the codebase so parallel work doesn't collide.
- Keep game feel in human hands.
-->
