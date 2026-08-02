const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("@jest/globals");

const root = path.join(__dirname, "..");
const vendorBundle = fs.readFileSync(
    path.join(
        root,
        "vendor",
        "SIMILE",
        "timeline-2.3.1",
        "timeline_js",
        "timeline-bundle.js"
    ),
    "utf8"
);

function vendorSection(start, end) {
    const startIndex = vendorBundle.indexOf(start);
    const endIndex = vendorBundle.indexOf(end, startIndex);

    assert.notEqual(startIndex, -1, `Missing vendor section start: ${start}`);
    assert.notEqual(endIndex, -1, `Missing vendor section end: ${end}`);
    return vendorBundle.slice(startIndex, endIndex);
}

function source(filename) {
    return fs.readFileSync(path.join(root, "src", filename), "utf8");
}

function makeElement(tagName = "div") {
    return {
        tagName: tagName.toUpperCase(),
        attributes: {},
        children: [],
        className: "",
        innerHTML: "",
        parentNode: null,
        style: {},
        appendChild(child) {
            child.parentNode = this;
            this.children.push(child);
            return child;
        },
        setAttribute(name, value) {
            this.attributes[name] = value;
        }
    };
}

function makeTheme() {
    return {
        firstDayOfWeek: 0,
        ether: {
            backgroundColors: [],
            highlightOpacity: 50,
            interval: {
                line: { show: true, opacity: 25 },
                weekend: { opacity: 30 },
                marker: {
                    hAlign: "Bottom",
                    vAlign: "Right"
                }
            }
        }
    };
}

function loadTimeline() {
    const MILLISECOND = 0;
    const SECOND = 1;
    const MINUTE = 2;
    const HOUR = 3;
    const DAY = 4;
    const WEEK = 5;
    const MONTH = 6;
    const YEAR = 7;
    const DECADE = 8;
    const CENTURY = 9;
    const MILLENNIUM = 10;
    const dayLength = 24 * 60 * 60 * 1000;
    const Timeline = {
        ClassicTheme: {
            create: makeTheme
        }
    };
    const SimileAjax = {
        DateTime: {
            MILLISECOND,
            SECOND,
            MINUTE,
            HOUR,
            DAY,
            WEEK,
            MONTH,
            YEAR,
            DECADE,
            CENTURY,
            MILLENNIUM,
            gregorianUnitLengths: {
                [MILLISECOND]: 1,
                [SECOND]: 1000,
                [MINUTE]: 60 * 1000,
                [HOUR]: 60 * 60 * 1000,
                [DAY]: dayLength
            },
            incrementByInterval(date, unit) {
                switch (unit) {
                case MILLISECOND:
                    date.setTime(date.getTime() + 1);
                    break;
                case SECOND:
                    date.setTime(date.getTime() + 1000);
                    break;
                case MINUTE:
                    date.setTime(date.getTime() + 60 * 1000);
                    break;
                case HOUR:
                    date.setTime(date.getTime() + 60 * 60 * 1000);
                    break;
                case WEEK:
                    date.setUTCDate(date.getUTCDate() + 7);
                    break;
                case MONTH:
                    date.setUTCMonth(date.getUTCMonth() + 1);
                    break;
                case YEAR:
                    date.setUTCFullYear(date.getUTCFullYear() + 1);
                    break;
                case DECADE:
                    date.setUTCFullYear(date.getUTCFullYear() + 10);
                    break;
                case CENTURY:
                    date.setUTCFullYear(date.getUTCFullYear() + 100);
                    break;
                case MILLENNIUM:
                    date.setUTCFullYear(date.getUTCFullYear() + 1000);
                    break;
                default:
                    date.setUTCDate(date.getUTCDate() + 1);
                }
            },
            parseGregorianDateTime(value) {
                return new Date(value);
            },
            roundDownToInterval() {},
            roundUpToInterval() {}
        },
        Graphics: {
            setOpacity(element, opacity) {
                element.opacity = opacity;
            }
        }
    };
    const context = vm.createContext({
        SimileAjax,
        Timeline,
        window: { Timeline }
    });

    vm.runInContext(
        vendorSection(
            "Timeline.GregorianEtherPainter=function",
            "Timeline.EtherIntervalMarkerLayout=function"
        ),
        context,
        { filename: "vendor-ether-painters.js" }
    );
    vm.runInContext(
        vendorSection(
            "Timeline.EtherIntervalMarkerLayout=function",
            "Timeline.EtherHighlight=function"
        ),
        context,
        { filename: "vendor-ether-interval-marker-layout.js" }
    );

    Timeline.EtherHighlight = function (
        timeline,
        band,
        theme,
        backgroundLayer
    ) {
        this.position = function () {
            const highlight = timeline.getDocument().createElement("div");
            highlight.className = "timeline-ether-highlight";
            backgroundLayer.appendChild(highlight);
        };
    };

    vm.runInContext(source("ether-interval-marker.js"), context, {
        filename: "src/ether-interval-marker.js"
    });
    vm.runInContext(
        source("cardinal-axis.js")
            .replace(/^import\s+[\s\S]*?from\s+"[^"]+";\s*$/gm, "")
            .replace(/^export\s*\{\s*attachCardinalAxis\s*\};?\s*$/m, ""),
        context,
        { filename: "src/cardinal-axis.js" }
    );

    Timeline.createHotZoneBandInfo = function () {
        return {};
    };
    vm.runInContext(
        source("scaled-zones.js")
            .replace(
                /^export\s*\{\s*UnitScaledZoneEther\s*\};?\s*$/m,
                ""
            ),
        context,
        {
            filename: "src/scaled-zones.js"
        }
    );

    return { DAY, WEEK, MONTH, YEAR, Timeline };
}

