const TIMELINE_ORIENTATIONS = Object.freeze(["horizontal", "vertical"]);

function assertTimelineOrientation(value, caller) {
    if (!TIMELINE_ORIENTATIONS.includes(value)) {
        throw new RangeError(`${caller} must be "horizontal" or "vertical".`);
    }
}

function normalizeTimelineOrientation(value, caller) {
    const orientation = String(value ?? "horizontal").trim().toLowerCase();
    assertTimelineOrientation(orientation, caller);
    return orientation;
}

export {
    TIMELINE_ORIENTATIONS,
    assertTimelineOrientation,
    normalizeTimelineOrientation
};
