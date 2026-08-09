const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("@jest/globals");

function makeUnit({
    parse = value => Number(value),
    compare = (left, right) => left - right,
    toNumber = value => Number(value),
    fromNumber = value => value,
    change = (value, delta) => value + delta,
    defaultValue = 0
} = {}) {
    const labeller = {
        labelPrecise: value => String(value),
        labelInterval: value => ({
            text: String(value),
            emphasized: false
        })
    };

    return {
        parseFromObject(value) {
            if (value == null || value === "") return null;
            const result = parse(value);
            return result == null ||
                (typeof result === "number" && !Number.isFinite(result))
                ? null
                : result;
        },
        compare,
        makeDefaultValue: () => defaultValue,
        cloneValue: value => value,
        toNumber,
        fromNumber,
        change,
        createLabeller: () => labeller
    };
}

function loadBands() {
    const filename = path.join(__dirname, "..", "src", "bands.js");
    const source = fs.readFileSync(filename, "utf8")
        .replace(/^import\s+[\s\S]*?from\s+"[^"]+";\s*$/gm, "")
        .replace(
            /^export\s*\{\s*createBand,\s*createBandSet,\s*createTimeline\s*\};?\s*$/m,
            ""
        );
    const nativeUnit = makeUnit({
        parse(value) {
            if (value instanceof Date) return value;
            const result = new Date(value);
            return Number.isNaN(result.getTime()) ? null : result;
        },
        compare: (left, right) => left.getTime() - right.getTime(),
        toNumber: value => value.getTime(),
        fromNumber: value => new Date(value),
        change: (value, delta) => new Date(value.getTime() + delta),
        defaultValue: new Date("2000-01-01T00:00:00Z")
    });
    const nativeBandCalls = [];
    const timelineCreateCalls = [];
    const timelineActions = [];
    const clampCalls = [];
    const themes = [];

    class FakeElement {
        constructor() {
            this.classes = new Set();
            this.properties = new Map();
            this.classList = {
                add: (...names) => names.forEach(name => this.classes.add(name))
            };
            this.dataset = {};
            this.style = {
                setProperty: (name, value) =>
                    this.properties.set(name, value)
            };
        }
    }

    class EventIndex {
        constructor(unit) {
            this.unit = unit;
        }
    }

    class DefaultEventSource {
        constructor(index) {
            this._events = index;
            this.records = [];
        }

        addMany(records) {
            this.records.push(...records);
        }
    }

    class LinearEther {
        constructor(options) {
            this.options = options;
        }
    }

    class UnitScaledZoneEther extends LinearEther {}

    class OriginalEventPainter {
        constructor(params) {
            this._params = params;
        }
    }

    class OverviewEventPainter extends OriginalEventPainter {}
    class DetailedEventPainter extends OriginalEventPainter {}

    const Timeline = {
        NativeDateUnit: nativeUnit,
        HORIZONTAL: 0,
        VERTICAL: 1,
        DefaultEventSource,
        LinearEther,
        OriginalEventPainter,
        OverviewEventPainter,
        DetailedEventPainter,
        EmptyEtherPainter: class {
            constructor(options) {
                this.options = options;
            }
        },
        ClassicTheme: {
            create() {
                const theme = {
                    ether: {
                        interval: {
                            marker: {
                                hAlign: "Bottom",
                                vAlign: "Right"
                            }
                        }
                    }
                };
                themes.push(theme);
                return theme;
            }
        },
        createBandInfo(params) {
            nativeBandCalls.push(params);
            return {
                ...params,
                eventPainter: new OriginalEventPainter({
                    theme: params.theme
                })
            };
        },
        createScaledZoneBand(params) {
            nativeBandCalls.push(params);
            return {
                ...params,
                eventPainter: new OriginalEventPainter({
                    theme: params.theme
                })
            };
        },
        create(container, bandInfos, orientation, unit) {
            const bands = bandInfos.map((bandInfo, index) => ({
                _div: new FakeElement(),
                centers: [],
                setCenterVisibleDate(value) {
                    this.centers.push(value);
                    timelineActions.push({ type: "center", index, value });
                }
            }));
            const timeline = {
                container,
                bandInfos,
                orientation,
                unit,
                getBand: index => bands[index],
                getBandCount: () => bands.length,
                getUnit: () => unit,
                shiftOK: () => true
            };
            timelineCreateCalls.push(timeline);
            return timeline;
        }
    };
    const SimileAjax = {
        NativeDateUnit: nativeUnit,
        EventIndex
    };

    function resolveRepriseRuntime(runtime, { unit, labeller } = {}) {
        if (runtime != null) return runtime;

        const resolvedUnit = unit ?? nativeUnit;
        return {
            unit: resolvedUnit,
            labeller: labeller ?? resolvedUnit.createLabeller(),
            projectTimeValue: value => resolvedUnit.parseFromObject(value),
            projectTimeRange(value) {
                return {
                    ...(value.start == null
                        ? {}
                        : { start: this.projectTimeValue(value.start) }),
                    ...(value.end == null
                        ? {}
                        : { end: this.projectTimeValue(value.end) })
                };
            },
            readEventTime: () => null,
            render: () => ""
        };
    }

    const visualThemesById = {
        themeBackground: {
            id: "themeBackground",
            backgroundColor: " #224466 "
        },
        overrideBackground: {
            id: "overrideBackground",
            backgroundColor: "#111111"
        }
    };

    function composeVisualTheme(theme, selection) {
        theme.visualTheme =
            typeof selection === "string"
                ? visualThemesById[selection] ?? selection
                : selection ?? { id: "default", backgroundColor: null };
        return theme.visualTheme;
    }

    function validateSpecId(id, caller) {
        if (typeof id !== "string" || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) {
            throw new TypeError(`${caller} invalid id.`);
        }
        return id;
    }

    function resolveTimelineDateTimeUnit(value) {
        const units = { day: 4, month: 6, year: 7 };
        return typeof value === "number" ? value : units[value];
    }

    function normalizeTimelineOrientation(value) {
        const orientation = value ?? "horizontal";
        if (orientation !== "horizontal" && orientation !== "vertical") {
            throw new RangeError("invalid orientation");
        }
        return orientation;
    }

    function normalizeColorString(value) {
        if (typeof value !== "string" || value.trim() === "") {
            throw new TypeError("invalid color");
        }
        return value.trim();
    }

    function clampBandChains(timeline, range) {
        const controller = { disposed: false, dispose() {} };
        clampCalls.push({ timeline, range, controller });
        return controller;
    }

    const context = vm.createContext({
        Timeline,
        SimileAjax,
        Element: FakeElement,
        UnitScaledZoneEther,
        clampBandChains,
        composeVisualTheme,
        normalizeColorString,
        normalizeTimelineOrientation,
        resolveRepriseRuntime,
        resolveTimelineDateTimeUnit,
        validateSpecId
    });
    context.globalThis = context;
    context.window = context;

    const markerPresentationSource = fs.readFileSync(
        path.join(__dirname, "..", "src", "marker-presentation.js"),
        "utf8"
    )
        .replace(/^import\s+[\s\S]*?from\s+"[^"]+";\s*$/gm, "")
        .replace(
            /^export\s*\{\s*normalizeMarkerLength,\s*resolveMarkerPresentationTheme\s*\};?\s*$/m,
            ""
        );
    vm.runInContext(markerPresentationSource, context, {
        filename: "src/marker-presentation.js"
    });

    vm.runInContext(
        `${source}
        globalThis.bandExports = {
            createBand,
            createBandSet,
            createTimeline,
            unitIntervalValues: _unitIntervalValues
        };`,
        context,
        { filename }
    );

    return {
        ...context.bandExports,
        clampCalls,
        nativeBandCalls,
        nativeUnit,
        themes,
        timelineActions,
        timelineCreateCalls,
        Timeline,
        UnitScaledZoneEther
    };
}

