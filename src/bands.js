import { clampBandChains } from "./clamping.js";
import { normalizeColorString } from "./color.js";
import { resolveTimelineDateTimeUnit } from "./date-time.js";
import { normalizeTimelineOrientation } from "./orientation.js";
import { resolveRepriseRuntime } from "./presentation-runtime.js";
import { UnitScaledZoneEther } from "./scaled-zones.js";
import { composeVisualTheme, validateSpecId } from "./theme-registry.js";

const _BAND_MODULE_LABEL = "TimelineReprise";
const _BAND_SET_MARKER = Symbol("TimelineReprise.BandSet");
const _nativeCreateBandInfo = globalThis.Timeline?.createBandInfo;
const _nativeCreateTimeline = globalThis.Timeline?.create;

function _bandIsObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
}

function _bandIsPlainObject(value) {
    if (!_bandIsObject(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || prototype.constructor?.name === "Object";
}

function _bandMergePlain(base, overrides) {
    const result = _bandIsPlainObject(base) ? { ...base } : {};

    for (const [key, value] of Object.entries(overrides ?? {})) {
        if (value === undefined) continue;
        result[key] = _bandIsPlainObject(value)
            ? _bandMergePlain(result[key], value)
            : value;
    }

    return result;
}

function _bandHasOwn(value, key) {
    return value != null && Object.prototype.hasOwnProperty.call(value, key);
}

function _assertPositiveNumber(value, caller) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`${caller} must be a positive finite number.`);
    }
    return value;
}

function _normalizeBandMarkerAlign(value, caller) {
    if (value == null) return null;

    const normalized = String(value).trim().toLowerCase();
    const align = {
        top: "Top",
        bottom: "Bottom",
        left: "Left",
        right: "Right"
    }[normalized];

    if (align == null) {
        throw new RangeError(
            `${caller} markerAlign must be 'Top', 'Bottom', 'Left', or 'Right'.`
        );
    }
    return align;
}

function _assertBandUnit(unit, caller) {
    const methods = [
        "parseFromObject",
        "compare",
        "makeDefaultValue",
        "cloneValue",
        "toNumber",
        "fromNumber",
        "change"
    ];

    if (!_bandIsObject(unit)) {
        throw new TypeError(`${caller} must be a timeline unit object.`);
    }

    for (const method of methods) {
        if (typeof unit[method] !== "function") {
            throw new TypeError(`${caller}.${method} must be a function.`);
        }
    }

    return unit;
}

function _isNativeDateUnit(unit) {
    return unit === globalThis.Timeline?.NativeDateUnit ||
        unit === globalThis.SimileAjax?.NativeDateUnit;
}

function _makeEventSource(unit, caller) {
    if (typeof globalThis.Timeline?.DefaultEventSource !== "function") {
        throw new TypeError(`${caller} Timeline.DefaultEventSource is not available.`);
    }
    if (typeof globalThis.SimileAjax?.EventIndex !== "function") {
        throw new TypeError(`${caller} SimileAjax.EventIndex is not available.`);
    }

    return new Timeline.DefaultEventSource(new SimileAjax.EventIndex(unit));
}

function _createNativeTheme({
    visualTheme = null,
    etherTheme = null,
    intervalLines = false,
    emphasisSpecs = null
}, caller) {
    const theme = Timeline.ClassicTheme?.create?.();
    if (!_bandIsObject(theme)) {
        throw new TypeError(`${caller} could not create a native SIMILE theme.`);
    }

    if (etherTheme != null) {
        if (!_bandIsPlainObject(etherTheme)) {
            throw new TypeError(`${caller} etherTheme must be an object.`);
        }
        if (_bandHasOwn(etherTheme?.interval?.marker, "show")) {
            throw new TypeError(
                `${caller} etherTheme.interval.marker.show is not supported; use intervalMarkers.`
            );
        }
        if (_bandHasOwn(etherTheme?.interval?.line, "show")) {
            throw new TypeError(
                `${caller} etherTheme.interval.line.show is not supported; use intervalLines.`
            );
        }
        theme.ether = _bandMergePlain(theme.ether, etherTheme);
    }

    composeVisualTheme(theme, visualTheme);
    theme.ether = _bandMergePlain(theme.ether, {
        interval: { line: { show: intervalLines } }
    });

    if (emphasisSpecs != null) {
        if (!_bandIsObject(emphasisSpecs)) {
            throw new TypeError(`${caller} emphasisSpecs must be an object.`);
        }
        theme.emphasisSpecs = emphasisSpecs;
    }

    return theme;
}

