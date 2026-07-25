const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadTimeline() {
    function OriginalEventPainter(params) {
        this._params = params;
    }
    function OverviewEventPainter(params) {
        this._params = params;
    }

    OriginalEventPainter.prototype.initialize = function () {};
    OriginalEventPainter.prototype._prepareForPainting = function () {};
    OriginalEventPainter.prototype._findFreeTrack = function () { return 0; };
    OriginalEventPainter.prototype._paintEventIcon = function () {};
    OriginalEventPainter.prototype._paintEventTape = function () {};
    OriginalEventPainter.prototype._paintEventLabel = function () {};
    OriginalEventPainter.prototype._showBubble = function () {};
    OriginalEventPainter.prototype.paint = function () {};
    OriginalEventPainter.prototype.softPaint = function () {};
    OverviewEventPainter.prototype.initialize = function () {};
    OverviewEventPainter.prototype._paintEventTick = function () {};
    OverviewEventPainter.prototype._paintEventTape = function () {};
    OverviewEventPainter.prototype.paint = function () {};

    const Timeline = {
        NativeDateUnit: {},
        OriginalEventPainter,
        OverviewEventPainter,
        ThemeIcons: {
            getCssColor: color => color,
            get: () => null
        }
    };
    const context = vm.createContext({
        Timeline,
        window: { Timeline }
    });
    const filename = path.join(__dirname, "..", "dist", "timeline-reprise.js");

    vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
    return Timeline;
}

test("object literals load as EventTheme instances", () => {
    const Timeline = loadTimeline();
    const themes = Timeline.loadEventThemes([
        {
            id: "editorial",
            labels: false,
            instant: { iconColor: "orange" }
        }
    ]);

    assert.ok(themes.editorial instanceof Timeline.EventTheme);
    assert.equal(themes.editorial.labels, false);
    assert.equal(themes.editorial.instant.iconColor, "orange");
});

test("resolver supports named and explicit EventTheme selections", () => {
    const Timeline = loadTimeline();
    const themes = Timeline.loadEventThemes([{ id: "named", spans: false }]);
    const instance = new Timeline.EventTheme({ dividers: false });

    assert.equal(Timeline.resolveEventTheme("named"), themes.named);
    assert.equal(Timeline.resolveEventTheme(instance), instance);
    assert.throws(
        () => Timeline.resolveEventTheme({ labels: false }),
        /must be an EventTheme or registered theme id/
    );
});

test("superseded duplicate theme paths are rejected", () => {
    const Timeline = loadTimeline();

    assert.throws(
        () => new Timeline.EventTheme({
            bubble: { enabled: true }
        }),
        /bubble\.enabled is not supported/
    );
    assert.throws(
        () => new Timeline.EventTheme({
            track: { horizontal: { height: 20 } }
        }),
        /track\.horizontal\.height is not supported/
    );
});

test("resolver converts and attaches the band native-theme fallback", () => {
    const Timeline = loadTimeline();
    const nativeTheme = {
        event: { track: {}, tape: {}, instant: {}, label: {}, bubble: {} },
        eventTheme: {
            id: "band",
            range: { width: 7 }
        }
    };
    const resolved = Timeline.resolveEventTheme(null, nativeTheme);

    assert.ok(resolved instanceof Timeline.EventTheme);
    assert.equal(resolved.id, "band");
    assert.equal(resolved.range.width, 7);
    assert.equal(nativeTheme.eventTheme, resolved);
});

test("resolver attaches the defined Reprise default to a native band theme", () => {
    const Timeline = loadTimeline();
    const nativeTheme = {};
    const resolved = Timeline.resolveEventTheme(null, nativeTheme);

    assert.equal(resolved, Timeline.defaultEventTheme);
    assert.equal(nativeTheme.eventTheme, Timeline.defaultEventTheme);
    assert.equal(resolved.range.width, 4);
    assert.equal(resolved.range.size, undefined);
});

test("event painters and Narrative receive the same resolved EventTheme shape", () => {
    const Timeline = loadTimeline();
    const nativeTheme = {
        event: { track: {}, tape: {}, instant: {}, label: {}, bubble: {} },
        eventTheme: {
            id: "shared",
            labels: false,
            track: {
                horizontal: {
                    count: 2,
                    offset: 8,
                    size: 24
                }
            }
        }
    };
    const band = { _theme: nativeTheme };
    const timeline = {
        isHorizontal: () => true,
        isVertical: () => false
    };
    const painter = new Timeline.OriginalEventPainter({ theme: nativeTheme });
    const overview = new Timeline.OverviewEventPainter({ theme: nativeTheme });
    const narrative = new Timeline.NarrativeDecorator({});

    painter.initialize(band, timeline);
    overview.initialize(band, timeline);
    narrative.initialize(band, timeline);

    assert.ok(painter._eventTheme instanceof Timeline.EventTheme);
    assert.equal(overview._eventTheme, painter._eventTheme);
    assert.equal(narrative._eventTheme, painter._eventTheme);
    assert.equal(narrative._labels, false);
    assert.equal(narrative._trackCount, 2);
    assert.equal(narrative._trackOffset, 8);
    assert.equal(narrative._trackSize, 24);
});

test("opaque presentation and template fields survive validation and resolution", () => {
    const Timeline = loadTimeline();
    const template = "${TimelineUtils.getProperty(event, 'title')}";
    const themes = Timeline.loadEventThemes([
        {
            id: "opaque",
            presentation: {
                title: { template, templateId: "event-title" }
            },
            templates: {
                bubble: "timeline-bubble-template"
            },
            range: {
                template
            }
        }
    ]);
    const resolved = Timeline.resolveEventTheme("opaque");

    assert.equal(resolved.presentation.title.template, template);
    assert.equal(resolved.presentation.title.templateId, "event-title");
    assert.equal(resolved.templates.bubble, "timeline-bubble-template");
    assert.equal(resolved.range.template, template);
});

test("EventTheme derivation deep-merges and returns a validated EventTheme", () => {
    const Timeline = loadTimeline();
    const base = new Timeline.EventTheme({
        track: { horizontal: { count: 3, offset: 10 } }
    });
    const derived = Timeline.deriveEventTheme(base, {
        track: { horizontal: { offset: 20 } }
    });

    assert.ok(derived instanceof Timeline.EventTheme);
    assert.notEqual(derived, base);
    assert.equal(derived.track.horizontal.count, 3);
    assert.equal(derived.track.horizontal.offset, 20);
});
