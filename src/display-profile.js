import { TemplateRenderer } from "./template-renderer.js";

const _DISPLAY_PROFILE_LABEL = "TimelineReprise.DisplayProfile";
const _SPEC_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const _SURFACES = Object.freeze(["label", "bubble"]);
const _SHAPES = Object.freeze(["instant", "range"]);
const _FIELDS_BY_SURFACE = Object.freeze({
    label: new Set(["title", "caption"]),
    bubble: new Set([
        "image",
        "title",
        "link",
        "bubbleByline",
        "bubbleStart",
        "bubbleLatestStart",
        "bubbleEarliestEnd",
        "bubbleEnd",
        "bubbleDuration",
        "bubbleMinimumDuration",
        "bubbleElapsed",
        "bubbleRemaining",
        "bubbleLocation",
        "bubblePeople",
        "bubbleTags",
        "description"
    ])
});

function _isPlainObject(value) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.prototype.toString.call(value) !== "[object Object]"
    ) {
        return false;
    }

    const proto = Object.getPrototypeOf(value);
    return proto === null || proto.constructor?.name === "Object";
}

function _deepFreezePlain(value) {
    if (Array.isArray(value)) {
        value.forEach(_deepFreezePlain);
        return Object.freeze(value);
    }
    if (_isPlainObject(value)) {
        Object.values(value).forEach(_deepFreezePlain);
        return Object.freeze(value);
    }
    return value;
}

function _validateId(id, caller) {
    if (typeof id !== "string") {
        throw new TypeError(`${caller}.id must be a string.`);
    }
    if (!_SPEC_ID_PATTERN.test(id)) {
        throw new RangeError(
            `${caller}.id must start with a letter and contain only letters, numbers, underscores, or hyphens.`
        );
    }
    return id;
}

class DisplayProfile {
    static get displayName() { return "DisplayProfile"; }
    static get label() { return _DISPLAY_PROFILE_LABEL; }

    constructor(
        { id, label = {}, bubble = {} } = {},
        { templateRenderer = new TemplateRenderer() } = {}
    ) {
        const caller = `${this.constructor.label}.ctor`;
        if (!(templateRenderer instanceof TemplateRenderer)) {
            throw new TypeError(
                `${caller}.templateRenderer must be a TemplateRenderer.`
            );
        }

        this.id = _validateId(id, caller);
        this.templateRenderer = templateRenderer;
        this.label = this._validateSurface(label, "label", caller);
        this.bubble = this._validateSurface(bubble, "bubble", caller);

        Object.freeze(this);
    }

    _validateSurface(surfaceSpec, surface, caller) {
        const path = `${caller}.${surface}`;
        if (!_isPlainObject(surfaceSpec)) {
            throw new TypeError(`${path} must be an object.`);
        }

        const allowedFields = _FIELDS_BY_SURFACE[surface];
        const result = {};
        for (const [field, templateSpec] of Object.entries(surfaceSpec)) {
            if (!allowedFields.has(field)) {
                throw new RangeError(`${path} unsupported output field: ${field}.`);
            }

            result[field] = this._validateTemplateSpec(
                templateSpec,
                `${path}.${field}`
            );
        }

        return _deepFreezePlain(result);
    }

    _validateTemplateSpec(templateSpec, caller) {
        if (typeof templateSpec === "string") {
            this.templateRenderer.validateTemplate(templateSpec, { caller });
            return templateSpec;
        }
        if (!_isPlainObject(templateSpec)) {
            throw new TypeError(
                `${caller} must be a string or an instant/range template object.`
            );
        }

        for (const key of Object.keys(templateSpec)) {
            if (!_SHAPES.includes(key)) {
                throw new RangeError(`${caller}.${key} is not supported.`);
            }
        }

        const result = {};
        for (const shape of _SHAPES) {
            if (templateSpec[shape] === undefined) continue;
            if (typeof templateSpec[shape] !== "string") {
                throw new TypeError(`${caller}.${shape} must be a string.`);
            }
            this.templateRenderer.validateTemplate(templateSpec[shape], {
                caller: `${caller}.${shape}`
            });
            result[shape] = templateSpec[shape];
        }

        return _deepFreezePlain(result);
    }

    resolveTemplate(field, { surface, eventTime } = {}) {
        if (!_SURFACES.includes(surface)) return null;

        const templateSpec = this[surface]?.[field];
        if (typeof templateSpec === "string") return templateSpec;
        if (!_isPlainObject(templateSpec)) return null;

        const shape = eventTime?.kind;
        return _SHAPES.includes(shape)
            ? templateSpec[shape] ?? null
            : null;
    }

    hasTemplate(field, context = {}) {
        return this.resolveTemplate(field, context) != null;
    }
}

export { DisplayProfile };
