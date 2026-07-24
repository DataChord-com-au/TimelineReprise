const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

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
        ThemeIcons: {
            getCssColor: (color) => color,
            get: (color, size) => `theme-icon:${color}:${size}`
        }
    };
    const context = vm.createContext({
        Timeline,
        window: { Timeline }
    });
    const filename = path.join(__dirname, "..", "src", "event-layout.js");

    vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
    Timeline.OriginalEventPainter._testTimeline = Timeline;
    return Timeline.OriginalEventPainter;
}

function loadCore(Timeline) {
    const context = vm.createContext({
        Timeline,
        window: { Timeline }
    });
    const filename = path.join(__dirname, "..", "src", "core.js");

    vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
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
    const Timeline = { NativeDateUnit: {} };
    const context = vm.createContext({
        Timeline,
        window: { Timeline }
    });
    const filename = path.join(__dirname, "..", "src", "narrative.js");

    vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
    return Timeline.NarrativeDecorator;
}

function element(width, height) {
    return {
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
    emphasis = null
} = {}) {
    const properties = { iconColor, emphasis };

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

function eventTheme() {
    return {
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
    painter._params = { theme: eventTheme() };
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

test("event-layout theme mapping carries instant iconColor into the native painter theme", () => {
    const OriginalEventPainter = loadEventPainter();
    const theme = eventTheme();

    OriginalEventPainter._testTimeline.EventLayoutThemeShim.applyEventTheme(
        theme,
        { instant: { iconColor: "orange" } },
        { isHorizontal: () => true, isVertical: () => false }
    );

    assert.equal(theme.event.instant.iconColor, "orange");
});

test("event-layout theme mapping carries bubble width and maxHeight into the native painter theme", () => {
    const OriginalEventPainter = loadEventPainter();
    const theme = eventTheme();
    const titleStyler = function () {};
    const shim = OriginalEventPainter._testTimeline.EventLayoutThemeShim;

    theme.event.bubble = { width: 250, maxHeight: 0, titleStyler };

    shim.applyEventTheme(
        theme,
        { bubble: { width: 360, maxHeight: 480 } },
        { isHorizontal: () => true, isVertical: () => false }
    );

    assert.equal(theme.event.bubble.width, 360);
    assert.equal(theme.event.bubble.maxHeight, 480);
    assert.equal(theme.event.bubble.titleStyler, titleStyler);

    shim.applyEventTheme(
        theme,
        { bubble: { maxHeight: null } },
        { isHorizontal: () => true, isVertical: () => false }
    );

    assert.equal(theme.event.bubble.width, 360);
    assert.equal(theme.event.bubble.maxHeight, null);
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

test("horizontal duration labels that would need an arbitrarily long connector at the sticky right edge disappear instead of showing a stretched or faked sparkline", () => {
    const painter = makeEventPainter("horizontal");
    const items = [];

    for (let i = 0; i < 5; i++) {
        const start = 20 + i * 2;
        items.push(tapeLabel(event("edge-" + i, start, 400), start, 50, 16));
    }
    painter._repriseTapeLabels.push(...items);

    painter.paint();

    const visible = items.filter((item) => !isHidden(item));
    const hidden = items.filter(isHidden);

    assert.ok(
        hidden.length >= 1,
        "expected at least one label to disappear once crowding pushed its own tape's attach point off the label"
    );
    assert.ok(visible.length >= 1, "expected at least one label to remain visible");

    for (const item of visible) assertSparkAttached(item);
});

test("several overlapping durations with long labels route across multiple label tracks, and every visible sparkline stays connected", () => {
    // Derived from scratch/demo-imprecise-ranges-events.js: many overlapping,
    // long-labelled ranges that force collision handling to reroute labels
    // across several label tracks (the scenario that exposed disconnected
    // tape-to-label sparklines in the ChronicleTimelineDemo "Imprecise Ranges"
    // example). This viewport is narrow enough that a couple of the events
    // sharing the latest end date also get crowded off the sticky right edge
    // entirely, exercising the "disappear rather than disconnect" behaviour
    // in the same scenario.
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
    assert.ok(
        items.some(isHidden),
        "expected at least one label to be dropped once its own tape's attach point separated from it"
    );
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

function eventThemeWithTrackGap(trackGap) {
    return {
        event: {
            track: { offset: 2, height: 20, gap: trackGap },
            tape: {
                height: 4,
                horizontal: {
                    eventRoutingThreshold: 28,
                    sparklineStagger: 8,
                    stickyLeftInset: 0
                    // tapeGap, toLabelGap, labelRoutingGap and labelTrackGap are
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
    painter._params = { theme: eventThemeWithTrackGap(trackGap) };
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

test("customizing track.gap does not change the tapeGap/toLabelGap defaults for overlapping tape lanes", () => {
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

test("customizing track.gap does not change the toLabelGap/labelTrackGap defaults across routed label rows", () => {
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

test("customizing track.gap does not change the labelRoutingGap default used to decide whether adjacent labels share a row", () => {
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
        "a large track.gap must not force these labels into separate rows once labelRoutingGap has its own default"
    );
});

function buildPointLabelGapFixture({ labelRoutingGap, labelTrackGap, overlap }) {
    const painter = makeEventPainter("horizontal", 300);
    const tapeSpec = painter._params.theme.event.tape.horizontal;
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

    tapeSpec.labelRoutingGap = labelRoutingGap;
    tapeSpec.labelTrackGap = labelTrackGap;
    painter._reprisePointLabels.push(...labels);
    painter.paint();

    return labels;
}

test("labelRoutingGap controls whether nearby horizontal labels use another row", () => {
    const close = buildPointLabelGapFixture({
        labelRoutingGap: 10,
        labelTrackGap: 2,
        overlap: false
    });
    const separated = buildPointLabelGapFixture({
        labelRoutingGap: 25,
        labelTrackGap: 2,
        overlap: false
    });

    assert.equal(close[0].data.top, close[1].data.top);
    assert.notEqual(separated[0].data.top, separated[1].data.top);
});

test("labelTrackGap controls the vertical gap between routed horizontal label rows", () => {
    for (const labelTrackGap of [2, 9]) {
        const labels = buildPointLabelGapFixture({
            labelRoutingGap: 0,
            labelTrackGap,
            overlap: true
        });

        assert.equal(
            Math.abs(labels[1].data.top - labels[0].data.top) - 20,
            labelTrackGap
        );
    }
});

test("vertical labelRoutingGap controls spacing between labels in a column", () => {
    for (const [labelRoutingGap, expected] of [[undefined, 4], [9, 9]]) {
        const painter = makeEventPainter("vertical", 300);
        const labels = [
            tapeLabel(event("vertical-a", 0, 100), 0, 80, 20),
            tapeLabel(event("vertical-b", 21, 120), 21, 80, 20)
        ];

        if (labelRoutingGap === undefined) {
            delete painter._params.theme.event.tape.vertical.labelRoutingGap;
        } else {
            painter._params.theme.event.tape.vertical.labelRoutingGap = labelRoutingGap;
        }
        painter._repriseTapeLabels.push(...labels);
        painter.paint();

        assert.equal(labels[1].data.top - (labels[0].data.top + labels[0].data.height), expected);
    }
});

test("vertical labelTrackGap controls spacing between routed side columns", () => {
    function columnPitch(labelTrackGap) {
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

        painter._params.theme.event.tape.vertical.labelTrackGap = labelTrackGap;
        painter._reprisePointLabels.push(first, second);
        painter.paint();

        return second.data.left - first.data.left;
    }

    assert.equal(columnPitch(9) - columnPitch(2), 7);
});

function buildRangeGapFixture(
    orientation,
    { toLabelGap, tapeGap = 2, tapeWidth = 4, trackGap = 2 } = {}
) {
    const painter = makeEventPainter(orientation, 400);
    const theme = painter._params.theme;
    const tapeSpec = theme.event.tape[orientation];
    const evt = eventOnLane("range", 20, 200, 0);
    const label = tapeLabel(evt, 20, 40, 16);
    const tape = {
        evt,
        lane: 0,
        data: paintedData(20, 80, 180, tapeWidth),
        startPixel: 20,
        endPixel: 200
    };

    theme.event.tape.height = tapeWidth;
    theme.event.track.gap = trackGap;
    painter._repriseMetrics.trackGap = trackGap;
    tapeSpec.tapeGap = tapeGap;
    if (toLabelGap === undefined) {
        delete tapeSpec.toLabelGap;
    } else {
        tapeSpec.toLabelGap = toLabelGap;
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

for (const orientation of ["horizontal", "vertical"]) {
    test(`${orientation} range toLabelGap changes only the visible sparkline endpoint gap`, () => {
        const baseline = buildRangeGapFixture(orientation, {
            toLabelGap: 1,
            tapeGap: 8
        });
        const changed = buildRangeGapFixture(orientation, {
            toLabelGap: 6,
            tapeGap: 8
        });
        const defaulted = buildRangeGapFixture(orientation, { tapeGap: 8 });

        assert.equal(visibleSparklineToLabelGap(orientation, baseline.label), 1);
        assert.equal(visibleSparklineToLabelGap(orientation, changed.label), 6);
        assert.equal(visibleSparklineToLabelGap(orientation, defaulted.label), 4);
        assert.equal(
            crossAxisPosition(orientation, changed.label.data),
            crossAxisPosition(orientation, baseline.label.data),
            "toLabelGap must not move the label row/column"
        );
        assert.deepEqual(
            { left: changed.label.data.left, top: changed.label.data.top },
            { left: baseline.label.data.left, top: baseline.label.data.top },
            "toLabelGap must not move the label"
        );
        assert.equal(
            crossAxisPosition(orientation, changed.tape.data),
            crossAxisPosition(orientation, baseline.tape.data),
            "toLabelGap must not move the tape"
        );
        assert.deepEqual(
            { left: changed.tape.data.left, top: changed.tape.data.top },
            { left: baseline.tape.data.left, top: baseline.tape.data.top },
            "toLabelGap must not move the tape"
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
                toLabelGap: 1
            });
            assert.equal(
                visibleSparklineToLabelGap(orientation, label),
                1,
                JSON.stringify(variant)
            );
        }
    });

    test(`${orientation} range tapeGap controls tape-lane and tape-block spacing`, () => {
        function build(tapeGap) {
            const painter = makeEventPainter(orientation, 500);
            const theme = painter._params.theme;
            const tapeSpec = theme.event.tape[orientation];
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
            tapeSpec.toLabelGap = 0;
            painter._repriseTapeLabels.push(...labels);
            painter._repriseTapeBars.push(...tapes);
            painter.paint();

            return { labels, tapes };
        }

        for (const tapeGap of [2, 9]) {
            const { labels, tapes } = build(tapeGap);
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
                tapeGap,
                "the tape block must use tapeGap before the first label row/column"
            );
        }
    });

    test(`${orientation} range tapeGap does not change time-axis lane assignment`, () => {
        function assignedLanes(tapeGap) {
            const painter = makeEventPainter(orientation, 500);
            const tapeSpec = painter._params.theme.event.tape[orientation];
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

    test(`${orientation} range excessive toLabelGap clamps sparkline length to zero`, () => {
        const { label } = buildRangeGapFixture(orientation, {
            toLabelGap: 100,
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

    theme.event.tape.horizontal.toLabelGap = horizontalGap;
    theme.event.tape.vertical.toLabelGap = verticalGap;

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
    test(`${orientation} short ranges use the orientation-specific range toLabelGap`, () => {
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

    assert.equal(icon.left, 20);
    assert.equal(icon.elmt.style.left, "20px");
    assert.equal(painter._reprisePointIcons[0].data.left, 20);
});

for (const orientation of ["horizontal", "vertical"]) {
    test(`${orientation} instant iconColor follows default, theme, event, and emphasis precedence`, () => {
        function paint({
            themeColor,
            eventColor,
            eventIconColor,
            emphasisIconColor,
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
                emphasis: "critical"
            });

            theme.event.instant.iconColor = themeColor;
            theme.emphasisSpecs = {
                critical: emphasisIconColor == null
                    ? {}
                    : { iconColor: emphasisIconColor }
            };
            theme.eventTheme = {
                eventColorScope: scope,
                disableEmphasis
            };

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
            paint({
                themeColor: "orange",
                eventIconColor: "green",
                emphasisIconColor: "red"
            }),
            "theme-icon:red:10"
        );
        assert.equal(
            paint({
                themeColor: "orange",
                eventIconColor: "green",
                emphasisIconColor: "red",
                disableEmphasis: true
            }),
            "theme-icon:green:10"
        );
    });

    test(`${orientation} instant event color obeys eventColorScope without hiding explicit icon colors`, () => {
        function paint(scope, eventIconColor = null) {
            const painter = makeEventPainter(orientation);
            const theme = painter._params.theme;
            const evt = styledInstantEvent("instant", 20, {
                color: "purple",
                iconColor: eventIconColor
            });

            theme.event.instant.iconColor = "orange";
            theme.eventTheme = { eventColorScope: scope };

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
        assert.equal(paint("label", "green"), "theme-icon:green:10");
    });

    test(`${orientation} instant custom icon URLs survive theme defaults but yield to event iconColor`, () => {
        const painter = makeEventPainter(orientation);
        const theme = painter._params.theme;
        theme.event.instant.iconColor = "orange";

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
    theme.eventTheme = {};

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

test("horizontal instant toLabelGap is the exact visible dot-to-label gap", () => {
    const painter = makeEventPainter("horizontal");
    const evt = instantEvent("instant", 20);
    const theme = painter._params.theme;
    theme.event.instant.horizontal = { toLabelGap: 6 };

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

test("horizontal instant toLabelGap defaults to 4px", () => {
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

test("vertical instant toLabelGap is exact and defaults to 4px", () => {
    function measure(toLabelGap) {
        const painter = makeEventPainter("vertical");
        const evt = instantEvent("instant", 20);
        const theme = painter._params.theme;
        const iconData = paintedData(10, 20, 10, 10);

        if (toLabelGap !== undefined) {
            theme.event.instant.vertical = { toLabelGap };
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
    assert.notEqual(long.data.left, short.data.left);
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
        painter._params.theme.event.tape.vertical.toEventGap
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

function narrativePlacement(records) {
    return records.map((record) => ({
        track: record.track,
        top: record.labelElmt.style.top,
        left: record.labelElmt.style.left,
        display: record.labelElmt.style.display
    }));
}

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

test("horizontal narrative persistence includes the sticky edge inset in its contact threshold", () => {
    const decorator = makeNarrative("horizontal");
    decorator._stickyInset = 6;
    const range = narrativeRange(decorator, 0, -100, 50, 20, 16);
    decorator._rangeRecords = [range];

    decorator.setViewOffset(-25);
    decorator.softPaint();
    assert.equal(range.labelElmt.style.display, "");

    decorator.setViewOffset(-26);
    decorator.softPaint();
    assert.equal(range.labelElmt.style.display, "none");
});

test("vertical sticky narrative labels stack forward on their current track while they fit", () => {
    const decorator = makeNarrative("vertical");
    const ranges = [
        narrativeRange(decorator, 0, -100, 120, 40, 20),
        narrativeRange(decorator, 1, -90, 120, 40, 25),
        narrativeRange(decorator, 2, -80, 120, 40, 15)
    ];
    decorator._rangeRecords = ranges;

    decorator.softPaint();

    assert.deepEqual(ranges.map((record) => record.track), [0, 0, 0]);
    assert.deepEqual(ranges.map((record) => record.labelElmt.style.top), [
        "0px",
        "25px",
        "55px"
    ]);
    assert.deepEqual(ranges.map((record) => record.labelElmt.style.left), [
        "0px",
        "0px",
        "0px"
    ]);
});

test("a multiline vertical narrative label alone reroutes when its full height cannot fit the stack", () => {
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
    assert.deepEqual(
        [first.labelElmt.style.top, multiline.labelElmt.style.top, third.labelElmt.style.top],
        ["2px", "2px", "27px"]
    );
    assert.equal(multiline.labelElmt.style.left, "45px");
    assert.ok(
        Number.parseInt(multiline.labelElmt.style.top, 10) + multiline.height <= multiline.endPixel,
        "the complete rerouted label must remain within its own duration"
    );
});

test("vertical narrative labels move together after a later label hits their same-track stack", () => {
    const decorator = makeNarrative("vertical");
    const first = narrativeRange(decorator, 0, -100, 100, 40, 20);
    const second = narrativeRange(decorator, 1, 40, 100, 40, 20);
    decorator._rangeRecords = [first, second];

    decorator.softPaint();
    assert.deepEqual(
        [first.labelElmt.style.top, second.labelElmt.style.top],
        ["0px", "40px"]
    );

    decorator.setViewOffset(-25);
    decorator.softPaint();

    assert.deepEqual([first.track, second.track], [0, 0]);
    assert.deepEqual(
        [first.labelElmt.style.top, second.labelElmt.style.top],
        ["25px", "50px"]
    );

    decorator.setViewOffset(-30);
    decorator.softPaint();
    assert.deepEqual(
        [first.labelElmt.style.top, second.labelElmt.style.top],
        ["30px", "55px"],
        "once collided, both labels must advance together down the span"
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
    assert.deepEqual(scrolled.map((placement) => placement.track), [0, 0, 1]);
    assert.deepEqual(scrolled.map((placement) => placement.top), ["20px", "45px", "20px"]);
    assert.deepEqual(
        scrolled.slice(0, 2).map(
            (placement, index) => Number.parseInt(placement.top, 10) - originalTops[index]
        ),
        [20, 20],
        "colliding labels on one track must move together as the sticky stack advances"
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
    assert.equal(follower.labelElmt.style.top, "40px");

    decorator.setViewOffset(-25);
    decorator.softPaint();
    assert.equal(follower.track, 0);
    assert.equal(follower.labelElmt.style.top, "50px");

    decorator.setViewOffset(0);
    decorator.softPaint();
    assert.equal(follower.track, 0);
    assert.equal(follower.labelElmt.style.top, "40px");
});

test("reverse scrolling removes a bottom reroute when the label fits at its span top", () => {
    const decorator = makeNarrative("vertical");
    const leading = narrativeRange(decorator, 0, -100, 100, 40, 20);
    const constrained = narrativeRange(decorator, 1, 40, 65, 40, 20);
    decorator._rangeRecords = [leading, constrained];

    decorator.setViewOffset(-21);
    decorator.softPaint();
    assert.equal(constrained.track, 1);
    assert.equal(constrained.labelElmt.style.top, "40px");

    decorator.setViewOffset(0);
    decorator.softPaint();
    assert.equal(constrained.track, 0);
    assert.equal(constrained.labelElmt.style.top, "40px");
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
    assert.equal(departing.labelElmt.style.top, "44px");
    assert.equal(follower.labelElmt.style.top, "69px");
    assert.equal(Number.parseInt(follower.labelElmt.style.top, 10) - 44, 25);

    decorator.setViewOffset(-45);
    decorator.softPaint();

    assert.equal(departing.labelElmt.style.display, "none");
    assert.equal(follower.track, 0);
    assert.equal(follower.labelElmt.style.top, "69px");
    assert.equal(
        Number.parseInt(follower.labelElmt.style.top, 10) - 45,
        24,
        "the released follower must resume normal upward scrolling from its pushed position"
    );

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
    assert.equal(follower.labelElmt.style.top, "69px");

    decorator.setViewOffset(-46);
    decorator.softPaint();
    assert.equal(follower.labelElmt.style.top, "69px");
    assert.equal(Number.parseInt(follower.labelElmt.style.top, 10) - 46, 23);
});

test("vertical narrative persistence includes the sticky edge inset in its contact threshold", () => {
    const decorator = makeNarrative("vertical");
    decorator._stickyInset = 6;
    const range = narrativeRange(decorator, 0, -100, 50, 40, 20);
    decorator._rangeRecords = [range];

    decorator.setViewOffset(-32);
    decorator.softPaint();
    assert.equal(range.labelElmt.style.display, "");

    decorator.setViewOffset(-33);
    decorator.softPaint();
    assert.equal(range.labelElmt.style.display, "none");
});

test("a vertical label reroutes before stacking can push it beyond its duration", () => {
    const decorator = makeNarrative("vertical");
    const leading = narrativeRange(decorator, 0, -100, 50, 40, 20);
    const constrained = narrativeRange(decorator, 1, -90, 80, 40, 20);
    decorator._rangeRecords = [leading, constrained];

    decorator.setViewOffset(-35);
    decorator.softPaint();
    assert.equal(constrained.track, 0);
    assert.equal(constrained.labelElmt.style.top, "60px");

    decorator.setViewOffset(-36);
    decorator.softPaint();
    assert.equal(constrained.track, 1);
    assert.equal(constrained.labelElmt.style.top, "36px");
    assert.ok(
        Number.parseInt(constrained.labelElmt.style.top, 10) + constrained.height <=
            constrained.endPixel
    );
});

test("the narrative example does not pin event data to routing tracks", () => {
    const filename = path.join(__dirname, "..", "examples", "timeline-reprise-narrative.html");
    const html = fs.readFileSync(filename, "utf8");
    const narrativeData = html.match(
        /var narrativeData = \{([\s\S]*?)\r?\n    \};\r?\n\r?\n    var mainEventData/
    );

    assert.ok(narrativeData, "expected to find the narrative example data");
    assert.doesNotMatch(narrativeData[1], /^\s*track\s*:/m);
});

function makeConfiguredNarrative(orientation, viewWidth, trackTheme, extraParams = {}) {
    const NarrativeDecorator = loadNarrativeDecorator();
    const horizontal = orientation === "horizontal";
    const decorator = new NarrativeDecorator({
        theme: { eventTheme: { track: { [orientation]: trackTheme } } },
        ...extraParams
    });

    decorator.initialize(
        { getViewWidth: () => viewWidth, _theme: null },
        { isHorizontal: () => horizontal, isVertical: () => !horizontal }
    );

    return decorator;
}

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

test("event-layout horizontal track height defaults to a fixed intrinsic size, independent of band cross-axis extent", () => {
    const getMetrics = loadEventPainter()._testTimeline.EventLayoutThemeShim.getOriginalPainterMetrics;
    const theme = eventTheme();
    delete theme.event.track.height;

    const metrics = getMetrics({ _params: { theme }, _frc: null });

    // Default comes from Math.max(track.height fallback of 10, tape.height + lineHeight fallback of 12);
    // it never reads painter._band, so it cannot vary with band size.
    assert.equal(metrics.trackHeight, Math.max(10, theme.event.tape.height + 12));
    assert.equal(metrics.trackOffset, theme.event.track.offset);
});

test("event-layout horizontal explicit track height is used verbatim", () => {
    const getMetrics = loadEventPainter()._testTimeline.EventLayoutThemeShim.getOriginalPainterMetrics;
    const theme = eventTheme();
    theme.event.track.height = 55;

    const metrics = getMetrics({ _params: { theme }, _frc: null });

    assert.equal(metrics.trackHeight, 55);
});
