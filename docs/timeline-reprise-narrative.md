# Narrative

Adds narrative span and divider decorators to a timeline band.

Attach Narrative data to a Reprise band info before
`Timeline.createTimeline()`:

```js
Timeline.attachNarrativeDecorators(bandInfo, [
    {
        startDate: "2020-01-01",
        endDate: "2020-02-01",
        title: "Chapter 1"
    },
    {
        date: "2020-02-14",
        title: "Turning point"
    }
]);
```

## Data

The attachment workflow reads plain data objects. Narrative records are not
added to `bandInfo.eventSource`.

Narrative parses and renders through the
[presentation runtime](timeline-reprise-presentation-runtime.md). A
Reprise-created band retains the runtime selected during construction:

```js
var bandSet = Timeline.createBandSet({
    unit: Timeline.PlanningDayUnit,
    bands: [{
        id: "main",
        width: "100%",
        interval: 10,
        intervalPixels: 100
    }]
});

Timeline.attachNarrativeDecorators(
    bandSet.byId.main,
    narrativeEvents
);
```

An attachment-level runtime remains available as an explicit override.

All date, numeric, and wrapped values are parsed by
`runtime.unit.parseFromObject()`. Range chronology is normalized with
`runtime.unit.compare()`.

### Range Items

Range items create range graphic decorators.

```js
{
    startDate: "2020-01-01",
    endDate: "2020-02-01",
    title: "Chapter 1",
    caption: "Set the scene."
}
```

Required:

- `startDate`
- `endDate`

Optional:

- `title` - label text.
- `caption` - tooltip text and bubble fallback.
- `description` - bubble description.
- `track` - preferred label track.
- `trackExplicit` - set to `false` to let routing ignore a provided track.
- `labels` - set to `false` to hide only this label.
- `bubbles` - set to `false` to disable only this bubble popup.
- `eventColorScope` - overrides the theme colour scope for this item.
- `emphasis` - references a named emphasis spec.
- `color` - item colour used according to `eventColorScope`.
- `labelColor` - label colour.
- `spanColor` - span colour.
- `cssClass` - extra class on the span element.
- `labelCssClass` - extra class on the label element.

### Instant Items

Instant items create divider-line decorators.

```js
{
    date: "2020-02-14",
    title: "Turning point",
    caption: "The narrative changes direction."
}
```

Required:

- `date`

Optional:

- `title` - label text.
- `caption` - tooltip text and bubble fallback.
- `description` - bubble description.
- `track` - preferred label track.
- `trackExplicit` - set to `false` to let routing ignore a provided track.
- `labels` - set to `false` to hide only this label.
- `bubbles` - set to `false` to disable only this bubble popup.
- `eventColorScope` - overrides the theme colour scope for this item.
- `emphasis` - references a named emphasis spec.
- `color` - item colour used according to `eventColorScope`.
- `labelColor` - label colour.
- `lineColor` - divider-line colour.
- `lineWidth` - divider-line width.
- `cssClass` - extra class on the divider-line element.
- `labelCssClass` - extra class on the label element.

## Theme

Narrative and event layout consume the same resolved
[`Timeline.VisualTheme`](timeline-reprise-visual-theme.md). Load emphasis styles
and VisualThemes through the Reprise registries, then select them in the band
spec:

