# Timeline Reprise

<!-- timeline-reprise-version:start -->
Version: `1.3.3`
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
"timeline-reprise": "github:DataChord-com-au/TimelineReprise#v1.3.3"
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

The distribution JavaScript contains the complete Reprise feature set. Its
stylesheet is loaded explicitly and keeps media under `dist/images/`.

For source development, `src/index.js` is the ordered browser ESM entry.
Stylesheet inputs live under `src/css/` and are combined by the build.

## Distribution Build

Generate the combined distribution with:

```sh
npm run build
```

This writes one combined JavaScript file, one combined CSS file, and the CSS
media assets:

```text
dist/
  timeline-reprise.js
  timeline-reprise.css
  images/
```

The combined distribution JavaScript does not load its stylesheet; use the
explicit CSS and JavaScript tags shown in Usage above.

## Documentation

See [Timeline Reprise docs](docs/TimelineReprise.md) for feature reference notes.

## Examples

| <!-- --> | <!-- --> |
|----------|----------|
| [simile-baseline.html](examples/simile-baseline.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/simile-baseline.html) | Loads the original SIMILE Timeline library unpatched. |
| [timeline-dark-mode.html](examples/timeline-dark-mode.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-dark-mode.html) | Loads the original SIMILE Timeline library with CSS supporting dark mode styles. |
| [timeline-reprise-colors.html](examples/timeline-reprise-colors.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-reprise-colors.html) | Reprise Core adds named color support for event markers and duration tapes.<br>Bands can be set with flexible width. |
| [timeline-reprise-filtered-theme.html](examples/timeline-reprise-filtered-theme.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-reprise-filtered-theme.html) | Loads event theme configuration from embedded JSON and filters a larger event set by tags. |
| [timeline-reprise-overview.html](examples/timeline-reprise-overview.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-reprise-overview.html) | Reprise Overview extends theme support for overview bands. |
| [timeline-reprise-scales.html](examples/timeline-reprise-scales.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-reprise-scales.html) | Reprise Cardinal Axis adds a bounded numeric axis.<br>Reprise Scaled Zones expands selected date ranges within a band. |
| [timeline-reprise-event-layout.html](examples/timeline-reprise-event-layout.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-reprise-event-layout.html) | Reprise Event Layout routes duration and point labels across horizontal and vertical timelines. |
| [timeline-reprise-imprecise-ranges.html](examples\timeline-reprise-imprecise-ranges.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-reprise-imprecise-ranges.html) | Stress-tests routed duration labels and their tape-to-label sparklines with heavily overlapping imprecise ranges. |
| [timeline-reprise-narrative.html](examples/timeline-reprise-narrative.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-reprise-narrative.html) | Reprise Narrative adds labelled spans and dividers above the event layer. |

<!-- EOF -->
