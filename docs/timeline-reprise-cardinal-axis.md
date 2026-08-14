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

Sparse labels can be requested without replacing `labelForIndex`. The axis
still generates every marker from `countsPerMarker`, but only every fourth
generated marker calls the label function here:

```js
Timeline.attachCardinalAxis(bandSet.byId.age, {
    ...ageSpec,
    labelEvery: 4
}, {
    showLine: true,
    showTicks: true,
    showLabels: true,
    unlabeledMarkerText: "--"
});
```

A grid-only cardinal axis can render guide lines without marker labels or
ticks:

```js
Timeline.attachCardinalAxis(bandSet.byId.monthCount, monthSpec, {
    showLine: true,
    showTicks: false,
    showLabels: false
});
```

Cardinal labels can use a caller-supplied CSS color directly or derive the same
light/dark label color used for Narrative range graphics:

```js
Timeline.attachCardinalAxis(bands.lifeEvents, schoolYears, {
    cssClass: "school-year-axis",
    markerLength: "label",
    align: "Left",
    showLine: true,
    showTicks: false,
    labelColor:
        styles.visualThemes.lifeStructure.tagsToIconColor["life-chapter"],
    deriveLabelColor: true
});
```

The source color is supplied by the caller; CardinalAxis does not resolve a
visual-theme registry.

Use an end anchor for countdown scales. Marker offset `0` is assigned to
`range.end`, and later markers step backwards from that boundary:

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

Positive finite number of `intervalUnit` values represented by one cardinal
count. Defaults to `1`. For example, `intervalUnit: "month"` with
`unitsPerCount: 3` makes one cardinal count represent one quarter.

### `countsPerMarker`

Positive finite number of cardinal counts between displayed markers. Defaults
to `1`.

### `labelEvery`

Positive integer label cadence over the generated markers. Defaults to `1`.
It does not change marker generation, tick positions, or line positions. On
skipped markers, the label content is `unlabeledMarkerText`, which defaults to
an em space.

```js
unitsPerCount: 3,
countsPerMarker: 1,
anchorValue: 1,
labelEvery: 4
```

This generates a marker every three interval units and labels marker offsets
`0`, `4`, `8`, and so on. The corresponding cardinal indexes passed to
`labelForIndex` are `1`, `5`, `9`, and so on.

### `anchorValue`

Finite cardinal value assigned to the selected anchor marker. Defaults to `0`.
For example, `anchorValue: 0` with `countsPerMarker: 2` labels markers `0`, `2`,
`4`, and so on. Using `anchorValue: 1` labels them `1`, `3`, `5`, and so on.

### `anchor`

Boundary assigned `anchorValue`. Defaults to `"start"`.

- `"start"` - marker offset `0` is `range.start`; markers advance
  chronologically.
- `"end"` - marker offset `0` is `range.end`; markers advance backwards.

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
anchor-relative marker offset between the preceding complete marker and the
next complete marker. Its cardinal index is derived from that offset and
rounded to one decimal place beyond the normal series precision. For example,
`countsPerMarker: 1` permits a terminal index such as `2.3`, while
`countsPerMarker: 0.1` permits `0.11`. This normalized index is passed to both
the default formatter and a custom `labelForIndex`.

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

Optional label function receiving the normalized cardinal index:
`anchorValue + markerOffset * countsPerMarker`. The index is anchor-relative,
not painting-order-relative, and can be fractional for truncated terminal
markers. Complete markers use the decimal precision required by `anchorValue`
and `countsPerMarker`; truncated markers allow one additional decimal place.
The default returns `String(index)`. The function is called only for marker
offsets selected by `labelEvery`.

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
calendar-aware interval stepping when that product is an integer. A fractional
native-date marker interval requires a runtime `projectCardinalAxis()` hook;
fractional scalar and wrapper-unit deltas are passed directly to their runtime
unit.

A runtime may instead provide `projectCardinalAxis(context)`. That hook returns
the projected physical range plus `markerAtIndex(markerOffset)`, where
`markerOffset` is the non-negative marker count away from the selected anchor.
It may also return `indexAtValue(value, bracket)` for partial marker offsets.
These offsets are internal placement coordinates; they are converted to the
cardinal value passed to `labelForIndex()`.

The context includes `range`, `intervalUnit`, `resolvedIntervalUnit`,
`unitsPerCount`, `countsPerMarker`, `anchor`, `finishing`, and
`truncatePreviousMarkerThreshold`.

```js
{
    range: { start: projectedStart, end: projectedEnd },
    markerAtIndex: function (markerOffset) {
        return projectedMarkerValue;
    },
    indexAtValue: function (value, bracket) {
        return partialMarkerOffset;
    }
}
```

