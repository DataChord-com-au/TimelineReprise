# Bands

Timeline Reprise owns band construction. Application code supplies Reprise
configuration; Reprise creates each band's native SIMILE event source, theme, ether,
painters, band infos, synchronization links, and timeline instance.

```js
var bandSet = Timeline.createBandSet({
    initialDate: "2026-01-01",
    clampRange: {
        start: "2024-01-01",
        end: "2028-01-01"
    },
    eventTheme: "events",
    syncTarget: "main",
    highlight: "overview",
    bands: [
        {
            id: "main",
            width: "70%",
            intervalUnit: "month",
            intervalPixels: 100
        },
        {
            id: "overview",
            width: "30%",
            intervalUnit: "year",
            intervalPixels: 200,
            overview: true
        }
    ]
});

var timeline = Timeline.createTimeline(
    document.getElementById("timeline"),
    bandSet
);
```

There is no application-level `Timeline.ClassicTheme.create()`,
`Timeline.DefaultEventSource`, native `bandInfo` assembly, or numeric
synchronization wiring in this path.

## Projection contract

Band construction uses the same injected `Timeline.RepriseRuntime` contract as
event attachment. In addition to `unit`, `labeller`, `readEventTime()`, and
`render()`, the runtime provides:

```js
runtime.projectTimeValue(value);
runtime.projectTimeRange(range);
```

The default implementations parse through `runtime.unit`. A projected range
may have either or both endpoints; a reversed bounded range is normalized with
`unit.compare()`.

This gives the built-in Reprise units a complete band context without another
adapter:

- Native JavaScript dates use `Timeline.NativeDateUnit`.
- Planning values use `Timeline.PlanningDayUnit`.
- Historical years use `Timeline.HistoricalYearUnit`.
- Ma values use `Timeline.MaUnit`.

Domain libraries inject semantic projection by constructing a
`RepriseRuntime` with `projectTimeValue` and `projectTimeRange`. Reprise remains
responsible for band construction.

## Scalar and wrapper units

Non-date units use a numeric ether interval instead of a Gregorian interval
name:

```js
var bandSet = Timeline.createBandSet({
    unit: Timeline.PlanningDayUnit,
    initialDate: 20,
    bands: [
        {
            id: "main",
            width: "100%",
            interval: 10,
            intervalPixels: 90
        }
    ]
});
```

Reprise creates the unit-aware event index, linear ether, labels, event
painter, and labeller. `Timeline.HistoricalYearUnit` and `Timeline.MaUnit` use
the same path.

## `Timeline.createBand(spec, context?)`

Builds one Reprise-managed native band info. `context` is used internally by
`createBandSet()` to share its runtime and projected zone registry.

Common fields:

- `width`
- `date`
- `intervalUnit` and `intervalPixels` for native date bands
- `interval` and `intervalPixels` for scalar or wrapper-unit bands
- `unit`, `labeller`, or an injected `runtime`
- `eventTheme`
- `etherTheme`
- `intervalMarkers`
- `markerAlign`
- `emphasisSpecs`
- `backgroundColor`
- `overview` or `layout`
- `scaledZones`

`eventTheme` is a registered EventTheme id or `Timeline.EventTheme` instance.
`etherTheme` contains native ether overrides, but Reprise creates and owns the
native theme carrying them.

`intervalMarkers` is a boolean controlling the band's normal unit-marker
labels. It defaults to `true`. Set it on `createBandSet()` as a shared default
or override it on one entry in `bands`.

`markerAlign` controls which band edge receives the band's normal date or unit
markers. It accepts `"Top"`, `"Bottom"`, `"Left"`, or `"Right"`. This is band
behavior; marker dimensions such as `hLength` and `vLength` remain in
`etherTheme.interval.marker`.

Vertical bands default to right-aligned markers. When a vertical band uses
`markerAlign: "Left"`, Reprise gives event and overview tracks a larger default
cross-axis offset so normal markers have room. Set
`eventTheme.track.vertical.offset` when a band needs a different clearance.

In dark mode, Reprise cycles five default band background tones across every
band. Override the cycle per timeline with CSS custom properties:

```css
#timeline {
    --timeline-reprise-band-bg-1: #555555;
    --timeline-reprise-band-bg-2: #444444;
    --timeline-reprise-band-bg-3: #303030;
    --timeline-reprise-band-bg-4: #2a2a2a;
    --timeline-reprise-band-bg-5: #1e1e1e;
}
```

Per-band `backgroundColor` still wins over the cycle.

Emphasized marker labels retain the same dimensions as ordinary labels by
default. The `timeline-date-label-em` class remains available for application
CSS that deliberately wants different geometry:

```css
.timeline-horizontal .timeline-date-label-em {
    height: 2em;
}

.timeline-vertical .timeline-date-label-em {
    width: 7em;
}
```

## `Timeline.createBandSet(spec)`

Builds one named synchronization group. Each `bands[]` item requires a unique
`id`.

`orientation` is `"horizontal"` by default. Set it to `"vertical"` for a
vertical timeline.

Every band has an independent event source. Band-set configuration does not
accept `eventSource`; supply one on an individual band only when replacing its
Reprise-created source. `Timeline.attachEvents()` adds data only to the band or
explicit array of bands passed to it.

For a set with more than one band, `syncTarget` is required and names the band
that every other band follows. The target itself receives no native
`syncWith`. Per-band synchronization overrides and numeric indexes are not
part of the authored API. Independently pannable bands belong in another band
set.

`highlight` names one band id or an array of band ids that display the
synchronized viewport. It cannot select the `syncTarget`.

The result contains:

```js
{
    bandInfos,
    byId,
    indexById,
    orientation,
    syncTarget,
    runtime,
    unit,
    initialDate,
    clampRange,
    clampController,
    timeline
}
```

The native `bandInfos` remain available for Reprise internals and advanced
integration, but normal application code uses `byId` for event attachment and
passes the complete band set to `Timeline.createTimeline()`.

Top-level `zones` is an array of scaled-zone specs, each with a unique `id`. A
band selects them with `scaledZones: true`, one id, or an array of ids. Zone
boundaries are projected through the band-set runtime. Scaled zones support
native dates and Reprise's scalar and wrapper units, including historical
years and Ma values.

## `Timeline.createTimeline(container, bandSet)`

Creates the native SIMILE timeline internally, then:

- adds stable `timeline-band-{id}` classes and `data-timeline-band-id`;
- adds stable `timeline-reprise-band` and
  `timeline-reprise-band-tone-{1..5}` classes;
- applies configured band background colors;
- centers each root band chain on `initialDate`;
- installs the Reprise clamp controller for `clampRange`;
- records the timeline and clamp controller on the band set.

Every constructed band retains the band-set runtime. Consequently,
`Timeline.attachEvents()` and `Timeline.attachNarrativeDecorators()` use the
same injected projection automatically unless an attachment explicitly
selects another runtime.

---
[Back to top](#bands)<br>
[Back to main](TimelineReprise.md)
<!-- EOF -->
