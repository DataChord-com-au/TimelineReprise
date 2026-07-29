# Cardinal Axis

A bounded numeric axis for Timeline Reprise.

## Timeline.CardinalAxis

```js
new Timeline.CardinalAxis({
    theme: theme,
    startDate: startDate,
    endDate: endDate,
    unit: Timeline.DateTime.MONTH,
    multiple: 1,
    labelForIndex: function (index) {
        return String(index);
    }
})
```

Creates an ether painter that labels the axis by count rather than by calendar date.

The timeline still uses dates for event placement. The cardinal axis changes the labels drawn on the band.

This uses SIMILE's orientation-aware axis layout, so the same painter can be used on horizontal or vertical timelines.

It inherits the shared `theme.ether.interval.marker` options documented under
[Core](timeline-reprise-core.md#ether-interval-date-markers). Supply
`markerTheme` to override those settings for this cardinal axis only.

## Options

### `theme`
SIMILE theme object used by the painter.

```js
theme: Timeline.ClassicTheme.create()
```

### `markerTheme`
Optional marker-theme properties for this cardinal axis.

```js
markerTheme: {
    show: true,
    hLength: "label",
    vLength: "4em"
}
```

The existing native marker field names are unchanged, including `show`,
`hLength`, and `vLength`. Omitted fields continue to come from
`theme.ether.interval.marker`. The resolved marker theme does not mutate the
supplied `theme` or `markerTheme` object. Lengths control the separate marker
tick, not the label dimensions; use a CSS length, `"label"` to follow the
rendered label extent, or `null` for native SIMILE sizing.

### `startDate`
Date where the cardinal axis starts.

```js
startDate: new Date("2020-02-15T00:00:00Z")
```

The first label is index `0` unless `startLabel` is supplied.

### `endDate`
Optional date where the cardinal axis stops.

```js
endDate: new Date("2020-12-15T00:00:00Z")
```

### `unit`
SIMILE date unit used for each step.

```js
unit: Timeline.DateTime.MONTH
```

### `multiple`
Number of units per step.

```js
multiple: 1
```

### `labelForIndex(index)`
Returns the label text for each index.

```js
labelForIndex: function (index) {
    return String(index);
}
```

### `startLabel`
Optional label for the first marker.

```js
startLabel: "Start"
```

### `endLabel`
Optional label for the end marker.

```js
endLabel: "End"
```

### `background`
Controls whether the painter creates the normal ether background layer.

```js
background: false
```

Defaults to `true`.

### `cssClass`
Optional class name added to generated axis markers.

```js
cssClass: "month-count-axis"
```

### `align`
Optional SIMILE marker alignment value.

### `showLine`
Controls whether SIMILE draws interval lines.

## Painter Interface

- `initialize(band, timeline)`
- `setHighlight(startDate, endDate)`
- `paint()`
- `softPaint()`

These methods satisfy the SIMILE ether painter interface.

## Example

```js
bandInfos[1].etherPainter = new Timeline.CardinalAxis({
    theme: theme,
    markerTheme: {
        vLength: "4em"
    },
    startDate: new Date("2020-02-15T00:00:00Z"),
    endDate: new Date("2020-12-15T00:00:00Z"),
    unit: Timeline.DateTime.MONTH,
    multiple: 1,
    labelForIndex: function (index) {
        return String(index);
    }
});
```

---
[Back to top](#cardinal-axis)<br>
[Back to main](TimelineReprise.md)
<!-- EOF -->