function _bandLabelText(label) {
    return _bandIsObject(label) && _bandHasOwn(label, "text")
        ? label.text
        : label;
}

function _historicalYearIntervalValues(lower, upper, interval) {
    const values = [];
    const oldestBce = Math.floor((1 - lower) / interval) * interval;

    for (let bce = oldestBce; bce >= interval; bce -= interval) {
        const coordinate = 1 - bce;
        if (coordinate >= lower && coordinate <= upper) {
            values.push(coordinate);
        }
    }

    const firstCe = Math.ceil(Math.max(1, lower) / interval) * interval;
    for (let ce = firstCe; ce <= upper; ce += interval) {
        values.push(ce);
    }

    if (lower <= 0 && upper >= 0) values.push(0);
    values.sort((left, right) => left - right);
    return values;
}

function _unitIntervalValues(unit, lower, upper, interval) {
    if (unit === globalThis.Timeline?.HistoricalYearUnit) {
        return _historicalYearIntervalValues(lower, upper, interval);
    }

    const start = Math.ceil(lower / interval) * interval;
    const end = Math.floor(upper / interval) * interval;
    const count = Math.floor((end - start) / interval) + 1;

    if (!Number.isFinite(count) || count < 0) return [];
    return Array.from(
        { length: count },
        (_, index) => start + index * interval
    );
}

class UnitEtherPainter {
    constructor({ interval, intervalMarkers, markerAlign, theme }) {
        this._interval = _assertPositiveNumber(
            interval,
            `${_BAND_MODULE_LABEL}.UnitEtherPainter interval`
        );
        this._intervalMarkers = intervalMarkers;
        this._markerAlign = markerAlign ?? null;
        this._theme = theme;
    }

    initialize(band, timeline) {
        this._band = band;
        this._timeline = timeline;
        this._backgroundLayer = band.createLayerDiv(0);
        this._backgroundLayer.setAttribute("name", "ether-background");
        this._backgroundLayer.className = "timeline-ether-bg";
        this._lineLayer = band.createLayerDiv(1);
        this._lineLayer.setAttribute("name", "ether-lines");
        this._markerLayer = band.createLayerDiv(100);
        this._markerLayer.setAttribute("name", "ether-markers");
        this._highlight = typeof Timeline.EtherHighlight === "function"
            ? new Timeline.EtherHighlight(
                timeline,
                band,
                this._theme,
                this._backgroundLayer
            )
            : null;
    }

    setHighlight(start, end) {
        this._highlight?.position(start, end);
    }

    paint() {
        this.softPaint();
    }

