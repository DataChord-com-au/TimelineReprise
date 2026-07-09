# Event Layout

## `timeline-reprise-event-layout`

Event layout routing for Timeline Reprise.

Load after the original SIMILE Timeline scripts and `timeline-reprise-core`.

The properties belong on the SIMILE theme object passed to each band:

```js
var theme = Timeline.ClassicTheme.create();

theme.eventTheme = {
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
Sets instant icon width.

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
Width of vertical event labels. If omitted, the module derives a width from the band width.

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

### `tapeColor`
Sets the tape and sparkline colour for one range event.

```js
{
    start: "2020-03-01",
    end: "2020-04-15",
    title: "Build phase",
    tapeColor: "red"
}
```

If `tapeColor` is not set, the event colour is used, then the theme range colour.

---
[Back to top](#event-layout)<br>
[Back to main](TimelineReprise.md)
<!-- EOF -->
