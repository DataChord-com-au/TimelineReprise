# Cardinal Axis

A cardinal axis labels a projected time range by count rather than by calendar
date.

## Timeline.attachCardinalAxis()

```js
Timeline.attachCardinalAxis(bandSet.byId.age, {
    range: {
        start: "2020-02-15T00:00:00Z",
        end: "2020-12-15T00:00:00Z"
    },
    intervalUnit: "month",
    unitsPerCount: 3,
    countsPerMarker: 2,
    anchorValue: 0
});
```

Attaches a cardinal-axis decorator to one band info. Call it before
`Timeline.createTimeline()`.

The band supplies its theme and retained runtime. Normal SIMILE date bands need
no runtime configuration: Reprise creates the standard native-date runtime and
projects the range to JavaScript `Date` values.

Scalar and wrapper-unit bands use the same API. For example, a Planning-day
axis counts ten-day steps without an attachment-level runtime override:

```js
Timeline.attachCardinalAxis(bandSet.byId.dayCount, {
    range: { start: 0, end: 50 },
    intervalUnit: "day",
    unitsPerCount: 5,
    countsPerMarker: 2,
    anchorValue: 0
});
```

The cardinal specification is a plain object. It does not have a class or
registry because it describes one contextual attachment rather than a reusable,
composable theme.

## Cardinal specification

### `range`

Required authored range. The active runtime projects it to the band's primitive
timeline values. It must produce a concrete start; the end is optional.

### `intervalUnit`

Required SIMILE interval name or numeric `Timeline.DateTime` value. Native-date
axes use it for calendar stepping. For a non-date band, it describes the
primitive unit represented by one step; the injected timeline unit performs
the actual value change.

### `unitsPerCount`

Positive integer number of `intervalUnit` values represented by one cardinal
count. Defaults to `1`. For example, `intervalUnit: "month"` with
`unitsPerCount: 3` makes one cardinal count represent one quarter.

### `countsPerMarker`

Positive integer number of cardinal counts between displayed markers. Defaults
to `1`.

### `anchorValue`

Finite cardinal value assigned to the range's first marker. Defaults to `0`.
For example, `anchorValue: 0` with `countsPerMarker: 2` labels markers `0`, `2`,
`4`, and so on. Using `anchorValue: 1` labels them `1`, `3`, `5`, and so on.

### `labelForIndex(index)`

Optional label function receiving the zero-based marker index. The default
returns `String(anchorValue + index * countsPerMarker)`.

### `startLabel`

Optional label replacing the first generated index label.

### `endLabel`

Optional label replacing the final boundary label.

## Runtime injection

`attachCardinalAxis()` resolves its runtime in this order:

1. `options.runtime`
2. the runtime retained by the band
3. a default runtime made from the band unit and labeller

Usually no runtime argument is needed:

```js
Timeline.attachCardinalAxis(bandSet.byId.age, cardinalSpec);
```

A domain integration may override it:

```js
Timeline.attachCardinalAxis(
    bandSet.byId.age,
    cardinalSpec,
    { runtime: domainRuntime }
);
```

The runtime's `projectTimeRange()` interprets the authored `range`. The
cardinal painter then uses `runtime.unit.cloneValue()`, `compare()`, and
`change()` for non-date values. The positive delta supplied to `change()` is
`unitsPerCount * countsPerMarker`. Native JavaScript dates retain SIMILE's
calendar-aware interval stepping using the same product.

This is the extension point for another scale type or for a Chronicle Time
runtime supplied by TimelineUtils. Reprise remains responsible for constructing
and attaching the cardinal-axis decorator.

See the
[semantic-time runtime contract](timeline-reprise-presentation-runtime.md#semantic-time-dependency-injection-contract).

## Attachment options

The optional third argument accepts:

- `runtime` - per-attachment runtime override
- `theme` - native theme override; defaults to `bandInfo.theme`
- `markerTheme` - cardinal-axis marker overrides
- `cssClass` - class added to generated markers
- `align` - SIMILE marker alignment value
- `showLine` - whether SIMILE draws interval lines

Marker options inherit the shared `theme.ether.interval.marker` settings
documented under
[Core](timeline-reprise-core.md#ether-interval-date-markers).

## Low-level Timeline.CardinalAxis

`Timeline.CardinalAxis` is the painter/decorator used by
`attachCardinalAxis()`. Ordinary application code should use the attachment
API so range projection, theme selection, and band mutation remain inside
Reprise.

An attached cardinal axis renders its own markers even when the band uses
`intervalMarkers: false`.

### Low-level options

### `runtime`

The runtime that owns the projected values and timeline unit. The attachment
API supplies it automatically.

### `theme`
The theme retained by a Reprise-created band info.

```js
theme: bandInfo.theme
```

### `markerTheme`
Optional marker-theme properties for this cardinal axis.

```js
markerTheme: {
    hLength: "label",
    vLength: "4em"
}
```

The existing native marker presentation field names are unchanged, including
`hLength` and `vLength`. Omitted fields continue to come from
`theme.ether.interval.marker`. The resolved marker theme does not mutate the
supplied `theme` or `markerTheme` object. Lengths control the separate marker
tick, not the label dimensions; use a CSS length, `"label"` to follow the
rendered label extent, or `null` for native SIMILE sizing.

### `startDate`
Projected timeline value where the cardinal axis starts.

```js
startDate: new Date("2020-02-15T00:00:00Z")
```

The first label is index `0` unless `startLabel` is supplied.

### `endDate`
Optional projected timeline value where the cardinal axis stops.

```js
endDate: new Date("2020-12-15T00:00:00Z")
```

### `unit`
SIMILE date unit used for each step.

```js
unit: Timeline.DateTime.MONTH
```

### `unitsPerCount`
Number of interval units represented by one cardinal count.

```js
unitsPerCount: 3
```

### `countsPerMarker`
Number of cardinal counts between displayed markers.

```js
countsPerMarker: 2
```

### `anchorValue`
Cardinal value assigned to the first marker.

```js
anchorValue: 0
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

### Painter interface

- `initialize(band, timeline)`
- `setHighlight(startDate, endDate)`
- `paint()`
- `softPaint()`

These methods satisfy the SIMILE ether painter interface.

### Direct construction

```js
new Timeline.CardinalAxis({
    theme: bandInfo.theme,
    markerTheme: {
        vLength: "4em"
    },
    startDate: new Date("2020-02-15T00:00:00Z"),
    endDate: new Date("2020-12-15T00:00:00Z"),
    unit: Timeline.DateTime.MONTH,
    unitsPerCount: 3,
    countsPerMarker: 2,
    anchorValue: 0
})
```

Direct construction is retained as the low-level painter interface.

---
[Back to top](#cardinal-axis)<br>
[Back to main](TimelineReprise.md)
<!-- EOF -->
