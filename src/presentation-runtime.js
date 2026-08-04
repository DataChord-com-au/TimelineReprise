import { defaultVisualTheme } from "./visual-theme.js";
import { TemplateRenderer } from "./template-renderer.js";
import { resolveDisplayProfile } from "./theme-registry.js";

const _RUNTIME_LABEL = "TimelineReprise.RepriseRuntime";
const _RENDER_TARGETS = new Set(["text", "html"]);
const _UNBOUNDED_ENDPOINTS = new Set(["open", "unresolved"]);
const _DURATION_PRECISIONS = new Set([
    "day",
    "hour",
    "minute",
    "second",
    "millisecond"
]);

function _runtimeIsObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
}

function _hasOwn(source, name) {
    return source != null && Object.prototype.hasOwnProperty.call(source, name);
}

function _readDirectField(event, field) {
    if (event == null) return { found: false, value: undefined };

    if (_hasOwn(event, field)) {
        return { found: true, value: event[field] };
    }

    if (typeof event.getProperty === "function") {
        const value = event.getProperty(field);
        if (value !== undefined && value !== null) {
            return { found: true, value };
        }
    }

    return { found: false, value: undefined };
}

function _readEventField(event, field) {
    const direct = _readDirectField(event, field);
    if (direct.found) return direct;

    const source = _readDirectField(event, "event");
    return source.found && source.value !== event
        ? _readDirectField(source.value, field)
        : direct;
}

function _readMethod(event, name) {
    if (typeof event?.[name] === "function") {
        return { found: true, value: event[name]() };
    }

    const source = _readDirectField(event, "event");
    if (source.found && typeof source.value?.[name] === "function") {
        return { found: true, value: source.value[name]() };
    }

    return { found: false, value: undefined };
}

function _parseUnitValue(unit, value) {
    if (value === undefined || value === null || value === "") return null;

    let parsed;
    try {
        parsed = unit.parseFromObject(value);
    } catch {
        return null;
    }
    if (parsed === undefined || parsed === null) return null;

    let reflexive;
    try {
        reflexive = unit.compare(parsed, parsed);
    } catch {
        return null;
    }

    return Number.isFinite(reflexive) && reflexive === 0 ? parsed : null;
}

function _defaultProjectTimeValue(value) {
    return _parseUnitValue(this.unit, value);
}

