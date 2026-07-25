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

Normal Reprise consumers create this binding automatically. The timeline unit
comes from `timeline.getUnit()` and the labeller comes from
`band.getLabeller()`. An explicit band labeller is used directly; it is not
replaced by `unit.createLabeller()`.

When constructing a runtime directly, omitting `labeller` asks the unit to
create the default labeller. The unit must provide `parseFromObject(value)` and
`compare(a, b)`. The labeller must provide `labelPrecise(value)` and
`labelInterval(value, intervalUnit)`.

## Canonical event time

`readEventTime(event)` returns one of:

```js
{ kind: "instant", value: canonicalValue }

{ kind: "range", start: canonicalStart, end: canonicalEnd }
```

Every input value is passed through `unit.parseFromObject()`. Validation and
range ordering use `unit.compare()`; the runtime does not use JavaScript
`Date` identity as generic validation. Reversed ranges are normalized according
to the unit's chronology. This supports native dates, Planning-style numbers
including zero, and Geochrono-style wrapper objects through the same path.

Supported event inputs are:

- Narrative `date` and `startDate`/`endDate` fields.
- SIMILE `getStart()`, `getEnd()`, and `isInstant()` event methods.
- Plain `start`/`end` event fields.
- Canonical `eventTime` values with `kind: "instant"`, `kind: "value"`, or
  `kind: "range"`.

## Rendering

The complete render context is:

```js
{
    field: "title",
    target: "text", // or "html"
    eventTime: runtime.readEventTime(event),
    eventTheme: resolvedEventTheme,
    unit: runtime.unit,
    labeller: runtime.labeller
}
```

Reprise resolves a field template from `eventTheme.presentation[field]`.
`{ template: value }` selects that value. `{ templateId: id }` selects
`eventTheme.templates[id]`.

The default renderer returns the template value directly, or the corresponding
event field when there is no template. Default event-time output is late-bound
to the active labeller: text event-time labels use `labelInterval()` and
precise HTML/bubble values use `labelPrecise()`.

The default renderer does not parse template expressions and does not implement
`TimelineUtils` formatters or macros such as `join()` and `lines()`.

## Renderer replacement

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

Use the runtime in painter or Narrative configuration:

```js
eventPainterParams: {
    runtime: runtime
}

new Timeline.NarrativeDecorator({
    runtime: runtime,
    ranges: ranges,
    instants: instants
});
```

Event attachment and projection methods are outside this runtime. Callers may
continue to place already-rendered values such as `bubbleStart`,
`bubbleDuration`, `bubbleLocation`, and `bubblePeople` on their event data.

---
[Back to top](#presentation-runtime)<br>
[Back to main](TimelineReprise.md)
<!-- EOF -->
