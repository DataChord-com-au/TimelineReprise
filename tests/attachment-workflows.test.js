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

function makeNativeTheme(visualTheme) {
    return {
        visualTheme,
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
        return { icon: event.getIcon(), elmt: null };
    };
    OriginalEventPainter.prototype._paintEventTape = function (
        _event,
        _track,
        _start,
        _end,
        color
    ) {
        return { color, elmt: { className: "native-tape", style: {} } };
    };
    OriginalEventPainter.prototype._paintEventLabel = function () {
        return { elmt: { className: "native-label", style: {} } };
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
        DateTime: {
            MILLISECOND: 0,
            SECOND: 1,
            MINUTE: 2,
            HOUR: 3,
            DAY: 4,
            WEEK: 5,
            MONTH: 6,
            YEAR: 7,
            DECADE: 8,
            CENTURY: 9,
            MILLENNIUM: 10
        },
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

function makeBand(Timeline, unit, visualTheme = null) {
    const records = [];
    const theme = makeNativeTheme(visualTheme);
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

function makePaintDocument() {
    const document = {
        createTextNode: text => ({ nodeType: 3, nodeValue: String(text) }),
        createElement: () => ({
            children: [],
            childNodes: [],
            className: "",
            innerHTML: "",
            ownerDocument: document,
            style: {},
            offsetWidth: 80,
            offsetHeight: 18,
            scrollWidth: 80,
            scrollHeight: 18,
            appendChild(child) {
                this.children.push(child);
                this.childNodes.push(child);
            },
            setAttribute(name, value) {
                this[name] = value;
            },
            removeAttribute(name) {
                delete this[name];
            },
            getBoundingClientRect() {
                return { width: this.offsetWidth, height: this.offsetHeight };
            }
        })
    };

    return document;
}

function paintAttachedGraphicColors(Timeline, unit, visualThemeSpec, eventOverrides = {}) {
    const visualTheme = new Timeline.VisualTheme({
        eventColorScope: "graphic",
        range: {
            iconColor: "theme-range",
            colors: ["theme-range"]
        },
        instant: {
            iconColor: "theme-instant"
        },
        ...visualThemeSpec
    });
    const { bandInfo, eventPainter, records, theme } = makeBand(
        Timeline,
        unit,
        visualTheme
    );
    const range = {
        start: 1,
        end: 4,
        title: "Range",
        tags: ["release"],
        ...eventOverrides
    };
    const instant = {
        date: 2,
        title: "Instant",
        tags: ["release"],
        ...eventOverrides
    };

    Timeline.attachEvents(bandInfo, [range, instant]);
    Timeline.attachNarrativeDecorators(bandInfo, [range, instant]);

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

    const eventRange = eventPainter._paintEventTape(
        records[0],
        0,
        10,
        40,
        "native-range",
        100,
        { iconWidth: 9, iconHeight: 9 },
        theme,
        0
    );
    const eventInstant = eventPainter._paintEventIcon(
        records[1],
        0,
        20,
        { iconWidth: 9, iconHeight: 9 },
        theme,
        0
    );

    const document = makePaintDocument();
    const layers = [];
    const band = {
        _theme: theme,
        _div: { className: "" },
        createLayerDiv(zIndex, className = "") {
            const layer = document.createElement("div");
            layer.zIndex = zIndex;
            layer.className = className;
            layers.push(layer);
            return layer;
        },
        removeLayerDiv() {},
        dateToPixelOffset: value => value,
        getLabeller: () => unit.createLabeller(),
        getViewOffset: () => 0,
        getViewLength: () => 200,
        getViewWidth: () => 200
    };
    const timeline = {
        getDocument: () => document,
        getUnit: () => unit,
        isHorizontal: () => true,
        isVertical: () => false
    };
    const decorator = bandInfo.decorators[0];

    decorator.initialize(band, timeline);
    decorator.paint();

    const eventInstantColor = /^theme-icon:([^:]+):/.exec(eventInstant.icon)?.[1] ??
        eventInstant.icon;

    return {
        eventRange: eventRange.color,
        eventInstant: eventInstantColor,
        narrativeRange: decorator._rangeRecords[0].spanElmt.style.backgroundColor,
        narrativeInstant: decorator._instantRecords[0].lineElmt.style.backgroundColor
    };
}

test("both attachment methods resolve the band VisualTheme by default", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const bandVisualTheme = new Timeline.VisualTheme({
        id: "band",
        range: { iconColor: "band-range" }
    });
    const { bandInfo, eventPainter, records } = makeBand(
        Timeline,
        unit,
        bandVisualTheme
    );

    Timeline.attachEvents(bandInfo, [{ date: 1, title: "Event" }]);
    Timeline.attachNarrativeDecorators(
        bandInfo,
        [{ startDate: 2, endDate: 3, title: "Narrative" }]
    );

    assert.equal(records[0].visualTheme, bandVisualTheme);
    assert.equal(eventPainter._params.visualTheme, bandVisualTheme);
    assert.equal(bandInfo.decorators[0]._visualTheme, bandVisualTheme);
    assert.equal(bandInfo.decorators[0]._ranges[0].visualTheme, bandVisualTheme);
});

test("attached event and narrative graphics use opted-in tag colors", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const colors = paintAttachedGraphicColors(Timeline, unit, {
        tagsToIconColor: { release: "tag-color" }
    });

    assert.deepEqual(colors, {
        eventRange: "tag-color",
        eventInstant: "tag-color",
        narrativeRange: "tag-color",
        narrativeInstant: "tag-color"
    });
});

test("attached event and narrative tags do not affect graphics without a matching theme map", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);

    for (const visualThemeSpec of [
        {},
        { tagsToIconColor: {} },
        { tagsToIconColor: { other: "tag-color" } }
    ]) {
        assert.deepEqual(
            paintAttachedGraphicColors(Timeline, unit, visualThemeSpec),
            {
                eventRange: "theme-range",
                eventInstant: "theme-instant",
                narrativeRange: "theme-range",
                narrativeInstant: "theme-instant"
            }
        );
    }
});