    softPaint() {
        const unit = this._timeline.getUnit();
        const labeller = this._band.getLabeller();
        const min = unit.toNumber(this._band.getMinDate());
        const max = unit.toNumber(this._band.getMaxDate());
        const lower = Math.min(min, max);
        const upper = Math.max(min, max);
        const maximumMarkerCount =
            Math.floor((upper - lower) / this._interval) + 2;
        if (
            !Number.isFinite(maximumMarkerCount) ||
            maximumMarkerCount < 0 ||
            maximumMarkerCount > 10000
        ) {
            throw new RangeError(
                `${_BAND_MODULE_LABEL}.UnitEtherPainter interval produces too many markers.`
            );
        }
        const values = _unitIntervalValues(
            unit,
            lower,
            upper,
            this._interval
        );
        const document = this._timeline.getDocument();
        const totalLength = this._band.getTotalViewLength();
        const horizontal = this._timeline.isHorizontal();
        const markerTheme = this._theme?.ether?.interval?.marker ?? {};
        const lineTheme = this._theme?.ether?.interval?.line ?? {};
        const showLines = lineTheme.show === true;
        const align = horizontal
            ? this._markerAlign ?? markerTheme.hAlign ?? "Bottom"
            : this._markerAlign ?? markerTheme.vAlign ?? "Right";

        this._lineLayer.innerHTML = "";
        this._markerLayer.innerHTML = "";

        if (values.length > 10000) {
            throw new RangeError(
                `${_BAND_MODULE_LABEL}.UnitEtherPainter interval produces too many markers.`
            );
        }

        for (const value of values) {
            const unitValue = unit.fromNumber(value);
            const pixel = Math.round(this._band.dateToPixelOffset(unitValue));

            if (pixel < -80 || pixel > totalLength + 80) continue;

            if (showLines) {
                const line = document.createElement("div");
                line.className = "timeline-ether-lines";

                if (horizontal) {
                    line.style.left = `${pixel}px`;
                } else {
                    line.style.top = `${pixel}px`;
                }

                if (Number.isFinite(lineTheme.opacity)) {
                    line.style.opacity = String(
                        Math.min(100, Math.max(0, lineTheme.opacity)) / 100
                    );
                }
                this._lineLayer.appendChild(line);
            }

            if (this._intervalMarkers) {
                const label = document.createElement("div");
                const renderedLabel = labeller.labelInterval(
                    unitValue,
                    this._interval
                );

                label.className = "timeline-date-label";
                if (
                    _bandIsObject(renderedLabel) &&
                    renderedLabel.emphasized === true
                ) {
                    label.className += " timeline-date-label-em";
                }
                label.textContent = String(
                    _bandLabelText(renderedLabel) ?? ""
                );

                if (horizontal) {
                    label.style.left = `${pixel}px`;
                    label.style[align === "Top" ? "top" : "bottom"] = "0px";
                } else {
                    label.style.top = `${pixel}px`;
                    label.style[align === "Left" ? "left" : "right"] = "0px";
                }

                if (typeof Timeline._layerEtherIntervalMarker === "function") {
                    Timeline._layerEtherIntervalMarker(
                        label,
                        this._markerLayer,
                        this._timeline,
                        markerTheme,
                        align
                    );
                }
                this._markerLayer.appendChild(label);
            }
        }
    }
}

function _createEventPainter(spec, theme) {
    const params = {
        showText: spec.showEventText ?? true,
        theme
    };

    if (_bandIsPlainObject(spec.eventPainterParams)) {
        Object.assign(params, spec.eventPainterParams);
    }
    if (spec.trackHeight !== undefined) params.trackHeight = spec.trackHeight;
    if (spec.trackGap !== undefined) params.trackGap = spec.trackGap;

    if (spec.eventPainter != null) {
        return typeof spec.eventPainter === "function"
            ? new spec.eventPainter(params)
            : spec.eventPainter;
    }

    const layout = spec.overview === true
        ? "overview"
        : spec.layout ?? "original";
    const Painter = layout === "overview"
        ? Timeline.OverviewEventPainter
        : layout === "detailed"
            ? Timeline.DetailedEventPainter
            : Timeline.OriginalEventPainter;

    if (typeof Painter !== "function") {
        throw new TypeError(
            `${_BAND_MODULE_LABEL}.createBand event painter is not available.`
        );
    }

    return new Painter(params);
}

function _assertProjectedValue(runtime, projected, caller) {
    if (projected == null) {
        throw new TypeError(`${caller} could not be projected by the runtime.`);
    }

    let comparison;
    try {
        comparison = runtime.unit.compare(projected, projected);
    } catch {
        comparison = NaN;
    }
    if (!Number.isFinite(comparison) || comparison !== 0) {
        throw new TypeError(`${caller} projected an invalid unit value.`);
    }

    return projected;
}

function _projectRequiredValue(runtime, value, caller) {
    return _assertProjectedValue(
        runtime,
        runtime.projectTimeValue(value),
        caller
    );
}

