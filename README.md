# Timeline Reprise

<!-- timeline-reprise-version:start -->
Version: `2.2.2`
<!-- timeline-reprise-version:end -->
Base library: SIMILE Timeline `2.3.1`

Timeline Reprise is an experimental reprise of the SIMILE Timeline 2.3.1 browser widget.

It keeps a self-contained static copy of the original SIMILE Timeline library and applies custom features as a separate addon layer.

## Structure

- `upstream/` - original, unchanged SIMILE Timeline 2.3.1 release artifacts and provenance notes
- `vendor/` - extracted runnable SIMILE Timeline/Ajax browser files used by examples and the reprise layer
- `src/` - custom patches, painters, layout behavior, and styling
- `examples/` - HTML demos of the reprise layer features

## Extraction To `vendor/`

The runnable library under `vendor/` was extracted from `upstream/timeline-2.3.1.zip/timeline_libraries.zip`.

The SIMILE release archive contains browser-ready library files for both SIMILE Ajax and SIMILE Timeline. These were copied into `vendor/` with their internal directory layout preserved.

The preserved layout is important because the original SIMILE loaders resolve scripts, styles, images, and compiled bundles using paths relative to `simile-ajax-api.js` and `timeline-api.js`.

No source rebuild was performed for the initial baseline.

## Usage

For npm/git consumers:

<!-- timeline-reprise-install:start -->
```json
"timeline-reprise": "github:DataChord-com-au/TimelineReprise#v2.2.2"
```
<!-- timeline-reprise-install:end -->

For normal usage, load the SIMILE base library first, then the Reprise
stylesheet and the single combined Reprise JavaScript file:

```html
<script src="../vendor/SIMILE/timeline-2.3.1/timeline_ajax/simile-ajax-api.js?bundle=true"></script>
<script src="../vendor/SIMILE/timeline-2.3.1/timeline_js/timeline-api.js?bundle=true"></script>
<link rel="stylesheet" href="./dist/timeline-reprise.css">
<script src="./dist/timeline-reprise.js"></script>
```

The stylesheet gives unsized timeline containers a responsive default height.
Override `--timeline-reprise-height` or set an explicit height only when the
page needs different sizing.

The distribution JavaScript contains the complete Reprise feature set. Its
stylesheet is loaded explicitly and keeps media under `dist/images/`.

Attach normal events or Narrative data to a band info before calling
`Timeline.create()`:

```js
Timeline.attachEvents(bandInfo, events);
Timeline.attachNarrativeDecorators(bandInfo, narrativeEvents);
```

Both methods accept `{ eventTheme, runtime }`. `eventTheme` is a registered
theme id or `Timeline.EventTheme` instance; otherwise the band theme is used.

Reprise-owned `DisplayProfile` and `TemplateRenderer` instances provide
validated label, tooltip, and bubble templates. An EventTheme selects a
registered profile through `presentation`; domain libraries can add selectors
without replacing Reprise's generic macros or rendering pipeline.

Reprise also provides supported planning-day, historical-year, and Ma timeline
units:

```js
var planningUnit = Timeline.PlanningDayUnit;
var historicalUnit = Timeline.HistoricalYearUnit;
var maUnit = Timeline.MaUnit;
var caesar = new Timeline.HistoricalYear(-43); // "44 BCE"
var jurassic = new Timeline.Ma(190);
```

Duration-aware runtimes expose numeric and formatted durations to renderers.
Native dates use elapsed milliseconds, planning ranges use day counts,
historical ranges use elapsed years, and Ma ranges use older-to-younger
differences. See
[Timeline Units and Durations](docs/timeline-reprise-units.md).

Clamp created timeline band chains to exact center boundaries with:

```js
var clamp = Timeline.clampBandChains(timeline, {
    start: new Date("2024-01-01T00:00:00Z"),
    end: new Date("2028-01-01T00:00:00Z")
});
```

The timeline's unit parses and compares both boundaries. The returned
controller provides `dispose()` when the clamp needs to be removed.

