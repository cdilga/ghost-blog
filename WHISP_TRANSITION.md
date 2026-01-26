# Whisp Transition Component Spec

**Tracking:** `bd show ghost-blog-zpv`

## Direction

Stylised organic wisps with a **graphic novel aesthetic**, not realistic VFX. Hard edges are acceptable but must be irregular and natural-feeling. SVG filters do the heavy lifting.

**References:** Lando Norris website transitions, comic book panel bleeds, ink wash illustrations.

## Critical Requirement

The **vertical seam must be completely hidden**. The transition zone needs to be wide enough (~20% of viewport) and chaotic enough that no straight line is perceptible.

## Technical Approach

### SVG Filter Pipeline

```svg
<filter id="wisp-distort">
  <feTurbulence
    type="fractalNoise"
    baseFrequency="0.015 0.004"  <!-- Asymmetric: lower vertical = upward flow -->
    numOctaves="5"
    seed="1"
    result="noise"/>
  <feDisplacementMap
    in="SourceGraphic"
    in2="noise"
    scale="50"                   <!-- 30-60 range -->
    xChannelSelector="R"
    yChannelSelector="G"/>
</filter>
```

**Key parameters:**
- `fractalNoise` over `turbulence` for smoother, smokier results
- Asymmetric `baseFrequency` (0.015, 0.004) creates upward-flowing, flame-like distortion
- `numOctaves` 4-5 for layered detail
- `scale` 30-60 depending on mask size

### Mask Structure

Uses `<mask>` (not `<clipPath>`) to support filters:

```svg
<mask id="windswept-mask" maskUnits="userSpaceOnUse">
  <!-- Main visible area rect -->
  <rect fill="white" x="edgeX" y="0" width="100%" height="100%"/>

  <!-- Wisp shapes with filter applied -->
  <g filter="url(#wisp-distort)">
    <ellipse fill="white" cx="..." cy="..." rx="..." ry="..."/>
    <!-- Multiple layered ellipses -->
  </g>
</mask>
```

### Layered Wisp Shapes

| Type | Count | Width | Height | Purpose |
|------|-------|-------|--------|---------|
| Large | 4 | 25-40% vw | 35-55% vh | Wide coverage, extend into both images |
| Medium | 6 | 15-25% vw | 20-35% vh | Fill gaps |
| Small | 8 | 8-15% vw | 10-20% vh | Detail and variety |
| Edge | 12 | 10-18% vw | 8-15% vh | Ensure complete seam coverage |

## Animation

- **Seed animation**: Turbulence seed cycles through 1-10 over 4 seconds for subtle flicker
- **Drift**: Slow horizontal movement (0.02 × viewport/s)
- **Wave**: Gentle vertical oscillation per shape
- **Exit**: 3× speed acceleration when scroll completes

## Requirements Checklist

- [x] No straight edges anywhere - all boundaries pass through turbulence
- [x] Transition zone minimum 20% of frame width
- [x] Layer multiple wisp shapes (30 total) at varying depths
- [x] Vary positions per shape to prevent repetition
- [x] Subtle seed animation for living, flickering edges
- [x] Extend wisps beyond the seam into both images
- [ ] Works at multiple aspect ratios without exposing seam (needs testing)

## Acceptance Criteria

1. Vertical transition line is undetectable at first glance
2. Edges feel hand-drawn or ink-splattered, not computed
3. Works at multiple aspect ratios without exposing seam
4. Aesthetic suits the bold, energetic landscape imagery
5. Reduced motion preference still respected

## Files

- `themes/chris-theme/assets/js/scenes/windswept-mask.js` - Main implementation
- `tests/scroll-choreography.spec.js` - Test for mask and turbulence filter

## Optional Enhancements (Future)

- Scattered particle sprites (small dots/embers) along transition zone
- Gradient opacity on wisp tips for depth
- Multiple filter layers with varying parameters
