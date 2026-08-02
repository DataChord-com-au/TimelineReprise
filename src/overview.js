import { getAttachedEventContext } from "./attachments.js";

(function () {
    if (!window.Timeline || !Timeline.OverviewEventPainter) return;
    if (Timeline._overviewEventThemePatchApplied) return;
    Timeline._overviewEventThemePatchApplied = true;

    const LEFT_ALIGNED_VERTICAL_MARKER_TRACK_OFFSET = 48;

    function isObject(value) {
        return value != null && typeof value === "object" && !Array.isArray(value);
    }

    function getOrientation(timeline) {
        if (timeline?.isVertical?.()) return "vertical";
        if (timeline?.isHorizontal?.()) return "horizontal";
        return null;
    }

    function getOrientationSpec(value, timeline) {
        if (!isObject(value)) return {};

        const orientation = getOrientation(timeline);
        if (orientation != null && isObject(value[orientation])) {
            return value[orientation];
        }

        return isObject(value.horizontal) || isObject(value.vertical)
            ? {}
            : value;
    }

    function resolvePainterEventTheme(painter, band) {
        const nativeTheme = band?._theme || painter._params?.theme || null;
        painter._nativeTheme = nativeTheme;
        painter._eventTheme = Timeline.resolveEventTheme(
            painter._params?.eventTheme ?? null,
            nativeTheme
        );
    }

    const proto = Timeline.OverviewEventPainter.prototype;
    const originalInitialize = proto.initialize;
    const originalPaintEventTick = proto._paintEventTick;
    const originalPaintEventTape = proto._paintEventTape;

    function getOverviewGraphicColor(evt, theme, eventTheme, {
        eventField,
        themeField
    }) {
        const resolveColor = value => {
            if (typeof value !== "string" || value.trim() === "") return null;
            return Timeline.ThemeIcons?.getCssColor?.(value) ?? value;
        };
        const getProperty = name => typeof evt?.getProperty === "function"
            ? evt.getProperty(name)
            : evt?.[name];
        const emphasisKey = eventTheme.disableEmphasis
            ? null
            : getProperty("emphasis");
        const emphasis = emphasisKey == null
            ? null
            : theme?.emphasisSpecs?.[emphasisKey];
        const emphasisColor = resolveColor(
            emphasis?.iconColor ?? emphasis?.color
        );

        if (emphasisColor != null) {
            return { color: emphasisColor, eventOverride: true };
        }

        const configuredScope = String(
            getProperty("eventColorScope") ?? eventTheme.eventColorScope
        ).trim().toLowerCase();
        const scope = configuredScope === "graphic" || configuredScope === "both"
            ? configuredScope
            : configuredScope === "none" || configuredScope === "label"
                ? configuredScope
                : eventTheme.eventColorScope;
        if (scope === "graphic" || scope === "both") {
            const explicitColor = resolveColor(getProperty(eventField));
            if (explicitColor != null) {
                return { color: explicitColor, eventOverride: true };
            }

            const eventColor = resolveColor(
                evt?.getColor?.() ?? getProperty("color")
            );
            if (eventColor != null) {
                return { color: eventColor, eventOverride: true };
            }
        }

        return {
            color: resolveColor(eventTheme[themeField].iconColor),
            eventOverride: false
        };
    }

    function isVertical(painter) {
        return painter._timeline?.isVertical?.() === true;
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

    function positiveOr(value, fallback) {
        return typeof value === "number" && Number.isFinite(value) && value > 0
            ? value
            : fallback;
    }

    function nonNegativeOr(value, fallback) {
        return typeof value === "number" && Number.isFinite(value) && value >= 0
            ? value
            : fallback;
    }

    function getBandMarkerAlign(painter) {
        return painter._band?._bandInfo?.markerAlign ??
            painter._band?.markerAlign ??
            null;
    }

    function isConfiguredTrackOffset(painter) {
        const eventTheme = painter._eventTheme;
        const orientation = getOrientation(painter._timeline);

        return typeof eventTheme?._hasConfigured === "function" &&
            (
                eventTheme._hasConfigured("track.offset") ||
                (orientation != null &&
                    eventTheme._hasConfigured(`track.${orientation}.offset`))
            );
    }

    function getDefaultTrackOffset(painter, track) {
        return isVertical(painter) && getBandMarkerAlign(painter) === "Left"
            ? LEFT_ALIGNED_VERTICAL_MARKER_TRACK_OFFSET
            : nonNegativeOr(track.offset, 0);
    }

    function getNativeOverviewTrack(painter, theme) {
        return theme?.event?.overviewTrack ||
            painter._nativeTheme?.event?.overviewTrack ||
            {};
    }

    function getOverviewTickHeight(painter, theme) {
        return positiveOr(
            painter._eventTheme?.instant?.tickWidth,
            positiveOr(getNativeOverviewTrack(painter, theme).tickHeight, 6)
        );
    }

    proto.initialize = function (band, timeline) {
        const result = originalInitialize.apply(this, arguments);
        resolvePainterEventTheme(this, band);
        return result;
    };

    proto.paint = function () {
        const eventSource = this._band.getEventSource();
        if (eventSource == null) return;

        this._prepareForPainting();

        const track = getOrientationSpec(this._eventTheme.track, this._timeline);
        const defaultTrackOffset = getDefaultTrackOffset(this, track);
        const trackOffset = isConfiguredTrackOffset(this)
            ? nonNegativeOr(track.offset, defaultTrackOffset)
            : defaultTrackOffset;
        const trackGap = nonNegativeOr(track.gap, 0);
        const rangeWidth = this._eventTheme.range.width;
        const metrics = {
            tickOffset: trackOffset,
            trackOffset: trackOffset + trackGap,
            trackHeight: rangeWidth,
            trackGap,
            trackIncrement: rangeWidth + trackGap
        };
        const minDate = this._band.getMinDate();
        const maxDate = this._band.getMaxDate();
        const filter = this._filterMatcher || function () { return true; };
        const highlight = this._highlightMatcher || function () { return -1; };
        const iterator = eventSource.getEventReverseIterator(minDate, maxDate);

        while (iterator.hasNext()) {
            const evt = iterator.next();
            if (filter(evt)) {
                this.paintEvent(evt, metrics, this._nativeTheme, highlight(evt));
            }
        }

        this._highlightLayer.style.display = "block";
        this._eventLayer.style.display = "block";
        this._band.updateEventTrackInfo(this._tracks.length, metrics.trackIncrement);
    };

    proto._paintEventTick = function (evt, left, color, opacity, metrics, theme) {
        const data = originalPaintEventTick.apply(this, arguments);
        const eventTheme = getAttachedEventContext(evt)?.eventTheme ??
            this._eventTheme;
        const klassName = evt && typeof evt.getClassName === "function"
            ? evt.getClassName()
            : null;
        const resolvedColor = getOverviewGraphicColor(
            evt,
            theme,
            eventTheme,
            {
                eventField: "iconColor",
                themeField: "instant"
            }
        );

        if (
            data?.elmt &&
            (!klassName || resolvedColor.eventOverride) &&
            resolvedColor.color
        ) {
            data.elmt.style.backgroundColor = resolvedColor.color;
        }

        if (data?.elmt) {
            const tickHeight = getOverviewTickHeight(this, theme);
            data.top = metrics.tickOffset - tickHeight;
            data.height = tickHeight;
            data.elmt.style.top = data.top + "px";
            data.elmt.style.height = tickHeight + "px";
        }

        if (isVertical(this) && data?.elmt) {
            return transposeVerticalPaintedRect(data, { swapSize: true });
        }

        return data;
    };

    proto._paintEventTape = function (
        evt, track, left, right, color, opacity, metrics, theme, klassName
    ) {
        const eventTheme = getAttachedEventContext(evt)?.eventTheme ??
            this._eventTheme;
        const resolvedColor = getOverviewGraphicColor(
            evt,
            theme,
            eventTheme,
            {
                eventField: "tapeColor",
                themeField: "range"
            }
        );
        const data = originalPaintEventTape.call(
            this,
            evt,
            track,
            left,
            right,
            !klassName || resolvedColor.eventOverride
                ? resolvedColor.color
                : color,
            opacity,
            metrics,
            theme,
            klassName
        );
        if (isVertical(this) && data?.elmt) {
            return transposeVerticalPaintedRect(data, { swapSize: true });
        }

        return data;
    };

}());