test("Reprise owns native-date band construction and band-set wiring", () => {
    const {
        clampCalls,
        createBandSet,
        createTimeline,
        nativeBandCalls,
        nativeUnit,
        timelineCreateCalls
    } = loadBands();
    const runtime = {
        unit: nativeUnit,
        labeller: nativeUnit.createLabeller(),
        projectTimeValue: value => nativeUnit.parseFromObject(value),
        projectTimeRange: value => ({
            start: nativeUnit.parseFromObject(value.start),
            end: nativeUnit.parseFromObject(value.end)
        }),
        readEventTime: () => null,
        render: () => ""
    };
    const bandSet = createBandSet({
        runtime,
        initialDate: "2026-01-01",
        clampRange: {
            start: "2028-01-01",
            end: "2024-01-01"
        },
        visualTheme: "events",
        syncTarget: "main",
        highlight: "overview",
        zones: [
            {
                id: "focus",
                start: "2027-01-01",
                end: "2025-01-01",
                magnify: 3,
                unit: "month"
            },
            {
                id: "context",
                start: "2024-01-01",
                end: "2024-06-01",
                magnify: 2
            }
        ],
        bands: [
            {
                id: "main",
                width: "70%",
                intervalUnit: "month",
                intervalPixels: 100,
                backgroundColor: " #eee ",
                scaledZones: ["focus", "context"]
            },
            {
                id: "overview",
                width: "30%",
                intervalUnit: "year",
                intervalPixels: 200,
                overview: true
            }
        ]
    });

    assert.equal(nativeBandCalls.length, 2);
    assert.equal(nativeBandCalls[0].intervalUnit, 6);
    assert.equal(nativeBandCalls[0].theme.visualTheme, "events");
    assert.equal(nativeBandCalls[0].zones.length, 2);
    assert.equal(
        nativeBandCalls[0].zones[0].start.toISOString(),
        "2025-01-01T00:00:00.000Z"
    );
    assert.equal(
        nativeBandCalls[0].zones[0].end.toISOString(),
        "2027-01-01T00:00:00.000Z"
    );
    assert.equal(bandSet.byId.main.syncWith, undefined);
    assert.equal(bandSet.byId.overview.syncWith, 0);
    assert.equal(bandSet.byId.overview.highlight, true);
    assert.equal(bandSet.syncTarget, "main");
    assert.equal(bandSet.byId.main.repriseRuntime, runtime);
    assert.notEqual(
        bandSet.byId.main.eventSource,
        bandSet.byId.overview.eventSource
    );
    bandSet.byId.main.eventSource.addMany(["main"]);
    assert.deepEqual(bandSet.byId.main.eventSource.records, ["main"]);
    assert.deepEqual(bandSet.byId.overview.eventSource.records, []);

    const timeline = createTimeline({}, bandSet);
    assert.equal(timelineCreateCalls[0].unit, nativeUnit);
    assert.equal(
        timeline.getBand(0).centers[0].toISOString(),
        "2026-01-01T00:00:00.000Z"
    );
    assert.equal(
        timeline.getBand(0).properties,
        undefined
    );
    assert.equal(
        timeline.getBand(0)._div.properties.get(
            "--timeline-band-background-color"
        ),
        "#eee"
    );
    assert.ok(timeline.getBand(0)._div.classes.has("timeline-reprise-band"));
    assert.ok(timeline.getBand(0)._div.classes.has("timeline-reprise-band-tone-1"));
    assert.ok(timeline.getBand(0)._div.classes.has("timeline-band-main"));
    assert.equal(timeline.getBand(0)._div.dataset.timelineBandId, "main");
    assert.ok(timeline.getBand(1)._div.classes.has("timeline-reprise-band"));
    assert.ok(timeline.getBand(1)._div.classes.has("timeline-reprise-band-tone-2"));
    assert.ok(timeline.getBand(1)._div.classes.has("timeline-band-overview"));
    assert.equal(timeline.getBand(1)._div.dataset.timelineBandId, "overview");
    assert.equal(clampCalls[0].timeline, timeline);
    assert.equal(
        clampCalls[0].range.start.toISOString(),
        "2024-01-01T00:00:00.000Z"
    );
    assert.equal(
        clampCalls[0].range.end.toISOString(),
        "2028-01-01T00:00:00.000Z"
    );
});