test("attached event and narrative event colors take precedence over tag colors", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const colors = paintAttachedGraphicColors(
        Timeline,
        unit,
        { tagsToIconColor: { release: "tag-color" } },
        { color: "event-color" }
    );

    assert.deepEqual(colors, {
        eventRange: "event-color",
        eventInstant: "event-color",
        narrativeRange: "event-color",
        narrativeInstant: "event-color"
    });
});

test("events and Narrative on one band can use different named and instance themes", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const themes = Timeline.loadVisualThemes([
        {
            id: "events",
            range: { iconColor: "event-range" }
        }
    ]);
    const narrativeTheme = new Timeline.VisualTheme({
        id: "narrative",
        instant: { iconColor: "narrative-instant" }
    });
    const bandTheme = new Timeline.VisualTheme({
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
        { visualTheme: "events" }
    );
    Timeline.attachNarrativeDecorators(
        bandInfo,
        [{ date: 3, title: "Narrative" }],
        { visualTheme: narrativeTheme }
    );

    assert.equal(records[0].visualTheme, themes.events);
    assert.equal(eventPainter._params.visualTheme, themes.events);
    assert.equal(bandInfo.decorators[0]._visualTheme, narrativeTheme);
    assert.equal(bandInfo.decorators[0]._instants[0].visualTheme, narrativeTheme);
    assert.equal(bandInfo.theme.visualTheme, bandTheme);
});

