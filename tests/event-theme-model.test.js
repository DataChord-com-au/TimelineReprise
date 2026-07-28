const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("@jest/globals");

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
    OverviewEventPainter.prototype.initialize = function (band, timeline) {
        this._band = band;
        this._timeline = timeline;
    };
    OverviewEventPainter.prototype._paintEventTick = function (evt, left, color, opacity, metrics, theme) {
        const tickHeight = theme.event.overviewTrack.tickHeight;
        const top = metrics.tickOffset - tickHeight;
        const elmt = { style: { top: top + "px", height: tickHeight + "px" } };

        return { left, top, width: 1, height: tickHeight, elmt };
    };
    OverviewEventPainter.prototype._paintEventTape = function (
        evt, track, left, right, color, opacity, metrics
    ) {
        const top = metrics.trackOffset + track * metrics.trackIncrement;
        const width = right - left;
        const height = metrics.trackHeight;
        const elmt = {
            style: {
                left: left + "px",
                top: top + "px",
                width: width + "px",
                height: height + "px"
            }
        };

        return { left, top, width, height, elmt };
    };
    OverviewEventPainter.prototype.paint = function () {};

    const labeller = {
        labelPrecise: value => String(value),
        labelInterval: value => ({ text: String(value), emphasized: false })
    };
    const NativeDateUnit = {
        parseFromObject: value => value,
        compare: (a, b) => Number(a) - Number(b),
        createLabeller: () => labeller
    };
    const Timeline = {
        NativeDateUnit,
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

test("EventTheme validates tooltips and enables them by default", () => {
    const Timeline = loadTimeline();

    assert.equal(new Timeline.EventTheme().tooltips, true);
    assert.equal(new Timeline.EventTheme({ tooltips: false }).tooltips, false);
    assert.throws(
        () => new Timeline.EventTheme({ tooltips: "false" }),
        /tooltips must be a boolean/
    );
});

test("resolver supports named and explicit EventTheme selections", () => {
    const Timeline = loadTimeline();
    const themes = Timeline.loadEventThemes([{ id: "named", spans: false }]);
    const instance = new Timeline.EventTheme({ dividers: false });
    const namedNativeTheme = {};
    const instanceNativeTheme = {};

    assert.equal(
        Timeline.resolveEventTheme("named", namedNativeTheme),
        themes.named
    );
    assert.equal(namedNativeTheme.eventTheme, undefined);
    assert.equal(
        Timeline.resolveEventTheme(instance, instanceNativeTheme),
        instance
    );
    assert.equal(instanceNativeTheme.eventTheme, undefined);
    assert.throws(
        () => Timeline.resolveEventTheme({ labels: false }),
        /must be an EventTheme or registered theme id/
    );
});

test("band composition attaches an explicit resolved EventTheme", () => {
    const Timeline = loadTimeline();
    const themes = Timeline.loadEventThemes([{ id: "named", spans: false }]);
    const namedNativeTheme = {};
    const instance = new Timeline.EventTheme({ dividers: false });
    const instanceNativeTheme = {};

    assert.equal(
        Timeline.composeEventTheme(namedNativeTheme, "named"),
        themes.named
    );
    assert.equal(namedNativeTheme.eventTheme, themes.named);
    assert.equal(
        Timeline.composeEventTheme(instanceNativeTheme, instance),
        instance
    );
    assert.equal(instanceNativeTheme.eventTheme, instance);
    assert.throws(
        () => Timeline.composeEventTheme(null, "named"),
        /nativeTheme.*must be an object/
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
    const band = {
        _theme: nativeTheme,
        getLabeller: () => Timeline.NativeDateUnit.createLabeller()
    };
    const timeline = {
        isHorizontal: () => true,
        isVertical: () => false,
        getUnit: () => Timeline.NativeDateUnit
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

test("overview geometry separates instant ticks from tapes with track gap", () => {
    const Timeline = loadTimeline();
    const nativeTheme = {
        event: {
            overviewTrack: {
                offset: 20,
                tickHeight: 7,
                height: 2,
                gap: 1
            },
            duration: { color: "gray" }
        },
        eventTheme: {
            track: {
                horizontal: {
                    offset: 12,
                    gap: 5
                }
            },
            instant: {
                tickWidth: 11,
                iconColor: "orange"
            },
            range: {
                width: 4,
                iconColor: "green"
            }
        }
    };
    let paintedMetrics = null;
    const band = {
        _theme: nativeTheme,
        getEventSource: () => ({
            getEventReverseIterator: () => {
                let remaining = 1;
                return {
                    hasNext: () => remaining > 0,
                    next: () => {
                        remaining -= 1;
                        return {};
                    }
                };
            }
        }),
        getMinDate: () => new Date(0),
        getMaxDate: () => new Date(1),
        updateEventTrackInfo: () => {}
    };
    const timeline = {
        isHorizontal: () => true,
        isVertical: () => false
    };
    const overview = new Timeline.OverviewEventPainter({ theme: nativeTheme });

    overview.initialize(band, timeline);
    overview._prepareForPainting = function () {
        this._tracks = [];
        this._highlightLayer = { style: {} };
        this._eventLayer = { style: {} };
    };
    overview.paintEvent = function (evt, metrics) {
        paintedMetrics = metrics;
    };

    overview.paint();

    assert.equal(paintedMetrics.tickOffset, 12);
    assert.equal(paintedMetrics.trackOffset, 17);
    assert.equal(paintedMetrics.trackHeight, 4);
    assert.equal(paintedMetrics.trackGap, 5);
    assert.equal(paintedMetrics.trackIncrement, 9);

    const tick = overview._paintEventTick(
        { getProperty: () => null, getClassName: () => null },
        25,
        null,
        100,
        paintedMetrics,
        nativeTheme
    );

    assert.equal(tick.top, 5);
    assert.equal(tick.height, 7);
    assert.equal(tick.elmt.style.top, "5px");
    assert.equal(tick.elmt.style.height, "7px");

    const tape = overview._paintEventTape(
        { getProperty: () => null },
        0,
        25,
        45,
        null,
        100,
        paintedMetrics,
        nativeTheme
    );

    assert.equal(tape.top, 17);
    assert.equal(tape.height, 4);
    assert.equal(tape.top - (tick.top + tick.height), 5);
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
