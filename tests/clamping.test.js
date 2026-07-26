const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("@jest/globals");

function loadClampBandChains() {
    const filename = path.join(__dirname, "..", "src", "clamping.js");
    const source = fs.readFileSync(filename, "utf8").replace(
        /^export\s*\{\s*clampBandChains\s*\};?\s*$/m,
        ""
    );
    const context = vm.createContext({});

    vm.runInContext(
        `${source}\nglobalThis.clampBandChainsExport = clampBandChains;`,
        context,
        { filename }
    );

    return context.clampBandChainsExport;
}

function makeNumericUnit() {
    return {
        parseFromObject(value) {
            if (value == null || value === "") return null;
            const number = Number(value);
            return Number.isFinite(number) ? number : null;
        },
        compare: (left, right) => left - right,
        change: (value, delta) => value + delta,
        toNumber: value => value
    };
}

function makeNativeUnit() {
    return {
        parseFromObject(value) {
            if (value instanceof Date) return new Date(value.getTime());
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        },
        compare: (left, right) => left.getTime() - right.getTime(),
        change: (value, delta) => new Date(value.getTime() + delta),
        toNumber: value => value.getTime()
    };
}

function makeWrappedUnit() {
    function Ma(value) {
        this.value = Number(value);
    }

    return {
        Ma,
        parseFromObject(value) {
            if (value instanceof Ma) return new Ma(value.value);
            if (value && typeof value === "object" && "value" in value) {
                return new Ma(value.value);
            }
            const number = Number(value);
            return Number.isFinite(number) ? new Ma(number) : null;
        },
        compare: (left, right) => right.value - left.value,
        change: (value, delta) => new Ma(value.value - delta),
        toNumber: value => -value.value
    };
}

function makeTimeline(unit, centers, syncWith = []) {
    const timeline = {
        timeline_start: null,
        timeline_stop: null,
        shiftCalls: [],
        disposed: false,
        getBandCount() {
            return this._bands.length;
        },
        getBand(index) {
            return this._bands[index];
        },
        getUnit() {
            return unit;
        },
        shiftOK(index, delta) {
            this.shiftCalls.push({ index, delta });
            return true;
        },
        dispose() {
            this.disposed = true;
        }
    };

    const bands = centers.map((center, index) => {
        const listeners = [];
        const band = {
            _center: unit.parseFromObject(center),
            _changing: false,
            _syncWithBand: null,
            getCenterVisibleDate() {
                return this._center;
            },
            setCenterVisibleDate(value) {
                if (this._changing) return;
                const target = unit.parseFromObject(value);
                const delta = unit.toNumber(this._center) - unit.toNumber(target);
                this._moveEther(delta);
            },
            getViewLength() {
                return 100;
            },
            getEther() {
                return {
                    pixelOffsetToDate: pixel => unit.change(
                        this._center,
                        pixel - 50
                    )
                };
            },
            busy() {
                return this._changing;
            },
            addOnScrollListener(listener) {
                listeners.push(listener);
            },
            _moveEther(delta) {
                if (!timeline.shiftOK(index, delta)) return false;

                this._center = unit.change(this._center, -delta);
                this._changing = true;

                try {
                    for (const listener of listeners.slice()) listener(this);
                    if (this._syncWithBand != null) {
                        this._syncWithBand.setCenterVisibleDate(this._center);
                    }
                } finally {
                    this._changing = false;
                }

                return true;
            },
            zoom(deltas = []) {
                for (const delta of deltas) this._moveEther(delta);
            }
        };

        return band;
    });

    timeline._bands = bands;

    for (let index = 0; index < bands.length; index++) {
        const masterIndex = syncWith[index];
        if (!Number.isInteger(masterIndex)) continue;

        const follower = bands[index];
        const master = bands[masterIndex];
        follower._syncWithBand = master;
        master.addOnScrollListener(() => {
            follower.setCenterVisibleDate(master.getCenterVisibleDate());
        });
    }

    return timeline;
}

function assertUnitValue(unit, actual, expected) {
    assert.equal(unit.compare(actual, expected), 0);
}

test("large and incremental movement lands exactly on center boundaries", () => {
    const clampBandChains = loadClampBandChains();
    const unit = makeNumericUnit();
    const timeline = makeTimeline(unit, [50]);
    const band = timeline.getBand(0);

    clampBandChains(timeline, { start: 0, end: 100 });

    band.setCenterVisibleDate(-1000);
    assertUnitValue(unit, band.getCenterVisibleDate(), 0);

    band.setCenterVisibleDate(1000);
    assertUnitValue(unit, band.getCenterVisibleDate(), 100);

    band._moveEther(25);
    assertUnitValue(unit, band.getCenterVisibleDate(), 75);

    band._moveEther(100);
    assertUnitValue(unit, band.getCenterVisibleDate(), 0);
});

test("initial positions and one-sided ranges are clamped immediately", () => {
    const clampBandChains = loadClampBandChains();
    const unit = makeNumericUnit();
    const timeline = makeTimeline(unit, [-20]);
    const band = timeline.getBand(0);

    clampBandChains(timeline, { start: 0 });
    assertUnitValue(unit, band.getCenterVisibleDate(), 0);

    band.setCenterVisibleDate(500);
    assertUnitValue(unit, band.getCenterVisibleDate(), 500);
});

