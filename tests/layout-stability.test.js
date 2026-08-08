const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("@jest/globals");

function sourceWithoutImports(filename) {
    return fs.readFileSync(filename, "utf8").replace(
        /^import\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];\s*/m,
        ""
    ).replace(
        /^import\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];\s*/gm,
        ""
    );
}

function testRuntime(unit = null, labeller = null) {
    const resolvedUnit = unit || {
        parseFromObject: value => value,
        compare: (a, b) => Number(a) - Number(b)
    };
    const resolvedLabeller = labeller || {
        labelPrecise: value => String(value),
        labelInterval: value => ({ text: String(value), emphasized: false })
    };

    return {
        unit: resolvedUnit,
        labeller: resolvedLabeller,
        readEventTime: () => null,
        render: () => ""
    };
}

function resolveTestRuntime(runtime, options = {}) {
    return runtime || testRuntime(options.unit, options.labeller);
}

function testVisualTheme(overrides = {}) {
    const defaults = {
        disableEmphasis: false,
        eventColorScope: "graphic",
        spans: true,
        dividers: true,
        labels: true,
        bubbles: true,
        track: {
            horizontal: { count: 1, offset: 2, size: 18, gap: 4, align: "start" },
            vertical: { count: 1, offset: 2, size: 120, gap: 4, align: "start" }
        },
        instant: {
            iconColor: "blue",
            width: 9,
            height: 9,
            tickWidth: 1,
            lineWidth: 1,
            horizontal: {},
            vertical: {}
        },
        range: {
            iconColor: "blue",
            width: 4,
            short: { minDisplayLength: 4 },
            horizontal: {
                eventRoutingThreshold: 28,
                tapeGap: 6,
                sparklineStagger: 8
            },
            vertical: {
                eventRoutingThreshold: 28,
                tapeGap: 6,
                toEventGap: 12
            }
        },
        label: {
            flow: "normal",
            colorSource: "graphic",
            rangeCssClass: "",
            instantCssClass: "",
            horizontal: {
                rangeAlign: "start",
                stickyInset: 2,
                offset: 0,
                toRangeGap: 4,
                toInstantGap: 4,
                toRangeBlockGap: 15,
                routingGap: 8,
                trackGap: 2
            },
            vertical: {
                rangeAlign: "start",
                stickyInset: 2,
                offset: 0,
                toRangeGap: 4,
                toInstantGap: 4,
                toRangeBlockGap: 15,
                routingGap: 4,
                trackGap: 2,
                width: 120
            }
        },
        bubble: { width: 320, maxHeight: null },
        layer: { zIndex: 5, dividerZIndex: 101, labelZIndex: 114 },
        tagsToIconColor: {}
    };

    function merge(base, extra) {
        const result = { ...base };
        for (const [key, value] of Object.entries(extra)) {
            result[key] = value && typeof value === "object" && !Array.isArray(value)
                ? merge(result[key] || {}, value)
                : value;
        }
        return result;
    }

    return merge(defaults, overrides);
}

function resolveTestVisualTheme(explicit, nativeTheme) {
    const resolved = testVisualTheme(explicit || nativeTheme?.visualTheme || {});
    if (!explicit && nativeTheme) nativeTheme.visualTheme = resolved;
    return resolved;
}

function loadEventPainter() {
    function OriginalEventPainter() {}

    const proto = OriginalEventPainter.prototype;
    proto.initialize = function () {};
    proto._prepareForPainting = function () {};
    proto._findFreeTrack = function () { return 0; };
    proto._paintEventIcon = function (evt, iconTrack, left, metrics) {
        const data = paintedData(
            left,
            metrics?.trackOffset ?? 0,
            metrics?.iconWidth ?? 10,
            metrics?.iconHeight ?? 10
        );
        data.icon = evt?.getIcon?.() ?? metrics?.icon ?? null;
        return data;
    };
    proto._paintEventTape = function (
        evt, iconTrack, startPixel, endPixel, color, opacity, metrics, theme
    ) {
        const data = paintedData(
            startPixel,
            metrics.trackOffset + iconTrack * metrics.trackIncrement,
            endPixel - startPixel,
            theme.event.tape.height
        );
        data.color = color;
        return data;
    };
    proto._paintEventLabel = function (evt, text, left, top, width, height) {
        return paintedData(left, top, width, height);
    };
    proto._showBubble = function () {};
    proto.paint = function () {};
    proto.softPaint = function () {};

    const Timeline = {
        OriginalEventPainter,
        resolveVisualTheme: resolveTestVisualTheme,
        ThemeIcons: {
            getCssColor: (color) => color,
            get: (color, size) => `theme-icon:${color}:${size}`
        }
    };
    const context = vm.createContext({
        fillRepriseBubble: () => {},
        getAttachedEventContext: () => null,
        renderAttachedEventField: () => "",
        resolveRepriseRuntime: resolveTestRuntime,
        Timeline,
        window: { Timeline }
    });
    const filename = path.join(__dirname, "..", "src", "event-layout.js");

    vm.runInContext(sourceWithoutImports(filename), context, { filename });
    Timeline.OriginalEventPainter.prototype.paint =
        Timeline.OriginalEventPainter.prototype.softPaint;
    Timeline.OriginalEventPainter._testTimeline = Timeline;
    return Timeline.OriginalEventPainter;
}

function loadCore(Timeline) {
    const context = vm.createContext({
        fillRepriseBubble: () => {},
        getAttachedEventContext: () => null,
        hasRenderedContent: value => value != null && value !== "",
        renderAttachedEventField: () => "",
        renderEventField: () => "",
        resolveRepriseRuntime: resolveTestRuntime,
        setRenderedContent: () => true,
        Timeline,
        window: { Timeline }
    });
    const filename = path.join(__dirname, "..", "src", "core.js");

    vm.runInContext(sourceWithoutImports(filename), context, { filename });
}

function loadEmptyEtherPainter() {
    function Impl() {}

    Impl.prototype._distributeWidths = function () {};

    const Timeline = { _Impl: Impl };
    loadCore(Timeline);
    return Timeline.EmptyEtherPainter;
}

function initializeEmptyEtherPainter(options) {
    const EmptyEtherPainter = loadEmptyEtherPainter();
    const layer = {
        attributes: {},
        className: "",
        style: {},
        setAttribute(name, value) {
            this.attributes[name] = value;
        }
    };
    const createdLayers = [];
    const band = {
        createLayerDiv(zIndex) {
            createdLayers.push(zIndex);
            return layer;
        }
    };
    const timeline = {};
    const painter = options === undefined
        ? new EmptyEtherPainter()
        : new EmptyEtherPainter(options);

    painter.initialize(band, timeline);

    return { painter, band, timeline, layer, createdLayers };
}

function loadNarrativeDecorator() {
    const Timeline = {
        NativeDateUnit: {},
        resolveVisualTheme: resolveTestVisualTheme
    };
    const context = vm.createContext({
        fillRepriseBubble: () => {},
        hasRenderedContent: value => value != null && value !== "",
        renderEventField: () => "",
        resolveRepriseRuntime: resolveTestRuntime,
        setRenderedContent: () => true,
        Timeline,
        window: { Timeline }
    });
    const filename = path.join(__dirname, "..", "src", "narrative.js");

    vm.runInContext(sourceWithoutImports(filename), context, { filename });
    return Timeline.NarrativeDecorator;
}

function element(width, height) {
    return {
        className: "",
        offsetWidth: width,
        offsetHeight: height,
        scrollWidth: width,
        scrollHeight: height,
        getBoundingClientRect: () => ({ width, height }),
        style: {}
    };
}

function paintedData(left, top, width, height) {
    return {
        left,
        top,
        width,
        height,
        elmt: element(width, height)
    };
}

function assertHasClasses(elmt, expected) {
    const classes = String(elmt?.className ?? "").split(/\s+/);
    for (const className of expected) {
        assert.ok(
            classes.includes(className),
            `expected "${classes.join(" ")}" to include "${className}"`
        );
    }
}

function event(id, start, end) {
    return {
        getID: () => id,
        getStart: () => start,
        getEnd: () => end,
        getTrackNum: () => 0,
        isInstant: () => false
    };
}

function instantEvent(id, start) {
    return {
        ...event(id, start, start),
        isInstant: () => true
    };
}

function styledInstantEvent(id, start, {
    color = null,
    icon = null,
    iconColor = null,
    emphasis = null,
    tags = null
} = {}) {
    const properties = { iconColor, emphasis, tags };

    return {
        ...instantEvent(id, start),
        getColor: () => color,
        getIcon: () => icon,
        getProperty: (name) => properties[name]
    };
}

function eventOnLane(id, start, end, lane) {
    return {
        ...event(id, start, end),
        getTrackNum: () => lane
    };
}

function visualTheme() {
    return {
        visualTheme: testVisualTheme({
            track: {
                horizontal: { size: 20, gap: 2 },
                vertical: { size: 20, gap: 2 }
            },
            instant: { width: 10, height: 10 },
            range: {
                width: 4,
                short: { minDisplayLength: 4 },
                horizontal: {
                    eventRoutingThreshold: 28,
                    tapeGap: 2,
                    sparklineStagger: 8
                },
                vertical: {
                    eventRoutingThreshold: 28,
                    tapeGap: 2,
                    toEventGap: 10
                }
            },
            label: {
                horizontal: {
                    toRangeGap: 2,
                    routingGap: 10,
                    trackGap: 2,
                    stickyInset: 0
                },
                vertical: {
                    toRangeGap: 2,
                    width: 80,
                    routingGap: 5,
                    trackGap: 5,
                    stickyInset: 0
                }
            }
        }),
        event: {
            track: { offset: 2, height: 20, gap: 2 },
            tape: {
                height: 4,
                horizontal: {
                    eventRoutingThreshold: 28,
                    tapeGap: 2,
                    toLabelGap: 2,
                    labelRoutingGap: 10,
                    labelTrackGap: 2,
                    sparklineStagger: 8,
                    stickyLeftInset: 0
                },
                vertical: {
                    eventRoutingThreshold: 28,
                    tapeGap: 2,
                    toLabelGap: 2,
                    labelWidth: 80,
                    labelRoutingGap: 5,
                    labelTrackGap: 5,
                    stickyTopInset: 0,
                    toEventGap: 10
                },
                short: { minDisplayLength: 4 }
            },
            label: { offsetFromLine: 3 },
            duration: { color: "gray" },
            instant: { iconWidth: 10, iconHeight: 10 }
        }
    };
}

function makeEventPainter(orientation, viewLength) {
    const OriginalEventPainter = loadEventPainter();
    const painter = new OriginalEventPainter();
    const horizontal = orientation === "horizontal";

    painter._timeline = {
        isHorizontal: () => horizontal,
        isVertical: () => !horizontal
    };
    painter._band = {
        dateToPixelOffset: (value) => value,
        getViewOffset: () => 0,
        getViewLength: () => viewLength ?? 200,
        getViewWidth: () => 400,
        updateEventTrackInfo: () => {}
    };
    painter._params = { theme: visualTheme() };
    painter._visualTheme = painter._params.theme.visualTheme;
    painter._nativeTheme = painter._params.theme;
    painter._repriseMetrics = {
        trackOffset: 2,
        trackHeight: 20,
        trackGap: 2,
        trackIncrement: 22,
        iconWidth: 10,
        iconHeight: 10
    };
    painter._repriseTapeLaneStarts = [];
    painter._repriseTapeLaneEnds = [];
    painter._repriseTapeLanes = {};
    painter._repriseTapeLabels = [];
    painter._repriseTapeBars = [];
    painter._repriseEventLanes = {};
    painter._reprisePointIcons = [];
    painter._reprisePointTapes = [];
    painter._reprisePointLabels = [];

    return painter;
}

test("native decorator layers are not remapped by Reprise", () => {
    function Impl() {}
    function Band() {}

    const createdLayers = [];
    const Timeline = {
        _Impl: Impl,
        _Band: Band
    };

    Impl.prototype._distributeWidths = function () {};
    Band.prototype.createLayerDiv = function (zIndex) {
        createdLayers.push(zIndex);
        return {};
    };

    loadCore(Timeline);

    const band = new Band();
    band.createLayerDiv(1);
    band.createLayerDiv(10);
    band.createLayerDiv(100);
    band.createLayerDiv(105);

    assert.deepEqual(createdLayers, [1, 10, 100, 105]);
});

test("EmptyEtherPainter keeps the no-argument painter interface compatible", () => {
    const { painter, band, timeline, layer, createdLayers } =
        initializeEmptyEtherPainter();

    assert.equal(painter._band, band);
    assert.equal(painter._timeline, timeline);
    assert.equal(painter._backgroundLayer, layer);
    assert.deepEqual(createdLayers, [0]);
    assert.equal(layer.attributes.name, "ether-background");
    assert.equal(layer.className, "timeline-ether-bg");
    assert.equal(painter.setHighlight(), undefined);
    assert.equal(painter.paint(), undefined);
    assert.equal(painter.softPaint(), undefined);
});

test("EmptyEtherPainter applies a configured background directly to its layer", () => {
    const { layer } = initializeEmptyEtherPainter({
        backgroundColor: "  #1e1e1e  "
    });

    assert.equal(layer.style.backgroundColor, "#1e1e1e");
});

test("EmptyEtherPainter does not force a layer color when backgroundColor is omitted", () => {
    const { layer } = initializeEmptyEtherPainter({});

    assert.equal(Object.hasOwn(layer.style, "backgroundColor"), false);
});

test("EmptyEtherPainter accepts nullish backgroundColor values", () => {
    const EmptyEtherPainter = loadEmptyEtherPainter();

    assert.doesNotThrow(() => new EmptyEtherPainter({
        backgroundColor: null
    }));
    assert.doesNotThrow(() => new EmptyEtherPainter({
        backgroundColor: undefined
    }));
});

test("EmptyEtherPainter rejects invalid backgroundColor values", () => {
    const EmptyEtherPainter = loadEmptyEtherPainter();

    for (const backgroundColor of ["", "   ", 42, false, {}, []]) {
        assert.throws(
            () => new EmptyEtherPainter({ backgroundColor }),
            /backgroundColor.*null or a non-empty CSS color string/
        );
    }
});

test("EmptyEtherPainter background rendering does not require the Reprise stylesheet", () => {
    const { layer } = initializeEmptyEtherPainter({
        backgroundColor: "rebeccapurple"
    });

    assert.equal(layer.className, "timeline-ether-bg");
    assert.equal(layer.style.backgroundColor, "rebeccapurple");
});

