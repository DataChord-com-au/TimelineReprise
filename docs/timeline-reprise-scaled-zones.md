# Scaled Zones

Scaled time ranges for Timeline Reprise.

## Timeline.createScaledZoneBand

```js
Timeline.createScaledZoneBand({
    eventSource: eventSource,
    date: centerDate,
    width: "75%",
    intervalUnit: Timeline.DateTime.MONTH,
    intervalPixels: 100,
    zones: zones,
    theme: theme
})
```

Creates a timeline band where selected date ranges use a different scale.

This wraps SIMILE's hot-zone band support with a clearer Timeline Reprise name.

Scaled zones use SIMILE's date-to-pixel scaling and orientation-aware axis layout.

## Zones

```js
var zones = [
    {
        start: "2020-07-12",
        end: "2020-07-18T00:01:00Z",
        magnify: 20,
        unit: Timeline.DateTime.DAY,
        multiple: 1
    }
];
```

### `start`
Start of the scaled date range.

### `end`
End of the scaled date range.

### `magnify`
Scale multiplier applied inside the zone.

Higher values make the zone take more screen space.

### `unit`
SIMILE date unit used for labels inside the scaled zone.

```js
unit: Timeline.DateTime.DAY
```

### `multiple`
Number of units between labels inside the scaled zone.

```js
multiple: 1
```

Use a larger value when labels are too dense.

## Band Options

`Timeline.createScaledZoneBand` accepts the normal SIMILE band options used by `Timeline.createBandInfo`, plus `zones`.

Common options:

- `eventSource`
- `date`
- `width`
- `intervalUnit`
- `intervalPixels`
- `theme`
- `zones`

## Example

```js
var bandInfo = Timeline.createScaledZoneBand({
    eventSource: eventSource,
    date: new Date("2020-07-15T00:00:00Z"),
    width: "75%",
    intervalUnit: Timeline.DateTime.MONTH,
    intervalPixels: 100,
    zones: [
        {
            start: "2020-07-12",
            end: "2020-07-18T00:01:00Z",
            magnify: 20,
            unit: Timeline.DateTime.DAY,
            multiple: 1
        }
    ],
    theme: theme
});
```

---
[Back to top](#scaled-zones)<br>
[Back to main](TimelineReprise.md)
<!-- EOF -->