function makePainterFixture(
    horizontal,
    labelInterval,
    intervalMarkers = true,
    values = null
) {
    const document = {
        createElement: makeElement
    };
    const layers = [];
    const start = values?.start ?? new Date("2024-01-01T00:00:00Z");
    const end = values?.end ?? new Date("2024-01-03T00:00:00Z");
    const cloneValue = values?.cloneValue ?? (value =>
        new Date(value.getTime())
    );
    const timeline = {
        getDocument() {
            return document;
        },
        isHorizontal() {
            return horizontal;
        }
    };
    const band = {
        _bandInfo: { intervalMarkers },
        createLayerDiv(zIndex) {
            const layer = makeElement();
            layer.zIndex = zIndex;
            layers.push(layer);
            return layer;
        },
        dateToPixelOffset(value) {
            return values?.dateToPixelOffset?.(value) ??
                (value.getTime() - start.getTime()) / (60 * 60 * 1000);
        },
        getLabeller() {
            return {
                labelInterval
            };
        },
        getMaxDate() {
            return cloneValue(end);
        },
        getMinDate() {
            return cloneValue(start);
        },
        getTimeZone() {
            return 0;
        },
        removeLayerDiv(layer) {
            const index = layers.indexOf(layer);
            if (index >= 0) layers.splice(index, 1);
        }
    };

    return {
        band,
        layer(name) {
            return layers.find(layer => layer.attributes.name === name);
        },
        timeline
    };
}

function dateLabels(layer) {
    return layer.children.filter(child =>
        child.className.split(/\s+/).includes("timeline-date-label")
    );
}

function markerTick(label) {
    return label.children.find(child =>
        child.className === "timeline-reprise-date-label-tick"
    );
}

function labelTexts(layer) {
    return dateLabels(layer).map(label => label.innerHTML);
}

function labelOffsets(layer) {
    return dateLabels(layer).map(label =>
        Number.parseInt(label.style.left ?? label.style.top, 10)
    );
}

test("ClassicTheme contains only marker presentation defaults", () => {
    const { Timeline } = loadTimeline();
    const marker = Timeline.ClassicTheme.create().ether.interval.marker;

    assert.equal(Object.hasOwn(marker, "show"), false);
    assert.equal(marker.hLength, null);
    assert.equal(marker.vLength, "2.5em");
});

test("shared marker defaults do not mutate a supplied native theme", () => {
    const { DAY, Timeline } = loadTimeline();
    const theme = makeTheme();
    const themeBefore = JSON.parse(JSON.stringify(theme));
    const fixture = makePainterFixture(false, () => ({
        text: "Defaulted without mutation",
        emphasized: false
    }));
    const painter = new Timeline.GregorianEtherPainter({
        theme,
        unit: DAY
    });

    painter.initialize(fixture.band, fixture.timeline);
    painter.paint();

    assert.deepEqual(theme, themeBefore);
    assert.ok(dateLabels(fixture.layer("ether-markers")).every(label =>
        markerTick(label).style.width === "2.5em"
    ));
});

test("Gregorian markers render by default with a fixed vertical 2.5em tick", () => {
    const { DAY, Timeline } = loadTimeline();
    const theme = Timeline.ClassicTheme.create();
    const fixture = makePainterFixture(false, date => ({
        text: date.getUTCDate() === 1
            ? "A very long emphasized interval label"
            : "2",
        emphasized: date.getUTCDate() === 1
    }));
    const painter = new Timeline.GregorianEtherPainter({
        theme,
        unit: DAY
    });

    painter.initialize(fixture.band, fixture.timeline);
    painter.paint();

    const labels = dateLabels(fixture.layer("ether-markers"));
    assert.ok(labels.length > 0);
    assert.ok(labels.some(label =>
        label.className.includes("timeline-date-label-em")
    ));
    assert.ok(labels.some(label =>
        !label.className.includes("timeline-date-label-em")
    ));
    assert.ok(labels.every(label => !("width" in label.style)));
    assert.ok(labels.every(label => markerTick(label).style.width === "2.5em"));
});

test("intervalMarkers false retains Gregorian highlights and interval lines", () => {
    const { DAY, Timeline } = loadTimeline();
    const theme = Timeline.ClassicTheme.create();
    const fixture = makePainterFixture(false, () => ({
        text: "Hidden marker",
        emphasized: false
    }), false);
    const painter = new Timeline.GregorianEtherPainter({
        theme,
        unit: DAY
    });

    painter.initialize(fixture.band, fixture.timeline);
    painter.setHighlight(
        new Date("2024-01-01T00:00:00Z"),
        new Date("2024-01-02T00:00:00Z")
    );
    painter.paint();

    assert.equal(dateLabels(fixture.layer("ether-markers")).length, 0);
    assert.ok(fixture.layer("ether-lines").children.some(child =>
        child.className === "timeline-ether-lines"
    ));
    assert.ok(fixture.layer("ether-background").children.some(child =>
        child.className === "timeline-ether-highlight"
    ));
});