test("event-layout resolves presentation without mutating the native painter theme", () => {
    const OriginalEventPainter = loadEventPainter();
    const theme = visualTheme();
    const originalNativeColor = theme.event.instant.iconColor;
    const painter = new OriginalEventPainter();

    theme.visualTheme = testVisualTheme({
        instant: { iconColor: "orange" },
        bubble: { width: 360, maxHeight: 480 }
    });
    painter._params = { theme };
    painter.initialize(
        { _theme: theme },
        { isHorizontal: () => true, isVertical: () => false }
    );

    assert.equal(painter._visualTheme.instant.iconColor, "orange");
    assert.equal(painter._visualTheme.bubble.width, 360);
    assert.equal(painter._visualTheme.bubble.maxHeight, 480);
    assert.equal(theme.event.instant.iconColor, originalNativeColor);
});

test("event content passes blank-area input through and keeps painted items interactive", () => {
    const painter = makeEventPainter("horizontal");
    const metrics = painter._repriseMetrics;
    const theme = painter._params.theme;
    const eventLayerParent = { style: {} };

    painter._eventLayer = {
        parentNode: eventLayerParent,
        style: {}
    };
    painter._prepareForPainting();

    assert.equal(eventLayerParent.style.pointerEvents, "none");
    assert.equal(painter._eventLayer.style.pointerEvents, "none");

    const icon = painter._paintEventIcon(
        instantEvent("instant", 10),
        0,
        10,
        metrics,
        theme,
        0
    );
    const tape = painter._paintEventTape(
        event("range", 20, 60),
        0,
        20,
        60,
        "blue",
        100,
        metrics,
        theme,
        0
    );
    const label = painter._paintEventLabel(
        instantEvent("label", 10),
        "Label",
        20,
        20,
        40,
        18,
        theme,
        "timeline-event-label",
        -1
    );

    assert.equal(icon.elmt.style.pointerEvents, "auto");
    assert.equal(icon.elmt.style.zIndex, "0");
    assert.equal(tape.elmt.style.pointerEvents, "auto");
    assert.equal(tape.elmt.style.zIndex, "0");
    assert.equal(label.elmt.style.pointerEvents, "auto");
    assert.equal(label.elmt.style.zIndex, "2");
});

function tapeLabel(evt, natural, width, height) {
    return {
        evt,
        lane: 0,
        data: paintedData(natural, natural, width, height),
        width,
        height,
        naturalLeft: natural,
        naturalTop: natural,
        startPixel: evt.getStart(),
        endPixel: evt.getEnd(),
        tapeColor: "gray",
        spark: paintedData(0, 0, 1, 0)
    };
}

for (const {
    orientation,
    flow,
    width,
    height,
    expected
} of [
    { orientation: "horizontal", flow: "normal", width: 40, height: 16, expected: 50 },
    { orientation: "horizontal", flow: "orthogonal", width: 60, height: 12, expected: 64 },
    { orientation: "vertical", flow: "normal", width: 80, height: 30, expected: 55 },
    { orientation: "vertical", flow: "orthogonal", width: 70, height: 12, expected: 35 }
]) {
    test(`${orientation} ${flow} range labels center on a fully visible range`, () => {
        const painter = makeEventPainter(orientation);
        const item = tapeLabel(event("centered", 20, 120), 20, width, height);
        painter._visualTheme.label[orientation].rangeAlign = "center";

        if (flow === "orthogonal") {
            item.data._repriseLabelFlow = "orthogonal";
            item.data._repriseRawWidth = width;
            item.data._repriseRawHeight = height;
            item.data.width = height;
            item.data.height = width;
            item.width = height;
            item.height = width;
        }

        painter._repriseTapeLabels.push(item);
        painter.paint();

        assert.equal(
            orientation === "horizontal" ? item.data.left : item.data.top,
            expected
        );
    });
}

test("a centered range label can be longer than its range", () => {
    const painter = makeEventPainter("horizontal");
    const item = tapeLabel(event("overlong", 80, 110), 80, 100, 16);
    painter._visualTheme.label.horizontal.rangeAlign = "center";
    painter._repriseTapeLabels.push(item);

    painter.paint();

    assert.equal(item.data.left, 45);
    assert.equal(item.data.elmt.style.display, "");
});

for (const orientation of ["horizontal", "vertical"]) {
    test(`${orientation} centered range labels retain sticky leading-edge limits`, () => {
        const painter = makeEventPainter(orientation);
        const item = tapeLabel(event("sticky", -100, 100), -100, 40, 30);
        painter._visualTheme.label[orientation].rangeAlign = "center";
        painter._repriseTapeLabels.push(item);

        painter.paint();

        assert.equal(
            orientation === "horizontal" ? item.data.left : item.data.top,
            0
        );
    });

    test(`${orientation} centered range labels slide at the trailing viewport edge`, () => {
        const painter = makeEventPainter(orientation);
        const item = tapeLabel(event("trailing", 180, 260), 180, 40, 40);
        painter._visualTheme.label[orientation].rangeAlign = "center";
        painter._repriseTapeLabels.push(item);

        painter.paint();

        assert.equal(
            orientation === "horizontal" ? item.data.left : item.data.top,
            180
        );
    });

    test(`${orientation} centered labels longer than their range do not viewport-slide`, () => {
        const painter = makeEventPainter(orientation);
        const item = tapeLabel(event("overlong-edge", 180, 210), 180, 80, 80);
        painter._visualTheme.label[orientation].rangeAlign = "center";
        painter._repriseTapeLabels.push(item);

        painter.paint();

        assert.equal(
            orientation === "horizontal" ? item.data.left : item.data.top,
            155
        );
    });
}

for (const orientation of ["horizontal", "vertical"]) {
    test(`${orientation} centered narrative range labels slide at the trailing viewport edge`, () => {
        const decorator = makeNarrative(orientation);
        decorator._rangeLabelAlign = "center";
        const range = narrativeRange(decorator, 0, 180, 260, 40, 40);
        decorator._rangeRecords = [range];

        decorator.softPaint();

        assert.equal(
            orientation === "horizontal"
                ? range.labelElmt.style.left
                : range.labelElmt.style.top,
            "180px"
        );
    });

    test(`${orientation} centered narrative labels longer than their range do not viewport-slide`, () => {
        const decorator = makeNarrative(orientation);
        decorator._rangeLabelAlign = "center";
        const range = narrativeRange(decorator, 0, 180, 210, 80, 80);
        decorator._rangeRecords = [range];

        decorator.softPaint();

        assert.equal(
            orientation === "horizontal"
                ? range.labelElmt.style.left
                : range.labelElmt.style.top,
            "155px"
        );
    });
}

for (const rangeAlign of ["start", "center"]) {
    for (const orientation of ["horizontal", "vertical"]) {
        test(`${orientation} ${rangeAlign}-aligned range labels jump tracks at their range end`, () => {
        const painter = makeEventPainter(orientation, 300);
        const height = orientation === "horizontal" ? 16 : 80;
        const first = tapeLabel(event("first", 40, 100), 40, 80, height);
        const second = tapeLabel(event("second", 100, 160), 100, 80, height);
        const third = tapeLabel(event("third", 180, 240), 180, 80, height);
        painter._visualTheme.label[orientation].rangeAlign = rangeAlign;
        painter._repriseTapeLabels.push(first, second, third);

        painter.paint();

        const main = (item) => orientation === "horizontal"
            ? item.data.left
            : item.data.top;
        const cross = (item) => orientation === "horizontal"
            ? item.data.top
            : item.data.left;

        assert.deepEqual(
            [main(first), main(second), main(third)],
            rangeAlign === "center" ? [30, 90, 170] : [40, 100, 180]
        );
        assert.equal(cross(first), cross(third));
        assert.notEqual(cross(first), cross(second));
        });
    }
}

test("range label collisions route tracks without main-axis sliding", () => {
    const painter = makeEventPainter("horizontal", 300);
    const first = tapeLabel(event("first", 40, 140), 40, 60, 16);
    const second = tapeLabel(event("second", 90, 210), 90, 60, 16);
    painter._visualTheme.label.horizontal.rangeAlign = "center";
    painter._visualTheme.range.horizontal.sparklineStagger = 0;
    painter._repriseTapeLabels.push(first, second);

    painter.paint();

    assert.deepEqual([first.data.left, second.data.left], [60, 120]);
    assert.notEqual(first.data.top, second.data.top);
});

test("center alignment applies to short range labels but not instant labels", () => {
    const painter = makeEventPainter("horizontal");
    const theme = painter._params.theme;
    painter._visualTheme.label.horizontal.rangeAlign = "center";

    const rangeLabel = painter._paintEventLabel(
        event("short", 100, 110),
        "Long range label",
        110,
        2,
        100,
        16,
        theme,
        "timeline-event-label",
        -1
    );
    const instantLabel = painter._paintEventLabel(
        instantEvent("instant", 130),
        "Instant label",
        135,
        2,
        40,
        16,
        theme,
        "timeline-event-label",
        -1
    );

    assert.equal(rangeLabel.left, 55);
    assert.equal(instantLabel.left, 135);
});

test("horizontal event labels ignore distant right-edge stacks", () => {
    const baseline = makeEventPainter("horizontal");
    const baselineOpen = tapeLabel(event("open", -100, 80), 0, 30, 16);
    baseline._repriseTapeLabels.push(baselineOpen);
    baseline.paint();

    const crowded = makeEventPainter("horizontal");
    const crowdedOpen = tapeLabel(event("open", -100, 80), 0, 30, 16);
    crowded._repriseTapeLabels.push(
        crowdedOpen,
        tapeLabel(event("right-1", 170, 260), 170, 40, 16),
        tapeLabel(event("right-2", 170, 260), 170, 40, 16),
        tapeLabel(event("right-3", 170, 260), 170, 40, 16)
    );
    crowded.paint();

    assert.equal(crowdedOpen.data.top, baselineOpen.data.top);
    assert.equal(crowdedOpen.data.left, baselineOpen.data.left);
});

test("horizontal instant labels keep their routed track while a left-exiting range label is still visible", () => {
    const painter = makeEventPainter("horizontal");
    const range = tapeLabel(event("range", -40, -5), -40, 80, 16);
    const instantLabel = {
        evt: instantEvent("instant", 0),
        data: paintedData(0, 0, 30, 8),
        naturalLeft: 0,
        width: 30,
        height: 8
    };

    painter._repriseTapeLabels.push(range);
    painter._reprisePointLabels.push(instantLabel);
    painter.paint();

    assert.equal(range.data.elmt.style.display, "");
    assert.equal(range.data.left, -40);
    assert.equal(instantLabel.lane, 1);
});

test("horizontal instant labels keep their routed track while a left-exiting range label is just offscreen", () => {
    const painter = makeEventPainter("horizontal");
    const range = tapeLabel(event("range", -80, -50), -80, 80, 16);
    const instantLabel = {
        evt: instantEvent("instant", -10),
        data: paintedData(-10, 0, 30, 8),
        naturalLeft: -10,
        width: 30,
        height: 8
    };

    painter._repriseTapeLabels.push(range);
    painter._reprisePointLabels.push(instantLabel);
    painter.paint();

    assert.equal(range.data.elmt.style.display, "");
    assert.equal(range.data.left, -80);
    assert.equal(instantLabel.lane, 1);
});

test("horizontal instant labels keep their routed track while a right-exiting range label is still visible", () => {
    const painter = makeEventPainter("horizontal");
    const range = tapeLabel(event("range", 210, 240), 210, 80, 16);
    const instantLabel = {
        evt: instantEvent("instant", 190),
        data: paintedData(190, 0, 30, 8),
        naturalLeft: 190,
        width: 30,
        height: 8
    };

    painter._visualTheme.label.horizontal.rangeAlign = "center";
    painter._repriseTapeLabels.push(range);
    painter._reprisePointLabels.push(instantLabel);
    painter.paint();

    assert.equal(range.data.elmt.style.display, "");
    assert.equal(range.data.left, 185);
    assert.equal(instantLabel.lane, 1);
});

test("horizontal instant labels keep their routed track while a right-exiting range label is just offscreen", () => {
    const painter = makeEventPainter("horizontal");
    const range = tapeLabel(event("range", 230, 260), 230, 80, 16);
    const instantLabel = {
        evt: instantEvent("instant", 190),
        data: paintedData(190, 0, 30, 8),
        naturalLeft: 190,
        width: 30,
        height: 8
    };

    painter._visualTheme.label.horizontal.rangeAlign = "center";
    painter._repriseTapeLabels.push(range);
    painter._reprisePointLabels.push(instantLabel);
    painter.paint();

    assert.equal(range.data.elmt.style.display, "");
    assert.equal(range.data.left, 205);
    assert.equal(instantLabel.lane, 1);
});

function isHidden(item) {
    return item.data.elmt.style.display === "none";
}

function assertSparkAttached(item) {
    const left = item.data.left;
    const right = left + item.data.width;

    assert.ok(
        item.spark.left >= left - 1 && item.spark.left <= right + 1,
        `sparkline for "${item.evt.getID()}" should stay attached to its own label ` +
            `(label=[${left}, ${right}], spark.left=${item.spark.left})`
    );
}

function assertConnectedOrHidden(item) {
    if (isHidden(item)) return;
    assertSparkAttached(item);
}

test("horizontal duration label sparklines stay attached to their own label after routing", () => {
    const painter = makeEventPainter("horizontal");
    const open = tapeLabel(event("open", -100, 80), 0, 30, 16);
    const remoteLabelWithLocalSpark = tapeLabel(
        event("remote-label", 18, 260),
        170,
        40,
        16
    );
    painter._repriseTapeLabels.push(open, remoteLabelWithLocalSpark);

    painter.paint();

    assertSparkAttached(open);
    assertSparkAttached(remoteLabelWithLocalSpark);
});

test("horizontal duration labels are not dropped to prolong right-edge readability", () => {
    const painter = makeEventPainter("horizontal");
    const items = [];

    for (let i = 0; i < 5; i++) {
        const start = 20 + i * 2;
        items.push(tapeLabel(event("edge-" + i, start, 400), start, 50, 16));
    }
    painter._repriseTapeLabels.push(...items);

    painter.paint();

    assert.equal(items.filter(isHidden).length, 0);
    for (const item of items) assertSparkAttached(item);
});

