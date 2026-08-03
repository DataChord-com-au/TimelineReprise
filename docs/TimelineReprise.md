# Timeline Reprise

<!-- timeline-reprise-version:start -->
Version: `v3.1.2`
<!-- timeline-reprise-version:end -->

Timeline Reprise is an extension layer for the original SIMILE Timeline 2.3.1 browser widget.

Use the original timeline when you want the classic behaviour. Add the reprise layer when you want newer presentation options such as dark mode, flexible band sizing, generated colour markers, and updated painters.

The examples are arranged as stepping stones, so you can see what changes at each layer: original SIMILE, CSS-only styling, then the full Reprise distribution.

The project keeps the upstream SIMILE files intact and loads reprise behavior separately. That makes it possible to compare original SIMILE examples against enhanced examples, while adding features such as dark-mode styling, generated color icons, flexible band widths, and replacement painters over time.

The intended shape is progressive: pages can load only the original library, add CSS-only styling, or opt into the full combined Reprise distribution when they need patched behavior.


## Distribution

- `vendor/SIMILE/timeline-2.3.1/` - original SIMILE Timeline 2.3.1 browser libraries.
- `dist/timeline-reprise.js` - the complete Reprise JavaScript feature set.
- `dist/timeline-reprise.css` - the complete Reprise stylesheet.
- `dist/timeline-reprise.d.ts` - browser-global TypeScript declarations.
- `dist/images/` - external media referenced by the stylesheet.

The files under `src/` are build inputs. `src/index.js` is the ordered
browser ESM entry, each JavaScript source has a matching declaration under
`src/types/`, and stylesheet inputs live under `src/css/`.

## Changelog

### v3.1.0

- Extended `Timeline.attachCardinalAxis()` with start/end anchors and
  `drop`, `truncate`, and `extend` finishing modes for incomplete boundary
  intervals.
- Added the optional `runtime.projectCardinalAxis()` hook so domain runtimes
  can supply projected marker positions for non-linear or semantic scales.
- Added band-level `markerAlign` so date and unit marker placement is behavior
  on the band, separate from visual marker theme settings.
- Added a larger default event and overview track offset for vertical bands
  with left-aligned markers.
- Layered Narrative instant divider lines between date/unit and cardinal-axis
  marker ticks and labels by default, while keeping Narrative spans below all
  marker content.
- Cycled dark-mode band background tones across all Reprise bands with
  per-timeline CSS variable overrides.
- Added optional cardinal-axis `indexAtValue()` projection support so
  truncated terminal markers can use semantic partial indexes.
- Added `truncatePreviousMarkerThreshold` for cardinal axes so crowded
  truncate labels suppress the adjacent complete marker by default.


## Browser Widget Usage

Load the SIMILE base library first, then the Reprise stylesheet and the single
combined Reprise JavaScript file:

```html
<script src="../vendor/SIMILE/timeline-2.3.1/timeline_ajax/simile-ajax-api.js?bundle=true"></script>
<script src="../vendor/SIMILE/timeline-2.3.1/timeline_js/timeline-api.js?bundle=true"></script>
<link rel="stylesheet" href="../dist/timeline-reprise.css">
<script src="../dist/timeline-reprise.js"></script>
```

The Reprise stylesheet supplies a responsive default timeline height, so a
basic container does not need its own sizing rule. Set
`--timeline-reprise-height` or an explicit `height` when the page needs a
different size.

Run `npm run build` to regenerate the distribution. The CSS media remains as
external files under `dist/images/`.

## Reference
### [Core](timeline-reprise-core.md)
### [Bands](timeline-reprise-bands.md)
### [Timeline Units and Durations](timeline-reprise-units.md)
### [VisualTheme](timeline-reprise-visual-theme.md)
### [Display Profiles](timeline-reprise-display-profiles.md)
### [Event and Narrative Attachment](timeline-reprise-attachments.md)
### [Presentation Runtime](timeline-reprise-presentation-runtime.md)
### [Overview](timeline-reprise-overview.md)
### [Cardinal Axis](timeline-reprise-cardinal-axis.md)
### [Scaled Zones](timeline-reprise-scaled-zones.md)
### [Event Layout](timeline-reprise-event-layout.md)
### [Narrative](timeline-reprise-narrative.md)


## Examples
### [01-simile-baseline.html](../examples/01-simile-baseline.html)
### [02-timeline-dark-mode.html](../examples/02-timeline-dark-mode.html)
### [03-timeline-baseline-default.html](../examples/03-timeline-baseline-default.html)
### [04-timeline-reprise-colors.html](../examples/04-timeline-reprise-colors.html)
### [05-timeline-reprise-overview.html](../examples/05-timeline-reprise-overview.html)
### [06-timeline-reprise-scales.html](../examples/06-timeline-reprise-scales.html)
### [07-timeline-reprise-cardinal-axis.html](../examples/07-timeline-reprise-cardinal-axis.html)
### [08-timeline-reprise-imprecise-ranges.html](../examples/08-timeline-reprise-imprecise-ranges.html)
### [09-timeline-reprise-clamp-stress.html](../examples/09-timeline-reprise-clamp-stress.html)
### [10-timeline-reprise-event-layout.html](../examples/10-timeline-reprise-event-layout.html)
### [11-timeline-reprise-narrative.html](../examples/11-timeline-reprise-narrative.html)
### [12-timeline-reprise-filtered-theme.html](../examples/12-timeline-reprise-filtered-theme.html)
### [13-timeline-reprise-planning-unit.html](../examples/13-timeline-reprise-planning-unit.html)
### [14-timeline-reprise-geochrono-unit.html](../examples/14-timeline-reprise-geochrono-unit.html)
### [15-timeline-reprise-historical-year-unit.html](../examples/15-timeline-reprise-historical-year-unit.html)


---
[Back to top](#timeline-reprise)
<!-- EOF -->
