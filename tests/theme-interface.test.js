const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadNarrativeDecorator() {
    const Timeline = { NativeDateUnit: {} };
    const context = vm.createContext({
        Timeline,
        window: { Timeline }
    });
    const filename = path.join(
        __dirname,
        "..",
        "src",
        "narrative.js"
    );

    vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
    return Timeline.NarrativeDecorator;
}

test("NarrativeDecorator consumes the complete theme.eventTheme shape", () => {
    const NarrativeDecorator = loadNarrativeDecorator();
    const emphasisSpecs = { strong: { color: "purple", lineWidth: 4 } };
    const rangeColors = ["green", "blue"];
    const instantColors = ["purple"];
    const eventTheme = {
        id: "shared",
        spans: false,
        dividers: false,
        labels: false,
        bubbles: true,
        eventColorScope: "label",
        track: {
            horizontal: {
                count: 2,
                offset: 7,
                endPadding: 8,
                size: 9,
                gap: 10,
                align: "end"
            }
        },
        range: {
            offset: 11,
            size: 12,
            colors: rangeColors,
            cssClass: "range",
            labelCssClass: "range-label"
        },
        instant: {
            width: 13,
            colors: instantColors,
            cssClass: "instant",
            labelCssClass: "instant-label"
        },
        label: {
            offset: 14,
            stickyInset: 16,
            stickyGap: 17,
            colorSource: "theme",
            color: "orange"
        },
        bubble: {
            width: 18,
            maxHeight: 19
        },
        layer: {
            zIndex: 20,
            labelZIndex: 21
        }
    };
    const decorator = new NarrativeDecorator({});

    decorator.initialize(
        { _theme: { eventTheme, emphasisSpecs } },
        { isHorizontal: () => true, isVertical: () => false }
    );

    assert.equal(decorator._trackCount, 2);
    assert.equal(decorator._trackOffset, 7);
    assert.equal(decorator._trackEndPadding, 8);
    assert.equal(decorator._trackSize, 9);
    assert.equal(decorator._trackGap, 10);
    assert.equal(decorator._trackAlign, "end");
    assert.equal(decorator._spanOffset, 11);
    assert.equal(decorator._spanSize, 12);
    assert.equal(decorator._dividerWidth, 13);
    assert.equal(decorator._labelOffset, 14);
    assert.equal(decorator._stickyInset, 16);
    assert.equal(decorator._stickyGap, 17);
    assert.equal(decorator._bubbleWidth, 18);
    assert.equal(decorator._bubbleMaxHeight, 19);
    assert.equal(decorator._zIndex, 20);
    assert.equal(decorator._labelZIndex, 21);
    assert.equal(decorator._spanColors, rangeColors);
    assert.equal(decorator._dividerColors, instantColors);
    assert.equal(decorator._spanCssClass, "range");
    assert.equal(decorator._spanLabelCssClass, "range-label");
    assert.equal(decorator._dividerCssClass, "instant");
    assert.equal(decorator._dividerLabelCssClass, "instant-label");
    assert.equal(decorator._themeCssPrefix, "timeline-narrative-shared");
    assert.equal(decorator._spans, false);
    assert.equal(decorator._dividers, false);
    assert.equal(decorator._labels, false);
    assert.equal(decorator._bubbles, true);
    assert.equal(decorator._eventColorScope, "label");
    assert.equal(decorator._disableEmphasis, false);
    assert.equal(decorator._emphasisSpecs, emphasisSpecs);
    assert.equal(decorator._labelColorMode, "theme");
    assert.equal(decorator._labelColor, "orange");
});

test("NarrativeDecorator uses a separate emphasis registry by default and honours the kill switch", () => {
    const NarrativeDecorator = loadNarrativeDecorator();
    const emphasisSpecs = { strong: { color: "purple" } };
    const item = { emphasis: "strong" };

    const enabled = new NarrativeDecorator({ emphasisSpecs });
    assert.equal(enabled._itemEmphasisSpec(item), emphasisSpecs.strong);

    const disabled = new NarrativeDecorator({
        emphasisSpecs,
        theme: { eventTheme: { disableEmphasis: true } }
    });
    assert.equal(disabled._itemEmphasisSpec(item), null);

    const themedRegistry = new NarrativeDecorator({
        theme: { eventTheme: {}, emphasisSpecs }
    });
    assert.equal(themedRegistry._itemEmphasisSpec(item), emphasisSpecs.strong);
});

test("NarrativeDecorator resolves emphasis, event scope, and label fallback in one place", () => {
    const NarrativeDecorator = loadNarrativeDecorator();
    const emphasisSpecs = { strong: { color: "purple" } };
    const decorator = new NarrativeDecorator({ emphasisSpecs });
    const item = {
        emphasis: "strong",
        color: "blue",
        eventColorScope: "none",
        spanColor: "green",
        labelColor: "black"
    };
    const record = { item, kind: "range" };

    record.graphicColor = decorator._recordGraphicColor(record, "spanColor", "red");
    assert.equal(record.graphicColor, "purple");
    assert.equal(decorator._recordLabelColor(record), "purple");

    const scoped = new NarrativeDecorator({
        theme: { eventTheme: { eventColorScope: "both" } }
    });
    const scopedRecord = { item: { color: "blue" }, kind: "range" };
    scopedRecord.graphicColor = scoped._recordGraphicColor(scopedRecord, "spanColor", "red");
    assert.equal(scopedRecord.graphicColor, "blue");
    assert.equal(scoped._recordLabelColor(scopedRecord), "blue");

    const derived = new NarrativeDecorator({});
    const derivedRecord = { item: {}, kind: "range", graphicColor: "rgb(220, 38, 38)" };
    assert.match(derived._recordLabelColor(derivedRecord), /^light-dark\(hsl\(0,/);

    const themed = new NarrativeDecorator({
        theme: { eventTheme: { label: { colorSource: "theme", color: "orange" } } }
    });
    assert.equal(themed._recordLabelColor({ item: {}, kind: "range", graphicColor: "red" }), "orange");

    const inherited = new NarrativeDecorator({
        theme: { eventTheme: { label: { colorSource: "inherit" } } }
    });
    assert.equal(inherited._recordLabelColor({ item: {}, kind: "range", graphicColor: "red" }), null);

    const direct = new NarrativeDecorator({
        label: { colorSource: "theme", color: "green" }
    });
    assert.equal(direct._recordLabelColor({ item: {}, kind: "range", graphicColor: "red" }), "green");
});

test("NarrativeDecorator does not accept separate narrative theme roots", () => {
    const NarrativeDecorator = loadNarrativeDecorator();
    const unwantedTheme = {
        labels: false,
        eventColorScope: "none",
        track: { horizontal: { count: 9 } }
    };
    const cases = [
        { narrativeTheme: unwantedTheme },
        { theme: { narrativeTheme: unwantedTheme } },
        { theme: { narrative: unwantedTheme } }
    ];

    for (const params of cases) {
        const decorator = new NarrativeDecorator(params);
        assert.equal(decorator._labels, true);
        assert.equal(decorator._eventColorScope, "both");
        assert.equal(decorator._trackCount, 1);
    }
});

test("NarrativeDecorator supports the shared eventColorScope values", () => {
    const NarrativeDecorator = loadNarrativeDecorator();

    for (const eventColorScope of ["none", "label", "graphic", "both"]) {
        const decorator = new NarrativeDecorator({
            theme: { eventTheme: { eventColorScope } }
        });
        assert.equal(decorator._eventColorScope, eventColorScope);
    }
});
