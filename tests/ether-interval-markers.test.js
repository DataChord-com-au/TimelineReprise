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
    const DAY = 4;
    const WEEK = 3;
    const YEAR = 6;
    const dayLength = 24 * 60 * 60 * 1000;
    const Timeline = {
        ClassicTheme: {
            create: makeTheme
        }
    };
    const SimileAjax = {
        DateTime: {
            DAY,
            WEEK,
            YEAR,
            gregorianUnitLengths: {
                [DAY]: dayLength
            },
            incrementByInterval(date, unit) {
                date.setTime(
                    date.getTime() + (unit === WEEK ? 7 : 1) * dayLength
                );
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
    vm.runInContext(source("cardinal-axis.js"), context, {
        filename: "src/cardinal-axis.js"
    });

    Timeline.createHotZoneBandInfo = function () {
        return {};
    };
    vm.runInContext(source("scaled-zones.js"), context, {
        filename: "src/scaled-zones.js"
    });

    return { DAY, WEEK, Timeline };
}

function makePainterFixture(horizontal, labelInterval) {
    const document = {
        createElement: makeElement
    };
    const layers = [];
    const start = new Date("2024-01-01T00:00:00Z");
    const end = new Date("2024-01-03T00:00:00Z");
    const timeline = {
        getDocument() {
            return document;
        },
        isHorizontal() {
            return horizontal;
        }
    };
    const band = {
        createLayerDiv(zIndex) {
            const layer = makeElement();
            layer.zIndex = zIndex;
            layers.push(layer);
            return layer;
        },
        dateToPixelOffset(date) {
            return (date.getTime() - start.getTime()) / (60 * 60 * 1000);
        },
        getLabeller() {
            return {
                labelInterval
            };
        },
        getMaxDate() {
            return new Date(end.getTime());
        },
        getMinDate() {
            return new Date(start.getTime());
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

test("ClassicTheme enables ether date markers by default", () => {
    const { Timeline } = loadTimeline();
    const marker = Timeline.ClassicTheme.create().ether.interval.marker;

    assert.equal(marker.show, true);
    assert.equal(marker.hLength, null);
    assert.equal(marker.vLength, "2.5em");
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
    assert.deepEqual(
        labels.map(label => label.style.width),
        labels.map(() => "2.5em")
    );
});

test("marker.show false retains Gregorian highlights and interval lines", () => {
    const { DAY, Timeline } = loadTimeline();
    const theme = Timeline.ClassicTheme.create();
    theme.ether.interval.marker.show = false;
    const fixture = makePainterFixture(false, () => ({
        text: "Hidden marker",
        emphasized: false
    }));
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
    theme.ether.interval.marker.show = false;
    theme.ether.interval.line.show = false;
    const noLineFixture = makePainterFixture(false, () => ({
        text: "Hidden marker",
        emphasized: false
    }));
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
    }));
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

test("custom orientation-specific marker lengths are honoured", () => {
    const { DAY, Timeline } = loadTimeline();
    const verticalTheme = Timeline.ClassicTheme.create();
    verticalTheme.ether.interval.marker.vLength = "6rem";
    const verticalFixture = makePainterFixture(false, () => ({
        text: "Vertical",
        emphasized: true
    }));
    const verticalPainter = new Timeline.GregorianEtherPainter({
        theme: verticalTheme,
        unit: DAY
    });

    verticalPainter.initialize(verticalFixture.band, verticalFixture.timeline);
    verticalPainter.paint();

    assert.ok(dateLabels(verticalFixture.layer("ether-markers")).every(label =>
        label.style.width === "6rem"
    ));

    const horizontalTheme = Timeline.ClassicTheme.create();
    horizontalTheme.ether.interval.marker.hLength = "4em";
    const horizontalFixture = makePainterFixture(true, () => ({
        text: "Horizontal",
        emphasized: true
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

    assert.ok(dateLabels(horizontalFixture.layer("ether-markers")).every(label =>
        label.style.height === "4em"
    ));
});

test("horizontal marker sizing remains stylesheet-driven by default", () => {
    const { DAY, Timeline } = loadTimeline();
    const theme = Timeline.ClassicTheme.create();
    const fixture = makePainterFixture(true, () => ({
        text: "Horizontal",
        emphasized: true
    }));
    const painter = new Timeline.GregorianEtherPainter({
        theme,
        unit: DAY
    });

    painter.initialize(fixture.band, fixture.timeline);
    painter.paint();

    const labels = dateLabels(fixture.layer("ether-markers"));
    assert.ok(labels.length > 0);
    assert.ok(labels.every(label => !("height" in label.style)));
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
            label.style.width === "5em"
        )
    );

    const hotZoneTheme = Timeline.ClassicTheme.create();
    hotZoneTheme.ether.interval.marker.show = false;
    const hotZoneFixture = makePainterFixture(false, () => ({
        text: "Hidden hot-zone marker",
        emphasized: false
    }));
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

test("Reprise CSS no longer makes vertical marker width text-dependent", () => {
    const css = source(path.join("css", "timeline-layout.css"));
    const verticalRule = css.match(
        /\.timeline-vertical \.timeline-date-label\s*\{([^}]*)\}/
    );

    assert.ok(verticalRule);
    assert.doesNotMatch(verticalRule[1], /\bwidth\s*:\s*auto\b/);
});
