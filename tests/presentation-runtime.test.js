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

function makeNativeDateUnit() {
    return {
        parseFromObject(value) {
            if (Object.prototype.toString.call(value) === "[object Date]") return value;
            return new Date(value);
        },
        compare(a, b) {
            return a.getTime() - b.getTime();
        },
        toNumber(value) {
            return value.getTime();
        },
        createLabeller() {
            return makeLabeller();
        }
    };
}

function makePlanningUnit() {
    return {
        parseFromObject(value) {
            if (value == null || value === "") return null;
            const number = Number(value);
            return Number.isFinite(number) ? number : null;
        },
        compare: (a, b) => a - b,
        toNumber: value => value,
        createLabeller: () => makeLabeller("day-")
    };
}

function makeGeochronoUnit() {
    function MA(value) {
        this.value = value;
    }

    return {
        MA,
        parseFromObject(value) {
            if (value instanceof MA) return value;
            const number = Number(value);
            return Number.isFinite(number) ? new MA(number) : null;
        },
        compare(a, b) {
            return b.value - a.value;
        },
        toNumber: value => -value.value,
        createLabeller() {
            return {
                labelPrecise: value => `${value.value}ma`,
                labelInterval: value => ({
                    text: `${value.value}ma`,
                    emphasized: false
                })
            };
        }
    };
}

function loadTimeline() {
    function OriginalEventPainter(params) {
        this._params = params || {};
    }
    function OverviewEventPainter(params) {
        this._params = params || {};
    }

    OriginalEventPainter.prototype.initialize = function (band, timeline) {
        this._band = band;
        this._timeline = timeline;
    };
    OriginalEventPainter.prototype._prepareForPainting = function () {};
    OriginalEventPainter.prototype._findFreeTrack = function () { return 0; };
    function paintedData(painter, width = 80, height = 18, evt = null) {
        const elmt = painter._timeline.getDocument().createElement("div");
        const caption = evt?.getProperty?.("caption");
        if (caption != null && caption !== "") elmt.title = String(caption);
        return { left: 0, top: 0, width, height, elmt };
    }

    OriginalEventPainter.prototype._paintEventIcon = function (evt) {
        return paintedData(this, 9, 9, evt);
    };
    OriginalEventPainter.prototype._paintEventTape = function (evt) {
        return paintedData(this, 80, 4, evt);
    };
    OriginalEventPainter.prototype._paintEventLabel = function (evt) {
        return paintedData(this, 80, 18, evt);
    };
    OriginalEventPainter.prototype._showBubble = function () {};
    OriginalEventPainter.prototype.paint = function () {};
    OriginalEventPainter.prototype.softPaint = function () {};
    OverviewEventPainter.prototype.initialize = function () {};
    OverviewEventPainter.prototype._paintEventTick = function () {};
    OverviewEventPainter.prototype._paintEventTape = function () {};
    OverviewEventPainter.prototype.paint = function () {};

    const NativeDateUnit = makeNativeDateUnit();
    const Timeline = {
        NativeDateUnit,
        OriginalEventPainter,
        OverviewEventPainter,
        ThemeIcons: {
            getCssColor: color => color,
            get: () => null
        }
    };
    const bubbleCalls = [];
    const SimileAjax = {
        NativeDateUnit,
        WindowManager: {
            cancelPopups() {}
        },
        Graphics: {
            createBubbleForContentAndPoint(...args) {
                bubbleCalls.push(args);
                return args[0];
            }
        },
        DOM: {
            cancelEvent() {}
        }
    };
    const window = { Timeline, SimileAjax };
    const context = vm.createContext({
        Date,
        SimileAjax,
        Timeline,
        window
    });
    const filename = path.join(__dirname, "..", "dist", "timeline-reprise.js");

    vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
    return { Timeline, SimileAjax, bubbleCalls };
}

function makeDocument() {
    const doc = {
        createElement(tagName) {
            const element = {
                tagName: String(tagName).toUpperCase(),
                ownerDocument: doc,
                childNodes: [],
                style: {},
                className: "",
                attributes: {},
                innerHTML: "",
                textContent: "",
                offsetWidth: 80,
                offsetHeight: 18,
                scrollWidth: 80,
                scrollHeight: 18,
                appendChild(child) {
                    this.childNodes.push(child);
                    child.parentNode = this;
                    return child;
                },
                setAttribute(name, value) {
                    this.attributes[name] = value;
                },
                removeAttribute(name) {
                    delete this.attributes[name];
                },
                getAttribute(name) {
                    return this.attributes[name] ?? null;
                },
                getBoundingClientRect() {
                    return {
                        left: 0,
                        top: 0,
                        width: this.offsetWidth,
                        height: this.offsetHeight
                    };
                }
            };
            return element;
        },
        createTextNode(value) {
            return {
                nodeType: 3,
                nodeValue: String(value),
                ownerDocument: doc
            };
        }
    };

    doc.defaultView = {
        innerWidth: 1024,
        innerHeight: 768,
        pageXOffset: 0,
        pageYOffset: 0
    };
    doc.documentElement = { clientWidth: 1024, clientHeight: 768 };
    doc.body = doc.createElement("body");

    return doc;
}

function makeNativeTheme(visualTheme) {
    return {
        visualTheme,
        event: {
            track: {},
            tape: {},
            instant: {},
            label: {},
            bubble: {
                imageStyler(element) {
                    element.className = "timeline-event-bubble-image";
                },
                titleStyler(element) {
                    element.className = "timeline-event-bubble-title";
                },
                bodyStyler(element) {
                    element.className = "timeline-event-bubble-body";
                }
            }
        }
    };
}

function paintNarrative(Timeline, runtime, ranges, instants, visualThemeConfig = {}) {
    const doc = makeDocument();
    const layers = [];
    const visualTheme = new Timeline.VisualTheme(visualThemeConfig);
    const nativeTheme = makeNativeTheme(visualTheme);
    const unit = runtime.unit;
    const band = {
        _theme: nativeTheme,
        createLayerDiv(_zIndex, className = "") {
            const layer = doc.createElement("div");
            layer.className = className;
            layers.push(layer);
            return layer;
        },
        removeLayerDiv() {},
        dateToPixelOffset(value) {
            return unit.toNumber ? unit.toNumber(value) : Number(value);
        },
        getLabeller: () => runtime.labeller,
        getViewLength: () => 1000,
        getViewOffset: () => 0,
        getViewWidth: () => 240
    };
    const timeline = {
        getDocument: () => doc,
        getUnit: () => unit,
        isHorizontal: () => true,
        isVertical: () => false
    };
    const decorator = new Timeline.NarrativeDecorator({
        runtime,
        ranges,
        instants
    });

    decorator.initialize(band, timeline);
    decorator.paint();
    return { decorator, doc, layers, nativeTheme };
}

function hasClass(element, className) {
    return String(element?.className ?? "")
        .split(/\s+/)
        .includes(className);
}

function childWithClass(element, className) {
    return element.childNodes.find(child => hasClass(child, className));
}

function showCaptionTooltip(doc, element, event = { clientX: 20, clientY: 20 }) {
    element.onmouseenter(event);
    return childWithClass(doc.body, "timeline-reprise-tooltip");
}

test("NativeDateUnit parses JavaScript Date values through the unit contract", () => {
    const { Timeline } = loadTimeline();
    const unit = makeNativeDateUnit();
    const values = [];
    const parse = unit.parseFromObject;
    unit.parseFromObject = value => {
        values.push(value);
        return parse(value);
    };
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const date = new Date("2020-03-02T00:00:00Z");
    const eventTime = runtime.readEventTime({ date });

    assert.equal(eventTime.kind, "instant");
    assert.equal(eventTime.value, date);
    assert.deepEqual(values, [date]);
});

test("planning-style zero and numeric range values are valid event times", () => {
    const { Timeline } = loadTimeline();
    const unit = makePlanningUnit();
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });

    const instant = runtime.readEventTime({ date: 0 });
    const range = runtime.readEventTime({ startDate: "3", endDate: 12 });

    assert.equal(instant.kind, "instant");
    assert.equal(instant.value, 0);
    assert.equal(range.kind, "range");
    assert.equal(range.start, 3);
    assert.equal(range.end, 12);
});

test("default runtime includes parsed auxiliary endpoints in canonical event time", () => {
    const { Timeline } = loadTimeline();
    const unit = makePlanningUnit();
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });

    const eventTime = runtime.readEventTime({
        startDate: 3,
        latestStart: "5",
        earliestEnd: "9",
        endDate: 12
    });

    assert.equal(eventTime.kind, "range");
    assert.equal(eventTime.start, 3);
    assert.equal(eventTime.latestStart, 5);
    assert.equal(eventTime.earliestEnd, 9);
    assert.equal(eventTime.end, 12);
});

