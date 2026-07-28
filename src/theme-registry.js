import { EmphasisStyle } from "./emphasis-style.js";
import { DisplayProfile } from "./display-profile.js";
import { EventTheme, defaultEventTheme } from "./event-theme.js";

const REGISTRY_MODULE_LABEL = "TimelineReprise";
const REGISTRY_SPEC_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
let eventThemesById = Object.freeze({});
let displayProfilesById = Object.freeze({});

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

function loadDisplayProfiles(displayProfiles, { templateRenderer } = {}) {
    const caller = `${REGISTRY_MODULE_LABEL}.loadDisplayProfiles \`displayProfiles\``;

    if (displayProfiles == null) {
        displayProfilesById = keyItemsById([], caller);
        return displayProfilesById;
    }
    if (!Array.isArray(displayProfiles)) {
        throw new TypeError(`${caller} must be an array.`);
    }

    displayProfilesById = keyItemsById(
        displayProfiles.map(config =>
            config instanceof DisplayProfile
                ? config
                : new DisplayProfile(config, { templateRenderer })
        ),
        caller
    );

    return displayProfilesById;
}

function resolveDisplayProfile(explicit) {
    const caller = `${REGISTRY_MODULE_LABEL}.resolveDisplayProfile`;

    if (typeof explicit === "string") {
        const id = validateSpecId(explicit, caller, "explicit");
        const namedProfile = displayProfilesById[id];

        if (namedProfile === undefined) {
            throw new RangeError(`${caller} unknown DisplayProfile: ${id}.`);
        }

        return namedProfile;
    }

    if (explicit instanceof DisplayProfile) return explicit;
    if (explicit == null) return null;

    throw new TypeError(
        `${caller} \`explicit\` must be a DisplayProfile or registered profile id.`
    );
}

function loadEventThemes(eventThemes) {
    const caller = `${REGISTRY_MODULE_LABEL}.loadEventThemes \`eventThemes\``;

    if (eventThemes == null) {
        eventThemesById = keyItemsById([], caller);
        return eventThemesById;
    }
    if (!Array.isArray(eventThemes)) {
        throw new TypeError(`${caller} must be an array.`);
    }

    const items = eventThemes.map(config =>
        config instanceof EventTheme ? config : new EventTheme(config)
    );
    items.forEach(theme => resolveDisplayProfile(theme.presentation));

    eventThemesById = keyItemsById(
        items,
        caller
    );

    return eventThemesById;
}

function resolveEventTheme(explicit, nativeTheme) {
    const caller = `${REGISTRY_MODULE_LABEL}.resolveEventTheme`;

    if (typeof explicit === "string") {
        const id = validateSpecId(explicit, caller, "explicit");
        const namedTheme = eventThemesById[id];

        if (namedTheme === undefined) {
            throw new RangeError(`${caller} unknown EventTheme: ${id}.`);
        }

        return namedTheme;
    }

    if (explicit instanceof EventTheme) {
        return explicit;
    }

    if (explicit != null) {
        throw new TypeError(`${caller} \`explicit\` must be an EventTheme or registered theme id.`);
    }

    const authoredTheme = nativeTheme?.eventTheme;
    if (authoredTheme instanceof EventTheme) {
        return authoredTheme;
    }

    const resolved = authoredTheme == null
        ? defaultEventTheme
        : new EventTheme(authoredTheme);

    if (nativeTheme != null && typeof nativeTheme === "object") {
        nativeTheme.eventTheme = resolved;
    }

    return resolved;
}

function composeEventTheme(nativeTheme, explicit = null) {
    const caller = `${REGISTRY_MODULE_LABEL}.composeEventTheme`;

    if (
        nativeTheme == null ||
        typeof nativeTheme !== "object" ||
        Array.isArray(nativeTheme)
    ) {
        throw new TypeError(`${caller} \`nativeTheme\` must be an object.`);
    }

    const resolved = resolveEventTheme(explicit, nativeTheme);
    nativeTheme.eventTheme = resolved;
    return resolved;
}

export {
    composeEventTheme,
    keyItemsById,
    loadDisplayProfiles,
    loadEmphasisStyles,
    loadEventThemes,
    resolveDisplayProfile,
    resolveEventTheme,
    selectItemsById,
    validateSpecId
};
