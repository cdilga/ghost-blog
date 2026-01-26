# Whisp Transition Component Spec

**Tracking:** `bd show ghost-blog-zpv`

## Visual Reference

User-provided sketch shows the desired effect:
- **Flowing curved lines** (NOT circles/dots)
- **Elongated S-curves and waves** - organic bezier-like strokes
- **Varying thickness** - some lines thicker than others
- **Different lengths** - short and long trailing wisps
- **Tapered ends** - lines thin out at tips
- **Directional flow** - all wisps moving in wind direction
- **Clustered but distinct** - wisps group together but each is separate

**Key insight:** Current implementation uses circles/dots which feel "glitchy".
The desired effect requires **bezier curves/paths** that flow smoothly.

## Current State

The windswept mask transition (`themes/chris-theme/assets/js/scenes/windswept-mask.js`) currently:
- Uses SVG clipPath with particles to mask between two depth-map canvases
- Has a "finger" system for elongated dust streams
- Edge particles obscure the hard rect line (acceptable)
- Particles are animated with noise and drift

## Problems to Solve

### 1. Too Glitchy, Not Smooth/Wispy
**Current:** Particles feel scattered and "scraggly" - more like random dots than cohesive wisps
**Desired:** Dense, flowing wisps that feel like smoke/sand being blown by wind

**Potential approaches:**
- Use bezier curves or paths instead of individual circles
- Create "ribbons" of particles that flow together
- Add motion blur effect (SVG filter or canvas)
- Increase density significantly within each wisp
- Make wisps longer and more connected (trails)
- Consider using canvas 2D instead of SVG for smoother rendering

### 2. Abrupt Disappearance at End
**Current:** When scroll reaches end of transition zone, particles just blink out
**Desired:** Particles should animate off-screen smoothly after scroll completes

**Implementation:**
- Detect `onLeave` from ScrollTrigger
- Continue animation loop after scroll completes
- Accelerate particles off-screen (drift them left)
- Fade out particle sizes/opacity over ~1-2 seconds
- Only stop animation after all particles have exited

### 3. Visual Quality of Wisps
**Current:** Individual circles are visible, feels like confetti
**Desired:** Cohesive, flowing wisps like desert sand or smoke

**Ideas to explore:**
- **Ribbon approach:** Draw elongated shapes (ellipses, paths) instead of circles
- **Trail effect:** Each particle leaves a fading trail
- **Density clusters:** Many more small particles per wisp (50-100 vs current 35)
- **Blur/glow:** Apply gaussian blur for softer edges
- **Canvas rendering:** Consider rendering to canvas for better performance and effects

## Recommended Approach: Bezier Curve Wisps

Based on the visual reference, the implementation should use **flowing paths** not circles:

### Wisp Structure
Each wisp should be:
1. A **bezier curve** (quadratic or cubic) with 3-5 control points
2. **Variable thickness** - thicker in middle, tapered at ends
3. **Animated control points** - points drift/wave over time
4. Length varies from 50-300px

### SVG Path Approach
```svg
<path d="M x1,y1 Q cx,cy x2,y2" stroke-width="varies" stroke-linecap="round"/>
```
- Use `stroke-width` that varies along the path (may need multiple segments)
- `stroke-linecap="round"` for smooth ends
- Animate the `d` attribute control points

### Canvas Approach (preferred for performance)
```javascript
ctx.beginPath();
ctx.moveTo(x1, y1);
ctx.quadraticCurveTo(cpX, cpY, x2, y2);
ctx.lineWidth = varies;
ctx.lineCap = 'round';
ctx.stroke();
```
- Easier to vary line width along path
- Better performance with many wisps
- Can add blur/glow effects

### Animation
- Control points drift with noise-based displacement
- Wisps spawn at mask edge, flow leftward
- Each wisp has slight wave/undulation
- Fade out by reducing stroke width to 0

## Technical Considerations

### SVG Limitations
- clipPath doesn't support opacity/blur
- Groups (`<g>`) don't work in clipPath
- Limited to binary visible/hidden
- **Paths work in clipPath** - can use `<path>` elements

### Canvas Alternative
Could render particles to a canvas and use that as a mask:
- More flexibility with effects (blur, trails, glow)
- Better performance for many particles
- Can composite multiple layers
- Requires different masking approach

### Hybrid Approach
- Use SVG clipPath for the main mask rect
- Render wisps to an overlay canvas
- Blend the canvas with the transition

## Acceptance Criteria

1. [ ] Wisps feel dense and flowing, not scattered/glitchy
2. [ ] No visible hard edge from the mask rect
3. [ ] Wisps animate smoothly off-screen when scroll completes
4. [ ] Animation feels like windblown sand/smoke
5. [ ] Performance remains acceptable (60fps target)
6. [ ] Reduced motion preference still respected

## Files Involved

- `themes/chris-theme/assets/js/scenes/windswept-mask.js` - Main implementation
- `tests/scroll-choreography.spec.js` - Tests for scroll behavior

## Reference

Current particle counts:
- 1025 total particles
- 15 fingers x 35 particles = 525 finger particles
- 100 loose particles
- 400 edge particles

Current animation:
- Noise-based displacement
- Drift speed 15-40px/s for fingers
- Wave motion on fingers
- Finger lifespan 4-10 seconds
