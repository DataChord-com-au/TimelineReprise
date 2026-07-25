import { defaultEventTheme } from "./event-theme.js";

const _RUNTIME_LABEL = "TimelineReprise.RepriseRuntime";
const _RENDER_TARGETS = new Set(["text", "html"]);

function _isObject(value) {
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

function _canonicalInstant(unit, value) {
    const parsed = _parseUnitValue(unit, value);
    return parsed == null
        ? null
        : Object.freeze({ kind: "instant", value: parsed });
}

function _canonicalRange(unit, startValue, endValue) {
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

    return Object.freeze({ kind: "range", start, end });
}

function _readCanonicalLike(unit, value) {
    if (!_isObject(value)) return null;

    if (
        value.kind === "range" ||
        (_hasOwn(value, "start") && _hasOwn(value, "end"))
    ) {
        return _canonicalRange(unit, value.start, value.end);
    }

    if (
        value.kind === "instant" ||
        value.kind === "value" ||
        value.bounded === "instant"
    ) {
        return _canonicalInstant(unit, value.value);
    }

    return null;
}

function _defaultReadEventTime(event) {
    const unit = this.unit;

    const startDate = _readDirectField(event, "startDate");
    const endDate = _readDirectField(event, "endDate");
    if (startDate.found || endDate.found) {
        return startDate.found && endDate.found
            ? _canonicalRange(unit, startDate.value, endDate.value)
            : null;
    }

    const date = _readDirectField(event, "date");
    if (date.found) return _canonicalInstant(unit, date.value);

    const start = _readDirectField(event, "start");
    const end = _readDirectField(event, "end");
    if (start.found || end.found) {
        const instant = _readDirectField(event, "instant");
        return start.found && (!end.found || instant.value === true)
            ? _canonicalInstant(unit, start.value)
            : start.found && end.found
                ? _canonicalRange(unit, start.value, end.value)
                : null;
    }

    const getStart = _readMethod(event, "getStart");
    if (getStart.found) {
        const isInstant = _readMethod(event, "isInstant");
        if (!isInstant.found || isInstant.value === true) {
            return _canonicalInstant(unit, getStart.value);
        }

        const getEnd = _readMethod(event, "getEnd");
        return getEnd.found
            ? _canonicalRange(unit, getStart.value, getEnd.value)
            : null;
    }

    const eventTime = _readDirectField(event, "eventTime");
    const canonical = eventTime.found
        ? _readCanonicalLike(unit, eventTime.value)
        : _readCanonicalLike(unit, event);
    if (canonical != null) return canonical;

    const source = _readDirectField(event, "event");
    return source.found && source.value !== event
        ? _defaultReadEventTime.call(this, source.value)
        : null;
}

function _labelText(value) {
    if (_isObject(value) && _hasOwn(value, "text")) return value.text;
    return value;
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

function _defaultRender(template, event, context) {
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
    if (!_isObject(runtime)) {
        throw new TypeError(`${caller} must be an object.`);
    }
    if (
        !_isObject(runtime.unit) ||
        typeof runtime.unit.parseFromObject !== "function" ||
        typeof runtime.unit.compare !== "function"
    ) {
        throw new TypeError(
            `${caller}.unit must provide parseFromObject(value) and compare(a, b).`
        );
    }
    if (
        !_isObject(runtime.labeller) ||
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
        render = _defaultRender
    } = {}) {
        this.unit = unit;
        this.labeller = labeller ?? _resolveDefaultLabeller(unit);
        this._readEventTime = readEventTime;
        this._render = render;

        assertRepriseRuntime(this, `${this.constructor.label}.ctor`);
        Object.freeze(this);
    }

    readEventTime(event) {
        return this._readEventTime.call(this, event);
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
        const renderContext = Object.freeze({
            ...context,
            field,
            target,
            eventTime,
            eventTheme: context.eventTheme ?? defaultEventTheme,
            unit: this.unit,
            labeller: this.labeller
        });

        return this._render.call(this, template, event, renderContext);
    }
}

function resolveRepriseRuntime(runtime, { unit, labeller } = {}) {
    return runtime == null
        ? new RepriseRuntime({ unit, labeller })
        : assertRepriseRuntime(runtime, "TimelineReprise runtime");
}

function resolvePresentationTemplate(eventTheme, field) {
    const spec = eventTheme?.presentation?.[field];
    if (!_isObject(spec)) return spec ?? null;

    if (_hasOwn(spec, "template")) return spec.template;
    if (_hasOwn(spec, "templateId")) {
        return eventTheme?.templates?.[spec.templateId] ?? null;
    }

    return null;
}

function renderEventField(runtime, eventTheme, eventTime, event, field, target, extra = {}) {
    return runtime.render(
        resolvePresentationTemplate(eventTheme, field),
        event,
        {
            ...extra,
            field,
            target,
            eventTime,
            eventTheme
        }
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

function _hasEventOrPresentationField(event, eventTheme, field, fallbackField = null) {
    return _readEventField(event, field).found ||
        (fallbackField != null && _readEventField(event, fallbackField).found) ||
        eventTheme?.presentation?.[field] != null;
}

function fillRepriseBubble(
    element,
    event,
    { runtime, eventTheme = defaultEventTheme, nativeTheme = null, eventTime } = {}
) {
    assertRepriseRuntime(runtime, "TimelineReprise.fillRepriseBubble runtime");

    const doc = element.ownerDocument;
    const canonicalTime = eventTime === undefined
        ? runtime.readEventTime(event)
        : eventTime;
    const render = (field, target = "html") =>
        renderEventField(
            runtime,
            eventTheme,
            canonicalTime,
            event,
            field,
            target,
            { surface: "bubble" }
        );

    const image = render("image", "text");
    if (hasRenderedContent(image)) {
        const imageContainer = doc.createElement("div");
        imageContainer.className = "timeline-event-bubble-image";
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
        ["bubbleDuration", null],
        ["bubbleMinimumDuration", null],
        ["bubbleElapsed", null],
        ["bubbleRemaining", null],
        ["bubbleLocation", "location"],
        ["bubblePeople", "people"],
        ["bubbleTags", "tags"]
    ];
    const hasStructuredBubble = structuredFields.some(([field, fallback]) =>
        _hasEventOrPresentationField(event, eventTheme, field, fallback)
    );
    const hasExplicitByline = _hasEventOrPresentationField(
        event,
        eventTheme,
        "bubbleByline"
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
                _hasEventOrPresentationField(event, eventTheme, "bubbleMinimumDuration")
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