function _projectRange(runtime, value, caller) {
    const projected = runtime.projectTimeRange(value);
    if (!_bandIsObject(projected)) {
        throw new TypeError(`${caller} could not be projected by the runtime.`);
    }

    const hasStart = _bandHasOwn(projected, "start") &&
        projected.start != null;
    const hasEnd = _bandHasOwn(projected, "end") &&
        projected.end != null;
    if (!hasStart && !hasEnd) {
        throw new RangeError(`${caller} requires a start or end boundary.`);
    }

    let start = hasStart
        ? _assertProjectedValue(runtime, projected.start, `${caller}.start`)
        : null;
    let end = hasEnd
        ? _assertProjectedValue(runtime, projected.end, `${caller}.end`)
        : null;

    if (start != null && end != null) {
        let order;
        try {
            order = runtime.unit.compare(start, end);
        } catch {
            order = NaN;
        }
        if (!Number.isFinite(order)) {
            throw new TypeError(`${caller} projected invalid boundaries.`);
        }
        if (order > 0) {
            const swap = start;
            start = end;
            end = swap;
        }
    }

    return Object.freeze({
        ...(start == null ? {} : { start }),
        ...(end == null ? {} : { end })
    });
}

function _resolveZoneRegistry(zones, runtime, caller) {
    if (zones == null) return Object.freeze({});
    if (!Array.isArray(zones)) {
        throw new TypeError(`${caller} zones must be an array.`);
    }

    const registry = {};
    for (let index = 0; index < zones.length; index++) {
        const zone = zones[index];
        if (!_bandIsPlainObject(zone)) {
            throw new TypeError(`${caller} zones[${index}] must be an object.`);
        }
        const id = validateSpecId(
            zone.id,
            caller,
            `zones[${index}].id`
        );
        if (_bandHasOwn(registry, id)) {
            throw new RangeError(`${caller} duplicate zone id: ${id}.`);
        }

        const magnify = zone.magnify ?? 1;
        const multiple = zone.multiple ?? 1;
        _assertPositiveNumber(
            magnify,
            `${caller} zones[${index}].magnify`
        );
        _assertPositiveNumber(
            multiple,
            `${caller} zones[${index}].multiple`
        );
        const range = _projectRange(
            runtime,
            { start: zone.start, end: zone.end },
            `${caller} zones[${index}]`
        );
        if (
            !_bandHasOwn(range, "start") ||
            !_bandHasOwn(range, "end")
        ) {
            throw new RangeError(
                `${caller} zones[${index}] requires start and end boundaries.`
            );
        }

        registry[id] = Object.freeze({
            start: range.start,
            end: range.end,
            magnify,
            ...(_isNativeDateUnit(runtime.unit)
                ? {
                    unit: resolveTimelineDateTimeUnit(
                        zone.unit ?? "day",
                        `${caller} zones[${index}].unit`
                    ),
                    multiple
                }
                : {})
        });
    }

    return Object.freeze(registry);
}

function _selectZones(selection, registry, caller) {
    if (selection == null || selection === false) return [];
    if (selection === true) return Object.values(registry);

    const ids = Array.isArray(selection) ? selection : [selection];
    return ids.map((id, index) => {
        if (typeof id !== "string" || id.trim() === "") {
            throw new TypeError(
                `${caller} scaledZones[${index}] must be a non-empty string.`
            );
        }
        if (!_bandHasOwn(registry, id)) {
            throw new RangeError(`${caller} unknown scaled zone: ${id}.`);
        }
        return registry[id];
    });
}

function _resolveRuntime(spec, caller) {
    const runtime = resolveRepriseRuntime(spec.runtime ?? null, {
        unit: spec.unit,
        labeller: spec.labeller
    });

    if (spec.unit != null && runtime.unit !== spec.unit) {
        throw new TypeError(`${caller} runtime.unit must match unit.`);
    }
    if (spec.labeller != null && runtime.labeller !== spec.labeller) {
        throw new TypeError(`${caller} runtime.labeller must match labeller.`);
    }

    _assertBandUnit(runtime.unit, `${caller} runtime.unit`);
    return runtime;
}

