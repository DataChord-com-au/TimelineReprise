import { resolveTimelineDateTimeUnit } from "./date-time.js";
import { resolveRepriseRuntime } from "./presentation-runtime.js";

(function () {
    if (!window.Timeline || Timeline.CardinalAxis) return;

    function copyOwnProperties(source) {
        var copy = {};

        if (!source) return copy;

        for (var key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                copy[key] = source[key];
            }
        }

        return copy;
    }

    function resolveTheme(nativeTheme, markerTheme) {
        var resolvedTheme = copyOwnProperties(nativeTheme);
        var nativeEther = nativeTheme && nativeTheme.ether;
        var resolvedEther = copyOwnProperties(nativeEther);
        var nativeInterval = nativeEther && nativeEther.interval;
        var resolvedInterval = copyOwnProperties(nativeInterval);
        var nativeMarker = nativeInterval && nativeInterval.marker;
        var resolvedMarker = copyOwnProperties(nativeMarker);

        if (markerTheme) {
            for (var key in markerTheme) {
                if (
                    Object.prototype.hasOwnProperty.call(markerTheme, key) &&
                    markerTheme[key] !== undefined
                ) {
                    resolvedMarker[key] = markerTheme[key];
                }
            }
        }

        resolvedInterval.marker = resolvedMarker;
        resolvedEther.interval = resolvedInterval;
        resolvedTheme.ether = resolvedEther;

        return resolvedTheme;
    }

    Timeline.CardinalAxis = function (params) {
        this._params = params;
        this._theme = resolveTheme(params.theme, params.markerTheme);
        this._startDate = params.startDate;
        this._endDate = params.endDate ?? null;
        this._unit = params.unit;
        this._runtime = params.runtime ?? null;
        this._unitsPerCount = ("unitsPerCount" in params)
            ? params.unitsPerCount
            : 1;
        this._countsPerMarker = ("countsPerMarker" in params)
            ? params.countsPerMarker
            : 1;
        this._unitsPerMarker = this._unitsPerCount * this._countsPerMarker;
        this._anchorValue = params.anchorValue ?? 0;
        this._startLabel = params.startLabel;
        this._endLabel = params.endLabel;
        var countsPerMarker = this._countsPerMarker;
        var anchorValue = this._anchorValue;
        this._labelForIndex = params.labelForIndex || function (index) {
            return String(anchorValue + index * countsPerMarker);
        };
        this._background = params.background !== false;
        this._cssClass = params.cssClass || null;
    };

    Timeline.CardinalAxis.prototype.initialize = function (band, timeline) {
        this._band = band;
        this._timeline = timeline;
        this._valueUnit = this._runtime?.unit ?? timeline.getUnit?.() ?? null;

        this._backgroundLayer = null;
        if (this._background) {
            this._backgroundLayer = band.createLayerDiv(0);
            this._backgroundLayer.setAttribute("name", "ether-background");
            this._backgroundLayer.className = "timeline-ether-bg";
        }

        this._markerLayer = null;
        this._lineLayer = null;

        var align = ("align" in this._params)
            ? this._params.align
            : this._theme.ether.interval.marker[timeline.isHorizontal() ? "hAlign" : "vAlign"];

        var showLine = ("showLine" in this._params)
            ? this._params.showLine
            : this._theme.ether.interval.line.show;

        this._intervalMarkerLayout = new Timeline.EtherIntervalMarkerLayout(
            this._timeline,
            this._band,
            this._theme,
            align,
            showLine,
            true
        );

        this._highlight = this._backgroundLayer
            ? new Timeline.EtherHighlight(
                this._timeline,
                this._band,
                this._theme,
                this._backgroundLayer
            )
            : null;
    };

    Timeline.CardinalAxis.prototype.setHighlight = function (startDate, endDate) {
        if (this._highlight) this._highlight.position(startDate, endDate);
    };

    Timeline.CardinalAxis.prototype.paint = function () {
        if (this._markerLayer) {
            this._band.removeLayerDiv(this._markerLayer);
        }

        this._markerLayer = this._band.createLayerDiv(100);
        this._markerLayer.setAttribute("name", "ether-markers");
        this._markerLayer.style.display = "none";

        if (this._lineLayer) {
            this._band.removeLayerDiv(this._lineLayer);
        }

        this._lineLayer = this._band.createLayerDiv(1);
        this._lineLayer.setAttribute("name", "ether-lines");
        this._lineLayer.style.display = "none";

        var minDate = this._band.getMinDate();
        var maxDate = this._band.getMaxDate();
        var p = this;

        var isNativeDate = function (value) {
            return Object.prototype.toString.call(value) === "[object Date]";
        };

        var cloneValue = function (value) {
            if (typeof p._valueUnit?.cloneValue === "function") {
                return p._valueUnit.cloneValue(value);
            }
            if (isNativeDate(value)) return new Date(value.getTime());

            throw new TypeError(
                "Timeline.CardinalAxis timeline unit must provide cloneValue()."
            );
        };

        var compare = function (left, right) {
            var result = typeof p._valueUnit?.compare === "function"
                ? p._valueUnit.compare(left, right)
                : isNativeDate(left) && isNativeDate(right)
                    ? left.getTime() - right.getTime()
                    : NaN;

            if (!Number.isFinite(result)) {
                throw new TypeError(
                    "Timeline.CardinalAxis timeline unit must provide compare()."
                );
            }
            return result;
        };

        var addStep = function (value) {
            var next;

            if (isNativeDate(value)) {
                next = cloneValue(value);

                for (var i = 0; i < p._unitsPerMarker; i++) {
                    SimileAjax.DateTime.incrementByInterval(next, p._unit);
                }
            } else {
                if (typeof p._valueUnit?.change !== "function") {
                    throw new TypeError(
                        "Timeline.CardinalAxis timeline unit must provide change()."
                    );
                }
                next = p._valueUnit.change(
                    cloneValue(value),
                    p._unitsPerMarker
                );
            }

            if (compare(next, value) <= 0) {
                throw new RangeError(
                    "Timeline.CardinalAxis timeline unit change() must advance values."
                );
            }
            return next;
        };

        var makeLabeller = function (text, emphasized) {
            return {
                labelInterval: function () {
                    return {
                        text: text,
                        emphasized: !!emphasized
                    };
                }
            };
        };

        var date = cloneValue(this._startDate);
        var index = 0;

        while (compare(date, minDate) < 0) {
            date = addStep(date);
            index++;
        }

        while (compare(date, maxDate) <= 0) {
            if (this._endDate != null && compare(date, this._endDate) > 0) break;

            var isStart = compare(date, this._startDate) === 0;
            var isEnd = this._endDate != null &&
                compare(date, this._endDate) === 0;

            var text = isStart && this._startLabel != null ? this._startLabel
                : isEnd && this._endLabel != null ? this._endLabel
                : this._labelForIndex(index);

            var div = this._intervalMarkerLayout.createIntervalMarker(
                date,
                makeLabeller(text, isStart || isEnd),
                this._unit,
                this._markerLayer,
                this._lineLayer
            );

            div.style.cursor = "default";
            div.style.userSelect = "none";
            if (p._cssClass) div.className += " " + p._cssClass;

            date = addStep(date);
            index++;
        }

        if (this._endDate != null && this._endLabel != null &&
            compare(this._endDate, minDate) >= 0 &&
            compare(this._endDate, maxDate) <= 0
        ) {
            var divEnd = this._intervalMarkerLayout.createIntervalMarker(
                this._endDate,
                makeLabeller(this._endLabel, true),
                this._unit,
                this._markerLayer,
                this._lineLayer
            );

            divEnd.style.cursor = "default";
            divEnd.style.userSelect = "none";
            if (p._cssClass) divEnd.className += " " + p._cssClass;
        }

        this._markerLayer.style.display = "block";
        this._lineLayer.style.display = "block";
    };

    Timeline.CardinalAxis.prototype.softPaint = function () {
    };
}());

