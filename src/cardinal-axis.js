import { resolveTimelineDateTimeUnit } from "./date-time.js";
import { resolveRepriseRuntime } from "./presentation-runtime.js";
import {
    normalizeMarkerLength,
    resolveMarkerPresentationTheme
} from "./marker-presentation.js";

(function () {
    if (!window.Timeline || Timeline.CardinalAxis) return;

    var UNLABELED_MARKER_TEXT = "\u2003";

    function hasOwn(value, key) {
        return value != null &&
            Object.prototype.hasOwnProperty.call(value, key);
    }

    function resolveBoolean(params, key, fallback) {
        var value = hasOwn(params, key) ? params[key] : fallback;
        if (typeof value !== "boolean") {
            throw new TypeError(
                "Timeline.CardinalAxis " + key + " must be a boolean."
            );
        }
        return value;
    }

    function resolveLabelEvery(params) {
        var hasLabelEvery = hasOwn(params, "labelEvery");

        var value = hasLabelEvery
            ? params.labelEvery
            : 1;

        if (!Number.isInteger(value) || value <= 0) {
            throw new RangeError(
                "Timeline.CardinalAxis labelEvery must be a positive integer."
            );
        }

        return value;
    }

    function showsGeneratedLabel(markerIndex, labelEvery) {
        if (labelEvery === 1) return true;
        if (!Number.isInteger(markerIndex)) return false;
        return markerIndex % labelEvery === 0;
    }

    function resolvePositiveFinite(params, key, fallback) {
        var value = hasOwn(params, key) ? params[key] : fallback;
        if (!Number.isFinite(value) || value <= 0) {
            throw new RangeError(
                "Timeline.CardinalAxis " + key + " must be a positive finite number."
            );
        }
        return value;
    }

    function decimalPlaces(value) {
        var parts = Math.abs(value).toString().toLowerCase().split("e");
        var fraction = (parts[0].split(".")[1] || "").length;
        var exponent = parts.length > 1 ? Number(parts[1]) : 0;

        return Math.max(0, fraction - exponent);
    }

    function shiftDecimal(value, places) {
        var parts = value.toString().toLowerCase().split("e");
        var exponent = parts.length > 1 ? Number(parts[1]) : 0;

        return Number(parts[0] + "e" + (exponent + places));
    }

    function roundToDecimalPlaces(value, places) {
        var shifted = shiftDecimal(value, places);
        if (!Number.isFinite(shifted)) return value;

        var rounded = shiftDecimal(Math.round(shifted), -places);
        return Object.is(rounded, -0) ? 0 : rounded;
    }

    function isEffectivelyInteger(value) {
        return Math.abs(value - Math.round(value)) <=
            Number.EPSILON * Math.max(1, Math.abs(value)) * 8;
    }

    Timeline.CardinalAxis = function (params) {
        this._params = params;
        this._nativeTheme = params.theme;
        this._markerLength = params.markerLength;
        this._theme = params.theme;
        this._startDate = params.startDate;
        this._endDate = params.endDate ?? null;
        this._unit = params.unit;
        this._runtime = params.runtime ?? null;
        this._unitsPerCount = resolvePositiveFinite(
            params,
            "unitsPerCount",
            1
        );
        this._countsPerMarker = resolvePositiveFinite(
            params,
            "countsPerMarker",
            1
        );
        var unitsPerMarker = this._unitsPerCount * this._countsPerMarker;
        if (!Number.isFinite(unitsPerMarker) || unitsPerMarker <= 0) {
            throw new RangeError(
                "Timeline.CardinalAxis unitsPerCount * countsPerMarker must be a positive finite number."
            );
        }
        this._unitsPerMarker = roundToDecimalPlaces(
            unitsPerMarker,
            decimalPlaces(this._unitsPerCount) +
                decimalPlaces(this._countsPerMarker)
        );
        this._anchorValue = params.anchorValue ?? 0;
        this._markerAtIndex = params.markerAtIndex ?? null;
        this._indexAtValue = params.indexAtValue ?? null;
        if (
            this._markerAtIndex != null &&
            typeof this._markerAtIndex !== "function"
        ) {
            throw new TypeError(
                "Timeline.CardinalAxis markerAtIndex must be a function."
            );
        }
        if (
            this._indexAtValue != null &&
            typeof this._indexAtValue !== "function"
        ) {
            throw new TypeError(
                "Timeline.CardinalAxis indexAtValue must be a function."
            );
        }
        this._anchor = params.anchor ?? "start";
        if (this._anchor !== "start" && this._anchor !== "end") {
            throw new RangeError(
                "Timeline.CardinalAxis anchor must be 'start' or 'end'."
            );
        }
        this._finishing = params.finishing ?? "drop";
        if (
            this._finishing !== "drop" &&
            this._finishing !== "truncate" &&
            this._finishing !== "extend"
        ) {
            throw new RangeError(
                "Timeline.CardinalAxis finishing must be 'drop', 'truncate', or 'extend'."
            );
        }
        if (this._anchor === "end" && this._endDate == null) {
            throw new RangeError(
                "Timeline.CardinalAxis anchor 'end' requires endDate."
            );
        }
        this._truncatePreviousMarkerThreshold =
            params.truncatePreviousMarkerThreshold ?? 0.4;
        if (
            !Number.isFinite(this._truncatePreviousMarkerThreshold) ||
            this._truncatePreviousMarkerThreshold < 0 ||
            this._truncatePreviousMarkerThreshold > 1
        ) {
            throw new RangeError(
                "Timeline.CardinalAxis truncatePreviousMarkerThreshold must be a finite number from 0 to 1."
            );
        }
        this._startLabel = params.startLabel;
        this._endLabel = params.endLabel;
        this._showLabels = resolveBoolean(params, "showLabels", true);
        this._showTicks = resolveBoolean(params, "showTicks", true);
        this._labelEvery = resolveLabelEvery(params);
        this._unlabeledMarkerText = hasOwn(params, "unlabeledMarkerText")
            ? params.unlabeledMarkerText
            : UNLABELED_MARKER_TEXT;
        if (typeof this._unlabeledMarkerText !== "string") {
            throw new TypeError(
                "Timeline.CardinalAxis unlabeledMarkerText must be a string."
            );
        }
        var countsPerMarker = this._countsPerMarker;
        var anchorValue = this._anchorValue;
        var labelEvery = this._labelEvery;
        var unlabeledMarkerText = this._unlabeledMarkerText;
        var indexPrecision = Math.max(
            decimalPlaces(anchorValue),
            decimalPlaces(countsPerMarker)
        );
        var labelForIndex = params.labelForIndex || function (index) {
            return String(index);
        };
        this._labelForMarkerIndex = function (markerIndex) {
            var precision = indexPrecision +
                (Number.isInteger(markerIndex) ? 0 : 1);
            var index = roundToDecimalPlaces(
                anchorValue + markerIndex * countsPerMarker,
                precision
            );

            return showsGeneratedLabel(markerIndex, labelEvery)
                ? labelForIndex(index)
                : unlabeledMarkerText;
        };
        this._background = params.background !== false;
        this._cssClass = params.cssClass || null;
    };

    Timeline.CardinalAxis.prototype.initialize = function (band, timeline) {
        this._band = band;
        this._timeline = timeline;
        this._valueUnit = this._runtime?.unit ?? timeline.getUnit?.() ?? null;
        this._theme = resolveMarkerPresentationTheme(
            this._nativeTheme,
            timeline.isHorizontal() ? "horizontal" : "vertical",
            this._markerLength
        );

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
            : timeline.isHorizontal() ? "Bottom" : "Right";

        var showLine = ("showLine" in this._params)
            ? this._params.showLine
            : this._theme.ether.interval.line.show;

        this._intervalMarkerLayout = new Timeline.EtherIntervalMarkerLayout(
            this._timeline,
            this._band,
            this._theme,
            align,
            showLine,
            {
                showMarkers: this._showLabels || this._showTicks,
                showTicks: this._showTicks
            }
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

        var changeDateByInterval = function (date, direction) {
            var dateTime = globalThis.SimileAjax?.DateTime;

            switch (p._unit) {
            case dateTime?.MILLISECOND:
                date.setTime(date.getTime() + direction);
                break;
            case dateTime?.SECOND:
                date.setTime(date.getTime() + direction * 1000);
                break;
            case dateTime?.MINUTE:
                date.setTime(date.getTime() + direction * 60 * 1000);
                break;
            case dateTime?.HOUR:
                date.setTime(date.getTime() + direction * 60 * 60 * 1000);
                break;
            case dateTime?.DAY:
                date.setUTCDate(date.getUTCDate() + direction);
                break;
            case dateTime?.WEEK:
                date.setUTCDate(date.getUTCDate() + direction * 7);
                break;
            case dateTime?.MONTH:
                date.setUTCMonth(date.getUTCMonth() + direction);
                break;
            case dateTime?.YEAR:
                date.setUTCFullYear(date.getUTCFullYear() + direction);
                break;
            case dateTime?.DECADE:
                date.setUTCFullYear(date.getUTCFullYear() + direction * 10);
                break;
            case dateTime?.CENTURY:
                date.setUTCFullYear(date.getUTCFullYear() + direction * 100);
                break;
            case dateTime?.MILLENNIUM:
                date.setUTCFullYear(date.getUTCFullYear() + direction * 1000);
                break;
            default:
                if (
                    direction > 0 &&
                    typeof globalThis.SimileAjax?.DateTime?.incrementByInterval === "function"
                ) {
                    globalThis.SimileAjax.DateTime.incrementByInterval(
                        date,
                        p._unit
                    );
                    break;
                }
                throw new TypeError(
                    "Timeline.CardinalAxis date interval unit is not supported."
                );
            }
        };

        var addStep = function (value, direction) {
            var next;

            if (isNativeDate(value)) {
                next = cloneValue(value);

                if (!isEffectivelyInteger(p._unitsPerMarker)) {
                    throw new RangeError(
                        "Timeline.CardinalAxis fractional native-date marker intervals require markerAtIndex()."
                    );
                }

                var nativeUnitsPerMarker = Math.round(p._unitsPerMarker);
                for (var i = 0; i < nativeUnitsPerMarker; i++) {
                    if (
                        direction > 0 &&
                        typeof globalThis.SimileAjax?.DateTime?.incrementByInterval === "function"
                    ) {
                        globalThis.SimileAjax.DateTime.incrementByInterval(
                            next,
                            p._unit
                        );
                    } else {
                        changeDateByInterval(next, direction);
                    }
                }
            } else {
                if (typeof p._valueUnit?.change !== "function") {
                    throw new TypeError(
                        "Timeline.CardinalAxis timeline unit must provide change()."
                    );
                }
                next = p._valueUnit.change(
                    cloneValue(value),
                    direction * p._unitsPerMarker
                );
            }

            if (
                direction > 0
                    ? compare(next, value) <= 0
                    : compare(next, value) >= 0
            ) {
                throw new RangeError(
                    "Timeline.CardinalAxis timeline unit change() must move values in the marker direction."
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

        var direction = this._anchor === "end" ? -1 : 1;
        var anchorDate = this._anchor === "end"
            ? this._endDate
            : this._startDate;
        var oppositeDate = this._anchor === "end"
            ? this._startDate
            : this._endDate;
        var markers = [];

        var isPastOpposite = function (date) {
            if (oppositeDate == null) return false;
            return direction > 0
                ? compare(date, oppositeDate) > 0
                : compare(date, oppositeDate) < 0;
        };

        var isBeforeViewport = function (date) {
            return direction > 0
                ? compare(date, minDate) < 0
                : compare(date, maxDate) > 0;
        };

        var isPastViewport = function (date) {
            return direction > 0
                ? compare(date, maxDate) > 0
                : compare(date, minDate) < 0;
        };

        var addMarker = function (date, index) {
            if (compare(date, minDate) < 0 || compare(date, maxDate) > 0) return;
            if (markers.some(marker => compare(marker.date, date) === 0)) return;

            markers.push({
                date: cloneValue(date),
                index
            });
        };

        var removeMarker = function (date) {
            var markerIndex = markers.findIndex(marker =>
                compare(marker.date, date) === 0
            );

            if (markerIndex >= 0) markers.splice(markerIndex, 1);
        };

        var projectedRatio = function (start, end, value) {
            if (typeof p._band?.dateToPixelOffset !== "function") return null;

            var startPixel = Number(p._band.dateToPixelOffset(start));
            var endPixel = Number(p._band.dateToPixelOffset(end));
            var valuePixel = Number(p._band.dateToPixelOffset(value));
            var span = endPixel - startPixel;

            if (
                !Number.isFinite(startPixel) ||
                !Number.isFinite(endPixel) ||
                !Number.isFinite(valuePixel) ||
                Math.abs(span) < 1e-9
            ) {
                return null;
            }

            return (valuePixel - startPixel) / span;
        };

        var truncatedIndexInfo = function (previousDate, pastDate, pastIndex) {
            if (previousDate == null) {
                return {
                    index: pastIndex,
                    ratio: null,
                    previousIndex: pastIndex - 1
                };
            }

            if (typeof p._indexAtValue === "function") {
                var semanticIndex = p._indexAtValue(
                    oppositeDate,
                    Object.freeze({
                        previousMarker: cloneValue(previousDate),
                        nextMarker: cloneValue(pastDate),
                        previousIndex: pastIndex - 1,
                        nextIndex: pastIndex,
                        anchor: p._anchor,
                        finishing: p._finishing
                    })
                );

                if (semanticIndex != null) {
                    if (!Number.isFinite(semanticIndex) || semanticIndex < 0) {
                        throw new TypeError(
                            "Timeline.CardinalAxis indexAtValue() must return a non-negative finite number or null."
                        );
                    }
                    return {
                        index: semanticIndex,
                        ratio: semanticIndex - (pastIndex - 1),
                        previousIndex: pastIndex - 1
                    };
                }
            }

            var ratio = projectedRatio(previousDate, pastDate, oppositeDate);
            if (!Number.isFinite(ratio)) {
                return {
                    index: pastIndex,
                    ratio: null,
                    previousIndex: pastIndex - 1
                };
            }

            var clampedRatio = Math.max(0, Math.min(1, ratio));
            return {
                index: pastIndex - 1 + clampedRatio,
                ratio: clampedRatio,
                previousIndex: pastIndex - 1
            };
        };

        var usesProjectedMarkers = typeof this._markerAtIndex === "function";
        var projectedMarkerAtIndex = function (markerIndex) {
            var value = p._markerAtIndex(markerIndex);
            return value == null ? null : cloneValue(value);
        };
        var nextMarker = function (current, markerIndex) {
            if (!usesProjectedMarkers) return addStep(current, direction);

            var next = projectedMarkerAtIndex(markerIndex);
            if (next == null) return null;
            if (
                direction > 0
                    ? compare(next, current) <= 0
                    : compare(next, current) >= 0
            ) {
                throw new RangeError(
                    "Timeline.CardinalAxis markerAtIndex() must move values in the marker direction."
                );
            }
            return next;
        };

        var date = usesProjectedMarkers
            ? projectedMarkerAtIndex(0)
            : cloneValue(anchorDate);
        var index = 0;

        if (date == null) {
            throw new RangeError(
                "Timeline.CardinalAxis markerAtIndex(0) must return the projected anchor value."
            );
        }
        if (compare(date, anchorDate) !== 0) {
            throw new RangeError(
                "Timeline.CardinalAxis markerAtIndex(0) must match the projected anchor boundary."
            );
        }

        var previousDate = null;

        while (true) {
            if (isPastOpposite(date)) {
                if (this._finishing === "truncate" && oppositeDate != null) {
                    var truncated = truncatedIndexInfo(
                        previousDate,
                        date,
                        index
                    );
                    addMarker(
                        oppositeDate,
                        truncated.index
                    );
                    if (
                        previousDate != null &&
                        truncated.previousIndex > 0 &&
                        truncated.ratio != null &&
                        truncated.ratio < this._truncatePreviousMarkerThreshold
                    ) {
                        removeMarker(previousDate);
                    }
                } else if (this._finishing === "extend") {
                    addMarker(date, index);
                }
                break;
            }

            if (!isBeforeViewport(date)) addMarker(date, index);
            if (isPastViewport(date)) break;
            if (oppositeDate != null && compare(date, oppositeDate) === 0) break;

            previousDate = date;
            index++;
            date = nextMarker(date, index);
            if (date == null) break;
        }

        markers.sort((left, right) => compare(left.date, right.date));

        for (var marker of markers) {
            var markerDate = marker.date;
            var isStart = compare(markerDate, this._startDate) === 0;
            var isEnd = this._endDate != null &&
                compare(markerDate, this._endDate) === 0;

            var text = "";
            if (this._showLabels) {
                text = isStart && this._startLabel != null ? this._startLabel
                    : isEnd && this._endLabel != null ? this._endLabel
                    : this._labelForMarkerIndex(marker.index);
            }

            var div = this._intervalMarkerLayout.createIntervalMarker(
                markerDate,
                makeLabeller(text, isStart || isEnd),
                this._unit,
                this._markerLayer,
                this._lineLayer
            );

            div.style.cursor = "default";
            div.style.userSelect = "none";
            if (p._cssClass) div.className += " " + p._cssClass;
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
    "anchor",
    "finishing",
    "truncatePreviousMarkerThreshold",
    "startLabel",
    "endLabel",
    "labelForIndex",
    "labelEvery"
]);
const _CARDINAL_OPTION_FIELDS = new Set([
    "runtime",
    "theme",
    "markerLength",
    "cssClass",
    "align",
    "showLine",
    "showLabels",
    "showTicks",
    "unlabeledMarkerText"
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

function _cardinalRequiredString(value, name) {
    if (typeof value !== "string") {
        throw new TypeError(`${_CARDINAL_ATTACHMENT_LABEL} ${name} must be a string.`);
    }
    return value;
}

function _cardinalPositiveInteger(value, name) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new RangeError(
            `${_CARDINAL_ATTACHMENT_LABEL} ${name} must be a positive integer.`
        );
    }
    return value;
}

function _cardinalPositiveFinite(value, name) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(
            `${_CARDINAL_ATTACHMENT_LABEL} ${name} must be a positive finite number.`
        );
    }
    return value;
}

function _cardinalProjectAxis(runtime, context, caller) {
    if (typeof runtime.projectCardinalAxis === "function") {
        const projection = runtime.projectCardinalAxis(Object.freeze({ ...context }));

        if (!_cardinalIsObject(projection)) {
            throw new RangeError(
                `${caller} runtime.projectCardinalAxis() must return a projection object.`
            );
        }
        if (typeof projection.markerAtIndex !== "function") {
            throw new TypeError(
                `${caller} runtime.projectCardinalAxis().markerAtIndex must be a function.`
            );
        }
        if (
            _cardinalHasOwn(projection, "indexAtValue") &&
            projection.indexAtValue != null &&
            typeof projection.indexAtValue !== "function"
        ) {
            throw new TypeError(
                `${caller} runtime.projectCardinalAxis().indexAtValue must be a function or null.`
            );
        }

        return {
            range: projection.range,
            markerAtIndex: projection.markerAtIndex,
            indexAtValue: projection.indexAtValue ?? null
        };
    }

    return {
        range: runtime.projectTimeRange(context.range),
        markerAtIndex: null,
        indexAtValue: null
    };
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

    const intervalUnit = resolveTimelineDateTimeUnit(
        spec.intervalUnit,
        `${caller} spec.intervalUnit`
    );
    const unitsPerCount = spec.unitsPerCount ?? 1;
    _cardinalPositiveFinite(unitsPerCount, "spec.unitsPerCount");
    const countsPerMarker = spec.countsPerMarker ?? 1;
    _cardinalPositiveFinite(countsPerMarker, "spec.countsPerMarker");
    const unitsPerMarker = unitsPerCount * countsPerMarker;
    if (!Number.isFinite(unitsPerMarker) || unitsPerMarker <= 0) {
        throw new RangeError(
            `${caller} spec.unitsPerCount * spec.countsPerMarker must be a positive finite number.`
        );
    }
    const anchorValue = spec.anchorValue ?? 0;
    if (!Number.isFinite(anchorValue)) {
        throw new RangeError(
            `${caller} spec.anchorValue must be a finite number.`
        );
    }
    const anchor = spec.anchor ?? "start";
    if (anchor !== "start" && anchor !== "end") {
        throw new RangeError(
            `${caller} spec.anchor must be 'start' or 'end'.`
        );
    }
    const finishing = spec.finishing ?? "drop";
    if (
        finishing !== "drop" &&
        finishing !== "truncate" &&
        finishing !== "extend"
    ) {
        throw new RangeError(
            `${caller} spec.finishing must be 'drop', 'truncate', or 'extend'.`
        );
    }
    const truncatePreviousMarkerThreshold =
        spec.truncatePreviousMarkerThreshold ?? 0.4;
    if (
        !Number.isFinite(truncatePreviousMarkerThreshold) ||
        truncatePreviousMarkerThreshold < 0 ||
        truncatePreviousMarkerThreshold > 1
    ) {
        throw new RangeError(
            `${caller} spec.truncatePreviousMarkerThreshold must be a finite number from 0 to 1.`
        );
    }
    if (
        spec.labelForIndex != null &&
        typeof spec.labelForIndex !== "function"
    ) {
        throw new TypeError(`${caller} spec.labelForIndex must be a function.`);
    }
    const labelEvery = _cardinalHasOwn(spec, "labelEvery")
        ? _cardinalPositiveInteger(spec.labelEvery, "spec.labelEvery")
        : 1;
    const markerLength = normalizeMarkerLength(
        _cardinalHasOwn(options, "markerLength")
            ? options.markerLength
            : bandInfo.markerLength,
        `${caller} options`
    );
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
    if (
        _cardinalHasOwn(options, "showLabels") &&
        typeof options.showLabels !== "boolean"
    ) {
        throw new TypeError(`${caller} options.showLabels must be a boolean.`);
    }
    if (
        _cardinalHasOwn(options, "showTicks") &&
        typeof options.showTicks !== "boolean"
    ) {
        throw new TypeError(`${caller} options.showTicks must be a boolean.`);
    }
    if (_cardinalHasOwn(options, "unlabeledMarkerText")) {
        _cardinalRequiredString(
            options.unlabeledMarkerText,
            "options.unlabeledMarkerText"
        );
    }

    const runtime = _cardinalRuntime(bandInfo, options);
    const projection = _cardinalProjectAxis(runtime, {
        range: spec.range,
        intervalUnit: spec.intervalUnit,
        resolvedIntervalUnit: intervalUnit,
        unitsPerCount,
        countsPerMarker,
        anchor,
        finishing,
        truncatePreviousMarkerThreshold
    }, caller);
    const range = projection.range;

    if (!_cardinalIsObject(range) || !_cardinalHasOwn(range, "start") || range.start == null) {
        throw new RangeError(`${caller} spec.range must project to a concrete start.`);
    }
    if (anchor === "end" && (!_cardinalHasOwn(range, "end") || range.end == null)) {
        throw new RangeError(
            `${caller} spec.range must project to a concrete end when spec.anchor is 'end'.`
        );
    }

    const cardinalAxis = new globalThis.Timeline.CardinalAxis({
        theme: options.theme ?? bandInfo.theme,
        markerLength,
        runtime,
        startDate: range.start,
        endDate: _cardinalHasOwn(range, "end") ? range.end : null,
        unit: intervalUnit,
        unitsPerCount,
        countsPerMarker,
        anchorValue,
        anchor,
        finishing,
        truncatePreviousMarkerThreshold,
        markerAtIndex: projection.markerAtIndex,
        indexAtValue: projection.indexAtValue,
        startLabel: _cardinalOptionalString(spec.startLabel, "spec.startLabel"),
        endLabel: _cardinalOptionalString(spec.endLabel, "spec.endLabel"),
        labelForIndex: spec.labelForIndex,
        labelEvery,
        background: false,
        cssClass: _cardinalOptionalString(options.cssClass, "options.cssClass"),
        ...(_cardinalHasOwn(options, "align")
            ? { align: options.align }
            : bandInfo.markerAlign != null
                ? { align: bandInfo.markerAlign }
                : {}),
        ...(_cardinalHasOwn(options, "showLine")
            ? { showLine: options.showLine }
            : {}),
        ...(_cardinalHasOwn(options, "showLabels")
            ? { showLabels: options.showLabels }
            : {}),
        ...(_cardinalHasOwn(options, "showTicks")
            ? { showTicks: options.showTicks }
            : {}),
        ...(_cardinalHasOwn(options, "unlabeledMarkerText")
            ? { unlabeledMarkerText: options.unlabeledMarkerText }
            : {})
    });

    bandInfo.decorators ??= [];
    if (!Array.isArray(bandInfo.decorators)) {
        throw new TypeError(`${caller} bandInfo.decorators must be an array.`);
    }
    bandInfo.decorators.push(cardinalAxis);
}

export { attachCardinalAxis };