function _nativeBandInfo(spec, runtime, eventSource, theme, zones, caller) {
    if (typeof _nativeCreateBandInfo !== "function") {
        throw new TypeError(`${caller} native Timeline.createBandInfo is not available.`);
    }

    const {
        id: _id,
        runtime: _runtime,
        unit: _unit,
        labeller: _labeller,
        visualTheme: _visualTheme,
        etherTheme: _etherTheme,
        emphasisSpecs: _emphasisSpecs,
        backgroundColor: _backgroundColor,
        scaledZones: _scaledZones,
        intervalMarkers: _intervalMarkers,
        intervalLines: _intervalLines,
        markerAlign: _markerAlign,
        interval: _interval,
        etherPainter: _etherPainter,
        ...nativeSpec
    } = spec;
    const intervalUnit = resolveTimelineDateTimeUnit(
        nativeSpec.intervalUnit,
        `${caller} intervalUnit`
    );
    const params = {
        ...nativeSpec,
        eventSource,
        intervalUnit,
        labeller: runtime.labeller,
        theme
    };
    if (spec.markerAlign != null) params.align = spec.markerAlign;

    if (_bandHasOwn(nativeSpec, "date")) {
        params.date = _projectRequiredValue(
            runtime,
            nativeSpec.date,
            `${caller} date`
        );
    }

    const bandInfo = zones.length > 0
        ? Timeline.createScaledZoneBand({ ...params, zones })
        : _nativeCreateBandInfo.call(Timeline, params);

    if (spec.etherPainter === false) {
        bandInfo.etherPainter = new Timeline.EmptyEtherPainter({
            backgroundColor: spec.backgroundColor ?? null
        });
    } else if (spec.etherPainter != null) {
        bandInfo.etherPainter = spec.etherPainter;
    }

    return bandInfo;
}

function _unitBandInfo(spec, runtime, eventSource, theme, zones, caller) {
    const interval = _assertPositiveNumber(
        spec.interval,
        `${caller} interval`
    );
    const intervalPixels = _assertPositiveNumber(
        spec.intervalPixels,
        `${caller} intervalPixels`
    );
    const centersOn = _bandHasOwn(spec, "date")
        ? _projectRequiredValue(runtime, spec.date, `${caller} date`)
        : runtime.unit.makeDefaultValue();
    const ether = spec.ether ?? (
        zones.length > 0
            ? new UnitScaledZoneEther({
                centersOn,
                interval,
                pixelsPerInterval: intervalPixels,
                zones,
                theme
            })
            : new Timeline.LinearEther({
                centersOn,
                interval,
                pixelsPerInterval: intervalPixels,
                theme
            })
    );
    const etherPainter = spec.etherPainter === false
        ? new Timeline.EmptyEtherPainter({
            backgroundColor: spec.backgroundColor ?? null
        })
        : spec.etherPainter ?? new UnitEtherPainter({
            interval,
            intervalMarkers: spec.intervalMarkers,
            markerAlign: spec.markerAlign,
            theme
        });

    return {
        width: spec.width ?? "100%",
        eventSource,
        timeZone: spec.timeZone ?? 0,
        labeller: runtime.labeller,
        unit: runtime.unit,
        ether,
        etherPainter,
        eventPainter: _createEventPainter(spec, theme),
        theme,
        decorators: spec.decorators ?? [],
        zoomIndex: spec.zoomIndex ?? 0,
        zoomSteps: spec.zoomSteps ?? null
    };
}

function createBand(spec = {}, context = {}) {
    const caller = `${_BAND_MODULE_LABEL}.createBand`;
    if (!_bandIsPlainObject(spec)) {
        throw new TypeError(`${caller} spec must be an object.`);
    }
    if (!_bandIsPlainObject(context)) {
        throw new TypeError(`${caller} context must be an object.`);
    }

    const {
        zoneRegistry = Object.freeze({}),
        ...contextDefaults
    } = context;
    const resolved = { ...contextDefaults, ...spec };
    if (
        context.runtime != null &&
        spec.runtime != null &&
        spec.runtime !== context.runtime
    ) {
        throw new TypeError(`${caller} runtime must match its band set.`);
    }
    if (context.runtime != null) resolved.runtime = context.runtime;

    const runtime = _resolveRuntime(resolved, caller);
    const intervalMarkers = resolved.intervalMarkers ?? true;
    if (typeof intervalMarkers !== "boolean") {
        throw new TypeError(`${caller} intervalMarkers must be a boolean.`);
    }
    resolved.intervalMarkers = intervalMarkers;
    const intervalLines = resolved.intervalLines ?? false;
    if (typeof intervalLines !== "boolean") {
        throw new TypeError(`${caller} intervalLines must be a boolean.`);
    }
    resolved.intervalLines = intervalLines;
    resolved.markerAlign = _normalizeBandMarkerAlign(
        resolved.markerAlign,
        caller
    );
    const eventSource = resolved.eventSource ??
        _makeEventSource(runtime.unit, caller);
    const theme = _createNativeTheme(resolved, caller);
    const zones = _selectZones(resolved.scaledZones, zoneRegistry, caller);

    const bandInfo = _isNativeDateUnit(runtime.unit)
        ? _nativeBandInfo(resolved, runtime, eventSource, theme, zones, caller)
        : _unitBandInfo(resolved, runtime, eventSource, theme, zones, caller);
    const backgroundColor = resolved.backgroundColor == null
        ? null
        : normalizeColorString(
            resolved.backgroundColor,
            `${caller} backgroundColor`
        );

    Object.defineProperties(bandInfo, {
        repriseRuntime: {
            configurable: true,
            value: runtime
        },
        repriseBandId: {
            configurable: true,
            value: resolved.id ?? null
        },
        intervalMarkers: {
            configurable: true,
            enumerable: true,
            value: intervalMarkers
        },
        intervalLines: {
            configurable: true,
            enumerable: true,
            value: intervalLines
        },
        markerAlign: {
            configurable: true,
            enumerable: true,
            value: resolved.markerAlign
        },
        repriseBackgroundColor: {
            configurable: true,
            value: backgroundColor
        }
    });

    return bandInfo;
}