test("attachment options derive selected themes with boolean overrides", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const themes = Timeline.loadVisualThemes([{
        id: "residences",
        disableEmphasis: false,
        spans: true,
        dividers: true,
        labels: true,
        bubbles: true,
        tooltips: true
    }]);
    const { bandInfo, eventPainter, records } = makeBand(Timeline, unit);

    Timeline.attachEvents(
        bandInfo,
        [{ date: 1, title: "Event" }],
        {
            visualTheme: "residences",
            labels: false,
            bubbles: false
        }
    );
    Timeline.attachNarrativeDecorators(
        bandInfo,
        [{ start: 2, end: 3, title: "Narrative" }],
        {
            visualTheme: "residences",
            disableEmphasis: true,
            spans: false,
            dividers: false,
            labels: false,
            bubbles: false,
            tooltips: false
        }
    );

    assert.notEqual(records[0].visualTheme, themes.residences);
    assert.equal(records[0].visualTheme.labels, false);
    assert.equal(records[0].visualTheme.bubbles, false);
    assert.equal(records[0].visualTheme.tooltips, true);
    assert.equal(eventPainter._params.visualTheme, records[0].visualTheme);

    const narrativeTheme = bandInfo.decorators[0]._visualTheme;
    assert.notEqual(narrativeTheme, themes.residences);
    assert.equal(narrativeTheme.disableEmphasis, true);
    assert.equal(narrativeTheme.spans, false);
    assert.equal(narrativeTheme.dividers, false);
    assert.equal(narrativeTheme.labels, false);
    assert.equal(narrativeTheme.bubbles, false);
    assert.equal(narrativeTheme.tooltips, false);
    assert.equal(bandInfo.decorators[0]._ranges[0].visualTheme, narrativeTheme);

    assert.equal(themes.residences.labels, true);
    assert.equal(themes.residences.bubbles, true);
});

test("attachEvents and attachNarrativeDecorators share label.vertical.width", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const visualTheme = new Timeline.VisualTheme({
        label: {
            flow: "orthogonal",
            vertical: {
                width: 144,
                length: 333
            }
        },
        track: {
            vertical: {
                size: 40,
                gap: 8
            }
        }
    });
    const { bandInfo, eventPainter, records, theme } = makeBand(
        Timeline,
        unit,
        visualTheme
    );
    const band = {
        _theme: theme,
        getLabeller: () => unit.createLabeller()
    };
    const timeline = {
        getUnit: () => unit,
        isHorizontal: () => false,
        isVertical: () => true
    };

    Timeline.attachEvents(
        bandInfo,
        [{ start: 1, end: 2, title: "Event" }]
    );
    Timeline.attachNarrativeDecorators(
        bandInfo,
        [{ start: 1, end: 2, title: "Narrative" }]
    );

    eventPainter.initialize(band, timeline);
    bandInfo.decorators[0].initialize(band, timeline);

    assert.equal(records[0].visualTheme.label.vertical.width, 144);
    assert.equal(eventPainter._visualTheme.label.vertical.width, 144);
    assert.equal(bandInfo.decorators[0]._labelWidth, 144);
    assert.equal(bandInfo.decorators[0]._trackSize, 40);
    assert.equal(bandInfo.decorators[0]._trackGap, 8);
});

test("attachNarrativeDecorators uses root label.width", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const visualTheme = new Timeline.VisualTheme({
        label: {
            width: 144
        }
    });
    const { bandInfo, theme } = makeBand(Timeline, unit, visualTheme);
    const band = {
        _theme: theme,
        getLabeller: () => unit.createLabeller()
    };
    const timeline = {
        getUnit: () => unit,
        isHorizontal: () => false,
        isVertical: () => true
    };

    Timeline.attachNarrativeDecorators(
        bandInfo,
        [{ start: 1, end: 2, title: "Narrative" }]
    );

    bandInfo.decorators[0].initialize(band, timeline);

    assert.equal(bandInfo.decorators[0]._labelWidth, 144);
});

test("attachNarrativeDecorators ignores label.vertical.length for label sizing", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const visualTheme = new Timeline.VisualTheme({
        label: {
            flow: "orthogonal",
            vertical: {
                length: 160
            }
        }
    });
    const { bandInfo, theme } = makeBand(Timeline, unit, visualTheme);
    const band = {
        _theme: theme,
        getLabeller: () => unit.createLabeller()
    };
    const timeline = {
        getUnit: () => unit,
        isHorizontal: () => false,
        isVertical: () => true
    };

    Timeline.attachNarrativeDecorators(
        bandInfo,
        [{ start: 1, end: 2, title: "Narrative" }]
    );

    bandInfo.decorators[0].initialize(band, timeline);

    assert.equal(bandInfo.decorators[0]._labelWidth, null);
});

