# Core

## `timeline-reprise-core`

Shared behaviour patches for Timeline Reprise.

Load after the original SIMILE Timeline scripts.

## Timeline.EmptyEtherPainter

```js
new Timeline.EmptyEtherPainter()
```

A minimal ether painter that creates the ether background layer but does not draw ticks, labels, highlights, or grid marks.

Useful when a band should provide layout/context without visible ether decoration.

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

---
[Back to top](#core)<br>
[Back to main](TimelineReprise.md)
<!-- EOF -->
