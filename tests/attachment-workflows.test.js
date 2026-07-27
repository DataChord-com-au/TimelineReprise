const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("@jest/globals");

function makeLabeller(prefix = "") {
    return {
        labelPrecise: value => `${prefix}precise:${String(value)}`,
        labelInterval: value => ({
            text: `${prefix}interval:${String(value)}`,
            emphasized: false
        })
    };
}

function makeNumericUnit() {
    return {
        parseFromObject(value) {
            if (value == null || value === "") return null;
            const number = Number(value);
            return Number.isFinite(number) ? number : null;
        },
        compare: (a, b) => a - b,
        earlier(a, b) {
            return this.compare(a, b) < 0 ? a : b;
        },
        later(a, b) {
            return this.compare(a, b) > 0 ? a : b;
        },
        createLabeller: () => makeLabeller("number-")
    };
}

function makeNativeUnit() {
    return {
        parseFromObject(value) {
            if (Object.prototype.toString.call(value) === "[object Date]") {
                return value;
            }
            return new Date(value);
        },
        compare: (a, b) => a.getTime() - b.getTime(),
        earlier(a, b) {
            return this.compare(a, b) < 0 ? a : b;
        },
        later(a, b) {
            return this.compare(a, b) > 0 ? a : b;
        },
        createLabeller: () => makeLabeller("native-")
    };
}

function makeWrappedUnit() {
    function Value(value) {
        this.value = Number(value);
    }

    return {
        Value,
        parseFromObject(value) {
            if (value instanceof Value) return value;
            const number = Number(value);
            return Number.isFinite(number) ? new Value(number) : null;
        },
        compare: (a, b) => b.value - a.value,
        earlier(a, b) {
            return this.compare(a, b) < 0 ? a : b;
        },
        later(a, b) {
            return this.compare(a, b) > 0 ? a : b;
        },
        createLabeller: () => makeLabeller("wrapped-")
    };
}

function makeNativeTheme(eventTheme) {
    return {
        eventTheme,
        event: {
            track: { height: 10, gap: 2, offset: 2 },
            overviewTrack: { offset: 20, tickHeight: 6, height: 2, gap: 1 },
            tape: { height: 4 },
            duration: { color: "native-blue" },
            instant: {
                icon: "native-icon",
                iconWidth: 10,
                iconHeight: 10,
                impreciseIconMargin: 3
            },
            label: { width: 200, maxLabelChar: 200, offsetFromLine: 3 },
            bubble: {}
        }
    };
}

function loadTimeline(defaultUnit = makeNumericUnit()) {
    function OriginalEventPainter(params) {
        this._params = params || {};
    }

    OriginalEventPainter.prototype.initialize = function (band, timeline) {
        this._band = band;
        this._timeline = timeline;
    };
    OriginalEventPainter.prototype._prepareForPainting = function () {};
    OriginalEventPainter.prototype._findFreeTrack = function () { return 0; };
    OriginalEventPainter.prototype._paintEventIcon = function (event) {
        event.getClassName();
        return { elmt: null };
    };
    OriginalEventPainter.prototype._paintEventTape = function (
        _event,
        _track,
        _start,
        _end,
        color
    ) {
        return { color, elmt: null };
    };
    OriginalEventPainter.prototype._paintEventLabel = function () {
        return { elmt: null };
    };
    OriginalEventPainter.prototype._showBubble = function () {};
    OriginalEventPainter.prototype.paint = function () {};
    OriginalEventPainter.prototype.softPaint = function () {};

    function GregorianDateLabeller(locale, timeZone) {
        this.locale = locale;
        this.timeZone = timeZone;
    }
    GregorianDateLabeller.prototype.labelPrecise = value => String(value);
    GregorianDateLabeller.prototype.labelInterval = value => ({
        text: String(value),
        emphasized: false
    });

    const Timeline = {
        EventUtils: {
            getNewEventID() {
                this.nextId = (this.nextId || 0) + 1;
                return `test-event-${this.nextId}`;
            }
        },
        getDefaultLocale: () => "en",
        GregorianDateLabeller,
        NativeDateUnit: defaultUnit,
        OriginalEventPainter,
        ThemeIcons: {
            getCssColor: color => color === "orange" ? "#e28a2e" : color,
            get: (color, size) => `theme-icon:${color}:${size}`
        }
    };
    const SimileAjax = { NativeDateUnit: defaultUnit };
    const window = { SimileAjax, Timeline };
    const context = vm.createContext({
        Date,
        SimileAjax,
        Timeline,
        globalThis: window,
        window
    });
    const filename = path.join(__dirname, "..", "dist", "timeline-reprise.js");

    vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
    return Timeline;
}