test("attachEvents accepts one band or an array of bands", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const firstTheme = new Timeline.VisualTheme({
        id: "first",
        instant: { iconColor: "orange" }
    });
    const secondTheme = new Timeline.VisualTheme({
        id: "second",
        instant: { iconColor: "purple" }
    });
    const first = makeBand(Timeline, unit, firstTheme);
    const second = makeBand(Timeline, unit, secondTheme);
    const events = [{ id: "shared", date: 1, title: "Shared event" }];

    Timeline.attachEvents(
        [first.bandInfo, second.bandInfo],
        events
    );

    assert.equal(first.records.length, 1);
    assert.equal(second.records.length, 1);
    assert.notEqual(first.records[0], second.records[0]);
    assert.equal(first.records[0].visualTheme, firstTheme);
    assert.equal(second.records[0].visualTheme, secondTheme);
    assert.equal(first.eventPainter._params.visualTheme, firstTheme);
    assert.equal(second.eventPainter._params.visualTheme, secondTheme);
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
    const displayProfile = new Timeline.DisplayProfile({
        id: "injected",
        label: {
            title: "custom-title"
        }
    });
    const visualTheme = new Timeline.VisualTheme({
        presentation: displayProfile
    });
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        render(template, event, context) {
            calls.push({ template, event, context });
            return `${template}:${event.title}:${context.surface}`;
        }
    });
    const secondBand = makeBand(Timeline, unit, visualTheme);

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
        "custom-title:Injected event:label"
    );
    assert.equal(
        secondBand.bandInfo.decorators[0]._instants[0].getText(),
        "custom-title:Injected narrative:label"
    );
    assert.equal(calls[0].context.visualTheme, visualTheme);
    assert.equal(calls[0].context.displayProfile, displayProfile);
    assert.equal(calls[0].context.unit, unit);
});