test("horizontal duration labels hide at the sparkline range-end limit while retaining their route", () => {
    const painter = makeEventPainter("horizontal");
    let viewOffset = -80;
    painter._band.getViewOffset = () => viewOffset;
    painter._visualTheme.label.horizontal.rangeAlign = "center";

    const ending = tapeLabel(event("ending", 0, 100), 0, 40, 16);
    const instantLabel = {
        evt: instantEvent("instant", 96),
        data: paintedData(96, 0, 20, 8),
        naturalLeft: 96,
        width: 20,
        height: 8
    };
    painter._repriseTapeLabels.push(ending);
    painter._reprisePointLabels.push(instantLabel);
    painter.paint();

    assert.equal(ending.data.elmt.style.display, "");
    assert.equal(ending.data.left, 80);
    assert.equal(ending.spark.left, 82);

    viewOffset = -95;
    painter.paint();

    assert.equal(ending.data.elmt.style.display, "none");
    assert.equal(ending.spark.elmt.style.display, "none");
    assert.equal(instantLabel.lane, 1);
});

test("horizontal overlong duration labels slide at the leading edge until the sparkline limit", () => {
    const painter = makeEventPainter("horizontal");
    let viewOffset = -40;
    painter._band.getViewOffset = () => viewOffset;
    painter._visualTheme.label.horizontal.rangeAlign = "center";

    const ending = tapeLabel(event("ending", 0, 100), 0, 120, 16);
    const instantLabel = {
        evt: instantEvent("instant", 96),
        data: paintedData(96, 0, 20, 8),
        naturalLeft: 96,
        width: 20,
        height: 8
    };
    painter._repriseTapeLabels.push(ending);
    painter._reprisePointLabels.push(instantLabel);
    painter.paint();

    assert.equal(ending.data.elmt.style.display, "");
    assert.equal(ending.data.left, 40);
    assert.equal(ending.spark.left, 42);

    viewOffset = -95;
    painter.paint();

    assert.equal(ending.data.elmt.style.display, "none");
    assert.equal(ending.spark.elmt.style.display, "none");
    assert.equal(instantLabel.lane, 1);
});

test("several overlapping durations with long labels route across multiple label tracks, and every visible sparkline stays connected", () => {
    // Derived from scratch/demo-imprecise-ranges-events.js: many overlapping,
    // long-labelled ranges that force collision handling to reroute labels
    // across several label tracks (the scenario that exposed disconnected
    // tape-to-label sparklines in the ChronicleTimelineDemo "Imprecise Ranges"
    // example). This viewport is narrow enough that the latest-end events
    // crowd the right edge, exercising the "route collisions, do not drop
    // labels to keep them readable" behaviour in the same scenario.
    const specs = [
        ["standard-bounded", 0, 600, "Standard bounded"],
        ["imprecise-both", 60, 800, "Imprecise example - both ends"],
        ["imprecise-start", 60, 900, "Imprecise example - start"],
        ["imprecise-end", 300, 500, "Imprecise example - end"],
        ["open-start", -400, 600, "Open start example"],
        ["present-start", 40, 700, "Present start example"],
        ["unresolved-start", 40, 900, "Unresolved start example"],
        ["extra-overlap-1", 80, 750, "Extra overlapping duration one"],
        ["extra-overlap-2", 100, 780, "Extra overlapping duration two"],
        ["open-end", 300, 1400, "Open end example"],
        ["present-end", 400, 1400, "Present end example"],
        ["unresolved-end", 500, 1400, "Unresolved end example"]
    ];

    function build() {
        const painter = makeEventPainter("horizontal", 900);
        const items = specs.map(([id, start, end, title]) =>
            tapeLabel(event(id, start, end), start, Math.max(30, title.length * 6), 16)
        );
        painter._repriseTapeLabels.push(...items);
        return { painter, items };
    }

    const { painter, items } = build();

    painter.paint();

    let visible = items.filter((item) => !isHidden(item));
    assert.equal(items.filter(isHidden).length, 0);
    assert.ok(
        new Set(visible.map((item) => item.data.top)).size >= 3,
        "expected the remaining labels to be routed across multiple label tracks"
    );
    for (const item of items) assertConnectedOrHidden(item);

    // Simulate a subsequent relayout (resize/pan triggers softPaint, which
    // reruns the same routing over the already-painted items) and confirm
    // sorting/track reassignment/rerouting never mismatches a sparkline with
    // another event's geometry, and that the same set of labels stays
    // visible/connected rather than flip-flopping between relayouts.
    const visibleIdsBefore = visible.map((item) => item.evt.getID()).sort();
    painter.paint();
    for (const item of items) assertConnectedOrHidden(item);
    visible = items.filter((item) => !isHidden(item));
    assert.deepEqual(visible.map((item) => item.evt.getID()).sort(), visibleIdsBefore);
});

function untrackedEvent(id, start, end) {
    return {
        getID: () => id,
        getStart: () => start,
        getEnd: () => end,
        isInstant: () => false
    };
}

function visualThemeWithTrackGap(trackGap) {
    return {
        visualTheme: testVisualTheme({
            track: {
                horizontal: { size: 20, gap: trackGap },
                vertical: { size: 20, gap: trackGap }
            },
            instant: { width: 10, height: 10 },
            range: {
                width: 4,
                short: { minDisplayLength: 4 },
                horizontal: {
                    eventRoutingThreshold: 28,
                    sparklineStagger: 8
                }
            },
            label: {
                horizontal: { stickyInset: 0 }
            }
        }),
        event: {
            track: { offset: 2, height: 20, gap: trackGap },
            tape: {
                height: 4,
                horizontal: {
                    eventRoutingThreshold: 28,
                    sparklineStagger: 8,
                    stickyLeftInset: 0
                    // tapeGap, toRangeGap, routingGap and trackGap are
                    // deliberately left unset so each exercises its own independent
                    // default instead of falling back to track.gap.
                },
                short: { minDisplayLength: 4 }
            },
            label: { offsetFromLine: 3 },
            duration: { color: "gray" },
            instant: { iconWidth: 10, iconHeight: 10 }
        }
    };
}

function makePainterWithTrackGap(orientation, trackGap, viewLength) {
    const painter = makeEventPainter(orientation, viewLength);
    painter._params = { theme: visualThemeWithTrackGap(trackGap) };
    painter._visualTheme = painter._params.theme.visualTheme;
    painter._nativeTheme = painter._params.theme;
    return painter;
}

const IMPRECISE_RANGE_SPECS = [
    ["standard-bounded", 0, 600, "Standard bounded"],
    ["imprecise-both", 60, 800, "Imprecise example - both ends"],
    ["imprecise-start", 60, 900, "Imprecise example - start"],
    ["imprecise-end", 300, 500, "Imprecise example - end"],
    ["open-start", -400, 600, "Open start example"],
    ["present-start", 40, 700, "Present start example"],
    ["unresolved-start", 40, 900, "Unresolved start example"],
    ["extra-overlap-1", 80, 750, "Extra overlapping duration one"],
    ["extra-overlap-2", 100, 780, "Extra overlapping duration two"],
    ["open-end", 300, 1400, "Open end example"],
    ["present-end", 400, 1400, "Present end example"],
    ["unresolved-end", 500, 1400, "Unresolved end example"]
];

function buildImpreciseRangeItems() {
    return IMPRECISE_RANGE_SPECS.map(([id, start, end, title]) =>
        tapeLabel(event(id, start, end), start, Math.max(30, title.length * 6), 16)
    );
}

test("customizing track.gap does not change the tapeGap/toRangeGap defaults for overlapping tape lanes", () => {
    function buildItems() {
        return [
            tapeLabel(untrackedEvent("p", 0, 200), 0, 40, 16),
            tapeLabel(untrackedEvent("q", 50, 250), 200, 40, 16)
        ];
    }

    const baseline = makePainterWithTrackGap("horizontal", 2, 400);
    const baselineItems = buildItems();
    baseline._repriseTapeLabels.push(...baselineItems);
    baseline.paint();

    const detuned = makePainterWithTrackGap("horizontal", 40, 400);
    const detunedItems = buildItems();
    detuned._repriseTapeLabels.push(...detunedItems);
    detuned.paint();

    assert.equal(baseline._repriseTapeLaneEnds.length, 2, "fixture should need two overlapping tape lanes");
    assert.equal(detuned._repriseTapeLaneEnds.length, 2, "fixture should need two overlapping tape lanes");
    assert.equal(detunedItems[0].data.top, baselineItems[0].data.top);
    assert.equal(detunedItems[1].data.top, baselineItems[1].data.top);
});

test("customizing track.gap does not change the toRangeGap/trackGap defaults across routed label rows", () => {
    const baseline = makePainterWithTrackGap("horizontal", 2, 900);
    const baselineItems = buildImpreciseRangeItems();
    baseline._repriseTapeLabels.push(...baselineItems);
    baseline.paint();

    const detuned = makePainterWithTrackGap("horizontal", 60, 900);
    const detunedItems = buildImpreciseRangeItems();
    detuned._repriseTapeLabels.push(...detunedItems);
    detuned.paint();

    assert.ok(
        new Set(
            baselineItems.filter((item) => !isHidden(item)).map((item) => item.data.top)
        ).size >= 2,
        "fixture should route visible labels across multiple rows"
    );
    assert.equal(detuned._repriseLabelTrackCount, baseline._repriseLabelTrackCount);

    for (let i = 0; i < baselineItems.length; i++) {
        const id = IMPRECISE_RANGE_SPECS[i][0];
        assert.equal(isHidden(detunedItems[i]), isHidden(baselineItems[i]), `visibility mismatch for ${id}`);
        if (!isHidden(baselineItems[i])) {
            assert.equal(detunedItems[i].data.top, baselineItems[i].data.top, `top mismatch for ${id}`);
            assert.equal(detunedItems[i].data.left, baselineItems[i].data.left, `left mismatch for ${id}`);
        }
    }
});

test("customizing track.gap does not change the routingGap default used to decide whether adjacent labels share a row", () => {
    function buildItems() {
        return [
            tapeLabel(event("d", 0, 10), 0, 30, 16),
            tapeLabel(event("e", 100, 110), 38, 30, 16)
        ];
    }

    const baseline = makePainterWithTrackGap("horizontal", 2, 300);
    const baselineItems = buildItems();
    baseline._repriseTapeLabels.push(...baselineItems);
    baseline.paint();

    const detuned = makePainterWithTrackGap("horizontal", 200, 300);
    const detunedItems = buildItems();
    detuned._repriseTapeLabels.push(...detunedItems);
    detuned.paint();

    assert.equal(
        baselineItems[0].data.top,
        baselineItems[1].data.top,
        "labels exactly 8px apart should share a row at the default gap"
    );
    assert.equal(
        detunedItems[0].data.top,
        detunedItems[1].data.top,
        "a large track.gap must not force these labels into separate rows once routingGap has its own default"
    );
});

function buildPointLabelGapFixture({ routingGap, trackGap, overlap }) {
    const painter = makeEventPainter("horizontal", 300);
    const labelSpec = painter._visualTheme.label.horizontal;
    const secondLeft = overlap ? 0 : 50;
    const labels = [
        {
            evt: instantEvent("label-a", 0),
            lane: 0,
            trackTopOffset: 0,
            data: paintedData(0, 0, 30, 8),
            naturalLeft: 0,
            width: 30,
            height: 8
        },
        {
            evt: instantEvent("label-b", secondLeft),
            lane: 0,
            trackTopOffset: 0,
            data: paintedData(secondLeft, 0, 30, 8),
            naturalLeft: secondLeft,
            width: 30,
            height: 8
        }
    ];

    labelSpec.routingGap = routingGap;
    labelSpec.trackGap = trackGap;
    painter._reprisePointLabels.push(...labels);
    painter.paint();

    return labels;
}

test("label routingGap controls whether nearby horizontal labels use another row", () => {
    const close = buildPointLabelGapFixture({
        routingGap: 10,
        trackGap: 2,
        overlap: false
    });
    const separated = buildPointLabelGapFixture({
        routingGap: 25,
        trackGap: 2,
        overlap: false
    });

    assert.equal(close[0].data.top, close[1].data.top);
    assert.notEqual(separated[0].data.top, separated[1].data.top);
});

test("label trackGap controls the vertical gap between routed horizontal label rows", () => {
    for (const trackGap of [2, 9]) {
        const labels = buildPointLabelGapFixture({
            routingGap: 0,
            trackGap,
            overlap: true
        });

        assert.equal(
            Math.abs(labels[1].data.top - labels[0].data.top) - 20,
            trackGap
        );
    }
});

test("vertical label routingGap controls whether nearby labels use another column", () => {
    for (const [routingGap, sameColumn] of [[0, true], [9, false]]) {
        const painter = makeEventPainter("vertical", 300);
        const labels = [
            tapeLabel(event("vertical-a", 0, 100), 0, 80, 20),
            tapeLabel(event("vertical-b", 21, 120), 21, 80, 20)
        ];

        painter._visualTheme.label.vertical.routingGap = routingGap;
        painter._repriseTapeLabels.push(...labels);
        painter.paint();

        assert.equal(labels[0].data.left === labels[1].data.left, sameColumn);
        assert.equal(labels[1].data.top, 21);
    }
});

test("vertical label trackGap controls spacing between routed side columns", () => {
    function columnPitch(trackGap) {
        const painter = makeEventPainter("vertical", 300);
        const first = {
            evt: { ...untrackedEvent("vertical-point-a", 20, 20), isInstant: () => true },
            data: paintedData(0, 20, 80, 20),
            width: 80,
            height: 20
        };
        const second = {
            evt: { ...untrackedEvent("vertical-point-b", 20, 20), isInstant: () => true },
            data: paintedData(0, 20, 80, 20),
            width: 80,
            height: 20
        };

        painter._visualTheme.label.vertical.trackGap = trackGap;
        painter._reprisePointLabels.push(first, second);
        painter.paint();

        return second.data.left - first.data.left;
    }

    assert.equal(columnPitch(9) - columnPitch(2), 7);
});

function buildRangeGapFixture(
    orientation,
    { toRangeGap, toRangeBlockGap, tapeGap = 6, tapeWidth = 4, trackGap = 2 } = {}
) {
    const painter = makeEventPainter(orientation, 400);
    const theme = painter._params.theme;
    const tapeSpec = painter._visualTheme.range[orientation];
    const labelSpec = painter._visualTheme.label[orientation];
    const evt = eventOnLane("range", 20, 200, 0);
    const label = tapeLabel(evt, 20, 40, 16);
    const tape = {
        evt,
        lane: 0,
        data: paintedData(20, 80, 180, tapeWidth),
        startPixel: 20,
        endPixel: 200
    };

    painter._visualTheme.range.width = tapeWidth;
    painter._visualTheme.track[orientation].gap = trackGap;
    painter._repriseMetrics.trackGap = trackGap;
    tapeSpec.tapeGap = tapeGap;
    if (toRangeBlockGap === undefined) {
        delete labelSpec.toRangeBlockGap;
    } else {
        labelSpec.toRangeBlockGap = toRangeBlockGap;
    }
    if (toRangeGap === undefined) {
        delete labelSpec.toRangeGap;
    } else {
        labelSpec.toRangeGap = toRangeGap;
    }

    painter._repriseTapeLabels.push(label);
    painter._repriseTapeBars.push(tape);
    painter.paint();

    return { label, painter, tape };
}

