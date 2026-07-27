import { assertColorString, normalizeColorString } from "./color.js";
import { DATE_TIME_UNIT_NAMES, resolveTimelineDateTimeUnit } from "./date-time.js";
import { EmphasisStyle } from "./emphasis-style.js";
import { EventTheme, defaultEventTheme, deriveEventTheme } from "./event-theme.js";
import { filterEvents } from "./event-filters.js";
import {
    Ma,
    MaLabeller,
    MaUnit,
    PlanningDayLabeller,
    PlanningDayUnit
} from "./units.js";
import { RepriseRuntime } from "./presentation-runtime.js";
import {
    TIMELINE_ORIENTATIONS,
    assertTimelineOrientation,
    normalizeTimelineOrientation
} from "./orientation.js";
import {
    composeEventTheme,
    keyItemsById,
    loadEmphasisStyles,
    loadEventThemes,
    resolveEventTheme,
    selectItemsById,
    validateSpecId
} from "./theme-registry.js";
import {
    attachEvents,
    attachNarrativeDecorators
} from "./attachments.js";
import { clampBandChains } from "./clamping.js";
import { Reprise } from "./version.js";
import "./core.js";
import "./overview.js";
import "./cardinal-axis.js";
import "./scaled-zones.js";
import "./event-layout.js";
import "./narrative.js";

export {
    DATE_TIME_UNIT_NAMES,
    EmphasisStyle,
    TIMELINE_ORIENTATIONS,
    EventTheme,
    Ma,
    MaLabeller,
    MaUnit,
    PlanningDayLabeller,
    PlanningDayUnit,
    Reprise,
    RepriseRuntime,
    attachEvents,
    attachNarrativeDecorators,
    clampBandChains,
    composeEventTheme,
    assertColorString,
    assertTimelineOrientation,
    defaultEventTheme,
    deriveEventTheme,
    filterEvents,
    keyItemsById,
    loadEmphasisStyles,
    loadEventThemes,
    normalizeColorString,
    normalizeTimelineOrientation,
    resolveEventTheme,
    resolveTimelineDateTimeUnit,
    selectItemsById,
    validateSpecId
};

export const stylesheets = [
    "./css/timeline-layout.css",
    "./css/band-background.css",
    "./css/dark-mode.css"
];
