---
title: "home.dilger.dev: a digital twin of a real house, built from the drawings"
description: "Walk a full 3D model of a new-build home and its street, switch construction stages, and mark up where things go. Generated from code, in the browser, on desktop or phone."
date: 2026-10-06
tags: [projects, 3d, rust, bevy]
---

Walk through a full 3D model of a new-build home and its street, switch between construction stages (slab, frame, finished), and mark up where you want things to go. It runs in the browser, on desktop or phone, with nothing to install. It is not public yet, but here is what it is and why I built it.

## Generated, not drawn

The model is generated from code, not clicked together by hand. A semantic schema and a set of parameters describe the house, and scripts turn them into walls, framing, roofs, fit-out, electrical and furniture. The same pipeline builds the surrounding street and estate, and it runs inside Fusion and Blender.

Every element has a stable ID. A change shows up as a diff, and the model rebuilds identically from the same inputs. That one property is what makes everything below possible.

## What you can do with it

- **Walk or fly through the whole house** in a Rust/Bevy viewer compiled to WebGPU, with a WebGL2 fallback for phones.
- **Switch construction stages and toggle layers**: roof and ceilings, interior, fit-out, electrical, fences, and future neighbouring stages.
- **Review electrical placement.** Family members mark power points on specific walls. Markers attach to an element ID and a local position, so they survive the model being regenerated. Every export is flagged as needing an electrician's review, so nothing reads as compliant by default.
- **Try furniture layouts.** Open-plan, retreat and dining variants use measured furniture sizes, and yes, there is a chairs-tucked toggle.
- **See day and night lighting**, with smart-light room scenes, a real star catalogue and a daylight-inside mode.
- **Plan the landscape.** A garden and landscape study kit with scenario files, a rule checker, an in-browser garden editor and a plant and vehicle catalogue. Drive mode lets you run a ute and trailer through the site with physics, to test turning circles and access down the side.
- **Compare against captured reality.** A Gaussian-splat pipeline is meant to show the site as photographed, registered to the CAD with published residuals. It never gets baked into the model: the splat is optional and the product ships without it.

## Why bother

**Decisions become visible before they are expensive.** Where the outlets, lights, furniture and fences go, and whether a car and trailer actually fit, are much cheaper to argue about in a model than on site.

**Collaboration is a link.** The family opens it on a phone and comments. Nobody installs anything.

**Trust is explicit.** The project separates *planned*, *observed*, *measured* and *verified as built*, and keeps evidence status separate from review status. A thing being in the model does not mean anyone has checked it.

**Quality is measured both ways.** Validation scripts check precision (does what is modelled match the drawing?) and recall (is everything the drawing shows actually there, and can you walk into every room?). Each gate prints what it does not cover, so a green tick never overclaims.

**It is reusable.** The house is data, not baked into the product, so the same platform could take another property.

## How it was built

Like everything else I am working on at the moment, this was planned as [beads](/blog/planning-with-beads/) and built by a herd of agents working through the ready queue, with me reviewing the diffs and walking the model. The stable element IDs turned out to matter as much for the agents as for the family: a bead can point at `wall.kitchen.north` and mean exactly one thing.
