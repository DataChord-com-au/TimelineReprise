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
    proto._paintEventIcon = function () {};
    proto._paintEventTape = function () {};
    proto._paintEventLabel = function () {};
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
