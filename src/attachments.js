import {
    renderEventField,
    resolveRepriseRuntime
} from "./presentation-runtime.js";
import { resolveVisualTheme } from "./theme-registry.js";
import { deriveVisualTheme } from "./visual-theme.js";

const _ATTACHMENT_MODULE_LABEL = "TimelineReprise";
const _ATTACHMENT_VISUAL_THEME_OVERRIDE_NAMES = [
    "disableEmphasis",
    "spans",
    "dividers",
    "labels",
    "bubbles",
    "tooltips"
];
const _ATTACHMENT_OPTION_NAMES = new Set([
    "visualTheme",
    "runtime",
    ..._ATTACHMENT_VISUAL_THEME_OVERRIDE_NAMES
]);
const _ATTACHMENT_COLOUR_FIELDS = [
    "color",
    "textColor",
    "labelColor",
    "iconColor",
    "tapeColor",
    "spanColor",
    "lineColor"
];
const _ATTACHMENT_RESERVED_RECORD_FIELDS = new Set([
    "visualTheme",
    "runtime",
    "eventTime"
]);
const _attachmentContextByRecord = new WeakMap();
let _attachmentNextEventId = 0;

function _attachmentIsObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
}

function _attachmentHasOwn(source, name) {
    return source != null && Object.prototype.hasOwnProperty.call(source, name);
}

function _attachmentReadValue(source, names) {
    for (const name of Array.isArray(names) ? names : [names]) {
        if (_attachmentHasOwn(source, name) && source[name] !== undefined) {
            return { found: true, value: source[name] };
        }

        if (typeof source?.getProperty === "function") {
            const value = source.getProperty(name);
            if (value !== undefined && value !== null) {
                return { found: true, value };
            }
        }
    }

    return { found: false, value: undefined };
}

function _attachmentReadMethod(source, name) {
    return typeof source?.[name] === "function"
        ? { found: true, value: source[name]() }
        : { found: false, value: undefined };
}

function _attachmentAssertBandInfo(bandInfo, caller) {
    if (!_attachmentIsObject(bandInfo)) {
        throw new TypeError(`${caller} \`bandInfo\` must be an object.`);
    }
    if (!_attachmentIsObject(bandInfo.theme)) {
        throw new TypeError(`${caller} \`bandInfo.theme\` must be an object.`);
    }
}

function _attachmentResolveOptions(options, caller) {
    if (options == null) return {};
    if (!_attachmentIsObject(options)) {
        throw new TypeError(`${caller} \`options\` must be an object.`);
    }

    for (const name of Object.keys(options)) {
        if (!_ATTACHMENT_OPTION_NAMES.has(name)) {
            throw new TypeError(`${caller} \`options.${name}\` is not supported.`);
        }
    }

    return options;
}

function _attachmentReadVisualThemeOverrides(options) {
    const overrides = {};

    for (const name of _ATTACHMENT_VISUAL_THEME_OVERRIDE_NAMES) {
        if (_attachmentHasOwn(options, name) && options[name] !== undefined) {
            overrides[name] = options[name];
        }
    }

    return Object.keys(overrides).length === 0 ? null : overrides;
}

function _attachmentResolveBandUnit(bandInfo) {
    return bandInfo.eventSource?._events?.getUnit?.() ??
        bandInfo.unit ??
        globalThis.Timeline?.NativeDateUnit ??
        globalThis.SimileAjax?.NativeDateUnit ??
        null;
}

function _attachmentResolveBandLabeller(bandInfo, unit) {
    if (bandInfo.labeller != null) return bandInfo.labeller;

    if (typeof unit?.createLabeller === "function") {
        const locale = bandInfo.locale ??
            globalThis.Timeline?.getDefaultLocale?.() ??
            "en";
        return unit.createLabeller(locale, bandInfo.timeZone ?? 0);
    }

    const nativeUnit = globalThis.SimileAjax?.NativeDateUnit ??
        globalThis.Timeline?.NativeDateUnit ??
        null;
    const GregorianDateLabeller =
        globalThis.Timeline?.GregorianDateLabeller;

    if (unit === nativeUnit && typeof GregorianDateLabeller === "function") {
        return new GregorianDateLabeller(
            bandInfo.locale ??
                globalThis.Timeline?.getDefaultLocale?.() ??
                "en",
            bandInfo.timeZone ?? 0
        );
    }

    return null;
}

