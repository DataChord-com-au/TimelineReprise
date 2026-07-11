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
        "timeline-reprise",
        "timeline-reprise-narrative.js"
    );

    vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
    return Timeline.NarrativeDecorator;
}

test("NarrativeDecorator consumes the complete theme.eventTheme shape", () => {
    const NarrativeDecorator = loadNarrativeDecorator();
    const emphasis = { strong: { color: "purple" } };
    const rangeColors = ["green", "blue"];
    const instantColors = ["purple"];
    const eventTheme = {
        id: "shared",
        spans: false,
        dividers: false,
        labels: false,
        bubbles: true,
        eventColorScope: "label",
        useEmphasis: true,
        emphasis,
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
            width: 15,
            stickyInset: 16,
            stickyGap: 17
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
        { _theme: { eventTheme } },
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
    assert.equal(decorator._labelWidth, 15);
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
    assert.equal(decorator._useEmphasis, true);
    assert.equal(decorator._emphasisSpecs, emphasis);
});

test("NarrativeDecorator does not accept separate narrative theme roots", () => {
    const NarrativeDecorator = loadNarrativeDecorator();
    const unwantedTheme = {
        labels: false,
        eventColorScope: "none",
        trackCount: 9
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
