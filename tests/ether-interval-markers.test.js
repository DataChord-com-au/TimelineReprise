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

function markerTick(label) {
    return label.children.find(child =>
        child.className === "timeline-reprise-date-label-tick"
    );
}

test("ClassicTheme enables ether date markers by default", () => {
    const { Timeline } = loadTimeline();
    const marker = Timeline.ClassicTheme.create().ether.interval.marker;

    assert.equal(marker.show, true);
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
    nativeMarker.show = false;
    nativeMarker.hLength = "3em";
    nativeMarker.vLength = "4em";
    const markerTheme = {
        show: true,
        hLength: "6em",
        vLength: "7em"
    };
    const nativeMarkerBefore = { ...nativeMarker };
    const markerThemeBefore = { ...markerTheme };
    const verticalFixture = makePainterFixture(false, () => ({
        text: "Unused",
        emphasized: false
    }));
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
    }));
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
});