function visibleSparklineToLabelGap(orientation, label) {
    return orientation === "horizontal"
        ? label.data.top - (label.spark.top + label.spark.height)
        : label.data.left - (label.spark.left + label.spark.width);
}

function crossAxisPosition(orientation, data) {
    return orientation === "horizontal" ? data.top : data.left;
}

function crossAxisSize(orientation, data) {
    return orientation === "horizontal" ? data.height : data.width;
}

function sparklineTapeCenterPosition(orientation, label) {
    return orientation === "horizontal" ? label.spark.top : label.spark.left;
}

for (const orientation of ["horizontal", "vertical"]) {
    test(`${orientation} label toRangeGap changes only the visible sparkline endpoint gap`, () => {
        const baseline = buildRangeGapFixture(orientation, {
            toRangeGap: 1,
            tapeGap: 8
        });
        const changed = buildRangeGapFixture(orientation, {
            toRangeGap: 6,
            tapeGap: 8
        });
        const defaulted = buildRangeGapFixture(orientation, { tapeGap: 8 });

        assert.equal(visibleSparklineToLabelGap(orientation, baseline.label), 1);
        assert.equal(visibleSparklineToLabelGap(orientation, changed.label), 6);
        assert.equal(visibleSparklineToLabelGap(orientation, defaulted.label), 4);
        assert.equal(
            crossAxisPosition(orientation, changed.label.data),
            crossAxisPosition(orientation, baseline.label.data),
            "toRangeGap must not move the label row/column"
        );
        assert.deepEqual(
            { left: changed.label.data.left, top: changed.label.data.top },
            { left: baseline.label.data.left, top: baseline.label.data.top },
            "toRangeGap must not move the label"
        );
        assert.equal(
            crossAxisPosition(orientation, changed.tape.data),
            crossAxisPosition(orientation, baseline.tape.data),
            "toRangeGap must not move the tape"
        );
        assert.deepEqual(
            { left: changed.tape.data.left, top: changed.tape.data.top },
            { left: baseline.tape.data.left, top: baseline.tape.data.top },
            "toRangeGap must not move the tape"
        );
    });

    test(`${orientation} range sparkline gap is independent of tape width, tapeGap, and track gap`, () => {
        const variants = [
            { tapeWidth: 4, tapeGap: 2, trackGap: 2 },
            { tapeWidth: 12, tapeGap: 2, trackGap: 2 },
            { tapeWidth: 4, tapeGap: 9, trackGap: 2 },
            { tapeWidth: 4, tapeGap: 2, trackGap: 50 }
        ];

        for (const variant of variants) {
            const { label } = buildRangeGapFixture(orientation, {
                ...variant,
                toRangeGap: 1
            });
            assert.equal(
                visibleSparklineToLabelGap(orientation, label),
                1,
                JSON.stringify(variant)
            );
        }
    });

    test(`${orientation} range sparkline starts at the tape center`, () => {
        const { label, tape } = buildRangeGapFixture(orientation, {
            tapeWidth: 6,
            toRangeBlockGap: 15,
            toRangeGap: 4
        });
        const tapeCenter = crossAxisPosition(orientation, tape.data) +
            Math.round(crossAxisSize(orientation, tape.data) / 2);

        assert.equal(sparklineTapeCenterPosition(orientation, label), tapeCenter);
    });

    test(`${orientation} range tapeGap controls tape lanes and label toRangeBlockGap controls label spacing`, () => {
        function build(tapeGap, toRangeBlockGap) {
            const painter = makeEventPainter(orientation, 500);
            const tapeSpec = painter._visualTheme.range[orientation];
            const labelSpec = painter._visualTheme.label[orientation];
            const events = [
                eventOnLane("lane-0", 20, 140, 0),
                eventOnLane("lane-1", 180, 320, 1)
            ];
            const labels = events.map((evt) => tapeLabel(evt, evt.getStart(), 40, 16));
            const tapes = events.map((evt) => ({
                evt,
                lane: evt.getTrackNum(),
                data: paintedData(evt.getStart(), 80, evt.getEnd() - evt.getStart(), 4),
                startPixel: evt.getStart(),
                endPixel: evt.getEnd()
            }));

            tapeSpec.tapeGap = tapeGap;
            labelSpec.toRangeBlockGap = toRangeBlockGap;
            labelSpec.toRangeGap = 0;
            painter._repriseTapeLabels.push(...labels);
            painter._repriseTapeBars.push(...tapes);
            painter.paint();

            return { labels, tapes };
        }

        for (const [tapeGap, toRangeBlockGap] of [[2, 15], [9, 18]]) {
            const { labels, tapes } = build(tapeGap, toRangeBlockGap);
            const firstTapeEnd = crossAxisPosition(orientation, tapes[0].data) +
                crossAxisSize(orientation, tapes[0].data);
            const secondTapeEnd = crossAxisPosition(orientation, tapes[1].data) +
                crossAxisSize(orientation, tapes[1].data);

            assert.equal(
                crossAxisPosition(orientation, tapes[1].data) - firstTapeEnd,
                tapeGap,
                "tapeGap must set the space between adjacent tape lanes"
            );
            assert.equal(
                crossAxisPosition(orientation, labels[0].data) - secondTapeEnd,
                toRangeBlockGap,
                "the tape block must use toRangeBlockGap before the first label row/column"
            );
        }
    });

    test(`${orientation} range tapeGap does not change time-axis lane assignment`, () => {
        function assignedLanes(tapeGap) {
            const painter = makeEventPainter(orientation, 500);
            const tapeSpec = painter._visualTheme.range[orientation];
            const labels = [
                tapeLabel(untrackedEvent("first", 20, 100), 20, 40, 16),
                tapeLabel(untrackedEvent("second", 101, 180), 101, 40, 16)
            ];

            tapeSpec.tapeGap = tapeGap;
            painter._repriseTapeLabels.push(...labels);
            painter.paint();

            return labels.map((label) => label.lane);
        }

        assert.deepEqual(assignedLanes(2), [0, 0]);
        assert.deepEqual(assignedLanes(50), [0, 0]);
    });

    test(`${orientation} label excessive toRangeGap clamps sparkline length to zero`, () => {
        const { label } = buildRangeGapFixture(orientation, {
            toRangeGap: 100,
            tapeGap: 2
        });

        assert.equal(
            orientation === "horizontal" ? label.spark.height : label.spark.width,
            0
        );
    });
}

for (const orientation of ["horizontal", "vertical"]) {
    test(`${orientation} unthemed range sparklines fall back to native tape blue`, () => {
        const painter = makeEventPainter(orientation);
        const label = tapeLabel(event("default-blue", 20, 120), 20, 60, 16);

        delete painter._params.theme.event.duration.color;
        label.tapeColor = undefined;
        painter._repriseTapeLabels.push(label);
        painter.paint();

        assert.equal(
            label.spark.elmt.style.backgroundColor,
            "color-mix(in srgb, blue 70%, white)"
        );
    });
}

function buildShortRangeGapFixture(
    orientation,
    { horizontalGap, verticalGap } = {}
) {
    const painter = makeEventPainter(orientation, 400);
    const metrics = painter._repriseMetrics;
    const theme = painter._params.theme;
    const short = eventOnLane("short", 20, 30, 0);

    painter._visualTheme.label.horizontal.toRangeGap = horizontalGap;
    painter._visualTheme.label.vertical.toRangeGap = verticalGap;

    const tape = painter._paintEventTape(
        short,
        0,
        20,
        30,
        "gray",
        100,
        metrics,
        theme,
        0
    );
    const label = painter._paintEventLabel(
        short,
        "short",
        20,
        metrics.trackOffset + theme.event.tape.height,
        40,
        8,
        theme,
        "timeline-event-label"
    );
    painter.paint();

    return { label, tape };
}

function visibleShortRangeLabelGap(orientation, fixture) {
    return orientation === "horizontal"
        ? fixture.label.top - (fixture.tape.top + fixture.tape.height)
        : fixture.label.left - (fixture.tape.left + fixture.tape.width);
}

for (const orientation of ["horizontal", "vertical"]) {
    test(`${orientation} short ranges use the orientation-specific label toRangeGap`, () => {
        const fixture = buildShortRangeGapFixture(orientation, {
            horizontalGap: 4,
            verticalGap: 9
        });

        assert.equal(
            visibleShortRangeLabelGap(orientation, fixture),
            orientation === "horizontal" ? 4 : 9
        );
    });
}

test("horizontal instant icons use the adjusted timepoint baseline", () => {
    const painter = makeEventPainter("horizontal");
    const evt = instantEvent("instant", 20);
    const icon = painter._paintEventIcon(
        evt,
        0,
        20,
        painter._repriseMetrics,
        painter._params.theme,
        0
    );

    assert.equal(icon.left, 21);
    assert.equal(icon.elmt.style.left, "21px");
    assert.equal(painter._reprisePointIcons[0].data.left, 21);
});

test("vertical instant icons use the adjusted timepoint baseline", () => {
    const painter = makeEventPainter("vertical");
    const evt = instantEvent("instant", 20);
    const icon = painter._paintEventIcon(
        evt,
        0,
        20,
        painter._repriseMetrics,
        painter._params.theme,
        0
    );

    assert.equal(icon.top, 22);
    assert.equal(icon.elmt.style.top, "22px");
    assert.equal(painter._reprisePointIcons[0].data.top, 22);
});

test("horizontal instant labels move from the adjusted icon baseline", () => {
    const painter = makeEventPainter("horizontal");
    const evt = instantEvent("instant", 20);
    const theme = painter._params.theme;
    const icon = painter._paintEventIcon(
        evt,
        0,
        20,
        painter._repriseMetrics,
        theme,
        0
    );
    const label = painter._paintEventLabel(
        evt,
        "instant",
        0,
        0,
        60,
        8,
        theme,
        "timeline-event-label"
    );

    assert.equal(icon.left, 21);
    assert.equal(label.left, 35);
    assert.equal(label.left - (icon.left + icon.width), 4);
});

test("vertical instant labels move from the adjusted icon baseline", () => {
    const painter = makeEventPainter("vertical");
    const evt = instantEvent("instant", 20);
    const theme = painter._params.theme;
    const icon = painter._paintEventIcon(
        evt,
        0,
        20,
        painter._repriseMetrics,
        theme,
        0
    );
    const label = painter._paintEventLabel(
        evt,
        "instant",
        20,
        0,
        60,
        8,
        theme,
        "timeline-event-label"
    );

    painter.paint();

    assert.equal(icon.top, 22);
    assert.equal(label.top, 36);
    assert.equal(label.top - (icon.top + icon.height), 4);
});

for (const orientation of ["horizontal", "vertical"]) {
    test(`${orientation} instant iconColor follows default, theme, event, and emphasis precedence`, () => {
        function paint({
            themeColor,
            eventColor,
            eventIconColor,
            emphasisIconColor,
            tags = null,
            disableEmphasis = false,
            scope = "graphic",
            icon = null
        } = {}) {
            const painter = makeEventPainter(orientation);
            const theme = painter._params.theme;
            const evt = styledInstantEvent("instant", 20, {
                color: eventColor,
                icon,
                iconColor: eventIconColor,
                emphasis: "critical",
                tags
            });

            painter._visualTheme.instant.iconColor = themeColor || "blue";
            theme.emphasisSpecs = {
                critical: emphasisIconColor == null
                    ? {}
                    : { iconColor: emphasisIconColor }
            };
            painter._visualTheme = testVisualTheme({
                instant: { iconColor: themeColor || "blue" },
                tagsToIconColor: { release: "tag-color" },
                eventColorScope: scope,
                disableEmphasis
            });

            return painter._paintEventIcon(
                evt,
                0,
                20,
                painter._repriseMetrics,
                theme,
                0
            ).icon;
        }

        assert.equal(paint(), "theme-icon:blue:10");
        assert.equal(paint({ themeColor: "orange" }), "theme-icon:orange:10");
        assert.equal(
            paint({ themeColor: "orange", eventIconColor: "green" }),
            "theme-icon:green:10"
        );
        assert.equal(
            paint({ themeColor: "orange", tags: ["release"] }),
            "theme-icon:tag-color:10"
        );
        assert.equal(
            paint({
                themeColor: "orange",
                eventIconColor: "green",
                tags: ["release"],
                emphasisIconColor: "red"
            }),
            "theme-icon:red:10"
        );
        assert.equal(
            paint({
                themeColor: "orange",
                eventIconColor: "green",
                tags: ["release"],
                emphasisIconColor: "red",
                disableEmphasis: true
            }),
            "theme-icon:green:10"
        );
    });

    test(`${orientation} instant event color and iconColor obey eventColorScope`, () => {
        function paint(scope, eventIconColor = null) {
            const painter = makeEventPainter(orientation);
            const theme = painter._params.theme;
            const evt = styledInstantEvent("instant", 20, {
                color: "purple",
                iconColor: eventIconColor
            });

            painter._visualTheme = testVisualTheme({
                instant: { iconColor: "orange" },
                eventColorScope: scope
            });

            return painter._paintEventIcon(
                evt,
                0,
                20,
                painter._repriseMetrics,
                theme,
                0
            ).icon;
        }

        assert.equal(paint("graphic"), "theme-icon:purple:10");
        assert.equal(paint("both"), "theme-icon:purple:10");
        assert.equal(paint("label"), "theme-icon:orange:10");
        assert.equal(paint("none"), "theme-icon:orange:10");
        assert.equal(paint("graphic", "green"), "theme-icon:green:10");
        assert.equal(paint("label", "green"), "theme-icon:orange:10");
        assert.equal(paint("none", "green"), "theme-icon:orange:10");
    });

    test(`${orientation} instant custom icon URLs survive theme defaults but yield to event iconColor`, () => {
        const painter = makeEventPainter(orientation);
        const theme = painter._params.theme;
        painter._visualTheme.instant.iconColor = "orange";

        function paint(eventIconColor) {
            return painter._paintEventIcon(
                styledInstantEvent("instant", 20, {
                    icon: "custom.svg",
                    iconColor: eventIconColor
                }),
                0,
                20,
                painter._repriseMetrics,
                theme,
                0
            ).icon;
        }

        assert.equal(paint(null), "custom.svg");
        assert.equal(paint("green"), "theme-icon:green:10");
    });
}