test("default runtime reads auxiliary endpoints from canonical eventTime", () => {
    const { Timeline } = loadTimeline();
    const unit = makePlanningUnit();
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });

    const eventTime = runtime.readEventTime({
        eventTime: {
            kind: "range",
            start: 3,
            latestStart: "5",
            earliestEnd: "9",
            end: 12
        }
    });

    assert.equal(eventTime.latestStart, 5);
    assert.equal(eventTime.earliestEnd, 9);
});

test("geochrono wrappers retain their shape and normalize reversed chronology with unit.compare", () => {
    const { Timeline } = loadTimeline();
    const unit = makeGeochronoUnit();
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const newer = new unit.MA(50);
    const older = new unit.MA(100);
    const eventTime = runtime.readEventTime({
        startDate: newer,
        endDate: older
    });

    assert.equal(eventTime.kind, "range");
    assert.equal(eventTime.start, older);
    assert.equal(eventTime.end, newer);
});

test("HistoricalYearUnit uses astronomical raw years with BCE and CE labels", () => {
    const { Timeline } = loadTimeline();
    const unit = Timeline.HistoricalYearUnit;
    const labeller = unit.createLabeller();
    const twoBce = new Timeline.HistoricalYear(-1);
    const oneBce = unit.parseFromObject(0);
    const oneCe = unit.parseFromObject("1");
    const fortyFourBce = unit.parseFromObject({ value: -43 });

    assert.equal(unit.HistoricalYear, Timeline.HistoricalYear);
    assert.equal(unit.getParser(), unit.parseFromObject);
    assert.equal(unit.parseFromObject(twoBce), twoBce);
    assert.equal(unit.parseFromObject(1.5), null);
    assert.equal(unit.parseFromObject(true), null);
    assert.equal(unit.parseFromObject(""), null);
    assert.throws(
        () => new Timeline.HistoricalYear(1.5),
        /finite integer/
    );

    assert.equal(twoBce.value, -1);
    assert.equal(Number(twoBce), -1);
    assert.equal(String(twoBce), "2 BCE");
    assert.equal(String(oneBce), "1 BCE");
    assert.equal(String(oneCe), "1 CE");
    assert.equal(String(fortyFourBce), "44 BCE");
    assert.notEqual(
        Object.prototype.toString.call(fortyFourBce),
        "[object Date]"
    );

    assert.equal(labeller.labelPrecise(fortyFourBce), "44 BCE");
    assert.equal(labeller.labelInterval(oneBce).text, "1 BCE");
    assert.equal(labeller.labelInterval(oneCe).text, "1 CE");
    assert.deepEqual(
        { ...labeller.labelInterval(new Timeline.HistoricalYear(-99)) },
        { text: "100 BCE", emphasized: true }
    );
    assert.deepEqual(
        { ...labeller.labelInterval(new Timeline.HistoricalYear(100)) },
        { text: "100 CE", emphasized: true }
    );

    const clone = unit.cloneValue(fortyFourBce);
    assert.notEqual(clone, fortyFourBce);
    assert.equal(clone.value, -43);
    assert.equal(unit.makeDefaultValue().value, 1);
    assert.equal(unit.toNumber(fortyFourBce), -43);
    assert.equal(unit.fromNumber(-43).value, -43);
    assert.equal(unit.change(fortyFourBce, 57).value, 14);
    const shifted = unit.change(oneCe, 0.25);
    assert.equal(unit.toNumber(shifted), 1.25);
    assert.equal(String(shifted), "1 CE");
    assert.equal(unit.cloneValue(shifted).value, 1.25);
    assert.equal(unit.parseFromObject(shifted), null);
    assert.equal(unit.compare(fortyFourBce, oneCe) < 0, true);
    assert.equal(unit.earlier(fortyFourBce, oneCe), fortyFourBce);
    assert.equal(unit.later(fortyFourBce, oneCe), oneCe);

    assert.equal(unit.duration(twoBce, oneCe), 2);
    assert.equal(unit.duration(oneBce, oneCe), 1);
    assert.equal(labeller.labelDuration(1), "1 year");
    assert.equal(labeller.labelDuration(57), "57 years");
});

test("HistoricalYear works with default and injected runtime rendering", () => {
    const { Timeline } = loadTimeline();
    const unit = Timeline.HistoricalYearUnit;
    const labeller = unit.createLabeller();
    const event = {
        start: -43,
        end: 14,
        title: "Roman transition"
    };
    const runtime = new Timeline.RepriseRuntime({ unit, labeller });
    const normalized = runtime.readEventTime({
        start: 14,
        end: -43
    });

    assert.equal(normalized.start.value, -43);
    assert.equal(normalized.end.value, 14);
    assert.equal(
        runtime.render(null, event, {
            field: "eventTime",
            target: "text"
        }),
        "44 BCE - 14 CE"
    );
    assert.equal(
        runtime.render(null, event, {
            field: "eventTime",
            target: "html"
        }),
        "44 BCE<br>14 CE"
    );
    assert.equal(
        runtime.render(null, event, {
            field: "bubbleDuration",
            target: "html"
        }),
        "57 years"
    );

    let renderedTemplate;
    let renderedContext;
    const injected = new Timeline.RepriseRuntime({
        unit,
        labeller,
        render(template, _event, context) {
            renderedTemplate = template;
            renderedContext = context;
            return context.duration.text;
        }
    });
    const result = injected.render("historical-title-template", event, {
        field: "title",
        target: "html"
    });

    assert.equal(result, "57 years");
    assert.equal(renderedTemplate, "historical-title-template");
    assert.equal(renderedContext.eventTime.start.value, -43);
    assert.equal(renderedContext.eventTime.end.value, 14);
    assert.equal(renderedContext.duration.value, 57);
    assert.equal(renderedContext.duration.text, "57 years");
    assert.equal(renderedContext.unit, unit);
    assert.equal(renderedContext.labeller, labeller);
});

test("supported PlanningDayUnit and MaUnit calculate and label durations", () => {
    const { Timeline } = loadTimeline();
    const planningLabeller = Timeline.PlanningDayUnit.createLabeller();
    const maLabeller = Timeline.MaUnit.createLabeller();

    assert.equal(Timeline.PlanningDayUnit.duration(0, 1), 1);
    assert.equal(planningLabeller.labelDuration(1), "1 day");
    assert.equal(planningLabeller.labelDuration(12), "12 days");

    const older = new Timeline.Ma(225);
    const younger = new Timeline.Ma(190);
    assert.equal(Timeline.MaUnit.duration(older, younger), 35);
    assert.equal(maLabeller.labelDuration(35), "35 Ma");
    assert.equal(maLabeller.labelDuration(50.50199999999998), "50.5 Ma");
    assert.equal(maLabeller.labelDuration(0.5), "0.50 Ma");
    assert.equal(maLabeller.labelDuration(0.25), "0.25 Ma");
    assert.equal(maLabeller.labelPrecise(new Timeline.Ma(50)), "50 Ma");
    assert.equal(
        maLabeller.labelPrecise(new Timeline.Ma(50.50199999999998)),
        "50.5 Ma"
    );
    assert.equal(maLabeller.labelPrecise(new Timeline.Ma(0.25)), "0.25 Ma");
    assert.equal(String(new Timeline.Ma(50.50199999999998)), "50.5 Ma");

    older.toString = () => {
        throw new Error("duration must not parse Ma.toString()");
    };
    const maRuntime = new Timeline.RepriseRuntime({
        unit: Timeline.MaUnit,
        labeller: maLabeller
    });
    assert.equal(
        maRuntime.render(
            null,
            { start: older, end: younger },
            { field: "bubbleDuration", target: "html" }
        ),
        "35 Ma"
    );
});

