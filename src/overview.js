(function () {
    if (!window.Timeline || !Timeline.OverviewEventPainter) return;
    if (Timeline._overviewEventThemeShimApplied) return;
    Timeline._overviewEventThemeShimApplied = true;

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

    function setNumber(target, key, value) {
        const number = toFiniteNumber(value);
        if (number != null) target[key] = number;
    }

    function setColor(target, key, value) {
        if (typeof value !== "string" || value.trim() === "") return;

        target[key] = Timeline.ThemeIcons?.getCssColor
            ? Timeline.ThemeIcons.getCssColor(value)
            : value;
    }

    function getOrientation(timeline) {
        if (timeline?.isVertical?.()) return "vertical";
        if (timeline?.isHorizontal?.()) return "horizontal";
        return null;
    }

    function getTrackSpec(authoredTheme, timeline) {
        const track = authoredTheme?.track;

        if (isObject(track)) {
            const orientation = getOrientation(timeline);
            if (orientation != null && isObject(track[orientation])) return track[orientation];

            return isObject(track.horizontal) || isObject(track.vertical)
                ? null
                : track;
        }

        return null;
    }

    function getEventTheme(params, eventTheme) {
        if (isObject(eventTheme)) return eventTheme;
        if (isObject(params?.eventTheme)) return params.eventTheme;
        if (isObject(params?.theme?.eventTheme)) return params.theme.eventTheme;
        return null;
    }

    function ensureNativeEventTheme(theme) {
        if (!isObject(theme.event)) theme.event = {};
        if (!isObject(theme.event.overviewTrack)) theme.event.overviewTrack = {};
        if (!isObject(theme.event.duration)) theme.event.duration = {};
        if (!isObject(theme.event.instant)) theme.event.instant = {};
        return theme.event;
    }

    function applyEventThemeToTheme(theme, authoredTheme, timeline) {
        if (!isObject(theme) || !isObject(authoredTheme)) {
            return theme;
        }

        const eventTheme = ensureNativeEventTheme(theme);
        const track = getTrackSpec(authoredTheme, timeline);

        const tickHeight = toFiniteNumber(authoredTheme.instant?.tickWidth);
        const trackOffset = toFiniteNumber(track?.offset);

        if (isObject(track)) {
            setNumber(eventTheme.overviewTrack, "gap", track.gap);

            if (trackOffset != null) {
                eventTheme.overviewTrack.offset = trackOffset +
                    (tickHeight ?? eventTheme.overviewTrack.tickHeight ?? 0);
            }
        }

        if (isObject(authoredTheme.instant)) {
            setNumber(eventTheme.overviewTrack, "tickHeight", authoredTheme.instant.tickWidth);
            setColor(eventTheme.instant, "color", authoredTheme.instant.iconColor);
        }

        if (isObject(authoredTheme.range)) {
            setNumber(eventTheme.overviewTrack, "height", authoredTheme.range.width);
            setColor(eventTheme.duration, "color", authoredTheme.range.iconColor);
        }

        return theme;
    }

    function applyEventThemeToPainterParams(params, eventTheme, timeline) {
        if (!isObject(params) || !isObject(params.theme)) return params;
        applyEventThemeToTheme(params.theme, getEventTheme(params, eventTheme), timeline);
        return params;
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

    proto.initialize = function (band, timeline) {
        applyEventThemeToPainterParams(this._params, null, timeline);
        const result = originalInitialize.apply(this, arguments);
        applyEventThemeToPainterParams(this._params, null, timeline);
        return result;
    };

    proto._paintEventTick = function (evt, left, color, opacity, metrics, theme) {
        const data = originalPaintEventTick.apply(this, arguments);
        const klassName = evt && typeof evt.getClassName === "function"
            ? evt.getClassName()
            : null;
        const eventColor = getEventOverviewColor(evt);
        const tickColor = eventColor ?? theme?.event?.instant?.color;

        if (data?.elmt && (!klassName || eventColor) && tickColor) {
            data.elmt.style.backgroundColor = tickColor;
        }

        if (data?.elmt && theme?.event?.overviewTrack?.tickHeight) {
            data.height = theme.event.overviewTrack.tickHeight;
            data.elmt.style.height = theme.event.overviewTrack.tickHeight + "px";
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
        const data = originalPaintEventTape.call(
            this,
            evt,
            track,
            left,
            right,
            eventColor ?? color,
            opacity,
            metrics,
            theme,
            klassName
        );
        const gap = theme?.event?.overviewTrack?.gap || 0;

        if (data?.elmt && gap) {
            data.top += gap;
            data.elmt.style.top = data.top + "px";
        }

        if (isVertical(this) && data?.elmt) {
            return transposeVerticalPaintedRect(data, { swapSize: true });
        }

        return data;
    };

    Timeline.OverviewThemeShim = Timeline.OverviewThemeShim || {};
    Timeline.OverviewThemeShim.applyEventTheme = applyEventThemeToTheme;
    Timeline.OverviewThemeShim.applyToPainterParams = applyEventThemeToPainterParams;

    const NativeOverviewEventPainter = Timeline.OverviewEventPainter;

    Timeline.OverviewEventPainter = function (params) {
        applyEventThemeToPainterParams(params);
        NativeOverviewEventPainter.call(this, params);
    };
    Timeline.OverviewEventPainter.prototype = NativeOverviewEventPainter.prototype;
    Timeline.OverviewEventPainter._nativeOverviewEventPainter = NativeOverviewEventPainter;
}());
