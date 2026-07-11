# Narrative

## `timeline-reprise-narrative`

Adds narrative span and divider decorators to a timeline band.

Load through `timeline-reprise.js`, then attach a decorator to a band:

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
    caption: "Set the scene.",
    track: 0
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
- `labelColor` or `textColor` - label colour.
- `spanColor` - span colour.
- `cssClass` - extra class on the span element.
- `labelCssClass` - extra class on the label element.

`narrativeTrack` and `timelineNarrativeTrack` are accepted as aliases for `track` when sharing data with other layers.

### Instant Items

Instant items create divider-line decorators.

```js
{
    date: "2020-02-14",
    title: "Turning point",
    caption: "The narrative changes direction.",
    track: 1
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
- `labelColor` or `textColor` - label colour.
- `lineColor` - divider-line colour.
- `lineWidth` - divider-line width.
- `cssClass` - extra class on the divider-line element.
- `labelCssClass` - extra class on the label element.

`narrativeTrack` and `timelineNarrativeTrack` are accepted as aliases for `track` when sharing data with other layers.

## Theme

Narrative options belong on the band theme:

```js
theme.narrativeTheme = {
    spans: true,
    dividers: true,
    labels: true,
    bubbles: false,
    eventColorScope: "both",
    useEmphasis: false,
    emphasis: {
        lifeEvent: {
            labelColor: "purple",
            lineColor: "purple",
            eventColorScope: "both"
        }
    },
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
            size: 52,
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
        offset: 2,
        width: 104,
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

### `narrativeTheme.spans`
Set to `false` to stop range span decorators being drawn.

### `narrativeTheme.dividers`
Set to `false` to stop instant divider decorators being drawn.

`spans` and `dividers` are painter/theme controls only. Item-level fields with those names are ignored.

### `narrativeTheme.labels`
Set to `false` to hide narrative labels.

### `narrativeTheme.bubbles`
Set to `false` to stop narrative bubble popups.

`narrativeTheme.bubble.enabled` can also enable or disable bubbles.

### `narrativeTheme.eventColorScope`
Controls where an item `color` is applied.

Values:

- `none`
- `label`
- `graphic`
- `both`

Default: `both`.

Without active emphasis, explicit item colours such as `labelColor`, `spanColor`, or `lineColor` override this scope.

### `narrativeTheme.useEmphasis`
Set to `true` to allow narrative items to reference reusable emphasis specs.

Default: `false`.

### `narrativeTheme.emphasis`
Map of named emphasis specs.

An emphasis spec is applied only when all three are true:

- `narrativeTheme.useEmphasis` is `true`
- the range or instant has `emphasis: "key"`
- `narrativeTheme.emphasis.key` exists

When active, the emphasis spec overrides item-level style fields for the supported properties.

Supported emphasis properties:

- `labels`
- `bubbles`
- `eventColorScope`
- `color`
- `labelColor`
- `textColor`
- `spanColor`
- `lineColor`

## Track Theme

`narrativeTheme.track.horizontal` is used on horizontal timelines.
`narrativeTheme.track.vertical` is used on vertical timelines.

### `track.count`
Initial number of label tracks. Extra tracks can be used if routed labels need more space.

### `track.offset`
Outer offset before the first narrative track.

### `track.size`
Track size across the band. On horizontal timelines this is the label row height. On vertical timelines this is the minimum label column width.

### `track.gap`
Gap between narrative tracks.

### `track.endPadding`
Optional trailing padding used when deriving `track.size`.

### `track.align`
Vertical-only track alignment. Use `start` or `end`.

## Range Theme

### `narrativeTheme.range.offset`
Cross-band offset for range spans.

### `narrativeTheme.range.size`
Optional cross-band size for range spans. If omitted, spans fill the available narrative band space from `range.offset`.

### `narrativeTheme.range.colors`
Array of fallback span colours, cycled by range index.

### `narrativeTheme.range.cssClass`
Extra class added to range span elements.

### `narrativeTheme.range.labelCssClass`
Extra class added to range label elements.

## Instant Theme

### `narrativeTheme.instant.width`
Divider-line width.

### `narrativeTheme.instant.colors`
Array of fallback divider colours, cycled by instant index.

### `narrativeTheme.instant.cssClass`
Extra class added to instant divider-line elements.

### `narrativeTheme.instant.labelCssClass`
Extra class added to instant label elements.

## Label Theme

### `narrativeTheme.label.offset`
Offset applied along the timeline axis when placing labels.

### `narrativeTheme.label.width`
Optional fixed width for vertical narrative labels.

When set, labels wrap to that width. Vertical label columns are spaced with `max(track.size, label.width)`, so columns line up with the actual label boxes.

If omitted, labels use their natural width.

### `narrativeTheme.label.stickyInset`
Inset from the visible viewport edge used by sticky range labels.

### `narrativeTheme.label.stickyGap`
Minimum gap used between routed labels.

## Bubble Theme

### `narrativeTheme.bubble.enabled`
Enables or disables narrative bubble popups.

### `narrativeTheme.bubble.width`
Bubble popup width.

### `narrativeTheme.bubble.maxHeight`
Optional maximum bubble popup height.

## Layer Theme

### `narrativeTheme.layer.zIndex`
Z-index for span and divider graphics.

### `narrativeTheme.layer.labelZIndex`
Z-index for narrative labels.

## Routing

Horizontal range labels slide along their span at the viewport edges and hide once the label loses contact with the span. Instant labels do not slide, but can route to another label track to avoid collisions.

Vertical range labels stack down the time axis. Instant labels can route to another label column when their label box would collide with a span label.

## CSS Hooks

Base classes:

- `timeline-narrative-span`
- `timeline-narrative-label`
- `timeline-narrative-range-label`
- `timeline-narrative-instant-line`
- `timeline-narrative-instant-label`

Set `narrativeTheme.id` to add generated theme classes:

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
Overrides `narrativeTheme.eventColorScope` for one range or instant.

### `emphasis`
References a named spec from `narrativeTheme.emphasis` when `narrativeTheme.useEmphasis` is `true`.

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
