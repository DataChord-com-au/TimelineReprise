# Event Layout

Event layout routing for Timeline Reprise. Unless stated otherwise, dimensions
are CSS pixels.

The properties belong on the SIMILE theme object passed to each band. Event
layout and Narrative consume the same `theme.eventTheme` object. Properties
used only by Narrative remain in that object and are ignored by event layout;
see the [Narrative theme reference](timeline-reprise-narrative.md#theme).
The reference below lists the `eventTheme` properties consumed by event
layout; unlisted fields do not configure this painter.

```js
var theme = Timeline.ClassicTheme.create();
var emphasisSpecs = Timeline.loadEmphasisStyles([
    {
        id: "critical",
        labelColor: "red",
        iconColor: "red"
    }
]);

theme.emphasisSpecs = emphasisSpecs;
theme.eventTheme = {
    labels: true,
    bubbles: true,
    bubble: {
        enabled: true,
        width: 320,
        maxHeight: null
    },
    eventColorScope: "graphic",
    track: {
        horizontal: {
            offset: 12
        },
        vertical: {
            offset: 12
        }
    },
    instant: {
        width: 6,
        iconColor: "orange",
        horizontal: {
            toLabelGap: 4
        },
        vertical: {
            toLabelGap: 4
        }
    },
    range: {
        width: 4,
        iconColor: "green",
        short: {
            minDisplayLength: 12
        },
        horizontal: {
            eventRoutingThreshold: 36,
            toLabelGap: 4,
            labelRoutingGap: 8,
            labelTrackGap: 5,
            tapeGap: 5,
            sparklineStagger: 8,
            stickyLeftInset: 4
        },
        vertical: {
            eventRoutingThreshold: 36,
            toLabelGap: 4,
            tapeGap: 5,
            labelWidth: 120,
            labelRoutingGap: 4,
            labelTrackGap: 5,
            stickyTopInset: 4,
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

Orientation-specific properties are read from `horizontal` or `vertical` when
the painter is initialised. A flat object is accepted as a fallback only when
that object has no orientation branches.

## Event Display Controls

### `eventTheme.labels`
Set to `false` to hide event labels on the band. Defaults to `true`.

### `eventTheme.bubbles`
Set to `false` to stop event bubble popups. Defaults to `true`.
`eventTheme.bubble.enabled` is accepted when `bubbles` is not set.

### `eventTheme.bubble.width`
Sets the event bubble width. Event layout maps it to SIMILE's native bubble
theme; the native default is `250`. Narrative consumes the same property.

### `eventTheme.bubble.maxHeight`
Sets the optional maximum event bubble height. `null` means no maximum. Event
layout maps it to SIMILE's native bubble theme, and Narrative consumes the same
property.

### `eventTheme.eventColorScope`
Controls whether an authored item `color` is applied to its label, graphic,
both, or neither. Event layout and Narrative use the same values and meaning.

Values:

- `none`
- `label`
- `graphic`
- `both`

Event-layout default: `graphic`.

Without an emphasis override, explicit event colours such as `iconColor`,
`labelColor`, `textColor`, or `tapeColor` override this scope.

### `eventTheme.disableEmphasis`
Set to `true` to ignore named emphasis styles on this band.

Default: `false`.

### `theme.emphasisSpecs`
Registry of `Timeline.EmphasisStyle` objects, normally produced by
`Timeline.loadEmphasisStyles()`. This registry is separate from
`theme.eventTheme`; the event theme only controls whether the registry is
disabled for the band.

An emphasis spec is applied only when all three are true:

- `eventTheme.disableEmphasis` is not `true`
- the event has `emphasis: "key"`
- `theme.emphasisSpecs.key` exists

When active, each defined emphasis property overrides the corresponding event
and theme result. Undefined emphasis properties leave the lower-level result
unchanged. An emphasis `color` applies to both the graphic and label and is not
limited by `eventColorScope`.

Supported emphasis properties:

- `labels`
- `bubbles`
- `color`
- `iconColor`
- `labelColor`

`iconColor` is the emphasis graphic-colour override for both instant dots and
range tapes/sparklines. The older emphasis-only `tapeColor` name is not used.

## `eventTheme.track`

Sets native SIMILE event track placement.

`track.horizontal` is used on horizontal timelines.
`track.vertical` is used on vertical timelines.
A flat `track` object is also accepted as a fallback.

### `eventTheme.track.*.offset`
Sets the cross-axis offset before event content. Defaults to `2`.

### `eventTheme.track.horizontal.gap`
Currently has no meaningful visual effect in the Reprise horizontal event
layout and should normally be omitted. Use the targeted `range.horizontal`
spacing properties instead.

### `eventTheme.track.vertical.gap`
Currently has no meaningful visual effect in the Reprise vertical event
layout and should normally be omitted. Use `range.vertical.labelTrackGap` for
side-column spacing and `range.vertical.tapeGap` for tape-lane spacing.

### `eventTheme.track.*.height`
Sets the requested native track size. In a horizontal layout, the effective row
height is the largest of this value, the instant icon height, the range
thickness plus the rendered label line height, and the actual routed content.
In a vertical Reprise layout, routed column width and spacing come from the
rendered content and targeted `range.vertical` properties.

## `eventTheme.instant`

### `eventTheme.instant.width`
Sets the width of instant graphics. Event layout uses it for instant icons and
Narrative uses the same value for instant divider lines. Event layout defaults
to `9` when a Reprise `eventTheme` is applied.

### `eventTheme.instant.height`
Instant icon height. Defaults to `width`, or `9` when neither dimension is set.

### `eventTheme.instant.iconColor`
Sets the default instant-dot colour. If omitted, event layout uses the timeline
default blue, matching the default range tape colour. Named colours are
resolved through `Timeline.ThemeIcons`.

Instant-dot colour precedence, from lowest to highest, is:

1. timeline default blue
2. `eventTheme.instant.iconColor`
3. the event's `iconColor`
4. an applied emphasis `iconColor`

An event `color` also colours the dot when the effective `eventColorScope` is
`graphic` or `both`; the scope can come from the theme, event, or applied
emphasis. Explicit `iconColor` values are not disabled by `eventColorScope`.
An authored event `icon` URL is preserved instead of applying the theme/default
dot colour, but an event or emphasis `iconColor` deliberately replaces it.

### `eventTheme.instant.horizontal.toLabelGap`
Sets the visible horizontal gap between an instant dot and its label. Defaults
to `4` pixels.

### `eventTheme.instant.vertical.toLabelGap`
Sets the visible vertical gap between an instant dot and its label. Defaults to
`4` pixels.

## `eventTheme.range`

### `eventTheme.range.width`
Sets range tape thickness. Defaults to the native theme value, normally `4`.

### `eventTheme.range.iconColor`
Sets the default range tape and sparkline colour. Named colours are resolved
through `Timeline.ThemeIcons` when available. If omitted, tapes and sparklines
use the timeline's native blue.

## `eventTheme.range.short`

Short ranges are duration events whose rendered time-axis length is less than
the active orientation's `eventRoutingThreshold`. They use point-event routing
rather than long-range tape-label routing.

### `eventTheme.range.short.minDisplayLength`
Minimum visible time-axis length for short-duration tapes. Defaults to
`range.width`, or `4` if no range width is available.

Short ranges use the active orientation's `range.*.toLabelGap`; there is no
separate `range.short.toLabelGap` setting.

## `eventTheme.range.horizontal`

### `eventTheme.range.horizontal.eventRoutingThreshold`
Rendered duration length at which a range is treated as a long tape event.
Defaults to `28`. A duration exactly equal to the threshold is long.

### `eventTheme.range.horizontal.tapeGap`
Vertical-axis gap between long-duration tape lanes. The same value separates
the complete tape block from the first routed label row. Defaults to `2`
pixels. It does not affect time-axis lane assignment.

### `eventTheme.range.horizontal.toLabelGap`
Visible vertical gap between a long-range sparkline endpoint and its label. For
long ranges it does not move tape lanes or routed label rows. Short-duration
labels use the same value by moving the label below its tape; that offset is
included when the short event's routed-row height is measured. Defaults to `4`.
If a long-range value exceeds the available connector distance, the sparkline
length clamps to zero.

### `eventTheme.range.horizontal.labelRoutingGap`
Minimum time-axis clearance used when assigning long-range labels and
point/short-duration event groups to routed rows. Increasing it can move a
group to another row. Defaults to `8`.

### `eventTheme.range.horizontal.labelTrackGap`
Vertical-axis gap between routed event rows. It does not control tape-lane
spacing or tape-block-to-label-row separation. Defaults to `2`.

### `eventTheme.range.horizontal.sparklineStagger`
Time-axis stagger applied to long-range sparkline attachment points on
successive routed rows. Defaults to `8`.

### `eventTheme.range.horizontal.stickyLeftInset`
Viewport inset used when long-range labels stick at the left or right edge.
Defaults to `2`.

## `eventTheme.range.vertical`

### `eventTheme.range.vertical.eventRoutingThreshold`
Rendered duration length at which a range is treated as a long tape event.
Defaults to `28`. A duration exactly equal to the threshold is long.

### `eventTheme.range.vertical.tapeGap`
Horizontal-axis gap between long-duration tape lanes. The same value separates
the complete tape block from the first routed label column. Defaults to `2`
pixels. It does not affect time-axis lane assignment.

### `eventTheme.range.vertical.toLabelGap`
Visible horizontal gap between a long-range sparkline endpoint and its label.
For long ranges it does not move tape lanes or routed label columns.
Short-duration labels use the same value by moving the label to the right of
its tape, and that offset is included in the computed event-column pitch.
Defaults to `4`. If a long-range value exceeds the available connector
distance, the sparkline length clamps to zero.

### `eventTheme.range.vertical.labelWidth`
Width applied to all vertical event labels. If omitted, event layout uses 36%
of the band width, clamped to the range `80`–`140`. If no band width is
available, it derives the value from the native track increment and applies
the same clamp.

### `eventTheme.range.vertical.labelRoutingGap`
Minimum time-axis clearance used when routing long-range labels and
point/short-duration event groups. It separates vertically adjacent labels
within a column and can force a group into another column. Defaults to `4`.
The primary long-range label column is also available to automatic point and
short-duration events when their rendered groups do not collide with a label
or short-duration tape already occupying that part of the column.

### `eventTheme.range.vertical.labelTrackGap`
Horizontal-axis gap between routed side columns. The transition from the
primary long-range label column to the first side column uses `toEventGap`.
Defaults to `2`.

### `eventTheme.range.vertical.stickyTopInset`
Viewport inset used when long-range labels stick at the top edge. Defaults to
`2`.

### `eventTheme.range.vertical.toEventGap`
Horizontal gap from the right edge of the primary shared track's widest
possible content to the first side column used by point/short events and any
additional routed long-range labels. It applies only when the layout contains
a long-range tape block. Defaults to `12`.

## Event Overrides

### `labels`
Set to `false` on one event to hide only that event label.

### `bubbles`
Set to `false` on one event to stop only that event bubble popup.

### `eventColorScope`
Overrides `eventTheme.eventColorScope` for one event.

### `color`
Provides the event colour used according to `eventColorScope`.

### `iconColor`
Sets one instant event's dot colour. An applied emphasis `iconColor` takes
precedence. On range events, use `tapeColor` for an event-only override.

### `emphasis`
References a named spec from `theme.emphasisSpecs`. It applies unless
`eventTheme.disableEmphasis` is `true`.

### `labelColor`
Sets one event label colour.

### `textColor`
Native SIMILE text-colour override. `labelColor` takes precedence when both are
set.

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
