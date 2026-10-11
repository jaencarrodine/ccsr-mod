# CCSR finisher spec

A finisher is the win animation CCSR plays when you win a ranked match or a challenge. This folder, ~/ccsr-finisher, holds three files: this spec, starter.svg (a finisher that passes every rule below) and finisher.svg (yours). Edit finisher.svg only. CCSR writes SPEC.md and starter.svg again each time you press Make a finisher, and never touches finisher.svg once it exists.

## The stage

- One SVG drawing, 960 by 408: the root is `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 408">`. Width and height are set to the stage whatever you write.
- It plays between our HUD above (both players, their points, the countdown to the bell) and our result strip below (the line and the score). Draw no handles, scores, ratings, tiers or HUD of your own: ours carries them, and a copy of our screens fails the review.
- The bell rings at 0.8 s. Time your hit to it.
- Everything finishes by 8 s. After that the last frame holds, so end on a frame worth looking at.
- Every animation holds its end state, and before its delay an animated element shows its first keyframe (CCSR writes every animation with fill mode both).
- Paint your own background (a full-stage rect) or leave it clear over our dark stage, ink #141312.

## The slots

A win plays one of six finishers, and the server picks which from how you won. You can equip your own finisher in each slot; a win in a slot with yours equipped plays yours inside our frame.

- Flawless ship: your opponent scored 0.
- Shipality: you scored 3 times their points or more.
- Clutch: you were behind as the last minutes before the bell began, or after any score in them.
- Photo finish: you won by 3 points or less.
- Ultra combo: you scored 8 commits or more.
- Knockout: any other win.

## Animation

- CSS keyframes only: a `<style>` element with `@keyframes` rules, and `style` attributes. No SMIL (animate, set, animateTransform, animateMotion) and no script.
- The whole-block rule: every CSS rule or `style` attribute that sets any `animation-*` property must name its animations in that same block, with the `animation` shorthand or `animation-name`. A class that carries an animation, plus an `animation-delay` on the element in a style attribute, is refused. Write each element's whole animation in one place, and give staggered elements a rule or a style attribute of their own.
- Animation properties: animation, animation-name, animation-duration, animation-delay, animation-iteration-count, animation-timing-function, animation-direction, animation-fill-mode. Not animation-play-state, and no var() in any of them.
- Every animation ends by 8 s: its delay plus its duration times its iterations. No infinite.
- Easing: linear, ease, ease-in, ease-out, ease-in-out, step-start, step-end, steps(n) or steps(n, jump-start, jump-end, jump-none, jump-both, start or end), or cubic-bezier with both y values from 0 to 1. No linear() and no overshoot.
- At most 32 instants across the whole drawing: the moments anything starts, stops or jumps (every keyframe offset, every step, every start and end). Put your timings on a few shared beats.
- At most 64 stops in one @keyframes.
- No flashing: an animation whose iteration is 0.2 s or shorter repeats at most 3 times, and nothing turns brighter or darker more than 6 times in any one second (3 flashes).

## Text

- ASCII only: every character in the file is printable ASCII, plus newlines and tabs. No emoji, no accents, no other scripts, not even in comments.
- Draw words as paths, not text. Text draws in whatever font the viewer has (font-family takes only the generic families: serif, sans-serif, monospace, cursive, fantasy, system-ui, ui-serif, ui-sans-serif, ui-monospace, ui-rounded), and every glyph counts toward the budget below. Text is fine for decoration, like a field of binary digits.

## What's allowed

