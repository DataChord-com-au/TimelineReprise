const _CLAMP_MODULE_LABEL = "TimelineReprise.clampBandChains";
const _clampControllers = new WeakMap();

function _clampHasOwn(source, name) {
    return source != null && Object.prototype.hasOwnProperty.call(source, name);
}

function _clampIsObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
}

function _clampCompare(unit, left, right, caller) {
    const comparison = unit.compare(left, right);

    if (!Number.isFinite(comparison)) {
        throw new TypeError(`${caller} timeline unit compare() must return a finite number.`);
    }

    return comparison;
}

function _clampParseBound(unit, range, name, caller) {
    if (!_clampHasOwn(range, name) || range[name] == null) return null;

    let value;
    try {
        value = unit.parseFromObject(range[name]);
    } catch {
        value = null;
    }

    if (value == null) {
        throw new TypeError(`${caller} \`${name}\` is not valid for the timeline unit.`);
    }

    if (_clampCompare(unit, value, value, caller) !== 0) {
        throw new TypeError(`${caller} \`${name}\` is not a stable timeline unit value.`);
    }

    return value;
}

function _clampRestoreMethod(target, name, wrapper, previous, hadOwn) {
    if (target[name] !== wrapper) return;

    if (hadOwn) {
        target[name] = previous;
    } else {
        delete target[name];
    }
}

function _clampResolveBands(timeline, caller) {
    if (
        timeline == null ||
        typeof timeline.getBandCount !== "function" ||
        typeof timeline.getBand !== "function" ||
        typeof timeline.getUnit !== "function" ||
        typeof timeline.shiftOK !== "function"
    ) {
        throw new TypeError(
            `${caller} \`timeline\` must be a created Timeline instance.`
        );
    }

    const count = timeline.getBandCount();
    if (!Number.isInteger(count) || count <= 0) {
        throw new TypeError(`${caller} timeline must contain at least one band.`);
    }

    const bands = [];
    for (let index = 0; index < count; index++) {
        const band = timeline.getBand(index);

        if (
            band == null ||
            typeof band.getCenterVisibleDate !== "function" ||
            typeof band.setCenterVisibleDate !== "function" ||
            typeof band.getViewLength !== "function" ||
            typeof band.getEther !== "function"
        ) {
            throw new TypeError(`${caller} could not resolve band index ${index}.`);
        }

        const ether = band.getEther();
        if (ether == null || typeof ether.pixelOffsetToDate !== "function") {
            throw new TypeError(
                `${caller} band index ${index} must provide a Timeline ether.`
            );
        }

        bands.push(band);
    }

    return bands;
}

function _clampResolveRoots(bands, caller) {
    const bandSet = new Set(bands);
    const roots = [];
    const seenRoots = new Set();

    for (const band of bands) {
        let root = band;
        const path = new Set();

        while (root?._syncWithBand != null) {
            if (path.has(root)) {
                throw new RangeError(`${caller} band sync chain contains a cycle.`);
            }

            path.add(root);
            root = root._syncWithBand;

            if (!bandSet.has(root)) {
                throw new RangeError(
                    `${caller} band sync chain points outside the timeline.`
                );
            }
        }

        if (!seenRoots.has(root)) {
            seenRoots.add(root);
            roots.push(root);
        }
    }

    return roots;
}

