import { normalizeTimelineOrientation } from "./orientation.js";

function normalizeMarkerLength(value, caller) {
    if (value === undefined || value === null) return value;
    if (typeof value !== "string" || value.trim() === "") {
        throw new TypeError(
            `${caller} markerLength must be a CSS length, 'label', or null.`
        );
    }
    return value.trim();
}

function resolveMarkerPresentationTheme(
    nativeTheme,
    orientation,
    markerLength
) {
    const resolvedOrientation = normalizeTimelineOrientation(
        orientation,
        "TimelineReprise marker orientation"
    );
    const resolvedTheme = { ...(nativeTheme ?? {}) };
    const resolvedEther = { ...(nativeTheme?.ether ?? {}) };
    const resolvedInterval = { ...(nativeTheme?.ether?.interval ?? {}) };
    const resolvedMarker = {
        ...(nativeTheme?.ether?.interval?.marker ?? {})
    };

    if (markerLength !== undefined) {
        resolvedMarker[
            resolvedOrientation === "horizontal" ? "hLength" : "vLength"
        ] = markerLength;
    }

    resolvedInterval.marker = resolvedMarker;
    resolvedEther.interval = resolvedInterval;
    resolvedTheme.ether = resolvedEther;
    return resolvedTheme;
}

export {
    normalizeMarkerLength,
    resolveMarkerPresentationTheme
};