test("native date duration defaults to minute precision and permits overrides", () => {
    const { Timeline } = loadTimeline();
    const unit = Timeline.NativeDateUnit;
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const preciseRuntime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        durationPrecision: "millisecond"
    });
    const event = {
        start: new Date("2020-01-01T00:00:00Z"),
        end: new Date("2020-01-02T02:03:04.005Z")
    };
    let context;
    const observingRuntime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        render(_template, _event, renderContext) {
            context = renderContext;
            return renderContext.duration?.text ?? "";
        }
    });

    assert.equal(
        runtime.render(null, event, {
            field: "bubbleDuration",
            target: "html"
        }),
        "1 day, 2 hours, 3 minutes"
    );
    assert.equal(
        preciseRuntime.render(null, event, {
            field: "bubbleDuration",
            target: "html"
        }),
        "1 day, 2 hours, 3 minutes, 4 seconds, 5 ms"
    );
    assert.equal(
        runtime.render(null, event, {
            field: "bubbleDuration",
            target: "html",
            durationPrecision: "millisecond"
        }),
        "1 day, 2 hours, 3 minutes, 4 seconds, 5 ms"
    );
    observingRuntime.render(null, event, {
        field: "bubbleDuration",
        target: "html"
    });
    assert.equal(
        context.duration.value,
        24 * 60 * 60 * 1000 +
            2 * 60 * 60 * 1000 +
            3 * 60 * 1000 +
            4 * 1000 +
            5
    );
    assert.equal(context.duration.text, "1 day, 2 hours, 3 minutes");
    assert.equal(context.durationPrecision, "minute");

    assert.throws(
        () => new Timeline.RepriseRuntime({
            unit,
            durationPrecision: "microsecond"
        }),
        /durationPrecision must be day, hour, minute, second, or millisecond/
    );
});

test("native elapsed and remaining use the configured duration precision", () => {
    const { Timeline } = loadTimeline();
    const unit = Timeline.NativeDateUnit;
    const start = new Date("2020-01-01T00:00:00.000Z");
    const current = new Date("2020-01-01T00:26:42.250Z");
    const end = new Date("2020-01-01T01:00:47.750Z");
    const event = { start, end };
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        readCurrentTime: () => current
    });
    const preciseRuntime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        readCurrentTime: () => current,
        durationPrecision: "millisecond"
    });

    assert.equal(
        runtime.render("{elapsed} / {remaining}", event, {
            field: "caption",
            target: "text"
        }),
        "26 minutes / 34 minutes"
    );
    assert.equal(
        preciseRuntime.render("{elapsed} / {remaining}", event, {
            field: "caption",
            target: "text"
        }),
        "26 minutes, 42 seconds, 250 ms / 34 minutes, 5 seconds, 500 ms"
    );
});

test("active ranges expose fresh elapsed and remaining duration context", () => {
    const { Timeline } = loadTimeline();
    const unit = Timeline.PlanningDayUnit;
    let current = 4;
    let context;
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        readCurrentTime() {
            return current;
        },
        render(_template, _event, renderContext) {
            context = renderContext;
            return renderContext[renderContext.field]?.text ?? "";
        }
    });
    const event = { start: 0, end: 10 };

    assert.equal(
        runtime.render(null, event, {
            field: "elapsed",
            target: "text"
        }),
        "4 days"
    );
    assert.equal(context.currentTime, 4);
    assert.deepEqual(
        { value: context.elapsed.value, text: context.elapsed.text },
        { value: 4, text: "4 days" }
    );
    assert.deepEqual(
        { value: context.remaining.value, text: context.remaining.text },
        { value: 6, text: "6 days" }
    );

    current = 7;
    runtime.render(null, event, { field: "elapsed", target: "text" });
    assert.equal(context.elapsed.value, 7);
    assert.equal(context.remaining.value, 3);

    current = 12;
    runtime.render(null, event, { field: "elapsed", target: "text" });
    assert.equal(Object.hasOwn(context, "elapsed"), false);
    assert.equal(Object.hasOwn(context, "remaining"), false);
});

test("open, unresolved, and present endpoints derive only finite active durations", () => {
    const { Timeline } = loadTimeline();
    const unit = Timeline.PlanningDayUnit;
    const contexts = [];
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        readCurrentTime: () => 5,
        render(_template, _event, context) {
            contexts.push(context);
            return "";
        }
    });
    const cases = [
        {
            event: {
                start: -100,
                end: 12,
                eventTime: {
                    kind: "range",
                    bounded: "end",
                    start: "open",
                    end: 12
                }
            },
            expected: { remaining: 7 }
        },
        {
            event: {
                start: 0,
                end: 100,
                eventTime: {
                    kind: "range",
                    bounded: "start",
                    start: 0,
                    end: "unresolved"
                }
            },
            expected: { elapsed: 5 }
        },
        {
            event: {
                start: 0,
                end: 12,
                eventTime: {
                    kind: "range",
                    start: "present",
                    end: 12
                }
            },
            expected: { duration: 7, elapsed: 0, remaining: 7 }
        },
        {
            event: {
                start: 0,
                end: 12,
                eventTime: {
                    kind: "range",
                    start: 0,
                    end: "present"
                }
            },
            expected: { duration: 5, elapsed: 5, remaining: 0 }
        }
    ];

    for (const item of cases) {
        runtime.render(null, item.event, { field: "title", target: "text" });
        const context = contexts.at(-1);
        const actual = {};
        for (const field of ["duration", "elapsed", "remaining"]) {
            if (context[field] != null) actual[field] = context[field].value;
        }
        assert.deepEqual(actual, item.expected);
        assert.equal(Object.hasOwn(context, "minimumDuration"), false);
        if (item.event.eventTime.start === "present") {
            assert.equal(context.eventTime.start, item.event.start);
        }
        if (item.event.eventTime.end === "present") {
            assert.equal(context.eventTime.end, item.event.end);
        }
    }
});

test("injected duration derivation preserves opaque semantic values", () => {
    const { Timeline } = loadTimeline();
    const unit = makePlanningUnit();
    unit.duration = () => {
        throw new Error("projected unit duration must not be used");
    };
    const currentTime = Object.freeze({ kind: "semantic-now" });
    const values = Object.freeze({
        duration: Object.freeze({ kind: "semantic-total" }),
        minimumDuration: Object.freeze({ kind: "semantic-minimum" }),
        elapsed: Object.freeze({ kind: "semantic-elapsed" }),
        remaining: Object.freeze({ kind: "semantic-remaining" })
    });
    let renderContext;
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        readCurrentTime: () => currentTime,
        deriveDurations(event, context) {
            assert.equal(event.title, "Semantic range");
            assert.equal(context.currentTime, currentTime);
            return {
                duration: { value: values.duration, text: "1 year, 2 months" },
                minimumDuration: {
                    value: values.minimumDuration,
                    text: "11 months"
                },
                elapsed: { value: values.elapsed, text: "8 months" },
                remaining: { value: values.remaining, text: "6 months" }
            };
        },
        render(_template, _event, context) {
            renderContext = context;
            return "";
        }
    });

    runtime.render(null, {
        title: "Semantic range",
        start: 0,
        latestStart: 1,
        earliestEnd: 9,
        end: 10
    }, { field: "title", target: "text" });

    for (const field of Object.keys(values)) {
        assert.equal(renderContext[field].value, values[field]);
    }
    assert.equal(renderContext.duration.text, "1 year, 2 months");
    assert.equal(renderContext.minimumDuration.text, "11 months");
    assert.equal(renderContext.elapsed.text, "8 months");
    assert.equal(renderContext.remaining.text, "6 months");
});

test("open endpoint presentation and relative duration stay semantic across labels, captions, and bubbles", () => {
    const { Timeline, bubbleCalls } = loadTimeline();
    const unit = makePlanningUnit();
    unit.duration = () => {
        throw new Error("projected unit duration must not be used");
    };
    const semanticNow = Object.freeze({ kind: "semantic-now" });
    const elapsed = Object.freeze({ kind: "calendar-interval", months: 2 });
    const source = {
        title: "Open work",
        startDate: 0,
        end: "open"
    };
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        readCurrentTime: () => semanticNow,
        readEventTime(event) {
            assert.equal(event.end, "open");
            return Object.freeze({ kind: "range", start: 0, end: 100 });
        },
        deriveDurations(event, context) {
            assert.equal(event.end, "open");
            assert.equal(context.currentTime, semanticNow);
            return {
                elapsed: { value: elapsed, text: "2 calendar months" }
            };
        }
    });
    const profile = new Timeline.DisplayProfile({
        id: "semanticOpenRange",
        label: {
            title: {
                range: "{lines(title, relativeDuration)}"
            },
            caption: {
                range: "{join(' / ', endpointLabel('end', 'present'), relativeDuration)}"
            }
        },
        bubble: {
            bubbleEnd: {
                range: "{endpointLabel('end', 'present')}"
            },
            bubbleElapsed: {
                range: "{relativeDuration}"
            }
        }
    });
    const { decorator, doc } = paintNarrative(
        Timeline,
        runtime,
        [source],
        [],
        { presentation: profile }
    );
    const record = decorator._rangeRecords[0];
    const title = childWithClass(
        record.labelElmt,
        "timeline-narrative-label-title"
    );

    assert.equal(source.end, "open");
    assert.equal(record.eventTime.end, 100);
    assert.equal(title.innerHTML, "Open work<br>2 calendar months");
    assert.equal(
        showCaptionTooltip(doc, record.labelElmt).textContent,
        "present / 2 calendar months"
    );
    assert.equal(record.labelElmt.title, undefined);

    decorator._showBubble(record, { pageX: 10, pageY: 20 });
    const table = bubbleCalls[0][0].childNodes
        .flatMap(node => node.childNodes)
        .find(node => node.tagName === "TABLE");
    const rows = Object.fromEntries(table.childNodes.map(row => [
        row.childNodes[0].textContent,
        row.childNodes[1].innerHTML
    ]));

    assert.equal(rows.End, "present");
    assert.equal(rows.Elapsed, "2 calendar months");
    assert.equal(rows.Duration, undefined);
    assert.equal(source.end, "open");
});