test("Reprise band presentation cycles dark-mode tone classes beyond five bands", () => {
    const { createBandSet, createTimeline } = loadBands();
    const bandSet = createBandSet({
        syncTarget: "band0",
        bands: Array.from({ length: 6 }, (_, index) => ({
            id: `band${index}`,
            width: `${100 / 6}%`,
            intervalUnit: "month",
            intervalPixels: 100
        }))
    });
    const timeline = createTimeline({}, bandSet);

    assert.deepEqual(
        Array.from({ length: 6 }, (_, index) =>
            [...timeline.getBand(index)._div.classes]
                .filter(name => name.startsWith("timeline-reprise-band-tone-"))
                .sort()
        ),
        [
            ["timeline-reprise-band-tone-1"],
            ["timeline-reprise-band-tone-2"],
            ["timeline-reprise-band-tone-3"],
            ["timeline-reprise-band-tone-4"],
            ["timeline-reprise-band-tone-5"],
            ["timeline-reprise-band-tone-1"]
        ]
    );
});

test("createTimeline soft-paints decorators after initialDate settles", () => {
    const {
        createBandSet,
        createTimeline,
        timelineActions
    } = loadBands();
    const decoratorCalls = [];
    const makeDecorator = id => ({
        softPaint() {
            decoratorCalls.push({
                id,
                centered: timelineActions.some(action =>
                    action.type === "center"
                )
            });
        }
    });
    const bandSet = createBandSet({
        orientation: "vertical",
        syncTarget: "lifeEvents",
        initialDate: "2026-06-01",
        bands: [
            {
                id: "lifeEvents",
                width: "60%",
                intervalUnit: "month",
                intervalPixels: 100,
                decorators: [makeDecorator("lifeEvents")]
            },
            {
                id: "residences",
                width: "40%",
                intervalUnit: "month",
                intervalPixels: 100,
                decorators: [makeDecorator("residences")]
            }
        ]
    });
    const timeline = createTimeline({}, bandSet);

    assert.deepEqual(
        timelineActions.map(action => action.type),
        ["center"]
    );
    assert.deepEqual(
        decoratorCalls,
        [
            { id: "lifeEvents", centered: true },
            { id: "residences", centered: true }
        ]
    );
    assert.equal(bandSet.byId.residences.syncWith, 0);
    assert.equal(timeline.getBand(0).centers.length, 1);
    assert.equal(timeline.getBand(1).centers.length, 0);
});

