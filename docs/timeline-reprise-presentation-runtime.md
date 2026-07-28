# Presentation Runtime

Timeline Reprise uses one presentation runtime contract for event and Narrative
content. A runtime is an object with:

- `unit` - the configured SIMILE timeline unit.
- `labeller` - the active band labeller, stored independently from the unit.
- `readEventTime(event)` - returns a canonical instant or range.
- `render(template, event, context)` - returns text, HTML, or a DOM fragment for
  one field.

`Timeline.RepriseRuntime` is the default implementation. It has no
`TimelineUtils` dependency.

## Default runtime

```js
var runtime = new Timeline.RepriseRuntime({
    unit: timeline.getUnit(),
    labeller: band.getLabeller()
});
```

The Reprise attachment methods create this binding automatically. Before the
timeline is created, the unit comes from the band's event source and an
explicit `bandInfo.labeller` is used directly. Otherwise the unit creates its
default labeller.

When constructing a runtime directly, omitting `labeller` asks the unit to
create the default labeller. The unit must provide `parseFromObject(value)` and
`compare(a, b)`. The labeller must provide `labelPrecise(value)` and
`labelInterval(value, intervalUnit)`.

Duration-aware units additionally provide `duration(start, end)`, which returns
a finite, non-negative number. Their labellers provide
`labelDuration(value)`. The duration methods are optional as a pair so custom
units without duration support continue to work.

## Canonical event time

`readEventTime(event)` returns one of:

```js
{ kind: "instant", value: canonicalValue }

{ kind: "range", start: canonicalStart, end: canonicalEnd }
```

Either result may also include canonical imprecision endpoints:

```js
{
    kind: "range",
    start: canonicalStart,
    latestStart: canonicalLatestStart,
    earliestEnd: canonicalEarliestEnd,
    end: canonicalEnd
}
```

Every input value is passed through `unit.parseFromObject()`. Validation and
range ordering use `unit.compare()`; the runtime does not use JavaScript
`Date` identity as generic validation. Reversed ranges are normalized according
to the unit's chronology. This supports native dates, Planning-style numbers
including zero, astronomical `HistoricalYear` values, and Geochrono-style
wrapper objects through the same path.

Supported event inputs are:

- Narrative `date` and `startDate`/`endDate` fields.
- SIMILE `getStart()`, `getEnd()`, and `isInstant()` event methods.
- Plain `start`/`end` event fields.
- Canonical `eventTime` values with `kind: "instant"`, `kind: "value"`, or
  `kind: "range"`.
- Optional `latestStart`/`earliestEnd` fields and
  `getLatestStart()`/`getEarliestEnd()` methods.

Attachments take every timeline value, including the optional imprecision
endpoints, from this canonical result. An injected reader is therefore
responsible for interpreting domain-specific values and projecting open or
otherwise non-native ranges into values accepted by its configured unit.
Attachments do not parse those source values a second time.

## Duration context

For a bounded range whose unit and labeller support duration, the render
context includes:

```js
{
    duration: {
        value: 35,
        text: "35 Ma"
    }
}
```

`value` comes from `unit.duration(start, end)`. `text` comes from
`labeller.labelDuration(value)`; Reprise does not derive it from `toString()`.

For an imprecise range, `duration` is the longest duration from `start` to
`end`, and `minimumDuration` is calculated from `latestStart` to
`earliestEnd`:

```js
{
    duration: { value: 12, text: "12 days" },
    minimumDuration: { value: 6, text: "6 days" }
}
```

Overlapping imprecision bounds have a minimum duration of zero. Exact ranges
have `duration` only. Instants, unresolved or open ranges, and units without
the duration capability have neither property.

## Rendering

The complete render context is:

```js
{
    field: "title",
    target: "text", // or "html"
    eventTime: runtime.readEventTime(event),
    eventTheme: resolvedEventTheme,
    displayProfile: resolvedDisplayProfile,
    unit: runtime.unit,
    labeller: runtime.labeller,
    duration: { value: 12, text: "12 days" }
}
```

