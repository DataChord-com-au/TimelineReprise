# Timeline Units and Durations

Timeline Reprise extends the timeline unit and labeller contracts with an
optional duration capability:

```js
unit.duration(start, end);       // finite, non-negative number
labeller.labelDuration(value);   // display text
```

A custom unit that does not provide these methods remains supported. Its
ranges simply have no derived duration.

The unit and labeller also provide the built-in dependency injection used by
`Timeline.RepriseRuntime` and Reprise band construction. Parsing, comparison,
numeric ether projection, value changes, and labels remain unit operations.
Domain integrations inject authored-value projection through the runtime
without replacing Reprise's band builder.

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

Use it as the `unit` or runtime unit supplied to `Timeline.createBandSet()`.
Reprise constructs its event index, linear ether, labeller, and timeline.

## Historical years

`Timeline.HistoricalYear` represents a whole year without constructing a
JavaScript `Date` or introducing month, day, time, or time-zone semantics.
Its raw `value`, numeric coercion, and `Timeline.HistoricalYearUnit.toNumber()`
use astronomical year numbering:

- raw `-1` is `2 BCE`;
- raw `0` is `1 BCE`;
- raw `1` is `1 CE`.

There is no year zero in `toString()`, precise labels, or axis labels.
Regular interval markers align independently on the BCE and CE sides of that
boundary.

```js
var caesar = new Timeline.HistoricalYear(-43); // astronomical year -43
var augustus = new Timeline.HistoricalYear(14);
var unit = Timeline.HistoricalYearUnit;
var labeller = unit.createLabeller();

Number(caesar);                         // -43
String(caesar);                         // "44 BCE"
labeller.labelPrecise(augustus);        // "14 CE"
unit.duration(caesar, augustus);        // 57
labeller.labelDuration(57);             // "57 years"
```

The unit accepts whole finite numbers, numeric strings, `HistoricalYear`
instances, and objects with a whole numeric `value`. It implements parsing,
cloning, numeric projection, comparison, earlier/later selection, change,
duration, and labeller creation. BCE/CE labels are produced arithmetically;
the implementation does not construct JavaScript dates.

The public constructor and parser reject fractional years. `fromNumber()` and
`change()` retain finite fractional coordinates used internally by
`Timeline.LinearEther`, allowing smooth pixel movement without adding calendar
semantics. If such a coordinate is formatted, its containing whole year is
used.

See
[the historical-year example](../examples/14-timeline-reprise-historical-year-unit.html)
for BCE/CE axis labels and sample data covering ancient Egypt, the Greek
world, and Rome.

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

Ma values and durations use no decimal places for integers, exactly one
decimal place for non-integers of at least 1 Ma, and exactly two decimal places
for non-integers below 1 Ma. For example, `50`, `50.5`, `0.5`, and `0.25` are
labelled `"50 Ma"`, `"50.5 Ma"`, `"0.50 Ma"`, and `"0.25 Ma"`.

---
[Back to top](#timeline-units-and-durations)<br>
[Back to main](TimelineReprise.md)
<!-- EOF -->