function _defaultProjectTimeRange(value) {
    if (!_runtimeIsObject(value)) return null;

    const hasStart = _hasOwn(value, "start");
    const hasEnd = _hasOwn(value, "end");
    if (!hasStart && !hasEnd) return null;

    let start = hasStart ? this.projectTimeValue(value.start) : null;
    let end = hasEnd ? this.projectTimeValue(value.end) : null;
    if ((hasStart && start == null) || (hasEnd && end == null)) return null;

    if (start != null && end != null) {
        const order = this.unit.compare(start, end);
        if (!Number.isFinite(order)) return null;
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

function _defaultReadCurrentTime() {
    const nativeUnits = new Set([
        globalThis.Timeline?.NativeDateUnit,
        globalThis.SimileAjax?.NativeDateUnit
    ]);
    if (!nativeUnits.has(this.unit)) return null;

    return new Date();
}

function _readAuxiliaryEndpoint(unit, sources, field, method) {
    for (const source of sources) {
        const direct = _readDirectField(source, field);
        if (direct.found) return _parseUnitValue(unit, direct.value);

        const resolved = _readMethod(source, method);
        if (resolved.found) return _parseUnitValue(unit, resolved.value);
    }

    return null;
}

function _canonicalAuxiliaryEndpoints(unit, sources) {
    const latestStart = _readAuxiliaryEndpoint(
        unit,
        sources,
        "latestStart",
        "getLatestStart"
    );
    const earliestEnd = _readAuxiliaryEndpoint(
        unit,
        sources,
        "earliestEnd",
        "getEarliestEnd"
    );

    return {
        ...(latestStart == null ? {} : { latestStart }),
        ...(earliestEnd == null ? {} : { earliestEnd })
    };
}

function _canonicalInstant(unit, value, auxiliarySources = []) {
    const parsed = _parseUnitValue(unit, value);
    return parsed == null
        ? null
        : Object.freeze({
            kind: "instant",
            value: parsed,
            ..._canonicalAuxiliaryEndpoints(unit, auxiliarySources)
        });
}

function _canonicalRange(unit, startValue, endValue, auxiliarySources = []) {
    let start = _parseUnitValue(unit, startValue);
    let end = _parseUnitValue(unit, endValue);
    if (start == null || end == null) return null;

    const order = unit.compare(start, end);
    if (!Number.isFinite(order)) return null;
    if (order > 0) {
        const swap = start;
        start = end;
        end = swap;
    }

    return Object.freeze({
        kind: "range",
        start,
        end,
        ..._canonicalAuxiliaryEndpoints(unit, auxiliarySources)
    });
}

function _readCanonicalLike(unit, value, auxiliarySources = [value]) {
    if (!_runtimeIsObject(value)) return null;

    if (
        value.kind === "range" ||
        (_hasOwn(value, "start") && _hasOwn(value, "end"))
    ) {
        return _canonicalRange(
            unit,
            value.start,
            value.end,
            auxiliarySources
        );
    }

    if (
        value.kind === "instant" ||
        value.kind === "value" ||
        value.bounded === "instant"
    ) {
        return _canonicalInstant(unit, value.value, auxiliarySources);
    }

    return null;
}

function _defaultReadEventTime(event) {
    const unit = this.unit;

    const startDate = _readDirectField(event, "startDate");
    const endDate = _readDirectField(event, "endDate");
    if (startDate.found || endDate.found) {
        return startDate.found && endDate.found
            ? _canonicalRange(unit, startDate.value, endDate.value, [event])
            : null;
    }

    const date = _readDirectField(event, "date");
    if (date.found) return _canonicalInstant(unit, date.value, [event]);

    const start = _readDirectField(event, "start");
    const end = _readDirectField(event, "end");
    if (start.found || end.found) {
        const instant = _readDirectField(event, "instant");
        return start.found && (!end.found || instant.value === true)
            ? _canonicalInstant(unit, start.value, [event])
            : start.found && end.found
                ? _canonicalRange(unit, start.value, end.value, [event])
                : null;
    }

    const getStart = _readMethod(event, "getStart");
    if (getStart.found) {
        const isInstant = _readMethod(event, "isInstant");
        if (!isInstant.found || isInstant.value === true) {
            return _canonicalInstant(unit, getStart.value, [event]);
        }

        const getEnd = _readMethod(event, "getEnd");
        return getEnd.found
            ? _canonicalRange(unit, getStart.value, getEnd.value, [event])
            : null;
    }

    const eventTime = _readDirectField(event, "eventTime");
    const canonical = eventTime.found
        ? _readCanonicalLike(unit, eventTime.value, [event, eventTime.value])
        : _readCanonicalLike(unit, event, [event]);
    if (canonical != null) return canonical;

    const source = _readDirectField(event, "event");
    return source.found && source.value !== event
        ? _defaultReadEventTime.call(this, source.value)
        : null;
}

function _labelText(value) {
    if (_runtimeIsObject(value) && _hasOwn(value, "text")) return value.text;
    return value;
}

function _normalizeDurationPrecision(value, caller = _RUNTIME_LABEL) {
    if (typeof value !== "string") {
        throw new TypeError(`${caller} durationPrecision must be a string.`);
    }

    const precision = value.trim().toLowerCase();
    if (!_DURATION_PRECISIONS.has(precision)) {
        throw new RangeError(
            `${caller} durationPrecision must be day, hour, minute, second, or millisecond.`
        );
    }

    return precision;
}

function _durationValue(
    unit,
    labeller,
    start,
    end,
    durationPrecision = "minute"
) {
    if (
        start == null ||
        end == null ||
        typeof unit.duration !== "function" ||
        typeof labeller.labelDuration !== "function"
    ) {
        return null;
    }

    let value;
    try {
        value = unit.duration(start, end);
    } catch {
        return null;
    }
    if (!Number.isFinite(value) || value < 0) return null;

    let label;
    try {
        label = _labelText(labeller.labelDuration(value, {
            precision: durationPrecision
        }));
    } catch {
        return null;
    }
    if (label === undefined || label === null || label === "") return null;

    return Object.freeze({
        value,
        text: String(label)
    });
}

function _durationValuesDiffer(unit, left, right) {
    try {
        const comparison = unit.compare(left, right);
        return Number.isFinite(comparison) && comparison !== 0;
    } catch {
        return false;
    }
}

function _endpointMarker(value) {
    if (typeof value !== "string") return null;

    const marker = value.trim().toLowerCase();
    return marker === "present" || _UNBOUNDED_ENDPOINTS.has(marker)
        ? marker
        : null;
}

function _eventRangeBoundaries(event) {
    const visited = new Set();
    let current = event;
    const result = {
        start: "bounded",
        end: "bounded"
    };

    const recordBoundary = (name, value) => {
        const marker = _endpointMarker(value);
        if (marker == null) return;
        result[name] = marker;
    };

    const inspectRange = range => {
        if (!_runtimeIsObject(range)) return;

        recordBoundary("start", range.start);
        recordBoundary("end", range.end);

        const bounded = typeof range.bounded === "string"
            ? range.bounded.trim().toLowerCase()
            : "";
        if (bounded === "start" && result.end === "bounded") {
            result.end = "open";
        }
        if (bounded === "end" && result.start === "bounded") {
            result.start = "open";
        }
    };

    while (
        current != null &&
        typeof current === "object" &&
        !visited.has(current)
    ) {
        visited.add(current);

        const eventTime = _readDirectField(current, "eventTime");
        if (
            eventTime.found &&
            _runtimeIsObject(eventTime.value) &&
            eventTime.value.kind === "range"
        ) {
            inspectRange(eventTime.value);
        }
        inspectRange(current);

        const source = _readDirectField(current, "event");
        current = source.found && source.value !== current
            ? source.value
            : null;
    }

    return result;
}

function _resolvePresentEventTime(eventTime, event, currentTime) {
    if (eventTime?.kind !== "range" || currentTime == null) return eventTime;

    const boundaries = _eventRangeBoundaries(event);
    if (
        boundaries.start !== "present" &&
        boundaries.end !== "present"
    ) {
        return eventTime;
    }

    return Object.freeze({
        ...eventTime,
        ...(boundaries.start === "present" ? { start: currentTime } : {}),
        ...(boundaries.end === "present" ? { end: currentTime } : {})
    });
}

function _eventDurations(
    unit,
    labeller,
    eventTime,
    event = null,
    currentTime = null,
    durationPrecision = "minute"
) {
    if (eventTime?.kind !== "range") return {};

    const boundaries = _eventRangeBoundaries(event);
    let current = _parseUnitValue(unit, currentTime);
    if (current == null && boundaries.start === "present") {
        current = eventTime.start;
    }
    if (current == null && boundaries.end === "present") {
        current = eventTime.end;
    }

    const start = boundaries.start === "present" && current != null
        ? current
        : eventTime.start;
    const end = boundaries.end === "present" && current != null
        ? current
        : eventTime.end;
    const boundedStart = !_UNBOUNDED_ENDPOINTS.has(boundaries.start);
    const boundedEnd = !_UNBOUNDED_ENDPOINTS.has(boundaries.end);

    const duration = boundedStart && boundedEnd
        ? _durationValue(unit, labeller, start, end, durationPrecision)
        : null;
    const latestStart = eventTime.latestStart ?? start;
    const earliestEnd = eventTime.earliestEnd ?? end;
    const imprecise =
        _durationValuesDiffer(unit, start, latestStart) ||
        _durationValuesDiffer(unit, end, earliestEnd);

    let minimumDuration = null;
    if (imprecise && boundedStart && boundedEnd) {
        try {
            minimumDuration = unit.compare(latestStart, earliestEnd) > 0
                ? _durationValue(
                    unit,
                    labeller,
                    latestStart,
                    latestStart,
                    durationPrecision
                )
                : _durationValue(
                    unit,
                    labeller,
                    latestStart,
                    earliestEnd,
                    durationPrecision
                );
        } catch {
            minimumDuration = null;
        }
    }

    let active = false;
    if (current != null) {
        try {
            const afterStart = !boundedStart || unit.compare(start, current) <= 0;
            const beforeEnd = !boundedEnd || unit.compare(current, end) <= 0;
            active = afterStart && beforeEnd;
        } catch {
            active = false;
        }
    }
    const elapsed = active && boundedStart
        ? _durationValue(
            unit,
            labeller,
            start,
            current,
            durationPrecision
        )
        : null;
    const remaining = active && boundedEnd
        ? _durationValue(
            unit,
            labeller,
            current,
            end,
            durationPrecision
        )
        : null;

    return {
        ...(duration == null ? {} : { duration }),
        ...(minimumDuration == null ? {} : { minimumDuration }),
        ...(elapsed == null ? {} : { elapsed }),
        ...(remaining == null ? {} : { remaining })
    };
}

function _formatEndpoint(context, value, precise) {
    const labeller = context.labeller;

    if (!precise) {
        const interval = _labelText(
            labeller.labelInterval(value, context.intervalUnit)
        );
        if (interval !== undefined && interval !== null && interval !== "") {
            return String(interval);
        }
    }

    const exact = _labelText(labeller.labelPrecise(value));
    if (exact !== undefined && exact !== null && exact !== "") {
        return String(exact);
    }

    const interval = _labelText(
        labeller.labelInterval(value, context.intervalUnit)
    );
    return interval === undefined || interval === null ? "" : String(interval);
}

function _formatRangeEndpoint(context, eventTime, boundaries, name, precise) {
    const boundary = boundaries[name];
    if (boundary === "open") return "...";
    if (boundary === "unresolved") return "?";
    if (boundary === "present") {
        return name === "start" ? "now" : "present";
    }

    return _formatEndpoint(context, eventTime[name], precise);
}

function _formatEventTime(context, eventTime, precise, event = null) {
    if (eventTime == null) return "";
    if (eventTime.kind === "instant") {
        return _formatEndpoint(context, eventTime.value, precise);
    }
    if (eventTime.kind !== "range") return "";

    const boundaries = _eventRangeBoundaries(event);
    const start = _formatRangeEndpoint(
        context,
        eventTime,
        boundaries,
        "start",
        precise
    );
    const end = _formatRangeEndpoint(
        context,
        eventTime,
        boundaries,
        "end",
        precise
    );

    if (boundaries.start === "open") return `... ${end}`;
    if (boundaries.end === "open") return `${start} ...`;

    const separator = context.target === "html" ? "<br>" : " - ";
    return `${start}${separator}${end}`;
}

function _normalizeRenderedValue(value) {
    if (value === undefined || value === null) return "";
    if (Array.isArray(value)) {
        return value
            .filter(item => item !== undefined && item !== null && String(item) !== "")
            .map(String)
            .join(", ");
    }
    return value;
}

function _readDisplayValue(event, field, context) {
    if (field === "title") {
        if (context.surface === "bubble") {
            const original = _readEventField(event, "originalTitle");
            if (original.found) return original.value;
        }

        const text = _readMethod(event, "getText");
        if (text.found) return text.value;
    }

    if (field === "description") {
        const description = _readMethod(event, "getDescription");
        if (description.found && description.value != null && description.value !== "") {
            return description.value;
        }
    }

    if (field === "image") {
        const image = _readMethod(event, "getImage");
        if (image.found) return image.value;
    }

    if (field === "link") {
        const link = _readMethod(event, "getLink");
        if (link.found) return link.value;
    }

    const direct = _readEventField(event, field);
    if (direct.found) return direct.value;

    const fallbackFields = {
        bubbleDuration: "duration",
        bubbleMinimumDuration: "minimumDuration",
        bubbleElapsed: "elapsed",
        bubbleRemaining: "remaining",
        bubbleLocation: "location",
        bubblePeople: "people",
        bubbleTags: "tags"
    };
    const fallbackField = fallbackFields[field];
    if (fallbackField != null) {
        const fallback = _readEventField(event, fallbackField);
        if (fallback.found) return fallback.value;
    }

    if (field === "description") {
        const caption = _readEventField(event, "caption");
        if (caption.found) return caption.value;
    }

    return undefined;
}

function _resolveTemplateSelector(name, event, context) {
    const eventTime = context.eventTime;
    const boundaries = eventTime?.kind === "range"
        ? _eventRangeBoundaries(event)
        : null;

    if (name === "eventTime") {
        return _formatEventTime(
            context,
            eventTime,
            context.target === "html",
            event
        );
    }
    if (name === "start") {
        if (eventTime?.kind === "instant") {
            return _formatEndpoint(context, eventTime.value, true);
        }
        if (eventTime?.kind === "range") {
            return _formatRangeEndpoint(
                context,
                eventTime,
                boundaries,
                "start",
                true
            );
        }
        return "";
    }
    if (name === "latestStart" && eventTime?.latestStart != null) {
        return _formatEndpoint(context, eventTime.latestStart, true);
    }
    if (name === "earliestEnd" && eventTime?.earliestEnd != null) {
        return _formatEndpoint(context, eventTime.earliestEnd, true);
    }
    if (name === "end" && eventTime?.kind === "range") {
        return _formatRangeEndpoint(
            context,
            eventTime,
            boundaries,
            "end",
            true
        );
    }
    if (name === "duration") {
        const durationName = context.durationRole === "elapsed" ||
            context.durationRole === "remaining"
            ? context.durationRole
            : "duration";
        const explicit = _readEventField(event, durationName);
        return explicit.found
            ? _normalizeRenderedValue(explicit.value)
            : context[durationName]?.text ?? "";
    }
    if (name === "minimumDuration") {
        const explicit = _readEventField(event, "minimumDuration");
        return explicit.found
            ? _normalizeRenderedValue(explicit.value)
            : context.minimumDuration?.text ?? "";
    }
    if (name === "elapsed") {
        const explicit = _readEventField(event, "elapsed");
        return explicit.found
            ? _normalizeRenderedValue(explicit.value)
            : context.elapsed?.text ?? "";
    }
    if (name === "remaining") {
        const explicit = _readEventField(event, "remaining");
        return explicit.found
            ? _normalizeRenderedValue(explicit.value)
            : context.remaining?.text ?? "";
    }

    return _normalizeRenderedValue(_readDisplayValue(event, name, context));
}

function _renderTemplateString(runtime, template, event, context) {
    const renderer =
        context.displayProfile?.templateRenderer ??
        runtime.templateRenderer;
    return renderer.render(template, event, {
        ...context,
        resolveSelector: _resolveTemplateSelector
    });
}

function _renderDefaultSelector(runtime, name, event, context) {
    return _renderTemplateString(runtime, `{${name}}`, event, context);
}

function _defaultRender(template, event, context) {
    if (typeof template === "string") {
        return _renderTemplateString(this, template, event, context);
    }
    if (template !== undefined && template !== null) {
        return _normalizeRenderedValue(template);
    }

    const value = _readDisplayValue(event, context.field, context);
    if (value !== undefined) return _normalizeRenderedValue(value);

    const eventTime = context.eventTime;
    const boundaries = eventTime?.kind === "range"
        ? _eventRangeBoundaries(event)
        : null;
    if (context.field === "bubbleStart") {
        if (eventTime?.kind === "instant") {
            return _formatEndpoint(context, eventTime.value, true);
        }
        if (eventTime?.kind === "range") {
            return _formatRangeEndpoint(
                context,
                eventTime,
                boundaries,
                "start",
                true
            );
        }
    }
    if (context.field === "bubbleEnd" && eventTime?.kind === "range") {
        return _formatRangeEndpoint(
            context,
            eventTime,
            boundaries,
            "end",
            true
        );
    }
    if (context.field === "bubbleByline") {
        return _formatEventTime(context, eventTime, true, event);
    }
    if (context.field === "eventTime") {
        return _formatEventTime(
            context,
            eventTime,
            context.target === "html",
            event
        );
    }
    if (context.field === "bubbleDuration") {
        return _renderDefaultSelector(this, "duration", event, context);
    }
    if (context.field === "bubbleMinimumDuration") {
        return _renderDefaultSelector(this, "minimumDuration", event, context);
    }
    if (context.field === "bubbleElapsed") {
        return _renderDefaultSelector(this, "elapsed", event, context);
    }
    if (context.field === "bubbleRemaining") {
        return _renderDefaultSelector(this, "remaining", event, context);
    }

    return "";
}

function _resolveDefaultUnit() {
    return globalThis.Timeline?.NativeDateUnit ??
        globalThis.SimileAjax?.NativeDateUnit ??
        null;
}

function _resolveDefaultLabeller(unit) {
    if (typeof unit?.createLabeller !== "function") return null;

    const locale = globalThis.Timeline?.getDefaultLocale?.() ?? "en";
    return unit.createLabeller(locale, 0);
}

function assertRepriseRuntime(runtime, caller = _RUNTIME_LABEL) {
    if (!_runtimeIsObject(runtime)) {
        throw new TypeError(`${caller} must be an object.`);
    }
    if (
        !_runtimeIsObject(runtime.unit) ||
        typeof runtime.unit.parseFromObject !== "function" ||
        typeof runtime.unit.compare !== "function"
    ) {
        throw new TypeError(
            `${caller}.unit must provide parseFromObject(value) and compare(a, b).`
        );
    }
    if (
        !_runtimeIsObject(runtime.labeller) ||
        typeof runtime.labeller.labelPrecise !== "function" ||
        typeof runtime.labeller.labelInterval !== "function"
    ) {
        throw new TypeError(
            `${caller}.labeller must provide labelPrecise(value) and labelInterval(value, intervalUnit).`
        );
    }
    if (typeof runtime.readEventTime !== "function") {
        throw new TypeError(`${caller}.readEventTime must be a function.`);
    }
    if (typeof runtime.projectTimeValue !== "function") {
        throw new TypeError(`${caller}.projectTimeValue must be a function.`);
    }
    if (typeof runtime.projectTimeRange !== "function") {
        throw new TypeError(`${caller}.projectTimeRange must be a function.`);
    }
    if (
        runtime.projectCardinalAxis != null &&
        typeof runtime.projectCardinalAxis !== "function"
    ) {
        throw new TypeError(`${caller}.projectCardinalAxis must be a function.`);
    }
    if (typeof runtime.render !== "function") {
        throw new TypeError(`${caller}.render must be a function.`);
    }

    return runtime;
}

class RepriseRuntime {
    static get displayName() { return "RepriseRuntime"; }
    static get label() { return _RUNTIME_LABEL; }

    constructor({
        unit = _resolveDefaultUnit(),
        labeller = null,
        readEventTime = _defaultReadEventTime,
        readCurrentTime = _defaultReadCurrentTime,
        projectTimeValue = _defaultProjectTimeValue,
        projectTimeRange = _defaultProjectTimeRange,
        projectCardinalAxis = null,
        durationPrecision = "minute",
        templateRenderer = new TemplateRenderer(),
        render = _defaultRender
    } = {}) {
        if (!(templateRenderer instanceof TemplateRenderer)) {
            throw new TypeError(
                `${this.constructor.label}.ctor templateRenderer must be a TemplateRenderer.`
            );
        }
        if (typeof readCurrentTime !== "function") {
            throw new TypeError(
                `${this.constructor.label}.ctor readCurrentTime must be a function.`
            );
        }

        this.unit = unit;
        this.labeller = labeller ?? _resolveDefaultLabeller(unit);
        this.durationPrecision = _normalizeDurationPrecision(
            durationPrecision,
            `${this.constructor.label}.ctor`
        );
        this.templateRenderer = templateRenderer;
        this._readEventTime = readEventTime;
        this._readCurrentTime = readCurrentTime;
        this._projectTimeValue = projectTimeValue;
        this._projectTimeRange = projectTimeRange;
        this._render = render;

        if (projectCardinalAxis != null) {
            if (typeof projectCardinalAxis !== "function") {
                throw new TypeError(
                    `${this.constructor.label}.ctor projectCardinalAxis must be a function.`
                );
            }
            Object.defineProperty(this, "projectCardinalAxis", {
                value(context) {
                    return projectCardinalAxis.call(this, context);
                },
                enumerable: true
            });
        }

        assertRepriseRuntime(this, `${this.constructor.label}.ctor`);
        Object.freeze(this);
    }

    readEventTime(event) {
        return this._readEventTime.call(this, event);
    }

    readCurrentTime() {
        return _parseUnitValue(
            this.unit,
            this._readCurrentTime.call(this)
        );
    }

    projectTimeValue(value) {
        return this._projectTimeValue.call(this, value);
    }

    projectTimeRange(value) {
        return this._projectTimeRange.call(this, value);
    }

    render(template, event, context = {}) {
        const field = typeof context.field === "string"
            ? context.field.trim()
            : "";
        if (field === "") {
            throw new TypeError(`${this.constructor.label}.render context.field must be a non-empty string.`);
        }

        const target = context.target ?? "text";
        if (!_RENDER_TARGETS.has(target)) {
            throw new TypeError(`${this.constructor.label}.render context.target must be 'text' or 'html'.`);
        }

        const inputEventTime = context.eventTime === undefined
            ? this.readEventTime(event)
            : context.eventTime;
        const currentTime = inputEventTime?.kind === "range"
            ? context.currentTime === undefined
                ? this.readCurrentTime()
                : _parseUnitValue(this.unit, context.currentTime)
            : null;
        const eventTime = _resolvePresentEventTime(
            inputEventTime,
            event,
            currentTime
        );
        const durationPrecision = _normalizeDurationPrecision(
            context.durationPrecision ?? this.durationPrecision,
            `${this.constructor.label}.render`
        );
        const durations = _eventDurations(
            this.unit,
            this.labeller,
            eventTime,
            event,
            currentTime,
            durationPrecision
        );
        const {
            duration: _ignoredDuration,
            minimumDuration: _ignoredMinimumDuration,
            elapsed: _ignoredElapsed,
            remaining: _ignoredRemaining,
            ...inputContext
        } = context;
        const renderContext = Object.freeze({
            ...inputContext,
            field,
            target,
            eventTime,
            ...(currentTime == null ? {} : { currentTime }),
            durationPrecision,
            visualTheme: context.visualTheme ?? defaultVisualTheme,
            unit: this.unit,
            labeller: this.labeller,
            ...durations
        });

        if (
            (renderContext.durationRole === "elapsed" ||
                renderContext.durationRole === "remaining") &&
            renderContext[renderContext.durationRole] == null
        ) {
            return "";
        }

        return this._render.call(this, template, event, renderContext);
    }
}

function resolveRepriseRuntime(runtime, { unit, labeller } = {}) {
    return runtime == null
        ? new RepriseRuntime({ unit, labeller })
        : assertRepriseRuntime(runtime, "TimelineReprise runtime");
}

function resolvePresentationTemplate(visualTheme, field, context = {}) {
    return (context.displayProfile ??
        resolveDisplayProfile(visualTheme?.presentation))
        ?.resolveTemplate(field, context) ?? null;
}

function renderEventField(runtime, visualTheme, eventTime, event, field, target, extra = {}) {
    const displayProfile = resolveDisplayProfile(visualTheme?.presentation);
    let context = {
        ...extra,
        field,
        target,
        eventTime,
        visualTheme,
        displayProfile
    };
    let template = resolvePresentationTemplate(visualTheme, field, context);

    if (
        template == null &&
        (field === "bubbleElapsed" || field === "bubbleRemaining")
    ) {
        const durationTemplate = resolvePresentationTemplate(
            visualTheme,
            "bubbleDuration",
            context
        );
        if (durationTemplate != null) {
            context = {
                ...context,
                durationRole: field === "bubbleElapsed"
                    ? "elapsed"
                    : "remaining"
            };
            template = durationTemplate;
        }
    }

    return runtime.render(
        template,
        event,
        context
    );
}

function hasRenderedContent(value) {
    return value !== undefined && value !== null && (
        typeof value !== "string" || value !== ""
    );
}

function setRenderedContent(element, value, target) {
    if (!hasRenderedContent(value)) return false;

    if (Array.isArray(value)) {
        for (const item of value) {
            if (item?.nodeType != null) {
                element.appendChild(item);
            } else if (target === "html") {
                element.innerHTML += String(item);
            } else {
                element.appendChild(element.ownerDocument.createTextNode(String(item)));
            }
        }
        return true;
    }

    if (value?.nodeType != null) {
        element.appendChild(value);
    } else if (target === "html") {
        element.innerHTML = String(value);
    } else {
        element.textContent = String(value);
    }

    return true;
}

function _appendClass(element, className) {
    const classes = String(element.className ?? "")
        .split(/\s+/)
        .filter(Boolean);
    if (!classes.includes(className)) classes.push(className);
    element.className = classes.join(" ");
}

function _styleBubbleElement(nativeTheme, name, element) {
    const styler = nativeTheme?.event?.bubble?.[name];
    if (typeof styler === "function") styler(element);
}

function _hasEventOrPresentationField(
    event,
    visualTheme,
    field,
    fallbackField = null,
    context = {}
) {
    return _readEventField(event, field).found ||
        (fallbackField != null && _readEventField(event, fallbackField).found) ||
        resolveDisplayProfile(visualTheme?.presentation)
            ?.hasTemplate(field, context) === true;
}

function fillRepriseBubble(
    element,
    event,
    {
        runtime,
        visualTheme = defaultVisualTheme,
        nativeTheme = null,
        eventTime,
        currentTime,
        renderField = null
    } = {}
) {
    assertRepriseRuntime(runtime, "TimelineReprise.fillRepriseBubble runtime");

    const doc = element.ownerDocument;
    const inputEventTime = eventTime === undefined
        ? runtime.readEventTime(event)
        : eventTime;
    const capturedCurrentTime = currentTime === undefined
        ? runtime.readCurrentTime?.() ?? null
        : currentTime;
    const canonicalTime = _resolvePresentEventTime(
        inputEventTime,
        event,
        capturedCurrentTime
    );
    const bubbleContext = {
        surface: "bubble",
        eventTime: canonicalTime,
        currentTime: capturedCurrentTime
    };
    const render = typeof renderField === "function"
        ? (field, target = "html") =>
            renderField(field, target, bubbleContext)
        : (field, target = "html") =>
            renderEventField(
                runtime,
                visualTheme,
                canonicalTime,
                event,
                field,
                target,
                bubbleContext
            );

    const image = render("image", "text");
    if (hasRenderedContent(image)) {
        const imageContainer = doc.createElement("div");
        imageContainer.className = "timeline-event-bubble-image-container";
        const img = doc.createElement("img");
        img.src = String(image);
        _styleBubbleElement(nativeTheme, "imageStyler", img);
        imageContainer.appendChild(img);
        element.appendChild(imageContainer);
    }

    const title = render("title");
    if (hasRenderedContent(title)) {
        const titleContainer = doc.createElement("div");
        const link = render("link", "text");

        if (hasRenderedContent(link)) {
            const anchor = doc.createElement("a");
            anchor.href = String(link);
            anchor.target = "_blank";
            anchor.rel = "noopener noreferrer";
            setRenderedContent(anchor, title, "html");
            titleContainer.appendChild(anchor);
        } else {
            setRenderedContent(titleContainer, title, "html");
        }

        _styleBubbleElement(nativeTheme, "titleStyler", titleContainer);
        _appendClass(titleContainer, "timeline-event-bubble-title");
        element.appendChild(titleContainer);
    }

    const structuredFields = [
        ["bubbleStart", null],
        ["bubbleLatestStart", null],
        ["bubbleEarliestEnd", null],
        ["bubbleEnd", null],
        ["bubbleDuration", "duration"],
        ["bubbleMinimumDuration", "minimumDuration"],
        ["bubbleElapsed", null],
        ["bubbleRemaining", null],
        ["bubbleLocation", "location"],
        ["bubblePeople", "people"],
        ["bubbleTags", "tags"]
    ];
    const derivedDurations = _eventDurations(
        runtime.unit,
        runtime.labeller,
        canonicalTime,
        event,
        capturedCurrentTime,
        runtime.durationPrecision ?? "minute"
    );
    const hasMinimumDuration =
        derivedDurations.minimumDuration != null ||
        _hasEventOrPresentationField(
            event,
            visualTheme,
            "bubbleMinimumDuration",
            "minimumDuration",
            { surface: "bubble", eventTime: canonicalTime }
        );
    const hasStructuredBubble =
        derivedDurations.duration != null ||
        derivedDurations.elapsed != null ||
        derivedDurations.remaining != null ||
        structuredFields.some(([field, fallback]) =>
            _hasEventOrPresentationField(
                event,
                visualTheme,
                field,
                fallback,
                { surface: "bubble", eventTime: canonicalTime }
            )
        );
    const hasExplicitByline = _hasEventOrPresentationField(
        event,
        visualTheme,
        "bubbleByline",
        null,
        { surface: "bubble", eventTime: canonicalTime }
    );

    if (hasExplicitByline || !hasStructuredBubble) {
        const byline = render("bubbleByline");
        if (hasRenderedContent(byline)) {
            const bylineContainer = doc.createElement("div");
            setRenderedContent(bylineContainer, byline, "html");
            _styleBubbleElement(nativeTheme, "bodyStyler", bylineContainer);
            _appendClass(bylineContainer, "timeline-event-bubble-byline");
            element.appendChild(bylineContainer);
        }
    } else {
        const rows = [
            [canonicalTime?.kind === "range" ? "Start" : "When", "bubbleStart"],
            ["Latest Start", "bubbleLatestStart"],
            ["Earliest End", "bubbleEarliestEnd"],
            ["End", "bubbleEnd"],
            ["Duration", "bubbleDuration"],
            ["Shortest", "bubbleMinimumDuration"],
            ["Elapsed", "bubbleElapsed"],
            ["Remaining", "bubbleRemaining"],
            ["Location", "bubbleLocation"],
            ["People", "bubblePeople"]
        ];
        const table = doc.createElement("table");
        table.className = "timeline-event-bubble-byline-table";

        for (const [label, field] of rows) {
            const value = render(field);
            if (!hasRenderedContent(value)) continue;

            const row = doc.createElement("tr");
            const heading = doc.createElement("th");
            const cell = doc.createElement("td");
            heading.textContent =
                field === "bubbleDuration" &&
                hasMinimumDuration
                    ? "Longest"
                    : label;
            setRenderedContent(cell, value, "html");
            row.appendChild(heading);
            row.appendChild(cell);
            table.appendChild(row);
        }

        if (table.childNodes.length > 0) {
            const bylineContainer = doc.createElement("div");
            _styleBubbleElement(nativeTheme, "bodyStyler", bylineContainer);
            _appendClass(bylineContainer, "timeline-event-bubble-byline");
            bylineContainer.appendChild(table);
            element.appendChild(bylineContainer);
        }
    }

    const description = render("description");
    if (hasRenderedContent(description)) {
        const descriptionContainer = doc.createElement("div");
        setRenderedContent(descriptionContainer, description, "html");
        _styleBubbleElement(nativeTheme, "bodyStyler", descriptionContainer);
        _appendClass(descriptionContainer, "timeline-event-bubble-description");
        element.appendChild(descriptionContainer);
    }

    if (!hasExplicitByline && hasStructuredBubble) {
        const renderedTags = render("bubbleTags", "text");
        const tags = Array.isArray(renderedTags)
            ? renderedTags
            : String(renderedTags ?? "").split(",");
        const normalizedTags = tags
            .map(tag => String(tag).trim())
            .filter(Boolean);

        if (normalizedTags.length > 0) {
            const tagsContainer = doc.createElement("div");
            _styleBubbleElement(nativeTheme, "bodyStyler", tagsContainer);
            _appendClass(tagsContainer, "timeline-event-bubble-tags");

            for (const tag of normalizedTags) {
                const chip = doc.createElement("span");
                chip.className = "timeline-event-bubble-tag";
                chip.textContent = tag;
                tagsContainer.appendChild(chip);
            }

            element.appendChild(tagsContainer);
        }
    }

    return element;
}

export {
    RepriseRuntime,
    assertRepriseRuntime,
    fillRepriseBubble,
    hasRenderedContent,
    renderEventField,
    resolvePresentationTemplate,
    resolveRepriseRuntime,
    setRenderedContent
};
