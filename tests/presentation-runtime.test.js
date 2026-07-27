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
                getBoundingClientRect() {
                    return { width: this.offsetWidth, height: this.offsetHeight };
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

    return doc;
}

function makeNativeTheme(eventTheme) {
    return {
        eventTheme,
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

function paintNarrative(Timeline, runtime, ranges, instants) {
    const doc = makeDocument();
    const layers = [];
    const eventTheme = new Timeline.EventTheme();
    const nativeTheme = makeNativeTheme(eventTheme);
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
    assert.equal(
        maLabeller.labelDuration(
            Timeline.MaUnit.duration(
                new Timeline.Ma(225),
                new Timeline.Ma(224.5)
            )
        ),
        "0.5 Ma"
    );

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

test("default native date duration is elapsed milliseconds with formatted text", () => {
    const { Timeline } = loadTimeline();
    const unit = Timeline.NativeDateUnit;
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const event = {
        start: new Date("2020-01-01T00:00:00Z"),
        end: new Date("2020-01-03T00:00:00Z")
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
        "2 days"
    );
    observingRuntime.render(null, event, {
        field: "bubbleDuration",
        target: "html"
    });
    assert.equal(context.duration.value, 2 * 24 * 60 * 60 * 1000);
    assert.equal(context.duration.text, "2 days");
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

test("an injected renderer replaces default rendering and receives the complete context", () => {
    const { Timeline } = loadTimeline();
    const unit = makePlanningUnit();
    const labeller = unit.createLabeller();
    const eventTheme = new Timeline.EventTheme({
        presentation: {
            title: { template: "custom-title" }
        }
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
        eventTheme
    });

    assert.equal(result, "<strong>Injected</strong>");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].template, "custom-title");
    assert.equal(calls[0].context.field, "title");
    assert.equal(calls[0].context.target, "html");
    assert.equal(calls[0].context.eventTime, eventTime);
    assert.equal(calls[0].context.eventTheme, eventTheme);
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
    const eventTheme = new Timeline.EventTheme();
    const nativeTheme = makeNativeTheme(eventTheme);
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

test("bubbles without images do not add an image container or run imageStyler", () => {
    const { Timeline, bubbleCalls } = loadTimeline();
    const doc = makeDocument();
    const unit = makePlanningUnit();
    const runtime = new Timeline.RepriseRuntime({
        unit,
        labeller: unit.createLabeller()
    });
    const eventTheme = new Timeline.EventTheme();
    const nativeTheme = makeNativeTheme(eventTheme);
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