test("vertical createTimeline soft-paints decorators after band presentation", () => {
    const { createBandSet, createTimeline } = loadBands();
    let softPaintCount = 0;
    const bandSet = createBandSet({
        orientation: "vertical",
        bands: [{
            id: "worldEras",
            width: "100%",
            intervalUnit: "month",
            intervalPixels: 100,
            decorators: [{
                softPaint() {
                    softPaintCount += 1;
                }
            }]
        }]
    });

    createTimeline({}, bandSet);

    assert.equal(softPaintCount, 1);
});

test("visual theme backgroundColor applies to band presentation", () => {
    const { createBandSet, createTimeline } = loadBands();
    const bandSet = createBandSet({
        visualTheme: "themeBackground",
        bands: [{
            id: "main",
            width: "100%",
            intervalUnit: "month",
            intervalPixels: 100
        }]
    });
    const timeline = createTimeline({}, bandSet);

    assert.equal(bandSet.byId.main.repriseBackgroundColor, "#224466");
    assert.equal(
        timeline.getBand(0)._div.properties.get(
            "--timeline-band-background-color"
        ),
        "#224466"
    );
});

test("band backgroundColor overrides visual theme backgroundColor", () => {
    const { createBandSet, createTimeline } = loadBands();
    const bandSet = createBandSet({
        visualTheme: "overrideBackground",
        bands: [{
            id: "main",
            width: "100%",
            intervalUnit: "month",
            intervalPixels: 100,
            backgroundColor: " #eeeeee "
        }]
    });
    const timeline = createTimeline({}, bandSet);

    assert.equal(bandSet.byId.main.repriseBackgroundColor, "#eeeeee");
    assert.equal(
        timeline.getBand(0)._div.properties.get(
            "--timeline-band-background-color"
        ),
        "#eeeeee"
    );
});

test("explicit null band backgroundColor suppresses visual theme fallback", () => {
    const { createBandSet, createTimeline } = loadBands();
    const bandSet = createBandSet({
        visualTheme: "themeBackground",
        bands: [{
            id: "main",
            width: "100%",
            intervalUnit: "month",
            intervalPixels: 100,
            backgroundColor: null
        }]
    });
    const timeline = createTimeline({}, bandSet);

    assert.equal(bandSet.byId.main.repriseBackgroundColor, null);
    assert.equal(
        timeline.getBand(0)._div.properties.has(
            "--timeline-band-background-color"
        ),
        false
    );
});

test("dark-mode band backgrounds use overridable cycling variables", () => {
    const css = fs.readFileSync(
        path.join(__dirname, "..", "src", "css", "dark-mode.css"),
        "utf8"
    );

    for (let index = 1; index <= 5; index++) {
        assert.match(
            css,
            new RegExp(`--timeline-reprise-band-bg-${index}\\s*:`)
        );
        assert.match(
            css,
            new RegExp(
                `\\.timeline-reprise-band-tone-${index}\\s+\\.timeline-ether-bg\\s*,\\s*` +
                `\\.timeline-band-${index - 1}\\s+\\.timeline-ether-bg\\s*\\{[^}]*` +
                `var\\(--timeline-band-background-color,\\s*var\\(--timeline-reprise-band-bg-${index}\\)\\)`,
                "s"
            )
        );
    }
    assert.match(
        css,
        /\.timeline-ether-lines\s*\{[^}]*border-color:\s*#ccc/s
    );
});

