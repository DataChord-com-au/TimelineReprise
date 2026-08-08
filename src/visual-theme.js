import { assertColorString } from "./color.js";
import { DisplayProfile } from "./display-profile.js";
import { TIMELINE_ORIENTATIONS } from "./orientation.js";

const _MODULE_LABEL = "TimelineReprise";

function _visualThemeIsPlainObject(value) {
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

    if (_visualThemeIsPlainObject(value)) {
        Object.values(value).forEach(deepFreezePlain);
        return Object.freeze(value);
    }

    return value;
}

function clonePlain(value) {
    if (Array.isArray(value)) {
        return value.map(clonePlain);
    }

    if (_visualThemeIsPlainObject(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, clonePlain(item)])
        );
    }

    return value;
}

function collectExplicitFields(value, prefix = [], fields = new Set()) {
    if (!_visualThemeIsPlainObject(value)) return fields;

    for (const [key, item] of Object.entries(value)) {
        if (item === undefined) continue;

        const path = [...prefix, key];
        fields.add(path.join("."));
        collectExplicitFields(item, path, fields);
    }

    return fields;
}

function mergePlain(base, override) {
    const result = clonePlain(base);

    for (const [key, value] of Object.entries(override)) {
        if (value === undefined) continue;

        result[key] = _visualThemeIsPlainObject(value) &&
            _visualThemeIsPlainObject(result[key])
            ? mergePlain(result[key], value)
            : clonePlain(value);
    }

    return result;
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

const _VISUAL_THEME_COLOR_SCOPES = Object.freeze(['none', 'label', 'graphic', 'both']);
const _LABEL_COLOR_SOURCES = Object.freeze(['graphic', 'theme', 'inherit']);
const _LABEL_FLOWS = Object.freeze(['normal', 'orthogonal']);
const _RANGE_LABEL_ALIGNS = Object.freeze(['start', 'center']);
const _VISUAL_THEME_FIELDS = new Set([
    'id',
    'disableEmphasis',
    'eventColorScope',
    'spans',
    'dividers',
    'labels',
    'bubbles',
    'tooltips',
    'track',
    'instant',
    'range',
    'label',
    'bubble',
    'layer',
    'tagsToIconColor',
    'presentation'
]);
const _ORIENTATION_FIELDS = [...TIMELINE_ORIENTATIONS];
const _TRACK_FIELDS = new Set([
    'count',
    'offset',
    'endPadding',
    'size',
    'gap',
    'align',
    ..._ORIENTATION_FIELDS
]);
const _INSTANT_FIELDS = new Set([
    'iconColor',
    'width',
    'height',
    'tickWidth',
    'lineWidth',
    'cssClass',
    ..._ORIENTATION_FIELDS
]);
const _RANGE_FIELDS = new Set([
    'iconColor',
    'colors',
    'width',
    'offset',
    'size',
    'eventRoutingThreshold',
    'tapeGap',
    'sparklineStagger',
    'toEventGap',
    'cssClass',
    'short',
    ..._ORIENTATION_FIELDS
]);
const _SHORT_RANGE_FIELDS = new Set([
    'minDisplayLength'
]);
const _LABEL_FIELDS = new Set([
    'stickyInset',
    'offset',
    'toRangeGap',
    'toInstantGap',
    'toRangeBlockGap',
    'routingGap',
    'trackGap',
    'width',
    'length',
    'rangeCssClass',
    'instantCssClass',
    'color',
    'colorSource',
    'flow',
    'rangeAlign',
    ..._ORIENTATION_FIELDS
]);
const _BUBBLE_FIELDS = new Set([
    'width',
    'maxHeight'
]);
const _LAYER_FIELDS = new Set([
    'zIndex',
    'dividerZIndex',
    'labelZIndex'
]);
const _VISUAL_THEME_DEFAULTS = Object.freeze({
    disableEmphasis: false,
    eventColorScope: 'graphic',
    spans: true,
    dividers: true,
    labels: true,
    bubbles: true,
    tooltips: true,
    track: {
        horizontal: {
            count: 1,
            offset: 2,
            size: 18,
            gap: 4,
            align: 'start'
        },
        vertical: {
            count: 1,
            offset: 2,
            size: 120,
            gap: 4,
            align: 'start'
        }
    },
    instant: {
        iconColor: 'blue',
        width: 9,
        height: 9,
        tickWidth: 1,
        lineWidth: 1,
        cssClass: '',
        horizontal: {},
        vertical: {}
    },
    range: {
        iconColor: 'blue',
        colors: ['blue'],
        width: 4,
        offset: 0,
        cssClass: '',
        short: { minDisplayLength: 4 },
        horizontal: {
            eventRoutingThreshold: 28,
            tapeGap: 6,
            sparklineStagger: 8
        },
        vertical: {
            eventRoutingThreshold: 28,
            tapeGap: 6,
            toEventGap: 12
        }
    },
    label: {
        flow: 'normal',
        colorSource: 'graphic',
        rangeCssClass: '',
        instantCssClass: '',
        horizontal: {
            rangeAlign: 'start',
            stickyInset: 2,
            offset: 0,
            toRangeGap: 4,
            toInstantGap: 4,
            toRangeBlockGap: 15,
            routingGap: 8,
            trackGap: 2
        },
        vertical: {
            rangeAlign: 'start',
            stickyInset: 2,
            offset: 0,
            toRangeGap: 4,
            toInstantGap: 4,
            toRangeBlockGap: 15,
            routingGap: 4,
            trackGap: 2,
            width: 120,
            length: null
        }
    },
    bubble: {
        width: 320,
        maxHeight: null
    },
    layer: {
        zIndex: 5,
        dividerZIndex: 101,
        labelZIndex: 114
    },
    tagsToIconColor: {},
    presentation: null
});

class VisualTheme {
    static get displayName() { return 'VisualTheme'; }
    static get label() { return `${_MODULE_LABEL}.${this.displayName || this.name || '<anonymous class>'}`; }

    static #assertPlainObject(value, caller) {
        if (!_visualThemeIsPlainObject(value)) {
            throw new TypeError(`${caller} must be an object.`);
        }
    }

    static #assertKnownFields(value, fields, caller) {
        for (const field of Object.keys(value)) {
            if (!fields.has(field)) {
                throw new TypeError(`${caller}.${field} is not supported.`);
            }
        }
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

        if (typeof value !== 'string' || !_VISUAL_THEME_COLOR_SCOPES.includes(value)) {
            throw new RangeError(`${caller} must be 'none', 'label', 'graphic', or 'both'.`);
        }
    }

    static #assertTrackSpec(spec, caller) {
        this.#assertPlainObject(spec, caller);
        this.#assertKnownFields(spec, _TRACK_FIELDS, caller);

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
        this.#assertKnownFields(spec, _INSTANT_FIELDS, caller);

        this.#assertColor(spec.iconColor, `${caller}.iconColor`);
        this.#assertNumber(spec.width, `${caller}.width`, { positive: true });
        this.#assertNumber(spec.height, `${caller}.height`, { positive: true });
        this.#assertNumber(spec.tickWidth, `${caller}.tickWidth`, { positive: true });
        this.#assertNumber(spec.lineWidth, `${caller}.lineWidth`, { positive: true });
        this.#assertString(spec.cssClass, `${caller}.cssClass`);
    }

    static #assertRangeSpec(spec, caller) {
        this.#assertPlainObject(spec, caller);
        this.#assertKnownFields(spec, _RANGE_FIELDS, caller);

        this.#assertColor(spec.iconColor, `${caller}.iconColor`);
        this.#assertColorList(spec.colors, `${caller}.colors`);
        this.#assertNumber(spec.width, `${caller}.width`, { positive: true });
        this.#assertNumber(spec.offset, `${caller}.offset`);
        this.#assertNumber(spec.size, `${caller}.size`, { positive: true });
        this.#assertNumber(spec.eventRoutingThreshold, `${caller}.eventRoutingThreshold`, { positive: true });
        this.#assertNumber(spec.tapeGap, `${caller}.tapeGap`, { nonNegative: true });
        this.#assertNumber(spec.sparklineStagger, `${caller}.sparklineStagger`, { nonNegative: true });
        this.#assertNumber(spec.toEventGap, `${caller}.toEventGap`, { nonNegative: true });
        this.#assertString(spec.cssClass, `${caller}.cssClass`);

        if (spec.short !== undefined) {
            this.#assertPlainObject(spec.short, `${caller}.short`);
            this.#assertKnownFields(spec.short, _SHORT_RANGE_FIELDS, `${caller}.short`);
            this.#assertNumber(spec.short.minDisplayLength, `${caller}.short.minDisplayLength`, { positive: true });
        }
    }

    static #assertLabelSpec(spec, caller) {
        this.#assertPlainObject(spec, caller);
        this.#assertKnownFields(spec, _LABEL_FIELDS, caller);

        this.#assertNumber(spec.stickyInset, `${caller}.stickyInset`, { nonNegative: true });
        this.#assertNumber(spec.offset, `${caller}.offset`);
        this.#assertNumber(spec.toRangeGap, `${caller}.toRangeGap`, { nonNegative: true });
        this.#assertNumber(spec.toInstantGap, `${caller}.toInstantGap`, { nonNegative: true });
        this.#assertNumber(spec.toRangeBlockGap, `${caller}.toRangeBlockGap`, { nonNegative: true });
        this.#assertNumber(spec.routingGap, `${caller}.routingGap`, { nonNegative: true });
        this.#assertNumber(spec.trackGap, `${caller}.trackGap`, { nonNegative: true });
        this.#assertNumber(spec.width, `${caller}.width`, { positive: true });
        if (spec.length !== null) {
            this.#assertNumber(spec.length, `${caller}.length`, { positive: true });
        }
        this.#assertString(spec.rangeCssClass, `${caller}.rangeCssClass`);
        this.#assertString(spec.instantCssClass, `${caller}.instantCssClass`);
        this.#assertColor(spec.color, `${caller}.color`);

        if (spec.colorSource !== undefined && !_LABEL_COLOR_SOURCES.includes(spec.colorSource)) {
            throw new RangeError(`${caller}.colorSource must be 'graphic', 'theme', or 'inherit'.`);
        }

        if (spec.flow !== undefined && !_LABEL_FLOWS.includes(spec.flow)) {
            throw new RangeError(`${caller}.flow must be 'normal' or 'orthogonal'.`);
        }

        if (spec.rangeAlign !== undefined && !_RANGE_LABEL_ALIGNS.includes(spec.rangeAlign)) {
            throw new RangeError(`${caller}.rangeAlign must be 'start' or 'center'.`);
        }
    }

    static #assertBubbleSpec(spec, caller) {
        this.#assertPlainObject(spec, caller);
        this.#assertKnownFields(spec, _BUBBLE_FIELDS, caller);

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
        this.#assertKnownFields(spec, _LAYER_FIELDS, caller);

        this.#assertNumber(spec.zIndex, `${caller}.zIndex`);
        this.#assertNumber(spec.dividerZIndex, `${caller}.dividerZIndex`);
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

    static #assertPresentation(value, caller) {
        if (value == null || value instanceof DisplayProfile) return;
        if (typeof value !== "string") {
            throw new TypeError(
                `${caller} must be a DisplayProfile or registered profile id.`
            );
        }

        validateThemeSpecId(value, caller);
    }

    static #assertThemeShape(theme, caller) {
        for (const field of Object.keys(theme)) {
            if (!_VISUAL_THEME_FIELDS.has(field)) {
                throw new TypeError(`${caller}.${field} is not a supported visual theme field.`);
            }
        }

        this.#assertBoolean(theme.disableEmphasis, `${caller}.disableEmphasis`);
        this.#assertEventColorScope(theme.eventColorScope, `${caller}.eventColorScope`);
        this.#assertBoolean(theme.spans, `${caller}.spans`);
        this.#assertBoolean(theme.dividers, `${caller}.dividers`);
        this.#assertBoolean(theme.labels, `${caller}.labels`);
        this.#assertBoolean(theme.bubbles, `${caller}.bubbles`);
        this.#assertBoolean(theme.tooltips, `${caller}.tooltips`);
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
        this.#assertPresentation(theme.presentation, `${caller}.presentation`);
    }

    constructor(config = {}, options = {}) {
        const caller = `${this.constructor.label}.ctor`;
        this.constructor.#assertPlainObject(config, caller);

        const theme = mergePlain(_VISUAL_THEME_DEFAULTS, config);
        const id = validateThemeSpecId(config.id, `${caller}.id`);
        const explicitFields = options.explicitFields instanceof Set
            ? new Set(options.explicitFields)
            : collectExplicitFields(config);

        if (id === undefined) {
            delete theme.id;
        } else {
            theme.id = id;
        }

        this.constructor.#assertThemeShape(theme, caller);

        Object.defineProperty(this, "_repriseExplicitFields", {
            configurable: false,
            enumerable: false,
            value: explicitFields
        });
        Object.assign(this, deepFreezePlain(theme));
        Object.freeze(this);
    }

    _hasConfigured(path) {
        const key = Array.isArray(path) ? path.join(".") : String(path);
        return this._repriseExplicitFields.has(key);
    }
}

function deriveVisualTheme(base, overrides = {}) {
    if (!(base instanceof VisualTheme)) {
        throw new TypeError(`${_MODULE_LABEL}.deriveVisualTheme \`base\` must be a VisualTheme.`);
    }
    if (!_visualThemeIsPlainObject(overrides)) {
        throw new TypeError(`${_MODULE_LABEL}.deriveVisualTheme \`overrides\` must be an object.`);
    }

    const explicitFields = new Set(base._repriseExplicitFields ?? []);
    for (const path of collectExplicitFields(overrides)) {
        explicitFields.add(path);
    }

    return new VisualTheme(mergePlain(
        Object.fromEntries(Object.entries(base)),
        overrides
    ), { explicitFields });
}

const defaultVisualTheme = new VisualTheme();

export { VisualTheme, defaultVisualTheme, deriveVisualTheme };
