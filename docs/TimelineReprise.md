# Timeline Reprise

Timeline Reprise is an extension layer for the original SIMILE Timeline 2.3.1 browser widget.

Use the original timeline when you want the classic behaviour. Add the reprise layer when you want newer presentation options such as dark mode, flexible band sizing, generated colour markers, and updated painters.

The examples are arranged as stepping stones, so you can see what changes at each layer: original SIMILE, CSS-only styling, then the full Reprise distribution.

The project keeps the upstream SIMILE files intact and loads reprise behavior separately. That makes it possible to compare original SIMILE examples against enhanced examples, while adding features such as dark-mode styling, generated color icons, flexible band widths, and replacement painters over time.

The intended shape is progressive: pages can load only the original library, add CSS-only styling, or opt into the full combined Reprise distribution when they need patched behavior.


## Distribution

- `vendor/SIMILE/timeline-2.3.1/` - original SIMILE Timeline 2.3.1 browser libraries.
- `dist/timeline-reprise.js` - the complete Reprise JavaScript feature set.
- `dist/timeline-reprise.css` - the complete Reprise stylesheet.
- `dist/images/` - external media referenced by the stylesheet.

The files under `timeline-reprise/` are build inputs. They are not separate
consumer modules.


## Browser Widget Usage

Load the SIMILE base library first, then the Reprise stylesheet and the single
combined Reprise JavaScript file:

```html
<script src="../vendor/SIMILE/timeline-2.3.1/timeline_ajax/simile-ajax-api.js?bundle=true"></script>
<script src="../vendor/SIMILE/timeline-2.3.1/timeline_js/timeline-api.js?bundle=true"></script>
<link rel="stylesheet" href="../dist/timeline-reprise.css">
<script src="../dist/timeline-reprise.js"></script>
```

Run `npm run build` to regenerate the distribution. The CSS media remains as
external files under `dist/images/`.

## Reference
### [Core](timeline-reprise-core.md)
### [Overview](timeline-reprise-overview.md)
### [Cardinal Axis](timeline-reprise-cardinal-axis.md)
### [Scaled Zones](timeline-reprise-scaled-zones.md)
### [Event Layout](timeline-reprise-event-layout.md)
### [Narrative](timeline-reprise-narrative.md)


## Examples
### [simile-baseline.html](../examples/simile-baseline.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/simile-baseline.html)
### [timeline-dark-mode.html](../examples/timeline-dark-mode.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-dark-mode.html)
### [timeline-reprise-colors.html](../examples/timeline-reprise-colors.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-reprise-colors.html)
### [timeline-reprise-overview.html](../examples/timeline-reprise-overview.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-reprise-overview.html)
### [timeline-reprise-scales.html](../examples/timeline-reprise-scales.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-reprise-scales.html)
### [timeline-reprise-event-layout.html](../examples/timeline-reprise-event-layout.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-reprise-event-layout.html)
### [timeline-reprise-narrative.html](../examples/timeline-reprise-narrative.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-reprise-narrative.html)


---
[Back to top](#timeline-reprise)
<!-- EOF -->