test("events and Narrative use the selected DisplayProfile through the default runtime", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    Timeline.loadDisplayProfiles([
        {
            id: "sharedDisplay",
            label: {
                title: "{prefix('Presented: ', title)}",
                caption: "{prefix('Details: ', caption)}"
            }
        }
    ]);
    Timeline.loadVisualThemes([
        {
            id: "presented",
            presentation: "sharedDisplay"
        }
    ]);
    const { bandInfo, records } = makeBand(Timeline, unit);

    Timeline.attachEvents(
        bandInfo,
        [{ date: 1, title: "Event" }],
        { visualTheme: "presented" }
    );
    Timeline.attachNarrativeDecorators(
        bandInfo,
        [{ date: 2, title: "Narrative", caption: "Chapter" }],
        { visualTheme: "presented" }
    );

    assert.equal(records[0].getText(), "Presented: Event");
    assert.equal(
        bandInfo.decorators[0]._instants[0].getText(),
        "Presented: Narrative"
    );
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
        },
        {
            unit: Timeline.HistoricalYearUnit,
            range: {
                start: -43,
                end: 14,
                title: "Historical range"
            },
            expectedValue: 57,
            expectedText: "57 years"
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
    const bandTheme = new Timeline.VisualTheme({
        range: { iconColor: "band-range" }
    });
    const attachmentTheme = new Timeline.VisualTheme({
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
        { visualTheme: attachmentTheme }
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

    assert.equal(eventPainter._visualTheme, attachmentTheme);
    assert.equal(records[0].visualTheme, attachmentTheme);
    assert.equal(painted.color, "attachment-range");
});

test("attached event tape and label DOM receive selected visual theme classes", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const attachmentTheme = new Timeline.VisualTheme({
        id: "attachment",
        label: {
            instantCssClass: "attachment-instant-label",
            rangeCssClass: "attachment-range-label"
        },
        range: {
            cssClass: "attachment-range"
        }
    });
    const { bandInfo, eventPainter, records, theme } = makeBand(
        Timeline,
        unit
    );

    Timeline.attachEvents(
        bandInfo,
        [{
            start: 1,
            end: 2,
            title: "Range",
            cssClass: "record-range",
            labelCssClass: "record-label"
        }],
        { visualTheme: attachmentTheme }
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

    const tape = eventPainter._paintEventTape(
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
    const label = eventPainter._paintEventLabel(
        records[0],
        "Range",
        10,
        20,
        60,
        8,
        theme,
        "timeline-event-label"
    );

    assert.match(
        tape.elmt.className,
        /\btimeline-event-attachment-tape\b/
    );
    assert.match(tape.elmt.className, /\battachment-range\b/);
    assert.match(tape.elmt.className, /\brecord-range\b/);
    assert.match(
        label.elmt.className,
        /\btimeline-event-attachment-label\b/
    );
    assert.match(
        label.elmt.className,
        /\btimeline-event-attachment-range-label\b/
    );
    assert.match(label.elmt.className, /\battachment-range-label\b/);
    assert.match(label.elmt.className, /\brecord-label\b/);
});

test("theme-icon painter wrappers retain the attached record context", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const attachmentTheme = new Timeline.VisualTheme({
        instant: { iconColor: "attachment-instant" }
    });
    const { bandInfo, eventPainter, records, theme } = makeBand(
        Timeline,
        unit
    );

    Timeline.attachEvents(
        bandInfo,
        [{ date: 1, title: "Instant", classname: "milestone" }],
        { visualTheme: attachmentTheme }
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

test("attachCardinalAxis uses the band's default native-date runtime", () => {
    const unit = makeNativeUnit();
    const Timeline = loadTimeline(unit);
    const { bandInfo } = makeBand(Timeline, unit);

    Timeline.attachCardinalAxis(bandInfo, {
        range: {
            start: "2020-02-15T00:00:00Z",
            end: "2020-12-15T00:00:00Z"
        },
        intervalUnit: "month",
        unitsPerCount: 1,
        countsPerMarker: 2,
        anchorValue: 1,
        startLabel: "Start",
        endLabel: "End",
        labelForIndex: index => String(index),
        labelEvery: 4
    }, {
        cssClass: "month-count-axis",
        showLine: false,
        showLabels: true,
        showTicks: false,
        unlabeledMarkerText: "--"
    });

    assert.equal(bandInfo.decorators.length, 1);
    const axis = bandInfo.decorators[0];
    assert.ok(axis instanceof Timeline.CardinalAxis);
    assert.equal(axis._startDate.toISOString(), "2020-02-15T00:00:00.000Z");
    assert.equal(axis._endDate.toISOString(), "2020-12-15T00:00:00.000Z");
    assert.equal(axis._unit, Timeline.DateTime.MONTH);
    assert.equal(axis._unitsPerCount, 1);
    assert.equal(axis._countsPerMarker, 2);
    assert.equal(axis._unitsPerMarker, 2);
    assert.equal(axis._anchorValue, 1);
    assert.equal(axis._anchor, "start");
    assert.equal(axis._finishing, "drop");
    assert.equal(axis._startLabel, "Start");
    assert.equal(axis._endLabel, "End");
    assert.equal(axis._background, false);
    assert.equal(axis._cssClass, "month-count-axis");
    assert.equal(axis._params.showLine, false);
    assert.equal(axis._params.showLabels, true);
    assert.equal(axis._params.showTicks, false);
    assert.equal(axis._params.labelEvery, 4);
    assert.equal(axis._params.unlabeledMarkerText, "--");
});

test("attachCardinalAxis accepts positive finite count scales", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const { bandInfo } = makeBand(Timeline, unit);

    Timeline.attachCardinalAxis(bandInfo, {
        range: { start: 0, end: 0.011 },
        intervalUnit: "day",
        unitsPerCount: 0.1,
        countsPerMarker: 0.1,
        finishing: "truncate"
    });

    const axis = bandInfo.decorators[0];
    assert.equal(axis._unitsPerCount, 0.1);
    assert.equal(axis._countsPerMarker, 0.1);
    assert.equal(axis._unitsPerMarker, 0.01);
});

test("cardinal markerLength inherits from its band and attachment overrides it", () => {
    const unit = makeNativeUnit();
    const Timeline = loadTimeline(unit);
    const inherited = makeBand(Timeline, unit);
    inherited.bandInfo.markerLength = "3rem";
    inherited.bandInfo.markerAlign = "Top";
    const inheritedThemeBefore = JSON.parse(JSON.stringify(inherited.theme));

    Timeline.attachCardinalAxis(inherited.bandInfo, {
        range: { start: "2020-01-01", end: "2020-02-01" },
        intervalUnit: "day"
    });

    const inheritedAxis = inherited.bandInfo.decorators[0];
    assert.equal(inheritedAxis._markerLength, "3rem");
    assert.equal(inheritedAxis._params.align, "Top");
    assert.deepEqual(inherited.theme, inheritedThemeBefore);

    for (const markerLength of ["label", null, "5em"]) {
        const fixture = makeBand(Timeline, unit);
        fixture.bandInfo.markerLength = "3rem";
        Timeline.attachCardinalAxis(fixture.bandInfo, {
            range: { start: "2020-01-01", end: "2020-02-01" },
            intervalUnit: "day"
        }, { markerLength });
        assert.equal(fixture.bandInfo.decorators[0]._markerLength, markerLength);
    }
});

test("Planning events and cardinal axes share the band's injected runtime", () => {
    const Timeline = loadTimeline();
    const unit = Timeline.PlanningDayUnit;
    const runtime = new Timeline.RepriseRuntime({ unit });
    const { bandInfo, records } = makeBand(Timeline, unit);
    bandInfo.repriseRuntime = runtime;

    Timeline.attachEvents(bandInfo, [
        { start: "3", end: 12, title: "Planning range" }
    ]);
    Timeline.attachCardinalAxis(bandInfo, {
        range: { start: 0, end: 50 },
        intervalUnit: "day",
        unitsPerCount: 5,
        countsPerMarker: 2,
        anchorValue: 0,
        anchor: "end",
        finishing: "truncate"
    });

    assert.equal(records[0].runtime, runtime);
    assert.equal(records[0].getStart(), 3);
    assert.equal(records[0].getEnd(), 12);
    assert.equal(bandInfo.decorators.length, 1);
    assert.equal(bandInfo.decorators[0]._runtime, runtime);
    assert.equal(bandInfo.decorators[0]._startDate, 0);
    assert.equal(bandInfo.decorators[0]._endDate, 50);
    assert.equal(bandInfo.decorators[0]._unit, Timeline.DateTime.DAY);
    assert.equal(bandInfo.decorators[0]._unitsPerCount, 5);
    assert.equal(bandInfo.decorators[0]._countsPerMarker, 2);
    assert.equal(bandInfo.decorators[0]._unitsPerMarker, 10);
    assert.equal(bandInfo.decorators[0]._anchorValue, 0);
    assert.equal(bandInfo.decorators[0]._anchor, "end");
    assert.equal(bandInfo.decorators[0]._finishing, "truncate");
});

test("attachCardinalAxis accepts a runtime override", () => {
    const unit = makeNativeUnit();
    const Timeline = loadTimeline(unit);
    const { bandInfo } = makeBand(Timeline, unit);
    const projectedStart = new Date("1948-08-23T00:00:00Z");
    const projectedEnd = new Date("1996-12-03T23:10:00Z");
    const range = { semantic: "life-range" };

    bandInfo.repriseRuntime = new Timeline.RepriseRuntime({
        unit,
        projectTimeRange() {
            throw new Error("band runtime should not be used");
        }
    });
    const override = new Timeline.RepriseRuntime({
        unit,
        projectTimeRange(value) {
            assert.equal(value, range);
            return {
                start: projectedStart,
                end: projectedEnd
            };
        }
    });

    Timeline.attachCardinalAxis(bandInfo, {
        range,
        intervalUnit: "year"
    }, {
        runtime: override
    });

    assert.equal(bandInfo.decorators[0]._startDate, projectedStart);
    assert.equal(bandInfo.decorators[0]._endDate, projectedEnd);
});

test("attachCardinalAxis inherits the band runtime for authored range projection", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const { bandInfo } = makeBand(Timeline, unit);
    const authoredRange = { domain: "range" };
    const projectedRange = { start: 11, end: 41 };
    const projected = [];
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        projectTimeRange(value) {
            projected.push(value);
            return projectedRange;
        }
    });
    bandInfo.repriseRuntime = runtime;

    Timeline.attachCardinalAxis(bandInfo, {
        range: authoredRange,
        intervalUnit: "day"
    });

    assert.deepEqual(projected, [authoredRange]);
    assert.equal(bandInfo.decorators[0]._runtime, runtime);
    assert.equal(bandInfo.decorators[0]._startDate, projectedRange.start);
    assert.equal(bandInfo.decorators[0]._endDate, projectedRange.end);
});