```js
var emphasisSpecs = Timeline.loadEmphasisStyles([
    {
        id: "lifeEvent",
        labelColor: "purple",
        lineColor: "purple"
    }
]);

var visualThemes = Timeline.loadVisualThemes([{
    id: "narrative",
    spans: true,
    dividers: true,
    labels: true,
    bubbles: false,
    tooltips: true,
    eventColorScope: "both",
    track: {
        horizontal: {
            count: 2,
            offset: 12,
            size: 22,
            gap: 4
        },
        vertical: {
            count: 2,
            offset: 10,
            size: 104,
            gap: 6
        }
    },
    range: {
        offset: 0,
        graphic: "span",
        lineWidth: 2,
        colors: ["green", "blue"]
    },
    instant: {
        lineWidth: 2,
        iconColor: "purple"
    },
    label: {
        colorSource: "graphic",
        rangeCssClass: "range-label",
        instantCssClass: "instant-label",
        horizontal: {
            offset: 2,
            stickyInset: 6,
            toRangeGap: 4,
            toInstantGap: 4,
            routingGap: 4
        },
        vertical: {
            offset: 2,
            stickyInset: 6,
            toRangeGap: 4,
            toInstantGap: 4,
            width: 120,
            routingGap: 4
        }
    },
    bubble: {
        width: 300,
        maxHeight: null
    },
    layer: {
        zIndex: 5,
        dividerZIndex: 101,
        labelZIndex: 114
    }
}]);

var bandSet = Timeline.createBandSet({
    visualTheme: "narrative",
    emphasisSpecs: emphasisSpecs,
    bands: [{
        id: "main",
        width: "100%",
        intervalUnit: "month",
        intervalPixels: 100
    }]
});
```

### `visualTheme.spans`
Set to `false` to stop range graphic decorators being drawn.

### `visualTheme.dividers`
Set to `false` to stop instant divider decorators being drawn.

`spans` and `dividers` are painter/theme controls only. Item-level fields with those names are ignored.

### `visualTheme.labels`
Set to `false` to hide narrative labels.

### `visualTheme.bubbles`
Set to `false` to stop narrative bubble popups.

### `visualTheme.tooltips`
Set to `false` to suppress caption tooltips on narrative labels. Defaults to
`true`. An enabled tooltip makes its label pointer-interactive even when
bubbles are disabled, but only bubbles use the pointer cursor and click
handler.

### `visualTheme.eventColorScope`
Controls which item-supplied colours may affect rendering.

Values:

- `none` - ignore all item-supplied graphic and label colours
- `label` - allow `labelColor`, its `textColor` alias, and `color` on labels
- `graphic` - allow `spanColor`, `lineColor`, and `color` on graphics
- `both` - allow item-supplied colours on both channels

Default: `graphic`.

Named emphasis colours remain above this gate unless emphasis is disabled.

### `visualTheme.disableEmphasis`
Set to `true` to ignore named emphasis styles on this decorator.

Default: `false`.

### `emphasisSpecs`
Registry of `Timeline.EmphasisStyle` objects, normally produced by
`Timeline.loadEmphasisStyles()` and supplied as a Reprise band option. It is
not a Narrative decorator option.

An emphasis spec is applied only when all three are true:

- `visualTheme.disableEmphasis` is not `true`
- the range or instant has `emphasis: "key"`
- `emphasisSpecs.key` exists

When active, each defined emphasis property overrides the corresponding item
and theme result. Undefined emphasis properties leave the lower-level result
unchanged. An emphasis `color` applies to both the graphic and label and is not
limited by `eventColorScope`.

Supported emphasis properties:

- `labels`
- `bubbles`
- `color`
- `labelColor`
- `spanColor`
- `lineColor`
- `lineWidth`

## Track Theme

`visualTheme.track.horizontal` is used on horizontal timelines.
`visualTheme.track.vertical` is used on vertical timelines.

### `track.count`
Initial number of label tracks. Extra tracks can be used if routed labels need more space.

### `track.offset`
Outer offset before the first narrative track.

### `track.size`
Track size across the band. On horizontal timelines this is the label row height.
On vertical timelines this is the physical label column width. With
`label.flow: "orthogonal"`, it remains the physical left-to-right lane width;
use `visualTheme.label.vertical.width` to cap the rotated up/down label length.

If omitted, a fixed intrinsic default is used instead of being derived from the band's rendered size: `18` on horizontal timelines, `120` on vertical timelines.

### `track.gap`
Gap between narrative label rows on horizontal timelines or label columns on vertical timelines.