function _normalizeSelections(value) {
    return value == null ? [] : Array.isArray(value) ? value : [value];
}

function _resolveBandId(id, indexById, caller) {
    if (typeof id === "string" && _bandHasOwn(indexById, id)) {
        return indexById[id];
    }
    throw new RangeError(`${caller} must refer to a band id.`);
}

function createBandSet(spec = {}) {
    const caller = `${_BAND_MODULE_LABEL}.createBandSet`;
    if (Array.isArray(spec)) spec = { bands: spec };
    if (!_bandIsPlainObject(spec)) {
        throw new TypeError(`${caller} spec must be an object.`);
    }

    const {
        bands = [],
        orientation = "horizontal",
        syncTarget = null,
        highlight = [],
        initialDate = null,
        clampRange = null,
        zones = null,
        ...bandDefaults
    } = spec;

    if (!Array.isArray(bands)) {
        throw new TypeError(`${caller} bands must be an array.`);
    }
    if (bands.length === 0) {
        throw new RangeError(`${caller} bands must contain at least one band.`);
    }
    if (_bandHasOwn(spec, "syncWith")) {
        throw new TypeError(`${caller} syncWith was replaced by syncTarget.`);
    }
    if (_bandHasOwn(spec, "eventSource")) {
        throw new TypeError(
            `${caller} eventSource is not supported; event sources belong to individual bands.`
        );
    }
    if (bands.length > 1 && syncTarget == null) {
        throw new RangeError(
            `${caller} syncTarget is required when a band set contains more than one band.`
        );
    }

    const normalizedOrientation = normalizeTimelineOrientation(
        orientation,
        `${caller} orientation`
    );
    const runtime = _resolveRuntime(bandDefaults, caller);
    const zoneRegistry = _resolveZoneRegistry(zones, runtime, caller);
    const byId = {};
    const indexById = {};
    const bandInfos = [];

    for (let index = 0; index < bands.length; index++) {
        const bandSpec = bands[index];
        if (!_bandIsPlainObject(bandSpec)) {
            throw new TypeError(`${caller} bands[${index}] must be an object.`);
        }
        if (_bandHasOwn(bandSpec, "syncWith")) {
            throw new TypeError(
                `${caller} bands[${index}].syncWith is not supported; use syncTarget.`
            );
        }
        if (_bandHasOwn(bandSpec, "highlight")) {
            throw new TypeError(
                `${caller} bands[${index}].highlight is not supported; use highlight on the band set.`
            );
        }

        const id = validateSpecId(
            bandSpec.id,
            caller,
            `bands[${index}].id`
        );
        if (_bandHasOwn(indexById, id)) {
            throw new RangeError(`${caller} duplicate band id: ${id}.`);
        }

        const bandInfo = createBand(
            { ...bandDefaults, ...bandSpec, id },
            { runtime, zoneRegistry }
        );
        bandInfos.push(bandInfo);
        byId[id] = bandInfo;
        indexById[id] = index;
    }

    const syncTargetIndex = syncTarget == null
        ? null
        : _resolveBandId(
            syncTarget,
            indexById,
            `${caller} syncTarget`
        );

    for (let index = 0; index < bandInfos.length; index++) {
        if (syncTargetIndex == null || index === syncTargetIndex) {
            delete bandInfos[index].syncWith;
        } else {
            bandInfos[index].syncWith = syncTargetIndex;
        }
    }

    const highlighted = new Set(
        _normalizeSelections(highlight).map((selection, index) =>
            _resolveBandId(
                selection,
                indexById,
                `${caller} highlight[${index}]`
            )
        )
    );
    if (highlighted.size > 0 && syncTargetIndex == null) {
        throw new RangeError(`${caller} highlight requires syncTarget.`);
    }
    if (syncTargetIndex != null && highlighted.has(syncTargetIndex)) {
        throw new RangeError(
            `${caller} highlight cannot select the syncTarget band.`
        );
    }
    for (let index = 0; index < bandInfos.length; index++) {
        bandInfos[index].highlight = highlighted.has(index);
    }

    const projectedInitialDate = initialDate == null
        ? null
        : _projectRequiredValue(runtime, initialDate, `${caller} initialDate`);
    const projectedClampRange = clampRange == null
        ? null
        : _projectRange(runtime, clampRange, `${caller} clampRange`);

    const bandSet = {
        bandInfos,
        byId,
        indexById,
        orientation: normalizedOrientation,
        syncTarget,
        runtime,
        unit: runtime.unit,
        initialDate: projectedInitialDate,
        clampRange: projectedClampRange,
        clampController: null,
        timeline: null
    };

    Object.defineProperty(bandSet, _BAND_SET_MARKER, { value: true });
    return bandSet;
}