- Elements: g, defs, symbol, use, path, rect, circle, ellipse, line, polyline, polygon, text, tspan, textPath, linearGradient, radialGradient, stop, pattern, clipPath, mask, filter and style, and the filter primitives feGaussianBlur, feOffset, feFlood, feComposite, feMerge, feMergeNode, feColorMatrix and feBlend. Nothing else, so no image, no foreignObject, no feTurbulence.
- Attributes: each element's own geometry (d, x, y, width, height, cx, cy, r, rx, ry, points, pathLength and the like), the presentation attributes (fill, stroke and their opacity, width, cap, join, miter, dasharray and dashoffset, opacity, visibility, display, transform, transform-origin, transform-box, clip-path, mask, filter, color, paint-order, shape-rendering, the font attributes, text-anchor, dominant-baseline, letter-spacing, word-spacing), and id, class and style. No event handlers (onload, onclick) and no other namespaced attribute.
- References point inside the file only: `href="#id"` on use and textPath, and `url(#id)` for fill, stroke, clip-path, mask and filter. Nothing outside it: no http, no data:, no files, no fonts, no images.
- Ids: a letter, then up to 63 letters, digits, `_` or `-`.
- The root `<svg>` takes no id, class or style, and no transform, clip-path, mask or filter. A CSS rule whose selector can match the root may style it but never move or animate it.
- Selectors: element names, .classes, #ids, the descendant combinator (a space) and comma lists. Start a selector with `svg` rather than `*`: a selector never starts with a bare `*`. No pseudo-classes, no attribute selectors, no `>` or `+`.
- CSS properties: opacity, fill, fill-opacity, fill-rule, stroke, stroke-width, stroke-opacity, stroke-linecap, stroke-linejoin, stroke-miterlimit, stroke-dasharray, stroke-dashoffset, stop-color, stop-opacity, transform, transform-origin, transform-box (not inside keyframes), visibility, display, the animation properties above, and custom properties (--name) that hold one number, length, angle, percent or color. Fonts are set with attributes, never CSS.
- CSS has no comments, no quotes, no backslashes, no at-rule but @keyframes, no important flags, and no function but url(#id), var(), calc() of numbers, colors (rgb, rgba, hsl, hsla) and transform functions.
- Numbers are plain decimals from -100000 to 100000 with a digit after any decimal point (write 3.0 or 3, never 3.) and no exponent (write 1000, never 1e3).
- Transforms: in CSS, translate takes lengths (px, % or em), rotate and skew take angles (deg, rad, turn or grad), and scale and matrix take plain numbers, so write rotate(90deg), never rotate(90). In CSS, transform-origin takes keywords (left, center, right, top, bottom) or lengths with units: 10px, never 10. The transform attribute takes plain numbers only: translate(10), never translate(10px).
- Dashes: stroke-dasharray entries are unitless or px, each at least 0.5, or at least pathLength / 500 when pathLength is set.
- Patterns: patternUnits="userSpaceOnUse", a tile at least 4 by 4, and no scale or matrix in patternTransform.
- Filters: at most 8 primitives in a filter, blur (stdDeviation) at most 8 and in user units (never primitiveUnits="objectBoundingBox"), at most 32 elements drawn with a filter, and the filter region within one box of each side (one stage, in userSpaceOnUse).
- Masks, clip paths and patterns never reach one another: one level only. At most 64 masked or clipped elements are drawn.
- XML: no DOCTYPE, no entity declarations, no CDATA and no processing instructions. Only the five XML entities (&amp; &lt; &gt; &quot; &apos;) and numeric references to printable ASCII. Comments are fine and are dropped.

## The budget

- The file is at most 64 KB (65,536 bytes) as the checker writes it out, which spells every animation in longhand, so art written with the shorthand comes out longer than you wrote it. At most 4,000 elements.
- Drawn, counting everything a use, a mask, a clip path or a pattern repeats: at most 20,000 elements and glyphs (every glyph of text counts as an element does), at most 10,000 glyphs, at most 40,000 path segments (each path command, each polyline or polygon point), at most 5,000 guide path segments laid out through textPath (a textPath counts the segments of the path it lays its text along once for every copy drawn, so a short label on a detailed path used many times runs out fast), and at most 10,000 dash entries (a dash and the gap after it are two, and each dashed outline counts with the densest dash that reaches it). Text, detailed paths and fine dashes repeated through use run out fast.
- Nesting: at most 32 levels deep, 64 counting what use draws.

## Content

Claude reviews every finisher before anyone else sees it, frame by frame, and fails any that shows:

- sexual content, hate or slurs;
- real people;
- brands or characters, or Anthropic's or Claude's marks;
- anything that imitates CCSR's or Claude Code's own screens, like a fake HUD or a fake permission prompt;
- URLs, QR codes, commands or instructions;
- gore (cartoon violence and binary blood are fine);
- flashing.

Text that talks to the reviewer fails too. A finisher that fails says why under Settings, Finishers, My finishers. Fix it and send it again.

## Check it

In CCSR, Settings, Finishers, Preview runs the same checker the server runs on finisher.svg and lists what it found, up to 20 problems, with the character where each problem starts. When it passes, it plays your finisher inside our frame, on a screen that draws custom finishers. Submit sends finisher.svg with its slot and a title of 1 to 32 printable ASCII characters, with no exclamation point; the server checks it again, then the review decides.

## A minimal finisher

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 408">
  <style>
    #ring { fill: none; stroke: #FF6A2A; stroke-width: 6; transform-box: fill-box; transform-origin: center; animation: ring 0.6s ease-out 0.8s }
    .bar { fill: #E6DED1 }
    @keyframes ring { from { opacity: 1; transform: scale(0.2) } to { opacity: 0; transform: scale(2) } }
    @keyframes rise { from { opacity: 0; transform: translateY(40px) } to { opacity: 1; transform: translateY(0px) } }
  </style>
  <rect width="960" height="408" fill="#141312"/>
  <circle id="ring" cx="480" cy="204" r="80"/>
  <rect class="bar" x="380" y="300" width="60" height="40" style="animation: rise 0.3s ease-out 0.9s"/>
  <rect class="bar" x="450" y="300" width="60" height="40" style="animation: rise 0.3s ease-out 1.0s"/>
  <rect class="bar" x="520" y="300" width="60" height="40" style="animation: rise 0.3s ease-out 1.1s"/>
</svg>
```

Each bar names its whole animation in its own style attribute, the whole-block rule.