test("a projected present endpoint supplies current time without a separate clock", () => {
    const { Timeline } = loadTimeline();
    const unit = Timeline.PlanningDayUnit;
    let context;
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        render(_template, _event, renderContext) {
            context = renderContext;
            return "";
        }
    });
    const event = {
        eventTime: {
            kind: "range",
            start: "present",
            end: 12
        }
    };

    runtime.render(null, event, {
        field: "title",
        target: "text",
        eventTime: { kind: "range", start: 5, end: 12 }
    });

    assert.equal(context.elapsed.value, 0);
    assert.equal(context.remaining.value, 7);
});

test("runtime exposes longest and minimum imprecise durations to renderers", () => {
    const { Timeline } = loadTimeline();
    const unit = Timeline.PlanningDayUnit;
    let context;
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        render(_template, _event, renderContext) {
            context = renderContext;
            return "";
        }
    });

    runtime.render(
        null,
        {
            start: 0,
            latestStart: 3,
            earliestEnd: 9,
            end: 12
        },
        { field: "title", target: "text" }
    );

    assert.deepEqual(
        { value: context.duration.value, text: context.duration.text },
        { value: 12, text: "12 days" }
    );
    assert.deepEqual(
        {
            value: context.minimumDuration.value,
            text: context.minimumDuration.text
        },
        { value: 6, text: "6 days" }
    );
});

test("instants, unresolved ranges, and unsupported custom units have no duration", () => {
    const { Timeline } = loadTimeline();
    const contexts = [];
    const supportedUnit = Timeline.PlanningDayUnit;
    const supported = new Timeline.RepriseRuntime({
        unit: supportedUnit,
        labeller: supportedUnit.createLabeller(),
        render(_template, _event, context) {
            contexts.push(context);
            return "";
        }
    });
    const unsupportedUnit = makePlanningUnit();
    const unsupported = new Timeline.RepriseRuntime({
        unit: unsupportedUnit,
        labeller: unsupportedUnit.createLabeller(),
        render(_template, _event, context) {
            contexts.push(context);
            return "";
        }
    });

    supported.render(null, { date: 4 }, { field: "title" });
    supported.render(null, { start: 4, end: null }, { field: "title" });
    supported.render(
        null,
        {
            start: 4,
            end: 1000,
            eventTime: {
                kind: "range",
                bounded: "start",
                start: 4,
                end: "open"
            }
        },
        { field: "title" }
    );
    supported.render(
        null,
        {
            start: -10,
            end: 4,
            event: {
                eventTime: {
                    kind: "range",
                    bounded: "end",
                    start: "unresolved",
                    end: 4
                }
            }
        },
        { field: "title" }
    );
    unsupported.render(
        null,
        { start: 0, end: 12 },
        { field: "title" }
    );

    for (const context of contexts) {
        assert.equal(Object.hasOwn(context, "duration"), false);
        assert.equal(Object.hasOwn(context, "minimumDuration"), false);
    }
});

test("explicit event duration fields override derived bubble defaults", () => {
    const { Timeline } = loadTimeline();
    const unit = Timeline.PlanningDayUnit;
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });

    assert.equal(
        runtime.render(
            null,
            { start: 0, end: 12, duration: "Scheduled window" },
            { field: "bubbleDuration", target: "html" }
        ),
        "Scheduled window"
    );
    assert.equal(
        runtime.render(
            null,
            {
                start: 0,
                latestStart: 3,
                earliestEnd: 9,
                end: 12,
                minimumDuration: "At least one sprint"
            },
            { field: "bubbleMinimumDuration", target: "html" }
        ),
        "At least one sprint"
    );
});

test("an explicit Japanese-style band labeller remains separate from NativeDateUnit.createLabeller", () => {
    const { Timeline } = loadTimeline();
    const unit = makeNativeDateUnit();
    let created = 0;
    unit.createLabeller = () => {
        created += 1;
        return makeLabeller("unit-");
    };
    const japaneseLabeller = {
        labelPrecise: value => `${value.getUTCFullYear()}年${value.getUTCMonth() + 1}月${value.getUTCDate()}日`,
        labelInterval: value => ({
            text: `${value.getUTCMonth() + 1}月`,
            emphasized: false
        })
    };
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: japaneseLabeller
    });
    const event = { date: new Date("2020-03-02T00:00:00Z") };

    assert.equal(
        runtime.render(null, event, { field: "eventTime", target: "html" }),
        "2020年3月2日"
    );
    assert.equal(
        runtime.render(null, event, { field: "eventTime", target: "text" }),
        "3月"
    );
    assert.equal(created, 0);
});

test("default rendering returns field text and late-bound HTML time content", () => {
    const { Timeline } = loadTimeline();
    const unit = makePlanningUnit();
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const event = {
        date: 4,
        title: "Milestone",
        description: "<em>Ready</em>"
    };

    assert.equal(
        runtime.render(null, event, { field: "title", target: "text" }),
        "Milestone"
    );
    assert.equal(
        runtime.render(null, event, { field: "description", target: "html" }),
        "<em>Ready</em>"
    );
    assert.equal(
        runtime.render(null, event, { field: "eventTime", target: "text" }),
        "day-interval:4"
    );
    assert.equal(
        runtime.render(null, event, { field: "eventTime", target: "html" }),
        "day-precise:4"
    );
});

test("default range templates retain semantic unbounded endpoint conventions", () => {
    const { Timeline } = loadTimeline();
    const unit = makePlanningUnit();
    const labeller = {
        labelPrecise: value => value === 2
            ? "2 Jan 2020"
            : `projected:${value}`,
        labelInterval: value => ({
            text: value === 2 ? "2 Jan 2020" : `projected:${value}`,
            emphasized: false
        })
    };
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller,
        readCurrentTime: () => 10,
        readEventTime: event => event.eventTime
    });
    const cases = [
        {
            marker: "present",
            bounded: "start",
            projectedEnd: 10,
            expectedRange: "2 Jan 2020 - present",
            expectedEnd: "present"
        },
        {
            marker: "open",
            bounded: "start",
            projectedEnd: 100,
            expectedRange: "2 Jan 2020 ...",
            expectedEnd: "..."
        },
        {
            marker: "unresolved",
            bounded: "start",
            projectedEnd: 24,
            expectedRange: "2 Jan 2020 - ?",
            expectedEnd: "?"
        }
    ];

    for (const item of cases) {
        const source = {
            eventTime: {
                kind: "range",
                bounded: item.bounded,
                start: { kind: "domain-time" },
                end: item.marker
            }
        };
        const event = {
            event: source,
            eventTime: {
                kind: "range",
                start: 2,
                end: item.projectedEnd
            },
            start: 2,
            end: item.projectedEnd
        };

        assert.equal(
            runtime.render("{eventTime}", event, {
                field: "caption",
                target: "text"
            }),
            item.expectedRange
        );
        assert.equal(
            runtime.render("{join(' | ', start, end)}", event, {
                field: "caption",
                target: "text"
            }),
            `2 Jan 2020 | ${item.expectedEnd}`
        );
        assert.equal(
            runtime.render(null, event, {
                field: "bubbleByline",
                target: "text"
            }),
            item.expectedRange
        );
    }
});