test("Reprise builds scalar-unit bands without native band-info assembly", () => {
    const { createBand, nativeBandCalls } = loadBands();
    const planningUnit = makeUnit();
    const bandInfo = createBand({
        unit: planningUnit,
        date: 20,
        interval: 10,
        intervalPixels: 90,
        intervalMarkers: false,
        markerAlign: "Top",
        visualTheme: "planning"
    });

    assert.equal(nativeBandCalls.length, 0);
    assert.equal(bandInfo.unit, planningUnit);
    assert.equal(bandInfo.ether.options.centersOn, 20);
    assert.equal(bandInfo.ether.options.interval, 10);
    assert.equal(bandInfo.eventSource._events.unit, planningUnit);
    assert.equal(bandInfo.theme.visualTheme, "planning");
    assert.equal(bandInfo.intervalMarkers, false);
    assert.equal(bandInfo.intervalLines, false);
    assert.equal(bandInfo.theme.ether.interval.line.show, false);
    assert.equal(bandInfo.markerAlign, "Top");
    assert.equal(bandInfo.etherPainter._intervalMarkers, false);
    assert.equal(bandInfo.etherPainter._markerAlign, "Top");
});

test("scalar-unit ether painting follows intervalLines and native opacity", () => {
    const { createBand } = loadBands();
    const unit = makeUnit();
    const hidden = createBand({
        unit,
        interval: 10,
        intervalPixels: 100,
        intervalMarkers: false
    });
    const visible = createBand({
        unit,
        interval: 10,
        intervalPixels: 100,
        intervalMarkers: false,
        intervalLines: true,
        etherTheme: {
            interval: { line: { opacity: 40 } }
        }
    });
    const document = {
        createElement() {
            return { className: "", style: {} };
        }
    };
    const makeLayer = () => ({
        children: [],
        set innerHTML(value) {
            this.children = [];
        },
        appendChild(child) {
            this.children.push(child);
        }
    });
    const band = {
        getLabeller: () => unit.createLabeller(),
        getMinDate: () => 0,
        getMaxDate: () => 20,
        getTotalViewLength: () => 300,
        dateToPixelOffset: value => value * 10
    };
    const timeline = {
        getUnit: () => unit,
        getDocument: () => document,
        isHorizontal: () => true
    };

    for (const bandInfo of [hidden, visible]) {
        Object.assign(bandInfo.etherPainter, {
            _band: band,
            _timeline: timeline,
            _lineLayer: makeLayer(),
            _markerLayer: makeLayer()
        });
        bandInfo.etherPainter.softPaint();
    }

    assert.equal(hidden.etherPainter._lineLayer.children.length, 0);
    assert.equal(visible.etherPainter._lineLayer.children.length, 3);
    assert.ok(visible.etherPainter._lineLayer.children.every(
        line => line.style.opacity === "0.4"
    ));
});

test("markerAlign is direct band behavior with band-set defaults", () => {
    const { createBandSet, nativeBandCalls } = loadBands();
    const bandSet = createBandSet({
        markerAlign: "Top",
        syncTarget: "main",
        bands: [
            {
                id: "main",
                intervalUnit: "month",
                intervalPixels: 100
            },
            {
                id: "overview",
                markerAlign: "Bottom",
                intervalUnit: "year",
                intervalPixels: 200
            }
        ]
    });

    assert.equal(bandSet.byId.main.markerAlign, "Top");
    assert.equal(bandSet.byId.overview.markerAlign, "Bottom");
    assert.equal(nativeBandCalls[0].align, "Top");
    assert.equal(nativeBandCalls[1].align, "Bottom");
    assert.equal(
        bandSet.byId.main.theme.ether.interval.marker.hAlign,
        "Bottom"
    );
});

test("markerLength inherits from a band set and supports per-band overrides", () => {
    const { createBandSet } = loadBands();
    const suppliedEtherTheme = {
        interval: { marker: { tickZIndex: 41 } }
    };
    const before = JSON.parse(JSON.stringify(suppliedEtherTheme));
    const bandSet = createBandSet({
        orientation: "horizontal",
        markerLength: "3rem",
        etherTheme: suppliedEtherTheme,
        syncTarget: "main",
        bands: [
            {
                id: "main",
                intervalUnit: "month",
                intervalPixels: 100
            },
            {
                id: "overview",
                markerLength: "label",
                intervalUnit: "year",
                intervalPixels: 200
            }
        ]
    });

    assert.equal(bandSet.byId.main.markerLength, "3rem");
    assert.equal(bandSet.byId.overview.markerLength, "label");
    assert.equal(
        bandSet.byId.main.theme.ether.interval.marker.hLength,
        "3rem"
    );
    assert.equal(
        bandSet.byId.overview.theme.ether.interval.marker.hLength,
        "label"
    );
    assert.equal(
        Object.hasOwn(
            bandSet.byId.main.theme.ether.interval.marker,
            "vLength"
        ),
        false
    );
    assert.deepEqual(suppliedEtherTheme, before);
});

