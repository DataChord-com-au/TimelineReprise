import {
    fillRepriseBubble,
    hasRenderedContent,
    renderEventField,
    resolveRepriseRuntime
} from "./presentation-runtime.js";
import {
    captureAttachedEventRenderContext,
    getAttachedEventContext,
    renderAttachedEventField
} from "./attachments.js";

(function () {
    if (!window.Timeline || !Timeline.OriginalEventPainter) return;
    if (Timeline._eventLayout23PatchApplied) return;
    Timeline._eventLayout23PatchApplied = true;

    const HORIZONTAL_INSTANT_ICON_BASELINE_LEFT_OFFSET = 1;
    const HORIZONTAL_INSTANT_LABEL_BASELINE_TOP_OFFSET = 1;
    const HORIZONTAL_INSTANT_EVENT_TOP_OFFSET = -3;
    const VERTICAL_INSTANT_ICON_BASELINE_TOP_OFFSET = 2;
    const DEFAULT_INSTANT_ICON_SIZE = 9;
    const DEFAULT_INSTANT_ICON_COLOR = "blue";
    const DEFAULT_RANGE_TAPE_COLOR = "blue";
    const LEFT_ALIGNED_VERTICAL_MARKER_TRACK_OFFSET = 48;
    const EVENT_GRAPHIC_Z_INDEX = 0;
    const EVENT_SPARKLINE_Z_INDEX = 1;
    const EVENT_LABEL_Z_INDEX = 2;

    function isObject(value) {
        return value != null && typeof value === "object" && !Array.isArray(value);
    }

    function toFiniteNumber(value) {
        if (Number.isFinite(value)) return value;

        if (typeof value === "string" && value.trim() !== "") {
            const number = Number(value);
            if (Number.isFinite(number)) return number;
        }

        return null;
    }

    function finiteOr(value, fallback) {
        return Number.isFinite(value) ? value : fallback;
    }

    function positiveOr(value, fallback) {
        return Number.isFinite(value) && value > 0 ? value : fallback;
    }

    function isDefaultThemeIconElement(elmt) {
        const child = elmt?.firstElementChild || elmt?.firstChild;
        const src = child?.src || child?.getAttribute?.("src") || "";

        return typeof src === "string" && src.indexOf("data-tr-theme-icon") !== -1;
    }

    function applyThemeIconSize(data, metrics) {
        if (!data?.elmt || !isDefaultThemeIconElement(data.elmt)) return;

        const width = positiveOr(metrics?.iconWidth, DEFAULT_INSTANT_ICON_SIZE);
        const height = positiveOr(metrics?.iconHeight, width);
        const child = data.elmt.firstElementChild || data.elmt.firstChild;

        data.width = width;
        data.height = height;
        data.elmt.style.width = width + "px";
        data.elmt.style.height = height + "px";

        if (child) {
            child.style.display = "block";
            child.style.width = width + "px";
            child.style.height = height + "px";
        }
    }

    function maxFinite(fallback, values) {
        let result = fallback;

        for (const value of values) {
            const number = toFiniteNumber(value);
            if (number != null) result = Math.max(result, number);
        }

        return result;
    }

    function resolveCssColor(value) {
        if (typeof value !== "string" || value.trim() === "") return null;

        return Timeline.ThemeIcons?.getCssColor
            ? Timeline.ThemeIcons.getCssColor(value)
            : value;
    }

    function hasDefinedOwn(source, name) {
        return source != null &&
            Object.prototype.hasOwnProperty.call(source, name) &&
            source[name] !== undefined;
    }

    function isFalseValue(value) {
        return value === false ||
            (typeof value === "string" && value.trim().toLowerCase() === "false");
    }

    function isTrueValue(value) {
        return value === true ||
            (typeof value === "string" && value.trim().toLowerCase() === "true");
    }

    function enabledValue(value, fallback) {
        if (isFalseValue(value)) return false;
        if (isTrueValue(value)) return true;
        return fallback;
    }

    function stringValue(value) {
        return typeof value === "string" && value.trim() !== ""
            ? value
            : null;
    }

    function objectValue(source, names) {
        const list = Array.isArray(names) ? names : [names];

        for (const name of list) {
            if (hasDefinedOwn(source, name)) {
                return { found: true, value: source[name] };
            }
        }

        return { found: false, value: undefined };
    }

    function getEventProperty(evt, names) {
        const list = Array.isArray(names) ? names : [names];

        for (const name of list) {
            const value = evt?.getProperty?.(name);
            if (value != null && value !== "") return value;
        }

        return null;
    }

    function getEventEmphasisSpec(evt, theme, visualTheme) {
        if (visualTheme.disableEmphasis) return null;

        const key = stringValue(getEventProperty(evt, "emphasis"));
        if (key == null) return null;

        const specs = isObject(theme?.emphasisSpecs) ? theme.emphasisSpecs : null;
        const spec = specs?.[key];

        return isObject(spec) ? spec : null;
    }

    function getEmphasisValue(evt, theme, visualTheme, names) {
        return objectValue(getEventEmphasisSpec(evt, theme, visualTheme), names);
    }

    function getEmphasisColor(evt, theme, visualTheme, names) {
        const value = getEmphasisValue(
            evt,
            theme,
            visualTheme,
            [...(Array.isArray(names) ? names : [names]), "color"]
        );
        if (!value.found) return null;

        const color = stringValue(value.value);
        return color != null ? resolveCssColor(color) || color : null;
    }

    function labelsEnabled(evt, theme, visualTheme) {
        const emphasisValue = getEmphasisValue(evt, theme, visualTheme, "labels");
        if (emphasisValue.found) return enabledValue(emphasisValue.value, true);

        const eventValue = getEventProperty(evt, "labels");
        if (eventValue != null) return enabledValue(eventValue, true);

        return visualTheme.labels;
    }

    function bubblesEnabled(evt, theme, visualTheme) {
        const emphasisValue = getEmphasisValue(evt, theme, visualTheme, "bubbles");
        if (emphasisValue.found) return enabledValue(emphasisValue.value, true);

        const eventValue = getEventProperty(evt, "bubbles");
        if (eventValue != null) return enabledValue(eventValue, true);

        return visualTheme.bubbles;
    }

    function normalizeEventColorScope(value, fallback) {
        const scope = typeof value === "string"
            ? value.trim().toLowerCase()
            : "";

        return scope === "none" ||
            scope === "label" ||
            scope === "graphic" ||
            scope === "both"
            ? scope
            : fallback;
    }

    function getEventColorScope(evt, visualTheme) {
        return normalizeEventColorScope(
            getEventProperty(evt, "eventColorScope") ??
                visualTheme.eventColorScope,
            visualTheme.eventColorScope
        );
    }

    function getEventColor(evt) {
        return stringValue(evt?.getColor?.());
    }

    function getExplicitLabelColor(evt) {
        return stringValue(getEventProperty(evt, "labelColor")) ||
            stringValue(evt?.getTextColor?.()) ||
            stringValue(getEventProperty(evt, "textColor"));
    }

    function getEventLabelColor(evt, theme, visualTheme) {
        const emphasisColor = getEmphasisColor(
            evt,
            theme,
            visualTheme,
            "labelColor"
        );
        if (emphasisColor != null) return emphasisColor;

        const scope = getEventColorScope(evt, visualTheme);
        if (scope !== "label" && scope !== "both") return null;

        const explicit = getExplicitLabelColor(evt);
        if (explicit != null) return resolveCssColor(explicit) || explicit;

        const eventColor = getEventColor(evt);
        return eventColor != null
            ? resolveCssColor(eventColor) || eventColor
            : null;
    }

    function getEventInstantIconColor(evt, theme, visualTheme) {
        const emphasisColor = getEmphasisColor(evt, theme, visualTheme, "iconColor");
        if (emphasisColor != null) return emphasisColor;

        const scope = getEventColorScope(evt, visualTheme);
        if (scope === "graphic" || scope === "both") {
            const iconColor = stringValue(getEventProperty(evt, "iconColor"));
            if (iconColor != null) return resolveCssColor(iconColor) || iconColor;

            const eventColor = getEventColor(evt);
            if (eventColor != null) {
                return resolveCssColor(eventColor) || eventColor;
            }
        }

        // An authored icon URL is already a more specific graphic than the
        // theme/default dot colour. Event and emphasis colour overrides above
        // still replace it deliberately.
        if (stringValue(evt?.getIcon?.()) != null) return null;

        return stringValue(visualTheme.instant.iconColor) ||
            resolveCssColor(DEFAULT_INSTANT_ICON_COLOR) ||
            DEFAULT_INSTANT_ICON_COLOR;
    }

    function getEventWithThemeIcon(evt, theme, visualTheme, metrics) {
        const color = getEventInstantIconColor(evt, theme, visualTheme);
        if (color == null || typeof Timeline.ThemeIcons?.get !== "function") return evt;

        const width = positiveOr(metrics?.iconWidth, DEFAULT_INSTANT_ICON_SIZE);
        const height = positiveOr(metrics?.iconHeight, width);
        const icon = Timeline.ThemeIcons.get(color, Math.max(width, height));
        if (icon == null) return evt;

        const themedEvent = Object.create(evt);
        themedEvent.getIcon = function () { return icon; };
        return themedEvent;
    }

    function getDefaultGraphicColor(evt, theme, fallback) {
        if (evt?.isInstant?.()) {
            return theme?.event?.instant?.impreciseColor || fallback;
        }

        return theme?.event?.duration?.color || fallback;
    }

    function hidePaintedLabel(data) {
        if (!data?.elmt) return;

        data.elmt.style.display = "none";
        data.elmt.style.pointerEvents = "none";
        data.elmt.setAttribute("aria-hidden", "true");
    }

    function getOrientation(timeline) {
        if (timeline?.isVertical?.()) return "vertical";
        if (timeline?.isHorizontal?.()) return "horizontal";
        return null;
    }

    function getOrientationSpec(value, timeline) {
        if (!isObject(value)) return null;

        const orientation = getOrientation(timeline);
        if (orientation != null && isObject(value[orientation])) return value[orientation];

        return isObject(value.horizontal) || isObject(value.vertical)
            ? null
            : value;
    }

    function resolvePainterVisualTheme(painter, band) {
        const nativeTheme = band?._theme || painter._params?.theme || null;
        const visualTheme = Timeline.resolveVisualTheme(
            painter._params?.visualTheme ?? null,
            nativeTheme
        );

        painter._nativeTheme = nativeTheme;
        painter._visualTheme = visualTheme;
        return visualTheme;
    }

    function resolvePainterRuntime(painter, band, timeline) {
        const unit = timeline?.getUnit?.() ??
            window.SimileAjax?.NativeDateUnit ??
            Timeline.NativeDateUnit;
        const labeller = band?.getLabeller?.() ?? null;
        const runtime = resolveRepriseRuntime(
            painter._params?.runtime ?? null,
            { unit, labeller }
        );

        painter._runtime = runtime;
        return runtime;
    }

    function getPainterVisualTheme(painter, evt) {
        return getAttachedEventContext(evt)?.visualTheme ?? painter._visualTheme;
    }

    function _removeElementTitle(element) {
        if (typeof element?.removeAttribute === "function") {
            element.removeAttribute("title");
        } else if (element != null) {
            delete element.title;
        }
    }

    function _setDynamicCaption(element, value) {
        if (hasRenderedContent(value)) {
            element.title = String(value).replace(/<[^>]*>/g, "");
            element._repriseHasDynamicCaption = true;
        } else if (element._repriseHasDynamicCaption === true) {
            _removeElementTitle(element);
            element._repriseHasDynamicCaption = false;
        }
    }

    function _refreshEventCaption(painter, evt, element) {
        const attachment = getAttachedEventContext(evt);
        const runtime = attachment?.runtime ?? painter._runtime;
        const visualTheme = attachment?.visualTheme ?? painter._visualTheme;
        if (visualTheme?.tooltips === false || runtime == null) return;

        let caption;
        if (attachment != null) {
            const temporal = captureAttachedEventRenderContext(evt);
            caption = renderAttachedEventField(
                evt,
                "caption",
                "text",
                {
                    surface: "label",
                    fresh: true,
                    ...temporal
                }
            );
        } else {
            const eventTime = runtime.readEventTime(evt);
            const currentTime = runtime.readCurrentTime?.() ?? null;
            caption = renderEventField(
                runtime,
                visualTheme,
                eventTime,
                evt,
                "caption",
                "text",
                { surface: "label", currentTime }
            );
        }

        _setDynamicCaption(element, caption);
    }

    function _installEventCaptionRefresh(painter, evt, data) {
        const element = data?.elmt;
        const visualTheme = getPainterVisualTheme(painter, evt);
        if (element == null || visualTheme?.tooltips === false) return;

        const refresh = () => _refreshEventCaption(painter, evt, element);
        if (typeof element.addEventListener === "function") {
            element.addEventListener("mouseenter", refresh);
        } else {
            const previous = element.onmouseenter;
            element.onmouseenter = function () {
                if (typeof previous === "function") {
                    previous.apply(this, arguments);
                }
                refresh();
            };
        }
    }

    function ensureTapeSparklineStyles(doc) {
        if (doc.getElementById("timeline-reprise-tape-sparkline-styles")) return;

        const style = doc.createElement("style");
        style.id = "timeline-reprise-tape-sparkline-styles";
        style.textContent = [
            ".timeline-event-tape-sparkline {",
            "  background: currentColor;",
            "}"
        ].join("\n");

        doc.head.appendChild(style);
    }

    function isHorizontal(painter) {
        return painter._timeline?.isHorizontal?.() === true;
    }

    function isVertical(painter) {
        return painter._timeline?.isVertical?.() === true;
    }

    function getBandMarkerAlign(painter) {
        return painter._band?._bandInfo?.markerAlign ??
            painter._band?.markerAlign ??
            null;
    }

    function isConfiguredTrackOffset(painter) {
        const visualTheme = painter._visualTheme;
        const orientation = getOrientation(painter._timeline);

        return typeof visualTheme?._hasConfigured === "function" &&
            (
                visualTheme._hasConfigured("track.offset") ||
                (orientation != null &&
                    visualTheme._hasConfigured(`track.${orientation}.offset`))
            );
    }

    function getDefaultTrackOffset(painter, nativeTrack) {
        if (
            isVertical(painter) &&
            getBandMarkerAlign(painter) === "Left"
        ) {
            return LEFT_ALIGNED_VERTICAL_MARKER_TRACK_OFFSET;
        }

        return finiteOr(nativeTrack.offset, 2);
    }

    function transposeVerticalPaintedRect(data, { swapSize = false } = {}) {
        const left = data.left;
        const top = data.top;
        const width = data.width;
        const height = data.height;

        data.left = top;
        data.top = left;
        data.elmt.style.left = top + "px";
        data.elmt.style.top = left + "px";

        if (swapSize) {
            data.width = height;
            data.height = width;
            data.elmt.style.width = height + "px";
            data.elmt.style.height = width + "px";
        }

        return data;
    }

    function getEventId(evt) {
        return evt && typeof evt.getID === "function" ? evt.getID() : null;
    }

    function normalizeLane(value) {
        const lane = Number(value);
        return Number.isFinite(lane) && lane >= 0 ? Math.floor(lane) : 0;
    }

    function getTapeSpec(painter) {
        return getOrientationSpec(
            painter._visualTheme?.range,
            painter._timeline
        ) || {};
    }

    function getInstantSpec(painter) {
        return getOrientationSpec(
            painter._visualTheme?.instant,
            painter._timeline
        ) || {};
    }

    function getShortTapeSpec(painter) {
        return painter._visualTheme?.range?.short || {};
    }

    function getRangeWidth(painter) {
        return positiveOr(painter._visualTheme?.range?.width, 4);
    }

    function getTapeLaneGap(painter, metrics) {
        return finiteOr(getTapeSpec(painter).tapeGap, 6);
    }

    function getTapeToLabelGap(painter) {
        return finiteOr(getTapeSpec(painter).toLabelGap, 4);
    }

    function getMinTapeLabelGap(painter) {
        return finiteOr(getTapeSpec(painter).minLabelGap, 15);
    }

    function getLabelRoutingGap(painter) {
        return finiteOr(
            getTapeSpec(painter).labelRoutingGap,
            isVertical(painter) ? 4 : 8
        );
    }

    function getEventRoutingThreshold(painter) {
        return finiteOr(getTapeSpec(painter).eventRoutingThreshold, 28);
    }

    function getShortDurationMinDisplayWidth(painter) {
        return finiteOr(
            getShortTapeSpec(painter).minDisplayLength,
            getRangeWidth(painter)
        );
    }

    function getLabelTrackGap(painter) {
        return finiteOr(getTapeSpec(painter).labelTrackGap, 2);
    }

    function getStickyLeftInset(painter) {
        return finiteOr(getTapeSpec(painter).stickyLeftInset, 2);
    }

    function getStickyTopInset(painter) {
        return finiteOr(
            getTapeSpec(painter).stickyTopInset,
            getStickyLeftInset(painter)
        );
    }

    function getSparklineStagger(painter) {
        return finiteOr(getTapeSpec(painter).sparklineStagger, 8);
    }

    function getInstantToLabelGap(painter) {
        return finiteOr(getInstantSpec(painter).toLabelGap, 4);
    }

    function getEventDurationWidth(painter, evt) {
        if (!evt || typeof evt.isInstant !== "function" || evt.isInstant()) return 0;

        const startPixel = Math.round(painter._band.dateToPixelOffset(evt.getStart()));
        const endPixel = Math.round(painter._band.dateToPixelOffset(evt.getEnd()));

        return Math.abs(endPixel - startPixel);
    }

    function isTapeEvent(painter, evt) {
        return getEventDurationWidth(painter, evt) >= getEventRoutingThreshold(painter);
    }

    function getOriginalPainterMetrics(painter) {
        const nativeEventSpec = painter._params?.theme?.event || {};
        const nativeTrack = nativeEventSpec.track || {};
        const nativeInstant = nativeEventSpec.instant || {};
        const track = getOrientationSpec(
            painter._visualTheme?.track,
            painter._timeline
        ) || {};
        const instant = painter._visualTheme?.instant || {};
        const lineHeight = positiveOr(painter._frc?.getLineHeight?.(), 12);
        const trackHeight = Math.max(
            positiveOr(track.size, positiveOr(nativeTrack.height, 10)),
            getRangeWidth(painter) + lineHeight,
            positiveOr(instant.height, positiveOr(instant.width, DEFAULT_INSTANT_ICON_SIZE))
        );
        const trackGap = finiteOr(track.gap, finiteOr(nativeTrack.gap, 2));
        const defaultTrackOffset = getDefaultTrackOffset(painter, nativeTrack);

        return {
            trackOffset: isConfiguredTrackOffset(painter)
                ? finiteOr(track.offset, defaultTrackOffset)
                : defaultTrackOffset,
            trackHeight,
            trackGap,
            trackIncrement: trackHeight + trackGap,
            icon: nativeInstant.icon,
            iconWidth: positiveOr(instant.width, positiveOr(nativeInstant.iconWidth, DEFAULT_INSTANT_ICON_SIZE)),
            iconHeight: positiveOr(
                instant.height,
                positiveOr(instant.width, positiveOr(nativeInstant.iconHeight, DEFAULT_INSTANT_ICON_SIZE))
            ),
            labelWidth: nativeEventSpec.label?.width,
            maxLabelChar: nativeEventSpec.label?.maxLabelChar,
            impreciseIconMargin: nativeInstant.impreciseIconMargin
        };
    }

    function measureVerticalEventLabelHeight(painter, evt, width, fallback) {
        const doc = painter._timeline?.getDocument?.();
        const layer = painter._backLayer || painter._eventLayer;
        if (!doc || !layer) return fallback;

        const probe = doc.createElement("div");
        probe.className = painter._getLabelDivClassName(evt);
        probe.style.position = "absolute";
        probe.style.visibility = "hidden";
        probe.style.width = width + "px";
        probe.innerHTML = evt.getText();

        layer.appendChild(probe);
        const height = positiveOr(
            probe.getBoundingClientRect?.().height,
            positiveOr(probe.offsetHeight, fallback)
        );
        probe.remove();

        return height;
    }

    function getVerticalEventSpan(painter, evt) {
        const metrics = painter._repriseMetrics || getOriginalPainterMetrics(painter);
        const theme = painter._params?.theme || {};
        const labelWidth = getVerticalTapeLabelWidth(painter, metrics);
        const labelHeight = measureVerticalEventLabelHeight(
            painter,
            evt,
            labelWidth,
            metrics.trackHeight
        );
        const startPixel = Math.round(painter._band.dateToPixelOffset(evt.getStart()));

        if (!evt?.isInstant?.()) {
            const endPixel = Math.round(painter._band.dateToPixelOffset(evt.getEnd()));
            const top = Math.min(startPixel, endPixel);
            const height = Math.max(
                Math.abs(endPixel - startPixel),
                getShortDurationMinDisplayWidth(painter)
            );
            const labelTop = top;

            return {
                top,
                bottom: Math.max(top + height, labelTop + labelHeight)
            };
        }

        const iconHeight = metrics.iconHeight;
        const top = Math.round(startPixel - iconHeight / 2);
        const labelTop = startPixel +
            Math.round(metrics.iconWidth / 2) +
            finiteOr(theme.event?.label?.offsetFromLine, 3);

        return {
            top: Math.min(top, labelTop),
            bottom: Math.max(top + iconHeight, labelTop + labelHeight)
        };
    }

    function buildVerticalEventGroups(painter) {
        const groups = new Map();
        let fallback = 0;

        function getGroup(item) {
            const key = getPointGroupKey(item, fallback++);
            let group = groups.get(key);

            if (!group) {
                const startPixel = Math.round(painter._band.dateToPixelOffset(item.evt.getStart()));
                group = {
                    evt: item.evt,
                    index: groups.size,
                    items: [],
                    startPixel,
                    span: {
                        top: Number.POSITIVE_INFINITY,
                        bottom: Number.NEGATIVE_INFINITY
                    },
                    isDuration: !item.evt?.isInstant?.(),
                    fixedLane: item.evt.getTrackNum?.() == null
                        ? null
                        : normalizeLane(item.evt.getTrackNum())
                };
                groups.set(key, group);
            }

            return group;
        }

        function addItem(item) {
            const group = getGroup(item);
            const top = finiteOr(item.data?.top, group.startPixel);
            const bottom = top + getDataHeight(item.data, item.height || 0);

            group.items.push(item);
            group.span.top = Math.min(group.span.top, top);
            group.span.bottom = Math.max(group.span.bottom, bottom);
        }

        for (const item of painter._reprisePointIcons) addItem(item);
        for (const item of painter._reprisePointTapes) addItem(item);
        for (const item of painter._reprisePointLabels) addItem(item);

        for (const group of groups.values()) {
            if (Number.isFinite(group.span.top) && Number.isFinite(group.span.bottom)) continue;
            group.span = getVerticalEventSpan(painter, group.evt);
        }

        return Array.from(groups.values());
    }

    function assignVerticalEventGroup(painter, tracks, group, physicalTrack) {
        while (tracks.length <= physicalTrack) tracks.push([]);
        reserveInterval(
            tracks,
            physicalTrack,
            group.span.top,
            group.span.bottom
        );

        const lane = getTapeLaneCount(painter) > 0
            ? Math.max(0, physicalTrack - 1)
            : physicalTrack;
        const id = getEventId(group.evt);
        if (id != null) painter._repriseEventLanes[id] = lane;

        for (const item of group.items) {
            item.lane = lane;
            item.physicalTrack = physicalTrack;
        }
    }

    function makeEventLayerTransparentToPointers(layer) {
        if (layer?.style) layer.style.pointerEvents = "none";
        if (layer?.parentNode?.style) {
            layer.parentNode.style.pointerEvents = "none";
        }
    }

    function makeEventContentInteractive(data, zIndex) {
        if (!data?.elmt?.style) return;

        data.elmt.style.pointerEvents = "auto";
        data.elmt.style.zIndex = String(zIndex);
    }

    function getTapeLaneTop(painter, metrics, theme, lane) {
        return metrics.trackOffset +
            lane * (getRangeWidth(painter) + getTapeLaneGap(painter, metrics));
    }

    function getTapeLaneCount(painter) {
        const rebuiltLaneCount = painter._repriseTapeLaneEnds?.length || 0;
        if (rebuiltLaneCount > 0) return rebuiltLaneCount;

        return Math.max(0, painter._repriseTapeLaneStarts?.length || 0);
    }

    function getTapeLabelTop(painter, metrics, theme) {
        const tapeCount = getTapeLaneCount(painter);
        if (tapeCount === 0) return metrics.trackOffset;

        return metrics.trackOffset +
            tapeCount * getRangeWidth(painter) +
            Math.max(0, tapeCount - 1) * getTapeLaneGap(painter, metrics) +
            getMinTapeLabelGap(painter);
    }

    function getRoutedTrackCount(painter) {
        return Math.max(0, painter._repriseLabelTrackCount || 0);
    }

    function getRoutedTrackHeight(painter, metrics) {
        return Math.max(
            metrics.trackHeight,
            painter._repriseLabelTrackHeight || 0
        );
    }

    function getRoutedTrackIncrement(painter, metrics) {
        return getRoutedTrackHeight(painter, metrics) +
            getLabelTrackGap(painter);
    }

    function getRoutedTrackBlockHeight(painter, metrics) {
        const trackCount = getRoutedTrackCount(painter);
        if (trackCount === 0) return 0;

        return trackCount * getRoutedTrackHeight(painter, metrics) +
            Math.max(0, trackCount - 1) * getLabelTrackGap(painter);
    }

    function getEventBaseTop(painter, metrics, theme) {
        return getTapeLabelTop(painter, metrics, theme) +
            (painter._repriseLabelTrackTopInset || 0);
    }

    function getEventLaneTop(painter, metrics, theme, lane) {
        return getEventBaseTop(painter, metrics, theme) +
            lane * getRoutedTrackIncrement(painter, metrics);
    }

    function getOriginalTrackTop(metrics, track) {
        return metrics.trackOffset + track * metrics.trackIncrement;
    }

    function getTapeLane(painter, evt) {
        const trackAttribute = evt.getTrackNum && evt.getTrackNum();
        if (trackAttribute != null) return normalizeLane(trackAttribute);

        const id = getEventId(evt);
        return id == null ? 0 : painter._repriseTapeLanes[id] ?? 0;
    }

    function getEventLane(painter, evt) {
        const trackAttribute = evt.getTrackNum && evt.getTrackNum();
        if (trackAttribute != null) return normalizeLane(trackAttribute);

        const id = getEventId(evt);
        return id == null ? 0 : painter._repriseEventLanes[id] ?? 0;
    }

    function getVerticalTapeLaneLeft(painter, metrics, theme, lane) {
        return metrics.trackOffset +
            lane * (getRangeWidth(painter) + getTapeLaneGap(painter, metrics));
    }

    function getVerticalTapeLabelWidth(painter, metrics) {
        const bandWidth = painter._band?.getViewWidth?.() || 0;
        return finiteOr(
            getTapeSpec(painter).labelWidth,
            Math.max(80, Math.min(140, bandWidth * 0.36 || metrics.trackIncrement * 7))
        );
    }

    function getVerticalTapeLabelLeft(painter, metrics, theme) {
        const tapeCount = getTapeLaneCount(painter);
        if (tapeCount === 0) return metrics.trackOffset;

        return metrics.trackOffset +
            tapeCount * getRangeWidth(painter) +
            Math.max(0, tapeCount - 1) * getTapeLaneGap(painter, metrics) +
            getMinTapeLabelGap(painter);
    }

    function getVerticalEventTrackContentWidth(painter, metrics, theme) {
        const markerWidth = Math.max(metrics.iconWidth, getRangeWidth(painter));
        const labelWidth = getVerticalTapeLabelWidth(painter, metrics);

        return Math.max(
            markerWidth,
            labelWidth,
            getRangeWidth(painter) + getTapeToLabelGap(painter) + labelWidth
        );
    }

    function getVerticalEventBaseLeft(painter, metrics, theme) {
        const tapeCount = getTapeLaneCount(painter);
        if (tapeCount === 0) return metrics.trackOffset;

        const tapeRight = metrics.trackOffset +
            tapeCount * (getRangeWidth(painter) + getTapeLaneGap(painter, metrics)) -
            getTapeLaneGap(painter, metrics);
        const primaryTrackRight = getVerticalTapeLabelLeft(painter, metrics, theme) +
            getVerticalEventTrackContentWidth(painter, metrics, theme);
        const gap = finiteOr(getTapeSpec(painter).toEventGap, 12);

        return Math.max(tapeRight, primaryTrackRight) + gap;
    }

    function getVerticalEventLaneIncrement(painter, metrics, theme) {
        return getVerticalEventTrackContentWidth(painter, metrics, theme) +
            getLabelTrackGap(painter);
    }

    function getVerticalEventLaneLeft(painter, metrics, theme, lane) {
        return getVerticalEventBaseLeft(painter, metrics, theme) +
            lane * getVerticalEventLaneIncrement(painter, metrics, theme);
    }

    function getVerticalPhysicalTrackLeft(painter, metrics, theme, physicalTrack) {
        const track = normalizeLane(physicalTrack);

        if (getTapeLaneCount(painter) === 0) {
            return getVerticalEventLaneLeft(painter, metrics, theme, track);
        }

        return track === 0
            ? getVerticalTapeLabelLeft(painter, metrics, theme)
            : getVerticalEventLaneLeft(painter, metrics, theme, track - 1);
    }

    function getVerticalPointTrackLeft(painter, item, metrics, theme) {
        return Number.isFinite(item.physicalTrack)
            ? getVerticalPhysicalTrackLeft(
                painter,
                metrics,
                theme,
                item.physicalTrack
            )
            : getVerticalEventLaneLeft(painter, metrics, theme, item.lane);
    }

    function getVerticalPointLabelLeft(painter, item, metrics, theme) {
        const laneLeft = getVerticalPointTrackLeft(painter, item, metrics, theme);

        if (item.evt?.isInstant?.()) return laneLeft;

        return laneLeft +
            getRangeWidth(painter) +
            getTapeToLabelGap(painter);
    }

    function setPaintedRect(data, rect) {
        if (!data || !data.elmt) return;

        if ("left" in rect) {
            data.left = rect.left;
            data.elmt.style.left = rect.left + "px";
        }
        if ("top" in rect) {
            data.top = rect.top;
            data.elmt.style.top = rect.top + "px";
        }
        if ("width" in rect) {
            data.width = rect.width;
            data.elmt.style.width = rect.width + "px";
        }
        if ("height" in rect) {
            data.height = rect.height;
            data.elmt.style.height = rect.height + "px";
        }
    }

    function getEventTapeColor(evt, fallback, theme, visualTheme) {
        const emphasisColor = getEmphasisColor(evt, theme, visualTheme, "iconColor");
        if (emphasisColor != null) return emphasisColor;

        const scope = getEventColorScope(evt, visualTheme);
        if (scope === "graphic" || scope === "both") {
            const tapeColor = stringValue(getEventProperty(evt, "tapeColor"));
            if (tapeColor != null) return resolveCssColor(tapeColor) || tapeColor;

            const eventColor = getEventColor(evt);
            if (eventColor != null) {
                return resolveCssColor(eventColor) || eventColor;
            }
        }

        return resolveCssColor(visualTheme.range.iconColor) ||
            getDefaultGraphicColor(evt, theme, fallback);
    }

    function createTapeSparkLine(painter) {
        const doc = painter._timeline.getDocument();
        ensureTapeSparklineStyles(doc);

        const sparkDiv = doc.createElement("div");
        sparkDiv.className = "timeline-event-tape-sparkline";
        sparkDiv.style.position = "absolute";
        sparkDiv.style.pointerEvents = "none";
        sparkDiv.style.zIndex = String(EVENT_SPARKLINE_Z_INDEX);
        sparkDiv.style.opacity = "0.8";

        painter._eventLayer.appendChild(sparkDiv);

        return {
            left: 0,
            top: 0,
            width: 1,
            height: 0,
            elmt: sparkDiv
        };
    }

    function getTapeSparklineColor(tapeColor) {
        return resolveCssColor(tapeColor) ||
            resolveCssColor(DEFAULT_RANGE_TAPE_COLOR) ||
            DEFAULT_RANGE_TAPE_COLOR;
    }

    function updateTapeSparkLine(painter, item, metrics, theme) {
        if (!item.spark?.elmt) return;

        const cssColor = getTapeSparklineColor(item.tapeColor);

        if (cssColor) {
            item.spark.elmt.style.backgroundColor =
                "color-mix(in srgb, " + cssColor + " 70%, white)";
        }

        const tapeCenter = getTapeLaneTop(painter, metrics, theme, item.lane) +
            Math.round(getRangeWidth(painter) / 2);
        const sparkTop = tapeCenter;
        const sparkHeight = Math.max(
            0,
            item.data.top - tapeCenter - getTapeToLabelGap(painter)
        );
        const sparkLeft = Math.round(
            Number.isFinite(item._repriseSparkLeft)
                ? item._repriseSparkLeft
                : item.data.left + 2
        );

        setPaintedRect(item.spark, {
            left: sparkLeft,
            top: sparkTop,
            width: 1,
            height: sparkHeight
        });
    }

    function updateVerticalTapeSparkLine(painter, item, metrics, theme) {
        if (!item.spark?.elmt) return;

        const cssColor = getTapeSparklineColor(item.tapeColor);

        if (cssColor) {
            item.spark.elmt.style.backgroundColor =
                "color-mix(in srgb, " + cssColor + " 70%, white)";
        }

        const tapeCenter = getVerticalTapeLaneLeft(painter, metrics, theme, item.lane) +
            Math.round(getRangeWidth(painter) / 2);
        const fontSize = getLabelFontSize(item.data, getDataHeight(item.data, item.height || 12));
        const sparkTop = Math.round(item.data.top + fontSize / 2);
        const sparkWidth = Math.max(
            0,
            item.data.left - tapeCenter - getTapeToLabelGap(painter)
        );

        setPaintedRect(item.spark, {
            left: tapeCenter,
            top: sparkTop,
            width: sparkWidth,
            height: 1
        });
    }

    function rememberEventItem(painter, list, evt, track, metrics, data, { topOffset = 0 } = {}) {
        const item = {
            evt,
            lane: getEventLane(painter, evt),
            trackTopOffset: data.top - getOriginalTrackTop(metrics, track) + topOffset,
            data
        };

        list.push(item);
        return item;
    }

    function getDataWidth(data, fallback = 0) {
        return data?.elmt?.offsetWidth || data?.width || fallback;
    }

    function getDataHeight(data, fallback = 0) {
        return data?.elmt?.offsetHeight || data?.height || fallback;
    }

    function getItemLeft(item) {
        return finiteOr(item.data?.left, item.naturalLeft ?? 0);
    }

    function getItemRight(item) {
        return getItemLeft(item) + getDataWidth(item.data, item.width || 0);
    }

    function getHorizontalPointEventTopOffset(item) {
        return item.evt?.isInstant?.() ? HORIZONTAL_INSTANT_EVENT_TOP_OFFSET : 0;
    }

    function getItemTopOffset(item) {
        return item.trackTopOffset + getHorizontalPointEventTopOffset(item);
    }

    function getItemBottomOffset(item) {
        return getItemTopOffset(item) + getDataHeight(item.data, item.height || 0);
    }

    function getLabelFontSize(data, fallback) {
        const element = data?.elmt;
        if (!element) return fallback;

        const view = element.ownerDocument?.defaultView;
        const style = view?.getComputedStyle?.(element);
        if (!style) return fallback;

        const fontSize = parseFloat(style.fontSize);
        if (Number.isFinite(fontSize)) return fontSize;

        return fallback;
    }

    function getLabelLineHeight(data, fontSize) {
        const element = data?.elmt;
        const fallback = fontSize * 1.2;
        if (!element) return fallback;

        const view = element.ownerDocument?.defaultView;
        const style = view?.getComputedStyle?.(element);
        if (!style) return fallback;

        const lineHeight = parseFloat(style.lineHeight);
        if (Number.isFinite(lineHeight)) return lineHeight;

        return fallback;
    }

    function findPointIconItem(painter, evt) {
        const id = getEventId(evt);

        if (id != null) {
            return painter._reprisePointIcons.find((item) => getEventId(item.evt) === id) || null;
        }

        return painter._reprisePointIcons.find((item) => item.evt === evt) || null;
    }

    function getSvgImageHeightFromSrc(src) {
        if (typeof src !== "string" || !src.startsWith("data:image/svg+xml,")) return null;

        const svg = decodeURIComponent(src.slice(src.indexOf(",") + 1));
        const height = /<svg\b[^>]*\bheight=["']?([0-9.]+)/i.exec(svg);
        if (height) return toFiniteNumber(height[1]);

        const viewBox = /<svg\b[^>]*\bviewBox=["'][^"']+\s+([0-9.]+)\s+([0-9.]+)["']/i.exec(svg);
        return viewBox ? toFiniteNumber(viewBox[2]) : null;
    }

    function getRenderedIconMetrics(icon, metrics) {
        const iconElement = icon?.data?.elmt;

        if (isDefaultThemeIconElement(iconElement)) {
            return {
                height: positiveOr(metrics?.iconHeight, DEFAULT_INSTANT_ICON_SIZE),
                topOffset: 0
            };
        }

        const child = iconElement?.firstElementChild || iconElement?.firstChild;
        const iconRect = iconElement?.getBoundingClientRect?.();
        const childRect = child?.getBoundingClientRect?.();
        const svgHeight = getSvgImageHeightFromSrc(child?.src || child?.getAttribute?.("src"));
        const childHeight = positiveOr(
            childRect?.height,
            positiveOr(child?.offsetHeight, positiveOr(child?.naturalHeight, positiveOr(svgHeight, metrics.iconHeight)))
        );
        const childTopOffset = Number.isFinite(childRect?.top) && Number.isFinite(iconRect?.top)
            ? childRect.top - iconRect.top
            : 0;

        return {
            height: childHeight,
            topOffset: childTopOffset
        };
    }

    function alignInstantLabelToIcon(painter, item, metrics, theme) {
        if (!item.evt?.isInstant?.()) return;

        const icon = findPointIconItem(painter, item.evt);
        if (!icon?.data) return;

        const iconWidth = getDataWidth(icon.data, metrics.iconWidth);
        const iconMetrics = getRenderedIconMetrics(icon, metrics);
        const iconCenterTop = icon.data.top + iconMetrics.topOffset + iconMetrics.height / 2;
        const fontSize = getLabelFontSize(item.data, item.height || getDataHeight(item.data, 0));
        const lineHeight = getLabelLineHeight(item.data, fontSize);
        const left = icon.data.left +
            iconWidth +
            getInstantToLabelGap(painter);
        const top = Math.round(iconCenterTop - lineHeight / 2) +
            HORIZONTAL_INSTANT_LABEL_BASELINE_TOP_OFFSET;

        setPaintedRect(item.data, { left, top });

        item.naturalLeft = left;
        item.trackTopOffset = finiteOr(icon.trackTopOffset, 0) + (top - icon.data.top);
    }

    function alignVerticalInstantLabelToIcon(painter, item, metrics, theme) {
        if (!item.evt?.isInstant?.()) return;

        const icon = findPointIconItem(painter, item.evt);
        if (!icon?.data) return;

        const iconMetrics = getRenderedIconMetrics(icon, metrics);
        const iconBottom = icon.data.top + iconMetrics.topOffset + iconMetrics.height;
        const top = Math.round(iconBottom + getInstantToLabelGap(painter));

        setPaintedRect(item.data, { top, left: icon.data.left });
        item.naturalLeft = icon.data.left;
        item.height = getDataHeight(item.data, item.height || 0);
    }

    function intervalIsFree(intervals, left, right, gap) {
        for (const interval of intervals || []) {
            if (left < interval.right + gap && right + gap > interval.left) return false;
        }

        return true;
    }

    function reserveInterval(tracks, track, left, right) {
        if (!tracks[track]) tracks[track] = [];
        tracks[track].push({ left, right });
    }

    function findSlidingLeft(intervals, preferredLeft, width, maxLeft, gap) {
        if (preferredLeft >= maxLeft) return null;

        let left = preferredLeft;
        const sorted = (intervals || []).slice().sort((a, b) => a.left - b.left);

        for (const interval of sorted) {
            const right = left + width;
            if (right + gap <= interval.left) break;

            if (left < interval.right + gap && right + gap > interval.left) {
                left = interval.right + gap;
                if (left >= maxLeft) return null;
            }
        }

        return left < maxLeft ? left : null;
    }

    function placeSlidingLabel(tracks, preferredLeft, width, maxLeft, gap) {
        for (let track = 0; track < tracks.length; track++) {
            const left = findSlidingLeft(tracks[track], preferredLeft, width, maxLeft, gap);
            if (left != null) return { track, left };
        }

        if (preferredLeft >= maxLeft) return null;

        tracks.push([]);
        return { track: tracks.length - 1, left: preferredLeft };
    }

    function placeFixedGroup(tracks, left, right, gap) {
        for (let track = 0; track < tracks.length; track++) {
            if (intervalIsFree(tracks[track], left, right, gap)) return track;
        }

        tracks.push([]);
        return tracks.length - 1;
    }

    function getTapeLabelAxisSpan(item) {
        const start = toFiniteNumber(item?.startPixel);
        const end = toFiniteNumber(item?.endPixel);

        return start != null && end != null
            ? Math.abs(end - start)
            : 0;
    }

    function compareTapeLabelSpanInnerFirst(a, b) {
        const itemA = a.item || a;
        const itemB = b.item || b;

        return getTapeLabelAxisSpan(itemA) - getTapeLabelAxisSpan(itemB);
    }

    function getPointGroupKey(item, fallback) {
        const id = getEventId(item.evt);
        return id != null ? "id:" + id : item.evt || "event:" + fallback;
    }

    function buildPointGroups(painter) {
        const groups = new Map();
        let fallback = 0;

        function addItem(item, kind) {
            const key = getPointGroupKey(item, fallback++);
            let group = groups.get(key);

            if (!group) {
                group = {
                    evt: item.evt,
                    index: groups.size,
                    items: [],
                    label: null,
                    left: Number.POSITIVE_INFINITY,
                    right: Number.NEGATIVE_INFINITY,
                    minTopOffset: Number.POSITIVE_INFINITY,
                    maxBottomOffset: Number.NEGATIVE_INFINITY
                };
                groups.set(key, group);
            }

            const left = getItemLeft(item);
            const right = getItemRight(item);

            group.items.push(item);
            if (kind === "label") group.label = item;
            group.left = Math.min(group.left, left);
            group.right = Math.max(group.right, right);
            group.minTopOffset = Math.min(group.minTopOffset, getItemTopOffset(item));
            group.maxBottomOffset = Math.max(group.maxBottomOffset, getItemBottomOffset(item));
        }

        for (const item of painter._reprisePointIcons) addItem(item, "icon");
        for (const item of painter._reprisePointTapes) addItem(item, "tape");
        for (const item of painter._reprisePointLabels) addItem(item, "label");

        return Array.from(groups.values())
            .filter((group) =>
                Number.isFinite(group.left) &&
                Number.isFinite(group.right) &&
                group.right > group.left
            );
    }

    function rebuildTapeLanes(painter) {
        const laneEnds = [];
        const labels = painter._repriseTapeLabels
            .map((item, index) => ({ item, index }))
            .sort((a, b) =>
                a.item.startPixel - b.item.startPixel ||
                b.item.endPixel - a.item.endPixel ||
                a.index - b.index
            );

        painter._repriseTapeLanes = {};

        for (const { item } of labels) {
            const trackAttribute = item.evt.getTrackNum && item.evt.getTrackNum();
            let lane;

            if (trackAttribute != null) {
                lane = normalizeLane(trackAttribute);
            } else {
                lane = 0;
                for (; lane < laneEnds.length; lane++) {
                    if (laneEnds[lane] < item.startPixel) break;
                }
            }

            laneEnds[lane] = Math.max(laneEnds[lane] ?? Number.NEGATIVE_INFINITY, item.endPixel);
            item.lane = lane;

            const id = getEventId(item.evt);
            if (id != null) painter._repriseTapeLanes[id] = lane;
        }

        painter._repriseTapeLaneEnds = new Array(laneEnds.length).fill(0);

        for (const item of painter._repriseTapeBars) {
            item.lane = getTapeLane(painter, item.evt);
        }
    }

    function updateVerticalLayout(painter) {
        const metrics = painter._repriseMetrics;
        const theme = painter._params.theme;
        if (!metrics || !theme) return;

        rebuildTapeLanes(painter);

        const tapeLabelLeft = getVerticalTapeLabelLeft(painter, metrics, theme);
        const labelWidth = getVerticalTapeLabelWidth(painter, metrics);

        for (const item of painter._repriseTapeBars) {
            setPaintedRect(item.data, {
                left: getVerticalTapeLaneLeft(painter, metrics, theme, item.lane),
                width: getRangeWidth(painter)
            });
        }

        for (const item of painter._repriseTapeLabels) {
            setPaintedRect(item.data, {
                left: tapeLabelLeft,
                width: labelWidth
            });
            item.width = labelWidth;
            item.height = getDataHeight(item.data, item.height || 0);
            item.data.elmt.style.display = "";
            if (item.spark?.elmt) item.spark.elmt.style.display = "";
        }

        for (const item of painter._reprisePointTapes) {
            setPaintedRect(item.data, {
                width: getRangeWidth(painter),
                height: Math.max(
                    getDataHeight(item.data, item.height || 0),
                    getShortDurationMinDisplayWidth(painter)
                )
            });
        }

        for (const item of painter._reprisePointLabels) {
            setPaintedRect(item.data, { width: labelWidth });
            alignVerticalInstantLabelToIcon(painter, item, metrics, theme);
            item.height = getDataHeight(item.data, item.height || 0);
        }

        const viewportTop = -painter._band.getViewOffset();
        const stickyTop = viewportTop + getStickyTopInset(painter);
        const labelGap = getLabelRoutingGap(painter);
        const activeTapeLabels = painter._repriseTapeLabels
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => {
                if (item.endPixel > stickyTop) return true;

                item.data.elmt.style.display = "none";
                if (item.spark?.elmt) item.spark.elmt.style.display = "none";
                return false;
            });
        const stickyTapeLabels = activeTapeLabels
            .filter(({ item }) => (item.naturalTop ?? item.startPixel) <= stickyTop)
            .sort((a, b) =>
                a.item.endPixel - b.item.endPixel ||
                a.item.startPixel - b.item.startPixel ||
                a.index - b.index
            );
        const normalTapeLabels = activeTapeLabels
            .filter(({ item }) => (item.naturalTop ?? item.startPixel) > stickyTop)
            .sort((a, b) =>
                (a.item.naturalTop ?? a.item.startPixel) -
                    (b.item.naturalTop ?? b.item.startPixel) ||
                a.index - b.index
            );
        const pointGroups = buildVerticalEventGroups(painter)
            .sort((a, b) =>
                a.startPixel - b.startPixel ||
                Number(b.isDuration) - Number(a.isDuration) ||
                a.index - b.index
            );
        let tracks = [[], []];

        painter._repriseEventLanes = {};

        for (const group of pointGroups.filter((item) => item.fixedLane != null)) {
            const physicalTrack = group.fixedLane +
                (getTapeLaneCount(painter) > 0 ? 1 : 0);
            assignVerticalEventGroup(painter, tracks, group, physicalTrack);
        }

        const tapePlacements = [];

        for (const { item } of [...stickyTapeLabels, ...normalTapeLabels]) {
            const naturalTop = item.naturalTop ?? item.startPixel;
            const preferredTop = Math.max(naturalTop, stickyTop);
            const placement = placeSlidingLabel(
                tracks,
                preferredTop,
                item.height,
                item.endPixel,
                labelGap
            );

            if (placement == null) {
                item.data.elmt.style.display = "none";
                if (item.spark?.elmt) item.spark.elmt.style.display = "none";
                continue;
            }

            reserveInterval(
                tracks,
                placement.track,
                placement.left,
                placement.left + item.height
            );
            tapePlacements.push({ item, placement });
        }

        const shiftedTracks = tracks.map(() => []);
        const routedTapePlacements = tapePlacements
            .map((entry, routeIndex) => ({
                item: entry.item,
                top: entry.placement.left,
                bottom: entry.placement.left + entry.item.height,
                routeIndex
            }))
            .sort((a, b) =>
                compareTapeLabelSpanInnerFirst(a, b) ||
                a.routeIndex - b.routeIndex
            );

        for (const entry of routedTapePlacements) {
            const labelTrack = placeFixedGroup(shiftedTracks, entry.top, entry.bottom, labelGap);
            reserveInterval(shiftedTracks, labelTrack, entry.top, entry.bottom);

            const left = labelTrack === 0
                ? tapeLabelLeft
                : getVerticalEventLaneLeft(
                    painter,
                    metrics,
                    theme,
                    labelTrack - 1
                );

            entry.item.labelTrack = labelTrack;
            setPaintedRect(entry.item.data, { left, top: entry.top });
            updateVerticalTapeSparkLine(painter, entry.item, metrics, theme);
        }

        tracks = shiftedTracks;

        for (const group of pointGroups.filter((item) => item.fixedLane == null)) {
            let physicalTrack = 0;

            for (; physicalTrack < tracks.length; physicalTrack++) {
                if (intervalIsFree(
                    tracks[physicalTrack],
                    group.span.top,
                    group.span.bottom,
                    labelGap
                )) break;
            }

            assignVerticalEventGroup(painter, tracks, group, physicalTrack);
        }

        painter._repriseLabelTrackCount = tracks.length;
        painter._repriseEventLaneSpans = tracks.slice(1).map((intervals) =>
            intervals.map((interval) => ({
                top: interval.left,
                bottom: interval.right
            }))
        );

        for (const item of painter._reprisePointIcons) {
            item.lane = Number.isFinite(item.lane)
                ? item.lane
                : getEventLane(painter, item.evt);

            setPaintedRect(item.data, {
                left: getVerticalPointTrackLeft(painter, item, metrics, theme)
            });
        }

        for (const item of painter._reprisePointTapes) {
            item.lane = Number.isFinite(item.lane)
                ? item.lane
                : getEventLane(painter, item.evt);

            setPaintedRect(item.data, {
                left: getVerticalPointTrackLeft(painter, item, metrics, theme)
            });
        }

        for (const item of painter._reprisePointLabels) {
            item.lane = Number.isFinite(item.lane)
                ? item.lane
                : getEventLane(painter, item.evt);

            setPaintedRect(item.data, {
                left: getVerticalPointLabelLeft(painter, item, metrics, theme)
            });
        }
    }

    function updateHorizontalLayout(painter) {
        const metrics = painter._repriseMetrics;
        const theme = painter._params.theme;
        if (!metrics || !theme) return;

        rebuildTapeLanes(painter);

        const viewportLeft = -painter._band.getViewOffset();
        const stickyLeft = viewportLeft + getStickyLeftInset(painter);
        const stickyRight = viewportLeft + painter._band.getViewLength() - getStickyLeftInset(painter);
        const labelGap = getLabelRoutingGap(painter);
        const sparklineStagger = getSparklineStagger(painter);
        const labels = painter._repriseTapeLabels
            .map((item, index) => ({ ...item, index }))
            .sort((a, b) =>
                a.startPixel - b.startPixel ||
                b.endPixel - a.endPixel ||
                a.index - b.index
            );
        const pointGroups = buildPointGroups(painter)
            .sort((a, b) =>
                a.left - b.left ||
                a.index - b.index
            );
        const hasRoutableItems = labels.length > 0 || pointGroups.length > 0;
        let tracks = hasRoutableItems
            ? [[]]
            : [];
        const tapePlacements = [];

        painter._repriseLabelTrackHeight = maxFinite(
            metrics.trackHeight,
            [
                ...labels.map((item) => getDataHeight(item.data, item.height || 0)),
                ...pointGroups.map((group) => group.maxBottomOffset - group.minTopOffset)
            ]
        );
        painter._repriseLabelTrackTopInset = maxFinite(
            0,
            pointGroups.map((group) => -group.minTopOffset)
        );
        painter._repriseLabelTrackCount = tracks.length;
        painter._repriseEventLanes = {};

        for (const item of labels) {
            item.data.elmt.style.display = "";
            if (item.spark) item.spark.elmt.style.display = "";

            if (item.endPixel <= stickyLeft) {
                item.data.elmt.style.display = "none";
                if (item.spark) item.spark.elmt.style.display = "none";
                continue;
            }
            if (item.startPixel >= stickyRight) {
                item.data.elmt.style.display = "none";
                if (item.spark) item.spark.elmt.style.display = "none";
                continue;
            }

            const width = getDataWidth(item.data, item.width || 0);
            const preferredLeft = Math.max(item.naturalLeft ?? item.startPixel, stickyLeft);
            const placement = placeSlidingLabel(
                tracks,
                preferredLeft,
                width,
                item.endPixel,
                labelGap
            );

            if (placement == null) {
                item.data.elmt.style.display = "none";
                if (item.spark) item.spark.elmt.style.display = "none";
                continue;
            }

            reserveInterval(tracks, placement.track, placement.left, placement.left + width);
            item.lane = getTapeLane(painter, item.evt);
            tapePlacements.push({ item, placement, width });
        }

        const shiftedTracks = tracks.map(() => []);
        const routedTapePlacements = [];
        const placementsByTrack = new Map();

        for (const entry of tapePlacements) {
            const track = entry.placement.track;
            if (!placementsByTrack.has(track)) placementsByTrack.set(track, []);
            placementsByTrack.get(track).push(entry);
        }

        for (const entries of placementsByTrack.values()) {
            for (let index = entries.length - 1; index >= 0; index--) {
                const { item, placement, width } = entries[index];
                const stagger = placement.track * sparklineStagger;
                const maxStagger = Math.max(0, item.endPixel - placement.left - 1);
                // The tape's own natural attach point: where its tape entered
                // the sliding/collision placement, plus any stagger. This is
                // deliberately independent of the sticky-right clamp below, so
                // a label pushed off the visible edge cannot drag its tick
                // along with it onto a position the tape never actually had.
                const desiredLeft = placement.left + Math.min(stagger, maxStagger);
                const tickLeft = Math.round(desiredLeft + 2);
                const rightStickyLeft = stickyRight - width;
                const left = Math.max(
                    stickyLeft,
                    Math.min(desiredLeft, rightStickyLeft)
                );

                routedTapePlacements.push({
                    item,
                    track: placement.track,
                    left,
                    right: left + width,
                    width,
                    tickLeft,
                    routeIndex: routedTapePlacements.length
                });
            }
        }

        routedTapePlacements.sort((a, b) =>
            compareTapeLabelSpanInnerFirst(a, b) ||
            a.routeIndex - b.routeIndex
        );

        for (const entry of routedTapePlacements) {
            // Usually tickLeft lands inside [left, right] (it does whenever
            // the sticky-right clamp above didn't have to move the label), so
            // the spark still touches the label - just possibly at a
            // different point along it than the label's own left edge. Only
            // when clamping pulled the label far enough that its own tape's
            // attach point no longer falls anywhere on it do we drop the
            // label instead of faking a connection or stretching one across
            // an arbitrary distance.
            if (entry.item.spark && (entry.tickLeft < entry.left - 1 || entry.tickLeft > entry.right + 1)) {
                entry.item.data.elmt.style.display = "none";
                entry.item.spark.elmt.style.display = "none";
                continue;
            }

            const track = placeFixedGroup(shiftedTracks, entry.left, entry.right, labelGap);
            reserveInterval(shiftedTracks, track, entry.left, entry.right);

            setPaintedRect(entry.item.data, {
                left: entry.left,
                top: getEventLaneTop(painter, metrics, theme, track),
                width: entry.width
            });

            if (entry.item.spark) {
                entry.item._repriseSparkLeft = entry.tickLeft;
                updateTapeSparkLine(painter, entry.item, metrics, theme);
            }
        }

        tracks = shiftedTracks;

        for (const group of pointGroups) {
            const track = placeFixedGroup(tracks, group.left, group.right, labelGap);
            reserveInterval(tracks, track, group.left, group.right);

            const id = getEventId(group.evt);
            if (id != null) painter._repriseEventLanes[id] = track;

            for (const item of group.items) {
                item.lane = track;
            }
        }

        painter._repriseLabelTrackCount = tracks.length;

        for (const item of painter._repriseTapeBars) {
            setPaintedRect(item.data, {
                top: getTapeLaneTop(painter, metrics, theme, item.lane),
                height: getRangeWidth(painter)
            });
        }

        for (const item of [
            ...painter._reprisePointIcons,
            ...painter._reprisePointTapes,
            ...painter._reprisePointLabels
        ]) {
            item.lane = Number.isFinite(item.lane)
                ? item.lane
                : getEventLane(painter, item.evt);

            setPaintedRect(item.data, {
                top: getEventLaneTop(painter, metrics, theme, item.lane) +
                    getItemTopOffset(item)
            });
        }

        const totalExtent = getHorizontalTotalExtent(painter, metrics, theme);

        painter._band.updateEventTrackInfo(
            Math.max(1, Math.ceil(totalExtent / metrics.trackIncrement)),
            metrics.trackIncrement
        );
    }

    function getHorizontalTotalExtent(painter, metrics, theme) {
        const tapeCount = getTapeLaneCount(painter);
        const routedTrackCount = getRoutedTrackCount(painter);
        let extent = 2 * metrics.trackOffset;

        if (tapeCount > 0 || routedTrackCount > 0) {
            extent = Math.max(
                extent,
                getEventBaseTop(painter, metrics, theme) +
                    getRoutedTrackBlockHeight(painter, metrics) +
                    metrics.trackOffset
            );
        }

        return extent;
    }

    const proto = Timeline.OriginalEventPainter.prototype;
    const originalInitialize = proto.initialize;
    const originalPrepare = proto._prepareForPainting;
    const originalFindFreeTrack = proto._findFreeTrack;
    const originalPaintIcon = proto._paintEventIcon;
    const originalPaintTape = proto._paintEventTape;
    const originalPaintLabel = proto._paintEventLabel;
    const originalSoftPaint = proto.softPaint;

    proto.initialize = function (band, timeline) {
        const result = originalInitialize.apply(this, arguments);
        resolvePainterVisualTheme(this, band);
        resolvePainterRuntime(this, band, timeline);
        return result;
    };

    proto._prepareForPainting = function () {
        const result = originalPrepare.apply(this, arguments);
        makeEventLayerTransparentToPointers(this._eventLayer);

        if (isHorizontal(this)) {
            this._repriseMetrics = null;
            this._repriseTapeLaneStarts = [];
            this._repriseTapeLaneEnds = [];
            this._repriseTapeLanes = {};
            this._repriseTapeLabels = [];
            this._repriseTapeBars = [];
            this._repriseLabelTrackCount = 0;
            this._repriseLabelTrackHeight = 0;
            this._repriseLabelTrackTopInset = 0;
            this._repriseEventLaneStarts = [];
            this._repriseEventLanes = {};
            this._reprisePointIcons = [];
            this._reprisePointTapes = [];
            this._reprisePointLabels = [];
        }

        if (isVertical(this)) {
            this._repriseMetrics = null;
            this._repriseTapeLaneStarts = [];
            this._repriseTapeLaneEnds = [];
            this._repriseTapeLanes = {};
            this._repriseTapeLabels = [];
            this._repriseTapeBars = [];
            this._repriseEventLaneSpans = [];
            this._repriseEventLanes = {};
            this._reprisePointIcons = [];
            this._reprisePointTapes = [];
            this._reprisePointLabels = [];
        }

        return result;
    };

    proto._findFreeTrack = function (evt, rightEdge) {
        if (isVertical(this)) {
            const trackAttribute = evt.getTrackNum && evt.getTrackNum();
            const id = getEventId(evt);

            if (trackAttribute != null) {
                const lane = normalizeLane(trackAttribute);
                if (isTapeEvent(this, evt)) {
                    this._repriseTapeLaneStarts[lane] =
                        Math.round(this._band.dateToPixelOffset(evt.getStart()));
                    if (id != null) this._repriseTapeLanes[id] = lane;
                } else {
                    if (id != null) this._repriseEventLanes[id] = lane;
                }
                return lane;
            }

            if (isTapeEvent(this, evt)) {
                const startPixel = Math.round(this._band.dateToPixelOffset(evt.getStart()));
                const endPixel = Math.round(this._band.dateToPixelOffset(evt.getEnd()));
                let lane = 0;

                for (; lane < this._repriseTapeLaneStarts.length; lane++) {
                    if (this._repriseTapeLaneStarts[lane] > endPixel) break;
                }

                this._repriseTapeLaneStarts[lane] = startPixel;
                if (id != null) this._repriseTapeLanes[id] = lane;
                return lane;
            }

            if (id != null) this._repriseEventLanes[id] = 0;
            return 0;
        }

        if (!isHorizontal(this)) return originalFindFreeTrack.call(this, evt, rightEdge);

        const trackAttribute = evt.getTrackNum && evt.getTrackNum();
        const id = getEventId(evt);

        if (trackAttribute != null) {
            const lane = normalizeLane(trackAttribute);
            if (isTapeEvent(this, evt)) {
                this._repriseTapeLaneStarts[lane] =
                    Math.round(this._band.dateToPixelOffset(evt.getStart()));
                if (id != null) this._repriseTapeLanes[id] = lane;
            } else {
                this._repriseEventLaneStarts[lane] =
                    Math.round(this._band.dateToPixelOffset(evt.getStart()));
                if (id != null) this._repriseEventLanes[id] = lane;
            }
            return lane;
        }

        if (isTapeEvent(this, evt)) {
            const startPixel = Math.round(this._band.dateToPixelOffset(evt.getStart()));
            const endPixel = Math.round(this._band.dateToPixelOffset(evt.getEnd()));
            let lane = 0;

            for (; lane < this._repriseTapeLaneStarts.length; lane++) {
                if (this._repriseTapeLaneStarts[lane] > endPixel) break;
            }

            this._repriseTapeLaneStarts[lane] = startPixel;
            if (id != null) this._repriseTapeLanes[id] = lane;
            return lane;
        }

        const leftEdge = Math.round(this._band.dateToPixelOffset(evt.getStart()));
        let lane = 0;

        for (; lane < this._repriseEventLaneStarts.length; lane++) {
            if (this._repriseEventLaneStarts[lane] > rightEdge) break;
        }

        this._repriseEventLaneStarts[lane] = leftEdge;
        if (id != null) this._repriseEventLanes[id] = lane;

        return lane;
    };

    proto._paintEventIcon = function (evt, iconTrack, left, metrics, theme, tapeHeight) {
        this._repriseMetrics = metrics;
        const paintArguments = Array.from(arguments);
        const visualTheme = getPainterVisualTheme(this, evt);
        paintArguments[0] = evt?.isInstant?.()
            ? getEventWithThemeIcon(evt, theme, visualTheme, metrics)
            : evt;
        const data = originalPaintIcon.apply(this, paintArguments);
        makeEventContentInteractive(data, EVENT_GRAPHIC_Z_INDEX);
        _installEventCaptionRefresh(this, evt, data);
        applyThemeIconSize(data, metrics);
        if (isVertical(this) && data?.elmt) {
            const verticalData = transposeVerticalPaintedRect(data);
            if (evt?.isInstant?.()) {
                setPaintedRect(verticalData, {
                    top: verticalData.top + VERTICAL_INSTANT_ICON_BASELINE_TOP_OFFSET
                });
            }
            this._reprisePointIcons.push({
                evt,
                lane: getEventLane(this, evt),
                data: verticalData,
                width: verticalData.width,
                height: verticalData.height
            });
            return verticalData;
        }
        if (!isHorizontal(this) || !data?.elmt) return data;

        if (evt?.isInstant?.()) {
            setPaintedRect(data, {
                left: data.left + HORIZONTAL_INSTANT_ICON_BASELINE_LEFT_OFFSET
            });
        }

        rememberEventItem(this, this._reprisePointIcons, evt, iconTrack, metrics, data);
        return data;
    };

    proto._paintEventTape = function (
        evt, iconTrack, startPixel, endPixel, color, opacity, metrics, theme, tapeIndex
    ) {
        this._repriseMetrics = metrics;
        const visualTheme = getPainterVisualTheme(this, evt);
        const tapeColor = getEventTapeColor(evt, color, theme, visualTheme);
        const data = originalPaintTape.call(
            this,
            evt,
            iconTrack,
            startPixel,
            endPixel,
            tapeColor,
            opacity,
            metrics,
            theme,
            tapeIndex
        );
        makeEventContentInteractive(data, EVENT_GRAPHIC_Z_INDEX);
        _installEventCaptionRefresh(this, evt, data);
        if (isVertical(this) && data?.elmt) {
            const verticalData = transposeVerticalPaintedRect(data, { swapSize: true });
            const tapeEvent = isTapeEvent(this, evt);

            if (!tapeEvent && !evt.isInstant()) {
                setPaintedRect(verticalData, {
                    width: getRangeWidth(this),
                    height: Math.max(
                        getDataHeight(verticalData, verticalData.height || 0),
                        getShortDurationMinDisplayWidth(this)
                    )
                });
            }

            const item = {
                evt,
                lane: tapeEvent ? getTapeLane(this, evt) : getEventLane(this, evt),
                data: verticalData,
                width: verticalData.width,
                height: verticalData.height,
                startPixel: Math.min(startPixel, endPixel),
                endPixel: Math.max(startPixel, endPixel)
            };

            if (tapeEvent) {
                this._repriseTapeBars.push(item);
            } else {
                this._reprisePointTapes.push(item);
            }

            return verticalData;
        }
        if (!isHorizontal(this) || !data?.elmt) return data;

        if (isTapeEvent(this, evt)) {
            const lane = getTapeLane(this, evt);

            setPaintedRect(data, {
                top: getTapeLaneTop(this, metrics, theme, lane),
                height: getRangeWidth(this)
            });

            this._repriseTapeBars.push({
                evt,
                lane,
                data,
                startPixel: Math.min(startPixel, endPixel),
                endPixel: Math.max(startPixel, endPixel)
            });
            return data;
        }

        if (!evt.isInstant()) {
            setPaintedRect(data, {
                width: Math.max(data.width, getShortDurationMinDisplayWidth(this))
            });
        }

        rememberEventItem(this, this._reprisePointTapes, evt, iconTrack, metrics, data);
        return data;
    };

    proto._paintEventLabel = function (
        evt, text, left, top, width, height, theme, labelDivClassName, highlightIndex
    ) {
        const data = originalPaintLabel.apply(this, arguments);
        makeEventContentInteractive(data, EVENT_LABEL_Z_INDEX);
        _installEventCaptionRefresh(this, evt, data);

        if (data?.elmt) {
            const visualTheme = getPainterVisualTheme(this, evt);
            const labelColor = getEventLabelColor(evt, theme, visualTheme);
            data.elmt.style.color = labelColor || "";

            if (!labelsEnabled(evt, theme, visualTheme)) {
                hidePaintedLabel(data);
                return data;
            }
        }

        if (isVertical(this) && data?.elmt) {
            const verticalData = transposeVerticalPaintedRect(data);

            if (isTapeEvent(this, evt)) {
                const startPixel = Math.round(this._band.dateToPixelOffset(evt.getStart()));
                const endPixel = Math.round(this._band.dateToPixelOffset(evt.getEnd()));
                const spark = createTapeSparkLine(this);

                this._repriseTapeLabels.push({
                    evt,
                    lane: getTapeLane(this, evt),
                    data: verticalData,
                    width: verticalData.width,
                    height: verticalData.height,
                    naturalTop: verticalData.top,
                    startPixel: Math.min(startPixel, endPixel),
                    endPixel: Math.max(startPixel, endPixel),
                    tapeColor: getEventTapeColor(
                        evt,
                        theme.event.duration.color,
                        theme,
                        getPainterVisualTheme(this, evt)
                    ),
                    spark
                });

                return verticalData;
            }

            this._reprisePointLabels.push({
                evt,
                lane: getEventLane(this, evt),
                data: verticalData,
                width: verticalData.width,
                height: verticalData.height
            });

            return verticalData;
        }
        if (!isHorizontal(this) || !data?.elmt) return data;

        const metrics = this._repriseMetrics;

        if (isTapeEvent(this, evt)) {
            const lane = getTapeLane(this, evt);
            const spark = createTapeSparkLine(this);
            const startPixel = Math.round(this._band.dateToPixelOffset(evt.getStart()));
            const endPixel = Math.round(this._band.dateToPixelOffset(evt.getEnd()));

            setPaintedRect(data, {
                top: getTapeLabelTop(this, metrics, theme),
                width,
                height
            });

            this._repriseTapeLabels.push({
                evt,
                lane,
                data,
                width,
                height,
                naturalLeft: left,
                startPixel: Math.min(startPixel, endPixel),
                endPixel: Math.max(startPixel, endPixel),
                tapeColor: getEventTapeColor(
                    evt,
                    theme.event.duration.color,
                    theme,
                    getPainterVisualTheme(this, evt)
                ),
                spark
            });

            return data;
        }

        const item = rememberEventItem(
            this,
            this._reprisePointLabels,
            evt,
            getEventLane(this, evt),
            metrics,
            data
        );
        item.naturalLeft = left;
        item.width = width;
        item.height = height;
        if (!evt.isInstant()) {
            item.trackTopOffset += getTapeToLabelGap(this);
        }
        alignInstantLabelToIcon(this, item, metrics, theme);
        return data;
    };

    proto._showBubble = function (x, y, evt) {
        const nativeTheme = this._nativeTheme || this._params?.theme;
        const attachment = getAttachedEventContext(evt);
        const visualTheme = attachment?.visualTheme ?? this._visualTheme;
        const runtime = attachment?.runtime ?? this._runtime;
        if (!bubblesEnabled(evt, nativeTheme, visualTheme)) return;

        const graphics = window.SimileAjax?.Graphics;
        const windowManager = window.SimileAjax?.WindowManager;
        if (!graphics?.createBubbleForContentAndPoint || !windowManager?.cancelPopups) return;

        const content = this._timeline.getDocument().createElement("div");
        const temporal = attachment == null
            ? null
            : captureAttachedEventRenderContext(evt);
        fillRepriseBubble(content, attachment?.presentationEvent ?? evt, {
            runtime,
            visualTheme,
            nativeTheme,
            eventTime: temporal?.eventTime,
            currentTime: temporal?.currentTime,
            renderField: attachment == null
                ? null
                : (field, target, context) => renderAttachedEventField(
                    evt,
                    field,
                    target,
                    context
                )
        });
        windowManager.cancelPopups();
        return graphics.createBubbleForContentAndPoint(
            content,
            x,
            y,
            visualTheme.bubble.width,
            null,
            visualTheme.bubble.maxHeight
        );
    };

    proto.paint = function () {
        const eventSource = this._band.getEventSource();
        if (eventSource == null) return;

        this._eventIdToElmt = {};
        this._fireEventPaintListeners("paintStarting", null, null);
        this._prepareForPainting();

        const metrics = getOriginalPainterMetrics(this);
        const nativeTheme = this._nativeTheme || this._params.theme;
        const minDate = this._band.getMinDate();
        const maxDate = this._band.getMaxDate();
        const filter = this._filterMatcher || function () { return true; };
        const highlight = this._highlightMatcher || function () { return -1; };
        const iterator = eventSource.getEventReverseIterator(minDate, maxDate);

        this._repriseMetrics = metrics;
        while (iterator.hasNext()) {
            const evt = iterator.next();
            if (filter(evt)) {
                this.paintEvent(evt, metrics, nativeTheme, highlight(evt));
            }
        }

        this._highlightLayer.style.display = "block";
        this._lineLayer.style.display = "block";
        this._eventLayer.style.display = "block";
        this._band.updateEventTrackInfo(this._tracks.length, metrics.trackIncrement);
        this._fireEventPaintListeners("paintEnded", null, null);

        if (isHorizontal(this)) updateHorizontalLayout(this);
        if (isVertical(this)) updateVerticalLayout(this);
    };

    proto.softPaint = function () {
        const result = typeof originalSoftPaint === "function"
            ? originalSoftPaint.apply(this, arguments)
            : undefined;
        if (isHorizontal(this)) updateHorizontalLayout(this);
        if (isVertical(this)) updateVerticalLayout(this);
        return result;
    };

}());