test("duration emphasis iconColor overrides event tapeColor", () => {
    const painter = makeEventPainter("horizontal");
    const theme = painter._params.theme;
    const evt = {
        ...event("duration", 20, 80),
        getColor: () => null,
        getProperty: (name) => ({
            emphasis: "critical",
            tapeColor: "green"
        })[name]
    };

    theme.emphasisSpecs = { critical: { iconColor: "red" } };
    const tape = painter._paintEventTape(
        evt,
        0,
        20,
        80,
        "gray",
        100,
        painter._repriseMetrics,
        theme,
        0
    );

    assert.equal(tape.color, "red");
});

test("duration tapeColor obeys eventColorScope", () => {
    function paint(scope) {
        const painter = makeEventPainter("horizontal");
        const theme = painter._params.theme;
        const evt = {
            ...event("duration", 20, 80),
            getColor: () => "purple",
            getProperty: name => ({
                tags: ["release"],
                tapeColor: "green"
            })[name] ?? null
        };

        painter._visualTheme = testVisualTheme({
            eventColorScope: scope,
            range: { iconColor: "orange" },
            tagsToIconColor: { release: "tag-color" }
        });

        return painter._paintEventTape(
            evt,
            0,
            20,
            80,
            "gray",
            100,
            painter._repriseMetrics,
            theme,
            0
        ).color;
    }

    assert.equal(paint("graphic"), "green");
    assert.equal(paint("both"), "green");
    assert.equal(paint("label"), "tag-color");
    assert.equal(paint("none"), "tag-color");
});

test("event tape and label DOM receive visual theme classes", () => {
    const painter = makeEventPainter("horizontal");
    const theme = painter._params.theme;
    const range = {
        ...event("range", 20, 30),
        getProperty: name => ({
            cssClass: "range-item",
            labelCssClass: "range-item-label"
        })[name] ?? null
    };
    const instant = {
        ...instantEvent("instant", 30),
        getProperty: name => ({
            labelCssClass: "instant-item-label"
        })[name] ?? null
    };

    painter._visualTheme = testVisualTheme({
        id: "editorial",
        label: {
            instantCssClass: "instant-theme-label",
            rangeCssClass: "range-theme-label"
        },
        range: {
            cssClass: "range-theme"
        }
    });

    const tape = painter._paintEventTape(
        range,
        0,
        20,
        30,
        "gray",
        100,
        painter._repriseMetrics,
        theme,
        0
    );
    const rangeLabel = painter._paintEventLabel(
        range,
        "range",
        20,
        0,
        60,
        8,
        theme,
        "timeline-event-label"
    );
    const instantLabel = painter._paintEventLabel(
        instant,
        "instant",
        30,
        0,
        60,
        8,
        theme,
        "timeline-event-label"
    );

    assertHasClasses(tape.elmt, [
        "timeline-event-editorial-tape",
        "range-theme",
        "range-item"
    ]);
    assertHasClasses(rangeLabel.elmt, [
        "timeline-event-editorial-label",
        "timeline-event-editorial-range-label",
        "range-theme-label",
        "range-item-label"
    ]);
    assertHasClasses(instantLabel.elmt, [
        "timeline-event-editorial-label",
        "timeline-event-editorial-instant-label",
        "instant-theme-label",
        "instant-item-label"
    ]);
});

test("event labelColor and textColor obey eventColorScope", () => {
    function paint(scope, properties, emphasisSpecs = {}, disableEmphasis = false) {
        const painter = makeEventPainter("horizontal");
        const theme = painter._params.theme;
        const evt = {
            ...instantEvent("instant", 20),
            getColor: () => properties.color ?? null,
            getTextColor: () => properties.textColor ?? null,
            getProperty: name => properties[name] ?? null
        };

        theme.emphasisSpecs = emphasisSpecs;
        painter._visualTheme = testVisualTheme({
            eventColorScope: scope,
            disableEmphasis
        });

        return painter._paintEventLabel(
            evt,
            "instant",
            20,
            0,
            60,
            8,
            theme,
            "timeline-event-label"
        ).elmt.style.color;
    }

    assert.equal(paint("label", { labelColor: "green" }), "green");
    assert.equal(paint("both", { textColor: "purple" }), "purple");
    assert.equal(
        paint("both", { labelColor: "green", textColor: "purple" }),
        "green"
    );
    assert.equal(paint("graphic", { labelColor: "green" }), "");
    assert.equal(paint("none", { textColor: "purple", color: "orange" }), "");
    assert.equal(
        paint(
            "none",
            { emphasis: "critical", labelColor: "green" },
            { critical: { labelColor: "red" } }
        ),
        "red"
    );
    assert.equal(
        paint(
            "none",
            { emphasis: "critical", labelColor: "green" },
            { critical: { labelColor: "red" } },
            true
        ),
        ""
    );
});

test("event range labels route with the orthogonal visual footprint", () => {
    const painter = makeEventPainter("horizontal");
    const theme = painter._params.theme;
    const first = event("first", 0, 80);
    const second = event("second", 50, 130);

    painter._visualTheme = testVisualTheme({
        label: { flow: "orthogonal" }
    });
    painter._timeline.getDocument = () => ({
        getElementById: () => null,
        createElement: () => ({ className: "", style: {} }),
        head: { appendChild() {} }
    });
    painter._eventLayer = { appendChild() {} };

    const firstLabel = painter._paintEventLabel(
        first,
        "first",
        4,
        0,
        60,
        10,
        theme,
        "timeline-event-label"
    );
    const secondLabel = painter._paintEventLabel(
        second,
        "second",
        54,
        0,
        60,
        10,
        theme,
        "timeline-event-label"
    );

    painter.paint();

    assert.equal(firstLabel.width, 10);
    assert.equal(firstLabel.height, 60);
    assert.equal(firstLabel.left, 4);
    assert.equal(firstLabel.elmt.style.width, "60px");
    assert.equal(firstLabel.elmt.style.height, "10px");
    assert.equal(firstLabel.elmt.style.textAlign, "right");
    assert.equal(firstLabel.elmt.style.transform, "translateY(60px) rotate(-90deg)");
    assert.equal(secondLabel.top, firstLabel.top);
});

test("event instant labels use orthogonal visual dimensions", () => {
    const painter = makeEventPainter("horizontal");
    const theme = painter._params.theme;
    const evt = instantEvent("instant", 20);
    const iconData = paintedData(20, 10, 10, 10);

    painter._visualTheme = testVisualTheme({
        label: { flow: "orthogonal" }
    });
    painter._reprisePointIcons.push({
        evt,
        lane: 0,
        trackTopOffset: 8,
        data: iconData
    });

    const label = painter._paintEventLabel(
        evt,
        "instant",
        0,
        0,
        50,
        12,
        theme,
        "timeline-event-label"
    );

    assert.equal(label.width, 12);
    assert.equal(label.height, 50);
    assert.equal(label.left, 34);
    assert.equal(label.elmt.style.textAlign, "right");
    assert.equal(label.elmt.style.transform, "translateY(50px) rotate(-90deg)");
    assert.equal(painter._reprisePointLabels[0].width, 12);
    assert.equal(painter._reprisePointLabels[0].height, 50);
});

test("horizontal label toInstantGap is the exact visible dot-to-label gap", () => {
    const painter = makeEventPainter("horizontal");
    const evt = instantEvent("instant", 20);
    const theme = painter._params.theme;
    painter._visualTheme.label.horizontal.toInstantGap = 6;

    const iconData = paintedData(20, 10, 10, 10);
    painter._reprisePointIcons.push({
        evt,
        lane: 0,
        trackTopOffset: 8,
        data: iconData
    });

    const label = painter._paintEventLabel(
        evt,
        "instant",
        0,
        0,
        60,
        8,
        theme,
        "timeline-event-label"
    );

    assert.equal(label.left, 36);
    assert.equal(label.top, 11);
    assert.equal(label.elmt.style.left, "36px");
    assert.equal(label.elmt.style.top, "11px");
    assert.equal(label.left - (iconData.left + iconData.width), 6);
    assert.equal(painter._reprisePointLabels[0].naturalLeft, 36);
});

test("horizontal label toInstantGap defaults to 4px", () => {
    const painter = makeEventPainter("horizontal");
    const evt = instantEvent("instant", 20);
    const iconData = paintedData(20, 10, 10, 10);

    painter._reprisePointIcons.push({ evt, lane: 0, trackTopOffset: 8, data: iconData });
    const label = painter._paintEventLabel(
        evt,
        "instant",
        0,
        0,
        60,
        8,
        painter._params.theme,
        "timeline-event-label"
    );

    assert.equal(label.left - (iconData.left + iconData.width), 4);
});

test("horizontal instant event icon and label sit 3px above the routed row baseline", () => {
    const painter = makeEventPainter("horizontal");
    const evt = instantEvent("instant", 20);
    const iconData = paintedData(20, 10, 10, 10);

    painter._reprisePointIcons.push({
        evt,
        lane: 0,
        trackTopOffset: 8,
        data: iconData
    });

    const label = painter._paintEventLabel(
        evt,
        "instant",
        0,
        0,
        60,
        8,
        painter._params.theme,
        "timeline-event-label"
    );
    painter.paint();

    assert.equal(iconData.top, 7);
    assert.equal(label.top, 8);
});

test("vertical label toInstantGap is exact and defaults to 4px", () => {
    function measure(toInstantGap) {
        const painter = makeEventPainter("vertical");
        const evt = instantEvent("instant", 20);
        const theme = painter._params.theme;
        const iconData = paintedData(10, 20, 10, 10);

        if (toInstantGap !== undefined) {
            painter._visualTheme.label.vertical.toInstantGap = toInstantGap;
        }
        painter._reprisePointIcons.push({ evt, lane: 0, data: iconData, width: 10, height: 10 });
        const label = painter._paintEventLabel(
            evt,
            "instant",
            20,
            0,
            60,
            8,
            theme,
            "timeline-event-label"
        );
        painter.paint();

        return label.top - (iconData.top + iconData.height);
    }

    assert.equal(measure(), 4);
    assert.equal(measure(7), 7);
});

test("horizontal stacked duration labels place the longest span outside", () => {
    const painter = makeEventPainter("horizontal");
    const long = tapeLabel(event("long", 0, 160), 0, 50, 16);
    const short = tapeLabel(event("short", 0, 60), 0, 50, 16);
    painter._repriseTapeLabels.push(long, short);

    painter.paint();

    assert.ok(long.data.top > short.data.top);
    assert.equal(long.data.left, short.data.left);
});

function verticalInstantGroup(id, top) {
    const evt = {
        ...untrackedEvent(id, top, top),
        isInstant: () => true
    };

    return {
        evt,
        icon: {
            evt,
            data: paintedData(0, top, 10, 10),
            width: 10,
            height: 10
        },
        label: {
            evt,
            data: paintedData(0, top + 14, 80, 20),
            width: 80,
            height: 20
        }
    };
}

test("vertical point events reuse tape-label track zero when their labels do not collide", () => {
    const painter = makeEventPainter("vertical");
    const rangeLabel = tapeLabel(untrackedEvent("range", 0, 100), 0, 80, 20);
    const point = verticalInstantGroup("point", 40);

    painter._repriseTapeLabels.push(rangeLabel);
    painter._reprisePointIcons.push(point.icon);
    painter._reprisePointLabels.push(point.label);
    painter.paint();

    assert.equal(point.icon.physicalTrack, 0);
    assert.equal(point.label.physicalTrack, 0);
    assert.equal(point.icon.data.left, rangeLabel.data.left);
    assert.equal(point.label.data.left, rangeLabel.data.left);
});

test("vertical point events leave track zero when their labels collide with a tape label", () => {
    const painter = makeEventPainter("vertical");
    const rangeLabel = tapeLabel(untrackedEvent("range", 0, 100), 0, 80, 20);
    const point = verticalInstantGroup("point", 5);

    painter._repriseTapeLabels.push(rangeLabel);
    painter._reprisePointIcons.push(point.icon);
    painter._reprisePointLabels.push(point.label);
    painter.paint();

    assert.equal(point.icon.physicalTrack, 1);
    assert.equal(point.label.physicalTrack, 1);
    assert.ok(point.label.data.left > rangeLabel.data.left);
});

test("a vertical short-duration tape occupying track zero routes a colliding point event outward", () => {
    const painter = makeEventPainter("vertical");
    const rangeLabel = tapeLabel(untrackedEvent("long-range", 0, 100), 0, 80, 20);
    const shortEvent = untrackedEvent("short-range", 30, 40);
    const shortTape = {
        evt: shortEvent,
        data: paintedData(0, 30, 4, 10),
        width: 4,
        height: 10
    };
    const shortLabel = {
        evt: shortEvent,
        data: paintedData(0, 30, 80, 20),
        width: 80,
        height: 20
    };
    const point = verticalInstantGroup("point", 35);

    painter._repriseTapeLabels.push(rangeLabel);
    painter._reprisePointTapes.push(shortTape);
    painter._reprisePointLabels.push(shortLabel, point.label);
    painter._reprisePointIcons.push(point.icon);
    painter.paint();

    assert.equal(shortTape.physicalTrack, 0);
    assert.equal(shortLabel.physicalTrack, 0);
    assert.equal(point.icon.physicalTrack, 1);
    assert.equal(point.label.physicalTrack, 1);
    assert.equal(
        point.label.data.left - (shortLabel.data.left + shortLabel.data.width),
        painter._visualTheme.range.vertical.toEventGap
    );
});

test("vertical event duration labels use local side lanes", () => {
    const baseline = makeEventPainter("vertical");
    const baselineTop = tapeLabel(event("top", 0, 50), 0, 80, 25);
    baseline._repriseTapeLabels.push(baselineTop);
    baseline.paint();

    const crowded = makeEventPainter("vertical");
    const crowdedTop = tapeLabel(event("top", 0, 50), 0, 80, 25);
    const lowerLabels = [
        tapeLabel(event("lower-1", 120, 150), 120, 80, 25),
        tapeLabel(event("lower-2", 120, 150), 120, 80, 25),
        tapeLabel(event("lower-3", 120, 150), 120, 80, 25)
    ];
    crowded._repriseTapeLabels.push(crowdedTop, ...lowerLabels);
    crowded.paint();

    assert.equal(crowdedTop.data.left, baselineTop.data.left);
    assert.equal(crowdedTop.data.top, baselineTop.data.top);
    assert.equal(new Set(lowerLabels.map((item) => item.data.left)).size, 3);
    assert.deepEqual(lowerLabels.map((item) => item.data.top), [120, 120, 120]);
});

