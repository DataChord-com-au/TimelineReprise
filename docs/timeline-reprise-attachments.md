# Event and Narrative Attachment

Timeline Reprise owns the final attachment workflow for normal events and
Narrative decorators. Attach data to Reprise band infos before calling
`Timeline.createTimeline()`.

## Normal events

```js
Timeline.attachEvents(bandInfo, events);

Timeline.attachEvents(
    [bandSet.byId.main, bandSet.byId.overview],
    events
);
```

The first argument is one band info or an array of band infos. For every target
band, this resolves its `theme.visualTheme`, binds its Reprise runtime, prepares
separate unit-aware event records, configures its event painter, and adds the
records to its own `eventSource`.

Bands built by `Timeline.createBandSet()` have independent event sources.
Attaching events to one band does not add them to any synchronized or overview
band. Pass several bands explicitly when they should receive the same source
events. Each attachment uses the target band's retained construction runtime,
so a domain projection is injected once at band construction rather than
repeated for every attachment.

`bandInfo.eventSource` must be a `Timeline.DefaultEventSource` or another event
source that provides `addMany(events)`.

## Filtering events

`Timeline.filterEvents(events, options)` returns a new array containing the
events that satisfy all configured tag filters. It does not mutate the input
array or its events.

```js
var filteredEvents = Timeline.filterEvents(events, {
    tagsContain: ["showcase", "release"],
    tagsNotContain: ["internal"],
    tagsNotOnlyContain: ["draft", "archive"]
});

Timeline.attachEvents(bandInfo, filteredEvents);
```

The options are:

- `tagsContain`: keep an event when it contains at least one listed tag.
- `tagsNotContain`: reject an event when it contains any listed tag.
- `tagsNotOnlyContain`: reject a tagged event when every one of its tags is in
  this list. An untagged event passes this filter.

Omitted options and empty arrays impose no condition. An event without `tags`
is treated as having an empty tag array. Tag comparison is exact and
case-sensitive. See
[the filtered-theme example](../examples/12-timeline-reprise-filtered-theme.html)
for a complete configuration-driven use.

## Narrative decorators

```js
Timeline.attachNarrativeDecorators(bandInfo, narrativeEvents);
```

The same preparation path classifies canonical instants and ranges, then adds
one `Timeline.NarrativeDecorator` to `bandInfo.decorators`. The decorator
receives the resolved `Timeline.VisualTheme` as one complete theme.

Use one event array. An instant has `date` or an instant `start`; a range has
`startDate`/`endDate` or `start`/`end`.

## Theme selection

Both methods accept the same explicit `visualTheme` option:

```js
Timeline.attachEvents(bandInfo, events, {
    visualTheme: "editorial"
});

Timeline.attachNarrativeDecorators(bandInfo, narrativeEvents, {
    visualTheme: narrativeTheme
});
```

The value must be a registered theme id or a `Timeline.VisualTheme` instance.
When omitted, resolution falls back to `bandInfo.theme.visualTheme`, then the
defined Reprise default.

Normal events and Narrative on one band may deliberately use different themes.
The normal-event selection remains associated with its attached records, so
painting does not revert those records to the band's fallback theme.

There is no `visualThemeId` alias and no flat attachment-level visual options.
Put visual values in `Timeline.VisualTheme`.

## Runtime selection

The runtime is Reprise's
[semantic-time dependency-injection contract](timeline-reprise-presentation-runtime.md#semantic-time-dependency-injection-contract).
Usually it is created automatically. A standard SIMILE date band receives a
native-date runtime that projects authored values to JavaScript `Date` values.

Supply a domain runtime once at band construction:

```js
var runtime = new Timeline.RepriseRuntime({
    unit: planningUnit,
    labeller: planningLabeller,
    render: renderTemplate
});

var bandSet = Timeline.createBandSet({
    runtime: runtime,
    bands: [{
        id: "main",
        width: "100%",
        interval: 10,
        intervalPixels: 100
    }]
});

Timeline.attachEvents(bandSet.byId.main, events);
Timeline.attachNarrativeDecorators(
    bandSet.byId.main,
    narrativeEvents
);
```

Both methods still accept a `runtime` option as an explicit per-attachment
override. Runtime resolution is explicit override, then the band's retained
runtime, then the default for the band unit and labeller. Values are parsed
through `unit.parseFromObject()` and ordered with `unit.compare()`. Native date
values, numeric values including zero, and wrapper values use this same path.

Automatically created runtimes derive duration context through their units and
labellers. Injected runtimes derive it through `runtime.deriveDurations()` and
may retain opaque semantic values. This applies equally to `attachEvents()`
and `attachNarrativeDecorators()`. Native dates use elapsed milliseconds with
fallback text truncated to minutes,
`Timeline.PlanningDayUnit` uses planning days,
`Timeline.HistoricalYearUnit` uses elapsed years, and `Timeline.MaUnit` uses
Ma.

Active ranges may also expose elapsed and remaining duration context. Native
date runtimes obtain the current date automatically; domain runtimes may
return an opaque semantic value from `readCurrentTime()`. Bubble fields are recalculated
for every opening. Caption tooltips on labels and graphics are recalculated on
hover or focus.

The canonical result may include `latestStart` and `earliestEnd`. Reprise uses
those projected values directly for imprecise event layout. This lets an
injected runtime interpret domain-specific or open ranges before projecting
them into the configured unit; the attachment pipeline does not inspect and
reparse the source endpoints.

The runtime receives templates selected from the VisualTheme's DisplayProfile
and the complete presentation context. Reprise's default TemplateRenderer
handles generic macros and unit labels. A selector extension may interpret
domain-specific values such as ChronicleTime without moving that interpretation
into the attachment pipeline.

## Shared record preparation

Normal events and Narrative use one preparation pipeline for:

- VisualTheme and runtime resolution;
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
