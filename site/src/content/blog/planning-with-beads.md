---
title: "Planning with beads, building with a herd"
description: "How I turn ideas into dependency-aware tasks and let several agents work them in parallel."
date: 2026-10-01
tags: [workflow, agents]
---
My loop for new projects is deliberately boring.

1. **Capture as beads.** Every idea, bug and chore becomes an issue in [beads](https://github.com/steveyegge/beads), which stores issues in the repo itself with real dependencies between them.
2. **Let the graph decide.** `bd ready` lists only the tasks with no open blockers. That is the whole scheduler.
3. **Run a herd.** With herdr and ntm I keep several agent panes open, each claiming one ready bead, so the work fans out and the dependency graph keeps it honest.
4. **Review and merge.** My job is steering and taste: reading diffs, playtesting builds, and writing the next beads.

The part that surprised me is how much the graph helps *me*. Having the plan written down as small, dependent pieces means a fresh agent session can pick up exactly where the last one stopped, with no re-briefing.

This post is a stub I will expand with real examples from Joystick Jammers and Physical Soccer.