test("attachCardinalAxis uses the runtime cardinal-axis projection hook", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const { bandInfo } = makeBand(Timeline, unit);
    const authoredRange = { chronicle: "range" };
    const contexts = [];
    const markerAtIndex = index => [10, 17, 29, 44][index] ?? null;
    const indexAtValue = () => 2.5;
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        projectTimeRange() {
            throw new Error("projectTimeRange should not be used");
        },
        projectCardinalAxis(context) {
            contexts.push(context);
            return {
                range: { start: 10, end: 29 },
                markerAtIndex,
                indexAtValue
            };
        }
    });

    Timeline.attachCardinalAxis(bandInfo, {
        range: authoredRange,
        intervalUnit: "day",
        unitsPerCount: 7,
        countsPerMarker: 2,
        anchor: "end",
        finishing: "extend"
    }, {
        runtime
    });

    assert.equal(contexts.length, 1);
    assert.equal(contexts[0].range, authoredRange);
    assert.equal(contexts[0].intervalUnit, "day");
    assert.equal(contexts[0].resolvedIntervalUnit, Timeline.DateTime.DAY);
    assert.equal(contexts[0].unitsPerCount, 7);
    assert.equal(contexts[0].countsPerMarker, 2);
    assert.equal(contexts[0].anchor, "end");
    assert.equal(contexts[0].finishing, "extend");
    assert.equal(contexts[0].truncatePreviousMarkerThreshold, 0.4);
    assert.equal(bandInfo.decorators[0]._runtime, runtime);
    assert.equal(bandInfo.decorators[0]._startDate, 10);
    assert.equal(bandInfo.decorators[0]._endDate, 29);
    assert.equal(bandInfo.decorators[0]._markerAtIndex, markerAtIndex);
    assert.equal(bandInfo.decorators[0]._indexAtValue, indexAtValue);
});