function makeBand(Timeline, unit, eventTheme = null) {
    const records = [];
    const theme = makeNativeTheme(eventTheme);
    const eventSource = {
        _events: {
            getUnit: () => unit
        },
        addMany(events) {
            records.push(...events);
        }
    };
    const eventPainter = new Timeline.OriginalEventPainter({ theme });

    return {
        bandInfo: {
            width: "100%",
            eventSource,
            eventPainter,
            labeller: unit.createLabeller(),
            theme
        },
        eventPainter,
        records,
        theme
    };
}

test("both attachment methods resolve the band EventTheme by default", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const bandEventTheme = new Timeline.EventTheme({
        id: "band",
        range: { iconColor: "band-range" }
    });
    const { bandInfo, eventPainter, records } = makeBand(
        Timeline,
        unit,
        bandEventTheme
    );

    Timeline.attachEvents(bandInfo, [{ date: 1, title: "Event" }]);
    Timeline.attachNarrativeDecorators(
        bandInfo,
        [{ startDate: 2, endDate: 3, title: "Narrative" }]
    );

    assert.equal(records[0].eventTheme, bandEventTheme);
    assert.equal(eventPainter._params.eventTheme, bandEventTheme);
    assert.equal(bandInfo.decorators[0]._eventTheme, bandEventTheme);
    assert.equal(bandInfo.decorators[0]._ranges[0].eventTheme, bandEventTheme);
});

test("events and Narrative on one band can use different named and instance themes", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const themes = Timeline.loadEventThemes([
        {
            id: "events",
            range: { iconColor: "event-range" }
        }
    ]);
    const narrativeTheme = new Timeline.EventTheme({
        id: "narrative",
        instant: { iconColor: "narrative-instant" }
    });
    const bandTheme = new Timeline.EventTheme({
        id: "band",
        instant: { iconColor: "band-instant" }
    });
    const { bandInfo, eventPainter, records } = makeBand(
        Timeline,
        unit,
        bandTheme
    );

    Timeline.attachEvents(
        bandInfo,
        [{ start: 1, end: 2, title: "Event" }],
        { eventTheme: "events" }
    );
    Timeline.attachNarrativeDecorators(
        bandInfo,
        [{ date: 3, title: "Narrative" }],
        { eventTheme: narrativeTheme }
    );

    assert.equal(records[0].eventTheme, themes.events);
    assert.equal(eventPainter._params.eventTheme, themes.events);
    assert.equal(bandInfo.decorators[0]._eventTheme, narrativeTheme);
    assert.equal(bandInfo.decorators[0]._instants[0].eventTheme, narrativeTheme);
    assert.equal(bandInfo.theme.eventTheme, bandTheme);
});

test("both methods use the same default and injected runtime path", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const firstBand = makeBand(Timeline, unit);

    Timeline.attachEvents(
        firstBand.bandInfo,
        [{ date: 0, title: "Default event" }]
    );
    Timeline.attachNarrativeDecorators(
        firstBand.bandInfo,
        [{ date: 1, title: "Default narrative" }]
    );

    assert.ok(firstBand.records[0].runtime instanceof Timeline.RepriseRuntime);
    assert.ok(
        firstBand.bandInfo.decorators[0]._instants[0].runtime instanceof
            Timeline.RepriseRuntime
    );
    assert.equal(firstBand.records[0].getText(), "Default event");

    const calls = [];
    const eventTheme = new Timeline.EventTheme({
        presentation: {
            title: { template: "${opaque.title}" }
        }
    });
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        render(template, event, context) {
            calls.push({ template, event, context });
            return `${template}:${event.title}:${context.surface}`;
        }
    });
    const secondBand = makeBand(Timeline, unit, eventTheme);

    Timeline.attachEvents(
        secondBand.bandInfo,
        [{ date: 2, title: "Injected event" }],
        { runtime }
    );
    Timeline.attachNarrativeDecorators(
        secondBand.bandInfo,
        [{ date: 3, title: "Injected narrative" }],
        { runtime }
    );

    assert.equal(secondBand.records[0].runtime, runtime);
    assert.equal(secondBand.bandInfo.decorators[0]._runtimeSelection, runtime);
    assert.equal(
        secondBand.records[0].getText(),
        "${opaque.title}:Injected event:label"
    );
    assert.equal(
        secondBand.bandInfo.decorators[0]._instants[0].getText(),
        "${opaque.title}:Injected narrative:label"
    );
    assert.equal(calls[0].context.eventTheme, eventTheme);
    assert.equal(calls[0].context.unit, unit);
});