function clampBandChains(timeline, range = {}) {
    const caller = _CLAMP_MODULE_LABEL;

    if (!_clampIsObject(range)) {
        throw new TypeError(`${caller} \`range\` must be an object.`);
    }
    if (_clampControllers.has(timeline)) {
        throw new RangeError(`${caller} timeline already has a Reprise clamp.`);
    }
    if (timeline?.timeline_start != null || timeline?.timeline_stop != null) {
        throw new RangeError(
            `${caller} cannot be combined with native timeline_start or timeline_stop.`
        );
    }

    const bands = _clampResolveBands(timeline, caller);
    const roots = _clampResolveRoots(bands, caller);
    const unit = timeline.getUnit();

    if (
        unit == null ||
        typeof unit.parseFromObject !== "function" ||
        typeof unit.compare !== "function"
    ) {
        throw new TypeError(
            `${caller} timeline unit must provide parseFromObject() and compare().`
        );
    }

    const start = _clampParseBound(unit, range, "start", caller);
    const end = _clampParseBound(unit, range, "end", caller);

    if (start == null && end == null) {
        throw new RangeError(`${caller} requires a start or end boundary.`);
    }
    if (start != null && end != null && _clampCompare(unit, start, end, caller) > 0) {
        throw new RangeError(`${caller} \`start\` must not be after \`end\`.`);
    }

    const hadOwnShiftOK = _clampHasOwn(timeline, "shiftOK");
    const originalShiftOK = timeline.shiftOK;
    const hadOwnDispose = _clampHasOwn(timeline, "dispose");
    const originalDispose = timeline.dispose;
    const zoomRecords = [];
    let adjustmentDepth = 0;
    let disposed = false;
    let isClamping = false;
    let shiftOKWrapper;
    let disposeWrapper;

    const anyBandBusy = () => bands.some(
        band => typeof band.busy === "function" && band.busy()
    );

    const clampAll = boundary => {
        isClamping = true;

        try {
            for (const root of roots) {
                if (
                    _clampCompare(
                        unit,
                        root.getCenterVisibleDate(),
                        boundary,
                        caller
                    ) !== 0
                ) {
                    root.setCenterVisibleDate(boundary);
                }
            }
        } finally {
            isClamping = false;
        }
    };

    const clampCurrent = () => {
        for (const band of bands) {
            const center = band.getCenterVisibleDate();

            if (start != null && _clampCompare(unit, center, start, caller) < 0) {
                clampAll(start);
                return;
            }
            if (end != null && _clampCompare(unit, center, end, caller) > 0) {
                clampAll(end);
                return;
            }
        }
    };

    shiftOKWrapper = function (bandIndex, delta) {
        if (
            disposed ||
            isClamping ||
            adjustmentDepth > 0 ||
            anyBandBusy() ||
            !Number.isFinite(delta)
        ) {
            return originalShiftOK.call(this, bandIndex, delta);
        }

        const band = bands[bandIndex];
        if (band == null) {
            return originalShiftOK.call(this, bandIndex, delta);
        }

        const candidate = band.getEther().pixelOffsetToDate(
            band.getViewLength() / 2 - delta
        );

        if (start != null && _clampCompare(unit, candidate, start, caller) < 0) {
            clampAll(start);
            return false;
        }
        if (end != null && _clampCompare(unit, candidate, end, caller) > 0) {
            clampAll(end);
            return false;
        }

        return originalShiftOK.call(this, bandIndex, delta);
    };

    timeline.shiftOK = shiftOKWrapper;

    for (const band of bands) {
        if (typeof band.zoom !== "function") continue;

        const hadOwnZoom = _clampHasOwn(band, "zoom");
        const originalZoom = band.zoom;
        const zoomWrapper = function (...args) {
            adjustmentDepth++;

            try {
                return originalZoom.apply(this, args);
            } finally {
                adjustmentDepth--;
                if (adjustmentDepth === 0 && !disposed) clampCurrent();
            }
        };

        band.zoom = zoomWrapper;
        zoomRecords.push({ band, hadOwnZoom, originalZoom, zoomWrapper });
    }

    const dispose = () => {
        if (disposed) return;
        disposed = true;

        _clampRestoreMethod(
            timeline,
            "shiftOK",
            shiftOKWrapper,
            originalShiftOK,
            hadOwnShiftOK
        );

        for (const record of zoomRecords) {
            _clampRestoreMethod(
                record.band,
                "zoom",
                record.zoomWrapper,
                record.originalZoom,
                record.hadOwnZoom
            );
        }

        if (disposeWrapper != null) {
            _clampRestoreMethod(
                timeline,
                "dispose",
                disposeWrapper,
                originalDispose,
                hadOwnDispose
            );
        }

        _clampControllers.delete(timeline);
    };

    const controller = Object.freeze({
        dispose,
        get disposed() {
            return disposed;
        }
    });

    if (typeof originalDispose === "function") {
        disposeWrapper = function (...args) {
            dispose();
            return originalDispose.apply(this, args);
        };
        timeline.dispose = disposeWrapper;
    }

    _clampControllers.set(timeline, controller);

    try {
        clampCurrent();
    } catch (error) {
        dispose();
        throw error;
    }

    return controller;
}

export { clampBandChains };
