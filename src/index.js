import { assertColorString, normalizeColorString } from "./color.js";
import { DATE_TIME_UNIT_NAMES, resolveTimelineDateTimeUnit } from "./date-time.js";
import { EmphasisStyle } from "./emphasis-style.js";
import { DisplayProfile } from "./display-profile.js";
import { VisualTheme, defaultVisualTheme, deriveVisualTheme } from "./visual-theme.js";
import { filterEvents } from "./event-filters.js";
import {
    HistoricalYear,
    HistoricalYearLabeller,
    HistoricalYearUnit,
    Ma,
    MaLabeller,
    MaUnit,
    PlanningDayLabeller,
    PlanningDayUnit
} from "./units.js";
import { RepriseRuntime } from "./presentation-runtime.js";
import { TemplateRenderer } from "./template-renderer.js";
import {
    TIMELINE_ORIENTATIONS,
    assertTimelineOrientation,
    normalizeTimelineOrientation
} from "./orientation.js";
import {
    composeVisualTheme,
    keyItemsById,
    loadDisplayProfiles,
    loadEmphasisStyles,
    loadVisualThemes,
    resolveDisplayProfile,
    resolveVisualTheme,
    selectItemsById,
    validateSpecId
} from "./theme-registry.js";
import {
    attachEvents,
    attachNarrativeDecorators
} from "./attachments.js";
import {
    createBand,
    createBandSet,
    createTimeline
} from "./bands.js";
import { attachCardinalAxis } from "./cardinal-axis.js";
import { clampBandChains } from "./clamping.js";
import { Reprise } from "./version.js";
import "./core.js";
import "./ether-interval-marker.js";
import "./overview.js";
import "./scaled-zones.js";
import "./event-layout.js";
import "./narrative.js";

export {
    DATE_TIME_UNIT_NAMES,
    DisplayProfile,
    EmphasisStyle,
    TIMELINE_ORIENTATIONS,
    VisualTheme,
    HistoricalYear,
    HistoricalYearLabeller,
    HistoricalYearUnit,
    Ma,
    MaLabeller,
    MaUnit,
    PlanningDayLabeller,
    PlanningDayUnit,
    Reprise,
    RepriseRuntime,
    TemplateRenderer,
    attachCardinalAxis,
    attachEvents,
    attachNarrativeDecorators,
    createBand,
    createBandSet,
    createTimeline,
    clampBandChains,
    composeVisualTheme,
    assertColorString,
    assertTimelineOrientation,
    defaultVisualTheme,
    deriveVisualTheme,
    filterEvents,
    keyItemsById,
    loadDisplayProfiles,
    loadEmphasisStyles,
    loadVisualThemes,
    normalizeColorString,
    normalizeTimelineOrientation,
    resolveDisplayProfile,
    resolveVisualTheme,
    resolveTimelineDateTimeUnit,
    selectItemsById,
    validateSpecId
};

export const stylesheets = [
    "./css/timeline-layout.css",
    "./css/band-background.css",
    "./css/dark-mode.css"
];