function _attachmentResolveContext(bandInfo, options, caller) {
    _attachmentAssertBandInfo(bandInfo, caller);
    const resolvedOptions = _attachmentResolveOptions(options, caller);
    const unit = _attachmentResolveBandUnit(bandInfo);
    const baseVisualTheme = resolveVisualTheme(
        resolvedOptions.visualTheme ?? null,
        bandInfo.theme
    );
    const visualThemeOverrides =
        _attachmentReadVisualThemeOverrides(resolvedOptions);
    const visualTheme = visualThemeOverrides == null
        ? baseVisualTheme
        : deriveVisualTheme(baseVisualTheme, visualThemeOverrides);
    const runtime = resolveRepriseRuntime(
        resolvedOptions.runtime ?? bandInfo.repriseRuntime ?? null,
        {
            unit,
            labeller: _attachmentResolveBandLabeller(bandInfo, unit)
        }
    );

    return Object.freeze({
        visualTheme,
        nativeTheme: bandInfo.theme,
        runtime
    });
}

function _attachmentNormalizeColour(value) {
    if (typeof value !== "string" || value.trim() === "") return value;

    return globalThis.Timeline?.ThemeIcons?.getCssColor?.(value) ?? value;
}

function _attachmentPrepareColourFields(data) {
    for (const field of _ATTACHMENT_COLOUR_FIELDS) {
        if (_attachmentHasOwn(data, field)) {
            data[field] = _attachmentNormalizeColour(data[field]);
        }
    }
}

function _attachmentPrepareBubbleFields(data) {
    const fallbacks = {
        bubbleLocation: "location",
        bubblePeople: "people",
        bubbleTags: "tags"
    };

    for (const [field, fallback] of Object.entries(fallbacks)) {
        if (
            !_attachmentHasOwn(data, field) &&
            _attachmentHasOwn(data, fallback)
        ) {
            data[field] = data[fallback];
        }
    }
}

function _attachmentPreparePresentationEvent(source, eventTime) {
    const data = {};

    for (const [name, value] of Object.entries(source)) {
        if (!_ATTACHMENT_RESERVED_RECORD_FIELDS.has(name)) data[name] = value;
    }

    data.event = source;
    data.eventTime = eventTime;

    if (eventTime.kind === "range") {
        data.start = eventTime.start;
        data.end = eventTime.end;
        data.startDate = eventTime.start;
        data.endDate = eventTime.end;
    } else {
        data.start = eventTime.value;
        data.date = eventTime.value;
    }

    _attachmentPrepareColourFields(data);
    _attachmentPrepareBubbleFields(data);
    return data;
}

function _attachmentMakeEventId(source) {
    const value = _attachmentReadValue(source, "id");
    if (value.found && value.value != null) {
        const id = String(value.value).trim();
        if (id !== "") return id;
    }

    const method = _attachmentReadMethod(source, "getID");
    if (method.found && method.value != null && String(method.value).trim() !== "") {
        return String(method.value).trim();
    }

    if (typeof globalThis.Timeline?.EventUtils?.getNewEventID === "function") {
        return globalThis.Timeline.EventUtils.getNewEventID();
    }

    _attachmentNextEventId += 1;
    return `reprise-event-${_attachmentNextEventId}`;
}

function _attachmentRenderedText(value) {
    if (value === undefined || value === null) return "";
    if (Array.isArray(value)) return value.map(_attachmentRenderedText).join("");
    if (value?.nodeType != null) return value.textContent ?? value.nodeValue ?? "";
    return String(value);
}

function _attachmentIsReusableRenderedValue(value) {
    if (value?.nodeType != null) return false;
    return !Array.isArray(value) ||
        value.every(_attachmentIsReusableRenderedValue);
}