test("automatically created runtimes derive durations for both attachment workflows", () => {
    const Timeline = loadTimeline();
    const fixtures = [
        {
            unit: Timeline.PlanningDayUnit,
            range: { start: 0, end: 12, title: "Planning range" },
            expectedValue: 12,
            expectedText: "12 days"
        },
        {
            unit: Timeline.MaUnit,
            range: {
                start: new Timeline.Ma(225),
                end: new Timeline.Ma(190),
                title: "Ma range"
            },
            expectedValue: 35,
            expectedText: "35 Ma"
        }
    ];

    for (const fixture of fixtures) {
        const { bandInfo, records } = makeBand(Timeline, fixture.unit);

        Timeline.attachEvents(bandInfo, [fixture.range]);
        Timeline.attachNarrativeDecorators(bandInfo, [fixture.range]);

        const attached = [
            records[0],
            bandInfo.decorators[0]._ranges[0]
        ];
        for (const record of attached) {
            let context;
            const runtime = new Timeline.RepriseRuntime({
                unit: record.runtime.unit,
                labeller: record.runtime.labeller,
                render(_template, _event, renderContext) {
                    context = renderContext;
                    return renderContext.duration?.text ?? "";
                }
            });
            const rendered = runtime.render(null, record, {
                field: "bubbleDuration",
                target: "html",
                eventTime: record.eventTime
            });

            assert.equal(rendered, fixture.expectedText);
            assert.equal(context.duration.value, fixture.expectedValue);
            assert.equal(context.duration.text, fixture.expectedText);
        }
    }
});

test("both workflows take auxiliary endpoints from injected canonical event time", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const { bandInfo, records } = makeBand(Timeline, unit);
    const source = {
        title: "Domain range",
        latestStart: { domainValue: "latest start" },
        earliestEnd: { domainValue: "earliest end" }
    };
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        readEventTime() {
            return {
                kind: "range",
                start: 1,
                latestStart: 3,
                earliestEnd: 7,
                end: 9
            };
        }
    });

    Timeline.attachEvents(bandInfo, [source], { runtime });
    Timeline.attachNarrativeDecorators(bandInfo, [source], { runtime });

    const eventRecord = records[0];
    const narrativeRecord = bandInfo.decorators[0]._ranges[0];
    for (const record of [eventRecord, narrativeRecord]) {
        assert.equal(record.getStart(), 1);
        assert.equal(record.getLatestStart(), 3);
        assert.equal(record.getEarliestEnd(), 7);
        assert.equal(record.getEnd(), 9);
        assert.equal(record.isImprecise(), true);
    }
});

test("default native attachment creates the band's Gregorian labeller", () => {
    const unit = makeNativeUnit();
    delete unit.createLabeller;
    const Timeline = loadTimeline(unit);
    const records = [];
    const theme = makeNativeTheme(null);
    const bandInfo = {
        eventSource: {
            _events: { getUnit: () => unit },
            addMany(events) {
                records.push(...events);
            }
        },
        eventPainter: new Timeline.OriginalEventPainter({ theme }),
        locale: "en",
        timeZone: 9.5,
        theme
    };

    Timeline.attachEvents(
        bandInfo,
        [{ date: new Date("2020-01-01T00:00:00Z"), title: "Native" }]
    );

    assert.ok(records[0].runtime.labeller instanceof Timeline.GregorianDateLabeller);
    assert.equal(records[0].runtime.labeller.locale, "en");
    assert.equal(records[0].runtime.labeller.timeZone, 9.5);
});

test("both methods share colour and structured bubble-field preparation", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const { bandInfo, records } = makeBand(Timeline, unit);
    const source = {
        date: 1,
        title: "Prepared",
        color: "orange",
        location: "Adelaide",
        people: ["Ada", "Grace"],
        tags: ["release"]
    };

    Timeline.attachEvents(bandInfo, [source]);
    Timeline.attachNarrativeDecorators(bandInfo, [source]);

    const eventRecord = records[0];
    const narrativeRecord = bandInfo.decorators[0]._instants[0];
    for (const record of [eventRecord, narrativeRecord]) {
        assert.equal(record.getProperty("color"), "#e28a2e");
        assert.equal(record.getProperty("bubbleLocation"), "Adelaide");
        assert.deepEqual(
            Array.from(record.getProperty("bubblePeople")),
            ["Ada", "Grace"]
        );
        assert.deepEqual(
            Array.from(record.getProperty("bubbleTags")),
            ["release"]
        );
    }
});