For source development, `src/index.js` is the ordered browser ESM entry.
Each JavaScript source has a matching declaration under `src/types/`.
Stylesheet inputs live under `src/css/`; declarations and stylesheets are
combined separately by the build.

## Distribution Build

Generate the combined distribution with:

```sh
npm run build
```

This writes one combined JavaScript file, one combined CSS file, the TypeScript
declarations, and the CSS media assets:

```text
dist/
  timeline-reprise.js
  timeline-reprise.css
  timeline-reprise.d.ts
  images/
```

The combined distribution JavaScript does not load its stylesheet; use the
explicit CSS and JavaScript tags shown in Usage above.

## Documentation

See [Timeline Reprise docs](docs/TimelineReprise.md) for feature reference notes.

## Examples

| <!-- --> | <!-- --> |
|----------|----------|
| [01-simile-baseline.html](examples/01-simile-baseline.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/01-simile-baseline.html) | Loads the original SIMILE Timeline library unpatched. |
| [02-timeline-dark-mode.html](examples/02-timeline-dark-mode.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/02-timeline-dark-mode.html) | Loads the original SIMILE Timeline library with CSS supporting dark mode styles. |
| [03-timeline-baseline-default.html](examples/03-timeline-baseline-default.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/03-timeline-baseline-default.html) | Creates a usable Reprise timeline without page CSS, a theme, an explicit container size, or painter options. |
| [04-timeline-reprise-colors.html](examples/04-timeline-reprise-colors.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/04-timeline-reprise-colors.html) | Reprise Core adds named color support for event markers and duration tapes.<br>Bands can be set with flexible width. |
| [05-timeline-reprise-overview.html](examples/05-timeline-reprise-overview.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/05-timeline-reprise-overview.html) | Reprise Overview extends theme support for overview bands. |
| [06-timeline-reprise-scales.html](examples/06-timeline-reprise-scales.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/06-timeline-reprise-scales.html) | Reprise Cardinal Axis adds a bounded numeric axis.<br>Reprise Scaled Zones expands selected date ranges within a band. |
| [07-timeline-reprise-imprecise-ranges.html](examples/07-timeline-reprise-imprecise-ranges.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/07-timeline-reprise-imprecise-ranges.html) | Stress-tests routed duration labels and their tape-to-label sparklines with heavily overlapping imprecise ranges. |
| [08-timeline-reprise-event-layout.html](examples/08-timeline-reprise-event-layout.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/08-timeline-reprise-event-layout.html) | Reprise Event Layout routes duration and point labels across horizontal and vertical timelines. |
| [09-timeline-reprise-narrative.html](examples/09-timeline-reprise-narrative.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/09-timeline-reprise-narrative.html) | Reprise Narrative adds labelled spans and dividers alongside normal event content. |
| [10-timeline-reprise-filtered-theme.html](examples/10-timeline-reprise-filtered-theme.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/10-timeline-reprise-filtered-theme.html) | Loads event theme configuration from embedded JSON and filters a larger event set by tags. |
| [11-timeline-reprise-planning-unit.html](examples/11-timeline-reprise-planning-unit.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/11-timeline-reprise-planning-unit.html) | Uses the supported planning-day unit for day zero, numeric strings, ranges, labels, durations, and bubbles. |
| [12-timeline-reprise-geochrono-unit.html](examples/12-timeline-reprise-geochrono-unit.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/12-timeline-reprise-geochrono-unit.html) | Uses the supported Ma value and unit APIs, including duration labels, and normalizes narrative spans to older-to-younger order. |
| [13-timeline-reprise-clamp-stress.html](examples/13-timeline-reprise-clamp-stress.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/13-timeline-reprise-clamp-stress.html) | Stresses one clamp with three synchronized bands whose temporal movement per pixel differs by several orders of magnitude. |
| [14-timeline-reprise-historical-year-unit.html](examples/14-timeline-reprise-historical-year-unit.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/14-timeline-reprise-historical-year-unit.html) | Uses astronomical whole-year values with BCE/CE labels to compare ancient Egypt, the Greek world, and Rome without JavaScript dates. |

<!-- EOF -->
