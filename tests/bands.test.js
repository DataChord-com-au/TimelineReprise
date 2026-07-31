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
            const bands = bandInfos.map(() => ({
                _div: new FakeElement(),
                centers: [],
                setCenterVisibleDate(value) {
                    this.centers.push(value);
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

    function composeEventTheme(theme, selection) {
        theme.eventTheme = selection ?? { id: "default" };
        return theme.eventTheme;
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
        composeEventTheme,
        normalizeColorString,
        normalizeTimelineOrientation,
        resolveRepriseRuntime,
        resolveTimelineDateTimeUnit,
        validateSpecId
    });
    context.globalThis = context;
    context.window = context;

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
        eventTheme: "events",
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
    assert.equal(nativeBandCalls[0].theme.eventTheme, "events");
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

test("Reprise builds scalar-unit bands without native band-info assembly", () => {
    const { createBand, nativeBandCalls } = loadBands();
    const planningUnit = makeUnit();
    const bandInfo = createBand({
        unit: planningUnit,
        date: 20,
        interval: 10,
        intervalPixels: 90,
        intervalMarkers: false,
        eventTheme: "planning"
    });

    assert.equal(nativeBandCalls.length, 0);
    assert.equal(bandInfo.unit, planningUnit);
    assert.equal(bandInfo.ether.options.centersOn, 20);
    assert.equal(bandInfo.ether.options.interval, 10);
    assert.equal(bandInfo.eventSource._events.unit, planningUnit);
    assert.equal(bandInfo.theme.eventTheme, "planning");
    assert.equal(bandInfo.intervalMarkers, false);
    assert.equal(bandInfo.etherPainter._intervalMarkers, false);
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
