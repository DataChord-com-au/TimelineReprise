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
                height: height + "px",
                backgroundColor: color
            }
        };

        return { left, top, width, height, color, elmt };
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

test("object literals load as VisualTheme instances", () => {
    const Timeline = loadTimeline();
    const themes = Timeline.loadVisualThemes([
        {
            id: "editorial",
            labels: false,
            instant: { iconColor: "orange" }
        }
    ]);

    assert.ok(themes.editorial instanceof Timeline.VisualTheme);
    assert.equal(themes.editorial.labels, false);
    assert.equal(themes.editorial.instant.iconColor, "orange");
});

test("VisualTheme validates tooltips and enables them by default", () => {
    const Timeline = loadTimeline();

    assert.equal(new Timeline.VisualTheme().tooltips, true);
    assert.equal(new Timeline.VisualTheme({ tooltips: false }).tooltips, false);
    assert.throws(
        () => new Timeline.VisualTheme({ tooltips: "false" }),
        /tooltips must be a boolean/
    );
});

test("VisualTheme validates label flow and defaults to normal", () => {
    const Timeline = loadTimeline();

    assert.equal(new Timeline.VisualTheme().label.flow, "normal");
    assert.equal(
        new Timeline.VisualTheme({ label: { flow: "orthogonal" } }).label.flow,
        "orthogonal"
    );
    assert.throws(
        () => new Timeline.VisualTheme({ label: { flow: "sideways" } }),
        /label\.flow must be 'normal' or 'orthogonal'/
    );
});

test("VisualTheme resolves label placement fields from label specs", () => {
    const Timeline = loadTimeline();
    const theme = new Timeline.VisualTheme({
        label: {
            rangeCssClass: "range-label",
            instantCssClass: "instant-label",
            horizontal: {
                toRangeGap: 7,
                toInstantGap: 8,
                toRangeBlockGap: 15,
                routingGap: 10,
                trackGap: 3
            },
            vertical: {
                toRangeGap: 9,
                toInstantGap: 11,
                width: 120,
                length: 121
            }
        }
    });

    assert.equal(new Timeline.VisualTheme().label.horizontal.toRangeGap, 4);
    assert.equal(new Timeline.VisualTheme().label.horizontal.toInstantGap, 4);
    assert.equal(theme.label.horizontal.toRangeGap, 7);
    assert.equal(theme.label.horizontal.toInstantGap, 8);
    assert.equal(theme.label.horizontal.routingGap, 10);
    assert.equal(theme.label.horizontal.trackGap, 3);
    assert.equal(theme.label.vertical.toRangeGap, 9);
    assert.equal(theme.label.vertical.width, 120);
    assert.equal(theme.label.vertical.length, 121);
    assert.equal(theme.label.rangeCssClass, "range-label");
    assert.equal(theme.label.instantCssClass, "instant-label");
    assert.throws(
        () => new Timeline.VisualTheme({
            range: { horizontal: { toLabelGap: 7 } }
        }),
        /range\.horizontal\.toLabelGap is not supported/
    );
    assert.throws(
        () => new Timeline.VisualTheme({
            instant: { horizontal: { toLabelGap: 7 } }
        }),
        /instant\.horizontal\.toLabelGap is not supported/
    );
    assert.throws(
        () => new Timeline.VisualTheme({
            range: { horizontal: { labelRoutingGap: 7 } }
        }),
        /range\.horizontal\.labelRoutingGap is not supported/
    );
    assert.throws(
        () => new Timeline.VisualTheme({
            instant: { labelCssClass: "instant-label" }
        }),
        /instant\.labelCssClass is not supported/
    );
    assert.throws(
        () => new Timeline.VisualTheme({
            label: { horizontal: { toRangeGap: -1 } }
        }),
        /label\.horizontal\.toRangeGap must be a non-negative finite number/
    );
    assert.throws(
        () => new Timeline.VisualTheme({
            label: { vertical: { length: 0 } }
        }),
        /label\.vertical\.length must be a positive finite number/
    );
});