test("domain selectors preserve fresh semantic range text over projections", () => {
    const { Timeline } = loadTimeline();
    let calls = 0;
    const semanticRange = {
        kind: "range",
        bounded: "start",
        start: { kind: "domain-time" },
        end: "present",
        text: "",
        toString() {
            calls += 1;
            return this.text;
        }
    };
    const extension = {
        hasSelector: name => name === "eventTime",
        hasFormat: () => false,
        resolveSelector(_name, _formatName, event) {
            return event.event.eventTime.toString();
        }
    };
    const templateRenderer = new Timeline.TemplateRenderer({
        selectorExtensions: [extension]
    });
    const unit = makePlanningUnit();
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        templateRenderer,
        readEventTime: event => event.eventTime
    });
    const source = {
        eventTime: semanticRange,
    };
    const event = {
        event: source,
        eventTime: {
            kind: "range",
            start: 2,
            end: 100
        },
        start: 2,
        end: 100
    };
    const expected = [
        { marker: "present", text: "2 Jan 2020 - today" },
        { marker: "present", text: "2 Jan 2020 - present" },
        { marker: "open", text: "2 Jan 2020 ..." },
        { marker: "unresolved", text: "2 Jan 2020 - ?" }
    ];

    for (const item of expected) {
        semanticRange.end = item.marker;
        semanticRange.text = item.text;
        assert.equal(
            runtime.render("{eventTime}", event, {
                field: "caption",
                target: "text"
            }),
            item.text
        );
    }

    assert.equal(calls, expected.length);
});

test("default bubble duration fields pass through selector extensions", () => {
    const { Timeline } = loadTimeline();
    const calls = [];
    const extension = {
        hasSelector: name => name === "elapsed" || name === "remaining",
        hasFormat: () => false,
        resolveSelector(name, formatName, _event, context) {
            calls.push({ name, formatName, context });
            return `domain ${name}: ${context[name].value}`;
        }
    };
    const templateRenderer = new Timeline.TemplateRenderer({
        selectorExtensions: [extension]
    });
    const profile = new Timeline.DisplayProfile(
        { id: "domainDurationDefaults" },
        { templateRenderer }
    );
    const unit = Timeline.PlanningDayUnit;
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        readCurrentTime: () => 4
    });
    const event = { start: 0, end: 10 };
    const context = {
        target: "html",
        displayProfile: profile,
        surface: "bubble"
    };

    assert.equal(
        runtime.render(null, event, {
            ...context,
            field: "bubbleElapsed"
        }),
        "domain elapsed: 4"
    );
    assert.equal(
        runtime.render(null, event, {
            ...context,
            field: "bubbleRemaining"
        }),
        "domain remaining: 6"
    );
    assert.deepEqual(
        calls.map(call => [call.name, call.formatName]),
        [["elapsed", null], ["remaining", null]]
    );
});

test("DisplayProfile templates use Reprise macros, unit duration, and render targets", () => {
    const { Timeline } = loadTimeline();
    const unit = Timeline.PlanningDayUnit;
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const profile = new Timeline.DisplayProfile({
        id: "planningDisplay",
        label: {
            title: {
                range: "{lines(title, prefix('Known extent: ', duration))}"
            }
        },
        bubble: {
            bubbleDuration: {
                range: "{duration}"
            }
        }
    });
    const visualTheme = new Timeline.VisualTheme({ presentation: profile });
    const event = { start: 0, end: 12, title: "Release" };
    const eventTime = runtime.readEventTime(event);
    const template = profile.resolveTemplate("title", {
        surface: "label",
        eventTime
    });
    const context = {
        field: "title",
        eventTime,
        visualTheme,
        displayProfile: profile,
        surface: "label"
    };

    assert.equal(
        runtime.render(template, event, { ...context, target: "text" }),
        "Release\nKnown extent: 12 days"
    );
    assert.equal(
        runtime.render(template, event, { ...context, target: "html" }),
        "Release<br>Known extent: 12 days"
    );
    assert.equal(
        profile.resolveTemplate("title", {
            surface: "bubble",
            eventTime
        }),
        null
    );
});

test("TemplateRenderer validates and delegates formatted domain selectors", () => {
    const { Timeline } = loadTimeline();
    const calls = [];
    const extension = {
        hasSelector: name => name === "zone",
        hasFormat: (formatName, selectorName) =>
            selectorName === "zone" && formatName === "fullFmt",
        resolveSelector(name, formatName, event, context) {
            calls.push({ name, formatName, event, context });
            return `${event.zone} (${formatName})`;
        }
    };
    const templateRenderer = new Timeline.TemplateRenderer({
        selectorExtensions: [extension]
    });
    const profile = new Timeline.DisplayProfile(
        {
            id: "domainDisplay",
            label: {
                title: "{join(' - ', title, zone:fullFmt)}"
            }
        },
        { templateRenderer }
    );
    const unit = makePlanningUnit();
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const event = { date: 1, title: "Meeting", zone: "Australia/Adelaide" };
    const eventTime = runtime.readEventTime(event);
    const template = profile.resolveTemplate("title", {
        surface: "label",
        eventTime
    });

    assert.equal(
        runtime.render(template, event, {
            field: "title",
            target: "text",
            eventTime,
            visualTheme: new Timeline.VisualTheme({ presentation: profile }),
            displayProfile: profile,
            surface: "label"
        }),
        "Meeting - Australia/Adelaide (fullFmt)"
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].context.unit, unit);
    assert.equal(calls[0].context.labeller, runtime.labeller);

    assert.throws(
        () => new Timeline.DisplayProfile(
            {
                id: "invalidDomainDisplay",
                label: { title: "{zone:missingFmt}" }
            },
            { templateRenderer }
        ),
        /unknown format 'missingFmt' for selector 'zone'/
    );
});

test("default Reprise rendering templates work for Ma without a domain adapter", () => {
    const { Timeline } = loadTimeline();
    const runtime = new Timeline.RepriseRuntime({
        unit: Timeline.MaUnit,
        labeller: Timeline.MaUnit.createLabeller()
    });
    const profile = new Timeline.DisplayProfile({
        id: "maDisplay",
        bubble: {
            bubbleDuration: {
                range: "{prefix('Known extent: ', duration)}"
            }
        }
    });
    const event = {
        start: new Timeline.Ma(225),
        end: new Timeline.Ma(190)
    };
    const eventTime = runtime.readEventTime(event);

    assert.equal(
        runtime.render(
            profile.resolveTemplate("bubbleDuration", {
                surface: "bubble",
                eventTime
            }),
            event,
            {
                field: "bubbleDuration",
                target: "html",
                eventTime,
                visualTheme: new Timeline.VisualTheme({
                    presentation: profile
                }),
                displayProfile: profile,
                surface: "bubble"
            }
        ),
        "Known extent: 35 Ma"
    );
});

test("an injected renderer replaces default rendering and receives the complete context", () => {
    const { Timeline } = loadTimeline();
    const unit = makePlanningUnit();
    const labeller = unit.createLabeller();
    const displayProfile = new Timeline.DisplayProfile({
        id: "custom",
        label: {
            title: "custom-title"
        }
    });
    const visualTheme = new Timeline.VisualTheme({
        presentation: displayProfile
    });
    const calls = [];
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller,
        render(template, event, context) {
            calls.push({ template, event, context });
            return `<strong>${event.title}</strong>`;
        }
    });
    const event = { date: 2, title: "Injected" };
    const eventTime = runtime.readEventTime(event);
    const result = runtime.render("custom-title", event, {
        field: "title",
        target: "html",
        eventTime,
        visualTheme
    });

    assert.equal(result, "<strong>Injected</strong>");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].template, "custom-title");
    assert.equal(calls[0].context.field, "title");
    assert.equal(calls[0].context.target, "html");
    assert.equal(calls[0].context.eventTime, eventTime);
    assert.equal(calls[0].context.visualTheme, visualTheme);
    assert.equal(calls[0].context.displayProfile, undefined);
    assert.equal(calls[0].context.unit, unit);
    assert.equal(calls[0].context.labeller, labeller);
});

test("Narrative accepts ranges and instants for every supported unit shape", () => {
    const { Timeline } = loadTimeline();
    const fixtures = [
        {
            unit: makeNativeDateUnit(),
            range: {
                startDate: new Date("2020-01-01T00:00:00Z"),
                endDate: new Date("2020-02-01T00:00:00Z"),
                title: "Native range"
            },
            instant: {
                date: new Date("2020-01-15T00:00:00Z"),
                title: "Native instant"
            }
        },
        {
            unit: makePlanningUnit(),
            range: { startDate: 0, endDate: 10, title: "Planning range" },
            instant: { date: 5, title: "Planning instant" }
        },
        {
            unit: Timeline.HistoricalYearUnit,
            range: {
                startDate: -43,
                endDate: 14,
                title: "Historical range"
            },
            instant: {
                date: 0,
                title: "Historical instant"
            }
        }
    ];
    const geochrono = makeGeochronoUnit();
    fixtures.push({
        unit: geochrono,
        range: {
            startDate: new geochrono.MA(50),
            endDate: new geochrono.MA(100),
            title: "Geochrono range"
        },
        instant: {
            date: new geochrono.MA(75),
            title: "Geochrono instant"
        }
    });

    for (const fixture of fixtures) {
        const runtime = new Timeline.RepriseRuntime({
            unit: fixture.unit,
            labeller: fixture.unit.createLabeller()
        });
        const { decorator } = paintNarrative(
            Timeline,
            runtime,
            [fixture.range],
            [fixture.instant]
        );

        assert.equal(decorator._rangeRecords.length, 1);
        assert.equal(decorator._instantRecords.length, 1);
        assert.equal(decorator._rangeRecords[0].eventTime.kind, "range");
        assert.equal(decorator._instantRecords[0].eventTime.kind, "instant");
        assert.ok(decorator._rangeRecords[0].labelElmt);
        assert.ok(decorator._instantRecords[0].labelElmt);
    }
});

