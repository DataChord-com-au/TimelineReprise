# Display Profiles

`Timeline.DisplayProfile` is Reprise's validated model for event and Narrative
content templates. It is separate from `VisualTheme` visual layout, but an
`VisualTheme` selects one profile through its `presentation` field.

Load profiles before themes:

```js
var displayProfiles = Timeline.loadDisplayProfiles([
    {
        id: "mainDisplay",
        label: {
            title: {
                instant: "{title}",
                range: "{lines(title, prefix('Known extent: ', duration))}"
            },
            caption: {
                range: "{duration}"
            }
        },
        bubble: {
            bubbleStart: "{start}",
            bubbleEnd: {
                range: "{end}"
            },
            bubbleDuration: {
                range: "{duration}"
            }
        }
    }
]);

Timeline.loadVisualThemes([
    {
        id: "main",
        presentation: "mainDisplay"
    }
]);
```

`loadDisplayProfiles()` replaces the named profile registry. Each profile must
have a unique `id`. `Timeline.resolveDisplayProfile()` accepts a registered id,
a `DisplayProfile` instance, or `null`.

## Surfaces and shapes

The `label` surface accepts `title` and `caption`. `caption` is the Narrative
label tooltip when the selected VisualTheme enables tooltips.

The `bubble` surface accepts:

- `image`, `title`, `link`, and `description`;
- `bubbleByline`;
- `bubbleStart`, `bubbleLatestStart`, `bubbleEarliestEnd`, and `bubbleEnd`;
- `bubbleDuration`, `bubbleMinimumDuration`, `bubbleElapsed`, and
  `bubbleRemaining`;
- `bubbleLocation`, `bubblePeople`, and `bubbleTags`.

A field may be a template string, which applies to instants and ranges, or an
object with optional `instant` and `range` templates. A missing surface, field,
or shape delegates that output to Reprise's default renderer. For example, a
label-only `title` template does not alter the bubble title. Default bubble
duration, minimum-duration, elapsed, and remaining fields still pass through
the profile's TemplateRenderer selector pipeline, allowing a domain extension
to format their runtime-derived values.

Profile construction validates surface names, output fields, shape names,
template syntax, formatter names, and formatted selector references. Instances
are immutable.

For active ranges, `bubbleElapsed` and `bubbleRemaining` default to the
runtime-derived `elapsed` and `remaining` values. When either field has no
template, it inherits the complete `bubbleDuration` template, with that
template's `duration` selector rebound to the applicable elapsed or remaining
value. If none of the three fields has a template, all applicable values use
the runtime's minute-precision fallback text. Templates may also use the
`elapsed` and `remaining` selectors directly, including from a label
`caption`. Bubble values are recalculated on every opening, while caption
tooltips on labels and graphics are recalculated when their surface is entered
or focused. Caption tooltip output is plain text and preserves text-target
newlines from `{lines(...)}`.

`relativeDuration` selects `duration` for a bounded range, `elapsed` for a
concrete start with an open or unresolved end, and `remaining` for an open or
unresolved start with a concrete end. Endpoint presentation remains separate:
`endpointLabel('end', 'present')` renders an open or unresolved end as
`present` without changing the source event, its canonical geometry, or its
semantic boundary. A third argument may provide a different unresolved label.

## Domain selector validation

Pass a configured `TemplateRenderer` when a profile uses domain-specific
selectors:

```js
var renderer = new Timeline.TemplateRenderer({
    selectorExtensions: [chronicleSelectorExtension]
});

Timeline.loadDisplayProfiles(profileConfigs, {
    templateRenderer: renderer
});
```

The same renderer is retained by each constructed profile and evaluates its
templates at render time. Reprise does not need to know the domain represented
by the extension.

---
[Back to top](#display-profiles)<br>
[Back to main](TimelineReprise.md)
<!-- EOF -->
