import {
    fillRepriseBubble,
    hasRenderedContent,
    renderEventField,
    resolveRepriseRuntime,
    setRenderedContent
} from "./presentation-runtime.js";
import {
    captureAttachedEventRenderContext,
    getAttachedEventContext,
    renderAttachedEventField
} from "./attachments.js";

(function () {
    if (!window.Timeline || Timeline.NarrativeDecorator) return;

    const DEFAULT_HORIZONTAL_TRACK_SIZE = 18;
    const DEFAULT_VERTICAL_TRACK_SIZE = 120;
    const DEFAULT_NARRATIVE_LAYER_Z_INDEX = 5;
    const DEFAULT_NARRATIVE_DIVIDER_Z_INDEX = 101;
    const DEFAULT_NARRATIVE_LABEL_Z_INDEX = 114;
    function finiteOr(value, fallback) {
        const number = toFiniteNumber(value);
        return number != null ? number : fallback;
    }

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

    function resolveCssColor(value) {
        if (typeof value !== "string" || value.trim() === "") return null;

        return Timeline.ThemeIcons?.getCssColor
            ? Timeline.ThemeIcons.getCssColor(value)
            : value;
    }

    function stringValue(value) {
        return typeof value === "string" && value.trim() !== ""
            ? value
            : null;
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

    function normalizeLabelColorMode(value, fallback) {
        const source = typeof value === "string"
            ? value.trim().toLowerCase()
            : "";

        return source === "graphic" || source === "theme" || source === "inherit"
            ? source
            : fallback;
    }

    function normalizeLabelFlow(value, fallback = "normal") {
        const flow = typeof value === "string"
            ? value.trim().toLowerCase()
            : "";

        return flow === "normal" || flow === "orthogonal"
            ? flow
            : fallback;
    }

    function normalizeRangeLabelAlign(value, fallback = "start") {
        const align = typeof value === "string"
            ? value.trim().toLowerCase()
            : "";

        return align === "start" || align === "center"
            ? align
            : fallback;
    }

    function normalizeRangeGraphic(value, fallback = "span") {
        const graphic = typeof value === "string"
            ? value.trim().toLowerCase()
            : "";

        return graphic === "span" ||
            graphic === "start" ||
            graphic === "end" ||
            graphic === "both"
            ? graphic
            : fallback;
    }

    function parseColorChannels(color) {
        const source = String(color ?? "").trim();
        const rgb = source.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
        if (rgb) {
            return [
                Number(rgb[1]) / 255,
                Number(rgb[2]) / 255,
                Number(rgb[3]) / 255
            ];
        }

        const hex = source.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
        if (!hex) return null;

        const value = hex[1];
        const full = value.length === 3
            ? value.split("").map(part => part + part).join("")
            : value.slice(0, 6);

        return [
            parseInt(full.slice(0, 2), 16) / 255,
            parseInt(full.slice(2, 4), 16) / 255,
            parseInt(full.slice(4, 6), 16) / 255
        ];
    }

    function deriveSpanLabelColor(color) {
        const channels = parseColorChannels(color);
        if (!channels) return color ?? null;

        const [r, g, b] = channels;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const light = (max + min) / 2;

        if (max === min) return light > 0.55 ? "hsl(0, 0%, 28%)" : "hsl(0, 0%, 72%)";

        const delta = max - min;
        const sat = light > 0.5 ? delta / (2 - max - min) : delta / (max + min);
        let hue = max === r
            ? (g - b) / delta + (g < b ? 6 : 0)
            : max === g
                ? (b - r) / delta + 2
                : (r - g) / delta + 4;

        hue *= 60;
        const yellowish = hue >= 35 && hue <= 75;
        const lightSat = yellowish
            ? Math.max(sat * 0.72, 0.46)
            : Math.max(sat * 0.55, 0.34);
        const lightLabel = yellowish ? 40 : light > 0.55 ? 32 : 38;
        const darkSat = yellowish
            ? Math.max(sat * 0.65, 0.42)
            : Math.max(sat * 0.62, 0.40);
        const darkLabel = yellowish ? 68 : 64;

        return `light-dark(hsl(${Math.round(hue)}, ${Math.round(lightSat * 100)}%, ${lightLabel}%), hsl(${Math.round(hue)}, ${Math.round(darkSat * 100)}%, ${darkLabel}%))`;
    }

    function toNameList(names) {
        return Array.isArray(names) ? names : [names];
    }

    function hasDefinedOwn(source, name) {
        return source != null &&
            Object.prototype.hasOwnProperty.call(source, name) &&
            source[name] !== undefined;
    }

    function hasEventCaption(event) {
        if (
            hasDefinedOwn(event, "caption") &&
            event.caption !== null &&
            event.caption !== ""
        ) {
            return true;
        }

        const value = event?.getProperty?.("caption");
        return value !== undefined && value !== null && value !== "";
    }

    function removeElementTitle(element) {
        if (typeof element?.removeAttribute === "function") {
            element.removeAttribute("title");
        } else if (element != null) {
            delete element.title;
        }
    }

    function setDynamicCaption(element, value) {
        if (hasRenderedContent(value)) {
            element.title = String(value).replace(/<[^>]*>/g, "");
            element._repriseHasDynamicCaption = true;
        } else if (element._repriseHasDynamicCaption === true) {
            removeElementTitle(element);
            element._repriseHasDynamicCaption = false;
        }
    }

    function ownValue(source, names) {
        for (const name of toNameList(names)) {
            if (hasDefinedOwn(source, name)) {
                return { found: true, value: source[name] };
            }
        }

        return { found: false, value: undefined };
    }

    function themedValue(params, themes, themeNames, fallback, paramNames) {
        const paramValue = ownValue(params, paramNames == null ? themeNames : paramNames);
        if (paramValue.found) return paramValue.value;

        const themeList = Array.isArray(themes) ? themes : [themes];
        for (const theme of themeList) {
            const themeValue = ownValue(theme, themeNames);
            if (themeValue.found) return themeValue.value;
        }

        return fallback;
    }

    function themedFinite(params, themes, themeNames, fallback, paramNames) {
        return finiteOr(themedValue(params, themes, themeNames, fallback, paramNames), fallback);
    }

    function themedFiniteOrNull(params, themes, themeNames, paramNames) {
        const value = themedValue(params, themes, themeNames, null, paramNames);
        return toFiniteNumber(value);
    }

    function getOrientation(timeline) {
        if (timeline?.isVertical?.()) return "vertical";
        if (timeline?.isHorizontal?.()) return "horizontal";
        return null;
    }

    function getOrientedObject(source, timeline) {
        if (!isObject(source)) return {};

        const orientation = getOrientation(timeline);
        if (orientation != null && isObject(source[orientation])) {
            return source[orientation];
        }

        return isObject(source.horizontal) || isObject(source.vertical)
            ? {}
            : source;
    }

    function configuredLabelWidth(visualTheme, timeline) {
        const orientation = getOrientation(timeline);
        const hasConfigured = visualTheme?._hasConfigured;

        if (typeof hasConfigured === "function") {
            if (
                orientation != null &&
                hasConfigured.call(visualTheme, ["label", orientation, "width"])
            ) {
                return toFiniteNumber(visualTheme?.label?.[orientation]?.width);
            }

            return hasConfigured.call(visualTheme, ["label", "width"])
                ? toFiniteNumber(visualTheme?.label?.width)
                : null;
        }

        const label = visualTheme?.label;
        if (!isObject(label)) return null;
        if (orientation != null && isObject(label[orientation])) {
            const oriented = label[orientation];
            if (Object.prototype.hasOwnProperty.call(oriented, "width")) {
                return toFiniteNumber(oriented.width);
            }
        }

        return Object.prototype.hasOwnProperty.call(label, "width")
            ? toFiniteNumber(label.width)
            : null;
    }

    function cycleValue(values, index) {
        return Array.isArray(values) && values.length > 0
            ? values[index % values.length]
            : null;
    }

    function normalizeTrackAlign(value) {
        const align = value == null ? "start" : String(value).trim().toLowerCase();
        if (align === "start" || align === "end") return align;
        throw new TypeError("Timeline.NarrativeDecorator track.align must be 'start' or 'end'.");
    }

    function hasTrackValue(value) {
        return value != null && value !== "";
    }

    Timeline.NarrativeDecorator = function (params) {
        params = params || {};
        this._visualThemeSelection = params.visualTheme ?? null;
        this._visualTheme = Timeline.resolveVisualTheme(this._visualThemeSelection, null);
        this._nativeTheme = null;

        this._runtimeSelection = params.runtime ?? null;
        this._runtime = null;
        this._ranges = Array.isArray(params.ranges) ? params.ranges : [];
        this._instants = Array.isArray(params.instants) ? params.instants : [];

        this._band = null;
        this._timeline = null;
        this._layerDiv = null;
        this._dividerLayerDiv = null;
        this._labelLayerDiv = null;
        this._rangeRecords = [];
        this._instantRecords = [];
        this._rangePlacementState = new WeakMap();

        this._configureTheme();
    };

    Timeline.NarrativeDecorator.prototype.initialize = function (band, timeline) {
        this._band = band;
        this._timeline = timeline;
        this._nativeTheme = band._theme || null;
        this._runtime = resolveRepriseRuntime(
            this._runtimeSelection,
            {
                unit: timeline?.getUnit?.() ??
                    window.SimileAjax?.NativeDateUnit ??
                    Timeline.NativeDateUnit,
                labeller: band?.getLabeller?.() ?? null
            }
        );
        this._visualTheme = Timeline.resolveVisualTheme(
            this._visualThemeSelection,
            this._nativeTheme
        );
        this._configureTheme();
    };

    Timeline.NarrativeDecorator.prototype._configureTheme = function () {
        const timelineTheme = this._nativeTheme;
        const visualTheme = this._visualTheme;
        const trackTheme = getOrientedObject(visualTheme.track, this._timeline);
        const rangeTheme = [getOrientedObject(visualTheme.range, this._timeline), visualTheme.range];
        const instantTheme = [getOrientedObject(visualTheme.instant, this._timeline), visualTheme.instant];
        const labelTheme = [getOrientedObject(visualTheme.label, this._timeline), visualTheme.label];
        const bubbleTheme = visualTheme.bubble;
        const layerTheme = visualTheme.layer;

        this._trackCount = Math.max(1, themedFinite({}, trackTheme, "count", 1));
        this._trackOffset = themedFinite({}, trackTheme, "offset", 0);
        this._trackEndPadding = themedFiniteOrNull({}, trackTheme, "endPadding");
        this._trackSize = themedFiniteOrNull({}, trackTheme, "size");
        this._trackGap = themedFinite({}, trackTheme, "gap", 4);
        this._trackAlign = normalizeTrackAlign(themedValue({}, trackTheme, "align", "start"));

        this._spanOffset = themedFinite({}, rangeTheme, "offset", 0);
        this._spanSize = themedFiniteOrNull({}, rangeTheme, "size");
        this._rangeToLabelGap = themedFinite({}, labelTheme, "toRangeGap", 4);
        this._dividerWidth = themedFinite({}, instantTheme, "lineWidth", 1);
        this._instantToLabelGap = themedFinite({}, labelTheme, "toInstantGap", 4);

        this._stickyInset = themedFinite({}, labelTheme, "stickyInset", 2);
        this._stickyGap = themedFinite({}, labelTheme, "routingGap", 4);
        this._labelOffset = themedFinite({}, labelTheme, "offset", 0);
        this._labelWidth = configuredLabelWidth(visualTheme, this._timeline);
        this._labelFlow = normalizeLabelFlow(
            themedValue({}, labelTheme, "flow", "normal")
        );
        this._rangeLabelAlign = normalizeRangeLabelAlign(
            themedValue({}, labelTheme, "rangeAlign", "start")
        );
        this._rangeGraphic = normalizeRangeGraphic(
            themedValue({}, rangeTheme, "graphic", "span")
        );
        this._labelColorMode = normalizeLabelColorMode(
            themedValue({}, labelTheme, "colorSource", "graphic"),
            "graphic"
        );
        this._labelColor = themedValue({}, labelTheme, "color", null);
        this._zIndex = themedFinite(
            {},
            layerTheme,
            "zIndex",
            DEFAULT_NARRATIVE_LAYER_Z_INDEX
        );
        this._dividerZIndex = themedFinite(
            {},
            layerTheme,
            "dividerZIndex",
            DEFAULT_NARRATIVE_DIVIDER_Z_INDEX
        );
        this._labelZIndex = themedFinite(
            {},
            layerTheme,
            "labelZIndex",
            DEFAULT_NARRATIVE_LABEL_Z_INDEX
        );

        this._spanColors = themedValue({}, rangeTheme, "colors", null);
        this._instantIconColor = themedValue({}, instantTheme, "iconColor", null);

        this._spanCssClass = themedValue({}, rangeTheme, "cssClass", "");
        this._spanLabelCssClass = themedValue({}, labelTheme, "rangeCssClass", "");
        this._dividerCssClass = themedValue({}, instantTheme, "cssClass", "");
        this._dividerLabelCssClass = themedValue({}, labelTheme, "instantCssClass", "");
        this._themeId = visualTheme.id ?? null;
        this._themeCssPrefix = typeof this._themeId === "string" && this._themeId.trim() !== ""
            ? "timeline-narrative-" + this._themeId.trim()
            : null;

        this._spans = visualTheme.spans;
        this._dividers = visualTheme.dividers;
        this._labels = visualTheme.labels;
        this._bubbles = visualTheme.bubbles;
        this._tooltips = visualTheme.tooltips;
        this._eventColorScope = visualTheme.eventColorScope;
        this._disableEmphasis = visualTheme.disableEmphasis;
        this._emphasisSpecs = isObject(timelineTheme?.emphasisSpecs)
            ? timelineTheme.emphasisSpecs
            : {};
        this._tagsToIconColor = isObject(visualTheme.tagsToIconColor)
            ? visualTheme.tagsToIconColor
            : {};
        this._bubbleWidth = themedFinite({}, bubbleTheme, "width", 320);
        this._bubbleMaxHeight = themedValue({}, bubbleTheme, "maxHeight", null);
    };

    Timeline.NarrativeDecorator.prototype._themeCssClass = function (suffix) {
        return this._themeCssPrefix
            ? this._themeCssPrefix + "-" + suffix
            : null;
    };

    Timeline.NarrativeDecorator.prototype._isHorizontal = function () {
        return this._timeline.isHorizontal();
    };

    Timeline.NarrativeDecorator.prototype._trackSizeValue = function () {
        if (this._trackSize != null) return this._trackSize;

        return this._isHorizontal()
            ? DEFAULT_HORIZONTAL_TRACK_SIZE
            : DEFAULT_VERTICAL_TRACK_SIZE;
    };

    Timeline.NarrativeDecorator.prototype._trackEndPaddingValue = function () {
        return this._trackEndPadding != null ? this._trackEndPadding : this._trackOffset;
    };

    Timeline.NarrativeDecorator.prototype._trackStart = function (track) {
        const trackSize = this._trackSizeValue();
        const increment = trackSize + this._trackGap;

        if (!this._isHorizontal() && this._trackAlign === "end") {
            return this._band.getViewWidth() -
                this._trackEndPaddingValue() -
                trackSize -
                track * increment;
        }

        return this._trackOffset + track * increment;
    };

    Timeline.NarrativeDecorator.prototype._resolveTrack = function (item, index) {
        const track = hasTrackValue(item.track) ? item.track : null;
        const value = Number(track);
        return Number.isFinite(value)
            ? Math.max(0, Math.floor(value))
            : index % this._trackCount;
    };

    Timeline.NarrativeDecorator.prototype._trackIsExplicit = function (item) {
        if (item.trackExplicit === true) return true;
        if (item.trackExplicit === false) return false;

        return hasTrackValue(item.track);
    };

    Timeline.NarrativeDecorator.prototype._resolveRangeTrack = function (item) {
        if (!this._trackIsExplicit(item) || !hasTrackValue(item.track)) return 0;

        const value = Number(item.track);
        return Number.isFinite(value)
            ? Math.max(0, Math.floor(value))
            : 0;
    };

    Timeline.NarrativeDecorator.prototype._itemValue = function (item, names) {
        const itemValue = ownValue(item, names);
        if (itemValue.found) return itemValue;

        const source = item?.event || null;
        for (const name of toNameList(names)) {
            const propertyValue = source?.getProperty?.(name);
            if (propertyValue != null && propertyValue !== "") {
                return { found: true, value: propertyValue };
            }

            if (hasDefinedOwn(source, name)) {
                return { found: true, value: source[name] };
            }
        }

        return { found: false, value: undefined };
    };

    Timeline.NarrativeDecorator.prototype._itemEmphasisSpec = function (item) {
        if (this._disableEmphasis) return null;

        const emphasisValue = this._itemValue(item, "emphasis");
        const key = emphasisValue.found ? stringValue(emphasisValue.value) : null;
        const spec = key != null ? this._emphasisSpecs[key] : null;

        return isObject(spec) ? spec : null;
    };

    Timeline.NarrativeDecorator.prototype._itemStyledValue = function (item, names) {
        const emphasisValue = ownValue(this._itemEmphasisSpec(item), names);
        if (emphasisValue.found) return emphasisValue;

        return this._itemValue(item, names);
    };

    Timeline.NarrativeDecorator.prototype._itemLabels = function (item) {
        const value = this._itemStyledValue(item, "labels");
        return value.found
            ? enabledValue(value.value, this._labels)
            : this._labels;
    };

    Timeline.NarrativeDecorator.prototype._itemColor = function (item) {
        return stringValue(item.color) ||
            stringValue(item.event?.getColor?.()) ||
            stringValue(item.event?.color);
    };

    Timeline.NarrativeDecorator.prototype._itemTagColor = function (item) {
        const value = this._itemValue(item, "tags");
        if (!value.found) return null;

        const tags = Array.isArray(value.value) ? value.value : [value.value];
        for (const tag of tags) {
            const name = stringValue(tag);
            if (name == null || !hasDefinedOwn(this._tagsToIconColor, name)) continue;

            const color = stringValue(this._tagsToIconColor[name]);
            if (color != null) return resolveCssColor(color) || color;
        }

        return null;
    };

    Timeline.NarrativeDecorator.prototype._recordLabels = function (record) {
        return this._itemLabels(record.item);
    };

    Timeline.NarrativeDecorator.prototype._recordBubbles = function (record) {
        const value = this._itemStyledValue(record.item, "bubbles");
        return value.found
            ? enabledValue(value.value, this._bubbles)
            : this._bubbles;
    };

    Timeline.NarrativeDecorator.prototype._recordColorScope = function (record) {
        const value = this._itemValue(record.item, "eventColorScope");
        return normalizeEventColorScope(
            value.found ? value.value : this._eventColorScope,
            this._eventColorScope
        );
    };

    Timeline.NarrativeDecorator.prototype._recordGraphicColor = function (
        record,
        explicitNames,
        fallback,
        taggedFallback
    ) {
        const emphasis = ownValue(
            this._itemEmphasisSpec(record.item),
            [...toNameList(explicitNames), "color"]
        );
        const emphasisColor = emphasis.found ? stringValue(emphasis.value) : null;
        if (emphasisColor != null) return resolveCssColor(emphasisColor) || emphasisColor;

        const scope = this._recordColorScope(record);
        if (scope === "graphic" || scope === "both") {
            const explicit = this._itemValue(record.item, explicitNames);
            const explicitColor = explicit.found ? stringValue(explicit.value) : null;
            if (explicitColor != null) {
                return resolveCssColor(explicitColor) || explicitColor;
            }

            const itemColor = this._itemColor(record.item);
            if (itemColor != null) {
                return resolveCssColor(itemColor) || itemColor;
            }
        }

        const tagColor = stringValue(taggedFallback);
        if (tagColor != null) return resolveCssColor(tagColor) || tagColor;

        const fallbackColor = stringValue(fallback);
        return fallbackColor != null
            ? resolveCssColor(fallbackColor) || fallbackColor
            : fallback;
    };

    Timeline.NarrativeDecorator.prototype._recordInstantLineColor = function (record) {
        const fallback = stringValue(this._instantIconColor) || "black";

        return this._recordGraphicColor(
            record,
            "lineColor",
            fallback,
            this._itemTagColor(record.item)
        );
    };

    Timeline.NarrativeDecorator.prototype._recordLabelColor = function (record) {
        const emphasis = ownValue(
            this._itemEmphasisSpec(record.item),
            ["labelColor", "color"]
        );
        const emphasisColor = emphasis.found ? stringValue(emphasis.value) : null;
        if (emphasisColor != null) return resolveCssColor(emphasisColor) || emphasisColor;

        const scope = this._recordColorScope(record);
        if (scope === "label" || scope === "both") {
            const labelValue = this._itemValue(
                record.item,
                ["labelColor", "textColor"]
            );
            const labelColor = labelValue.found
                ? stringValue(labelValue.value)
                : null;
            if (labelColor != null) {
                return resolveCssColor(labelColor) || labelColor;
            }

            const itemColor = this._itemColor(record.item);
            if (itemColor != null) {
                return resolveCssColor(itemColor) || itemColor;
            }
        }

        if (this._labelColorMode === "theme") {
            const themeColor = stringValue(this._labelColor);
            return themeColor != null ? resolveCssColor(themeColor) || themeColor : null;
        }

        if (this._labelColorMode === "inherit") return null;

        return record.kind === "range"
            ? deriveSpanLabelColor(record.graphicColor)
            : record.graphicColor ?? null;
    };

    Timeline.NarrativeDecorator.prototype._setRect = function (elmt, rect) {
        for (const key in rect) {
            elmt.style[key] = Math.round(rect[key]) + "px";
        }
    };

    Timeline.NarrativeDecorator.prototype._rangeGraphicBoundaries = function () {
        switch (this._rangeGraphic) {
            case "start": return ["start"];
            case "end": return ["end"];
            case "both": return ["start", "end"];
            case "span":
            default: return ["span"];
        }
    };

    Timeline.NarrativeDecorator.prototype._makeRangeGraphic = function (
        record,
        boundary,
        color
    ) {
        const doc = this._timeline.getDocument();
        const elmt = doc.createElement("div");
        const span = boundary === "span";

        elmt.className = [
            span ? "timeline-narrative-span" : "timeline-narrative-range-divider",
            span ? null : "timeline-narrative-range-" + boundary + "-divider",
            this._themeCssClass(span ? "span" : "range-divider"),
            this._spanCssClass,
            record.item.cssClass
        ].filter(Boolean).join(" ");
        elmt.style.position = "absolute";
        if (color) {
            elmt.style.backgroundColor = color;
        }
        elmt._repriseRangeGraphicBoundary = boundary;

        this._layerDiv.appendChild(elmt);
        record.graphicElmts ??= [];
        record.graphicElmts.push(elmt);
        if (span) record.spanElmt = elmt;
    };

    Timeline.NarrativeDecorator.prototype._measureLabel = function (record) {
        if (this._labelFlow === "orthogonal") {
            const configuredWidth = this._labelWidth;
            const rawWidth = Math.max(
                configuredWidth ?? 0,
                configuredWidth == null ? record.labelElmt.scrollWidth || 0 : 0,
                configuredWidth == null ? record.labelElmt.offsetWidth || 0 : 0,
                record.rawWidth || 0
            );
            const rawHeight = Math.max(
                record.labelElmt.scrollHeight || 0,
                record.labelElmt.offsetHeight || 0,
                record.rawHeight || 0
            );
            const rect = record.labelElmt.getBoundingClientRect();
            const unrotatedDelta = Math.abs((rect.width || 0) - rawWidth) +
                Math.abs((rect.height || 0) - rawHeight);
            const rotatedDelta = Math.abs((rect.width || 0) - rawHeight) +
                Math.abs((rect.height || 0) - rawWidth);
            const useRect = rect.width > 0 &&
                rect.height > 0 &&
                rotatedDelta <= unrotatedDelta;

            record.rawWidth = rawWidth;
            record.rawHeight = rawHeight;
            this._updateLabelFlow(record);
            record.width = useRect ? rect.width : rawHeight;
            record.height = useRect ? rect.height : rawWidth;
            return;
        }

        const rect = record.labelElmt.getBoundingClientRect();
        const visibleWidth = Math.max(
            rect.width || 0,
            record.labelElmt.offsetWidth || 0
        );
        record.width = this._labelWidth == null
            ? Math.max(visibleWidth, record.labelElmt.scrollWidth || 0)
            : this._labelWidth;
        record.height = Math.max(
            rect.height || 0,
            record.labelElmt.offsetHeight || 0,
            record.labelElmt.scrollHeight || 0
        );
    };

    Timeline.NarrativeDecorator.prototype._updateLabelFlow = function (record) {
        if (!record?.labelElmt) return;

        if (this._labelFlow !== "orthogonal") {
            record.labelElmt.style.transform = "";
            record.labelElmt.style.transformOrigin = "";
            record.labelElmt.style.textAlign = "";
            return;
        }

        record.labelElmt.style.textAlign = "right";
        record.labelElmt.style.transformOrigin = "0 0";
        record.labelElmt.style.transform =
            "translateY(" + (record.rawWidth || record.height || 0) + "px) rotate(-90deg)";
    };

    Timeline.NarrativeDecorator.prototype._labelMainSize = function (record) {
        return this._isHorizontal() ? record.width : record.height;
    };

    Timeline.NarrativeDecorator.prototype._rangeLabelMainStart = function (record, size) {
        return this._rangeLabelAlign === "center"
            ? (record.startPixel + record.endPixel - size) / 2
            : record.startPixel + this._rangeToLabelGap;
    };

    Timeline.NarrativeDecorator.prototype._rangeLabelRetainedForRouting = function (
        mainStart,
        size,
        viewportStart,
        viewportEnd
    ) {
        const retention = Math.max(1.5 * size, 2 * (viewportEnd - viewportStart));
        return mainStart + size > viewportStart - retention &&
            mainStart < viewportEnd + retention;
    };

    Timeline.NarrativeDecorator.prototype._rangeLabelViewportMain = function (
        record,
        size,
        naturalMain,
        viewportStart,
        viewportEnd
    ) {
        const rangeEndMain = record.endPixel - size;
        if (naturalMain + size > record.endPixel) return naturalMain;

        const rangeSize = record.endPixel - record.startPixel;
        if (size > rangeSize) return naturalMain;

        let main = naturalMain;
        if (naturalMain < viewportStart) main = viewportStart;
        else if (naturalMain + size > viewportEnd) main = viewportEnd - size;

        return Math.max(record.startPixel, Math.min(main, rangeEndMain));
    };

    Timeline.NarrativeDecorator.prototype._rangeLabelHasFixedMain = function (
        record,
        size,
        naturalMain
    ) {
        return naturalMain + size > record.endPixel;
    };

    Timeline.NarrativeDecorator.prototype._instantDividerEndOffset = function (record) {
        if (!record.lineElmt) return 0;

        const dividerWidth = finiteOr(record.dividerWidth, this._dividerWidth);
        return Math.max(
            0,
            Math.round(dividerWidth) - Math.floor(dividerWidth / 2)
        ) + this._instantToLabelGap;
    };

    Timeline.NarrativeDecorator.prototype._setLabelPosition = function (record, mainStart) {
        const trackStart = this._trackStart(record.track);
        const trackSize = this._trackSizeValue();
        const adjustedMainStart = mainStart + this._labelOffset;
        const labelWidth = this._labelWidth;

        if (labelWidth != null) {
            record.labelElmt.style.width = Math.round(labelWidth) + "px";
            if (this._labelFlow === "orthogonal") {
                record.rawWidth = labelWidth;
                record.height = labelWidth;
            } else {
                record.width = labelWidth;
            }
        }

        if (this._isHorizontal()) {
            if (this._labelFlow === "orthogonal") {
                this._setRect(record.labelElmt, {
                    left: adjustedMainStart,
                    top: trackStart
                });
                record.labelElmt.style.height = "";
                this._updateLabelFlow(record);
            } else {
                this._setRect(record.labelElmt, {
                    left: adjustedMainStart,
                    top: trackStart,
                    height: trackSize
                });
                if (labelWidth != null) {
                    record.width = labelWidth;
                }
            }
        } else {
            if (this._labelFlow === "orthogonal") {
                record.labelElmt.style.top = Math.round(adjustedMainStart) + "px";
                record.labelElmt.style.left = Math.round(trackStart) + "px";
                record.labelElmt.style.width = labelWidth == null ? "" : Math.round(labelWidth) + "px";
                record.labelElmt.style.maxWidth = "";
                record.labelElmt.style.height = Math.round(trackSize) + "px";
                record.labelElmt.style.whiteSpace = "normal";
                record.labelElmt.style.overflowWrap = "break-word";
                if (labelWidth != null) {
                    record.rawWidth = labelWidth;
                    record.height = labelWidth;
                }
                record.rawHeight = trackSize;
                record.width = trackSize;
                this._updateLabelFlow(record);
            } else {
                this._setRect(record.labelElmt, {
                    top: adjustedMainStart,
                    left: trackStart,
                    width: labelWidth == null ? trackSize : labelWidth
                });
                record.labelElmt.style.whiteSpace = "normal";
                record.labelElmt.style.overflowWrap = "break-word";
                if (labelWidth != null) {
                    record.width = labelWidth;
                }
            }
        }
    };

    Timeline.NarrativeDecorator.prototype._showBubble = function (record, domEvt) {
        if (!this._recordBubbles(record)) return false;

        const doc = this._timeline.getDocument();
        const div = doc.createElement("div");
        const attachment = getAttachedEventContext(record.item);
        const temporal = attachment == null
            ? null
            : captureAttachedEventRenderContext(record.item);
        fillRepriseBubble(div, attachment?.presentationEvent ?? record.item, {
            runtime: attachment?.runtime ?? this._runtime,
            visualTheme: attachment?.visualTheme ?? this._visualTheme,
            nativeTheme: this._nativeTheme,
            eventTime: temporal?.eventTime ?? record.eventTime,
            currentTime: temporal?.currentTime,
            renderField: attachment == null
                ? null
                : (field, target, context) => renderAttachedEventField(
                    record.item,
                    field,
                    target,
                    context
                )
        });

        const x = domEvt.pageX;
        const y = domEvt.pageY;

        SimileAjax.WindowManager.cancelPopups();
        SimileAjax.Graphics.createBubbleForContentAndPoint(
            div,
            x,
            y,
            this._bubbleWidth,
            null,
            this._bubbleMaxHeight
        );

        domEvt.cancelBubble = true;
        SimileAjax.DOM.cancelEvent(domEvt);
        return false;
    };

    Timeline.NarrativeDecorator.prototype._renderCaption = function (record) {
        const attachment = getAttachedEventContext(record.item);
        if (attachment != null) {
            const temporal = captureAttachedEventRenderContext(record.item);
            return renderAttachedEventField(
                record.item,
                "caption",
                "text",
                {
                    surface: "label",
                    fresh: true,
                    ...temporal
                }
            );
        }

        const eventTime = this._runtime.readEventTime(record.item) ??
            record.eventTime;
        const currentTime = this._runtime.readCurrentTime?.() ?? null;
        return renderEventField(
            this._runtime,
            this._visualTheme,
            eventTime,
            record.item,
            "caption",
            "text",
            { surface: "label", currentTime }
        );
    };

    Timeline.NarrativeDecorator.prototype._recordHasCaption = function (
        record,
        renderedCaption
    ) {
        if (hasRenderedContent(renderedCaption) || hasEventCaption(record.item)) {
            return true;
        }

        return Timeline.resolveDisplayProfile?.(this._visualTheme?.presentation)
            ?.hasTemplate("caption", {
                surface: "label",
                eventTime: record.eventTime
            }) === true;
    };

    Timeline.NarrativeDecorator.prototype._installCaptionRefresh = function (
        record,
        element,
        renderedCaption
    ) {
        const enabled = this._tooltips !== false &&
            this._recordHasCaption(record, renderedCaption);
        if (element == null || !enabled) return false;

        setDynamicCaption(element, renderedCaption);
        if (element.style) element.style.pointerEvents = "auto";

        const refresh = () => {
            setDynamicCaption(element, this._renderCaption(record));
        };
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

        return true;
    };

    Timeline.NarrativeDecorator.prototype._makeLabel = function (record, cssClass) {
        if (!this._recordLabels(record)) return;

        const doc = this._timeline.getDocument();
        const elmt = doc.createElement("div");
        const bubbles = this._recordBubbles(record);
        const attachment = getAttachedEventContext(record.item);
        const title = attachment == null
            ? renderEventField(
                this._runtime,
                this._visualTheme,
                record.eventTime,
                record.item,
                "title",
                "html",
                { surface: "label" }
            )
            : renderAttachedEventField(
                record.item,
                "title",
                "html",
                { surface: "label" }
            );
        const caption = this._renderCaption(record);
        if (!hasRenderedContent(title) && !hasRenderedContent(caption)) return;
        const tooltip = this._tooltips !== false &&
            this._recordHasCaption(record, caption);

        elmt.className = cssClass;
        elmt.style.position = "absolute";
        elmt.style.boxSizing = "border-box";
        elmt.style.pointerEvents = bubbles || tooltip ? "auto" : "none";
        elmt.style.cursor = bubbles ? "pointer" : "default";
        if (this._labelFlow === "orthogonal") {
            elmt.style.textAlign = "right";
        }

        if (hasRenderedContent(title)) {
            const titleElmt = doc.createElement("div");
            titleElmt.className = "timeline-narrative-label-title";
            setRenderedContent(titleElmt, title, "html");
            elmt.appendChild(titleElmt);
        }

        if (tooltip) setDynamicCaption(elmt, caption);
        else removeElementTitle(elmt);

        const labelColor = this._recordLabelColor(record);
        if (labelColor) elmt.style.color = labelColor;

        if (bubbles) {
            elmt.onclick = domEvt => this._showBubble(record, domEvt || window.event);
        }
        this._installCaptionRefresh(record, elmt, caption);

        this._labelLayerDiv.appendChild(elmt);
        record.labelElmt = elmt;
        this._setLabelPosition(record, -100000);
        this._measureLabel(record);
    };

    Timeline.NarrativeDecorator.prototype.paint = function () {
        if (this._layerDiv != null) this._band.removeLayerDiv(this._layerDiv);
        if (this._dividerLayerDiv != null) this._band.removeLayerDiv(this._dividerLayerDiv);
        if (this._labelLayerDiv != null) this._band.removeLayerDiv(this._labelLayerDiv);

        this._layerDiv = this._band.createLayerDiv(this._zIndex, "timeline-narrative-decorator-layer timeline-narrative-visual-layer");
        this._layerDiv.setAttribute("name", "narrative-decorator");
        this._layerDiv.style.visibility = "hidden";
        this._layerDiv.style.pointerEvents = "none";

        const hasDividerLayer = this._dividers && this._instants.length > 0;
        this._dividerLayerDiv = hasDividerLayer
            ? this._band.createLayerDiv(this._dividerZIndex, "timeline-narrative-decorator-layer timeline-narrative-divider-layer")
            : null;
        if (this._dividerLayerDiv) {
            this._dividerLayerDiv.setAttribute("name", "narrative-dividers");
            this._dividerLayerDiv.style.visibility = "hidden";
            this._dividerLayerDiv.style.pointerEvents = "none";
        }

        const hasItemLabelOverride = this._ranges.some(item => this._itemLabels(item)) ||
            this._instants.some(item => this._itemLabels(item));

        this._labelLayerDiv = this._labels || hasItemLabelOverride
            ? this._band.createLayerDiv(this._labelZIndex, "timeline-narrative-decorator-layer timeline-narrative-label-layer")
            : null;
        if (this._labelLayerDiv) {
            this._labelLayerDiv.setAttribute("name", "narrative-labels");
            this._labelLayerDiv.style.visibility = "hidden";
            this._labelLayerDiv.style.pointerEvents = "none";
        }

        this._rangeRecords = [];
        this._instantRecords = [];

        const doc = this._timeline.getDocument();

        this._ranges.forEach((item, index) => {
            const eventTime = this._runtime.readEventTime(item);
            if (eventTime?.kind !== "range") return;

            const record = {
                item,
                index,
                kind: "range",
                eventTime,
                startDate: eventTime.start,
                endDate: eventTime.end,
                baseTrack: this._resolveRangeTrack(item),
                track: 0,
                trackExplicit: this._trackIsExplicit(item),
                startPixel: 0,
                endPixel: 0,
                _verticalPlacement: this._rangePlacementState.get(item) || null
            };
            record.track = record.baseTrack;

            const spanColor = this._recordGraphicColor(
                record,
                "spanColor",
                cycleValue(this._spanColors, index)
            );
            record.graphicColor = spanColor;

            if (this._spans) {
                for (const boundary of this._rangeGraphicBoundaries()) {
                    this._makeRangeGraphic(record, boundary, spanColor);
                }
            }

            this._makeLabel(record, [
                "timeline-narrative-label",
                this._themeCssClass("label"),
                "timeline-narrative-range-label",
                this._themeCssClass("range-label"),
                this._spanLabelCssClass,
                item.labelCssClass
            ].filter(Boolean).join(" "));
            for (const graphicElmt of record.graphicElmts || []) {
                this._installCaptionRefresh(record, graphicElmt, null);
            }
            this._rangeRecords.push(record);
        });

        this._instants.forEach((item, index) => {
            const eventTime = this._runtime.readEventTime(item);
            if (eventTime?.kind !== "instant") return;

            const record = {
                item,
                index,
                kind: "instant",
                eventTime,
                date: eventTime.value,
                baseTrack: this._resolveTrack(item, index),
                track: 0,
                trackExplicit: this._trackIsExplicit(item),
                pixel: 0
            };
            record.track = record.baseTrack;

            const lineColor = this._recordInstantLineColor(record);
            record.graphicColor = lineColor;

            if (this._dividers && this._dividerLayerDiv) {
                const line = doc.createElement("div");
                line.className = [
                    "timeline-narrative-instant-line",
                    this._themeCssClass("instant-line"),
                    this._dividerCssClass,
                    item.cssClass
                ].filter(Boolean).join(" ");
                line.style.position = "absolute";
                line.style.backgroundColor = lineColor;
                this._dividerLayerDiv.appendChild(line);
                record.lineElmt = line;
            }

            this._makeLabel(record, [
                "timeline-narrative-label",
                this._themeCssClass("label"),
                "timeline-narrative-instant-label",
                this._themeCssClass("instant-label"),
                this._dividerLabelCssClass,
                item.labelCssClass
            ].filter(Boolean).join(" "));
            this._installCaptionRefresh(record, record.lineElmt, null);
            this._instantRecords.push(record);
        });

        this.softPaint();
        this._layerDiv.style.visibility = "";
        if (this._dividerLayerDiv) this._dividerLayerDiv.style.visibility = "";
        if (this._labelLayerDiv) this._labelLayerDiv.style.visibility = "";
    };

    Timeline.NarrativeDecorator.prototype.softPaint = function () {
        if (!this._layerDiv) return;

        const horizontal = this._isHorizontal();
        const crossSize = this._spanSize != null
            ? this._spanSize
            : Math.max(1, this._band.getViewWidth() - this._spanOffset);
        const viewOffset = this._band.getViewOffset();
        const stickyMain = -viewOffset + this._stickyInset;

        for (const record of this._rangeRecords) {
            record.startPixel = Math.round(this._band.dateToPixelOffset(record.startDate));
            record.endPixel = Math.round(this._band.dateToPixelOffset(record.endDate));

            for (const graphicElmt of record.graphicElmts || []) {
                graphicElmt.style.display = "";
                const boundary = graphicElmt._repriseRangeGraphicBoundary;
                const mainStart = boundary === "end"
                    ? record.endPixel
                    : record.startPixel;
                this._setRect(graphicElmt, boundary === "span"
                    ? horizontal
                        ? { left: record.startPixel, width: record.endPixel - record.startPixel, top: this._spanOffset, height: crossSize }
                        : { top: record.startPixel, height: record.endPixel - record.startPixel, left: this._spanOffset, width: crossSize }
                    : horizontal
                        ? { left: mainStart, width: 1, top: this._spanOffset, height: crossSize }
                        : { top: mainStart, height: 1, left: this._spanOffset, width: crossSize });
            }
        }

        for (const record of this._instantRecords) {
            record.pixel = Math.round(this._band.dateToPixelOffset(record.date));

            if (record.lineElmt) {
                const lineWidth = this._itemStyledValue(record.item, "lineWidth");
                const dividerWidth = finiteOr(
                    lineWidth.found ? lineWidth.value : null,
                    this._dividerWidth
                );
                record.dividerWidth = dividerWidth;
                const start = record.pixel - Math.floor(dividerWidth / 2);
                this._setRect(record.lineElmt, horizontal
                    ? { left: start, width: dividerWidth, top: this._spanOffset, height: crossSize }
                    : { top: start, height: dividerWidth, left: this._spanOffset, width: crossSize });
            }

            if (record.labelElmt) {
                record.labelElmt.style.display = "";
            }
        }

        const ranges = this._rangeRecords
            .filter(record => record.labelElmt)
            .slice()
            .sort((a, b) => a.startPixel - b.startPixel || a.index - b.index);

        if (horizontal) {
            const viewportLeft = -this._band.getViewOffset();
            const stickyLeft = stickyMain;
            const stickyRight = viewportLeft + this._band.getViewLength() - this._stickyInset;
            const labelGap = this._stickyGap;
            let tracks = Array.from({ length: this._trackCount }, () => []);
            const spanPlacements = [];

            const intervalIsFree = (intervals, left, right) => {
                for (const interval of intervals || []) {
                    if (left < interval.right + labelGap &&
                        right + labelGap > interval.left) {
                        return false;
                    }
                }

                return true;
            };

            const reserveInterval = (targetTracks, track, left, right) => {
                if (!targetTracks[track]) targetTracks[track] = [];
                targetTracks[track].push({ left, right });
            };

            const placeFixedLabel = (targetTracks, left, right, preferredTrack) => {
                const startTrack = Math.max(0, Math.floor(preferredTrack || 0));

                for (let track = startTrack; track < targetTracks.length; track++) {
                    if (intervalIsFree(targetTracks[track], left, right)) return track;
                }

                return null;
            };

            for (const record of ranges) {
                const size = this._labelMainSize(record);
                const naturalLeft = this._rangeLabelMainStart(record, size);
                const fixedMain = this._rangeLabelHasFixedMain(
                    record,
                    size,
                    naturalLeft
                );
                const left = this._rangeLabelViewportMain(
                    record,
                    size,
                    naturalLeft,
                    stickyLeft,
                    stickyRight
                );

                if (!this._rangeLabelRetainedForRouting(
                    left,
                    size,
                    stickyLeft,
                    stickyRight
                )) {
                    record.labelElmt.style.display = "none";
                    continue;
                }

                spanPlacements.push({ record, left, size, fixedMain });
            }

            const shiftedTracks = tracks.map(() => []);

            for (const { record, left, size, fixedMain } of spanPlacements) {
                const track = fixedMain
                    ? Math.max(0, Math.floor(record.baseTrack || 0))
                    : placeFixedLabel(
                        shiftedTracks,
                        left,
                        left + size
                    );

                if (track == null || track >= this._trackCount) {
                    record.labelElmt.style.display = "none";
                    continue;
                }

                record.track = track;
                record.labelElmt.style.display = "";
                this._setLabelPosition(record, left);
                reserveInterval(shiftedTracks, track, left, left + size);
            }

            tracks = shiftedTracks;

            const instantLabels = this._instantRecords
                .filter(record => record.labelElmt)
                .slice()
                .sort((a, b) => a.pixel - b.pixel || a.index - b.index);

            for (const record of instantLabels) {
                const size = this._labelMainSize(record);
                const preferredTrack = record.trackExplicit ? record.baseTrack : 0;
                const labelStart = record.pixel + this._instantDividerEndOffset(record);
                const track = placeFixedLabel(
                    tracks,
                    labelStart,
                    labelStart + size,
                    preferredTrack
                );

                if (track == null || track >= this._trackCount) {
                    record.labelElmt.style.display = "none";
                    continue;
                }

                record.track = track;
                record.labelElmt.style.display = "";
                this._setLabelPosition(record, labelStart);
                reserveInterval(tracks, record.track, labelStart, labelStart + size);
            }

            return;
        }

        const viewportTop = -viewOffset;
        const viewportBottom = viewportTop + this._band.getViewLength() -
            this._stickyInset;
        const labelCrossEnd = (record, track) =>
            this._trackStart(track) + Math.max(this._trackSizeValue(), record.width || 0);
        const reservedLabels = [];

        const reserveLabel = (track, start, size, record) => {
            reservedLabels.push({
                start,
                end: start + size + this._stickyGap,
                left: this._trackStart(track),
                right: labelCrossEnd(record, track)
            });
        };

        const collidedRangeLabel = (track, start, size, record) => {
            const left = this._trackStart(track);
            const right = labelCrossEnd(record, track);

            return reservedLabels.find(rect =>
                start < rect.end &&
                start + size > rect.start &&
                left < rect.right &&
                right > rect.left
            );
        };

        const placeRangeLabelInTrack = (track, start, size, record, fixedMain) => {
            const maxMain = record.endPixel - size;
            let main = start;

            while (true) {
                const collision = collidedRangeLabel(track, main, size, record);
                if (!collision) return main;
                if (fixedMain) return null;

                main = Math.max(main, collision.end);
                if (main > maxMain) return null;
            }
        };

        const placeRangeLabel = (start, size, startTrack, record, fixedMain) => {
            const baseTrack = Math.max(0, Math.floor(startTrack || 0));
            if (baseTrack >= this._trackCount) return null;

            const baseMain = placeRangeLabelInTrack(
                baseTrack,
                start,
                size,
                record,
                fixedMain
            );
            if (baseMain != null) return { track: baseTrack, main: baseMain };

            for (let track = baseTrack + 1; track < this._trackCount; track++) {
                const main = placeRangeLabelInTrack(
                    track,
                    start,
                    size,
                    record,
                    fixedMain
                );
                if (main != null) return { track, main };
            }

            return null;
        };

        const firstFreeTrack = (start, size, startTrack, record) => {
            const firstTrack = Math.max(0, Math.floor(startTrack || 0));

            for (let track = firstTrack; track < this._trackCount; track++) {
                if (!collidedRangeLabel(track, start, size, record)) return track;
            }

            return null;
        };

        const rangePlacements = [];

        for (const record of ranges) {
            const size = this._labelMainSize(record);
            const naturalMain = this._rangeLabelMainStart(record, size);
            const preferredMain = Math.max(
                naturalMain,
                this._rangeLabelAlign === "center"
                    ? Number.NEGATIVE_INFINITY
                    : record.startPixel - this._labelOffset
            );
            const fixedMain = this._rangeLabelHasFixedMain(
                record,
                size,
                preferredMain
            );
            const main = this._rangeLabelViewportMain(
                record,
                size,
                preferredMain,
                stickyMain,
                viewportBottom
            );
            const retained = this._rangeLabelRetainedForRouting(
                main,
                size,
                stickyMain,
                viewportBottom
            );

            rangePlacements.push({ record, size, main, fixedMain, retained });
        }

        rangePlacements.sort((a, b) =>
            Number(b.fixedMain) - Number(a.fixedMain) ||
            a.main - b.main ||
            a.record.startPixel - b.record.startPixel ||
            a.record.index - b.record.index
        );

        for (const { record, size, main, fixedMain, retained } of rangePlacements) {
            const placement = placeRangeLabel(
                main,
                size,
                record.baseTrack,
                record,
                fixedMain
            );

            if (placement == null || placement.track >= this._trackCount) {
                record.labelElmt.style.display = "none";
                record._verticalPlacement = null;
                this._rangePlacementState.delete(record.item);
                continue;
            }

            record.track = placement.track;
            record._verticalPlacement = {
                track: placement.track,
                main: placement.main,
                viewOffset
            };
            this._rangePlacementState.set(record.item, record._verticalPlacement);
            record.labelElmt.style.display = retained ? "" : "none";
            this._setLabelPosition(record, placement.main);
            reserveLabel(record.track, placement.main, size, record);
        }

        const instantLabels = this._instantRecords
            .filter(record => record.labelElmt)
            .slice()
            .sort((a, b) => a.pixel - b.pixel || a.index - b.index);

        for (const record of instantLabels) {
            const size = this._labelMainSize(record);
            const preferredTrack = record.trackExplicit ? record.baseTrack : 0;
            const labelStart = record.pixel + this._instantDividerEndOffset(record);

            record.track = firstFreeTrack(
                labelStart,
                size,
                preferredTrack,
                record
            );

            if (record.track == null || record.track >= this._trackCount) {
                record.labelElmt.style.display = "none";
                continue;
            }
            record.labelElmt.style.display = "";
            this._setLabelPosition(record, labelStart);
            reserveLabel(record.track, labelStart, size, record);
        }
    };
}());