test("marker visibility remains independent of line and weekend settings", () => {
    const { DAY, WEEK, Timeline } = loadTimeline();
    const theme = Timeline.ClassicTheme.create();
    theme.ether.interval.line.show = false;
    const noLineFixture = makePainterFixture(false, () => ({
        text: "Hidden marker",
        emphasized: false
    }), false);
    const noLinePainter = new Timeline.GregorianEtherPainter({
        theme,
        unit: DAY
    });

    noLinePainter.initialize(noLineFixture.band, noLineFixture.timeline);
    noLinePainter.paint();

    assert.equal(noLineFixture.layer("ether-lines").children.length, 0);

    const weekendFixture = makePainterFixture(false, () => ({
        text: "Hidden week",
        emphasized: false
    }), false);
    const weekendPainter = new Timeline.GregorianEtherPainter({
        theme,
        unit: WEEK
    });

    weekendPainter.initialize(weekendFixture.band, weekendFixture.timeline);
    weekendPainter.paint();

    assert.equal(dateLabels(weekendFixture.layer("ether-markers")).length, 0);
    assert.ok(weekendFixture.layer("ether-lines").children.some(child =>
        child.className === "timeline-ether-weekends"
    ));
});

test("fixed vertical ticks stay separate and anchor labels inward", () => {
    const { DAY, Timeline } = loadTimeline();

    for (const align of ["Left", "Right"]) {
        const theme = Timeline.ClassicTheme.create();
        theme.ether.interval.marker.vAlign = align;
        theme.ether.interval.marker.vLength = "2em";
        const fixture = makePainterFixture(false, date => ({
            text: date.getUTCDate() === 1
                ? "A label much longer than two em"
                : "Normal",
            emphasized: date.getUTCDate() === 1
        }));
        const painter = new Timeline.GregorianEtherPainter({
            theme,
            unit: DAY
        });

        painter.initialize(fixture.band, fixture.timeline);
        painter.paint();

        const labels = dateLabels(fixture.layer("ether-markers"));
        const edge = align.toLowerCase();
        const opposite = align === "Left" ? "right" : "left";

        assert.ok(labels.some(label =>
            label.className.includes("timeline-date-label-em")
        ));
        assert.ok(labels.some(label =>
            !label.className.includes("timeline-date-label-em")
        ));
        assert.ok(labels.every(label => label.style[edge] === "0px"));
        assert.ok(labels.every(label => !(opposite in label.style)));
        assert.ok(labels.every(label =>
            label.className.includes(
                `timeline-reprise-date-label-${edge}`
            )
        ));
        assert.ok(labels.every(label => !("width" in label.style)));
        assert.ok(labels.every(label =>
            markerTick(label).style.width === "2em"
        ));
    }
});

test("fixed horizontal ticks anchor Top and Bottom labels inward", () => {
    const { DAY, Timeline } = loadTimeline();

    for (const align of ["Top", "Bottom"]) {
        const theme = Timeline.ClassicTheme.create();
        theme.ether.interval.marker.hAlign = align;
        theme.ether.interval.marker.hLength = "4em";
        const fixture = makePainterFixture(true, () => ({
            text: "Horizontal label",
            emphasized: true
        }));
        const painter = new Timeline.GregorianEtherPainter({
            theme,
            unit: DAY
        });

        painter.initialize(fixture.band, fixture.timeline);
        painter.paint();

        const labels = dateLabels(fixture.layer("ether-markers"));
        const edge = align.toLowerCase();
        const opposite = align === "Top" ? "bottom" : "top";

        assert.ok(labels.every(label => label.style[edge] === "0px"));
        assert.ok(labels.every(label => !(opposite in label.style)));
        assert.ok(labels.every(label =>
            label.className.includes(
                `timeline-reprise-date-label-${edge}`
            )
        ));
        assert.ok(labels.every(label => !("height" in label.style)));
        assert.ok(labels.every(label =>
            markerTick(label).style.height === "4em"
        ));
    }
});

