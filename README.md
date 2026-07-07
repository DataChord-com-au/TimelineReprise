# TimelineReprise

TimelineReprise is an experimental reprise of the SIMILE Timeline 2.3.1 browser widget.

It keeps a self-contained static copy of the original SIMILE Timeline library and applies custom features as a separate addon layer.

## Structure

- `upstream/` - original, unchanged SIMILE Timeline 2.3.1 release artifacts and provenance notes
- `vendor/` - extracted runnable SIMILE Timeline/Ajax browser files used by examples and the reprise layer
- `timeline-reprise/` - custom patches, painters, layout behavior, and styling
- `examples/` - HTML demos of the reprise layer features

## Extraction To `vendor/`

The runnable library under `vendor/` was extracted from `upstream/timeline-2.3.1.zip/timeline_libraries.zip`.

The SIMILE release archive contains browser-ready library files for both SIMILE Ajax and SIMILE Timeline. These were copied into `vendor/` with their internal directory layout preserved.

The preserved layout is important because the original SIMILE loaders resolve scripts, styles, images, and compiled bundles using paths relative to `simile-ajax-api.js` and `timeline-api.js`.

No source rebuild was performed for the initial baseline.

## Usage

Load the base library first, then the custom layer:

```html
<script src="../vendor/SIMILE/timeline-2.3.1/timeline_ajax/simile-ajax-api.js?bundle=true"></script>
<script src="../vendor/SIMILE/timeline-2.3.1/timeline_js/timeline-api.js?bundle=true"></script>
<script src="./timeline-reprise/timeline-reprise.js"></script>
```

## Examples

| <!-- --> | <!-- --> | <!-- --> |
|----------|----------|----------|
| [simile-baseline.html](examples/simile-baseline.html) | Loads the original SIMILE Timeline library unpatched. | [Preview](https://DataChord-com-au.github.io/TimelineReprise/examples/simile-baseline.html) |
| [timeline-dark-mode.html](examples/timeline-dark-mode.html) | Loads the original SIMILE Timeline library with CSS supporting dark mode styles. | [Preview](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-dark-mode.html) |
| [timeline-reprise-colors.html](examples/timeline-reprise-colors.html) | Reprise Core adds named color support for event markers and duration tapes.<br>Bands can be set with flexible width. | [Preview](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-reprise-colors.html) |

<!-- EOF -->
