# Core

Shared behaviour patches for Timeline Reprise.

## Default Container Size

Loading the Reprise stylesheet gives an otherwise unsized timeline container a
responsive default height:

```css
height: var(--timeline-reprise-height, clamp(18rem, 40svh, 32rem));
```

SIMILE adds the `.timeline-container` class before it measures and lays out the
bands, so no container-size CSS is required for a basic Reprise timeline.
The fallback rule has zero selector specificity: an authored width or height
wins through the normal cascade.

Override only the custom property when a different nominal height is wanted:

```css
#timeline {
    --timeline-reprise-height: 50svh;
}
```

Plain percentage heights still depend on a definite parent height.

## Synced Band Highlight Size

SIMILE's synced-band ether highlight leaves a small cross-axis inset. Reprise
defaults that highlight to span the full band cross-axis, which avoids edge
artifacts when translucent decorators overlap it.

Override the inset when the original gap, or another gap, is wanted:

```css
#timeline {
    --timeline-reprise-ether-highlight-inset: 2px;
}
```

## Ether Interval Date Markers

SIMILE's native ether painters use `theme.ether.interval.marker` for their
date markers. Timeline Reprise adds marker visibility and cross-axis length
options to that object:

```js
var theme = Timeline.ClassicTheme.create();

theme.ether.interval.marker.show = false;
theme.ether.interval.marker.hLength = "2.5em";
theme.ether.interval.marker.vLength = "4em";
```

- `show` controls only `.timeline-date-label` markers and defaults to `true`.
  Setting it to `false` leaves the normal ether painter active, including
  synced highlights, backgrounds, interval lines, weekends, and grid marks.
- `hLength` is the marker's cross-axis length on a horizontal timeline and is
  applied as CSS `height`. It defaults to `null`, retaining SIMILE's existing
  normal and emphasized marker heights.
- `vLength` is the marker's cross-axis length on a vertical timeline and is
  applied as CSS `width`. It defaults to `"2.5em"`.

The `h` and `v` prefixes follow SIMILE's existing `hAlign` and `vAlign`
convention. Lengths are CSS length strings. A marker label can extend beyond
the configured length; the border that draws the tick remains fixed.

Marker visibility is independent of `theme.ether.interval.line.show`. Use the
line option separately when interval lines should also be hidden:

```js
theme.ether.interval.marker.show = false;
theme.ether.interval.line.show = false;
```

The shared marker layout applies these options to Gregorian, hot-zone,
year-count, quarterly, and Timeline Reprise cardinal-axis painters. A
`Timeline.CardinalAxis` can override them locally with its
[`markerTheme`](timeline-reprise-cardinal-axis.md#markertheme) option.

## Timeline.EmptyEtherPainter

```js
new Timeline.EmptyEtherPainter()

new Timeline.EmptyEtherPainter({
    backgroundColor: "#1e1e1e"
})
```

A minimal ether painter that creates the ether background layer but does not draw ticks, labels, highlights, or grid marks.

Useful when a band should provide layout/context without visible ether decoration.

The optional `backgroundColor` value must be nullish or a non-empty CSS colour string. When supplied, it is applied directly to the normal `.timeline-ether-bg` layer, so the band background does not depend on the Timeline Reprise stylesheet. The class name remains available as a styling hook; CSS overrides of the inline colour require `!important`. Omitting the option leaves the layer colour unset.

### Painter interface
- `initialize(band, timeline)`
- `setHighlight()`
- `paint()`
- `softPaint()`

These exist to satisfy the SIMILE painter interface. Only `initialize` does work; the others are intentionally empty.

## Timeline.ThemeIcons

### `Timeline.ThemeIcons.colorAliases`
Named colour map used by the icon helpers.

### `Timeline.ThemeIcons.normalizeColor(color)`
Trims a supplied colour value and converts nullish input to an empty string.

### `Timeline.ThemeIcons.getCssColor(color)`
Returns a CSS colour string.

Named colours such as "orange" are resolved through colorAliases; unknown values pass through, so CSS colours like "#d64b4b" or "rebeccapurple" can still be used.

### `Timeline.ThemeIcons.get(color)`
Returns a data:image/svg+xml URL for a small circular marker icon in the requested colour.
Example:
```js
icon: Timeline.ThemeIcons.get("orange")
```

## Flexible Band Widths
```js
width: "*"
width: "2fr"
width: "30%"
width: 120
```
Adds flexible width support to SIMILE band configs.
"*" means take the remaining available width.
"fr" values share remaining width by weight.
Percentages and fixed pixel values continue to work as fixed widths.
Example:
```js
Timeline.createBandInfo({
    width: "*"
})
```

## Absolute Event URLs
Event source URL handling accepts already-absolute URI schemes, including `data:` URLs.
This supports generated SVG marker icons without SIMILE treating them as relative file paths.

## Timeline.clampBandChains

```js
var clamp = Timeline.clampBandChains(timeline, {
    start: new Date("2024-01-01T00:00:00Z"),
    end: new Date("2028-01-01T00:00:00Z")
});
```

Installs a Reprise-owned navigation clamp on an already-created timeline.
`start` and `end` are optional individually, but at least one is required.
They constrain the center of every band chain. When any master or synced
follower attempts to cross a boundary, all chain masters land exactly on that
boundary.

Bounds are parsed with `timeline.getUnit().parseFromObject()` and ordered with
the unit's `compare()` method. Native `Date` values, numeric units, and wrapped
unit values therefore use the same unit contract as the timeline itself.

The clamp intercepts SIMILE's common movement gate, covering dragging, wheel
scrolling, keyboard navigation, animated page movement, HOME/END, and
programmatic band movement. Zoom is allowed to complete its internal movement
transaction before its final center is clamped.

An initially out-of-range timeline is clamped immediately. The returned
controller exposes:

```js
clamp.dispose();
clamp.disposed;
```

Disposing the timeline also disposes its clamp. Do not combine this API with
SIMILE's `theme.timeline_start` or `theme.timeline_stop`; Reprise rejects that
configuration because the native clamp has different viewport-edge semantics
and faulty movement prediction.

---
[Back to top](#core)<br>
[Back to main](TimelineReprise.md)
<!-- EOF -->
