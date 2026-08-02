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

Use an end anchor for countdown scales. Marker index `0` is assigned to
`range.end`, and later indexes step backwards from that boundary:

```js
Timeline.attachCardinalAxis(bandSet.byId.remaining, {
    range: { start: 0, end: 50 },
    intervalUnit: "day",
    unitsPerCount: 5,
    countsPerMarker: 2,
    anchor: "end",
    anchorValue: 0,
    endLabel: "Due"
});
```

Unaligned ranges can choose how the incomplete opposite boundary is handled:

```js
Timeline.attachCardinalAxis(bandSet.byId.dayCount, {
    range: { start: 0, end: 47 },
    intervalUnit: "day",
    unitsPerCount: 5,
    countsPerMarker: 2,
    finishing: "truncate"
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

Finite cardinal value assigned to the selected anchor marker. Defaults to `0`.
For example, `anchorValue: 0` with `countsPerMarker: 2` labels markers `0`, `2`,
`4`, and so on. Using `anchorValue: 1` labels them `1`, `3`, `5`, and so on.

### `anchor`

Boundary assigned `anchorValue`. Defaults to `"start"`.

- `"start"` - marker index `0` is `range.start`; markers advance
  chronologically.
- `"end"` - marker index `0` is `range.end`; markers advance backwards.

Painting remains in chronological screen order. With an end anchor, default
labels therefore appear as a countdown toward the end boundary.

### `finishing`

How to handle a bounded range whose opposite boundary is not aligned to a
complete marker step. Defaults to `"drop"`.

- `"drop"` - omit the incomplete boundary marker.
- `"truncate"` - render a terminal marker at the exact projected boundary.
- `"extend"` - render the next complete marker beyond that boundary.

If the opposite boundary is aligned exactly to a marker step, it is rendered
normally for every finishing mode. For an end anchor, the opposite boundary is
`range.start`.

For an unaligned truncated boundary, the terminal marker receives a fractional
anchor-relative index between the preceding complete marker and the next
complete marker. The default label rounds fractional generated values to one
decimal place.

### `truncatePreviousMarkerThreshold`

Optional ratio from `0` to `1` used only by `finishing: "truncate"`. Defaults
to `0.4`.

When the truncated terminal marker falls less than this fraction of a marker
step after the previous complete marker, Reprise omits that previous complete
marker to avoid crowded labels such as `0`, `1`, `1.1`. A value of `0` keeps
the previous marker for every unaligned truncate; a value of `1` drops it for
every unaligned truncate except an exact next-step boundary. The anchor marker
is not removed by this threshold.

### `labelForIndex(index)`

Optional label function receiving the zero-based marker index away from the
selected anchor. The index is anchor-relative, not painting-order-relative.
For truncated terminal markers, `index` can be fractional. The default returns
`String(anchorValue + index * countsPerMarker)`, rounded to one decimal place
when the generated value is fractional.

### `startLabel`

Optional label replacing the generated label whenever the physical
`range.start` boundary is rendered.

### `endLabel`

Optional label replacing the generated label whenever the physical `range.end`
boundary is rendered.

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

By default, the runtime's `projectTimeRange()` interprets the authored `range`.
The cardinal painter then uses `runtime.unit.cloneValue()`, `compare()`, and
`change()` for non-date values. The positive delta supplied to `change()` is
`unitsPerCount * countsPerMarker`. Native JavaScript dates retain SIMILE's
calendar-aware interval stepping using the same product.

A runtime may instead provide `projectCardinalAxis(context)`. That hook returns
the projected physical range plus `markerAtIndex(index)`, where `index` is the
non-negative marker count away from the selected anchor. It may also return
`indexAtValue(value, bracket)` for partial marker positions:

The context includes `range`, `intervalUnit`, `resolvedIntervalUnit`,
`unitsPerCount`, `countsPerMarker`, `anchor`, `finishing`, and
`truncatePreviousMarkerThreshold`.

```js
{
    range: { start: projectedStart, end: projectedEnd },
    markerAtIndex: function (index) {
        return projectedMarkerValue;
    },
    indexAtValue: function (value, bracket) {
        return partialAnchorRelativeIndex;
    }
}
```

`indexAtValue()` is used for `finishing: "truncate"` when the opposite boundary
falls between two complete markers. `bracket` contains `previousMarker`,
`nextMarker`, `previousIndex`, `nextIndex`, `anchor`, and `finishing`. Returning
`null` lets Reprise fall back to interpolation in the band's projected
primitive coordinate space.

Reprise still owns `anchor`, `finishing`, labels, and painting order, but the
runtime owns the domain quantum used to produce each marker and any semantic
partial index. With `finishing: "extend"`, Reprise asks for the next marker
index; the runtime resolves that marker in domain terms and returns its
projected timeline value.

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
- `align` - cardinal-axis marker alignment value independent of band
  `markerAlign`
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

The first label is index `0` unless `anchor: "end"` is supplied.

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
Cardinal value assigned to the selected anchor marker.

```js
anchorValue: 0
```

### `anchor`
Boundary assigned index `0`.

```js
anchor: "end"
```

### `finishing`
Handling for incomplete opposite-boundary intervals.

```js
finishing: "truncate"
```

### `truncatePreviousMarkerThreshold`
Ratio below which a truncated terminal marker suppresses the previous complete
marker. Defaults to `0.4`.

```js
truncatePreviousMarkerThreshold: 0.4
```

### `labelForIndex(index)`
Returns the label text for each anchor-relative index.

```js
labelForIndex: function (index) {
    return String(index);
}
```

### `markerAtIndex(index)`
Optional low-level callback returning the projected timeline value for an
anchor-relative marker index.

```js
markerAtIndex: function (index) {
    return projectedDomainMarker(index);
}
```

The attachment API supplies this from `runtime.projectCardinalAxis()` when the
runtime provides that hook. Ordinary callers should prefer
`Timeline.attachCardinalAxis()`.

### `indexAtValue(value, bracket)`
Optional low-level callback returning a semantic fractional anchor-relative
index for a truncated boundary value.

```js
indexAtValue: function (value, bracket) {
    return partialAnchorRelativeIndex;
}
```

The attachment API supplies this from `runtime.projectCardinalAxis()` when the
runtime returns it.

### `startLabel`
Optional label for the physical start boundary when it is rendered.

```js
startLabel: "Start"
```

### `endLabel`
Optional label for the physical end boundary when it is rendered.

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
Optional cardinal-axis marker alignment value. This does not change the
band's normal date or unit marker alignment.

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