const _CARDINAL_ATTACHMENT_LABEL = "TimelineReprise.attachCardinalAxis";
const _CARDINAL_SPEC_FIELDS = new Set([
    "range",
    "intervalUnit",
    "unitsPerCount",
    "countsPerMarker",
    "anchorValue",
    "startLabel",
    "endLabel",
    "labelForIndex"
]);
const _CARDINAL_OPTION_FIELDS = new Set([
    "runtime",
    "theme",
    "markerTheme",
    "cssClass",
    "align",
    "showLine"
]);

function _cardinalHasOwn(value, key) {
    return value != null &&
        Object.prototype.hasOwnProperty.call(value, key);
}

function _cardinalIsObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function _cardinalAssertKnownFields(value, fields, name) {
    for (const field of Object.keys(value)) {
        if (!fields.has(field)) {
            throw new TypeError(
                `${_CARDINAL_ATTACHMENT_LABEL} ${name}.${field} is not supported.`
            );
        }
    }
}

function _cardinalBandUnit(bandInfo) {
    return bandInfo.repriseRuntime?.unit ??
        bandInfo.unit ??
        bandInfo.eventSource?._events?.getUnit?.() ??
        globalThis.Timeline?.NativeDateUnit ??
        globalThis.SimileAjax?.NativeDateUnit ??
        null;
}

function _cardinalBandLabeller(bandInfo, unit) {
    if (_cardinalIsObject(bandInfo.labeller)) return bandInfo.labeller;
    if (typeof unit?.createLabeller !== "function") return null;

    return unit.createLabeller(
        bandInfo.locale ??
            globalThis.Timeline?.getDefaultLocale?.() ??
            "en",
        bandInfo.timeZone ?? 0
    );
}

function _cardinalRuntime(bandInfo, options) {
    const unit = _cardinalBandUnit(bandInfo);

    return resolveRepriseRuntime(
        options.runtime ?? bandInfo.repriseRuntime ?? null,
        {
            unit,
            labeller: _cardinalBandLabeller(bandInfo, unit)
        }
    );
}