test("interval line visibility belongs to band construction", () => {
    const Timeline = loadTimeline();

    assert.throws(
        () => new Timeline.VisualTheme({ intervalLines: true }),
        /intervalLines is not a supported visual theme field/
    );
});

test("VisualTheme layer z-index controls are independent", () => {
    const Timeline = loadTimeline();
    const spanOnly = new Timeline.VisualTheme({ layer: { zIndex: 25 } });
    const theme = new Timeline.VisualTheme({
        layer: {
            zIndex: 15,
            dividerZIndex: 35,
            labelZIndex: 55
        }
    });

    assert.equal(spanOnly.layer.zIndex, 25);
    assert.equal(spanOnly.layer.dividerZIndex, 101);
    assert.equal(theme.layer.zIndex, 15);
    assert.equal(theme.layer.dividerZIndex, 35);
    assert.equal(theme.layer.labelZIndex, 55);
    assert.throws(
        () => new Timeline.VisualTheme({
            layer: { dividerZIndex: "35" }
        }),
        /dividerZIndex must be a finite number/
    );
});

test("resolver supports named and explicit VisualTheme selections", () => {
    const Timeline = loadTimeline();
    const themes = Timeline.loadVisualThemes([{ id: "named", spans: false }]);
    const instance = new Timeline.VisualTheme({ dividers: false });
    const namedNativeTheme = {};
    const instanceNativeTheme = {};

    assert.equal(
        Timeline.resolveVisualTheme("named", namedNativeTheme),
        themes.named
    );
    assert.equal(namedNativeTheme.visualTheme, undefined);
    assert.equal(
        Timeline.resolveVisualTheme(instance, instanceNativeTheme),
        instance
    );
    assert.equal(instanceNativeTheme.visualTheme, undefined);
    assert.throws(
        () => Timeline.resolveVisualTheme({ labels: false }),
        /must be a VisualTheme or registered theme id/
    );
});

test("band composition attaches an explicit resolved VisualTheme", () => {
    const Timeline = loadTimeline();
    const themes = Timeline.loadVisualThemes([{ id: "named", spans: false }]);
    const namedNativeTheme = {};
    const instance = new Timeline.VisualTheme({ dividers: false });
    const instanceNativeTheme = {};

    assert.equal(
        Timeline.composeVisualTheme(namedNativeTheme, "named"),
        themes.named
    );
    assert.equal(namedNativeTheme.visualTheme, themes.named);
    assert.equal(
        Timeline.composeVisualTheme(instanceNativeTheme, instance),
        instance
    );
    assert.equal(instanceNativeTheme.visualTheme, instance);
    assert.throws(
        () => Timeline.composeVisualTheme(null, "named"),
        /nativeTheme.*must be an object/
    );
});

test("superseded duplicate theme paths are rejected", () => {
    const Timeline = loadTimeline();

    assert.throws(
        () => new Timeline.VisualTheme({
            bubble: { enabled: true }
        }),
        /bubble\.enabled is not supported/
    );
    assert.throws(
        () => new Timeline.VisualTheme({
            track: { horizontal: { height: 20 } }
        }),
        /track\.horizontal\.height is not supported/
    );
});

test("resolver converts and attaches the band native-theme fallback", () => {
    const Timeline = loadTimeline();
    const nativeTheme = {
        event: { track: {}, tape: {}, instant: {}, label: {}, bubble: {} },
        visualTheme: {
            id: "band",
            range: { width: 7 }
        }
    };
    const resolved = Timeline.resolveVisualTheme(null, nativeTheme);

    assert.ok(resolved instanceof Timeline.VisualTheme);
    assert.equal(resolved.id, "band");
    assert.equal(resolved.range.width, 7);
    assert.equal(nativeTheme.visualTheme, resolved);
});