test("label-sized ticks follow normal and emphasized label boxes", () => {
    const { DAY, Timeline } = loadTimeline();
    const verticalTheme = Timeline.ClassicTheme.create();
    verticalTheme.ether.interval.marker.vLength = "label";
    const verticalFixture = makePainterFixture(false, date => ({
        text: date.getUTCDate() === 1 ? "Emphasized label" : "Normal",
        emphasized: date.getUTCDate() === 1
    }));
    const verticalPainter = new Timeline.GregorianEtherPainter({
        theme: verticalTheme,
        unit: DAY
    });

    verticalPainter.initialize(verticalFixture.band, verticalFixture.timeline);
    verticalPainter.paint();

    const verticalLabels = dateLabels(
        verticalFixture.layer("ether-markers")
    );
    assert.ok(verticalLabels.some(label =>
        label.className.includes("timeline-date-label-em")
    ));
    assert.ok(verticalLabels.some(label =>
        !label.className.includes("timeline-date-label-em")
    ));
    assert.ok(verticalLabels.every(label => !("width" in label.style)));
    assert.ok(verticalLabels.every(label =>
        markerTick(label).style.width === "100%"
    ));

    const horizontalTheme = Timeline.ClassicTheme.create();
    horizontalTheme.ether.interval.marker.hLength = "label";
    const horizontalFixture = makePainterFixture(true, date => ({
        text: date.getUTCDate() === 1 ? "Emphasized label" : "Normal",
        emphasized: date.getUTCDate() === 1
    }));
    const horizontalPainter = new Timeline.GregorianEtherPainter({
        theme: horizontalTheme,
        unit: DAY
    });

    horizontalPainter.initialize(
        horizontalFixture.band,
        horizontalFixture.timeline
    );
    horizontalPainter.paint();

    const horizontalLabels = dateLabels(
        horizontalFixture.layer("ether-markers")
    );
    assert.ok(horizontalLabels.some(label =>
        label.className.includes("timeline-date-label-em")
    ));
    assert.ok(horizontalLabels.some(label =>
        !label.className.includes("timeline-date-label-em")
    ));
    assert.ok(horizontalLabels.every(label => !("height" in label.style)));
    assert.ok(horizontalLabels.every(label =>
        markerTick(label).style.height === "100%"
    ));
});

test("null marker lengths retain native stylesheet sizing", () => {
    const { DAY, Timeline } = loadTimeline();

    for (const horizontal of [false, true]) {
        const theme = Timeline.ClassicTheme.create();
        theme.ether.interval.marker[
            horizontal ? "hLength" : "vLength"
        ] = null;
        const fixture = makePainterFixture(horizontal, () => ({
            text: "Native marker",
            emphasized: true
        }));
        const painter = new Timeline.GregorianEtherPainter({
            theme,
            unit: DAY
        });

        painter.initialize(fixture.band, fixture.timeline);
        painter.paint();

        const labels = dateLabels(fixture.layer("ether-markers"));
        const dimension = horizontal ? "height" : "width";

        assert.ok(labels.length > 0);
        assert.ok(labels.every(label => !(dimension in label.style)));
        assert.ok(labels.every(label => markerTick(label) === undefined));
        assert.ok(labels.every(label =>
            !label.className.includes("timeline-reprise-date-label-ticked")
        ));
    }
});

test("cardinal markerTheme resolves over the native theme without mutation", () => {
    const { DAY, Timeline } = loadTimeline();
    const theme = Timeline.ClassicTheme.create();
    const nativeMarker = theme.ether.interval.marker;
    nativeMarker.hLength = "3em";
    nativeMarker.vLength = "4em";
    const markerTheme = {
        hLength: "6em",
        vLength: "7em"
    };
    const nativeMarkerBefore = { ...nativeMarker };
    const markerThemeBefore = { ...markerTheme };
    const verticalFixture = makePainterFixture(false, () => ({
        text: "Unused",
        emphasized: false
    }), false);
    const verticalCardinal = new Timeline.CardinalAxis({
        labelForIndex: index => `Vertical cardinal marker ${index}`,
        markerTheme,
        startDate: new Date("2024-01-01T00:00:00Z"),
        theme,
        unit: DAY
    });

    verticalCardinal.initialize(
        verticalFixture.band,
        verticalFixture.timeline
    );
    verticalCardinal.paint();

    const verticalLabels = dateLabels(
        verticalFixture.layer("ether-markers")
    );
    assert.ok(verticalLabels.length > 0);
    assert.ok(verticalLabels.every(label => !("width" in label.style)));
    assert.ok(verticalLabels.every(label =>
        markerTick(label).style.width === "7em"
    ));

    const horizontalFixture = makePainterFixture(true, () => ({
        text: "Unused",
        emphasized: false
    }), false);
    const horizontalCardinal = new Timeline.CardinalAxis({
        labelForIndex: index => `Horizontal cardinal marker ${index}`,
        markerTheme,
        startDate: new Date("2024-01-01T00:00:00Z"),
        theme,
        unit: DAY
    });

    horizontalCardinal.initialize(
        horizontalFixture.band,
        horizontalFixture.timeline
    );
    horizontalCardinal.paint();

    const horizontalLabels = dateLabels(
        horizontalFixture.layer("ether-markers")
    );
    assert.ok(horizontalLabels.length > 0);
    assert.ok(horizontalLabels.every(label => !("height" in label.style)));
    assert.ok(horizontalLabels.every(label =>
        markerTick(label).style.height === "6em"
    ));
    assert.notEqual(verticalCardinal._theme, theme);
    assert.notEqual(
        verticalCardinal._theme.ether.interval.marker,
        nativeMarker
    );
    assert.deepEqual(nativeMarker, nativeMarkerBefore);
    assert.deepEqual(markerTheme, markerThemeBefore);
});