test("both workflows preserve native, numeric, and wrapped unit values", () => {
    const native = makeNativeUnit();
    const numeric = makeNumericUnit();
    const wrapped = makeWrappedUnit();
    const fixtures = [
        {
            unit: native,
            instant: new Date("2020-01-01T00:00:00Z"),
            start: new Date("2020-02-01T00:00:00Z"),
            end: new Date("2020-03-01T00:00:00Z"),
            assertValue: value =>
                assert.equal(
                    Object.prototype.toString.call(value),
                    "[object Date]"
                )
        },
        {
            unit: numeric,
            instant: 0,
            start: "2",
            end: 5,
            assertValue: value => assert.equal(typeof value, "number")
        },
        {
            unit: wrapped,
            instant: new wrapped.Value(75),
            start: new wrapped.Value(50),
            end: new wrapped.Value(100),
            assertValue: value => assert.ok(value instanceof wrapped.Value)
        }
    ];

    for (const fixture of fixtures) {
        const Timeline = loadTimeline(fixture.unit);
        const { bandInfo, records } = makeBand(Timeline, fixture.unit);

        Timeline.attachEvents(bandInfo, [
            { date: fixture.instant, title: "Instant" },
            {
                startDate: fixture.start,
                endDate: fixture.end,
                title: "Range"
            }
        ]);
        Timeline.attachNarrativeDecorators(bandInfo, [
            { date: fixture.instant, title: "Narrative instant" },
            {
                startDate: fixture.start,
                endDate: fixture.end,
                title: "Narrative range"
            }
        ]);

        fixture.assertValue(records[0].getStart());
        fixture.assertValue(records[1].getStart());
        fixture.assertValue(records[1].getEnd());
        assert.equal(records[0].eventTime.kind, "instant");
        assert.equal(records[1].eventTime.kind, "range");
        assert.equal(bandInfo.decorators[0]._instants[0].eventTime.kind, "instant");
        assert.equal(bandInfo.decorators[0]._ranges[0].eventTime.kind, "range");
    }
});

test("an attached event keeps its selected theme through painter initialization and painting", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const bandTheme = new Timeline.EventTheme({
        range: { iconColor: "band-range" }
    });
    const attachmentTheme = new Timeline.EventTheme({
        range: { iconColor: "attachment-range" }
    });
    const { bandInfo, eventPainter, records, theme } = makeBand(
        Timeline,
        unit,
        bandTheme
    );

    Timeline.attachEvents(
        bandInfo,
        [{ start: 1, end: 2, title: "Range" }],
        { eventTheme: attachmentTheme }
    );

    const band = {
        _theme: theme,
        getLabeller: () => unit.createLabeller()
    };
    const timeline = {
        getUnit: () => unit,
        isHorizontal: () => false,
        isVertical: () => false
    };

    eventPainter.initialize(band, timeline);
    const painted = eventPainter._paintEventTape(
        records[0],
        0,
        10,
        20,
        "native-blue",
        100,
        {},
        theme,
        0
    );

    assert.equal(eventPainter._eventTheme, attachmentTheme);
    assert.equal(records[0].eventTheme, attachmentTheme);
    assert.equal(painted.color, "attachment-range");
});

test("theme-icon painter wrappers retain the attached record context", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const attachmentTheme = new Timeline.EventTheme({
        instant: { iconColor: "attachment-instant" }
    });
    const { bandInfo, eventPainter, records, theme } = makeBand(
        Timeline,
        unit
    );

    Timeline.attachEvents(
        bandInfo,
        [{ date: 1, title: "Instant", classname: "milestone" }],
        { eventTheme: attachmentTheme }
    );
    eventPainter.initialize(
        {
            _theme: theme,
            getLabeller: () => unit.createLabeller()
        },
        {
            getUnit: () => unit,
            isHorizontal: () => false,
            isVertical: () => false
        }
    );

    assert.doesNotThrow(() => eventPainter._paintEventIcon(
        records[0],
        0,
        10,
        { iconWidth: 9, iconHeight: 9 },
        theme,
        0
    ));
});

test("legacy theme ids and flat decorator controls are rejected", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const { bandInfo } = makeBand(Timeline, unit);

    assert.throws(
        () => Timeline.attachEvents(
            bandInfo,
            [],
            { eventThemeId: "old" }
        ),
        /options\.eventThemeId.*not supported/
    );
    assert.throws(
        () => Timeline.attachNarrativeDecorators(
            bandInfo,
            [],
            { spans: false }
        ),
        /options\.spans.*not supported/
    );
});
