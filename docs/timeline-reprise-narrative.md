# Narrative

Adds narrative span and divider decorators to a timeline band.

Attach a decorator to a band:

```js
bandInfo.decorators = [
    new Timeline.NarrativeDecorator({
        ranges: [
            {
                startDate: "2020-01-01",
                endDate: "2020-02-01",
                title: "Chapter 1"
            }
        ],
        instants: [
            {
                date: "2020-02-14",
                title: "Turning point"
            }
        ]
    })
];
```

## Data

The decorator reads plain data objects. It does not require a `Timeline.DefaultEventSource`.

### Range Items

Range items create span decorators.

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

Narrative and event-layout options belong to the same `eventTheme` object on the
band theme. Each feature reads the shared properties and the feature-specific
properties it understands, ignoring the rest:

```js
theme.emphasisSpecs = Timeline.loadEmphasisStyles([
    {
        id: "lifeEvent",
        labelColor: "purple",
        lineColor: "purple"
    }
]);

theme.eventTheme = {
    spans: true,
    dividers: true,
    labels: true,
    bubbles: false,
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
        colors: ["green", "blue"]
    },
    instant: {
        width: 2,
        colors: ["purple"]
    },
    label: {
        colorSource: "graphic",
        offset: 2,
        stickyInset: 6,
        stickyGap: 4
    },
    bubble: {
        enabled: true,
        width: 300,
        maxHeight: null
    },
    layer: {
        zIndex: 113,
        labelZIndex: 116
    }
};
```

### `eventTheme.spans`
Set to `false` to stop range span decorators being drawn.

### `eventTheme.dividers`
Set to `false` to stop instant divider decorators being drawn.

`spans` and `dividers` are painter/theme controls only. Item-level fields with those names are ignored.

### `eventTheme.labels`
Set to `false` to hide narrative labels.

### `eventTheme.bubbles`
Set to `false` to stop narrative bubble popups.

`eventTheme.bubble.enabled` can also enable or disable bubbles.

### `eventTheme.eventColorScope`
Controls where an item `color` is applied.

Values:

- `none`
- `label`
- `graphic`
- `both`

Default: `both`.

Without an emphasis override, explicit item colours such as `labelColor`,
`spanColor`, or `lineColor` override this scope.

### `eventTheme.disableEmphasis`
Set to `true` to ignore named emphasis styles on this decorator.

Default: `false`.

### `theme.emphasisSpecs`
Registry of `Timeline.EmphasisStyle` objects, normally produced by
`Timeline.loadEmphasisStyles()`. It is separate from `eventTheme` and can also
be supplied directly as the decorator's `emphasisSpecs` option.

An emphasis spec is applied only when all three are true:

- `eventTheme.disableEmphasis` is not `true`
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

`eventTheme.track.horizontal` is used on horizontal timelines.
`eventTheme.track.vertical` is used on vertical timelines.

### `track.count`
Initial number of label tracks. Extra tracks can be used if routed labels need more space.

### `track.offset`
Outer offset before the first narrative track.

### `track.size`
Track size across the band. On horizontal timelines this is the label row height. On vertical timelines this is the label column width, and labels wrap to fit it.

If omitted, a fixed intrinsic default is used instead of being derived from the band's rendered size: `18` on horizontal timelines, `120` on vertical timelines.

### `track.gap`
Gap between narrative label rows on horizontal timelines or label columns on vertical timelines.

### `track.endPadding`
Trailing padding reserved from the far edge of the band's cross-axis. Only used to anchor `align: "end"` tracks on vertical timelines. Defaults to `track.offset`.

### `track.align`
Vertical-only track alignment. Use `start` or `end`.

## Range Theme

### `eventTheme.range.offset`
Cross-band offset for range spans.

### `eventTheme.range.size`
Optional cross-band size for range spans. If omitted, spans fill the available narrative band space from `range.offset`.

### `eventTheme.range.colors`
Array of fallback span colours, cycled by range index.

### `eventTheme.range.cssClass`
Extra class added to range span elements.

### `eventTheme.range.labelCssClass`
Extra class added to range label elements.

## Instant Theme

### `eventTheme.instant.width`
Width of instant graphics. Narrative uses it as the divider-line width; event
layout uses the same value as the instant icon width.

### `eventTheme.instant.colors`
Array of fallback divider colours, cycled by instant index.

### `eventTheme.instant.cssClass`
Extra class added to instant divider-line elements.

### `eventTheme.instant.labelCssClass`
Extra class added to instant label elements.

## Label Theme

### `eventTheme.label.colorSource`
Controls the fallback used when neither emphasis nor the item supplies a label
colour and a scoped item `color` does not apply to the label.

- `graphic` (default) derives a legible range-label tint from the final span
  colour; instant labels use the final divider colour directly.
- `theme` uses `eventTheme.label.color`.
- `inherit` sets no inline colour, allowing normal CSS inheritance.

### `eventTheme.label.color`
Theme label colour used when `colorSource` is `theme`.

### `eventTheme.label.offset`
Offset applied along the timeline axis when placing labels.

### `eventTheme.label.stickyInset`
Inset from the visible viewport edge used by sticky range labels.
It also contributes to the span-contact release threshold. The effective
threshold is `12px + stickyInset` horizontally and `6px + stickyInset`
vertically.

### `eventTheme.label.stickyGap`
Minimum gap used between routed labels.

## Bubble Theme

### `eventTheme.bubble.enabled`
Enables or disables narrative bubble popups.

### `eventTheme.bubble.width`
Bubble popup width.

### `eventTheme.bubble.maxHeight`
Optional maximum bubble popup height.

## Layer Theme

### `eventTheme.layer.zIndex`
Z-index for span and divider graphics.

### `eventTheme.layer.labelZIndex`
Z-index for narrative labels.

## Routing

Horizontal range labels slide along their span at the viewport edges and hide when the remaining span contact reaches the effective `12px + stickyInset` threshold. Colliding range labels keep the existing horizontal slide-and-track routing. Instant labels do not slide, but can route to another label track to avoid collisions.

Vertical range labels without an item-level `track` begin in column zero, even when the theme provides several routing columns. A label stops at the viewport edge; later labels continue scrolling until they meet it, then remain stacked below it. A departing label uses the same `6px + stickyInset` contact threshold, so a 6px edge inset produces an effective 12px release threshold. When it drops away, the next label retains its pushed position and resumes scrolling naturally instead of jumping to the viewport edge. When scrolling back, that retained offset is released: the label again favours the top of its span and returns to its base column when it fits there.

Routing uses each label's complete rendered height, including wrapped multiline text. A label moves to another column only when the same-column stack would extend beyond the end of its own range; the complete rerouted label must still fit within that range. Instant labels can route to another label column when their label box would collide with a span label.

## CSS Hooks

Base classes:

- `timeline-narrative-span`
- `timeline-narrative-label`
- `timeline-narrative-range-label`
- `timeline-narrative-instant-line`
- `timeline-narrative-instant-label`

Set `eventTheme.id` to add generated theme classes:

- `timeline-narrative-{id}-span`
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
Overrides `eventTheme.eventColorScope` for one range or instant.

### `emphasis`
References a named spec from the decorator or band theme's `emphasisSpecs`
registry. It applies unless `eventTheme.disableEmphasis` is `true`.

### `labelColor`
Sets one narrative label colour.

### `spanColor`
Sets one range span colour.

### `lineColor`
Sets one instant divider colour.

---
[Back to top](#narrative)<br>
[Back to main](TimelineReprise.md)
<!-- EOF -->