test("cardinal axes advance scalar values through the injected unit", () => {
    const { DAY, Timeline } = loadTimeline();
    const changes = [];
    const planningUnit = {
        cloneValue: value => Number(value),
        compare: (left, right) => left - right,
        change(value, delta) {
            changes.push({ value, delta });
            return value + delta;
        }
    };
    const fixture = makePainterFixture(
        true,
        () => ({ text: "Unused", emphasized: false }),
        false,
        {
            start: 0,
            end: 30,
            cloneValue: value => value,
            dateToPixelOffset: value => value * 9
        }
    );
    const cardinal = new Timeline.CardinalAxis({
        runtime: { unit: planningUnit },
        startDate: 0,
        endDate: 30,
        theme: Timeline.ClassicTheme.create(),
        unit: DAY,
        unitsPerCount: 5,
        countsPerMarker: 2,
        anchorValue: 1
    });

    cardinal.initialize(fixture.band, fixture.timeline);
    cardinal.paint();

    assert.deepEqual(
        dateLabels(fixture.layer("ether-markers")).map(label => label.innerHTML),
        ["1", "3", "5", "7"]
    );
    assert.deepEqual(changes, [
        { value: 0, delta: 10 },
        { value: 10, delta: 10 },
        { value: 20, delta: 10 }
    ]);
});

test("cardinal axes render aligned bounded ranges from either anchor", () => {
    const { DAY, Timeline } = loadTimeline();
    const unit = {
        cloneValue: value => Number(value),
        compare: (left, right) => left - right,
        change: (value, delta) => value + delta
    };

    for (const fixtureSpec of [
        { anchor: "start", expected: ["0", "1", "2", "3"] },
        { anchor: "end", expected: ["3", "2", "1", "0"] }
    ]) {
        const fixture = makePainterFixture(
            true,
            () => ({ text: "Unused", emphasized: false }),
            false,
            {
                start: 0,
                end: 30,
                cloneValue: value => value,
                dateToPixelOffset: value => value
            }
        );
        const cardinal = new Timeline.CardinalAxis({
            runtime: { unit },
            startDate: 0,
            endDate: 30,
            theme: Timeline.ClassicTheme.create(),
            unit: DAY,
            unitsPerCount: 10,
            anchor: fixtureSpec.anchor
        });

        cardinal.initialize(fixture.band, fixture.timeline);
        cardinal.paint();

        assert.deepEqual(
            labelTexts(fixture.layer("ether-markers")),
            fixtureSpec.expected
        );
        assert.deepEqual(labelOffsets(fixture.layer("ether-markers")), [
            0,
            10,
            20,
            30
        ]);
    }
});

test("cardinal labelForIndex receives anchor-relative indexes", () => {
    const { DAY, Timeline } = loadTimeline();
    const unit = {
        cloneValue: value => Number(value),
        compare: (left, right) => left - right,
        change: (value, delta) => value + delta
    };
    const seen = [];
    const fixture = makePainterFixture(
        true,
        () => ({ text: "Unused", emphasized: false }),
        false,
        {
            start: 0,
            end: 30,
            cloneValue: value => value,
            dateToPixelOffset: value => value
        }
    );
    const cardinal = new Timeline.CardinalAxis({
        runtime: { unit },
        startDate: 0,
        endDate: 30,
        theme: Timeline.ClassicTheme.create(),
        unit: DAY,
        unitsPerCount: 10,
        anchor: "end",
        labelForIndex(index) {
            seen.push(index);
            return `i${index}`;
        }
    });

    cardinal.initialize(fixture.band, fixture.timeline);
    cardinal.paint();

    assert.deepEqual(labelTexts(fixture.layer("ether-markers")), [
        "i3",
        "i2",
        "i1",
        "i0"
    ]);
    assert.deepEqual(seen, [3, 2, 1, 0]);
});

test("cardinal boundary labels refer to physical range boundaries", () => {
    const { DAY, Timeline } = loadTimeline();
    const unit = {
        cloneValue: value => Number(value),
        compare: (left, right) => left - right,
        change: (value, delta) => value + delta
    };

    for (const anchor of ["start", "end"]) {
        const fixture = makePainterFixture(
            true,
            () => ({ text: "Unused", emphasized: false }),
            false,
            {
                start: 0,
                end: 20,
                cloneValue: value => value,
                dateToPixelOffset: value => value
            }
        );
        const cardinal = new Timeline.CardinalAxis({
            runtime: { unit },
            startDate: 0,
            endDate: 20,
            theme: Timeline.ClassicTheme.create(),
            unit: DAY,
            unitsPerCount: 10,
            anchor,
            startLabel: "Start",
            endLabel: "End"
        });

        cardinal.initialize(fixture.band, fixture.timeline);
        cardinal.paint();

        assert.deepEqual(labelTexts(fixture.layer("ether-markers")), [
            "Start",
            "1",
            "End"
        ]);
    }
});

test("start-anchored cardinal finishing handles unaligned end boundaries", () => {
    const { DAY, Timeline } = loadTimeline();
    const unit = {
        cloneValue: value => Number(value),
        compare: (left, right) => left - right,
        change: (value, delta) => value + delta
    };

    for (const fixtureSpec of [
        {
            finishing: "drop",
            expectedLabels: ["0", "1", "2"],
            expectedOffsets: [0, 10, 20]
        },
        {
            finishing: "truncate",
            expectedLabels: ["0", "1", "2", "2.5"],
            expectedOffsets: [0, 10, 20, 25]
        },
        {
            finishing: "extend",
            expectedLabels: ["0", "1", "2", "3"],
            expectedOffsets: [0, 10, 20, 30]
        }
    ]) {
        const fixture = makePainterFixture(
            true,
            () => ({ text: "Unused", emphasized: false }),
            false,
            {
                start: 0,
                end: 30,
                cloneValue: value => value,
                dateToPixelOffset: value => value
            }
        );
        const cardinal = new Timeline.CardinalAxis({
            runtime: { unit },
            startDate: 0,
            endDate: 25,
            theme: Timeline.ClassicTheme.create(),
            unit: DAY,
            unitsPerCount: 10,
            finishing: fixtureSpec.finishing
        });

        cardinal.initialize(fixture.band, fixture.timeline);
        cardinal.paint();

        assert.deepEqual(
            labelTexts(fixture.layer("ether-markers")),
            fixtureSpec.expectedLabels
        );
        assert.deepEqual(
            labelOffsets(fixture.layer("ether-markers")),
            fixtureSpec.expectedOffsets
        );
    }
});