### `track.endPadding`
Trailing padding reserved from the far edge of the band's cross-axis. Only used to anchor `align: "end"` tracks on vertical timelines. Defaults to `track.offset`.

### `track.align`
Vertical-only track alignment. Use `start` or `end`.

## Range Theme

### `visualTheme.range.offset`
Cross-band offset for range graphics.

### `visualTheme.range.size`
Optional cross-band size for range graphics. If omitted, graphics fill the
available narrative band space from `range.offset`.

### `visualTheme.range.colors`
Array of fallback range graphic colours, cycled by range index.

### `visualTheme.range.graphic`
Selects the built-in graphic drawn for Narrative ranges while keeping range
label behavior:

- `span` - draw the current filled range span. This is the default.
- `start` - draw only a divider at the range start.
- `end` - draw only a divider at the range end.
- `both` - draw dividers at both range boundaries.
- `none` - draw no built-in range graphic.

The boundary dividers use the same resolved range graphic colour as a span,
including `spanColor`, `color`, tags, and emphasis according to
`eventColorScope`. Labels still render when `graphic: "none"` is selected.
`spans: false` suppresses all Narrative range graphics, including boundary
dividers.

### `visualTheme.range.lineWidth`
Width of range boundary divider lines when `range.graphic` is `start`, `end`,
or `both`. Defaults to `1`.

### `visualTheme.range.cssClass`
Extra class added to range graphic elements.

## Instant Theme

### `visualTheme.instant.lineWidth`
Width of narrative instant divider lines. Defaults to `1`.

Item-level `lineWidth` overrides this value for a single instant.

### `visualTheme.instant.iconColor`
Default colour of instant graphics. Event layout uses it for event dots;
narrative decorators use it for instant divider lines.

### `visualTheme.instant.cssClass`
Extra class added to instant divider-line elements.

## Label Theme

### `visualTheme.label.colorSource`
Controls the fallback used when neither emphasis nor the item supplies a label
colour and a scoped item `color` does not apply to the label.

- `graphic` (default) derives a legible range-label tint from the final span
  colour; instant labels use the final divider colour directly.
- `theme` uses `visualTheme.label.color`.
- `inherit` sets no inline colour, allowing normal CSS inheritance.

### `visualTheme.label.color`
Theme label colour used when `colorSource` is `theme`.

### `visualTheme.label.rangeCssClass`
Extra class added to range label elements.

### `visualTheme.label.instantCssClass`
Extra class added to instant label elements.

### `visualTheme.label.*.offset`
Offset applied along the timeline axis when placing labels.

### `visualTheme.label.*.rangeAlign`
Time-axis alignment for range labels. `start` is the default and preserves the
range-start placement. `center` prefers the range midpoint using the rendered
label length, including orthogonal labels and labels longer than their range.
For either alignment, a fully visible label slides or stacks only until its
trailing edge reaches the range end, then tries another configured track. A
finishing label at the viewport edge keeps contact-based routing. Labels hide
when no configured track remains. Instant labels are unaffected.

### `visualTheme.label.horizontal.toRangeGap`
Horizontal inset between a range start edge and a `start`-aligned label.
Defaults to `4`.

### `visualTheme.label.vertical.toRangeGap`
Vertical inset between a range start edge and a `start`-aligned label. Defaults
to `4`.

### `visualTheme.label.horizontal.toInstantGap`
Horizontal gap between an instant divider line and its label. Defaults to `4`.

### `visualTheme.label.vertical.toInstantGap`
Vertical gap between an instant divider line and its label. Defaults to `4`.

### `visualTheme.label.vertical.width`
Optional pre-rotation inline width cap for vertical orthogonal labels. Routing
uses the measured rendered text length up to this cap, independently from
`track.vertical.size`, so `track.vertical.size` can stay a physical lane width.
If omitted, Narrative uses the rendered text length.