test("Narrative range graphic none renders labels without built-in graphics", () => {
    const { Timeline } = loadTimeline();
    const unit = makePlanningUnit();
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const { decorator, doc } = paintNarrative(
        Timeline,
        runtime,
        [{ startDate: 1, endDate: 5, title: "Chapter" }],
        [],
        { range: { graphic: "none" } }
    );
    const record = decorator._rangeRecords[0];

    assert.ok(record.labelElmt);
    assert.equal(record.spanElmt, undefined);
    assert.deepEqual(record.graphicElmts ?? [], []);
});

test("Narrative caption tooltips enable pointer events without bubble behavior", () => {
    const { Timeline } = loadTimeline();
    const unit = makePlanningUnit();
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const { decorator, doc } = paintNarrative(
        Timeline,
        runtime,
        [{ startDate: 1, endDate: 5, title: "Chapter", caption: "Details" }],
        [],
        { bubbles: false }
    );
    const label = decorator._rangeRecords[0].labelElmt;

    const tooltip = showCaptionTooltip(doc, label);

    assert.equal(label.title, undefined);
    assert.equal(tooltip.textContent, "Details");
    assert.equal(tooltip.style.display, "block");
    assert.equal(label.style.pointerEvents, "auto");
    assert.equal(label.style.cursor, "default");
    assert.equal(label.onclick, undefined);
});

test("Narrative layer parents pass through input while bubble labels stay interactive", () => {
    const { Timeline } = loadTimeline();
    const unit = makePlanningUnit();
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const { decorator, layers } = paintNarrative(
        Timeline,
        runtime,
        [{ startDate: 1, endDate: 5, title: "Chapter" }],
        [{ date: 3, title: "Milestone" }]
    );
    const visualLayer = layers.find(layer =>
        hasClass(layer, "timeline-narrative-visual-layer")
    );
    const dividerLayer = layers.find(layer =>
        hasClass(layer, "timeline-narrative-divider-layer")
    );
    const labelLayer = layers.find(layer =>
        hasClass(layer, "timeline-narrative-label-layer")
    );

    assert.equal(visualLayer.style.pointerEvents, "none");
    assert.equal(dividerLayer.style.pointerEvents, "none");
    assert.equal(labelLayer.style.pointerEvents, "none");
    assert.equal(decorator._rangeRecords[0].labelElmt.style.pointerEvents, "auto");
    assert.equal(typeof decorator._rangeRecords[0].labelElmt.onclick, "function");
    assert.equal(decorator._instantRecords[0].labelElmt.style.pointerEvents, "auto");
    assert.equal(typeof decorator._instantRecords[0].labelElmt.onclick, "function");
});

test("Narrative caption tooltips can be suppressed independently of bubbles", () => {
    const { Timeline } = loadTimeline();
    const unit = makePlanningUnit();
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const { decorator, doc } = paintNarrative(
        Timeline,
        runtime,
        [{ startDate: 1, endDate: 5, title: "Chapter", caption: "Details" }],
        [],
        { bubbles: false, tooltips: false }
    );
    const label = decorator._rangeRecords[0].labelElmt;

    assert.equal(label.title, undefined);
    assert.equal(childWithClass(doc.body, "timeline-reprise-tooltip"), undefined);
    assert.equal(label.style.pointerEvents, "none");
    assert.equal(label.style.cursor, "default");
    assert.equal(label.onclick, undefined);
});

test("Narrative labels without rendered captions remain non-interactive without bubbles", () => {
    const { Timeline } = loadTimeline();
    const unit = makePlanningUnit();
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const { decorator, doc } = paintNarrative(
        Timeline,
        runtime,
        [{ startDate: 1, endDate: 5, title: "Chapter", caption: "" }],
        [],
        { bubbles: false }
    );
    const label = decorator._rangeRecords[0].labelElmt;

    assert.equal(label.title, undefined);
    assert.equal(label.style.pointerEvents, "none");
    assert.equal(label.style.cursor, "default");
    assert.equal(label.onclick, undefined);
});

test("Narrative caption templates use Reprise duration as the label tooltip", () => {
    const { Timeline } = loadTimeline();
    const unit = Timeline.PlanningDayUnit;
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const profile = new Timeline.DisplayProfile({
        id: "narrativeTooltip",
        label: {
            caption: {
                range: "{prefix('Duration: ', duration)}"
            }
        }
    });
    const { decorator, doc } = paintNarrative(
        Timeline,
        runtime,
        [{ startDate: 1, endDate: 5, title: "Chapter" }],
        [],
        {
            presentation: profile,
            bubbles: false
        }
    );
    const label = decorator._rangeRecords[0].labelElmt;

    const tooltip = showCaptionTooltip(doc, label);

    assert.equal(label.title, undefined);
    assert.equal(tooltip.textContent, "Duration: 4 days");
    assert.equal(label.style.pointerEvents, "auto");
});

test("Narrative labels and graphics refresh dynamic captions on hover", () => {
    const { Timeline } = loadTimeline();
    const unit = Timeline.PlanningDayUnit;
    let current = 4;
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        readCurrentTime: () => current
    });
    const profile = new Timeline.DisplayProfile({
        id: "dynamicNarrativeTooltip",
        label: {
            caption: {
                range: "{join(' / ', elapsed, remaining)}"
            }
        }
    });
    const { decorator, doc } = paintNarrative(
        Timeline,
        runtime,
        [{ startDate: 0, endDate: 10, title: "Chapter" }],
        [],
        {
            presentation: profile,
            bubbles: false
        }
    );
    const record = decorator._rangeRecords[0];

    let tooltip = showCaptionTooltip(doc, record.labelElmt);
    assert.equal(record.labelElmt.title, undefined);
    assert.equal(tooltip.textContent, "4 days / 6 days");
    current = 7;
    record.labelElmt.onmouseenter();
    assert.equal(tooltip.textContent, "7 days / 3 days");

    assert.equal(record.spanElmt.title, undefined);
    record.spanElmt.onmouseenter();
    tooltip = childWithClass(doc.body, "timeline-reprise-tooltip");
    assert.equal(tooltip.textContent, "7 days / 3 days");
    assert.equal(record.spanElmt.style.pointerEvents, "auto");
});

test("caption tooltips preserve lines, render plain text, and honor maxWidth", () => {
    const { Timeline } = loadTimeline();
    const unit = Timeline.PlanningDayUnit;
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const profile = new Timeline.DisplayProfile({
        id: "multilineCaption",
        label: {
            caption: {
                range: "{lines(caption, duration)}"
            }
        }
    });
    const { decorator, doc } = paintNarrative(
        Timeline,
        runtime,
        [{
            startDate: 0,
            endDate: 4,
            title: "Chapter",
            caption: "<strong>Plain</strong>"
        }],
        [],
        {
            presentation: profile,
            tooltip: { maxWidth: 300 }
        }
    );
    const label = decorator._rangeRecords[0].labelElmt;
    const tooltip = showCaptionTooltip(doc, label);

    assert.equal(tooltip.textContent, "<strong>Plain</strong>\n4 days");
    assert.equal(tooltip.innerHTML, "");
    assert.equal(tooltip.style.maxWidth, "300px");
    assert.equal(label.title, undefined);
});