test("vertical markerLength maps to vLength and preserves null", () => {
    const { createBandSet } = loadBands();
    const bandSet = createBandSet({
        orientation: "vertical",
        markerLength: "4em",
        syncTarget: "main",
        bands: [
            {
                id: "main",
                intervalUnit: "month",
                intervalPixels: 100
            },
            {
                id: "native-size",
                markerLength: null,
                intervalUnit: "year",
                intervalPixels: 200
            }
        ]
    });

    assert.equal(
        bandSet.byId.main.theme.ether.interval.marker.vLength,
        "4em"
    );
    assert.equal(
        bandSet.byId["native-size"].theme.ether.interval.marker.vLength,
        null
    );
    assert.equal(
        Object.hasOwn(
            bandSet.byId.main.theme.ether.interval.marker,
            "hLength"
        ),
        false
    );
});

test("omitted markerLength retains native defaults and invalid routes reject", () => {
    const { createBandSet } = loadBands();
    const bandSet = createBandSet({
        bands: [{
            id: "main",
            intervalUnit: "month",
            intervalPixels: 100
        }]
    });
    const marker = bandSet.byId.main.theme.ether.interval.marker;

    assert.equal(bandSet.byId.main.markerLength, undefined);
    assert.equal(Object.hasOwn(marker, "hLength"), false);
    assert.equal(Object.hasOwn(marker, "vLength"), false);

    for (const markerLength of [12, ""]) {
        assert.throws(
            () => createBandSet({
                markerLength,
                bands: [{
                    id: "main",
                    intervalUnit: "month",
                    intervalPixels: 100
                }]
            }),
            /markerLength must be a CSS length, 'label', or null/
        );
    }

    for (const field of ["hLength", "vLength", "hAlign", "vAlign"]) {
        assert.throws(
            () => createBandSet({
                etherTheme: {
                    interval: { marker: { [field]: "2em" } }
                },
                bands: [{
                    id: "main",
                    intervalUnit: "month",
                    intervalPixels: 100
                }]
            }),
            new RegExp(`${field} is not supported`)
        );
    }
});

test("historical-year markers align independently in BCE and CE", () => {
    const { Timeline, unitIntervalValues } = loadBands();
    const historicalYearUnit = {};
    Timeline.HistoricalYearUnit = historicalYearUnit;

    assert.deepEqual(
        Array.from(unitIntervalValues(
            historicalYearUnit,
            -3200,
            1100,
            500
        )),
        [-2999, -2499, -1999, -1499, -999, -499, 0, 500, 1000]
    );
});

test("scaled zones use the injected runtime for scalar and wrapper-unit bands", () => {
    const {
        createBandSet,
        nativeBandCalls,
        UnitScaledZoneEther
    } = loadBands();
    const unit = makeUnit();
    const projectedRanges = [];
    const runtime = {
        unit,
        labeller: unit.createLabeller(),
        projectTimeValue: value => unit.parseFromObject(value),
        projectTimeRange(value) {
            projectedRanges.push(value);
            return {
                start: unit.parseFromObject(value.start),
                end: unit.parseFromObject(value.end)
            };
        },
        readEventTime: () => null,
        render: () => ""
    };
    const bandSet = createBandSet({
        runtime,
        zones: [
            {
                id: "first",
                start: "10",
                end: "20",
                magnify: 2
            },
            {
                id: "second",
                start: "30",
                end: "40",
                magnify: 3
            }
        ],
        bands: [{
            id: "main",
            interval: 10,
            intervalPixels: 100,
            scaledZones: ["first", "second"]
        }]
    });

    assert.equal(projectedRanges.length, 2);
    assert.equal(nativeBandCalls.length, 0);
    assert.ok(bandSet.byId.main.ether instanceof UnitScaledZoneEther);
    assert.deepEqual(
        Array.from(
            bandSet.byId.main.ether.options.zones,
            zone => [zone.start, zone.end, zone.magnify]
        ),
        [[10, 20, 2], [30, 40, 3]]
    );
    assert.equal(bandSet.byId.main.repriseRuntime, runtime);
});