### `visualTheme.label.*.stickyInset`
Inset from the visible viewport edge used by sticky range labels.
It also contributes to the span-contact release threshold. The effective
threshold is `12px + stickyInset` horizontally and `6px + stickyInset`
vertically.

### `visualTheme.label.*.routingGap`
Minimum gap used between routed labels.

## Bubble Theme

### `visualTheme.bubble.width`
Bubble popup width.

### `visualTheme.bubble.maxHeight`
Optional maximum bubble popup height.

## Layer Theme

### `visualTheme.layer.zIndex`
Z-index for range graphics. Defaults to `5`, below date/unit and cardinal-axis
markers.

### `visualTheme.layer.dividerZIndex`
Z-index for instant divider lines. Defaults to `101`.

### `visualTheme.layer.labelZIndex`
Z-index for narrative labels. Defaults to `114`.

By default, Narrative instant divider lines render on a separate layer at
z-index `101`, above date/unit and cardinal-axis ticks at `100` and below their
labels at `102`. Narrative range graphics remain below that marker content. Narrative
labels default to z-index `114`, above marker labels but below normal event
content. Each of the range graphic, divider, and Narrative label values is independent;
changing `zIndex` does not change `dividerZIndex`. The normal event layer passes
pointer input through its empty area, so Narrative labels remain interactive
while tapes, icons, and event labels retain precedence where they overlap.

## Routing

Horizontal range labels slide along their span at the viewport edges and hide when the remaining span contact reaches the effective `12px + stickyInset` threshold. Colliding range labels keep the existing horizontal slide-and-track routing. Instant labels do not slide, but can route to another label track to avoid collisions.

Vertical range labels without an item-level `track` begin in column zero, even when the theme provides several routing columns. A label stops at the viewport edge; later labels continue scrolling until they meet it, then remain stacked below it. A departing label uses the same `6px + stickyInset` contact threshold, so a 6px edge inset produces an effective 12px release threshold. When it drops away, the next label retains its pushed position and resumes scrolling naturally instead of jumping to the viewport edge. When scrolling back, that retained offset is released: the label again favours the top of its span and returns to its base column when it fits there.

Routing uses each label's complete rendered height, including wrapped multiline text. A label moves to another column only when the same-column stack would extend beyond the end of its own range; the complete rerouted label must still fit within that range. Instant labels can route to another label column when their label box would collide with a span label.

## CSS Hooks

Base classes:

- `timeline-narrative-span`
- `timeline-narrative-range-divider`
- `timeline-narrative-range-start-divider`
- `timeline-narrative-range-end-divider`
- `timeline-narrative-label`
- `timeline-narrative-range-label`
- `timeline-narrative-instant-line`
- `timeline-narrative-instant-label`

Set `visualTheme.id` to add generated theme classes:

- `timeline-narrative-{id}-span`
- `timeline-narrative-{id}-range-divider`
- `timeline-narrative-{id}-label`
- `timeline-narrative-{id}-range-label`
- `timeline-narrative-{id}-instant-line`
- `timeline-narrative-{id}-instant-label`

Use item-level `cssClass` and `labelCssClass` for per-item styling.

## Item Overrides

### `labels`
Set to `false` on one range or instant to hide only that label.

### `bubbles`
Set to `false` on one range or instant to stop only that bubble popup.

### `eventColorScope`
Overrides `visualTheme.eventColorScope` for one range or instant.

### `emphasis`
References a named spec from the band theme's `emphasisSpecs` registry. It
applies unless `visualTheme.disableEmphasis` is `true`.

### `labelColor`
Preferred Reprise field for one narrative label colour. It applies only when
`eventColorScope` includes `label`. Native `textColor` remains a compatibility
alias; `labelColor` wins when both are present.

### `spanColor`
Sets one range graphic colour when `eventColorScope` includes `graphic`.

### `lineColor`
Sets one instant divider colour when `eventColorScope` includes `graphic`.

---
[Back to top](#narrative)<br>
[Back to main](TimelineReprise.md)
<!-- EOF -->
