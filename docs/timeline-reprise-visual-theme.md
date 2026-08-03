# VisualTheme

`Timeline.VisualTheme` is Timeline Reprise's shared visual-presentation model.
Reprise resolves the selected model while it constructs a band and carries it
on the internal native theme.

Authored literals are validated and converted when they are loaded or first
resolved:

```js
var themes = Timeline.loadVisualThemes([
    {
        id: "editorial",
        labels: true,
        bubbles: false,
        tooltips: true,
        instant: {
            iconColor: "orange"
        },
        range: {
            iconColor: "green",
            width: 4
        }
    }
]);

themes.editorial instanceof Timeline.VisualTheme; // true
```

`Timeline.loadVisualThemes()` replaces the named registry. Every loaded theme
must have a unique `id`.

## Resolution

`Timeline.resolveVisualTheme(explicit, nativeTheme)` uses one precedence order:

1. an explicit registered theme id;
2. an explicit `Timeline.VisualTheme` instance;
3. `nativeTheme.visualTheme`;
4. `Timeline.defaultVisualTheme`.

Explicit ids and instances are resolved without modifying `nativeTheme`, so
separate event and Narrative attachments can select different themes without
changing the band's fallback. A band fallback may be an authored literal;
fallback resolution converts it and replaces `nativeTheme.visualTheme` with the
resulting instance. When no fallback exists, the defined Reprise default is
attached instead.

Application code selects a registered theme while constructing the band:

```js
var bandSet = Timeline.createBandSet({
    visualTheme: "editorial",
    bands: [{
        id: "main",
        width: "100%",
        intervalUnit: "month",
        intervalPixels: 100
    }]
});
```

`Timeline.resolveVisualTheme()` and `Timeline.composeVisualTheme()` remain
available to Reprise internals and advanced integrations, but normal band
construction does not need a native theme object.

Select a theme for normal-event attachment with:

```js
Timeline.attachEvents(bandInfo, events, {
    visualTheme: "editorial"
});
```

Narrative attachment accepts the same selection:

```js
Timeline.attachNarrativeDecorators(bandInfo, narrativeEvents, {
    visualTheme: "editorial"
});
```

An explicit selection must be a registered id or a `VisualTheme` instance.
Object literals belong in the registry.
The two methods may select different themes on the same band.

`tooltips` is an optional boolean that defaults to `true`. Narrative uses an
enabled rendered caption as the label's native `title` tooltip. Set
`tooltips: false` to suppress these caption tooltips without changing bubble
behavior.

## Presentation selection

`presentation` selects a Reprise
[`DisplayProfile`](timeline-reprise-display-profiles.md) by registered id or
instance:

```js
var themes = Timeline.loadVisualThemes([
    {
        id: "editorial",
        presentation: "editorialDisplay",
        labels: true,
        bubbles: true
    }
]);
```

Normal events and Narrative may select different VisualThemes, and therefore
different DisplayProfiles, on the same band. A theme with no presentation
selection uses Reprise's default field and unit rendering.

## Derivation

`Timeline.deriveVisualTheme(base, overrides)` is the only VisualTheme derivation
operation. It deep-merges `overrides` into an existing instance, validates the
result, and returns a new immutable `VisualTheme`.

```js
var compact = Timeline.deriveVisualTheme(themes.editorial, {
    track: {
        horizontal: {
            size: 14
        }
    }
});
```

## Consumers

Original event layout, overview event painting, and Narrative all resolve this
same model. Reprise-specific fields are not copied into SIMILE's native
`theme.event` schema, and Narrative has no parallel theme root or individual
theme-field options.
