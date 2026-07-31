import { assertColorString, normalizeColorString } from "./color.js";
import { DATE_TIME_UNIT_NAMES, resolveTimelineDateTimeUnit } from "./date-time.js";
import { EmphasisStyle } from "./emphasis-style.js";
import { DisplayProfile } from "./display-profile.js";
import { EventTheme, defaultEventTheme, deriveEventTheme } from "./event-theme.js";
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
    composeEventTheme,
    keyItemsById,
    loadDisplayProfiles,
    loadEmphasisStyles,
    loadEventThemes,
    resolveDisplayProfile,
    resolveEventTheme,
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
    EventTheme,
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
    composeEventTheme,
    assertColorString,
    assertTimelineOrientation,
    defaultEventTheme,
    deriveEventTheme,
    filterEvents,
    keyItemsById,
    loadDisplayProfiles,
    loadEmphasisStyles,
    loadEventThemes,
    normalizeColorString,
    normalizeTimelineOrientation,
    resolveDisplayProfile,
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
