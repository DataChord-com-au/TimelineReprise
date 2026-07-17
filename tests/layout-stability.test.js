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
        return paintedData(
            left,
            metrics?.trackOffset ?? 0,
            metrics?.iconWidth ?? 10,
            metrics?.iconHeight ?? 10
        );
    };
    proto._paintEventTape = function () {};
    proto._paintEventLabel = function (evt, text, left, top, width, height) {
        return paintedData(left, top, width, height);
    };
    proto._showBubble = function () {};
    proto.paint = function () {};
    proto.softPaint = function () {};

    const Timeline = { OriginalEventPainter };
    const context = vm.createContext({
        Timeline,
        window: { Timeline }
    });
    const filename = path.join(__dirname, "..", "src", "event-layout.js");

    vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
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
                    labelHorizontalGap: 10,
                    labelTrackCount: 1,
                    labelTrackHeight: 20,
                    labelTrackGap: 2,
                    sparklineStagger: 8,
                    stickyLeftInset: 0
                },
                vertical: {
                    eventRoutingThreshold: 28,
                    tapeGap: 2,
                    toLabelGap: 2,
                    labelWidth: 80,
                    labelTrackCount: 1,
                    labelTrackGap: 5,
                    stickyTopInset: 0,
                    stickyLabelGap: 5,
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

function makeEventPainter(orientation) {
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
        getViewLength: () => 200,
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

test("horizontal event routing includes the rendered sparkline interval", () => {
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

    assert.notEqual(open.data.top, remoteLabelWithLocalSpark.data.top);
});

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

test("horizontal instant label gap zero uses the adjusted baseline", () => {
    const painter = makeEventPainter("horizontal");
    const evt = instantEvent("instant", 20);
    const theme = painter._params.theme;
    theme.event.instant.horizontal = { labelGap: 0 };

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

    assert.equal(label.left, 28);
    assert.equal(label.top, 11);
    assert.equal(label.elmt.style.left, "28px");
    assert.equal(label.elmt.style.top, "11px");
    assert.equal(painter._reprisePointLabels[0].naturalLeft, 28);
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

    decorator._timeline = {
        isHorizontal: () => horizontal,
        isVertical: () => !horizontal
    };
    decorator._band = {
        dateToPixelOffset: (value) => value,
        getViewOffset: () => 0,
        getViewLength: () => 200,
        getViewWidth: () => 200
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
    decorator._labelWidth = horizontal ? null : 40;
    decorator._instantRecords = [];

    return decorator;
}

function narrativeRange(index, start, end, width, height) {
    return {
        item: {},
        index,
        startDate: start,
        endDate: end,
        baseTrack: 0,
        track: 0,
        trackExplicit: false,
        startPixel: 0,
        endPixel: 0,
        width,
        height,
        labelElmt: element(width, height)
    };
}

test("horizontal narrative labels reserve only rendered bounds", () => {
    const decorator = makeNarrative("horizontal");
    const open = narrativeRange(0, -100, 80, 30, 16);
    const right = narrativeRange(1, 170, 260, 40, 16);
    decorator._rangeRecords = [open, right];

    decorator.softPaint();

    assert.equal(open.track, 0);
    assert.equal(right.track, 0);
});

test("vertical narrative ranges choose locally free side tracks", () => {
    const decorator = makeNarrative("vertical");
    const top = narrativeRange(0, 0, 50, 40, 20);
    const lower = [
        narrativeRange(1, 120, 150, 40, 25),
        narrativeRange(2, 120, 150, 40, 25),
        narrativeRange(3, 120, 150, 40, 25)
    ];
    decorator._rangeRecords = [top, ...lower];

    decorator.softPaint();

    assert.equal(top.track, 0);
    assert.deepEqual(lower.map((record) => record.track), [0, 1, 2]);
    assert.deepEqual(lower.map((record) => record.labelElmt.style.top), [
        "120px",
        "120px",
        "120px"
    ]);
});