test("vertical stacked duration labels place the longest span outside", () => {
    const painter = makeEventPainter("vertical");
    const long = tapeLabel(event("long", 10, 40), 10, 80, 25);
    const short = tapeLabel(event("short", 10, 30), 10, 80, 25);
    painter._repriseTapeLabels.push(long, short);

    painter.paint();

    assert.ok(long.data.left > short.data.left);
    assert.equal(long.data.top, short.data.top);
});

function makeNarrative(orientation) {
    const NarrativeDecorator = loadNarrativeDecorator();
    const decorator = new NarrativeDecorator({});
    const horizontal = orientation === "horizontal";
    let viewOffset = 0;

    decorator._timeline = {
        isHorizontal: () => horizontal,
        isVertical: () => !horizontal
    };
    decorator._band = {
        dateToPixelOffset: (value) => value,
        getViewOffset: () => viewOffset,
        getViewLength: () => 200,
        getViewWidth: () => 200
    };
    decorator.setViewOffset = (value) => {
        viewOffset = value;
    };
    decorator._layerDiv = {};
    decorator._spanSize = 10;
    decorator._spanOffset = 0;
    decorator._stickyInset = 0;
    decorator._stickyGap = 5;
    decorator._trackCount = 2;
    decorator._trackOffset = 0;
    decorator._trackSize = 40;
    decorator._trackGap = 5;
    decorator._trackAlign = "start";
    decorator._labelOffset = 0;
    decorator._rangeToLabelGap = 4;
    decorator._instantToLabelGap = 4;
    decorator._instantRecords = [];

    return decorator;
}

function narrativeRange(
    decorator,
    index,
    start,
    end,
    width,
    renderedHeight,
    { item = {}, lineBoxHeight = renderedHeight } = {}
) {
    const labelElmt = element(width, lineBoxHeight);
    labelElmt.scrollHeight = renderedHeight;

    const record = {
        item,
        index,
        startDate: start,
        endDate: end,
        baseTrack: decorator._resolveRangeTrack(item),
        trackExplicit: decorator._trackIsExplicit(item),
        startPixel: 0,
        endPixel: 0,
        _verticalPlacement: decorator._rangePlacementState.get(item) || null,
        labelElmt
    };

    record.track = record.baseTrack;
    decorator._measureLabel(record);
    return record;
}

function narrativeInstant(
    decorator,
    index,
    date,
    width,
    renderedHeight,
    { item = {}, lineBoxHeight = renderedHeight } = {}
) {
    const labelElmt = element(width, lineBoxHeight);
    labelElmt.scrollHeight = renderedHeight;

    const record = {
        item,
        index,
        date,
        baseTrack: decorator._resolveTrack(item, index),
        trackExplicit: decorator._trackIsExplicit(item),
        pixel: 0,
        labelElmt,
        lineElmt: { style: {} }
    };

    record.track = record.baseTrack;
    decorator._measureLabel(record);
    return record;
}

function narrativePlacement(records) {
    return records.map((record) => ({
        track: record.track,
        top: record.labelElmt.style.top,
        left: record.labelElmt.style.left,
        display: record.labelElmt.style.display
    }));
}

test("narrative defaults layer dividers between marker ticks and labels", () => {
    const NarrativeDecorator = loadNarrativeDecorator();
    const layers = [];
    const document = {
        createElement: () => ({
            children: [],
            className: "",
            style: {},
            appendChild(child) {
                this.children.push(child);
            },
            setAttribute() {},
            removeAttribute() {}
        })
    };
    const band = {
        createLayerDiv(zIndex, className = "") {
            const layer = {
                zIndex,
                className,
                children: [],
                attributes: {},
                style: {},
                appendChild(child) {
                    this.children.push(child);
                },
                setAttribute(name, value) {
                    this.attributes[name] = value;
                }
            };

            layers.push(layer);
            return layer;
        },
        removeLayerDiv() {},
        dateToPixelOffset: value => value,
        getViewOffset: () => 0,
        getViewLength: () => 200,
        getViewWidth: () => 200
    };
    const timeline = {
        getDocument: () => document,
        isHorizontal: () => true,
        isVertical: () => false
    };
    const decorator = new NarrativeDecorator({
        ranges: [{ start: 0, end: 20 }],
        instants: [{ date: 10 }]
    });

    decorator._labels = false;
    decorator._runtime = {
        readEventTime(item) {
            return Object.hasOwn(item, "date")
                ? { kind: "instant", value: item.date }
                : { kind: "range", start: item.start, end: item.end };
        }
    };
    decorator._band = band;
    decorator._timeline = timeline;
    decorator.paint();

    const spanLayer = layers.find(layer =>
        layer.className.includes("timeline-narrative-visual-layer")
    );
    const dividerLayer = layers.find(layer =>
        layer.className.includes("timeline-narrative-divider-layer")
    );

    assert.equal(spanLayer.zIndex, 5);
    assert.equal(dividerLayer.zIndex, 101);
    assert.equal(spanLayer.children[0].className, "timeline-narrative-span");
    assert.equal(dividerLayer.children[0].className, "timeline-narrative-instant-line");
});

test("narrative span, divider, and label z-index overrides stay independent", () => {
    const NarrativeDecorator = loadNarrativeDecorator();
    const decorator = new NarrativeDecorator({
        visualTheme: {
            layer: {
                zIndex: 17,
                dividerZIndex: 37,
                labelZIndex: 57
            }
        }
    });

    assert.equal(decorator._zIndex, 17);
    assert.equal(decorator._dividerZIndex, 37);
    assert.equal(decorator._labelZIndex, 57);
});

test("horizontal narrative labels keep their existing themed routing without item track pins", () => {
    const decorator = makeNarrative("horizontal");
    decorator._trackOffset = 12;
    decorator._trackSize = 22;
    decorator._trackGap = 4;
    const first = narrativeRange(decorator, 0, -100, 100, 30, 16);
    const second = narrativeRange(decorator, 1, -80, 150, 30, 16);
    decorator._rangeRecords = [first, second];

    decorator.softPaint();

    assert.equal("track" in first.item, false);
    assert.equal("track" in second.item, false);
    assert.deepEqual(narrativePlacement([first, second]), [
        { track: 0, top: "12px", left: "0px", display: "" },
        { track: 1, top: "38px", left: "0px", display: "" }
    ]);
});

test("horizontal narrative range labels use label toRangeGap at the range edge", () => {
    const decorator = makeNarrative("horizontal");
    decorator._rangeToLabelGap = 6;
    const range = narrativeRange(decorator, 0, 20, 100, 30, 16);
    decorator._rangeRecords = [range];

    decorator.softPaint();

    assert.equal(range.labelElmt.style.left, "26px");
});

test("horizontal narrative range labels that already overhang their range stay fixed", () => {
    const decorator = makeNarrative("horizontal");
    decorator._rangeToLabelGap = 0;
    const overhanging = narrativeRange(decorator, 0, 0, 40, 80, 16);
    const downstream = narrativeRange(decorator, 1, 10, 100, 20, 16);
    decorator._rangeRecords = [overhanging, downstream];

    decorator.setViewOffset(-20);
    decorator.softPaint();

    assert.equal(overhanging.track, 0);
    assert.equal(overhanging.labelElmt.style.left, "0px");
    assert.equal(downstream.track, 1);
});

test("horizontal narrative range labels slide only until their right edge reaches the range end", () => {
    const decorator = makeNarrative("horizontal");
    decorator._rangeToLabelGap = 0;
    const range = narrativeRange(decorator, 0, 0, 100, 30, 16);
    decorator._rangeRecords = [range];

    decorator.setViewOffset(-60);
    decorator.softPaint();
    assert.equal(range.labelElmt.style.left, "60px");

    decorator.setViewOffset(-80);
    decorator.softPaint();
    assert.equal(range.labelElmt.style.left, "70px");
});

test("horizontal narrative instant labels keep their routed track while a left-exiting range label is still visible", () => {
    const decorator = makeNarrative("horizontal");
    decorator._rangeToLabelGap = 0;
    decorator._dividerWidth = 1;
    const range = narrativeRange(decorator, 0, -40, -5, 80, 16);
    const instant = narrativeInstant(decorator, 1, 0, 30, 16);
    decorator._rangeRecords = [range];
    decorator._instantRecords = [instant];

    decorator.softPaint();

    assert.equal(range.labelElmt.style.display, "");
    assert.equal(range.labelElmt.style.left, "-40px");
    assert.equal(instant.track, 1);
});

test("horizontal narrative instant labels keep their routed track while a left-exiting range label is just offscreen", () => {
    const decorator = makeNarrative("horizontal");
    decorator._rangeToLabelGap = 0;
    decorator._dividerWidth = 1;
    const range = narrativeRange(decorator, 0, -80, -50, 80, 16);
    const instant = narrativeInstant(decorator, 1, -10, 30, 16);
    decorator._rangeRecords = [range];
    decorator._instantRecords = [instant];

    decorator.softPaint();

    assert.equal(range.labelElmt.style.display, "");
    assert.equal(range.labelElmt.style.left, "-80px");
    assert.equal(instant.track, 1);
});

test("horizontal narrative instant labels keep their routed track while a right-exiting range label is still visible", () => {
    const decorator = makeNarrative("horizontal");
    decorator._rangeLabelAlign = "center";
    decorator._dividerWidth = 1;
    const range = narrativeRange(decorator, 0, 210, 240, 80, 16);
    const instant = narrativeInstant(decorator, 1, 190, 30, 16);
    decorator._rangeRecords = [range];
    decorator._instantRecords = [instant];

    decorator.softPaint();

    assert.equal(range.labelElmt.style.display, "");
    assert.equal(range.labelElmt.style.left, "185px");
    assert.equal(instant.track, 1);
});

test("horizontal narrative instant labels keep their routed track while a right-exiting range label is just offscreen", () => {
    const decorator = makeNarrative("horizontal");
    decorator._rangeLabelAlign = "center";
    decorator._dividerWidth = 1;
    const range = narrativeRange(decorator, 0, 230, 260, 80, 16);
    const instant = narrativeInstant(decorator, 1, 190, 30, 16);
    decorator._rangeRecords = [range];
    decorator._instantRecords = [instant];

    decorator.softPaint();

    assert.equal(range.labelElmt.style.display, "");
    assert.equal(range.labelElmt.style.left, "205px");
    assert.equal(instant.track, 1);
});

test("horizontal orthogonal narrative labels honor configured track count", () => {
    const decorator = makeNarrative("horizontal");
    decorator._labelFlow = "orthogonal";
    decorator._trackCount = 1;
    decorator._dividerWidth = 1;
    const range = narrativeRange(decorator, 0, 40, 120, 60, 10);
    const instant = narrativeInstant(decorator, 1, 39, 60, 10);

    decorator._setLabelPosition(range, -100000);
    decorator._measureLabel(range);
    decorator._setLabelPosition(instant, -100000);
    decorator._measureLabel(instant);
    decorator._rangeRecords = [range];
    decorator._instantRecords = [instant];

    decorator.softPaint();

    assert.equal(range.labelElmt.style.display, "");
    assert.equal(range.track, 0);
    assert.equal(instant.labelElmt.style.display, "none");
});

test("vertical narrative range labels use label toRangeGap at the range edge", () => {
    const decorator = makeNarrative("vertical");
    decorator._rangeToLabelGap = 6;
    const range = narrativeRange(decorator, 0, 20, 100, 30, 16);
    decorator._rangeRecords = [range];

    decorator.softPaint();

    assert.equal(range.labelElmt.style.top, "26px");
});

for (const {
    orientation,
    flow,
    width,
    height,
    expected
} of [
    { orientation: "horizontal", flow: "normal", width: 40, height: 16, expected: "50px" },
    { orientation: "horizontal", flow: "orthogonal", width: 70, height: 12, expected: "64px" },
    { orientation: "vertical", flow: "normal", width: 80, height: 30, expected: "55px" },
    { orientation: "vertical", flow: "orthogonal", width: 70, height: 12, expected: "35px" }
]) {
    test(`${orientation} ${flow} narrative range labels center on the range`, () => {
        const decorator = makeNarrative(orientation);
        decorator._labelFlow = flow;
        decorator._rangeLabelAlign = "center";
        const range = narrativeRange(decorator, 0, 20, 120, width, height);

        if (flow === "orthogonal") {
            decorator._setLabelPosition(range, -100000);
            decorator._measureLabel(range);
        }

        decorator._rangeRecords = [range];
        decorator.softPaint();

        assert.equal(
            orientation === "horizontal"
                ? range.labelElmt.style.left
                : range.labelElmt.style.top,
            expected
        );
    });
}

for (const rangeAlign of ["start", "center"]) {
    test(`vertical ${rangeAlign}-aligned narrative labels that overhang their range stay fixed`, () => {
        const decorator = makeNarrative("vertical");
        decorator._rangeLabelAlign = rangeAlign;
        decorator._band.getViewLength = () => 300;
        const first = narrativeRange(decorator, 0, 40, 100, 40, 80);
        const second = narrativeRange(decorator, 1, 100, 160, 40, 80);
        const third = narrativeRange(decorator, 2, 180, 240, 40, 80);
        decorator._rangeRecords = [first, second, third];

        decorator.softPaint();

        assert.deepEqual(
            [first.labelElmt.style.top, second.labelElmt.style.top, third.labelElmt.style.top],
            rangeAlign === "center"
                ? ["30px", "90px", "170px"]
                : ["44px", "104px", "184px"]
        );
        assert.deepEqual([first.track, second.track, third.track], [0, 0, 0]);
    });
}

test("vertical narrative labels that already overhang their range do not route", () => {
    const decorator = makeNarrative("vertical");
    decorator._rangeLabelAlign = "center";
    const first = narrativeRange(decorator, 0, 40, 100, 40, 80);
    const second = narrativeRange(decorator, 1, 40, 100, 40, 80);
    const third = narrativeRange(decorator, 2, 40, 100, 40, 80);
    decorator._rangeRecords = [first, second, third];

    decorator.softPaint();

    assert.deepEqual([first.track, second.track, third.track], [0, 0, 0]);
    assert.deepEqual(
        [first.labelElmt.style.display, second.labelElmt.style.display, third.labelElmt.style.display],
        ["", "", ""]
    );
});