`indexAtValue()` is used for `finishing: "truncate"` when the opposite boundary
falls between two complete markers. `bracket` contains `previousMarker`,
`nextMarker`, `previousIndex`, `nextIndex`, `anchor`, and `finishing`.
`previousIndex` and `nextIndex` are complete marker offsets despite their
retained property names. Return a non-negative finite partial marker offset;
returning `null` lets Reprise fall back to interpolation in the band's
projected primitive coordinate space.

Reprise still owns `anchor`, `finishing`, labels, and painting order, but the
runtime owns the domain quantum used to produce each marker and any semantic
partial marker offset. With `finishing: "extend"`, Reprise asks for the next
marker offset; the runtime resolves that marker in domain terms and returns
its projected timeline value.

This is the extension point for another scale type or for a Chronicle Time
runtime supplied by TimelineUtils. Reprise remains responsible for constructing
and attaching the cardinal-axis decorator.

See the
[semantic-time runtime contract](timeline-reprise-presentation-runtime.md#semantic-time-dependency-injection-contract).

## Attachment options

The optional third argument accepts:

- `runtime` - per-attachment runtime override
- `theme` - native theme override; defaults to `bandInfo.theme`
- `markerLength` - cardinal-axis marker length override
- `cssClass` - class added to generated markers
- `align` - cardinal-axis marker alignment value independent of band
  `markerAlign`
- `showLine` - whether SIMILE draws interval lines
- `showLabels` - whether marker label content is rendered; defaults to `true`
- `showTicks` - whether marker tick elements are rendered; defaults to `true`
- `labelColor` - optional CSS color applied inline to generated label content
- `deriveLabelColor` - whether `labelColor` is converted to the same
  `light-dark(...)` label color used by Narrative range labels; defaults to
  `false`
- `unlabeledMarkerText` - marker content used when `labelEvery` skips a
  generated label; defaults to an em space

When `markerLength` is omitted, the attachment inherits the band's
`markerLength`. An attachment value wins over the band value. If both are
omitted, the Reprise/native orientation default applies. Accepted values are a
CSS length, `"label"`, and `null`.

`labelColor` must be a non-empty CSS color string. With
`deriveLabelColor: false` or omitted, it is applied directly. With
`deriveLabelColor: true`, its derived result is applied. Supplying
`deriveLabelColor: true` without `labelColor` is rejected as malformed;
`deriveLabelColor: false` without a color is allowed and has no effect. Label
coloring does not apply to cardinal lines or ticks and behaves the same for
horizontal and vertical axes.

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

### `startDate`
Projected timeline value where the cardinal axis starts.

```js
startDate: new Date("2020-02-15T00:00:00Z")
```

This boundary has marker offset `0` unless `anchor: "end"` is supplied.

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
Positive finite number of interval units represented by one cardinal count.

```js
unitsPerCount: 3
```

### `countsPerMarker`
Positive finite number of cardinal counts between displayed markers.

```js
countsPerMarker: 2
```

### `anchorValue`
Cardinal value assigned to the selected anchor marker.

```js
anchorValue: 0
```

### `anchor`
Boundary assigned marker offset `0`.

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
Returns the label text for each normalized anchor-relative cardinal index.

```js
labelForIndex: function (index) {
    return String(index);
}
```

### `markerAtIndex(markerOffset)`
Optional low-level callback returning the projected timeline value for an
anchor-relative marker offset.

```js
markerAtIndex: function (markerOffset) {
    return projectedDomainMarker(markerOffset);
}
```

The attachment API supplies this from `runtime.projectCardinalAxis()` when the
runtime provides that hook. Ordinary callers should prefer
`Timeline.attachCardinalAxis()`.

### `indexAtValue(value, bracket)`
Optional low-level callback returning a semantic fractional anchor-relative
marker offset for a truncated boundary value. This is not the cardinal value
passed to `labelForIndex()`.

```js
indexAtValue: function (value, bracket) {
    return partialMarkerOffset;
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

### `showLabels`
Controls whether label content is rendered. Defaults to `true`.

### `showTicks`
Controls whether tick elements are rendered. Defaults to `true`.

### `labelEvery`
Positive integer cadence for generated marker labels. Defaults to `1`.
Skipped generated labels use `unlabeledMarkerText`; marker generation and line
placement are unchanged.

```js
labelEvery: 4
```

### `unlabeledMarkerText`
Text used for generated labels skipped by `labelEvery`. Defaults to an em
space.

```js
unlabeledMarkerText: "--"
```

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
