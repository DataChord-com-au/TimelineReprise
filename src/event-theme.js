import { assertColorString } from "./color.js";
import { TIMELINE_ORIENTATIONS } from "./orientation.js";

const _MODULE_LABEL = "TimelineReprise";

function _isPlainObject(value) {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    if (Object.prototype.toString.call(value) !== "[object Object]") {
        return false;
    }

    const proto = Object.getPrototypeOf(value);
    return proto === null || proto.constructor?.name === "Object";
}

function deepFreezePlain(value) {
    if (Array.isArray(value)) {
        value.forEach(deepFreezePlain);
        return Object.freeze(value);
    }

    if (_isPlainObject(value)) {
        Object.values(value).forEach(deepFreezePlain);
        return Object.freeze(value);
    }

    return value;
}

function validateThemeSpecId(value, caller) {
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

const _EVENT_THEME_COLOR_SCOPES = Object.freeze(['none', 'label', 'graphic', 'both']);
const _LABEL_COLOR_SOURCES = Object.freeze(['graphic', 'theme', 'inherit']);
const _EVENT_THEME_FIELDS = new Set([
    'id',
    'disableEmphasis',
    'eventColorScope',
    'spans',
    'dividers',
    'labels',
    'bubbles',
    'track',
    'instant',
    'range',
    'label',
    'bubble',
    'layer',
    'tagsToIconColor'
]);

class EventTheme {
    static get displayName() { return 'EventTheme'; }
    static get label() { return `${_MODULE_LABEL}.${this.displayName || this.name || '<anonymous class>'}`; }

    static #assertPlainObject(value, caller) {
        if (!_isPlainObject(value)) {
            throw new TypeError(`${caller} must be an object.`);
        }
    }

    static #clonePlain(value) {
        if (Array.isArray(value)) {
            return value.map(item => this.#clonePlain(item));
        }

        if (_isPlainObject(value)) {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, this.#clonePlain(item)])
            );
        }

        return value;
    }

    static #assertNumber(value, caller, { positive = false, nonNegative = false } = {}) {
        if (value === undefined) return;

        if (!Number.isFinite(value) || (positive && value <= 0) || (nonNegative && value < 0)) {
            throw new RangeError(
                `${caller} must be a ${positive ? 'positive ' : nonNegative ? 'non-negative ' : ''}finite number.`
            );
        }
    }

    static #assertBoolean(value, caller) {
        if (value === undefined) return;

        if (typeof value !== 'boolean') {
            throw new TypeError(`${caller} must be a boolean.`);
        }
    }

    static #assertString(value, caller) {
        if (value === undefined) return;

        if (typeof value !== 'string') {
            throw new TypeError(`${caller} must be a string.`);
        }
    }

    static #assertColor(value, caller) {
        if (value === undefined) return;

        assertColorString(value, caller);
    }

    static #assertColorList(value, caller) {
        if (value === undefined) return;

        if (!Array.isArray(value)) {
            throw new TypeError(`${caller} must be an array of CSS color strings.`);
        }

        value.forEach((color, index) => assertColorString(color, `${caller}[${index}]`));
    }

    static #assertEventColorScope(value, caller) {
        if (value === undefined) return;

        if (typeof value !== 'string' || !_EVENT_THEME_COLOR_SCOPES.includes(value)) {
            throw new RangeError(`${caller} must be 'none', 'label', 'graphic', or 'both'.`);
        }
    }

    static #assertTrackSpec(spec, caller) {
        this.#assertPlainObject(spec, caller);

        this.#assertNumber(spec.count, `${caller}.count`, { positive: true });
        this.#assertNumber(spec.offset, `${caller}.offset`);
        this.#assertNumber(spec.endPadding, `${caller}.endPadding`, { nonNegative: true });
        this.#assertNumber(spec.size, `${caller}.size`, { positive: true });
        this.#assertNumber(spec.gap, `${caller}.gap`, { nonNegative: true });

        if (spec.align !== undefined) {
            const align = String(spec.align).trim().toLowerCase();
            if (align !== 'start' && align !== 'end') {
                throw new RangeError(`${caller}.align must be 'start' or 'end'.`);
            }
        }

    }

    static #assertInstantSpec(spec, caller) {
        this.#assertPlainObject(spec, caller);

        this.#assertColor(spec.iconColor, `${caller}.iconColor`);
        this.#assertColorList(spec.colors, `${caller}.colors`);
        this.#assertNumber(spec.width, `${caller}.width`, { positive: true });
        this.#assertNumber(spec.height, `${caller}.height`, { positive: true });
        this.#assertNumber(spec.tickWidth, `${caller}.tickWidth`, { positive: true });
        this.#assertNumber(spec.toLabelGap, `${caller}.toLabelGap`, { nonNegative: true });
        this.#assertString(spec.cssClass, `${caller}.cssClass`);
        this.#assertString(spec.labelCssClass, `${caller}.labelCssClass`);
    }

    static #assertRangeSpec(spec, caller) {
        this.#assertPlainObject(spec, caller);

        this.#assertColor(spec.iconColor, `${caller}.iconColor`);
        this.#assertColorList(spec.colors, `${caller}.colors`);
        this.#assertNumber(spec.width, `${caller}.width`, { positive: true });
        this.#assertNumber(spec.offset, `${caller}.offset`);
        this.#assertNumber(spec.size, `${caller}.size`, { positive: true });
        this.#assertNumber(spec.eventRoutingThreshold, `${caller}.eventRoutingThreshold`, { positive: true });
        this.#assertNumber(spec.tapeGap, `${caller}.tapeGap`, { nonNegative: true });
        this.#assertNumber(spec.toLabelGap, `${caller}.toLabelGap`, { nonNegative: true });
        this.#assertNumber(spec.labelRoutingGap, `${caller}.labelRoutingGap`, { nonNegative: true });
        this.#assertNumber(spec.labelTrackGap, `${caller}.labelTrackGap`, { nonNegative: true });
        this.#assertNumber(spec.labelWidth, `${caller}.labelWidth`, { positive: true });
        this.#assertNumber(spec.sparklineStagger, `${caller}.sparklineStagger`, { nonNegative: true });
        this.#assertNumber(spec.stickyLeftInset, `${caller}.stickyLeftInset`, { nonNegative: true });
        this.#assertNumber(spec.stickyTopInset, `${caller}.stickyTopInset`, { nonNegative: true });
        this.#assertNumber(spec.toEventGap, `${caller}.toEventGap`, { nonNegative: true });
        this.#assertString(spec.cssClass, `${caller}.cssClass`);
        this.#assertString(spec.labelCssClass, `${caller}.labelCssClass`);

        if (spec.short !== undefined) {
            this.#assertPlainObject(spec.short, `${caller}.short`);
            this.#assertNumber(spec.short.minDisplayLength, `${caller}.short.minDisplayLength`, { positive: true });
        }
    }

    static #assertLabelSpec(spec, caller) {
        this.#assertPlainObject(spec, caller);

        this.#assertNumber(spec.stickyInset, `${caller}.stickyInset`, { nonNegative: true });
        this.#assertNumber(spec.stickyGap, `${caller}.stickyGap`, { nonNegative: true });
        this.#assertNumber(spec.offset, `${caller}.offset`);
        this.#assertColor(spec.color, `${caller}.color`);

        if (spec.colorSource !== undefined && !_LABEL_COLOR_SOURCES.includes(spec.colorSource)) {
            throw new RangeError(`${caller}.colorSource must be 'graphic', 'theme', or 'inherit'.`);
        }
    }

    static #assertBubbleSpec(spec, caller) {
        this.#assertPlainObject(spec, caller);

        this.#assertBoolean(spec.enabled, `${caller}.enabled`);
        this.#assertBoolean(spec.showTags, `${caller}.showTags`);
        this.#assertNumber(spec.width, `${caller}.width`, { positive: true });
        if (spec.maxHeight !== null) {
            this.#assertNumber(spec.maxHeight, `${caller}.maxHeight`, { positive: true });
        }
    }

    static #assertOrientableSpec(spec, caller, validator) {
        validator.call(this, spec, caller);

        for (const orientation of TIMELINE_ORIENTATIONS) {
            if (spec[orientation] !== undefined) {
                validator.call(this, spec[orientation], `${caller}.${orientation}`);
            }
        }
    }

    static #assertLayerSpec(spec, caller) {
        this.#assertPlainObject(spec, caller);

        this.#assertNumber(spec.zIndex, `${caller}.zIndex`);
        this.#assertNumber(spec.labelZIndex, `${caller}.labelZIndex`);
    }

    static #assertTagsToIconColor(spec, caller) {
        this.#assertPlainObject(spec, caller);

        for (const [tag, color] of Object.entries(spec)) {
            const tagName = tag.trim().toLowerCase();
            if (tagName === '') {
                throw new TypeError(`${caller} tag names must not be empty.`);
            }

            assertColorString(color, `${caller}.${tagName}`);
        }
    }

    static #assertThemeShape(theme, caller) {
        for (const field of Object.keys(theme)) {
            if (!_EVENT_THEME_FIELDS.has(field)) {
                throw new TypeError(`${caller}.${field} is not a supported event theme field.`);
            }
        }

        this.#assertBoolean(theme.disableEmphasis, `${caller}.disableEmphasis`);
        this.#assertEventColorScope(theme.eventColorScope, `${caller}.eventColorScope`);
        this.#assertBoolean(theme.spans, `${caller}.spans`);
        this.#assertBoolean(theme.dividers, `${caller}.dividers`);
        this.#assertBoolean(theme.labels, `${caller}.labels`);
        this.#assertBoolean(theme.bubbles, `${caller}.bubbles`);
        if (theme.track !== undefined) {
            this.#assertOrientableSpec(theme.track, `${caller}.track`, this.#assertTrackSpec);
        }

        if (theme.instant !== undefined) {
            this.#assertOrientableSpec(theme.instant, `${caller}.instant`, this.#assertInstantSpec);
        }

        if (theme.range !== undefined) {
            this.#assertOrientableSpec(theme.range, `${caller}.range`, this.#assertRangeSpec);
        }

        if (theme.label !== undefined) {
            this.#assertOrientableSpec(theme.label, `${caller}.label`, this.#assertLabelSpec);
        }

        if (theme.bubble !== undefined) {
            this.#assertBubbleSpec(theme.bubble, `${caller}.bubble`);
        }

        if (theme.layer !== undefined) {
            this.#assertLayerSpec(theme.layer, `${caller}.layer`);
        }

        if (theme.tagsToIconColor !== undefined) {
            this.#assertTagsToIconColor(theme.tagsToIconColor, `${caller}.tagsToIconColor`);
        }
    }

    constructor(config = {}) {
        const caller = `${this.constructor.label}.ctor`;
        this.constructor.#assertPlainObject(config, caller);

        const theme = this.constructor.#clonePlain(config);
        const id = validateThemeSpecId(theme.id, `${caller}.id`);

        if (id === undefined) {
            delete theme.id;
        } else {
            theme.id = id;
        }

        this.constructor.#assertThemeShape(theme, caller);

        Object.assign(this, deepFreezePlain(theme));
        Object.freeze(this);
    }
}

export { EventTheme };