test("horizontal narrative range labels route with the orthogonal visual footprint", () => {
    const decorator = makeNarrative("horizontal");
    decorator._labelFlow = "orthogonal";
    const first = narrativeRange(decorator, 0, 0, 80, 60, 10);
    const second = narrativeRange(decorator, 1, 50, 130, 60, 10);

    decorator._setLabelPosition(first, -100000);
    decorator._measureLabel(first);
    decorator._setLabelPosition(second, -100000);
    decorator._measureLabel(second);
    decorator._rangeRecords = [first, second];

    decorator.softPaint();

    assert.equal(first.width, 10);
    assert.equal(first.height, 60);
    assert.equal(first.labelElmt.style.height, "");
    assert.equal(first.labelElmt.style.left, "4px");
    assert.equal(first.labelElmt.style.textAlign, "right");
    assert.equal(first.labelElmt.style.transform, "translateY(60px) rotate(-90deg)");
    assert.deepEqual([first.track, second.track], [0, 0]);
});

test("horizontal narrative instant labels route with the orthogonal visual footprint", () => {
    const decorator = makeNarrative("horizontal");
    decorator._labelFlow = "orthogonal";
    decorator._dividerWidth = 1;
    const first = narrativeInstant(decorator, 0, 50, 60, 10);
    const second = narrativeInstant(decorator, 1, 95, 60, 10);

    decorator._setLabelPosition(first, -100000);
    decorator._measureLabel(first);
    decorator._setLabelPosition(second, -100000);
    decorator._measureLabel(second);
    decorator._rangeRecords = [];
    decorator._instantRecords = [first, second];

    decorator.softPaint();

    assert.equal(first.width, 10);
    assert.equal(first.height, 60);
    assert.equal(first.labelElmt.style.height, "");
    assert.equal(first.labelElmt.style.left, "55px");
    assert.equal(first.labelElmt.style.textAlign, "right");
    assert.equal(first.labelElmt.style.transform, "translateY(60px) rotate(-90deg)");
    assert.deepEqual([first.track, second.track], [0, 0]);
});

test("vertical narrative range labels route with the orthogonal text-length footprint", () => {
    const decorator = makeNarrative("vertical");
    decorator._labelFlow = "orthogonal";
    const first = narrativeRange(decorator, 0, 0, 200, 90, 10);
    const second = narrativeRange(decorator, 1, 50, 250, 90, 10);

    decorator._setLabelPosition(first, -100000);
    decorator._measureLabel(first);
    decorator._setLabelPosition(second, -100000);
    decorator._measureLabel(second);
    decorator._rangeRecords = [first, second];

    decorator.softPaint();

    assert.equal(first.width, 40);
    assert.equal(first.height, 90);
    assert.equal(first.labelElmt.style.top, "4px");
    assert.equal(first.labelElmt.style.height, "40px");
    assert.equal(first.labelElmt.style.width, "");
    assert.equal(first.labelElmt.style.transform, "translateY(90px) rotate(-90deg)");
    assert.equal(second.labelElmt.style.top, "54px");
    assert.deepEqual([first.track, second.track], [0, 1]);
});

test("vertical orthogonal narrative label width is independent of physical track size", () => {
    const decorator = makeNarrative("vertical");
    decorator._labelFlow = "orthogonal";
    decorator._trackOffset = 32;
    decorator._trackSize = 40;
    decorator._trackGap = 8;
    decorator._labelWidth = 120;
    const first = narrativeRange(decorator, 0, 0, 240, 90, 10, {
        item: { track: 0 }
    });
    const second = narrativeRange(decorator, 1, 60, 260, 90, 10, {
        item: { track: 1 }
    });

    decorator._setLabelPosition(first, 4);
    decorator._measureLabel(first);
    decorator._setLabelPosition(second, 64);
    decorator._measureLabel(second);

    assert.equal(decorator._trackStart(0), 32);
    assert.equal(decorator._trackStart(1), 80);
    assert.equal(first.labelElmt.style.left, "32px");
    assert.equal(second.labelElmt.style.left, "80px");
    assert.equal(first.labelElmt.style.width, "");
    assert.equal(first.labelElmt.style.maxWidth, "120px");
    assert.equal(first.labelElmt.style.height, "40px");
    assert.equal(first.width, 40);
    assert.equal(first.height, 90);
    assert.equal(first.labelElmt.style.transform, "translateY(90px) rotate(-90deg)");
});

test("vertical orthogonal narrative label width caps wrapping without becoming route length", () => {
    const decorator = makeNarrative("vertical");
    decorator._labelFlow = "orthogonal";
    decorator._labelWidth = 120;
    const first = narrativeRange(decorator, 0, 0, 200, 90, 10);
    const second = narrativeRange(decorator, 1, 95, 260, 90, 10);

    decorator._setLabelPosition(first, -100000);
    decorator._measureLabel(first);
    decorator._setLabelPosition(second, -100000);
    decorator._measureLabel(second);
    decorator._rangeRecords = [first, second];

    decorator.softPaint();

    assert.equal(first.labelElmt.style.maxWidth, "120px");
    assert.equal(first.height, 90);
    assert.equal(second.labelElmt.style.top, "99px");
    assert.deepEqual([first.track, second.track], [0, 0]);
});

test("horizontal narrative labels remain retained briefly after leaving the sticky edge", () => {
    const decorator = makeNarrative("horizontal");
    decorator._stickyInset = 6;
    const range = narrativeRange(decorator, 0, -100, 50, 20, 16);
    decorator._rangeRecords = [range];

    decorator.setViewOffset(-43);
    decorator.softPaint();
    assert.equal(range.labelElmt.style.display, "");

    decorator.setViewOffset(-44);
    decorator.softPaint();
    assert.equal(range.labelElmt.style.display, "");

    decorator.setViewOffset(-451);
    decorator.softPaint();
    assert.equal(range.labelElmt.style.display, "none");
});

test("narrative label retention uses one and a half label lengths for oversized labels", () => {
    const decorator = makeNarrative("horizontal");

    assert.equal(
        decorator._rangeLabelRetainedForRouting(-450, 200, 0, 100),
        true
    );
    assert.equal(
        decorator._rangeLabelRetainedForRouting(-500, 200, 0, 100),
        false
    );
});

test("narrative range label color derives old contrast output from hex graphic colors", () => {
    const decorator = makeNarrative("horizontal");
    const record = {
        kind: "range",
        item: {},
        graphicColor: "#9B6BD3"
    };

    const labelColor = decorator._recordLabelColor(record);

    assert.notEqual(labelColor.toLowerCase(), record.graphicColor.toLowerCase());
    assert.match(labelColor, /^light-dark\(hsl\(\d+, \d+%, \d+%\), hsl\(\d+, \d+%, \d+%\)\)$/);
});

test("narrative event colours obey eventColorScope while emphasis overrides it", () => {
    const decorator = makeNarrative("horizontal");
    const record = {
        kind: "range",
        item: {
            color: "event",
            spanColor: "event-span",
            labelColor: "event-label",
            textColor: "native-label"
        }
    };

    decorator._spanColors = ["theme-span"];
    decorator._labelColorMode = "theme";
    decorator._labelColor = "theme-label";
    decorator._disableEmphasis = false;
    decorator._emphasisSpecs = {
        critical: {
            spanColor: "emphasis-span",
            labelColor: "emphasis-label"
        }
    };

    function colors(scope) {
        decorator._eventColorScope = scope;
        return {
            graphic: decorator._recordGraphicColor(
                record,
                "spanColor",
                "theme-span"
            ),
            label: decorator._recordLabelColor(record)
        };
    }

    assert.deepEqual(colors("none"), {
        graphic: "theme-span",
        label: "theme-label"
    });
    assert.deepEqual(colors("graphic"), {
        graphic: "event-span",
        label: "theme-label"
    });
    assert.deepEqual(colors("label"), {
        graphic: "theme-span",
        label: "event-label"
    });
    assert.deepEqual(colors("both"), {
        graphic: "event-span",
        label: "event-label"
    });

    record.item.emphasis = "critical";
    assert.deepEqual(colors("none"), {
        graphic: "emphasis-span",
        label: "emphasis-label"
    });

    decorator._disableEmphasis = true;
    assert.deepEqual(colors("none"), {
        graphic: "theme-span",
        label: "theme-label"
    });

    decorator._eventColorScope = "both";
    delete record.item.labelColor;
    assert.equal(decorator._recordLabelColor(record), "native-label");
});

test("narrative tag colours apply to span and instant graphics", () => {
    const decorator = makeNarrative("horizontal");
    decorator._tagsToIconColor = { release: "tag-color" };
    decorator._spanColors = ["theme-span"];
    decorator._instantIconColor = "theme-instant";

    assert.equal(
        decorator._recordGraphicColor(
            { kind: "range", item: { tags: ["release"] } },
            "spanColor",
            "theme-span",
            decorator._itemTagColor({ tags: ["release"] })
        ),
        "tag-color"
    );
    assert.equal(
        decorator._recordInstantLineColor({
            kind: "instant",
            item: { tags: ["release"] }
        }),
        "tag-color"
    );
});

test("horizontal narrative instant labels avoid their own divider width", () => {
    const decorator = makeNarrative("horizontal");
    decorator._dividerWidth = 12;
    const instant = narrativeInstant(decorator, 0, 50, 30, 16);
    decorator._rangeRecords = [];
    decorator._instantRecords = [instant];

    decorator.softPaint();

    assert.equal(instant.lineElmt.style.left, "44px");
    assert.equal(instant.lineElmt.style.width, "12px");
    assert.equal(instant.labelElmt.style.left, "60px");
});

test("horizontal narrative instant 1px dividers align to the event pixel", () => {
    const decorator = makeNarrative("horizontal");
    decorator._dividerWidth = 1;
    const instant = narrativeInstant(decorator, 0, 50, 30, 16);
    decorator._rangeRecords = [];
    decorator._instantRecords = [instant];

    decorator.softPaint();

    assert.equal(instant.lineElmt.style.left, "50px");
});

test("vertical narrative instant labels avoid their own divider width", () => {
    const decorator = makeNarrative("vertical");
    decorator._dividerWidth = 6;
    decorator._instantToLabelGap = 2;
    const instant = narrativeInstant(decorator, 0, 50, 30, 16);
    decorator._rangeRecords = [];
    decorator._instantRecords = [instant];

    decorator.softPaint();

    assert.equal(instant.lineElmt.style.top, "47px");
    assert.equal(instant.lineElmt.style.height, "6px");
    assert.equal(instant.labelElmt.style.top, "55px");
});

test("vertical narrative instant 1px dividers align to the event pixel", () => {
    const decorator = makeNarrative("vertical");
    decorator._dividerWidth = 1;
    const instant = narrativeInstant(decorator, 0, 50, 30, 16);
    decorator._rangeRecords = [];
    decorator._instantRecords = [instant];

    decorator.softPaint();

    assert.equal(instant.lineElmt.style.top, "50px");
});

test("narrative instant lineWidth is separate from event icon width", () => {
    const decorator = makeConfiguredNarrative(
        "horizontal",
        200,
        { count: 1, offset: 0, gap: 4 },
        {
            visualTheme: testVisualTheme({
                instant: {
                    width: 12,
                    lineWidth: 2
                },
                label: {
                    horizontal: {
                        toInstantGap: 3
                    }
                }
            })
        }
    );

    assert.equal(decorator._visualTheme.instant.width, 12);
    assert.equal(decorator._dividerWidth, 2);
    assert.equal(decorator._instantToLabelGap, 3);
});

test("narrative range toRangeGap resolves from the oriented label theme", () => {
    const decorator = makeConfiguredNarrative(
        "horizontal",
        200,
        { count: 1, offset: 0, gap: 4 },
        {
            visualTheme: testVisualTheme({
                label: {
                    horizontal: {
                        toRangeGap: 7
                    }
                }
            })
        }
    );

    assert.equal(decorator._rangeToLabelGap, 7);
});

test("vertical sticky narrative labels route tracks instead of stacking forward", () => {
    const decorator = makeNarrative("vertical");
    const ranges = [
        narrativeRange(decorator, 0, -100, 120, 40, 20),
        narrativeRange(decorator, 1, -90, 120, 40, 25),
        narrativeRange(decorator, 2, -80, 120, 40, 15)
    ];
    decorator._rangeRecords = ranges;

    decorator.softPaint();

    assert.deepEqual(ranges.map((record) => record.track), [0, 1, 0]);
    assert.equal(ranges[2].labelElmt.style.display, "none");
    assert.deepEqual(ranges.slice(0, 2).map((record) => record.labelElmt.style.top), [
        "0px",
        "0px"
    ]);
    assert.deepEqual(ranges.slice(0, 2).map((record) => record.labelElmt.style.left), [
        "0px",
        "45px"
    ]);
});

test("a multiline vertical narrative label routes tracks without main-axis stacking", () => {
    const decorator = makeNarrative("vertical");
    decorator._labelOffset = 2;

    const first = narrativeRange(decorator, 0, -100, 100, 40, 20);
    const multiline = narrativeRange(
        decorator,
        1,
        -90,
        80,
        40,
        55,
        { lineBoxHeight: 20 }
    );
    const third = narrativeRange(decorator, 2, -80, 100, 40, 20);
    decorator._rangeRecords = [first, multiline, third];

    decorator.softPaint();

    assert.equal(multiline.height, 55, "routing must use the rendered multiline scroll height");
    assert.deepEqual([first.track, multiline.track, third.track], [0, 1, 0]);
    assert.equal(third.labelElmt.style.display, "none");
    assert.deepEqual(
        [first.labelElmt.style.top, multiline.labelElmt.style.top],
        ["2px", "2px"]
    );
    assert.equal(multiline.labelElmt.style.left, "45px");
    assert.ok(
        Number.parseInt(multiline.labelElmt.style.top, 10) + 6 <= multiline.endPixel,
        "the routed label must keep contact with its own duration"
    );
});

test("a short vertical range fixes its long orthogonal label before routing others", () => {
    const decorator = makeNarrative("vertical");
    decorator._labelFlow = "orthogonal";

    const leading = narrativeRange(decorator, 0, -100, 100, 40, 20);
    const longLabel = narrativeRange(decorator, 1, -90, 40, 80, 12);
    decorator._rangeRecords = [leading, longLabel];

    decorator.softPaint();

    const top = Number.parseInt(longLabel.labelElmt.style.top, 10);

    assert.equal(longLabel.height, 80);
    assert.equal(longLabel.track, 0);
    assert.equal(longLabel.labelElmt.style.display, "");
    assert.equal(top + longLabel.height, longLabel.endPixel);
    assert.equal(leading.track, 1);
});