test("cardinal extend uses injected marker projections instead of unit stepping", () => {
    const { DAY, Timeline } = loadTimeline();
    const unit = {
        cloneValue: value => Number(value),
        compare: (left, right) => left - right,
        change() {
            throw new Error("generic unit stepping should not be used");
        }
    };
    const fixture = makePainterFixture(
        true,
        () => ({ text: "Unused", emphasized: false }),
        false,
        {
            start: 0,
            end: 50,
            cloneValue: value => value,
            dateToPixelOffset: value => value
        }
    );
    const cardinal = new Timeline.CardinalAxis({
        runtime: { unit },
        startDate: 0,
        endDate: 23,
        theme: Timeline.ClassicTheme.create(),
        unit: DAY,
        unitsPerCount: 10,
        finishing: "extend",
        markerAtIndex: index => [0, 10, 21, 34][index] ?? null
    });

    cardinal.initialize(fixture.band, fixture.timeline);
    cardinal.paint();

    assert.deepEqual(labelTexts(fixture.layer("ether-markers")), [
        "0",
        "1",
        "2",
        "3"
    ]);
    assert.deepEqual(labelOffsets(fixture.layer("ether-markers")), [
        0,
        10,
        21,
        34
    ]);
});

test("end-anchored cardinal finishing handles unaligned start boundaries", () => {
    const { DAY, Timeline } = loadTimeline();
    const unit = {
        cloneValue: value => Number(value),
        compare: (left, right) => left - right,
        change: (value, delta) => value + delta
    };

    for (const fixtureSpec of [
        {
            finishing: "drop",
            expectedLabels: ["2", "1", "0"],
            expectedOffsets: [10, 20, 30]
        },
        {
            finishing: "truncate",
            expectedLabels: ["2.5", "2", "1", "0"],
            expectedOffsets: [5, 10, 20, 30]
        },
        {
            finishing: "extend",
            expectedLabels: ["3", "2", "1", "0"],
            expectedOffsets: [0, 10, 20, 30]
        }
    ]) {
        const fixture = makePainterFixture(
            true,
            () => ({ text: "Unused", emphasized: false }),
            false,
            {
                start: 0,
                end: 30,
                cloneValue: value => value,
                dateToPixelOffset: value => value
            }
        );
        const cardinal = new Timeline.CardinalAxis({
            runtime: { unit },
            startDate: 5,
            endDate: 30,
            theme: Timeline.ClassicTheme.create(),
            unit: DAY,
            unitsPerCount: 10,
            anchor: "end",
            finishing: fixtureSpec.finishing
        });

        cardinal.initialize(fixture.band, fixture.timeline);
        cardinal.paint();

        assert.deepEqual(
            labelTexts(fixture.layer("ether-markers")),
            fixtureSpec.expectedLabels
        );
        assert.deepEqual(
            labelOffsets(fixture.layer("ether-markers")),
            fixtureSpec.expectedOffsets
        );
    }
});

test("cardinal truncate uses injected partial indexes when supplied", () => {
    const { DAY, Timeline } = loadTimeline();
    const unit = {
        cloneValue: value => Number(value),
        compare: (left, right) => left - right,
        change() {
            throw new Error("generic unit stepping should not be used");
        }
    };
    const contexts = [];
    const fixture = makePainterFixture(
        true,
        () => ({ text: "Unused", emphasized: false }),
        false,
        {
            start: 0,
            end: 30,
            cloneValue: value => value,
            dateToPixelOffset: value => value
        }
    );
    const cardinal = new Timeline.CardinalAxis({
        runtime: { unit },
        startDate: 0,
        endDate: 25,
        theme: Timeline.ClassicTheme.create(),
        unit: DAY,
        unitsPerCount: 10,
        finishing: "truncate",
        markerAtIndex: index => [0, 10, 20, 30][index] ?? null,
        indexAtValue(value, context) {
            contexts.push({ value, context });
            return 2.25;
        }
    });

    cardinal.initialize(fixture.band, fixture.timeline);
    cardinal.paint();

    assert.deepEqual(labelTexts(fixture.layer("ether-markers")), [
        "0",
        "1",
        "2.3"
    ]);
    assert.equal(contexts.length, 1);
    assert.equal(contexts[0].value, 25);
    assert.deepEqual({ ...contexts[0].context }, {
        previousMarker: 20,
        nextMarker: 30,
        previousIndex: 2,
        nextIndex: 3,
        anchor: "start",
        finishing: "truncate"
    });
});