test("unit scaled-zone ether supports wrapper coordinates and overlapping zones", () => {
    const filename = path.join(__dirname, "..", "src", "scaled-zones.js");
    const source = fs.readFileSync(filename, "utf8")
        .replace(/^export\s*\{\s*UnitScaledZoneEther\s*\};?\s*$/m, "");
    const context = vm.createContext({ Timeline: {} });
    context.globalThis = context;
    context.window = context;
    vm.runInContext(
        `${source}
        globalThis.UnitScaledZoneEther = UnitScaledZoneEther;`,
        context,
        { filename }
    );

    class Coordinate {
        constructor(value) {
            this.value = value;
        }
    }
    const unit = {
        parseFromObject(value) {
            return value instanceof Coordinate
                ? value
                : new Coordinate(Number(value));
        },
        makeDefaultValue: () => new Coordinate(0),
        cloneValue: value => new Coordinate(value.value),
        toNumber: value => value.value,
        fromNumber: value => new Coordinate(value),
        compare: (left, right) => left.value - right.value,
        change: (value, delta) => new Coordinate(value.value + delta)
    };
    const ether = new context.UnitScaledZoneEther({
        centersOn: new Coordinate(0),
        interval: 10,
        pixelsPerInterval: 100,
        zones: [
            {
                start: new Coordinate(10),
                end: new Coordinate(20),
                magnify: 2
            },
            {
                start: new Coordinate(15),
                end: new Coordinate(25),
                magnify: 3
            }
        ]
    });
    ether.initialize({}, {
        getUnit: () => unit,
        getPixelLength: () => 0
    });

    assert.equal(ether.dateToPixelOffset(new Coordinate(5)), 50);
    assert.equal(ether.dateToPixelOffset(new Coordinate(15)), 200);
    assert.equal(ether.dateToPixelOffset(new Coordinate(20)), 500);
    assert.equal(ether.dateToPixelOffset(new Coordinate(30)), 700);
    assert.equal(ether.pixelOffsetToDate(500).value, 20);
    assert.equal(ether.pixelOffsetToDate(700).value, 30);
    assert.equal(ether.pixelOffsetToDate(-50).value, -5);
});

test("unit scaled-zone ether supports HistoricalYear and Ma units", () => {
    const zoneFilename = path.join(
        __dirname,
        "..",
        "src",
        "scaled-zones.js"
    );
    const unitsFilename = path.join(__dirname, "..", "src", "units.js");
    const zoneSource = fs.readFileSync(zoneFilename, "utf8")
        .replace(/^export\s*\{\s*UnitScaledZoneEther\s*\};?\s*$/m, "");
    const unitsSource = fs.readFileSync(unitsFilename, "utf8")
        .replace(/^export\s*\{[\s\S]*?\};?\s*$/m, "");
    const context = vm.createContext({ Timeline: {}, SimileAjax: {} });
    context.globalThis = context;
    context.window = context;
    vm.runInContext(
        `${zoneSource}
        ${unitsSource}
        globalThis.zoneUnitExports = {
            HistoricalYear,
            HistoricalYearUnit,
            Ma,
            MaUnit,
            UnitScaledZoneEther
        };`,
        context,
        { filename: zoneFilename }
    );

    const {
        HistoricalYear,
        HistoricalYearUnit,
        Ma,
        MaUnit,
        UnitScaledZoneEther
    } = context.zoneUnitExports;
    const historicalEther = new UnitScaledZoneEther({
        centersOn: new HistoricalYear(-100),
        interval: 10,
        pixelsPerInterval: 100,
        zones: [{
            start: new HistoricalYear(-50),
            end: new HistoricalYear(50),
            magnify: 2
        }]
    });
    historicalEther.initialize({}, {
        getUnit: () => HistoricalYearUnit,
        getPixelLength: () => 0
    });

    assert.equal(
        historicalEther.dateToPixelOffset(new HistoricalYear(-50)),
        500
    );
    assert.equal(
        historicalEther.dateToPixelOffset(new HistoricalYear(0)),
        1500
    );
    assert.equal(historicalEther.pixelOffsetToDate(1500).value, 0);

    const maEther = new UnitScaledZoneEther({
        centersOn: new Ma(250),
        interval: 10,
        pixelsPerInterval: 100,
        zones: [{
            start: new Ma(225),
            end: new Ma(190),
            magnify: 4
        }]
    });
    maEther.initialize({}, {
        getUnit: () => MaUnit,
        getPixelLength: () => 0
    });

    assert.equal(maEther.dateToPixelOffset(new Ma(225)), 250);
    assert.equal(maEther.dateToPixelOffset(new Ma(200)), 1250);
    assert.equal(maEther.pixelOffsetToDate(1250).value, 200);
});

test("a multi-band set requires one named synchronization target", () => {
    const { createBandSet } = loadBands();

    assert.throws(
        () => createBandSet({
            bands: [
                {
                    id: "main",
                    intervalUnit: "month",
                    intervalPixels: 100
                },
                {
                    id: "overview",
                    intervalUnit: "year",
                    intervalPixels: 200
                }
            ]
        }),
        /syncTarget is required/
    );

    const synchronized = createBandSet({
        syncTarget: "main",
        bands: [
            {
                id: "main",
                intervalUnit: "month",
                intervalPixels: 100
            },
            {
                id: "overview",
                intervalUnit: "year",
                intervalPixels: 200
            },
            {
                id: "detail",
                intervalUnit: "day",
                intervalPixels: 50
            }
        ]
    });

    assert.equal(synchronized.byId.main.syncWith, undefined);
    assert.equal(synchronized.byId.overview.syncWith, 0);
    assert.equal(synchronized.byId.detail.syncWith, 0);

    assert.throws(
        () => createBandSet({
            syncTarget: "main",
            bands: [
                {
                    id: "main",
                    intervalUnit: "month",
                    intervalPixels: 100
                },
                {
                    id: "overview",
                    intervalUnit: "year",
                    intervalPixels: 200,
                    syncWith: "main"
                }
            ]
        }),
        /bands\[1\]\.syncWith is not supported/
    );
});

