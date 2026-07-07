# Reprise Overview

Overview band styling for Timeline Reprise.

Load after the original SIMILE Timeline scripts and `timeline-reprise-core`.

## Overview Theme

```js
theme.eventTheme = {
    track: {
        horizontal: {
            offset: 20,
            gap: 4
        }
    },
    instant: {
        width: 8,
        iconColor: "orange"
    },
    range: {
        width: 3,
        iconColor: "green"
    }
};
```

Adds a reprise theme shape for SIMILE overview bands.

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

A flat track object is also accepted as a fallback:

```js
track: {
    offset: 20,
    gap: 4
}
```

### `eventTheme.track.horizontal.offset`
Sets the overview track offset for horizontal timelines.

### `eventTheme.track.horizontal.gap`
Sets spacing between overview tracks for horizontal timelines.

### `eventTheme.track.vertical.offset`
Sets the overview track offset for vertical timelines.

### `eventTheme.track.vertical.gap`
Sets spacing between overview tracks for vertical timelines.

## Instant Events

### `eventTheme.instant.width`
Sets the overview tick size for instant events.

```js
instant: {
    width: 8
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

## Range Events

### `eventTheme.range.width`
Sets the overview tape size for range events.

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

## Event Overrides

### `overviewColor`
Sets the overview colour for one event.

```js
{
    start: "2020-07-01",
    end: "2020-10-15",
    title: "Range event",
    overviewColor: "purple"
}
```

`overviewColor` overrides the theme colour for that event in the overview band.

## Notes

This module adapts reprise theme data onto SIMILE's native overview painter. It does not replace the overview layout algorithm.

---
[Back to top](#reprise-overview)<br>
[Back to main](TimelineReprise.md)
<!-- EOF -->
