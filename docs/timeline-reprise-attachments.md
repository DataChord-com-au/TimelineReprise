# Event and Narrative Attachment

Timeline Reprise owns the final attachment workflow for normal events and
Narrative decorators. Attach data to band infos before calling
`Timeline.create()`.

## Normal events

```js
Timeline.attachEvents(bandInfo, events);
```

This resolves the band's `theme.eventTheme`, binds the default Reprise runtime,
prepares unit-aware event records, associates the resolved theme and runtime
with each record, configures the band's event painter, and adds the records to
`bandInfo.eventSource`.

`bandInfo.eventSource` must be a `Timeline.DefaultEventSource` or another event
source that provides `addMany(events)`.

## Narrative decorators

```js
Timeline.attachNarrativeDecorators(bandInfo, narrativeEvents);
```

The same preparation path classifies canonical instants and ranges, then adds
one `Timeline.NarrativeDecorator` to `bandInfo.decorators`. The decorator
receives the resolved `Timeline.EventTheme` as one complete theme.

Use one event array. An instant has `date` or an instant `start`; a range has
`startDate`/`endDate` or `start`/`end`.

## Theme selection

Both methods accept the same explicit `eventTheme` option:

```js
Timeline.attachEvents(bandInfo, events, {
    eventTheme: "editorial"
});

Timeline.attachNarrativeDecorators(bandInfo, narrativeEvents, {
    eventTheme: narrativeTheme
});
```

The value must be a registered theme id or a `Timeline.EventTheme` instance.
When omitted, resolution falls back to `bandInfo.theme.eventTheme`, then the
defined Reprise default.

Normal events and Narrative on one band may deliberately use different themes.
The normal-event selection remains associated with its attached records, so
painting does not revert those records to the band's fallback theme.

There is no `eventThemeId` alias and no flat attachment-level visual options.
Put visual values in `Timeline.EventTheme`.

## Runtime selection

Both methods accept the same `runtime` option:

```js
var runtime = new Timeline.RepriseRuntime({
    unit: planningUnit,
    labeller: planningLabeller,
    render: renderTemplate
});

Timeline.attachEvents(bandInfo, events, { runtime: runtime });
Timeline.attachNarrativeDecorators(
    bandInfo,
    narrativeEvents,
    { runtime: runtime }
);
```

Without an explicit runtime, Reprise uses the event source's configured unit
and `bandInfo.labeller` when present. Native date bands use the equivalent
SIMILE Gregorian labeller for the band's locale and time zone. Values are
parsed through `unit.parseFromObject()` and ordered with `unit.compare()`.
Native date values, numeric values including zero, and wrapper values use this
same path.

Duration-aware units and labellers also give automatically created runtimes
derived duration context. This applies equally to `attachEvents()` and
`attachNarrativeDecorators()`. Native dates use elapsed milliseconds,
`Timeline.PlanningDayUnit` uses planning days,
`Timeline.HistoricalYearUnit` uses elapsed years, and `Timeline.MaUnit` uses
Ma.

The canonical result may include `latestStart` and `earliestEnd`. Reprise uses
those projected values directly for imprecise event layout. This lets an
injected runtime interpret domain-specific or open ranges before projecting
them into the configured unit; the attachment pipeline does not inspect and
reparse the source endpoints.

The runtime renderer receives opaque templates and the complete EventTheme
context. Reprise's default renderer handles native unit labels; it does not
implement TimelineUtils macros or ChronicleTime formatting.

## Shared record preparation

Normal events and Narrative use one preparation pipeline for:

- EventTheme and runtime resolution;
- canonical instant/range time;
- presentation rendering;
- named colour normalization;
- bubble field fallbacks.

Prepared normal-event records implement the methods required by SIMILE's event
source and painter without routing values through SIMILE's Gregorian JSON
parser. This is what preserves numeric and wrapped unit values.

---
[Back to top](#event-and-narrative-attachment)<br>
[Back to main](TimelineReprise.md)
<!-- EOF -->
