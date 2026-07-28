# Display Profiles

`Timeline.DisplayProfile` is Reprise's validated model for event and Narrative
content templates. It is separate from `EventTheme` visual layout, but an
`EventTheme` selects one profile through its `presentation` field.

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

Timeline.loadEventThemes([
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
label tooltip when the selected EventTheme enables tooltips.

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
label-only `title` template does not alter the bubble title.

Profile construction validates surface names, output fields, shape names,
template syntax, formatter names, and formatted selector references. Instances
are immutable.

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