test("a follower crossing a boundary clamps every band-chain root", () => {
    const clampBandChains = loadClampBandChains();
    const unit = makeNumericUnit();
    const timeline = makeTimeline(unit, [50, 50, 75], [null, 0, null]);

    clampBandChains(timeline, { start: 0, end: 100 });
    timeline.getBand(1).setCenterVisibleDate(-500);

    for (let index = 0; index < timeline.getBandCount(); index++) {
        assertUnitValue(
            unit,
            timeline.getBand(index).getCenterVisibleDate(),
            0
        );
    }
});

test("native, numeric and wrapped units use their own parse and compare contracts", () => {
    const clampBandChains = loadClampBandChains();
    const nativeUnit = makeNativeUnit();
    const numericUnit = makeNumericUnit();
    const wrappedUnit = makeWrappedUnit();
    const cases = [
        {
            unit: nativeUnit,
            center: "2026-01-01T00:00:00Z",
            start: "2024-01-01T00:00:00Z",
            end: "2028-01-01T00:00:00Z",
            before: "2000-01-01T00:00:00Z",
            after: "2050-01-01T00:00:00Z"
        },
        {
            unit: numericUnit,
            center: 50,
            start: "0",
            end: "100",
            before: -500,
            after: 500
        },
        {
            unit: wrappedUnit,
            center: new wrappedUnit.Ma(150),
            start: new wrappedUnit.Ma(200),
            end: new wrappedUnit.Ma(100),
            before: new wrappedUnit.Ma(500),
            after: new wrappedUnit.Ma(0)
        }
    ];

    for (const item of cases) {
        const timeline = makeTimeline(item.unit, [item.center]);
        const band = timeline.getBand(0);
        const parsedStart = item.unit.parseFromObject(item.start);
        const parsedEnd = item.unit.parseFromObject(item.end);

        clampBandChains(timeline, {
            start: item.start,
            end: item.end
        });

        band.setCenterVisibleDate(item.before);
        assertUnitValue(item.unit, band.getCenterVisibleDate(), parsedStart);

        band.setCenterVisibleDate(item.after);
        assertUnitValue(item.unit, band.getCenterVisibleDate(), parsedEnd);
    }
});

test("zoom is evaluated after its complete movement transaction", () => {
    const clampBandChains = loadClampBandChains();
    const unit = makeNumericUnit();
    const timeline = makeTimeline(unit, [50]);
    const band = timeline.getBand(0);

    clampBandChains(timeline, { start: 0, end: 100 });

    band.zoom([200, -200]);
    assertUnitValue(unit, band.getCenterVisibleDate(), 50);

    band.zoom([200]);
    assertUnitValue(unit, band.getCenterVisibleDate(), 0);
});

test("the controller restores movement and zoom methods on disposal", () => {
    const clampBandChains = loadClampBandChains();
    const unit = makeNumericUnit();
    const timeline = makeTimeline(unit, [50]);
    const band = timeline.getBand(0);
    const originalShiftOK = timeline.shiftOK;
    const originalZoom = band.zoom;
    const originalDispose = timeline.dispose;
    const controller = clampBandChains(timeline, { start: 0, end: 100 });

    assert.notEqual(timeline.shiftOK, originalShiftOK);
    assert.notEqual(band.zoom, originalZoom);
    assert.notEqual(timeline.dispose, originalDispose);
    assert.throws(
        () => clampBandChains(timeline, { start: 0, end: 100 }),
        /already has a Reprise clamp/
    );

    controller.dispose();

    assert.equal(controller.disposed, true);
    assert.equal(timeline.shiftOK, originalShiftOK);
    assert.equal(band.zoom, originalZoom);
    assert.equal(timeline.dispose, originalDispose);

    band.setCenterVisibleDate(-100);
    assertUnitValue(unit, band.getCenterVisibleDate(), -100);
});

test("disposing the timeline automatically disposes its clamp", () => {
    const clampBandChains = loadClampBandChains();
    const timeline = makeTimeline(makeNumericUnit(), [50]);
    const controller = clampBandChains(timeline, { start: 0, end: 100 });

    timeline.dispose();

    assert.equal(timeline.disposed, true);
    assert.equal(controller.disposed, true);
});

test("native clamp fields and invalid ranges are rejected", () => {
    const clampBandChains = loadClampBandChains();
    const timeline = makeTimeline(makeNumericUnit(), [50]);

    timeline.timeline_start = 0;
    assert.throws(
        () => clampBandChains(timeline, { start: 0, end: 100 }),
        /cannot be combined/
    );

    timeline.timeline_start = null;
    assert.throws(
        () => clampBandChains(timeline, { start: 100, end: 0 }),
        /start.*must not be after/
    );
    assert.throws(
        () => clampBandChains(timeline, {}),
        /requires a start or end/
    );
    assert.throws(
        () => clampBandChains(timeline, { start: "not-a-number" }),
        /not valid for the timeline unit/
    );
});