class AttachedEvent {
    constructor(source, context, eventTime, presentationEvent) {
        for (const [name, value] of Object.entries(presentationEvent)) {
            if (!_ATTACHMENT_RESERVED_RECORD_FIELDS.has(name)) {
                this[name] = value;
            }
        }

        this._id = _attachmentMakeEventId(source);
        this._instant = eventTime.kind === "instant";
        this._start = this._instant ? eventTime.value : eventTime.start;
        this._end = this._instant ? eventTime.value : eventTime.end;
        this._latestStart = eventTime.latestStart ??
            (this._instant ? this._end : this._start);
        this._earliestEnd = eventTime.earliestEnd ?? this._end;

        Object.defineProperties(this, {
            visualTheme: {
                configurable: false,
                enumerable: false,
                value: context.visualTheme,
                writable: false
            },
            runtime: {
                configurable: false,
                enumerable: false,
                value: context.runtime,
                writable: false
            },
            eventTime: {
                configurable: false,
                enumerable: false,
                value: eventTime,
                writable: false
            }
        });
    }

    getID() {
        return this._id;
    }

    isInstant() {
        return this._instant;
    }

    isImprecise() {
        const { runtime } = getAttachedEventContext(this);
        return runtime.unit.compare(this._start, this._latestStart) !== 0 ||
            runtime.unit.compare(this._end, this._earliestEnd) !== 0;
    }

    getStart() {
        return this._start;
    }

    getEnd() {
        return this._end;
    }

    getLatestStart() {
        return this._latestStart;
    }

    getEarliestEnd() {
        return this._earliestEnd;
    }

    getEventID() {
        return this.getProperty("eventID");
    }

    getText() {
        return _attachmentRenderedText(renderAttachedEventField(
            this,
            "title",
            "text",
            { surface: "label" }
        ));
    }

    getDescription() {
        return this.getProperty("description") ?? "";
    }

    getImage() {
        return this.getProperty("image");
    }

    getLink() {
        return this.getProperty("link");
    }

    getIcon() {
        return this.getProperty("icon");
    }

    getColor() {
        return this.getProperty("color");
    }

    getTextColor() {
        return this.getProperty("textColor");
    }

    getClassName() {
        return this.getProperty("classname") ?? this.getProperty("className");
    }

    getTapeImage() {
        return this.getProperty("tapeImage");
    }

    getTapeRepeat() {
        return this.getProperty("tapeRepeat");
    }

    getTrackNum() {
        const value = this.getProperty("trackNum") ?? this.getProperty("track");
        if (value === undefined || value === null || value === "") return null;

        const number = Number(value);
        return Number.isFinite(number) ? Math.floor(number) : null;
    }

    getProperty(name) {
        if (_attachmentHasOwn(this, name) && this[name] !== undefined) {
            return this[name];
        }

        const { source } = getAttachedEventContext(this);
        const value = _attachmentReadValue(source, name);
        return value.found ? value.value : null;
    }
}

function _attachmentPrepareRecords(events, context, caller) {
    if (!Array.isArray(events)) {
        throw new TypeError(`${caller} \`events\` must be an array.`);
    }

    return events.map((source, index) => {
        if (!_attachmentIsObject(source)) {
            throw new TypeError(`${caller} \`events[${index}]\` must be an object.`);
        }

        const eventTime = context.runtime.readEventTime(source);
        if (eventTime?.kind !== "instant" && eventTime?.kind !== "range") {
            throw new TypeError(
                `${caller} \`events[${index}]\` must resolve to an instant or range.`
            );
        }

        const presentationEvent = _attachmentPreparePresentationEvent(
            source,
            eventTime
        );
        const record = new AttachedEvent(
            source,
            context,
            eventTime,
            presentationEvent
        );

        _attachmentContextByRecord.set(record, {
            ...context,
            eventTime,
            presentationEvent,
            renderedFields: new Map(),
            source
        });

        return record;
    });
}

function getAttachedEventContext(event) {
    let current = event;

    while (current != null && typeof current === "object") {
        const context = _attachmentContextByRecord.get(current);
        if (context != null) return context;
        current = Object.getPrototypeOf(current);
    }

    return null;
}

