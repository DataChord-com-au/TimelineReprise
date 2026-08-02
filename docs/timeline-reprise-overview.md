# Overview

Overview band styling for Timeline Reprise.

## Overview Theme

```js
var eventThemes = Timeline.loadEventThemes([{
    id: "overview",
    track: {
        horizontal: {
            offset: 20,
            gap: 4
        },
        vertical: {
            offset: 20,
            gap: 4
        }
    },
    instant: {
        iconColor: "orange",
        tickWidth: 8
    },
    range: {
        width: 3,
        iconColor: "green"
    }
}]);
```

Overview consumes the same resolved
[`Timeline.EventTheme`](timeline-reprise-event-theme.md) as normal events and
Narrative.

### `eventTheme.track`
Sets overview track placement and spacing.

```js
track: {
    horizontal: {
        offset: 20,
        gap: 4
    },
    vertical: {
        offset: 20,
        gap: 4
    }
}
```

`horizontal` is used when the timeline is horizontal.
`vertical` is used when the timeline is vertical.

### `eventTheme.track.horizontal.offset`
Sets the cross-axis edge where instant ticks end for horizontal timelines.
Range tapes begin after `eventTheme.track.horizontal.gap`.

### `eventTheme.track.horizontal.gap`
Sets spacing between instant ticks and the first range tape, and between range tape tracks, for horizontal timelines.

### `eventTheme.track.vertical.offset`
Sets the cross-axis edge where instant ticks end for vertical timelines.
Range tapes begin after `eventTheme.track.vertical.gap`.
When omitted on a vertical band with `markerAlign: "Left"`, Reprise uses a
larger default offset of `48` so overview ticks and tapes clear the marker
edge. Set this value explicitly to tune that clearance.

### `eventTheme.track.vertical.gap`
Sets spacing between instant ticks and the first range tape, and between range tape tracks, for vertical timelines.

## Instant Events

### `eventTheme.instant.tickWidth`
Sets the cross-axis length of overview ticks for instant events.

```js
instant: {
    tickWidth: 8
}
```

### `eventTheme.instant.iconColor`
Sets the default overview colour for instant event ticks.

```js
instant: {
    iconColor: "orange"
}
```

Named colours are resolved through `Timeline.ThemeIcons` when available.

Overview reads `iconColor` and `tickWidth` directly from `instant`.
Orientation branches under `instant` are ignored by the overview painter.

## Range Events

### `eventTheme.range.width`
Sets the overview tape thickness for range events.

```js
range: {
    width: 3
}
```

### `eventTheme.range.iconColor`
Sets the default overview colour for range event tapes.

```js
range: {
    iconColor: "green"
}
```

Named colours are resolved through `Timeline.ThemeIcons` when available.

Overview reads `width` and `iconColor` directly from `range`.
Orientation branches under `range` are ignored by the overview painter.

## Event Colours

Overview uses the standard event colour contract. When `eventColorScope` is
`graphic` or `both`, `iconColor` overrides one instant tick, `tapeColor`
overrides one range tape, and `color` is their fallback. With `label` or
`none`, overview graphics use their theme colours. Emphasis remains above the
scope unless disabled.

## Notes

Overview support adapts Reprise theme data onto SIMILE's native overview painter. It does not replace the overview layout algorithm.

For overview bands, `offset` and `gap` belong under `track`.
Range tape thickness belongs under `range.width`; instant tick size remains
under `instant.tickWidth`.

---
[Back to top](#overview)<br>
[Back to main](TimelineReprise.md)
<!-- EOF -->
