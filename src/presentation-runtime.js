import { defaultVisualTheme } from "./visual-theme.js";
import { TemplateRenderer } from "./template-renderer.js";
import { resolveDisplayProfile } from "./theme-registry.js";

const _RUNTIME_LABEL = "TimelineReprise.RepriseRuntime";
const _RENDER_TARGETS = new Set(["text", "html"]);

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

function _durationValue(unit, labeller, start, end) {
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
        label = _labelText(labeller.labelDuration(value));
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

function _hasIndeterminateDurationRange(event) {
    const visited = new Set();
    let current = event;

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
            eventTime.value.kind === "range" &&
            (
                eventTime.value.start === "open" ||
                eventTime.value.start === "unresolved" ||
                eventTime.value.end === "open" ||
                eventTime.value.end === "unresolved"
            )
        ) {
            return true;
        }

        const source = _readDirectField(current, "event");
        current = source.found && source.value !== current
            ? source.value
            : null;
    }

    return false;
}

function _eventDurations(unit, labeller, eventTime, event = null) {
    if (eventTime?.kind !== "range") return {};
    if (_hasIndeterminateDurationRange(event)) return {};

    const duration = _durationValue(
        unit,
        labeller,
        eventTime.start,
        eventTime.end
    );
    const latestStart = eventTime.latestStart ?? eventTime.start;
    const earliestEnd = eventTime.earliestEnd ?? eventTime.end;
    const imprecise =
        _durationValuesDiffer(unit, eventTime.start, latestStart) ||
        _durationValuesDiffer(unit, eventTime.end, earliestEnd);
    if (!imprecise) {
        return duration == null ? {} : { duration };
    }

    let minimumDuration;
    try {
        minimumDuration = unit.compare(latestStart, earliestEnd) > 0
            ? _durationValue(unit, labeller, latestStart, latestStart)
            : _durationValue(unit, labeller, latestStart, earliestEnd);
    } catch {
        minimumDuration = null;
    }

    return {
        ...(duration == null ? {} : { duration }),
        ...(minimumDuration == null ? {} : { minimumDuration })
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

function _formatEventTime(context, eventTime, precise) {
    if (eventTime == null) return "";
    if (eventTime.kind === "instant") {
        return _formatEndpoint(context, eventTime.value, precise);
    }
    if (eventTime.kind !== "range") return "";

    const separator = context.target === "html" ? "<br>" : " - ";
    return [
        _formatEndpoint(context, eventTime.start, precise),
        _formatEndpoint(context, eventTime.end, precise)
    ].join(separator);
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

    if (name === "eventTime") {
        return _formatEventTime(
            context,
            eventTime,
            context.target === "html"
        );
    }
    if (name === "start") {
        if (eventTime?.kind === "instant") {
            return _formatEndpoint(context, eventTime.value, true);
        }
        if (eventTime?.kind === "range") {
            return _formatEndpoint(context, eventTime.start, true);
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
        return _formatEndpoint(context, eventTime.end, true);
    }
    if (name === "duration") {
        const explicit = _readEventField(event, "duration");
        return explicit.found
            ? _normalizeRenderedValue(explicit.value)
            : context.duration?.text ?? "";
    }
    if (name === "minimumDuration") {
        const explicit = _readEventField(event, "minimumDuration");
        return explicit.found
            ? _normalizeRenderedValue(explicit.value)
            : context.minimumDuration?.text ?? "";
    }

    return _normalizeRenderedValue(_readDisplayValue(event, name, context));
}

function _defaultRender(template, event, context) {
    if (typeof template === "string") {
        const renderer =
            context.displayProfile?.templateRenderer ??
            this.templateRenderer;
        return renderer.render(template, event, {
            ...context,
            resolveSelector: _resolveTemplateSelector
        });
    }
    if (template !== undefined && template !== null) {
        return _normalizeRenderedValue(template);
    }

    const value = _readDisplayValue(event, context.field, context);
    if (value !== undefined) return _normalizeRenderedValue(value);

    const eventTime = context.eventTime;
    if (context.field === "bubbleStart") {
        if (eventTime?.kind === "instant") {
            return _formatEndpoint(context, eventTime.value, true);
        }
        if (eventTime?.kind === "range") {
            return _formatEndpoint(context, eventTime.start, true);
        }
    }
    if (context.field === "bubbleEnd" && eventTime?.kind === "range") {
        return _formatEndpoint(context, eventTime.end, true);
    }
    if (context.field === "bubbleByline") {
        return _formatEventTime(context, eventTime, true);
    }
    if (context.field === "eventTime") {
        return _formatEventTime(context, eventTime, context.target === "html");
    }
    if (context.field === "bubbleDuration") {
        return context.duration?.text ?? "";
    }
    if (context.field === "bubbleMinimumDuration") {
        return context.minimumDuration?.text ?? "";
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
        projectTimeValue = _defaultProjectTimeValue,
        projectTimeRange = _defaultProjectTimeRange,
        projectCardinalAxis = null,
        templateRenderer = new TemplateRenderer(),
        render = _defaultRender
    } = {}) {
        if (!(templateRenderer instanceof TemplateRenderer)) {
            throw new TypeError(
                `${this.constructor.label}.ctor templateRenderer must be a TemplateRenderer.`
            );
        }

        this.unit = unit;
        this.labeller = labeller ?? _resolveDefaultLabeller(unit);
        this.templateRenderer = templateRenderer;
        this._readEventTime = readEventTime;
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

        const eventTime = context.eventTime === undefined
            ? this.readEventTime(event)
            : context.eventTime;
        const durations = _eventDurations(
            this.unit,
            this.labeller,
            eventTime,
            event
        );
        const {
            duration: _ignoredDuration,
            minimumDuration: _ignoredMinimumDuration,
            ...inputContext
        } = context;
        const renderContext = Object.freeze({
            ...inputContext,
            field,
            target,
            eventTime,
            visualTheme: context.visualTheme ?? defaultVisualTheme,
            unit: this.unit,
            labeller: this.labeller,
            ...durations
        });

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
    const context = {
        ...extra,
        field,
        target,
        eventTime,
        visualTheme,
        displayProfile
    };

    return runtime.render(
        resolvePresentationTemplate(visualTheme, field, context),
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
        renderField = null
    } = {}
) {
    assertRepriseRuntime(runtime, "TimelineReprise.fillRepriseBubble runtime");

    const doc = element.ownerDocument;
    const canonicalTime = eventTime === undefined
        ? runtime.readEventTime(event)
        : eventTime;
    const render = typeof renderField === "function"
        ? (field, target = "html") => renderField(field, target)
        : (field, target = "html") =>
            renderEventField(
                runtime,
                visualTheme,
                canonicalTime,
                event,
                field,
                target,
                { surface: "bubble" }
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
        event
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
    const hasStructuredBubble = derivedDurations.duration != null ||
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
