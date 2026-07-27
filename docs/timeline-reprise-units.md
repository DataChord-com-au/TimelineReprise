# Timeline Units and Durations

Timeline Reprise extends the timeline unit and labeller contracts with an
optional duration capability:

```js
unit.duration(start, end);       // finite, non-negative number
labeller.labelDuration(value);   // display text
```

A custom unit that does not provide these methods remains supported. Its
ranges simply have no derived duration.

## Native JavaScript dates

When Reprise loads after SIMILE Timeline, it adds duration support to
`Timeline.NativeDateUnit` and its Gregorian labeller. The numeric duration is
elapsed milliseconds. The default text uses elapsed days, hours, minutes,
seconds, and milliseconds as needed:

```js
Timeline.NativeDateUnit.duration(
    new Date("2026-01-01T00:00:00Z"),
    new Date("2026-01-03T00:00:00Z")
); // 172800000
```

This is an extension-layer addition; the vendored SIMILE source is unchanged.

## Planning days

`Timeline.PlanningDayUnit` is a supported numeric timeline unit. It accepts
finite numbers and numeric strings, preserves day zero, and supplies
`Timeline.PlanningDayLabeller`.

```js
var unit = Timeline.PlanningDayUnit;
var labeller = unit.createLabeller();

unit.duration(3, 15);          // 12
labeller.labelDuration(1);     // "1 day"
labeller.labelDuration(12);    // "12 days"
```

Use it anywhere a SIMILE timeline unit is accepted, including
`SimileAjax.EventIndex`, `Timeline.LinearEther`, `Timeline.create()`, and
`Timeline.RepriseRuntime`.

## Ma values

`Timeline.Ma` is the supported value wrapper and `Timeline.MaUnit` is its
older-to-younger timeline unit.

```js
var older = new Timeline.Ma(225);
var younger = new Timeline.Ma(190);
var unit = Timeline.MaUnit;
var labeller = unit.createLabeller();

unit.duration(older, younger); // 35
labeller.labelDuration(35);    // "35 Ma"
```

Durations below 1 Ma use one decimal place when needed. For example, a
duration of `0.5` is labelled `"0.5 Ma"`.

---
[Back to top](#timeline-units-and-durations)<br>
[Back to main](TimelineReprise.md)
<!-- EOF -->
