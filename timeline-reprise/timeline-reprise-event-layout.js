(function () {
    if (!window.Timeline || !Timeline.OriginalEventPainter) return;
    if (Timeline._eventLayout23PatchApplied) return;
    Timeline._eventLayout23PatchApplied = true;

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

    function maxFinite(fallback, values) {
        let result = fallback;

        for (const value of values) {
            const number = toFiniteNumber(value);
            if (number != null) result = Math.max(result, number);
        }

        return result;
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

    function getOrientationSpec(value, timeline) {
        if (!isObject(value)) return null;

        const orientation = getOrientation(timeline);
        if (orientation != null && isObject(value[orientation])) return value[orientation];

        return isObject(value.horizontal) || isObject(value.vertical)
            ? null
            : value;
    }

    function getEventTheme(params, eventTheme) {
        if (isObject(eventTheme)) return eventTheme;
        if (isObject(params?.eventTheme)) return params.eventTheme;
        if (isObject(params?.theme?.eventTheme)) return params.theme.eventTheme;
        return null;
    }

    function ensureNativeEventTheme(theme) {
        if (!isObject(theme.event)) theme.event = {};
        if (!isObject(theme.event.track)) theme.event.track = {};
        if (!isObject(theme.event.tape)) theme.event.tape = {};
        if (!isObject(theme.event.label)) theme.event.label = {};
        if (!isObject(theme.event.duration)) theme.event.duration = {};
        if (!isObject(theme.event.instant)) theme.event.instant = {};
        return theme.event;
    }

    function mergeObject(target, source) {
        if (!isObject(source)) return;

        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                target[key] = source[key];
            }
        }
    }

    function applyEventLayoutThemeToTheme(theme, authoredTheme, timeline) {
        if (!isObject(theme) || !isObject(authoredTheme)) return theme;

        const eventTheme = ensureNativeEventTheme(theme);
        const track = getOrientationSpec(authoredTheme.track, timeline);
        const instant = getOrientationSpec(authoredTheme.instant, timeline);
        const range = getOrientationSpec(authoredTheme.range, timeline);
        const label = getOrientationSpec(authoredTheme.label, timeline);

        if (isObject(track)) {
            setNumber(eventTheme.track, "offset", track.offset);
            setNumber(eventTheme.track, "gap", track.gap);
            setNumber(eventTheme.track, "height", track.height);
        }

        if (isObject(authoredTheme.instant)) {
            setNumber(eventTheme.instant, "iconWidth", authoredTheme.instant.width);
            setNumber(
                eventTheme.instant,
                "iconHeight",
                authoredTheme.instant.height ?? authoredTheme.instant.width
            );
        }

        if (isObject(instant)) {
            const orientation = getOrientation(timeline) === "vertical" ? "vertical" : "horizontal";
            if (!isObject(eventTheme.instant[orientation])) eventTheme.instant[orientation] = {};
            mergeObject(eventTheme.instant[orientation], instant);
        }

        if (isObject(authoredTheme.range)) {
            setNumber(eventTheme.tape, "height", authoredTheme.range.width);
            setColor(eventTheme.duration, "color", authoredTheme.range.iconColor);

            if (isObject(authoredTheme.range.short)) {
                if (!isObject(eventTheme.tape.short)) eventTheme.tape.short = {};
                mergeObject(eventTheme.tape.short, authoredTheme.range.short);
            }
        }

        if (isObject(range)) {
            const orientation = getOrientation(timeline) === "vertical" ? "vertical" : "horizontal";
            if (!isObject(eventTheme.tape[orientation])) eventTheme.tape[orientation] = {};
            mergeObject(eventTheme.tape[orientation], range);
        }

        if (isObject(label)) {
            const orientation = getOrientation(timeline) === "vertical" ? "vertical" : "horizontal";
            if (!isObject(eventTheme.label[orientation])) eventTheme.label[orientation] = {};
            mergeObject(eventTheme.label[orientation], label);
        }

        return theme;
    }

    function applyEventLayoutThemeToPainterParams(params, eventTheme, timeline) {
        if (!isObject(params) || !isObject(params.theme)) return params;
        applyEventLayoutThemeToTheme(params.theme, getEventTheme(params, eventTheme), timeline);
        return params;
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
        const tape = painter._params?.theme?.event?.tape || {};
        if (isVertical(painter)) return tape.vertical || tape.horizontal || {};
        return tape.horizontal || {};
    }

    function getLabelSpec(painter) {
        const label = painter._params?.theme?.event?.label || {};
        if (isVertical(painter)) return label.vertical || label.horizontal || {};
        return label.horizontal || {};
    }

    function getInstantSpec(painter) {
        const instant = painter._params?.theme?.event?.instant || {};
        if (isVertical(painter)) return instant.vertical || instant.horizontal || {};
        return instant.horizontal || {};
    }

    function getShortTapeSpec(painter) {
        return painter._params?.theme?.event?.tape?.short || {};
    }

    function getTrackGap(painter, metrics) {
        return finiteOr(
            painter._params?.theme?.event?.track?.gap,
            finiteOr(metrics?.trackGap, 2)
        );
    }

    function getTapeLaneGap(painter, metrics) {
        return finiteOr(getTapeSpec(painter).tapeGap, getTrackGap(painter, metrics));
    }

    function getTapeToLabelGap(painter, metrics) {
        return finiteOr(getTapeSpec(painter).toLabelGap, getTrackGap(painter, metrics));
    }

    function getLabelGap(painter, metrics) {
        return finiteOr(
            getTapeSpec(painter).labelHorizontalGap,
            Math.max(getTrackGap(painter, metrics), 12)
        );
    }

    function getEventRoutingThreshold(painter) {
        return finiteOr(getTapeSpec(painter).eventRoutingThreshold, 28);
    }

    function getShortDurationMinDisplayWidth(painter) {
        return finiteOr(
            getShortTapeSpec(painter).minDisplayLength,
            painter._params?.theme?.event?.tape?.height || 4
        );
    }

    function getShortDurationLabelGap(painter) {
        return finiteOr(getShortTapeSpec(painter).toLabelGap, 3);
    }

    function getTapeLabelTrackCount(painter) {
        return Math.max(1, normalizeLane(finiteOr(getTapeSpec(painter).labelTrackCount, 1)));
    }

    function getTapeLabelTrackHeight(painter, metrics) {
        return finiteOr(getTapeSpec(painter).labelTrackHeight, metrics.trackHeight);
    }

    function getTapeLabelTrackGap(painter, metrics) {
        return finiteOr(getTapeSpec(painter).labelTrackGap, getTrackGap(painter, metrics));
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

    function getInstantLabelGap(painter, theme) {
        return finiteOr(
            getInstantSpec(painter).labelGap,
            finiteOr(getLabelSpec(painter).instantLabelGap, (theme?.event?.label?.offsetFromLine || 3) + 4)
        );
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
        const eventTheme = painter._params?.theme?.event || {};
        const track = eventTheme.track || {};
        const tape = eventTheme.tape || {};
        const instant = eventTheme.instant || {};
        const lineHeight = positiveOr(painter._frc?.getLineHeight?.(), 12);
        const trackHeight = Math.max(
            positiveOr(track.height, 10),
            positiveOr(tape.height, 4) + lineHeight
        );
        const trackGap = finiteOr(track.gap, 2);

        return {
            trackOffset: finiteOr(track.offset, 2),
            trackHeight,
            trackGap,
            trackIncrement: trackHeight + trackGap,
            iconWidth: positiveOr(instant.iconWidth, 10),
            iconHeight: positiveOr(instant.iconHeight, positiveOr(instant.iconWidth, 10))
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

    function verticalSpanIsFree(spans, top, bottom, gap) {
        return !spans.some((span) =>
            top < span.bottom + gap &&
            bottom + gap > span.top
        );
    }

    function buildVerticalEventGroups(painter) {
        const groups = new Map();
        let fallback = 0;

        function getGroup(item) {
            const key = getPointGroupKey(item, fallback++);
            let group = groups.get(key);

            if (!group) {
                const span = getVerticalEventSpan(painter, item.evt);
                const startPixel = Math.round(painter._band.dateToPixelOffset(item.evt.getStart()));
                group = {
                    evt: item.evt,
                    index: groups.size,
                    items: [],
                    startPixel,
                    span,
                    isDuration: !item.evt?.isInstant?.(),
                    fixedLane: item.evt.getTrackNum?.() == null
                        ? null
                        : normalizeLane(item.evt.getTrackNum())
                };
                groups.set(key, group);
            }

            return group;
        }

        for (const item of painter._reprisePointIcons) getGroup(item).items.push(item);
        for (const item of painter._reprisePointTapes) getGroup(item).items.push(item);
        for (const item of painter._reprisePointLabels) getGroup(item).items.push(item);

        return Array.from(groups.values());
    }

    function assignVerticalEventLanes(painter) {
        const groups = buildVerticalEventGroups(painter)
            .sort((a, b) =>
                a.startPixel - b.startPixel ||
                Number(b.isDuration) - Number(a.isDuration) ||
                a.index - b.index
            );
        const gap = getTrackGap(painter, painter._repriseMetrics || getOriginalPainterMetrics(painter));
        const initialLaneCount = getTapeLabelTrackCount(painter);
        const laneSpans = Array.from(
            { length: initialLaneCount },
            () => []
        );

        painter._repriseEventLanes = {};

        function ensureLane(lane) {
            while (laneSpans.length <= lane) laneSpans.push([]);
        }

        function assignGroup(group, lane) {
            ensureLane(lane);
            laneSpans[lane].push(group.span);

            const id = getEventId(group.evt);
            if (id != null) painter._repriseEventLanes[id] = lane;

            for (const item of group.items) {
                item.lane = lane;
            }
        }

        for (const group of groups.filter((item) => item.fixedLane != null)) {
            assignGroup(group, group.fixedLane);
        }

        for (const group of groups.filter((item) => item.fixedLane == null)) {
            let lane = 0;

            for (; lane < laneSpans.length; lane++) {
                if (verticalSpanIsFree(
                    laneSpans[lane],
                    group.span.top,
                    group.span.bottom,
                    gap
                )) break;
            }

            assignGroup(group, lane);
        }

        painter._repriseEventLaneSpans = laneSpans;
    }

    function getTapeLaneTop(painter, metrics, theme, lane) {
        return metrics.trackOffset +
            lane * (theme.event.tape.height + getTapeLaneGap(painter, metrics));
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
            tapeCount * (theme.event.tape.height + getTapeLaneGap(painter, metrics)) -
            getTapeLaneGap(painter, metrics) +
            getTapeToLabelGap(painter, metrics);
    }

    function getRoutedTrackCount(painter) {
        return Math.max(0, painter._repriseLabelTrackCount || 0);
    }

    function getRoutedTrackHeight(painter, metrics) {
        return Math.max(
            getTapeLabelTrackHeight(painter, metrics),
            painter._repriseLabelTrackHeight || 0
        );
    }

    function getRoutedTrackIncrement(painter, metrics) {
        return getRoutedTrackHeight(painter, metrics) +
            getTapeLabelTrackGap(painter, metrics);
    }

    function getRoutedTrackBlockHeight(painter, metrics) {
        const trackCount = getRoutedTrackCount(painter);
        if (trackCount === 0) return 0;

        return trackCount * getRoutedTrackHeight(painter, metrics) +
            Math.max(0, trackCount - 1) * getTapeLabelTrackGap(painter, metrics);
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
            lane * (theme.event.tape.height + getTapeLaneGap(painter, metrics));
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
            tapeCount * (theme.event.tape.height + getTapeLaneGap(painter, metrics)) -
            getTapeLaneGap(painter, metrics) +
            getTapeToLabelGap(painter, metrics);
    }

    function getVerticalEventBaseLeft(painter, metrics, theme) {
        const tapeCount = getTapeLaneCount(painter);
        if (tapeCount === 0) return metrics.trackOffset;

        const tapeRight = metrics.trackOffset +
            tapeCount * (theme.event.tape.height + getTapeLaneGap(painter, metrics)) -
            getTapeLaneGap(painter, metrics);
        const labelRight = getVerticalTapeLabelLeft(painter, metrics, theme) +
            getVerticalTapeLabelWidth(painter, metrics);
        const gap = finiteOr(
            getTapeSpec(painter).toEventGap,
            Math.max(getTrackGap(painter, metrics), 12)
        );

        return Math.max(tapeRight, labelRight) + gap;
    }

    function getVerticalEventLaneIncrement(painter, metrics, theme) {
        const markerWidth = Math.max(metrics.iconWidth, theme.event.tape.height);

        return Math.max(
            metrics.trackIncrement,
            markerWidth +
                getInstantLabelGap(painter, theme) +
                getVerticalTapeLabelWidth(painter, metrics) +
                getTrackGap(painter, metrics)
        );
    }

    function getVerticalEventLaneLeft(painter, metrics, theme, lane) {
        return getVerticalEventBaseLeft(painter, metrics, theme) +
            lane * getVerticalEventLaneIncrement(painter, metrics, theme);
    }

    function getVerticalPointLabelLeft(painter, item, metrics, theme) {
        const markerWidth = item.evt?.isInstant?.()
            ? metrics.iconWidth
            : theme.event.tape.height;

        return getVerticalEventLaneLeft(painter, metrics, theme, item.lane) +
            markerWidth +
            getInstantLabelGap(painter, theme);
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

    function getEventTapeColor(evt, fallback) {
        const tapeColor = evt?.getProperty?.("tapeColor");
        if (typeof tapeColor === "string" && tapeColor.trim() !== "") return tapeColor;

        const eventColor = evt?.getColor?.();
        if (typeof eventColor === "string" && eventColor.trim() !== "") return eventColor;

        return fallback;
    }

    function createTapeSparkLine(painter) {
        const doc = painter._timeline.getDocument();
        ensureTapeSparklineStyles(doc);

        const sparkDiv = doc.createElement("div");
        sparkDiv.className = "timeline-event-tape-sparkline";
        sparkDiv.style.position = "absolute";
        sparkDiv.style.pointerEvents = "none";
        sparkDiv.style.zIndex = "1";
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

    function updateTapeSparkLine(painter, item, metrics, theme) {
        if (!item.spark?.elmt) return;

        const cssColor = Timeline.ThemeIcons?.getCssColor
            ? Timeline.ThemeIcons.getCssColor(item.tapeColor)
            : item.tapeColor;

        if (cssColor) {
            item.spark.elmt.style.backgroundColor =
                "color-mix(in srgb, " + cssColor + " 70%, white)";
        }

        const tapeCenter = getTapeLaneTop(painter, metrics, theme, item.lane) +
            Math.round(theme.event.tape.height / 2);
        const sparkTop = tapeCenter;
        const sparkHeight = Math.max(0, item.data.top - tapeCenter - 2);
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

        const cssColor = Timeline.ThemeIcons?.getCssColor
            ? Timeline.ThemeIcons.getCssColor(item.tapeColor)
            : item.tapeColor;

        if (cssColor) {
            item.spark.elmt.style.backgroundColor =
                "color-mix(in srgb, " + cssColor + " 70%, white)";
        }

        const tapeCenter = getVerticalTapeLaneLeft(painter, metrics, theme, item.lane) +
            Math.round(theme.event.tape.height / 2);
        const fontSize = getLabelFontSize(item.data, getDataHeight(item.data, item.height || 12));
        const sparkTop = Math.round(item.data.top + fontSize / 2);
        const sparkWidth = Math.max(0, item.data.left - tapeCenter - 2);

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

    function getItemBottomOffset(item) {
        return item.trackTopOffset + getDataHeight(item.data, item.height || 0);
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

        const iconWidth = finiteOr(metrics.iconWidth, getDataWidth(icon.data, 0));
        const iconMetrics = getRenderedIconMetrics(icon, metrics);
        const iconCenterTop = icon.data.top + iconMetrics.topOffset + iconMetrics.height / 2;
        const fontSize = getLabelFontSize(item.data, item.height || getDataHeight(item.data, 0));
        const left = icon.data.left + iconWidth + getInstantLabelGap(painter, theme);
        const top = Math.round(iconCenterTop - fontSize * 0.35);

        setPaintedRect(item.data, { left, top });

        item.naturalLeft = left;
        item.trackTopOffset = top - getOriginalTrackTop(metrics, item.lane);
    }

    function alignVerticalInstantLabelToIcon(painter, item, metrics) {
        if (!item.evt?.isInstant?.()) return;

        const icon = findPointIconItem(painter, item.evt);
        if (!icon?.data) return;

        const iconMetrics = getRenderedIconMetrics(icon, metrics);
        const iconCenterTop = icon.data.top + iconMetrics.topOffset + iconMetrics.height / 2;
        const fontSize = getLabelFontSize(item.data, item.height || getDataHeight(item.data, 0));
        const top = Math.round(iconCenterTop - fontSize * 0.35);

        setPaintedRect(item.data, { top });
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
            group.minTopOffset = Math.min(group.minTopOffset, item.trackTopOffset);
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

    function rebuildTapeLanes(painter, metrics) {
        const gap = getTapeLaneGap(painter, metrics);
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
                    if (laneEnds[lane] + gap < item.startPixel) break;
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

        rebuildTapeLanes(painter, metrics);

        const tapeLabelLeft = getVerticalTapeLabelLeft(painter, metrics, theme);
        const labelWidth = getVerticalTapeLabelWidth(painter, metrics);

        for (const item of painter._repriseTapeBars) {
            setPaintedRect(item.data, {
                left: getVerticalTapeLaneLeft(painter, metrics, theme, item.lane),
                width: theme.event.tape.height
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

        const viewportTop = -painter._band.getViewOffset();
        const stickyTop = viewportTop + getStickyTopInset(painter);
        const labelGap = finiteOr(
            getTapeSpec(painter).stickyLabelGap,
            getTapeLabelTrackGap(painter, metrics)
        );
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
        let nextLabelTop = stickyTop;

        for (const { item } of [...stickyTapeLabels, ...normalTapeLabels]) {
            const naturalTop = item.naturalTop ?? item.startPixel;
            const top = Math.max(naturalTop, nextLabelTop);

            if (item.endPixel <= top) {
                item.data.elmt.style.display = "none";
                if (item.spark?.elmt) item.spark.elmt.style.display = "none";
                continue;
            }

            setPaintedRect(item.data, { top });
            nextLabelTop = top + item.height + labelGap;
            updateVerticalTapeSparkLine(painter, item, metrics, theme);
        }

        assignVerticalEventLanes(painter);

        for (const item of painter._reprisePointIcons) {
            item.lane = Number.isFinite(item.lane)
                ? item.lane
                : getEventLane(painter, item.evt);

            setPaintedRect(item.data, {
                left: getVerticalEventLaneLeft(painter, metrics, theme, item.lane)
            });
        }

        for (const item of painter._reprisePointTapes) {
            item.lane = Number.isFinite(item.lane)
                ? item.lane
                : getEventLane(painter, item.evt);

            setPaintedRect(item.data, {
                left: getVerticalEventLaneLeft(painter, metrics, theme, item.lane),
                width: theme.event.tape.height,
                height: Math.max(
                    getDataHeight(item.data, item.height || 0),
                    getShortDurationMinDisplayWidth(painter)
                )
            });
        }

        for (const item of painter._reprisePointLabels) {
            item.lane = Number.isFinite(item.lane)
                ? item.lane
                : getEventLane(painter, item.evt);

            setPaintedRect(item.data, {
                left: getVerticalPointLabelLeft(painter, item, metrics, theme),
                width: labelWidth
            });
            alignVerticalInstantLabelToIcon(painter, item, metrics);
        }
    }

    function updateHorizontalLayout(painter) {
        const metrics = painter._repriseMetrics;
        const theme = painter._params.theme;
        if (!metrics || !theme) return;

        rebuildTapeLanes(painter, metrics);

        const viewportLeft = -painter._band.getViewOffset();
        const stickyLeft = viewportLeft + getStickyLeftInset(painter);
        const stickyRight = viewportLeft + painter._band.getViewLength() - getStickyLeftInset(painter);
        const labelGap = getLabelGap(painter, metrics);
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
            ? Array.from({ length: getTapeLabelTrackCount(painter) }, () => [])
            : [];
        const tapePlacements = [];

        painter._repriseLabelTrackHeight = maxFinite(
            getTapeLabelTrackHeight(painter, metrics),
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

        const tapeLabelTrackCount = tapePlacements.reduce(
            (count, entry) => Math.max(count, entry.placement.track + 1),
            0
        );
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
                const stagger = Math.max(0, tapeLabelTrackCount - 1 - placement.track) *
                    sparklineStagger;
                const maxStagger = Math.max(0, item.endPixel - placement.left - 1);
                const desiredLeft = placement.left + Math.min(stagger, maxStagger);
                const rightStickyLeft = stickyRight - width;
                const rightSticky = desiredLeft > rightStickyLeft;
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
                    rightSticky
                });
            }
        }

        for (const entry of routedTapePlacements) {
            const reservationLeft = entry.rightSticky
                ? stickyLeft
                : entry.left;
            const track = placeFixedGroup(shiftedTracks, reservationLeft, entry.right, labelGap);
            reserveInterval(shiftedTracks, track, reservationLeft, entry.right);

            setPaintedRect(entry.item.data, {
                left: entry.left,
                top: getEventLaneTop(painter, metrics, theme, track),
                width: entry.width
            });

            entry.item._repriseSparkLeft = entry.rightSticky
                ? entry.item.startPixel + 2
                : entry.left + 2;

            if (entry.item.spark) updateTapeSparkLine(painter, entry.item, metrics, theme);
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
                height: theme.event.tape.height
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
                top: getEventLaneTop(painter, metrics, theme, item.lane) + item.trackTopOffset
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
    const originalPaint = proto.paint;
    const originalSoftPaint = proto.softPaint;

    proto.initialize = function (band, timeline) {
        applyEventLayoutThemeToPainterParams(this._params, null, timeline);
        const result = originalInitialize.apply(this, arguments);
        applyEventLayoutThemeToPainterParams(this._params, null, timeline);
        return result;
    };

    proto._prepareForPainting = function () {
        const result = originalPrepare.apply(this, arguments);

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
                const gap = getTapeLaneGap(this, this._repriseMetrics);
                let lane = 0;

                for (; lane < this._repriseTapeLaneStarts.length; lane++) {
                    if (this._repriseTapeLaneStarts[lane] > endPixel + gap) break;
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
            const gap = getTapeLaneGap(this, this._repriseMetrics);
            let lane = 0;

            for (; lane < this._repriseTapeLaneStarts.length; lane++) {
                if (this._repriseTapeLaneStarts[lane] > endPixel + gap) break;
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
        const data = originalPaintIcon.apply(this, arguments);
        if (isVertical(this) && data?.elmt) {
            const verticalData = transposeVerticalPaintedRect(data);
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

        rememberEventItem(this, this._reprisePointIcons, evt, iconTrack, metrics, data);
        return data;
    };

    proto._paintEventTape = function (
        evt, iconTrack, startPixel, endPixel, color, opacity, metrics, theme, tapeIndex
    ) {
        this._repriseMetrics = metrics;
        const tapeColor = getEventTapeColor(evt, color);
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
        if (isVertical(this) && data?.elmt) {
            const verticalData = transposeVerticalPaintedRect(data, { swapSize: true });
            const tapeEvent = isTapeEvent(this, evt);

            if (!tapeEvent && !evt.isInstant()) {
                setPaintedRect(verticalData, {
                    width: theme.event.tape.height,
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
                height: theme.event.tape.height
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
                    tapeColor: getEventTapeColor(evt, theme.event.duration.color),
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
                tapeColor: getEventTapeColor(evt, theme.event.duration.color),
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
            item.trackTopOffset += getShortDurationLabelGap(this);
        }
        alignInstantLabelToIcon(this, item, metrics, theme);
        return data;
    };

    proto.paint = function () {
        const result = originalPaint.apply(this, arguments);
        if (isHorizontal(this)) updateHorizontalLayout(this);
        if (isVertical(this)) updateVerticalLayout(this);
        return result;
    };

    proto.softPaint = function () {
        const result = typeof originalSoftPaint === "function"
            ? originalSoftPaint.apply(this, arguments)
            : undefined;
        if (isHorizontal(this)) updateHorizontalLayout(this);
        if (isVertical(this)) updateVerticalLayout(this);
        return result;
    };

    Timeline.EventLayoutThemeShim = Timeline.EventLayoutThemeShim || {};
    Timeline.EventLayoutThemeShim.applyEventTheme = applyEventLayoutThemeToTheme;
    Timeline.EventLayoutThemeShim.applyToPainterParams = applyEventLayoutThemeToPainterParams;
}());