test("intervalMarkers is direct band behavior with band-set defaults", () => {
    const { createBandSet } = loadBands();
    const bandSet = createBandSet({
        intervalMarkers: false,
        syncTarget: "main",
        bands: [
            {
                id: "main",
                intervalUnit: "month",
                intervalPixels: 100
            },
            {
                id: "overview",
                intervalMarkers: true,
                intervalUnit: "year",
                intervalPixels: 200
            }
        ]
    });

    assert.equal(bandSet.byId.main.intervalMarkers, false);
    assert.equal(bandSet.byId.overview.intervalMarkers, true);
    assert.equal(
        Object.hasOwn(
            bandSet.byId.main.theme.ether.interval.marker,
            "show"
        ),
        false
    );

    assert.throws(
        () => createBandSet({
            etherTheme: {
                interval: {
                    marker: { show: false }
                }
            },
            bands: [{
                id: "main",
                intervalUnit: "month",
                intervalPixels: 100
            }]
        }),
        /use intervalMarkers/
    );
    assert.throws(
        () => createBandSet({
            intervalMarkers: "no",
            bands: [{
                id: "main",
                intervalUnit: "month",
                intervalPixels: 100
            }]
        }),
        /intervalMarkers must be a boolean/
    );
    assert.throws(
        () => createBandSet({
            markerAlign: "center",
            bands: [{
                id: "main",
                intervalUnit: "month",
                intervalPixels: 100
            }]
        }),
        /markerAlign must be 'Top', 'Bottom', 'Left', or 'Right'/
    );
});

test("intervalLines is direct band behavior with band-set defaults", () => {
    const { createBandSet } = loadBands();
    const defaultsOff = createBandSet({
        bands: [{
            id: "main",
            intervalUnit: "month",
            intervalPixels: 100
        }]
    });
    const configured = createBandSet({
        intervalLines: true,
        syncTarget: "main",
        bands: [
            {
                id: "main",
                intervalUnit: "month",
                intervalPixels: 100
            },
            {
                id: "overview",
                intervalLines: false,
                intervalUnit: "year",
                intervalPixels: 200
            }
        ]
    });

    assert.equal(defaultsOff.byId.main.intervalLines, false);
    assert.equal(defaultsOff.byId.main.theme.ether.interval.line.show, false);
    assert.equal(configured.byId.main.intervalLines, true);
    assert.equal(configured.byId.main.theme.ether.interval.line.show, true);
    assert.equal(configured.byId.overview.intervalLines, false);
    assert.equal(configured.byId.overview.theme.ether.interval.line.show, false);

    assert.throws(
        () => createBandSet({
            etherTheme: {
                interval: { line: { show: true } }
            },
            bands: [{
                id: "main",
                intervalUnit: "month",
                intervalPixels: 100
            }]
        }),
        /use intervalLines/
    );
    assert.throws(
        () => createBandSet({
            intervalLines: "yes",
            bands: [{
                id: "main",
                intervalUnit: "month",
                intervalPixels: 100
            }]
        }),
        /intervalLines must be a boolean/
    );
});

test("band-set data sources belong to individual bands", () => {
    const { createBandSet } = loadBands();
    const sharedSource = {
        addMany() {}
    };

    assert.throws(
        () => createBandSet({
            eventSource: sharedSource,
            bands: [{
                id: "main",
                intervalUnit: "month",
                intervalPixels: 100
            }]
        }),
        /eventSource is not supported; event sources belong to individual bands/
    );

    const bandSet = createBandSet({
        syncTarget: "main",
        bands: [
            {
                id: "main",
                intervalUnit: "month",
                intervalPixels: 100,
                eventSource: sharedSource
            },
            {
                id: "overview",
                intervalUnit: "year",
                intervalPixels: 200
            }
        ]
    });

    assert.equal(bandSet.byId.main.eventSource, sharedSource);
    assert.notEqual(
        bandSet.byId.overview.eventSource,
        bandSet.byId.main.eventSource
    );
});
