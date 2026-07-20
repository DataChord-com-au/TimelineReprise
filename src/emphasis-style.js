import { normalizeColorString } from "./color.js";

const MODULE_LABEL = "TimelineReprise";
const EVENT_COLOR_SCOPES = Object.freeze(["none", "label", "graphic", "both"]);

function classLabel(ctor) {
    return `${MODULE_LABEL}.${ctor.displayName || ctor.name || "<anonymous class>"}`;
}

function isPlainObject(value) {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    if (Object.prototype.toString.call(value) !== "[object Object]") {
        return false;
    }

    const proto = Object.getPrototypeOf(value);
    return proto === null || proto.constructor?.name === "Object";
}

function validateEmphasisSpecId(value, caller) {
    if (value == null) return undefined;

    if (typeof value !== "string") {
        throw new TypeError(`${caller} must be a string.`);
    }

    const id = value.trim();
    if (id === "") {
        throw new TypeError(`${caller} must not be empty.`);
    }
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) {
        throw new TypeError(`${caller} must start with a letter and contain only letters, numbers, underscores, or hyphens.`);
    }

    return id;
}

function validateBoolean(value, caller) {
    if (typeof value !== "boolean") {
        throw new TypeError(`${caller} must be a boolean.`);
    }

    return value;
}

function validateEventColorScope(value, caller) {
    if (typeof value !== "string" || !EVENT_COLOR_SCOPES.includes(value)) {
        throw new RangeError(`${caller} must be "none", "label", "graphic", or "both".`);
    }

    return value;
}

function setOptional(target, key, value, validator, caller) {
    if (value !== undefined) {
        target[key] = validator(value, `${caller}.${key}`);
    }
}

class EmphasisStyle {
    static get displayName() { return "EmphasisStyle"; }
    static get label() { return classLabel(this); }

    constructor(config = {}) {
        const caller = `${this.constructor.label}.ctor`;

        if (!isPlainObject(config)) {
            throw new TypeError(`${caller} must be an object.`);
        }

        const {
            id,
            labels,
            bubbles,
            eventColorScope,
            color,
            iconColor,
            labelColor,
            textColor,
            spanColor,
            lineColor,
            dividerColor
        } = config;
        const normalizedId = validateEmphasisSpecId(id, `${caller}.id`);

        if (normalizedId !== undefined) this.id = normalizedId;

        setOptional(this, "labels", labels, validateBoolean, caller);
        setOptional(this, "bubbles", bubbles, validateBoolean, caller);
        setOptional(this, "eventColorScope", eventColorScope, validateEventColorScope, caller);
        setOptional(this, "color", color, normalizeColorString, caller);
        setOptional(this, "iconColor", iconColor, normalizeColorString, caller);
        setOptional(this, "labelColor", labelColor, normalizeColorString, caller);
        setOptional(this, "textColor", textColor, normalizeColorString, caller);
        setOptional(this, "spanColor", spanColor, normalizeColorString, caller);
        setOptional(this, "lineColor", lineColor ?? dividerColor, normalizeColorString, caller);

        Object.freeze(this);
    }
}

export { EmphasisStyle };