test("legacy theme ids and unsupported flat decorator controls are rejected", () => {
    const unit = makeNumericUnit();
    const Timeline = loadTimeline(unit);
    const { bandInfo } = makeBand(Timeline, unit);

    assert.throws(
        () => Timeline.attachEvents(
            bandInfo,
            [],
            { visualThemeId: "old" }
        ),
        /options\.visualThemeId.*not supported/
    );
    assert.throws(
        () => Timeline.attachNarrativeDecorators(
            bandInfo,
            [],
            { labels: "no" }
        ),
        /labels must be a boolean/
    );
    assert.throws(
        () => Timeline.attachCardinalAxis(bandInfo, {
            range: { start: 0, end: 10 },
            intervalUnit: "day",
            multiple: 2
        }),
        /spec\.multiple.*not supported/
    );
    for (const visualField of [
        "markerLength",
        "markerTheme",
        "hLength",
        "vLength"
    ]) {
        assert.throws(
            () => Timeline.attachCardinalAxis(bandInfo, {
                range: { start: 0, end: 10 },
                intervalUnit: "day",
                [visualField]: "2em"
            }),
            new RegExp(`spec\\.${visualField}.*not supported`)
        );
    }
    assert.throws(
        () => Timeline.attachCardinalAxis(
            bandInfo,
            { range: { start: 0, end: 10 }, intervalUnit: "day" },
            { markerTheme: { vLength: "2em" } }
        ),
        /options\.markerTheme.*not supported/
    );
    assert.throws(
        () => Timeline.attachCardinalAxis(
            bandInfo,
            {
                range: { start: 0, end: 10 },
                intervalUnit: "day"
            },
            { align: null }
        ),
        /options\.align must be a string/
    );
    assert.throws(
        () => Timeline.attachCardinalAxis(
            bandInfo,
            {
                range: { start: 0, end: 10 },
                intervalUnit: "day"
            },
            { showLine: null }
        ),
        /options\.showLine must be a boolean/
    );
    assert.throws(
        () => Timeline.attachCardinalAxis(
            bandInfo,
            {
                range: { start: 0, end: 10 },
                intervalUnit: "day"
            },
            { showLabels: null }
        ),
        /options\.showLabels must be a boolean/
    );
    assert.throws(
        () => Timeline.attachCardinalAxis(
            bandInfo,
            {
                range: { start: 0, end: 10 },
                intervalUnit: "day"
            },
            { showTicks: null }
        ),
        /options\.showTicks must be a boolean/
    );
    for (const field of ["unitsPerCount", "countsPerMarker"]) {
        for (const value of [0, -0.1, Number.POSITIVE_INFINITY, NaN]) {
            assert.throws(
                () => Timeline.attachCardinalAxis(bandInfo, {
                    range: { start: 0, end: 10 },
                    intervalUnit: "day",
                    [field]: value
                }),
                new RegExp(`spec\\.${field} must be a positive finite number`)
            );
        }
    }
    assert.throws(
        () => Timeline.attachCardinalAxis(
            bandInfo,
            {
                range: { start: 0, end: 10 },
                intervalUnit: "day",
                labelEvery: 0
            }
        ),
        /spec\.labelEvery must be a positive integer/
    );
    assert.throws(
        () => Timeline.attachCardinalAxis(
            bandInfo,
            {
                range: { start: 0, end: 10 },
                intervalUnit: "day"
            },
            { labelEvery: 2 }
        ),
        /options\.labelEvery is not supported/
    );
    assert.throws(
        () => Timeline.attachCardinalAxis(
            bandInfo,
            {
                range: { start: 0, end: 10 },
                intervalUnit: "day"
            },
            { unlabeledMarkerText: null }
        ),
        /options\.unlabeledMarkerText must be a string/
    );
    assert.throws(
        () => Timeline.attachCardinalAxis(bandInfo, {
            range: { start: 0, end: 10 },
            intervalUnit: "day",
            anchor: "middle"
        }),
        /spec\.anchor must be 'start' or 'end'/
    );
    assert.throws(
        () => Timeline.attachCardinalAxis(bandInfo, {
            range: { start: 0, end: 10 },
            intervalUnit: "day",
            finishing: "snap"
        }),
        /spec\.finishing must be 'drop', 'truncate', or 'extend'/
    );
    assert.throws(
        () => Timeline.attachCardinalAxis(bandInfo, {
            range: { start: 0, end: 10 },
            intervalUnit: "day",
            truncatePreviousMarkerThreshold: 2
        }),
        /spec\.truncatePreviousMarkerThreshold must be a finite number from 0 to 1/
    );
    assert.throws(
        () => Timeline.attachCardinalAxis(bandInfo, {
            range: { start: 0 },
            intervalUnit: "day",
            anchor: "end"
        }),
        /concrete end when spec\.anchor is 'end'/
    );
    assert.throws(
        () => Timeline.attachCardinalAxis(
            bandInfo,
            {
                range: { start: 0, end: 10 },
                intervalUnit: "day"
            },
            {
                runtime: new Timeline.RepriseRuntime({
                    unit,
                    labeller: unit.createLabeller(),
                    projectCardinalAxis: () => ({
                        range: { start: 0, end: 10 },
                        markerAtIndex: () => 0,
                        indexAtValue: "2.5"
                    })
                })
            }
        ),
        /indexAtValue must be a function or null/
    );
});
