# Event Layout

Event layout routing for Timeline Reprise.

The properties belong on the SIMILE theme object passed to each band. Event
layout and Narrative consume the same `theme.eventTheme` object. Properties
used only by Narrative remain in that object and are ignored by event layout;
see the [Narrative theme reference](timeline-reprise-narrative.md#theme).

```js
var theme = Timeline.ClassicTheme.create();

theme.eventTheme = {
    labels: true,
    bubbles: true,
    eventColorScope: "graphic",
    useEmphasis: false,
    emphasis: {
        critical: {
            labelColor: "red",
            tapeColor: "red",
            eventColorScope: "both"
        }
    },
    track: {
        horizontal: {
            offset: 12,
            gap: 5
        },
        vertical: {
            offset: 12,
            gap: 5
        }
    },
    instant: {
        width: 6
    },
    range: {
        width: 4,
        iconColor: "green",
        short: {
            toLabelGap: 3,
            minDisplayLength: 12
        },
        horizontal: {
            eventRoutingThreshold: 36,
            toLabelGap: 8,
            labelHorizontalGap: 8,
            labelTrackCount: 3,
            labelTrackHeight: 18,
            labelTrackGap: 5,
            tapeGap: 5,
            sparklineStagger: 8,
            stickyLeftInset: 4
        },
        vertical: {
            eventRoutingThreshold: 36,
            toLabelGap: 8,
            tapeGap: 5,
            labelWidth: 120,
            labelTrackCount: 3,
            labelTrackGap: 5,
            stickyTopInset: 4,
            stickyLabelGap: 5,
            toEventGap: 12
        }
    }
};
```

Then pass `theme` into the band:

```js
Timeline.createBandInfo({
    eventSource: eventSource,
    date: "Mar 1 2020",
    width: "80%",
    intervalUnit: Timeline.DateTime.MONTH,
    intervalPixels: 110,
    theme: theme
});
```

Create a fresh theme object for each timeline when a page shows horizontal and vertical timelines together.

## Event Display Controls

### `eventTheme.labels`
Set to `false` to hide event labels on the band.

### `eventTheme.bubbles`
Set to `false` to stop event bubble popups.

### `eventTheme.eventColorScope`
Controls whether an authored item `color` is applied to its label, graphic,
both, or neither. Event layout and Narrative use the same values and meaning.

Values:

- `none`
- `label`
- `graphic`
- `both`

Default: `graphic`.

Without active emphasis, explicit event colours such as `labelColor`, `textColor`, or `tapeColor` override this scope.

### `eventTheme.useEmphasis`
Set to `true` to allow events to reference reusable emphasis specs.

Default: `false`.

### `eventTheme.emphasis`
Map of named emphasis specs.

An emphasis spec is applied only when all three are true:

- `eventTheme.useEmphasis` is `true`
- the event has `emphasis: "key"`
- `eventTheme.emphasis.key` exists

When active, the emphasis spec overrides event-level style fields for the supported properties.

Supported emphasis properties:

- `labels`
- `bubbles`
- `eventColorScope`
- `color`
- `labelColor`
- `textColor`
- `tapeColor`

## `eventTheme.track`

Sets native SIMILE event track placement.

`track.horizontal` is used on horizontal timelines.
`track.vertical` is used on vertical timelines.
A flat `track` object is also accepted as a fallback.

### `eventTheme.track.*.offset`
Sets the outer offset before event content.

### `eventTheme.track.*.gap`
Sets the default gap used by event lanes and as fallback spacing for tapes and labels.

### `eventTheme.track.*.height`
Optional native SIMILE track height.

## `eventTheme.instant`

### `eventTheme.instant.width`
Sets the width of instant graphics. Event layout uses it for instant icons and
Narrative uses the same value for instant divider lines.

### `eventTheme.instant.height`
Optional instant icon height. Defaults to `width`.

### `eventTheme.instant.horizontal.labelGap`
Sets horizontal instant label gap from the icon.

### `eventTheme.instant.vertical.labelGap`
Sets vertical instant label gap from the icon.

## `eventTheme.range`

### `eventTheme.range.width`
Sets range tape thickness.

### `eventTheme.range.iconColor`
Sets the default range tape colour. Named colours are resolved through `Timeline.ThemeIcons` when available.

## `eventTheme.range.short`

Short ranges are duration events shorter than `eventRoutingThreshold`. They are handled with point-event layout rather than long-range tape-label routing.

### `eventTheme.range.short.minDisplayLength`
Minimum visible length for short duration tapes.

### `eventTheme.range.short.toLabelGap`
Extra gap between a short duration tape and its label on horizontal timelines.

## `eventTheme.range.horizontal`

### `eventTheme.range.horizontal.eventRoutingThreshold`
Duration length, in pixels, at which a range is treated as a long tape event.

### `eventTheme.range.horizontal.tapeGap`
Gap between long-range tape lanes.

### `eventTheme.range.horizontal.toLabelGap`
Gap from the tape block to the first routed label row.

### `eventTheme.range.horizontal.labelHorizontalGap`
Minimum horizontal gap between routed labels.

### `eventTheme.range.horizontal.labelTrackCount`
Initial number of routed label rows.

### `eventTheme.range.horizontal.labelTrackHeight`
Height of a routed label row.

### `eventTheme.range.horizontal.labelTrackGap`
Gap between routed label rows.

### `eventTheme.range.horizontal.sparklineStagger`
Horizontal stagger applied to tape-label sparklines.

### `eventTheme.range.horizontal.stickyLeftInset`
Inset used when range labels stick at the left or right viewport edge.

## `eventTheme.range.vertical`

### `eventTheme.range.vertical.eventRoutingThreshold`
Duration length, in pixels, at which a range is treated as a long tape event.

### `eventTheme.range.vertical.tapeGap`
Gap between long-range tape lanes.

### `eventTheme.range.vertical.toLabelGap`
Gap from the tape block to the vertical range-label column.

### `eventTheme.range.vertical.labelWidth`
Width of vertical event labels. If omitted, event layout derives a width from the band width.

### `eventTheme.range.vertical.labelTrackCount`
Initial number of point/short-duration event lanes. Extra lanes are added if the configured lanes are full.

### `eventTheme.range.vertical.labelTrackGap`
Fallback gap between stacked vertical range labels.

### `eventTheme.range.vertical.stickyTopInset`
Inset used when range labels stick at the top viewport edge.

### `eventTheme.range.vertical.stickyLabelGap`
Gap between stacked sticky range labels.

### `eventTheme.range.vertical.toEventGap`
Gap from the vertical range-label column to point/short-duration event lanes.

## Event Overrides

### `labels`
Set to `false` on one event to hide only that event label.

### `bubbles`
Set to `false` on one event to stop only that event bubble popup.

### `eventColorScope`
Overrides `eventTheme.eventColorScope` for one event.

### `emphasis`
References a named spec from `eventTheme.emphasis` when `eventTheme.useEmphasis` is `true`.

### `labelColor`
Sets one event label colour.

### `tapeColor`
Sets the tape and sparkline colour for one range event.

```js
{
    start: "2020-03-01",
    end: "2020-04-15",
    title: "Build phase",
    eventColorScope: "graphic",
    labelColor: "inherit",
    tapeColor: "red"
}
```

If `tapeColor` is not set, the event colour is used, then the theme range colour.

---
[Back to top](#event-layout)<br>
[Back to main](TimelineReprise.md)
<!-- EOF -->