function _applyBandPresentation(timeline, bandSet, caller) {
    for (let index = 0; index < bandSet.bandInfos.length; index++) {
        const bandInfo = bandSet.bandInfos[index];
        const bandElement = timeline.getBand(index)?._div;
        const id = bandInfo.repriseBandId;
        const backgroundColor = bandInfo.repriseBackgroundColor;

        if (
            typeof globalThis.Element === "function" &&
            !(bandElement instanceof Element)
        ) {
            throw new TypeError(
                `${caller} could not resolve the element for band index ${index}.`
            );
        }

        bandElement.classList.add(
            "timeline-reprise-band",
            `timeline-reprise-band-tone-${index % 5 + 1}`
        );
        if (id != null) {
            bandElement.classList.add(`timeline-band-${id}`);
            bandElement.dataset.timelineBandId = id;
        }
        if (backgroundColor != null) {
            bandElement.classList.add("timeline-band-has-background");
            bandElement.style.setProperty(
                "--timeline-band-background-color",
                backgroundColor
            );
        }
    }
}

function _applyInitialDate(timeline, bandSet) {
    if (bandSet.initialDate == null) return;

    for (let index = 0; index < bandSet.bandInfos.length; index++) {
        if (bandSet.bandInfos[index].syncWith == null) {
            timeline.getBand(index).setCenterVisibleDate(bandSet.initialDate);
        }
    }
}

function createTimeline(container, bandSet) {
    const caller = `${_BAND_MODULE_LABEL}.createTimeline`;
    if (!_bandIsObject(bandSet) || bandSet[_BAND_SET_MARKER] !== true) {
        throw new TypeError(`${caller} bandSet must come from createBandSet().`);
    }
    if (typeof _nativeCreateTimeline !== "function") {
        throw new TypeError(`${caller} native Timeline.create is not available.`);
    }

    const orientation = bandSet.orientation === "vertical"
        ? Timeline.VERTICAL
        : Timeline.HORIZONTAL;
    const timeline = _nativeCreateTimeline.call(
        Timeline,
        container,
        bandSet.bandInfos,
        orientation,
        bandSet.unit
    );

    _applyBandPresentation(timeline, bandSet, caller);
    _applyInitialDate(timeline, bandSet);
    bandSet.clampController = bandSet.clampRange == null
        ? null
        : clampBandChains(timeline, bandSet.clampRange);
    bandSet.timeline = timeline;

    return timeline;
}

export {
    createBand,
    createBandSet,
    createTimeline
};