test("resolver attaches the defined Reprise default to a native band theme", () => {
    const Timeline = loadTimeline();
    const nativeTheme = {};
    const resolved = Timeline.resolveVisualTheme(null, nativeTheme);

    assert.equal(resolved, Timeline.defaultVisualTheme);
    assert.equal(nativeTheme.visualTheme, Timeline.defaultVisualTheme);
    assert.equal(resolved.range.width, 4);
    assert.equal(resolved.range.size, undefined);
    assert.equal(resolved.layer.zIndex, 5);
    assert.equal(resolved.layer.dividerZIndex, 101);
    assert.equal(resolved.layer.labelZIndex, 114);
});

test("event painters and Narrative receive the same resolved VisualTheme shape", () => {
    const Timeline = loadTimeline();
    const nativeTheme = {
        event: { track: {}, tape: {}, instant: {}, label: {}, bubble: {} },
        visualTheme: {
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

    assert.ok(painter._visualTheme instanceof Timeline.VisualTheme);
    assert.equal(overview._visualTheme, painter._visualTheme);
    assert.equal(narrative._visualTheme, painter._visualTheme);
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
        visualTheme: {
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

    assert.equal(tick.top, 1);
    assert.equal(tick.height, 11);
    assert.equal(tick.elmt.style.top, "1px");
    assert.equal(tick.elmt.style.height, "11px");

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

function singleEventSource() {
    return {
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
    };
}

function captureVerticalOriginalMetrics(Timeline, {
    markerAlign = "Right",
    track = {
        horizontal: {
            offset: 12
        }
    }
} = {}) {
    const nativeTheme = {
        event: {
            track: {
                offset: 2,
                height: 20,
                gap: 2
            },
            instant: {
                iconWidth: 10,
                iconHeight: 10
            },
            label: {},
            duration: { color: "gray" }
        },
        visualTheme: {
            track,
            instant: {
                width: 10,
                height: 10
            },
            range: {
                width: 4
            }
        }
    };
    const band = {
        _theme: nativeTheme,
        _bandInfo: { markerAlign },
        getEventSource: singleEventSource,
        getMinDate: () => new Date(0),
        getMaxDate: () => new Date(1),
        getViewOffset: () => 0,
        getViewLength: () => 200,
        getViewWidth: () => 300,
        updateEventTrackInfo: () => {},
        getLabeller: () => Timeline.NativeDateUnit.createLabeller()
    };
    const timeline = {
        isHorizontal: () => false,
        isVertical: () => true,
        getUnit: () => Timeline.NativeDateUnit
    };
    const painter = new Timeline.OriginalEventPainter({ theme: nativeTheme });
    let paintedMetrics = null;

    painter.initialize(band, timeline);
    painter._band = band;
    painter._timeline = timeline;
    painter._prepareForPainting = function () {
        this._tracks = [];
        this._highlightLayer = { style: {} };
        this._lineLayer = { style: {} };
        this._eventLayer = { style: {} };
        this._repriseTapeLaneStarts = [];
        this._repriseTapeLaneEnds = [];
        this._repriseTapeLanes = {};
        this._repriseTapeLabels = [];
        this._repriseTapeBars = [];
        this._repriseEventLaneSpans = [];
        this._repriseEventLanes = {};
        this._reprisePointIcons = [];
        this._reprisePointTapes = [];
        this._reprisePointLabels = [];
    };
    painter._fireEventPaintListeners = () => {};
    painter.paintEvent = function (evt, metrics) {
        paintedMetrics = metrics;
    };
    painter.paint();

    return paintedMetrics;
}

function captureVerticalOverviewMetrics(Timeline, {
    markerAlign = "Right",
    track = {
        horizontal: {
            offset: 12
        }
    }
} = {}) {
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
        visualTheme: {
            track,
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
    const band = {
        _theme: nativeTheme,
        _bandInfo: { markerAlign },
        getEventSource: singleEventSource,
        getMinDate: () => new Date(0),
        getMaxDate: () => new Date(1),
        updateEventTrackInfo: () => {}
    };
    const timeline = {
        isHorizontal: () => false,
        isVertical: () => true
    };
    const overview = new Timeline.OverviewEventPainter({ theme: nativeTheme });
    let paintedMetrics = null;

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

    return paintedMetrics;
}

test("vertical left markerAlign supplies a larger default event offset", () => {
    const Timeline = loadTimeline();

    assert.equal(
        captureVerticalOriginalMetrics(Timeline, { markerAlign: "Right" }).trackOffset,
        2
    );
    assert.equal(
        captureVerticalOriginalMetrics(Timeline, { markerAlign: "Left" }).trackOffset,
        48
    );
    assert.equal(
        captureVerticalOriginalMetrics(Timeline, {
            markerAlign: "Left",
            track: {
                vertical: {
                    offset: 14
                }
            }
        }).trackOffset,
        14
    );
});

test("vertical left markerAlign supplies a larger default overview offset", () => {
    const Timeline = loadTimeline();

    assert.equal(
        captureVerticalOverviewMetrics(Timeline, { markerAlign: "Right" }).tickOffset,
        2
    );
    assert.equal(
        captureVerticalOverviewMetrics(Timeline, { markerAlign: "Left" }).tickOffset,
        48
    );
    assert.equal(
        captureVerticalOverviewMetrics(Timeline, {
            markerAlign: "Left",
            track: {
                vertical: {
                    offset: 14
                }
            }
        }).tickOffset,
        14
    );
});

test("overview uses standard event colours and eventColorScope", () => {
    const Timeline = loadTimeline();
    const nativeTheme = {
        emphasisSpecs: {
            critical: { iconColor: "emphasis" }
        },
        event: {
            overviewTrack: {
                offset: 12,
                tickHeight: 6,
                height: 3,
                gap: 4
            },
            duration: { color: "native-range" }
        },
        visualTheme: {
            eventColorScope: "graphic",
            instant: {
                tickWidth: 6,
                iconColor: "theme-instant"
            },
            range: {
                width: 3,
                iconColor: "theme-range"
            },
            tagsToIconColor: {
                release: "tag-color"
            }
        }
    };
    const band = { _theme: nativeTheme };
    const timeline = {
        isHorizontal: () => true,
        isVertical: () => false
    };
    const metrics = {
        tickOffset: 12,
        trackOffset: 16,
        trackHeight: 3,
        trackGap: 4,
        trackIncrement: 7
    };
    const overview = new Timeline.OverviewEventPainter({ theme: nativeTheme });

    function event(properties = {}) {
        return {
            getClassName: () => null,
            getColor: () => properties.color ?? null,
            getProperty: name => properties[name] ?? null
        };
    }

    function tick(properties) {
        return overview._paintEventTick(
            event(properties),
            25,
            null,
            100,
            metrics,
            nativeTheme
        ).elmt.style.backgroundColor;
    }

    function tape(properties) {
        return overview._paintEventTape(
            event(properties),
            0,
            25,
            45,
            null,
            100,
            metrics,
            nativeTheme,
            null
        ).color;
    }

    overview.initialize(band, timeline);

    assert.equal(tick({ color: "event", eventColorScope: "graphic" }), "event");
    assert.equal(tick({ color: "event", eventColorScope: "label" }), "theme-instant");
    assert.equal(tick({ iconColor: "instant", eventColorScope: "graphic" }), "instant");
    assert.equal(tick({ iconColor: "instant", eventColorScope: "label" }), "theme-instant");
    assert.equal(tape({ color: "event", eventColorScope: "both" }), "event");
    assert.equal(tape({ color: "event", eventColorScope: "none" }), "theme-range");
    assert.equal(tape({ tapeColor: "range", eventColorScope: "graphic" }), "range");
    assert.equal(tape({ tapeColor: "range", eventColorScope: "none" }), "theme-range");
    assert.equal(tick({ tags: ["release"] }), "tag-color");
    assert.equal(tape({ tags: ["release"] }), "tag-color");
    assert.equal(
        tick({ emphasis: "critical", eventColorScope: "none" }),
        "emphasis"
    );
    assert.equal(
        tape({ emphasis: "critical", eventColorScope: "none" }),
        "emphasis"
    );
});

test("VisualTheme selects a registered validated DisplayProfile", () => {
    const Timeline = loadTimeline();
    const profiles = Timeline.loadDisplayProfiles([
        {
            id: "editorialDisplay",
            label: {
                title: {
                    instant: "{title}",
                    range: "{lines(title, duration)}"
                }
            },
            bubble: {
                bubbleDuration: {
                    range: "{duration}"
                }
            }
        }
    ]);
    const themes = Timeline.loadVisualThemes([
        {
            id: "editorial",
            presentation: "editorialDisplay"
        }
    ]);
    const resolved = Timeline.resolveVisualTheme("editorial");

    assert.equal(resolved, themes.editorial);
    assert.equal(
        Timeline.resolveDisplayProfile(resolved.presentation),
        profiles.editorialDisplay
    );
});

test("DisplayProfile registry rejects invalid selections and duplicate ids", () => {
    const Timeline = loadTimeline();
    const instance = new Timeline.DisplayProfile({
        id: "instanceDisplay",
        label: { title: "{title}" }
    });

    Timeline.loadDisplayProfiles([instance]);
    assert.equal(
        Timeline.resolveDisplayProfile("instanceDisplay"),
        instance
    );
    assert.equal(Timeline.resolveDisplayProfile(instance), instance);
    assert.equal(Timeline.resolveDisplayProfile(null), null);
    assert.throws(
        () => Timeline.resolveDisplayProfile("missingDisplay"),
        /unknown DisplayProfile: missingDisplay/
    );
    assert.throws(
        () => Timeline.loadVisualThemes([
            { id: "missingProfileTheme", presentation: "missingDisplay" }
        ]),
        /unknown DisplayProfile: missingDisplay/
    );
    assert.throws(
        () => Timeline.loadDisplayProfiles([
            { id: "duplicate", label: {} },
            { id: "duplicate", bubble: {} }
        ]),
        /duplicate id: duplicate/
    );
});

test("DisplayProfile validates surfaces, fields, shapes, and templates", () => {
    const Timeline = loadTimeline();

    assert.throws(
        () => new Timeline.DisplayProfile({
            id: "badLabel",
            label: { bubbleStart: "{start}" }
        }),
        /label unsupported output field: bubbleStart/
    );
    assert.throws(
        () => new Timeline.DisplayProfile({
            id: "badShape",
            bubble: {
                bubbleStart: { point: "{start}" }
            }
        }),
        /bubbleStart\.point is not supported/
    );
    assert.throws(
        () => new Timeline.DisplayProfile({
            id: "badTemplate",
            label: { title: "{unknownFormatter(title)}" }
        }),
        /unknown formatter: unknownFormatter/
    );
});

test("VisualTheme presentation accepts only DisplayProfile selections", () => {
    const Timeline = loadTimeline();
    const profile = new Timeline.DisplayProfile({
        id: "directDisplay",
        label: { title: "{title}" }
    });
    const theme = new Timeline.VisualTheme({ presentation: profile });
    const derived = Timeline.deriveVisualTheme(theme, {
        id: "derivedDisplayTheme",
        labels: false
    });

    assert.equal(theme.presentation, profile);
    assert.equal(derived.presentation, profile);
    assert.throws(
        () => new Timeline.VisualTheme({
            presentation: {
                title: { template: "{title}" }
            }
        }),
        /presentation must be a DisplayProfile or registered profile id/
    );
    assert.throws(
        () => new Timeline.VisualTheme({
            range: { template: "{duration}" }
        }),
        /range\.template is not supported/
    );
});

test("VisualTheme derivation deep-merges and returns a validated VisualTheme", () => {
    const Timeline = loadTimeline();
    const base = new Timeline.VisualTheme({
        track: { horizontal: { count: 3, offset: 10 } }
    });
    const derived = Timeline.deriveVisualTheme(base, {
        track: { horizontal: { offset: 20 } }
    });

    assert.ok(derived instanceof Timeline.VisualTheme);
    assert.notEqual(derived, base);
    assert.equal(derived.track.horizontal.count, 3);
    assert.equal(derived.track.horizontal.offset, 20);
});
