import { getAttachedEventContext } from "./attachments.js";

(function () {
    if (!window.Timeline || !Timeline.OverviewEventPainter) return;
    if (Timeline._overviewEventThemePatchApplied) return;
    Timeline._overviewEventThemePatchApplied = true;

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

    function getEventOverviewColor(evt) {
        const color = evt && typeof evt.getProperty === "function"
            ? evt.getProperty("overviewColor")
            : null;

        if (typeof color !== "string" || color.trim() === "") return null;

        return Timeline.ThemeIcons?.getCssColor
            ? Timeline.ThemeIcons.getCssColor(color)
            : color;
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

    function getNativeOverviewTrack(painter, theme) {
        return theme?.event?.overviewTrack ||
            painter._nativeTheme?.event?.overviewTrack ||
            {};
    }

    function getOverviewTickHeight(painter, theme) {
        return positiveOr(getNativeOverviewTrack(painter, theme).tickHeight, 6);
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
        const trackOffset = nonNegativeOr(track.offset, 0);
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
        const eventColor = getEventOverviewColor(evt);
        const tickColor = eventColor ??
            Timeline.ThemeIcons?.getCssColor?.(eventTheme.instant.iconColor) ??
            eventTheme.instant.iconColor;

        if (data?.elmt && (!klassName || eventColor) && tickColor) {
            data.elmt.style.backgroundColor = tickColor;
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
        const eventColor = getEventOverviewColor(evt);
        const eventTheme = getAttachedEventContext(evt)?.eventTheme ??
            this._eventTheme;
        const themeColor = Timeline.ThemeIcons?.getCssColor?.(
            eventTheme.range.iconColor
        ) ?? eventTheme.range.iconColor;
        const data = originalPaintEventTape.call(
            this,
            evt,
            track,
            left,
            right,
            eventColor ?? themeColor,
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
