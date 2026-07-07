# Timeline Reprise

Timeline Reprise is an extension layer for the original SIMILE Timeline 2.3.1 browser widget.

Use the original timeline when you want the classic behaviour. Add the reprise layer when you want newer presentation options such as dark mode, flexible band sizing, generated colour markers, and updated painters.

The examples are arranged as stepping stones, so you can see what changes at each layer: original SIMILE, CSS-only styling, then the full reprise loader.



The project keeps the upstream SIMILE files intact and loads reprise behavior separately. That makes it possible to compare original SIMILE examples against enhanced examples, while adding features such as dark-mode styling, generated color icons, flexible band widths, and replacement painters over time.

The intended shape is progressive: pages can load only the original library, add CSS-only styling, or opt into the full `timeline-reprise.js` loader when they need patched behavior.


## Library Layers

- `vendor/SIMILE/timeline-2.3.1/` - original SIMILE Timeline 2.3.1 browser libraries.
- `timeline-reprise/dark-mode/` - CSS dark mode assets.
- `timeline-reprise/timeline-reprise.js` - reprise library loader.
- `timeline-reprise/timeline-reprise-core.js` - shared reprise behavior.
- `timeline-reprise/timeline-reprise-overview.js` - extended theme support for overview bands.
- `timeline-reprise/timeline-reprise-cardinal-axis.js` - adds support for a bounded cardinal axis.
- `timeline-reprise/timeline-reprise-scaled-zones.js` - adds support for scaled zones within a timeline band.


## Browser Widget Usage

Load the base library first, then the custom layer:

```html
<script src="../vendor/SIMILE/timeline-2.3.1/timeline_ajax/simile-ajax-api.js?bundle=true"></script>
<script src="../vendor/SIMILE/timeline-2.3.1/timeline_js/timeline-api.js?bundle=true"></script>
<script src="./timeline-reprise/timeline-reprise.js"></script>
```

## Reference
### [Reprise Core](timeline-reprise-core.md)
### [Reprise Overview](timeline-reprise-overview.md)
### [Reprise Cardinal Axis](timeline-reprise-cardinal-axis.md)
### [Reprise Scaled Zones](timeline-reprise-scaled-zones.md)


## Examples
### [simile-baseline.html](../examples/simile-baseline.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/simile-baseline.html)
### [timeline-dark-mode.html](../examples/timeline-dark-mode.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-dark-mode.html)
### [timeline-reprise-colors.html](../examples/timeline-reprise-colors.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-reprise-colors.html)
### [timeline-reprise-overview.html](../examples/timeline-reprise-overview.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-reprise-overview.html)
### [timeline-reprise-scales.html](../examples/timeline-reprise-scales.html) [⧉](https://DataChord-com-au.github.io/TimelineReprise/examples/timeline-reprise-scales.html)

---
[Back to top](#timeline-reprise)
<!-- EOF -->
