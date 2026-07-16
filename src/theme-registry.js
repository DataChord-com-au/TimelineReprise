import { EmphasisStyle } from "./emphasis-style.js";
import { EventTheme } from "./event-theme.js";

const REGISTRY_MODULE_LABEL = "TimelineReprise";
const REGISTRY_SPEC_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

function deepFreezeRegistryPlain(value) {
    if (value != null && typeof value === "object" && !Object.isFrozen(value)) {
        Object.values(value).forEach(deepFreezeRegistryPlain);
        Object.freeze(value);
    }

    return value;
}

function validateSpecId(id, caller, path = "id") {
    if (typeof id !== "string") {
        throw new TypeError(`${caller} \`${path}\` must be a string.`);
    }

    if (!REGISTRY_SPEC_ID_PATTERN.test(id)) {
        throw new RangeError(
            `${caller} \`${path}\` must start with a letter and contain only letters, numbers, underscores, or hyphens: ${id}.`
        );
    }

    return id;
}

function keyItemsById(items, caller = `${REGISTRY_MODULE_LABEL}.keyItemsById`) {
    if (!Array.isArray(items)) {
        throw new TypeError(`${caller} \`items\` must be an array.`);
    }

    const byId = {};

    for (const item of items) {
        const id = validateSpecId(item?.id, caller);

        if (Object.prototype.hasOwnProperty.call(byId, id)) {
            throw new RangeError(`${caller} duplicate id: ${id}.`);
        }

        byId[id] = item;
    }

    return deepFreezeRegistryPlain(byId);
}

function selectItemsById(specs, selection = [], caller = `${REGISTRY_MODULE_LABEL}.selectItemsById`) {
    if (!Array.isArray(specs)) {
        throw new TypeError(`${caller} \`specs\` must be an array.`);
    }

    const keys = selection == null
        ? []
        : Array.isArray(selection)
            ? selection
            : [selection];
    const selectedIds = new Set(keys.map((id, index) =>
        validateSpecId(id, caller, `selection[${index}]`)
    ));
    const selectedSpecs = selectedIds.size === 0
        ? specs
        : specs.filter(spec => selectedIds.has(spec?.id));

    return keyItemsById(selectedSpecs, caller);
}

function loadEmphasisStyles(emphasisStyles) {
    const caller = `${REGISTRY_MODULE_LABEL}.loadEmphasisStyles \`emphasisStyles\``;

    if (emphasisStyles == null) return keyItemsById([], caller);
    if (!Array.isArray(emphasisStyles)) {
        throw new TypeError(`${caller} must be an array.`);
    }

    return keyItemsById(
        emphasisStyles.map(config => new EmphasisStyle(config)),
        caller
    );
}

function loadEventThemes(eventThemes) {
    const caller = `${REGISTRY_MODULE_LABEL}.loadEventThemes \`eventThemes\``;

    if (eventThemes == null) return keyItemsById([], caller);
    if (!Array.isArray(eventThemes)) {
        throw new TypeError(`${caller} must be an array.`);
    }

    return keyItemsById(
        eventThemes.map(config => new EventTheme(config)),
        caller
    );
}

export {
    keyItemsById,
    loadEmphasisStyles,
    loadEventThemes,
    selectItemsById,
    validateSpecId
};
