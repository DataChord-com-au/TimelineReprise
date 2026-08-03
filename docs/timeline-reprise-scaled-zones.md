# Scaled Zones

Scaled time ranges for Timeline Reprise.

## Reprise band configuration

```js
var bandSet = Timeline.createBandSet({
    zones: [
        {
            id: "focus",
            start: "2020-07-12",
            end: "2020-07-18T00:01:00Z",
            magnify: 20,
            unit: "day",
            multiple: 1
        }
    ],
    bands: [{
        id: "main",
        width: "100%",
        intervalUnit: "month",
        intervalPixels: 100,
        scaledZones: "focus"
    }]
});
```

Creates a timeline band where selected ranges use a different scale. Reprise
projects each zone's boundaries through the band-set runtime, then constructs
the appropriate scaled ether for the runtime's unit.

## Zones

```js
var zones = [
    {
        id: "focus",
        start: "2020-07-12",
        end: "2020-07-18T00:01:00Z",
        magnify: 20,
        unit: "day",
        multiple: 1
    }
];
```

### `id`
Unique zone id used by bands in the set.

### `start`
Start of the scaled range. Reprise projects it through
`runtime.projectTimeRange()`.

### `end`
End of the scaled range. Reprise projects it through
`runtime.projectTimeRange()`.

### `magnify`
Scale multiplier applied inside the zone.

Higher values make the zone take more screen space.

### `unit`
For native-date bands, the SIMILE date unit used for labels inside the scaled
zone.

```js
unit: Timeline.DateTime.DAY
```

### `multiple`
For native-date bands, the number of units between labels inside the scaled
zone.

```js
multiple: 1
```

Use a larger value when labels are too dense.

## Band Options

Define named zone specs as an array at the `createBandSet()` level. Select them
per band with `scaledZones: true`, one zone id, or an array of ids. An array
selects more than one zone for the same band. Overlapping selected zones
multiply their magnification.

Zone ranges use the band-set's injected runtime. The default runtime projects
native dates, historical years, Ma values, and other supported unit values
through that unit's parser. A domain integration such as Chronicle Time can
instead project its authored values through `projectTimeRange()`.

Native-date zones use Gregorian `unit` and `multiple` values for their
markers. Scalar and wrapper units, including `HistoricalYearUnit` and
`MaUnit`, retain the band's numeric `interval` for markers while applying each
zone's magnification to the ether scale.

Common band options:

- `date`
- `width`
- `intervalUnit`
- `intervalPixels`
- `visualTheme`
- `scaledZones`

## Example

```js
var bandSet = Timeline.createBandSet({
    initialDate: "2020-07-15",
    zones: [
        {
            id: "focus",
            start: "2020-07-12",
            end: "2020-07-18T00:01:00Z",
            magnify: 20,
            unit: "day",
            multiple: 1
        }
    ],
    bands: [{
        id: "main",
        width: "100%",
        intervalUnit: "month",
        intervalPixels: 100,
        scaledZones: "focus"
    }]
});
```

---
[Back to top](#scaled-zones)<br>
[Back to main](TimelineReprise.md)
<!-- EOF -->