Reprise resolves the field template from the selected
[`DisplayProfile`](timeline-reprise-display-profiles.md), using the render
surface and canonical event-time shape. A missing template delegates to the
default field renderer.

The default runtime interprets string templates through
`Timeline.TemplateRenderer`. Its built-in macros are `join()`, `joinUnique()`,
`wrap()`, `paren()`, `prefix()`, `suffix()`, and `lines()`. `lines()` emits a
newline for a text target and `<br>` for an HTML target.

Bare selectors read generic event fields. Reprise also supplies `eventTime`,
`start`, `latestStart`, `earliestEnd`, `end`, `duration`, and
`minimumDuration`. Timeline endpoints are formatted through the active
labeller. Durations use the unit-derived values in the render context.

Default event-time output remains late-bound to the active labeller: text
event-time labels use `labelInterval()` and precise HTML/bubble values use
`labelPrecise()`. The renderer uses `context.duration.text` for
`bubbleDuration` and
`context.minimumDuration.text` for `bubbleMinimumDuration`. Explicit event
`bubbleDuration`/`duration` and `bubbleMinimumDuration`/`minimumDuration`
values take precedence over those derived defaults.

## Selector extensions

Domain libraries extend selector interpretation without replacing Reprise's
rendering pipeline:

```js
var extension = {
    hasSelector: function (name) {
        return name === "zone";
    },
    hasFormat: function (formatName, selectorName) {
        return selectorName === "zone" && formatName === "fullFmt";
    },
    resolveSelector: function (name, formatName, event, context) {
        return domainFormatter.formatZone(event, formatName, context);
    }
};

var renderer = new Timeline.TemplateRenderer({
    selectorExtensions: [extension]
});
```

The first extension claiming a selector resolves it. A formatted selector must
be accepted by that extension during DisplayProfile validation. Reprise owns
the grammar and generic macros; the extension owns only its domain selectors
and named formats.

## Bubble structure

Reprise owns the bubble DOM for normal events and Narrative records. When an
image is present, the bubble begins with:

```html
<div class="timeline-event-bubble-image-container">
    <img class="timeline-event-bubble-image" src="...">
</div>
```

The wrapper is a full-width, non-floating block. The native SIMILE
`imageStyler()` still styles the `img`, while Reprise constrains that image to
the bubble content width, includes native image padding in its border-box
sizing, and preserves its aspect ratio. The remaining bubble sections follow
in this order: title, structured fields or byline, description, and tags.
Events without images do not receive an image container.

## Runtime injection and renderer replacement

Supply `readEventTime` when domain values must be interpreted and projected
into the configured timeline unit:

```js
var runtime = new Timeline.RepriseRuntime({
    unit: timeline.getUnit(),
    labeller: band.getLabeller(),
    readEventTime: function (event) {
        return domainAdapter.projectEventTime(event);
    }
});
```

The original presentation event remains available to selector extensions while
the canonical `context.eventTime` drives layout and generic unit rendering.

Supply `render` to replace only content rendering:

```js
var runtime = new Timeline.RepriseRuntime({
    unit: timeline.getUnit(),
    labeller: band.getLabeller(),
    render: function (template, event, context) {
        return myRenderer.render(template, event, context);
    }
});
```

The replacement receives the complete context above. Reprise still owns
Narrative label wrappers, bubble sections, tables, rows, cells, links, images,
and tag chips. The renderer supplies only the content inserted into each field
or cell.

Inject the runtime through either attachment method:

```js
Timeline.attachEvents(bandInfo, events, {
    runtime: runtime
});

Timeline.attachNarrativeDecorators(bandInfo, narrativeEvents, {
    runtime: runtime
});
```

Both attachment workflows use the same runtime binding and field preparation
path. Callers may still provide fields such as `bubbleStart`,
`bubbleDuration`, `bubbleLocation`, and `bubblePeople`; the renderer remains
responsible only for their content.

An injected renderer may use `context.duration.value` or
`context.duration.text`. Duration calculation remains in the unit/runtime
contract.

---
[Back to top](#presentation-runtime)<br>
[Back to main](TimelineReprise.md)
<!-- EOF -->