test("vertical fixed overlong narrative labels reserve before sliding earlier ranges", () => {
    const decorator = makeNarrative("vertical");
    decorator._rangeLabelAlign = "center";
    const sliding = narrativeRange(decorator, 0, 40, 140, 40, 20);
    const fixed = narrativeRange(decorator, 1, 100, 130, 40, 80);
    decorator._rangeRecords = [sliding, fixed];

    decorator.setViewOffset(-80);
    decorator.softPaint();

    assert.equal(fixed.track, 0);
    assert.equal(fixed.labelElmt.style.top, "75px");
    assert.equal(sliding.track, 1);
    assert.equal(sliding.labelElmt.style.top, "80px");
});

test("vertical offscreen narrative ranges keep reserving tracks for nearby labels", () => {
    const decorator = makeNarrative("vertical");
    decorator._trackCount = 3;
    decorator._dividerWidth = 1;
    const departed = narrativeRange(decorator, 0, -100, 50, 40, 20);
    const follower = narrativeRange(decorator, 1, 40, 70, 40, 20);
    const instant = narrativeInstant(decorator, 2, 42, 40, 20);
    decorator._rangeRecords = [departed, follower];
    decorator._instantRecords = [instant];

    decorator.setViewOffset(-451);
    decorator.softPaint();

    assert.equal(departed.labelElmt.style.display, "none");
    assert.equal(departed.track, 0);
    assert.equal(follower.track, 1);
    assert.equal(follower.labelElmt.style.display, "");
    assert.equal(instant.track, 2);
    assert.equal(instant.labelElmt.style.display, "");
});

test("vertical narrative labels change tracks instead of pushing a same-track stack", () => {
    const decorator = makeNarrative("vertical");
    const first = narrativeRange(decorator, 0, -100, 100, 40, 20);
    const second = narrativeRange(decorator, 1, 40, 100, 40, 20);
    decorator._rangeRecords = [first, second];

    decorator.softPaint();
    assert.deepEqual(
        [first.labelElmt.style.top, second.labelElmt.style.top],
        ["0px", "44px"]
    );

    decorator.setViewOffset(-25);
    decorator.softPaint();

    assert.deepEqual([first.track, second.track], [0, 1]);
    assert.deepEqual(
        [first.labelElmt.style.top, second.labelElmt.style.top],
        ["25px", "44px"]
    );

    decorator.setViewOffset(-30);
    decorator.softPaint();
    assert.deepEqual(
        [first.labelElmt.style.top, second.labelElmt.style.top],
        ["30px", "44px"],
        "colliding labels must keep their range-anchored main-axis positions"
    );
});

test("vertical narrative placement remains stable across scrolling and repeated soft paints", () => {
    const decorator = makeNarrative("vertical");
    const ranges = [
        narrativeRange(decorator, 0, -100, 180, 40, 20),
        narrativeRange(decorator, 1, -90, 180, 40, 25),
        narrativeRange(decorator, 2, -80, 80, 40, 30)
    ];
    decorator._rangeRecords = ranges;

    decorator.softPaint();
    const original = narrativePlacement(ranges);
    const originalTops = original.map((placement) => Number.parseInt(placement.top, 10));

    decorator.setViewOffset(-20);
    decorator.softPaint();
    const scrolled = narrativePlacement(ranges);
    decorator.softPaint();

    assert.deepEqual(narrativePlacement(ranges), scrolled);
    assert.deepEqual(scrolled.map((placement) => placement.track), [0, 1, 0]);
    assert.equal(scrolled[2].display, "none");
    assert.deepEqual(scrolled.slice(0, 2).map((placement) => placement.top), ["20px", "20px"]);
    assert.deepEqual(
        scrolled.slice(0, 2).map(
            (placement, index) => Number.parseInt(placement.top, 10) - originalTops[index]
        ),
        [20, 20],
        "colliding labels must slide only with the viewport edge"
    );

    decorator.setViewOffset(0);
    decorator.softPaint();
    assert.deepEqual(
        narrativePlacement(ranges),
        original,
        "reverse scrolling must favor each label's natural span-top placement"
    );
    decorator.softPaint();
    assert.deepEqual(narrativePlacement(ranges), original);
});

test("a pushed vertical label returns to the top of its span when scrolling back", () => {
    const decorator = makeNarrative("vertical");
    const leading = narrativeRange(decorator, 0, -100, 100, 40, 20);
    const follower = narrativeRange(decorator, 1, 40, 100, 40, 20);
    decorator._rangeRecords = [leading, follower];

    decorator.softPaint();
    assert.equal(follower.labelElmt.style.top, "44px");

    decorator.setViewOffset(-25);
    decorator.softPaint();
    assert.equal(follower.track, 1);
    assert.equal(follower.labelElmt.style.top, "44px");

    decorator.setViewOffset(0);
    decorator.softPaint();
    assert.equal(follower.track, 0);
    assert.equal(follower.labelElmt.style.top, "44px");
});

test("reverse scrolling restores track zero after a range-end track jump", () => {
    const decorator = makeNarrative("vertical");
    const leading = narrativeRange(decorator, 0, -100, 100, 40, 20);
    const constrained = narrativeRange(decorator, 1, 40, 65, 40, 20);
    decorator._rangeRecords = [leading, constrained];

    decorator.setViewOffset(-21);
    decorator.softPaint();
    assert.equal(constrained.track, 1);
    assert.equal(constrained.labelElmt.style.top, "44px");

    decorator.setViewOffset(0);
    decorator.softPaint();
    assert.equal(constrained.track, 0);
    assert.equal(constrained.labelElmt.style.top, "44px");
});

test("a departing vertical span releases the next stacked label without a jump", () => {
    const decorator = makeNarrative("vertical");
    const departingItem = {};
    const followerItem = {};
    let departing = narrativeRange(
        decorator,
        0,
        -100,
        50,
        40,
        20,
        { item: departingItem }
    );
    let follower = narrativeRange(
        decorator,
        1,
        -90,
        200,
        40,
        20,
        { item: followerItem }
    );
    decorator._rangeRecords = [departing, follower];

    decorator.softPaint();
    decorator.setViewOffset(-44);
    decorator.softPaint();

    assert.equal(departing.labelElmt.style.display, "");
    assert.equal(departing.labelElmt.style.top, "30px");
    assert.equal(follower.track, 1);
    assert.equal(follower.labelElmt.style.top, "44px");

    decorator.setViewOffset(-50);
    decorator.softPaint();

    assert.equal(departing.labelElmt.style.display, "");
    assert.equal(follower.track, 1);
    assert.equal(follower.labelElmt.style.top, "50px");

    decorator.setViewOffset(-451);
    decorator.softPaint();

    assert.equal(departing.labelElmt.style.display, "none");
    assert.equal(follower.track, 0);
    assert.equal(follower.labelElmt.style.top, "180px");

    departing = narrativeRange(
        decorator,
        0,
        -100,
        50,
        40,
        20,
        { item: departingItem }
    );
    follower = narrativeRange(
        decorator,
        1,
        -90,
        200,
        40,
        20,
        { item: followerItem }
    );
    decorator._rangeRecords = [departing, follower];
    decorator.softPaint();
    assert.equal(follower.labelElmt.style.top, "180px");

    decorator.setViewOffset(-452);
    decorator.softPaint();
    assert.equal(follower.labelElmt.style.top, "180px");
});

test("vertical narrative labels remain retained briefly after leaving the sticky edge", () => {
    const decorator = makeNarrative("vertical");
    decorator._stickyInset = 6;
    const range = narrativeRange(decorator, 0, -100, 50, 40, 20);
    decorator._rangeRecords = [range];

    decorator.setViewOffset(-43);
    decorator.softPaint();
    assert.equal(range.labelElmt.style.display, "");

    decorator.setViewOffset(-44);
    decorator.softPaint();
    assert.equal(range.labelElmt.style.display, "");

    decorator.setViewOffset(-451);
    decorator.softPaint();
    assert.equal(range.labelElmt.style.display, "none");
});

test("a vertical label changes tracks while preserving range contact", () => {
    const decorator = makeNarrative("vertical");
    const leading = narrativeRange(decorator, 0, -100, 50, 40, 20);
    const constrained = narrativeRange(decorator, 1, -90, 80, 40, 20);
    decorator._rangeRecords = [leading, constrained];

    decorator.setViewOffset(-35);
    decorator.softPaint();
    assert.equal(constrained.track, 1);
    assert.equal(constrained.labelElmt.style.top, "35px");

    decorator.setViewOffset(-36);
    decorator.softPaint();
    assert.equal(constrained.track, 1);
    assert.equal(constrained.labelElmt.style.top, "36px");
    assert.ok(
        Number.parseInt(constrained.labelElmt.style.top, 10) + 6 <=
            constrained.endPixel
    );
});

function makeConfiguredNarrative(orientation, viewWidth, trackTheme, extraParams = {}) {
    const NarrativeDecorator = loadNarrativeDecorator();
    const horizontal = orientation === "horizontal";
    const decorator = new NarrativeDecorator({
        visualTheme: testVisualTheme({
            track: { [orientation]: trackTheme }
        }),
        ...extraParams
    });

    decorator.initialize(
        { getViewWidth: () => viewWidth, _theme: {} },
        { isHorizontal: () => horizontal, isVertical: () => !horizontal }
    );

    return decorator;
}

test("narrative decorators fill the band when VisualTheme only defines event tape width", () => {
    for (const orientation of ["horizontal", "vertical"]) {
        const decorator = makeConfiguredNarrative(
            orientation,
            240,
            { count: 1, offset: 2, gap: 4 }
        );

        assert.equal(decorator._visualTheme.range.width, 4);
        assert.equal(decorator._spanSize, null);
    }
});

test("narrative horizontal track size defaults to a fixed intrinsic size, independent of band cross-axis extent", () => {
    const small = makeConfiguredNarrative("horizontal", 80, { count: 3, offset: 35, gap: 8 });
    const large = makeConfiguredNarrative("horizontal", 800, { count: 3, offset: 35, gap: 8 });

    assert.equal(small._trackSizeValue(), large._trackSizeValue());
    assert.ok(small._trackSizeValue() >= 10, "default track size must not collapse toward 0px");
});

test("narrative vertical track size defaults to a fixed intrinsic size, independent of band cross-axis extent", () => {
    const small = makeConfiguredNarrative("vertical", 100, { count: 2, offset: 40, gap: 12 });
    const large = makeConfiguredNarrative("vertical", 900, { count: 2, offset: 40, gap: 12 });

    assert.equal(small._trackSizeValue(), large._trackSizeValue());
    assert.ok(small._trackSizeValue() >= 60, "default vertical track size must remain usable for wrapped label text");
});

test("narrative horizontal tracks stay evenly spaced and absolute-pixel sized when the band is smaller than the full track stack", () => {
    // Real values from the biography demo's 'lifeEra' horizontal track theme (count:3, offset:35, gap:8,
    // no explicit size) rendered inside its actual 80px-tall band.
    const decorator = makeConfiguredNarrative("horizontal", 80, { count: 3, offset: 35, gap: 8, align: "start" });

    const size = decorator._trackSizeValue();
    assert.ok(size >= 10, `expected an absolute-pixel track size, got ${size}px`);

    const starts = [0, 1, 2].map((track) => decorator._trackStart(track));
    assert.equal(starts[1] - starts[0], size + 8);
    assert.equal(starts[2] - starts[1], size + 8);
});

test("narrative explicit track size is used verbatim regardless of band size", () => {
    const decorator = makeConfiguredNarrative("horizontal", 50, { count: 3, offset: 10, gap: 4, size: 22 });

    assert.equal(decorator._trackSizeValue(), 22);
    assert.equal(decorator._trackStart(1), 10 + (22 + 4));
});

test("narrative vertical start vs end alignment mirror around the band, anchored by endPadding", () => {
    const start = makeConfiguredNarrative("vertical", 400, {
        count: 2, offset: 40, size: 85, gap: 12, align: "start"
    });
    const end = makeConfiguredNarrative("vertical", 400, {
        count: 2, offset: 40, size: 85, gap: 12, align: "end", endPadding: 40
    });

    assert.equal(start._trackStart(0), 40);
    assert.equal(start._trackStart(1), 40 + 85 + 12);

    // Symmetric endPadding === offset mirrors the start-aligned layout around the band.
    assert.equal(end._trackStart(0), 400 - 40 - 85);
    assert.equal(end._trackStart(1), 400 - 40 - 85 - (85 + 12));

    const customEndPadding = makeConfiguredNarrative("vertical", 400, {
        count: 2, offset: 40, size: 85, gap: 12, align: "end", endPadding: 100
    });
    assert.equal(customEndPadding._trackStart(0), 400 - 100 - 85);
    assert.notEqual(customEndPadding._trackStart(0), end._trackStart(0));
});

test("narrative endPadding defaults to offset when omitted", () => {
    const withDefault = makeConfiguredNarrative("vertical", 400, {
        count: 1, offset: 40, size: 85, align: "end"
    });
    const withExplicitMatchingOffset = makeConfiguredNarrative("vertical", 400, {
        count: 1, offset: 40, size: 85, align: "end", endPadding: 40
    });

    assert.equal(withDefault._trackStart(0), withExplicitMatchingOffset._trackStart(0));
});

test("narrative horizontal align has no effect (documented as vertical-only)", () => {
    const start = makeConfiguredNarrative("horizontal", 400, { count: 2, offset: 10, size: 20, gap: 5, align: "start" });
    const end = makeConfiguredNarrative("horizontal", 400, { count: 2, offset: 10, size: 20, gap: 5, align: "end" });

    assert.equal(start._trackStart(1), end._trackStart(1));
});

test("narrative non-zero offset, endPadding, and gap combine deterministically", () => {
    const decorator = makeConfiguredNarrative("vertical", 500, {
        count: 3, offset: 22, size: 60, gap: 9, align: "end", endPadding: 17
    });
    const increment = 60 + 9;

    assert.equal(decorator._trackStart(0), 500 - 17 - 60);
    assert.equal(decorator._trackStart(1), 500 - 17 - 60 - increment);
    assert.equal(decorator._trackStart(2), 500 - 17 - 60 - 2 * increment);
});

test("event-layout resolves its horizontal track size from VisualTheme", () => {
    const OriginalEventPainter = loadEventPainter();
    const theme = visualTheme();
    const painter = new OriginalEventPainter();
    const timeline = {
        isHorizontal: () => true,
        isVertical: () => false
    };

    theme.visualTheme = testVisualTheme({
        track: { horizontal: { size: 55 } }
    });
    painter._params = { theme };
    painter.initialize({ _theme: theme }, timeline);

    assert.equal(painter._visualTheme.track.horizontal.size, 55);
    assert.equal(theme.event.track.height, 20);
});