test("cardinal truncate drops the previous marker below the threshold", () => {
    const { DAY, Timeline } = loadTimeline();
    const unit = {
        cloneValue: value => Number(value),
        compare: (left, right) => left - right,
        change: (value, delta) => value + delta
    };

    for (const fixtureSpec of [
        {
            endDate: 22.5,
            expectedLabels: ["0", "1", "2.3"],
            expectedOffsets: [0, 10, 23]
        },
        {
            endDate: 29,
            expectedLabels: ["0", "1", "2", "2.9"],
            expectedOffsets: [0, 10, 20, 29]
        },
        {
            endDate: 22.5,
            threshold: 0,
            expectedLabels: ["0", "1", "2", "2.3"],
            expectedOffsets: [0, 10, 20, 23]
        }
    ]) {
        const fixture = makePainterFixture(
            true,
            () => ({ text: "Unused", emphasized: false }),
            false,
            {
                start: 0,
                end: 30,
                cloneValue: value => value,
                dateToPixelOffset: value => value
            }
        );
        const cardinal = new Timeline.CardinalAxis({
            runtime: { unit },
            startDate: 0,
            endDate: fixtureSpec.endDate,
            theme: Timeline.ClassicTheme.create(),
            unit: DAY,
            unitsPerCount: 10,
            finishing: "truncate",
            truncatePreviousMarkerThreshold: fixtureSpec.threshold
        });

        cardinal.initialize(fixture.band, fixture.timeline);
        cardinal.paint();

        assert.deepEqual(
            labelTexts(fixture.layer("ether-markers")),
            fixtureSpec.expectedLabels
        );
        assert.deepEqual(
            labelOffsets(fixture.layer("ether-markers")),
            fixtureSpec.expectedOffsets
        );
    }
});

test("truncated cardinal finishing does not duplicate an aligned boundary", () => {
    const { DAY, Timeline } = loadTimeline();
    const unit = {
        cloneValue: value => Number(value),
        compare: (left, right) => left - right,
        change: (value, delta) => value + delta
    };
    const fixture = makePainterFixture(
        true,
        () => ({ text: "Unused", emphasized: false }),
        false,
        {
            start: 0,
            end: 30,
            cloneValue: value => value,
            dateToPixelOffset: value => value
        }
    );
    const cardinal = new Timeline.CardinalAxis({
        runtime: { unit },
        startDate: 0,
        endDate: 30,
        theme: Timeline.ClassicTheme.create(),
        unit: DAY,
        unitsPerCount: 10,
        finishing: "truncate"
    });

    cardinal.initialize(fixture.band, fixture.timeline);
    cardinal.paint();

    assert.deepEqual(labelTexts(fixture.layer("ether-markers")), [
        "0",
        "1",
        "2",
        "3"
    ]);
    assert.deepEqual(labelOffsets(fixture.layer("ether-markers")), [
        0,
        10,
        20,
        30
    ]);
});

test("cardinal axes keep painting in screen order when the anchor is outside the viewport", () => {
    const { DAY, Timeline } = loadTimeline();
    const unit = {
        cloneValue: value => Number(value),
        compare: (left, right) => left - right,
        change: (value, delta) => value + delta
    };

    for (const fixtureSpec of [
        { anchor: "start", expected: ["4", "5", "6"] },
        { anchor: "end", expected: ["6", "5", "4"] }
    ]) {
        const fixture = makePainterFixture(
            true,
            () => ({ text: "Unused", emphasized: false }),
            false,
            {
                start: 40,
                end: 60,
                cloneValue: value => value,
                dateToPixelOffset: value => value
            }
        );
        const cardinal = new Timeline.CardinalAxis({
            runtime: { unit },
            startDate: 0,
            endDate: 100,
            theme: Timeline.ClassicTheme.create(),
            unit: DAY,
            unitsPerCount: 10,
            anchor: fixtureSpec.anchor
        });

        cardinal.initialize(fixture.band, fixture.timeline);
        cardinal.paint();

        assert.deepEqual(
            labelTexts(fixture.layer("ether-markers")),
            fixtureSpec.expected
        );
        assert.deepEqual(labelOffsets(fixture.layer("ether-markers")), [
            40,
            50,
            60
        ]);
    }
});

test("cardinal date axes use native calendar stepping across variable lengths", () => {
    const { MONTH, YEAR, Timeline } = loadTimeline();
    const captured = [];
    const monthFixture = makePainterFixture(
        true,
        () => ({ text: "Unused", emphasized: false }),
        false,
        {
            start: new Date("2024-01-31T00:00:00Z"),
            end: new Date("2024-05-31T00:00:00Z"),
            dateToPixelOffset(value) {
                captured.push(value.toISOString().slice(0, 10));
                return captured.length;
            }
        }
    );
    const monthAxis = new Timeline.CardinalAxis({
        startDate: new Date("2024-01-31T00:00:00Z"),
        endDate: new Date("2024-05-31T00:00:00Z"),
        theme: Timeline.ClassicTheme.create(),
        unit: MONTH
    });

    monthAxis.initialize(monthFixture.band, monthFixture.timeline);
    monthAxis.paint();

    assert.deepEqual(captured, [
        "2024-01-31",
        "2024-03-02",
        "2024-04-02",
        "2024-05-02"
    ]);

    const capturedYears = [];
    const yearFixture = makePainterFixture(
        true,
        () => ({ text: "Unused", emphasized: false }),
        false,
        {
            start: new Date("2024-02-29T00:00:00Z"),
            end: new Date("2027-03-01T00:00:00Z"),
            dateToPixelOffset(value) {
                capturedYears.push(value.toISOString().slice(0, 10));
                return capturedYears.length;
            }
        }
    );
    const yearAxis = new Timeline.CardinalAxis({
        startDate: new Date("2024-02-29T00:00:00Z"),
        endDate: new Date("2027-03-01T00:00:00Z"),
        theme: Timeline.ClassicTheme.create(),
        unit: YEAR
    });

    yearAxis.initialize(yearFixture.band, yearFixture.timeline);
    yearAxis.paint();

    assert.deepEqual(capturedYears, [
        "2024-02-29",
        "2025-03-01",
        "2026-03-01",
        "2027-03-01"
    ]);
});