function _cardinalOptionalString(value, name) {
    if (value == null) return value;
    if (typeof value !== "string") {
        throw new TypeError(`${_CARDINAL_ATTACHMENT_LABEL} ${name} must be a string or null.`);
    }
    return value;
}

function attachCardinalAxis(bandInfo, spec = {}, options = {}) {
    const caller = _CARDINAL_ATTACHMENT_LABEL;

    if (!_cardinalIsObject(bandInfo)) {
        throw new TypeError(`${caller} bandInfo must be an object.`);
    }
    if (!_cardinalIsObject(bandInfo.theme)) {
        throw new TypeError(`${caller} bandInfo.theme must be an object.`);
    }
    if (!_cardinalIsObject(spec)) {
        throw new TypeError(`${caller} spec must be an object.`);
    }
    if (!_cardinalIsObject(options)) {
        throw new TypeError(`${caller} options must be an object.`);
    }
    _cardinalAssertKnownFields(spec, _CARDINAL_SPEC_FIELDS, "spec");
    _cardinalAssertKnownFields(options, _CARDINAL_OPTION_FIELDS, "options");
    if (!_cardinalHasOwn(spec, "range")) {
        throw new TypeError(`${caller} spec.range is required.`);
    }
    if (!_cardinalHasOwn(spec, "intervalUnit")) {
        throw new TypeError(`${caller} spec.intervalUnit is required.`);
    }
    if (typeof globalThis.Timeline?.CardinalAxis !== "function") {
        throw new TypeError(`${caller} Timeline.CardinalAxis is not available.`);
    }

    const runtime = _cardinalRuntime(bandInfo, options);
    const range = runtime.projectTimeRange(spec.range);

    if (!_cardinalIsObject(range) || !_cardinalHasOwn(range, "start") || range.start == null) {
        throw new RangeError(`${caller} spec.range must project to a concrete start.`);
    }

    const intervalUnit = resolveTimelineDateTimeUnit(
        spec.intervalUnit,
        `${caller} spec.intervalUnit`
    );
    const unitsPerCount = spec.unitsPerCount ?? 1;
    if (!Number.isInteger(unitsPerCount) || unitsPerCount <= 0) {
        throw new RangeError(
            `${caller} spec.unitsPerCount must be a positive integer.`
        );
    }
    const countsPerMarker = spec.countsPerMarker ?? 1;
    if (!Number.isInteger(countsPerMarker) || countsPerMarker <= 0) {
        throw new RangeError(
            `${caller} spec.countsPerMarker must be a positive integer.`
        );
    }
    const anchorValue = spec.anchorValue ?? 0;
    if (!Number.isFinite(anchorValue)) {
        throw new RangeError(
            `${caller} spec.anchorValue must be a finite number.`
        );
    }
    if (
        spec.labelForIndex != null &&
        typeof spec.labelForIndex !== "function"
    ) {
        throw new TypeError(`${caller} spec.labelForIndex must be a function.`);
    }
    if (
        options.markerTheme != null &&
        !_cardinalIsObject(options.markerTheme)
    ) {
        throw new TypeError(`${caller} options.markerTheme must be an object.`);
    }
    if (_cardinalHasOwn(options.markerTheme, "show")) {
        throw new TypeError(`${caller} options.markerTheme.show is not supported.`);
    }
    if (
        options.theme != null &&
        !_cardinalIsObject(options.theme)
    ) {
        throw new TypeError(`${caller} options.theme must be an object.`);
    }
    if (
        _cardinalHasOwn(options, "align") &&
        typeof options.align !== "string"
    ) {
        throw new TypeError(`${caller} options.align must be a string.`);
    }
    if (
        _cardinalHasOwn(options, "showLine") &&
        typeof options.showLine !== "boolean"
    ) {
        throw new TypeError(`${caller} options.showLine must be a boolean.`);
    }

    const cardinalAxis = new globalThis.Timeline.CardinalAxis({
        theme: options.theme ?? bandInfo.theme,
        markerTheme: options.markerTheme,
        runtime,
        startDate: range.start,
        endDate: _cardinalHasOwn(range, "end") ? range.end : null,
        unit: intervalUnit,
        unitsPerCount,
        countsPerMarker,
        anchorValue,
        startLabel: _cardinalOptionalString(spec.startLabel, "spec.startLabel"),
        endLabel: _cardinalOptionalString(spec.endLabel, "spec.endLabel"),
        labelForIndex: spec.labelForIndex,
        background: false,
        cssClass: _cardinalOptionalString(options.cssClass, "options.cssClass"),
        ...(_cardinalHasOwn(options, "align") ? { align: options.align } : {}),
        ...(_cardinalHasOwn(options, "showLine") ? { showLine: options.showLine } : {})
    });

    bandInfo.decorators ??= [];
    if (!Array.isArray(bandInfo.decorators)) {
        throw new TypeError(`${caller} bandInfo.decorators must be an array.`);
    }
    bandInfo.decorators.push(cardinalAxis);
}

export { attachCardinalAxis };
