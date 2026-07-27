# EventTheme

`Timeline.EventTheme` is Timeline Reprise's single event-presentation model.
SIMILE's native theme remains the per-band base at `bandInfo.theme` and
`band._theme`; Reprise attaches the band's resolved model at
`nativeTheme.eventTheme`.

Authored literals are validated and converted when they are loaded or first
resolved:

```js
var themes = Timeline.loadEventThemes([
    {
        id: "editorial",
        labels: true,
        bubbles: false,
        instant: {
            iconColor: "orange"
        },
        range: {
            iconColor: "green",
            width: 4
        }
    }
]);

themes.editorial instanceof Timeline.EventTheme; // true
```

`Timeline.loadEventThemes()` replaces the named registry. Every loaded theme
must have a unique `id`.

## Resolution

`Timeline.resolveEventTheme(explicit, nativeTheme)` uses one precedence order:

1. an explicit registered theme id;
2. an explicit `Timeline.EventTheme` instance;
3. `nativeTheme.eventTheme`;
4. `Timeline.defaultEventTheme`.

Explicit ids and instances are resolved without modifying `nativeTheme`, so
separate event and Narrative attachments can select different themes without
changing the band's fallback. A band fallback may be an authored literal;
fallback resolution converts it and replaces `nativeTheme.eventTheme` with the
resulting instance. When no fallback exists, the defined Reprise default is
attached instead.

```js
var nativeTheme = Timeline.ClassicTheme.create();
nativeTheme.eventTheme = {
    labels: false
};

var resolved = Timeline.resolveEventTheme(null, nativeTheme);
resolved instanceof Timeline.EventTheme;              // true
nativeTheme.eventTheme === resolved;                   // true
```

For band construction,
`Timeline.composeEventTheme(nativeTheme, explicit)` resolves and attaches an
explicit registry selection or instance:

```js
var nativeTheme = Timeline.ClassicTheme.create();
var resolved = Timeline.composeEventTheme(nativeTheme, "editorial");
nativeTheme.eventTheme === resolved;                   // true
```

Select a theme for normal-event attachment with:

```js
Timeline.attachEvents(bandInfo, events, {
    eventTheme: "editorial"
});
```

Narrative attachment accepts the same selection:

```js
Timeline.attachNarrativeDecorators(bandInfo, narrativeEvents, {
    eventTheme: "editorial"
});
```

An explicit selection must be a registered id or an `EventTheme` instance.
Object literals belong in the registry or at `nativeTheme.eventTheme`.
The two methods may select different themes on the same band.

## Derivation

`Timeline.deriveEventTheme(base, overrides)` is the only EventTheme derivation
operation. It deep-merges `overrides` into an existing instance, validates the
result, and returns a new immutable `EventTheme`.

```js
var compact = Timeline.deriveEventTheme(themes.editorial, {
    track: {
        horizontal: {
            size: 14
        }
    }
});
```

## Presentation values

`presentation`, `template`, `templateId`, and `templates` remain opaque values
during EventTheme validation. At render time, the
[presentation runtime](timeline-reprise-presentation-runtime.md) resolves
`eventTheme.presentation[field]`. A field spec can contain a direct `template`
or a `templateId` that selects `eventTheme.templates[id]`.

The default Reprise renderer does not evaluate template expressions or
interpret `TimelineUtils` macros. An injected runtime renderer may interpret
the selected template.

## Consumers

Original event layout, overview event painting, and Narrative all resolve this
same model. Reprise-specific fields are not copied into SIMILE's native
`theme.event` schema, and Narrative has no parallel theme root or individual
theme-field options.