test("cardinal and hot-zone painters use the shared marker theme", () => {
    const { DAY, Timeline } = loadTimeline();
    const cardinalTheme = Timeline.ClassicTheme.create();
    cardinalTheme.ether.interval.marker.vLength = "5em";
    const cardinalFixture = makePainterFixture(false, () => ({
        text: "Unused",
        emphasized: false
    }));
    const cardinal = new Timeline.CardinalAxis({
        labelForIndex: index => `Cardinal marker ${index}`,
        startDate: new Date("2024-01-01T00:00:00Z"),
        theme: cardinalTheme,
        unit: DAY
    });

    cardinal.initialize(cardinalFixture.band, cardinalFixture.timeline);
    cardinal.paint();

    assert.ok(
        dateLabels(cardinalFixture.layer("ether-markers")).every(label =>
            markerTick(label).style.width === "5em" &&
            !("width" in label.style)
        )
    );

    const hotZoneTheme = Timeline.ClassicTheme.create();
    const hotZoneFixture = makePainterFixture(false, () => ({
        text: "Hidden hot-zone marker",
        emphasized: false
    }), false);
    const hotZone = new Timeline.HotZoneGregorianEtherPainter({
        theme: hotZoneTheme,
        unit: DAY,
        zones: []
    });

    hotZone.initialize(hotZoneFixture.band, hotZoneFixture.timeline);
    hotZone.paint();

    assert.equal(dateLabels(hotZoneFixture.layer("ether-markers")).length, 0);
    assert.ok(hotZoneFixture.layer("ether-lines").children.some(child =>
        child.className === "timeline-ether-lines"
    ));
});

test("year-count and quarterly painters use the shared tick geometry", () => {
    const { Timeline } = loadTimeline();

    for (const Painter of [
        Timeline.YearCountEtherPainter,
        Timeline.QuarterlyEtherPainter
    ]) {
        const theme = Timeline.ClassicTheme.create();
        theme.ether.interval.marker.vLength = "3rem";
        const fixture = makePainterFixture(false, () => ({
            text: "Unused",
            emphasized: false
        }));
        const painter = new Painter({
            startDate: new Date("2024-01-01T00:00:00Z"),
            theme
        });

        painter.initialize(fixture.band, fixture.timeline);
        painter.paint();

        const labels = dateLabels(fixture.layer("ether-markers"));

        assert.ok(labels.length > 0);
        assert.ok(labels.every(label => !("width" in label.style)));
        assert.ok(labels.every(label =>
            markerTick(label).style.width === "3rem"
        ));
    }
});

test("Reprise CSS separates tick geometry and aligns vertical labels", () => {
    const css = source(path.join("css", "timeline-layout.css"));

    assert.match(
        css,
        /\.timeline-horizontal\s+\.timeline-date-label-em\s*\{[^}]*\bheight\s*:\s*1\.5em\b/s
    );
    assert.match(
        css,
        /\.timeline-vertical\s+\.timeline-date-label-em\s*\{[^}]*\bwidth\s*:\s*5em\b/s
    );
    assert.match(
        css,
        /\.timeline-date-label\.timeline-reprise-date-label-ticked\s*\{[^}]*\bborder-width\s*:\s*0\b[^}]*\bheight\s*:\s*auto\b[^}]*\bwidth\s*:\s*auto\b/s
    );
    assert.match(
        css,
        /\.timeline-reprise-date-label-left\s*>\s*\.timeline-reprise-date-label-tick\s*\{[^}]*\bleft\s*:\s*0\b/s
    );
    assert.match(
        css,
        /\.timeline-reprise-date-label-right\s*>\s*\.timeline-reprise-date-label-tick\s*\{[^}]*\bright\s*:\s*0\b/s
    );
    assert.match(
        css,
        /\.timeline-reprise-date-label-left\s*\{[^}]*\bpadding-left\s*:\s*4px\b[^}]*\btext-align\s*:\s*left\b/s
    );
    assert.match(
        css,
        /\.timeline-reprise-date-label-right\s*\{[^}]*\bpadding-right\s*:\s*4px\b[^}]*\btext-align\s*:\s*right\b/s
    );
    assert.match(
        css,
        /\.timeline-vertical\s+\.timeline-date-label\.timeline-reprise-date-label-ticked\s*\{[^}]*\bpadding-top\s*:\s*4px\b/s
    );
});