test("caption tooltips show on focus and hide on blur or mouse leave", () => {
    const { Timeline } = loadTimeline();
    const unit = makePlanningUnit();
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const { decorator, doc } = paintNarrative(
        Timeline,
        runtime,
        [{ startDate: 1, endDate: 5, title: "Chapter", caption: "Details" }],
        [],
        { bubbles: false }
    );
    const label = decorator._rangeRecords[0].labelElmt;

    label.onfocus();
    const tooltip = childWithClass(doc.body, "timeline-reprise-tooltip");
    assert.equal(tooltip.style.display, "block");
    assert.equal(label.attributes.tabindex, "0");

    label.onblur();
    assert.equal(tooltip.style.display, "none");
    label.onmouseenter({ clientX: 20, clientY: 20 });
    assert.equal(tooltip.style.display, "block");
    label.onmousemove({ clientX: 1018, clientY: 760 });
    assert.equal(tooltip.style.left, "936px");
    assert.equal(tooltip.style.top, "732px");
    label.onmouseleave();
    assert.equal(tooltip.style.display, "none");
});

test("event caption surfaces use custom tooltips and tooltips false removes native titles", () => {
    const { Timeline } = loadTimeline();
    const doc = makeDocument();
    const unit = makePlanningUnit();
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const visualTheme = new Timeline.VisualTheme({
        tooltip: { maxWidth: 180 }
    });
    const nativeTheme = makeNativeTheme(visualTheme);
    const band = { _theme: nativeTheme, getLabeller: () => runtime.labeller };
    const timeline = {
        getDocument: () => doc,
        getUnit: () => unit,
        isHorizontal: () => false,
        isVertical: () => false
    };
    const evt = {
        isInstant: () => false,
        getProperty: name => name === "caption" ? "Line one\nLine two" : null,
        getColor: () => null,
        getTextColor: () => null,
        getClassName: () => null
    };
    const painter = new Timeline.OriginalEventPainter({
        theme: nativeTheme,
        runtime
    });
    painter.initialize(band, timeline);

    const surfaces = [
        painter._paintEventIcon(evt, 0, 0, {}, nativeTheme),
        painter._paintEventTape(evt, 0, 0, 80, "blue", 100, {}, nativeTheme),
        painter._paintEventLabel(evt, "Event", 0, 0, 80, 18, nativeTheme)
    ];
    for (const surface of surfaces) {
        const tooltip = showCaptionTooltip(doc, surface.elmt);
        assert.equal(surface.elmt.title, undefined);
        assert.equal(tooltip.textContent, "Line one\nLine two");
        assert.equal(tooltip.style.maxWidth, "180px");
        surface.elmt.onmouseleave();
    }

    const disabledTheme = new Timeline.VisualTheme({ tooltips: false });
    const disabledNativeTheme = makeNativeTheme(disabledTheme);
    const disabledPainter = new Timeline.OriginalEventPainter({
        theme: disabledNativeTheme,
        runtime
    });
    disabledPainter.initialize(
        { _theme: disabledNativeTheme, getLabeller: () => runtime.labeller },
        timeline
    );
    const disabled = disabledPainter._paintEventLabel(
        evt,
        "Event",
        0,
        0,
        80,
        18,
        disabledNativeTheme
    );
    assert.equal(disabled.elmt.title, undefined);
    assert.equal(disabled.elmt.onmouseenter, undefined);
});

test("DisplayProfile-only structured bubble fields select the table layout", () => {
    const { Timeline, bubbleCalls } = loadTimeline();
    const doc = makeDocument();
    const unit = makePlanningUnit();
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const profile = new Timeline.DisplayProfile({
        id: "structuredBubble",
        bubble: {
            bubbleElapsed: "Profile elapsed"
        }
    });
    const visualTheme = new Timeline.VisualTheme({ presentation: profile });
    const nativeTheme = makeNativeTheme(visualTheme);
    const painter = new Timeline.OriginalEventPainter({
        theme: nativeTheme,
        runtime
    });
    const event = {
        title: "Milestone",
        date: 3,
        getProperty(name) {
            return this[name] ?? null;
        },
        getStart() {
            return this.date;
        },
        isInstant() {
            return true;
        }
    };

    painter.initialize(
        {
            _theme: nativeTheme,
            getLabeller: () => runtime.labeller
        },
        {
            getDocument: () => doc,
            getUnit: () => unit,
            isHorizontal: () => true,
            isVertical: () => false
        }
    );
    painter._showBubble(10, 20, event);

    const content = bubbleCalls[0][0];
    const table = content.childNodes
        .flatMap(node => node.childNodes)
        .find(node => node.tagName === "TABLE");

    assert.ok(table);
    assert.ok(
        table.childNodes.some(row =>
            row.childNodes.some(cell => cell.innerHTML === "Profile elapsed")
        )
    );
});

test("bubble elapsed and remaining inherit the duration template and recalculate", () => {
    const { Timeline, bubbleCalls } = loadTimeline();
    const doc = makeDocument();
    const unit = Timeline.PlanningDayUnit;
    let current = 4;
    let currentTimeCalls = 0;
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        readCurrentTime() {
            currentTimeCalls += 1;
            return current;
        }
    });
    const profile = new Timeline.DisplayProfile({
        id: "inheritedRelativeDurationTemplate",
        bubble: {
            bubbleDuration: {
                range: "{prefix('Measured: ', duration)}"
            }
        }
    });
    const visualTheme = new Timeline.VisualTheme({ presentation: profile });
    const nativeTheme = makeNativeTheme(visualTheme);
    const painter = new Timeline.OriginalEventPainter({
        theme: nativeTheme,
        runtime
    });
    const records = [];
    const bandInfo = {
        theme: nativeTheme,
        unit,
        labeller: runtime.labeller,
        eventPainter: painter,
        eventSource: {
            _events: { getUnit: () => unit },
            addMany(events) {
                records.push(...events);
            }
        }
    };

    Timeline.attachEvents(
        bandInfo,
        [{ start: 0, end: 10, title: "Active range" }],
        { runtime }
    );
    painter.initialize(
        {
            _theme: nativeTheme,
            getLabeller: () => runtime.labeller
        },
        {
            getDocument: () => doc,
            getUnit: () => unit,
            isHorizontal: () => true,
            isVertical: () => false
        }
    );

    const readRows = content => {
        const table = content.childNodes
            .flatMap(node => node.childNodes)
            .find(node => node.tagName === "TABLE");
        return Object.fromEntries(table.childNodes.map(row => [
            row.childNodes[0].textContent,
            row.childNodes[1].innerHTML
        ]));
    };

    painter._showBubble(10, 20, records[0]);
    assert.deepEqual(
        {
            Duration: readRows(bubbleCalls[0][0]).Duration,
            Elapsed: readRows(bubbleCalls[0][0]).Elapsed,
            Remaining: readRows(bubbleCalls[0][0]).Remaining
        },
        {
            Duration: "Measured: 10 days",
            Elapsed: "Measured: 4 days",
            Remaining: "Measured: 6 days"
        }
    );

    current = 7;
    painter._showBubble(10, 20, records[0]);
    assert.deepEqual(
        {
            Elapsed: readRows(bubbleCalls[1][0]).Elapsed,
            Remaining: readRows(bubbleCalls[1][0]).Remaining
        },
        { Elapsed: "Measured: 7 days", Remaining: "Measured: 3 days" }
    );
    assert.equal(currentTimeCalls, 2);
});