function captureAttachedEventRenderContext(event) {
    const attachment = getAttachedEventContext(event);
    if (attachment == null) {
        throw new TypeError(
            `${_ATTACHMENT_MODULE_LABEL}.captureAttachedEventRenderContext requires an attached event record.`
        );
    }

    return Object.freeze({
        eventTime:
            attachment.runtime.readEventTime(attachment.source) ??
            attachment.eventTime,
        currentTime: attachment.runtime.readCurrentTime?.() ?? null
    });
}

function renderAttachedEventField(event, field, target, extra = {}) {
    const attachment = getAttachedEventContext(event);
    if (attachment == null) {
        throw new TypeError(
            `${_ATTACHMENT_MODULE_LABEL}.renderAttachedEventField requires an attached event record.`
        );
    }

    const {
        fresh = false,
        eventTime = attachment.eventTime,
        ...renderExtra
    } = extra;
    const surface = typeof renderExtra.surface === "string"
        ? renderExtra.surface
        : "";
    const key = `${field}\u0000${target}\u0000${surface}`;
    const useCache = fresh !== true && surface !== "bubble";
    if (useCache && attachment.renderedFields.has(key)) {
        return attachment.renderedFields.get(key);
    }

    const value = renderEventField(
        attachment.runtime,
        attachment.visualTheme,
        eventTime,
        attachment.presentationEvent,
        field,
        target,
        renderExtra
    );

    if (useCache && _attachmentIsReusableRenderedValue(value)) {
        attachment.renderedFields.set(key, value);
    }

    return value;
}

function attachEvents(bandInfoOrBandInfos, events = [], options = {}) {
    const caller = `${_ATTACHMENT_MODULE_LABEL}.attachEvents`;
    const bandInfos = Array.isArray(bandInfoOrBandInfos)
        ? bandInfoOrBandInfos
        : [bandInfoOrBandInfos];
    const attachments = bandInfos.map((bandInfo, index) => {
        const bandCaller = bandInfos.length === 1
            ? caller
            : `${caller} bandInfos[${index}]`;
        const context = _attachmentResolveContext(
            bandInfo,
            options,
            bandCaller
        );

        if (typeof bandInfo.eventSource?.addMany !== "function") {
            throw new TypeError(
                `${bandCaller} \`bandInfo.eventSource\` must provide addMany(events).`
            );
        }
        if (!_attachmentIsObject(bandInfo.eventPainter)) {
            throw new TypeError(
                `${bandCaller} \`bandInfo.eventPainter\` must be an object.`
            );
        }

        return {
            bandInfo,
            context,
            records: _attachmentPrepareRecords(events, context, bandCaller)
        };
    });

    for (const { bandInfo, context, records } of attachments) {
        const painter = bandInfo.eventPainter;
        painter._params = _attachmentIsObject(painter._params)
            ? painter._params
            : {};
        painter._params.visualTheme = context.visualTheme;
        painter._params.runtime = context.runtime;
        painter._visualTheme = context.visualTheme;
        painter._runtime = context.runtime;
        bandInfo.eventSource.addMany(records);
    }
}

function attachNarrativeDecorators(bandInfo, events = [], options = {}) {
    const caller = `${_ATTACHMENT_MODULE_LABEL}.attachNarrativeDecorators`;
    const context = _attachmentResolveContext(bandInfo, options, caller);

    if (typeof globalThis.Timeline?.NarrativeDecorator !== "function") {
        throw new TypeError(`${caller} Timeline.NarrativeDecorator is not available.`);
    }

    const records = _attachmentPrepareRecords(events, context, caller);
    const ranges = records.filter(record => record.eventTime.kind === "range");
    const instants = records.filter(record => record.eventTime.kind === "instant");
    const decorator = new globalThis.Timeline.NarrativeDecorator({
        visualTheme: context.visualTheme,
        runtime: context.runtime,
        ranges,
        instants
    });

    bandInfo.decorators ??= [];
    if (!Array.isArray(bandInfo.decorators)) {
        throw new TypeError(`${caller} \`bandInfo.decorators\` must be an array.`);
    }
    bandInfo.decorators.push(decorator);
}

export {
    attachEvents,
    attachNarrativeDecorators,
    captureAttachedEventRenderContext,
    getAttachedEventContext,
    renderAttachedEventField
};
