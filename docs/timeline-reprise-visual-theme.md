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
        backgroundColor: "#f8f6ef",
        labels: true,
        bubbles: false,
        tooltips: true,
        tooltip: {
            maxWidth: 300
        },
        instant: {
            iconColor: "orange"
        },
        range: {
            iconColor: "green",
            graphic: "span",
            width: 4,
            lineWidth: 1
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

`backgroundColor` is an optional band background default. It must be `null`,
omitted, or a non-empty CSS color string. `createBand()` and
`createBandSet()` use the selected visual theme's `backgroundColor` only when
the band spec has no `backgroundColor`; an explicit band value, including
`null`, wins.

`tooltips` is an optional boolean that defaults to `true`. Event and Narrative
caption surfaces use a custom HTML tooltip on hover and focus. Set
`tooltips: false` to suppress caption tooltips without changing bubble
behavior.

`tooltip.maxWidth` sets the custom caption tooltip's maximum width in pixels.
It must be a finite positive number and defaults to `300`. Tooltip content is
rendered as plain text; newline output from templates such as `{lines(...)}` is
preserved. This setting is independent of `bubble.width`.

`label.flow` controls label text direction for event and Narrative labels:

```js
var themes = Timeline.loadVisualThemes([{
    id: "verticalLabels",
    label: {
        flow: "orthogonal"
    }
}]);
```

`normal` keeps the existing label behavior. `orthogonal` rotates Latin text by
`-90deg`, so it reads up the page. The convention is page-space based and is not
relative to timeline orientation. Event and Narrative label routing use the
rotated visual footprint; overview painters do not use this label flow option.

`label.horizontal.rangeAlign` and `label.vertical.rangeAlign` control the
time-axis alignment of range labels for each timeline orientation:

```js
label: {
    horizontal: { rangeAlign: "center" },
    vertical: { rangeAlign: "center" }
}
```

`start` is the default. `center` prefers the center of the range using the
label's rendered footprint, including orthogonal labels and labels longer than
their range. Collision routing, sticky positioning, and viewport limits may
move that preferred position. For either alignment, a fully visible label may
slide on its current track only until its trailing edge reaches the range end;
routing then tries the next track. A finishing Narrative label at the leading
viewport edge keeps contact-based routing, while Narrative labels leave the
trailing edge without sticking. Instant labels are unaffected.

`range.graphic` controls the built-in graphic Narrative draws for range
records. `span` preserves the filled span default; `start`, `end`, and `both`
draw divider lines at the corresponding range boundary; `none` renders the
range label without a built-in range graphic. `range.lineWidth` controls the
boundary divider thickness. Normal event layout and overview painting ignore
these properties.

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