test("Reprise image bubble stays above the title and retains structured content", () => {
    const { Timeline, bubbleCalls } = loadTimeline();
    const doc = makeDocument();
    const unit = makePlanningUnit();
    let styledImage = null;
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller(),
        render(_template, event, context) {
            const values = {
                image: event.image,
                title: event.title,
                bubbleLocation: event.location,
                description: event.description,
                bubbleTags: event.tags
            };
            return values[context.field] ??
                Timeline.RepriseRuntime.prototype.render.call(
                    new Timeline.RepriseRuntime({
                        unit,
                        labeller: unit.createLabeller()
                    }),
                    null,
                    event,
                    context
                );
        }
    });
    const visualTheme = new Timeline.VisualTheme();
    const nativeTheme = makeNativeTheme(visualTheme);
    nativeTheme.event.bubble.imageStyler = element => {
        styledImage = element;
        element.className = "timeline-event-bubble-image";
    };
    const band = {
        _theme: nativeTheme,
        getLabeller: () => runtime.labeller
    };
    const timeline = {
        getDocument: () => doc,
        getUnit: () => unit,
        isHorizontal: () => true,
        isVertical: () => false
    };
    const event = {
        image: "event.png",
        title: "Rendered title",
        description: "Rendered body",
        location: "Adelaide",
        tags: ["release", "planning"],
        date: 3,
        fillInfoBubble() {
            throw new Error("SIMILE event bubble filler must not own Reprise DOM");
        },
        getProperty(name) {
            return this[name] ?? null;
        },
        getStart() {
            return this.date;
        },
        isInstant() {
            return true;
        }
    };
    const painter = new Timeline.OriginalEventPainter({
        theme: nativeTheme,
        runtime
    });

    painter.initialize(band, timeline);
    painter._showBubble(10, 20, event);

    assert.equal(bubbleCalls.length, 1);
    const content = bubbleCalls[0][0];
    const imageContainer = childWithClass(
        content,
        "timeline-event-bubble-image-container"
    );
    const title = childWithClass(content, "timeline-event-bubble-title");
    const byline = childWithClass(content, "timeline-event-bubble-byline");
    const description = childWithClass(content, "timeline-event-bubble-description");
    const tags = childWithClass(content, "timeline-event-bubble-tags");
    const image = imageContainer?.childNodes.find(node => node.tagName === "IMG");
    const table = content.childNodes
        .flatMap(node => node.childNodes)
        .find(node => node.tagName === "TABLE");

    assert.equal(imageContainer?.tagName, "DIV");
    assert.equal(
        imageContainer.className,
        "timeline-event-bubble-image-container",
        "the wrapper should have only the Reprise container class"
    );
    assert.deepEqual(
        [imageContainer, title, byline, description, tags].map(node =>
            content.childNodes.indexOf(node)
        ),
        [0, 1, 2, 3, 4],
        "bubble sections should retain their image-to-tags order"
    );
    assert.equal(styledImage, image, "imageStyler should receive the actual img");
    assert.equal(
        image.className,
        "timeline-event-bubble-image",
        "the native SIMILE image class should remain on the img"
    );
    assert.ok(!hasClass(image, "timeline-event-bubble-image-container"));
    assert.ok(table, "Reprise should create the structured bubble table");
    assert.ok(
        table.childNodes.some(row =>
            row.childNodes.some(cell => cell.innerHTML === "Adelaide")
        ),
        "the injected renderer should supply table-cell content"
    );
});

test("Narrative bubbles use the same distinct image container and native image styling", () => {
    const { Timeline, bubbleCalls } = loadTimeline();
    const unit = makePlanningUnit();
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const range = {
        startDate: 1,
        endDate: 5,
        image: "narrative.png",
        title: "Narrative title",
        bubbleLocation: "Adelaide",
        description: "Narrative body",
        bubbleTags: ["chapter"]
    };
    const { decorator, nativeTheme } = paintNarrative(
        Timeline,
        runtime,
        [range],
        []
    );
    let styledImage = null;
    nativeTheme.event.bubble.imageStyler = element => {
        styledImage = element;
        element.className = "timeline-event-bubble-image";
    };

    decorator._showBubble(decorator._rangeRecords[0], {
        pageX: 12,
        pageY: 24
    });

    assert.equal(bubbleCalls.length, 1);
    const content = bubbleCalls[0][0];
    const imageContainer = childWithClass(
        content,
        "timeline-event-bubble-image-container"
    );
    const image = imageContainer?.childNodes.find(node => node.tagName === "IMG");

    assert.equal(imageContainer?.className, "timeline-event-bubble-image-container");
    assert.equal(styledImage, image);
    assert.equal(image?.className, "timeline-event-bubble-image");
    assert.deepEqual(
        [
            "timeline-event-bubble-image-container",
            "timeline-event-bubble-title",
            "timeline-event-bubble-byline",
            "timeline-event-bubble-description",
            "timeline-event-bubble-tags"
        ].map(className =>
            content.childNodes.indexOf(childWithClass(content, className))
        ),
        [0, 1, 2, 3, 4]
    );
});

test("RepriseRuntime projects band values and ranges through its unit by default", () => {
    const { Timeline } = loadTimeline();
    const unit = makePlanningUnit();
    const runtime = new Timeline.RepriseRuntime({ unit });

    assert.equal(runtime.projectTimeValue("12"), 12);
    assert.equal(runtime.projectTimeValue("invalid"), null);
    const reversed = runtime.projectTimeRange({ start: "20", end: "5" });
    assert.equal(reversed.start, 5);
    assert.equal(reversed.end, 20);

    const openEnded = runtime.projectTimeRange({ start: "5" });
    assert.equal(openEnded.start, 5);
    assert.equal(Object.hasOwn(openEnded, "end"), false);
});

test("RepriseRuntime accepts injected semantic band projections", () => {
    const { Timeline } = loadTimeline();
    const unit = makeNativeDateUnit();
    const runtime = new Timeline.RepriseRuntime({
        unit,
        projectTimeValue(value) {
            return new Date(`${value}T00:00:00Z`);
        },
        projectTimeRange(value) {
            return {
                start: this.projectTimeValue(value.from),
                end: this.projectTimeValue(value.to)
            };
        }
    });

    assert.equal(
        runtime.projectTimeValue("2026-01-01").toISOString(),
        "2026-01-01T00:00:00.000Z"
    );
    assert.equal(
        runtime.projectTimeRange({
            from: "2024-01-01",
            to: "2028-01-01"
        }).end.toISOString(),
        "2028-01-01T00:00:00.000Z"
    );
});

test("bubbles without images do not add an image container or run imageStyler", () => {
    const { Timeline, bubbleCalls } = loadTimeline();
    const doc = makeDocument();
    const unit = makePlanningUnit();
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const visualTheme = new Timeline.VisualTheme();
    const nativeTheme = makeNativeTheme(visualTheme);
    let imageStylerCalls = 0;
    nativeTheme.event.bubble.imageStyler = () => {
        imageStylerCalls += 1;
    };
    const painter = new Timeline.OriginalEventPainter({
        theme: nativeTheme,
        runtime
    });
    painter.initialize(
        {
            _theme: nativeTheme,
            getLabeller: () => runtime.labeller
        },
        {
            getDocument: () => doc,
            getUnit: () => unit,
            isHorizontal: () => true,
            isVertical: () => false
        }
    );
    const event = {
        date: 3,
        title: "No image",
        description: "Unchanged body",
        getProperty(name) {
            return this[name] ?? null;
        },
        getStart() {
            return this.date;
        },
        isInstant() {
            return true;
        }
    };

    painter._showBubble(10, 20, event);

    assert.equal(bubbleCalls.length, 1);
    const content = bubbleCalls[0][0];
    assert.equal(
        childWithClass(content, "timeline-event-bubble-image-container"),
        undefined
    );
    assert.equal(
        childWithClass(content, "timeline-event-bubble-image"),
        undefined
    );
    assert.equal(imageStylerCalls, 0);
    assert.ok(hasClass(content.childNodes[0], "timeline-event-bubble-title"));
    assert.ok(hasClass(content.childNodes[1], "timeline-event-bubble-byline"));
    assert.ok(hasClass(content.childNodes[2], "timeline-event-bubble-description"));
});

test("Reprise CSS keeps oversized bubble images above text without overflow", () => {
    const css = fs.readFileSync(
        path.join(__dirname, "..", "dist", "timeline-reprise.css"),
        "utf8"
    );
    const containerRule = css.match(
        /(?:^|\n)\.timeline-event-bubble-image-container\s*\{([^}]*)\}/
    );
    const imageRule = css.match(
        /(?:^|\n)\.timeline-event-bubble-image-container\s*>\s*img\s*\{([^}]*)\}/
    );

    assert.ok(containerRule, "the Reprise image-container rule should be distributed");
    assert.match(containerRule[1], /\bbox-sizing\s*:\s*border-box\s*;/);
    assert.match(containerRule[1], /\bclear\s*:\s*both\s*;/);
    assert.match(containerRule[1], /\bdisplay\s*:\s*block\s*;/);
    assert.match(containerRule[1], /\bfloat\s*:\s*none\s*;/);
    assert.match(containerRule[1], /\bmax-width\s*:\s*100%\s*;/);
    assert.match(containerRule[1], /\bwidth\s*:\s*100%\s*;/);
    assert.match(containerRule[1], /\btext-align\s*:\s*center\s*;/);
    assert.doesNotMatch(containerRule[1], /\boverflow\s*:\s*auto\s*;/);

    assert.ok(imageRule, "the constrained bubble-image rule should be distributed");
    assert.match(imageRule[1], /\bbox-sizing\s*:\s*border-box\s*;/);
    assert.match(imageRule[1], /\bdisplay\s*:\s*block\s*;/);
    assert.match(imageRule[1], /\bfloat\s*:\s*none\s*;/);
    assert.match(imageRule[1], /\bheight\s*:\s*auto\s*;/);
    assert.match(imageRule[1], /\bmax-width\s*:\s*100%\s*;/);
    assert.match(imageRule[1], /\bmargin-left\s*:\s*auto\s*;/);
    assert.match(imageRule[1], /\bmargin-right\s*:\s*auto\s*;/);
});
