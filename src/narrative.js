(function () {
    if (!window.Timeline || Timeline.NarrativeDecorator) return;

    const DEFAULT_HORIZONTAL_TRACK_SIZE = 18;
    const DEFAULT_VERTICAL_TRACK_SIZE = 120;
    const HORIZONTAL_STICKY_CONTACT_SIZE = 12;
    const VERTICAL_STICKY_CONTACT_SIZE = 6;

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

    function deriveSpanLabelColor(color) {
        const match = String(color ?? "").match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
        if (!match) return color ?? null;

        const r = Number(match[1]) / 255;
        const g = Number(match[2]) / 255;
        const b = Number(match[3]) / 255;
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

    function getTimelineTheme(params, bandTheme) {
        return isObject(params?.theme) ? params.theme : bandTheme;
    }

    function getEventTheme(params, bandTheme) {
        const theme = getTimelineTheme(params, bandTheme);
        return isObject(theme?.eventTheme) ? theme.eventTheme : {};
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

    function parseDate(unit, value) {
        if (typeof value === "string") return unit.parseFromObject(value);
        return value instanceof Date ? value : null;
    }

    function appendHtml(doc, parent, className, html) {
        if (html == null || html === "") return;
        const div = doc.createElement("div");
        div.className = className;
        div.innerHTML = html;
        parent.appendChild(div);
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
        this._params = params;
        this._theme = params.theme || null;

        this._unit = params.unit || window.SimileAjax?.NativeDateUnit || Timeline.NativeDateUnit;
        this._ranges = Array.isArray(params.ranges) ? params.ranges : [];
        this._instants = Array.isArray(params.instants) ? params.instants : [];

        this._spans = true;
        this._dividers = true;
        this._labels = params.labels !== false;
        this._bubbles = false;
        this._eventColorScope = "both";
        this._disableEmphasis = false;
        this._emphasisSpecs = {};
        this._tagsToIconColor = {};
        this._instantIconColor = null;
        this._labelColorMode = "graphic";
        this._labelColor = null;

        this._band = null;
        this._timeline = null;
        this._layerDiv = null;
        this._labelLayerDiv = null;
        this._rangeRecords = [];
        this._instantRecords = [];
        this._rangePlacementState = new WeakMap();

        this._configureTheme();
    };

    Timeline.NarrativeDecorator.prototype.initialize = function (band, timeline) {
        this._band = band;
        this._timeline = timeline;
        if (!this._theme) this._theme = band._theme || null;
        this._configureTheme();
    };

    Timeline.NarrativeDecorator.prototype._configureTheme = function () {
        const params = this._params;
        const timelineTheme = getTimelineTheme(params, this._band?._theme);
        const eventTheme = getEventTheme(params, this._band?._theme);
        const paramTrackTheme = getOrientedObject(params.track, this._timeline);
        const trackTheme = getOrientedObject(eventTheme.track, this._timeline);
        const rangeTheme = isObject(params.range) ? params.range : eventTheme.range;
        const instantTheme = isObject(params.instant) ? params.instant : eventTheme.instant;
        const labelTheme = isObject(params.label) ? params.label : eventTheme.label;
        const bubbleTheme = isObject(params.bubble) ? params.bubble : eventTheme.bubble;
        const layerTheme = isObject(params.layer) ? params.layer : eventTheme.layer;

        this._trackCount = Math.max(1, themedFinite({}, [paramTrackTheme, trackTheme], "count", 1));
        this._trackOffset = themedFinite({}, [paramTrackTheme, trackTheme], "offset", 0);
        this._trackEndPadding = themedFiniteOrNull({}, [paramTrackTheme, trackTheme], "endPadding");
        this._trackSize = themedFiniteOrNull({}, [paramTrackTheme, trackTheme], "size");
        this._trackGap = themedFinite({}, [paramTrackTheme, trackTheme], "gap", 4);
        this._trackAlign = normalizeTrackAlign(themedValue({}, [paramTrackTheme, trackTheme], "align", "start"));

        this._spanOffset = themedFinite({}, rangeTheme, "offset", 0);
        this._spanSize = themedFiniteOrNull({}, rangeTheme, "size");
        this._dividerWidth = themedFinite({}, instantTheme, "width", 1);

        this._stickyInset = themedFinite(params, [labelTheme, eventTheme], "stickyInset", 2);
        this._stickyGap = themedFinite(params, [labelTheme, eventTheme], "stickyGap", 4);
        this._labelOffset = themedFinite({}, labelTheme, "offset", 0);
        this._labelColorMode = normalizeLabelColorMode(
            themedValue({}, labelTheme, "colorSource", "graphic"),
            "graphic"
        );
        this._labelColor = themedValue({}, labelTheme, "color", null);
        this._zIndex = themedFinite({}, layerTheme, "zIndex", 5);
        this._labelZIndex = themedFinite({}, layerTheme, "labelZIndex", 6);

        this._spanColors = themedValue({}, rangeTheme, "colors", null);
        this._instantIconColor = themedValue({}, instantTheme, "iconColor", null);

        this._spanCssClass = themedValue({}, rangeTheme, "cssClass", "");
        this._spanLabelCssClass = themedValue({}, rangeTheme, "labelCssClass", "");
        this._dividerCssClass = themedValue({}, instantTheme, "cssClass", "");
        this._dividerLabelCssClass = themedValue({}, instantTheme, "labelCssClass", "");
        this._themeId = hasDefinedOwn(params, "themeId") ? params.themeId : eventTheme.id ?? null;
        this._themeCssPrefix = typeof this._themeId === "string" && this._themeId.trim() !== ""
            ? "timeline-narrative-" + this._themeId.trim()
            : null;

        const labelsValue = hasDefinedOwn(params, "labels")
            ? params.labels
            : hasDefinedOwn(eventTheme, "labels")
                ? eventTheme.labels
                : true;
        const bubblesValue = hasDefinedOwn(params, "bubbles")
            ? params.bubbles
            : hasDefinedOwn(eventTheme, "bubbles")
                ? eventTheme.bubbles
                : hasDefinedOwn(bubbleTheme, "enabled")
                    ? bubbleTheme.enabled
                    : false;

        this._spans = enabledValue(
            hasDefinedOwn(params, "spans")
                ? params.spans
                : hasDefinedOwn(eventTheme, "spans") ? eventTheme.spans : true,
            true
        );
        this._dividers = enabledValue(
            hasDefinedOwn(params, "dividers")
                ? params.dividers
                : hasDefinedOwn(eventTheme, "dividers") ? eventTheme.dividers : true,
            true
        );
        this._labels = enabledValue(labelsValue, true);
        this._bubbles = enabledValue(bubblesValue, false);
        this._eventColorScope = normalizeEventColorScope(
            themedValue(params, eventTheme, "eventColorScope", "both", "eventColorScope"),
            "both"
        );
        this._disableEmphasis = enabledValue(
            themedValue(params, eventTheme, "disableEmphasis", false),
            false
        );
        this._emphasisSpecs = isObject(params.emphasisSpecs)
            ? params.emphasisSpecs
            : isObject(timelineTheme?.emphasisSpecs)
                ? timelineTheme.emphasisSpecs
            : {};
        this._tagsToIconColor = isObject(eventTheme.tagsToIconColor)
            ? eventTheme.tagsToIconColor
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

    Timeline.NarrativeDecorator.prototype._stickyContactThreshold = function (contactSize) {
        return contactSize + Math.max(0, this._stickyInset);
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

        const explicit = this._itemValue(record.item, explicitNames);
        const explicitColor = explicit.found ? stringValue(explicit.value) : null;
        if (explicitColor != null) return resolveCssColor(explicitColor) || explicitColor;

        const scope = this._recordColorScope(record);
        const itemColor = this._itemColor(record.item);

        if ((scope === "graphic" || scope === "both") && itemColor != null) {
            return resolveCssColor(itemColor) || itemColor;
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

        const labelValue = this._itemValue(record.item, "labelColor");
        const labelColor = labelValue.found ? stringValue(labelValue.value) : null;
        if (labelColor != null) return resolveCssColor(labelColor) || labelColor;

        const scope = this._recordColorScope(record);
        const itemColor = this._itemColor(record.item);

        if ((scope === "label" || scope === "both") && itemColor != null) {
            return resolveCssColor(itemColor) || itemColor;
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

    Timeline.NarrativeDecorator.prototype._measureLabel = function (record) {
        const rect = record.labelElmt.getBoundingClientRect();
        const visibleWidth = Math.max(
            rect.width || 0,
            record.labelElmt.offsetWidth || 0
        );
        record.width = Math.max(visibleWidth, record.labelElmt.scrollWidth || 0);
        record.height = Math.max(
            rect.height || 0,
            record.labelElmt.offsetHeight || 0,
            record.labelElmt.scrollHeight || 0
        );
    };

    Timeline.NarrativeDecorator.prototype._labelMainSize = function (record) {
        return this._isHorizontal() ? record.width : record.height;
    };

    Timeline.NarrativeDecorator.prototype._setLabelPosition = function (record, mainStart) {
        const trackStart = this._trackStart(record.track);
        const trackSize = this._trackSizeValue();
        const adjustedMainStart = mainStart + this._labelOffset;

        if (this._isHorizontal()) {
            this._setRect(record.labelElmt, {
                left: adjustedMainStart,
                top: trackStart,
                height: trackSize
            });
        } else {
            this._setRect(record.labelElmt, {
                top: adjustedMainStart,
                left: trackStart,
                width: trackSize
            });
            record.labelElmt.style.whiteSpace = "normal";
            record.labelElmt.style.overflowWrap = "break-word";
        }
    };

    Timeline.NarrativeDecorator.prototype._showBubble = function (record, domEvt) {
        if (!this._recordBubbles(record)) return false;

        const doc = this._timeline.getDocument();
        const div = doc.createElement("div");
        const source = record.item.event || record.item;

        const filler = Timeline._timelineUtilsFillInfoBubble;
        const theme = this._theme || this._band._theme;
        const labeller = this._band.getLabeller();

        const bubbleEvent = {
            getImage: () => source?.image ?? null,
            getText: () => record.item.title ?? source?.title ?? "",
            getLink: () => source?.link ?? null,
            getDescription: () => record.item.description ?? source?.description ?? "",
            getProperty: name => record.item[name] ?? source?.[name] ?? null
        };

        if (typeof filler === "function") {
            filler.call(bubbleEvent, div, theme, labeller);
        } else if (source && typeof source.fillInfoBubble === "function") {
            source.fillInfoBubble(div, theme, labeller);
        } else {
            appendHtml(doc, div, "timeline-event-bubble-title", record.item.title);
            appendHtml(doc, div, "timeline-event-bubble-description", record.item.caption || record.item.description);
        }

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

    Timeline.NarrativeDecorator.prototype._makeLabel = function (record, cssClass) {
        if (!this._recordLabels(record) || (record.item.title == null && record.item.caption == null)) return;

        const doc = this._timeline.getDocument();
        const elmt = doc.createElement("div");
        const bubbles = this._recordBubbles(record);

        elmt.className = cssClass;
        elmt.style.position = "absolute";
        elmt.style.boxSizing = "border-box";
        elmt.style.pointerEvents = bubbles ? "auto" : "none";
        elmt.style.cursor = bubbles ? "pointer" : "default";

        appendHtml(doc, elmt, "timeline-narrative-label-title", record.item.title);

        if (record.item.caption != null && record.item.caption !== "") {
            elmt.title = String(record.item.caption).replace(/<[^>]*>/g, "");
        } else {
            elmt.removeAttribute("title");
        }

        const labelColor = this._recordLabelColor(record);
        if (labelColor) elmt.style.color = labelColor;

        if (bubbles) {
            elmt.onclick = domEvt => this._showBubble(record, domEvt || window.event);
        }

        this._labelLayerDiv.appendChild(elmt);
        record.labelElmt = elmt;
        this._setLabelPosition(record, -100000);
        this._measureLabel(record);
    };

    Timeline.NarrativeDecorator.prototype.paint = function () {
        if (this._layerDiv != null) this._band.removeLayerDiv(this._layerDiv);
        if (this._labelLayerDiv != null) this._band.removeLayerDiv(this._labelLayerDiv);

        this._layerDiv = this._band.createLayerDiv(this._zIndex, "timeline-narrative-decorator-layer timeline-narrative-visual-layer");
        this._layerDiv.setAttribute("name", "narrative-decorator");
        this._layerDiv.style.visibility = "hidden";
        this._layerDiv.style.pointerEvents = "none";

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
            const startDate = parseDate(this._unit, item.startDate);
            const endDate = parseDate(this._unit, item.endDate);
            if (!startDate || !endDate || this._unit.compare(startDate, endDate) >= 0) return;

            const record = {
                item,
                index,
                kind: "range",
                startDate,
                endDate,
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
                const span = doc.createElement("div");
                span.className = [
                    "timeline-narrative-span",
                    this._themeCssClass("span"),
                    this._spanCssClass,
                    item.cssClass
                ].filter(Boolean).join(" ");
                span.style.position = "absolute";
                if (spanColor) {
                    span.style.backgroundColor = spanColor;
                }
                this._layerDiv.appendChild(span);
                record.spanElmt = span;
            }

            this._makeLabel(record, [
                "timeline-narrative-label",
                this._themeCssClass("label"),
                "timeline-narrative-range-label",
                this._themeCssClass("range-label"),
                this._spanLabelCssClass,
                item.labelCssClass
            ].filter(Boolean).join(" "));
            this._rangeRecords.push(record);
        });

        this._instants.forEach((item, index) => {
            const date = parseDate(this._unit, item.date);
            if (!date) return;

            const record = {
                item,
                index,
                kind: "instant",
                date,
                baseTrack: this._resolveTrack(item, index),
                track: 0,
                trackExplicit: this._trackIsExplicit(item),
                pixel: 0
            };
            record.track = record.baseTrack;

            const lineColor = this._recordInstantLineColor(record);
            record.graphicColor = lineColor;

            if (this._dividers) {
                const line = doc.createElement("div");
                line.className = [
                    "timeline-narrative-instant-line",
                    this._themeCssClass("instant-line"),
                    this._dividerCssClass,
                    item.cssClass
                ].filter(Boolean).join(" ");
                line.style.position = "absolute";
                line.style.backgroundColor = lineColor;
                this._layerDiv.appendChild(line);
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
            this._instantRecords.push(record);
        });

        this.softPaint();
        this._layerDiv.style.visibility = "";
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

            if (record.spanElmt) {
                record.spanElmt.style.display = "";
                this._setRect(record.spanElmt, horizontal
                    ? { left: record.startPixel, width: record.endPixel - record.startPixel, top: this._spanOffset, height: crossSize }
                    : { top: record.startPixel, height: record.endPixel - record.startPixel, left: this._spanOffset, width: crossSize });
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
                const start = record.pixel - Math.round(dividerWidth / 2);
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
            const contactInset = this._stickyContactThreshold(
                HORIZONTAL_STICKY_CONTACT_SIZE
            );
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

            const findSlidingLeft = (intervals, preferredLeft, size, maxLeft) => {
                if (preferredLeft >= maxLeft) return null;

                let left = preferredLeft;
                const sorted = (intervals || []).slice().sort((a, b) => a.left - b.left);

                for (const interval of sorted) {
                    const right = left + size;
                    if (right + labelGap <= interval.left) break;

                    if (left < interval.right + labelGap &&
                        right + labelGap > interval.left) {
                        left = interval.right + labelGap;
                        if (left >= maxLeft) return null;
                    }
                }

                return left < maxLeft ? left : null;
            };

            const placeSlidingLabel = (targetTracks, preferredLeft, size, maxLeft) => {
                if (preferredLeft >= maxLeft) return null;

                const preferredRight = preferredLeft + size;

                for (let track = 0; track < targetTracks.length; track++) {
                    if (intervalIsFree(targetTracks[track], preferredLeft, preferredRight)) {
                        return { track, left: preferredLeft };
                    }
                }

                for (let track = 0; track < targetTracks.length; track++) {
                    const left = findSlidingLeft(targetTracks[track], preferredLeft, size, maxLeft);
                    if (left != null) return { track, left };
                }

                return null;
            };

            const placeFixedLabel = (targetTracks, left, right, preferredTrack) => {
                const startTrack = Math.max(0, Math.floor(preferredTrack || 0));

                for (let track = startTrack; track < targetTracks.length; track++) {
                    if (intervalIsFree(targetTracks[track], left, right)) return track;
                }

                targetTracks.push([]);
                return targetTracks.length - 1;
            };

            for (const record of ranges) {
                if (record.endPixel - contactInset <= stickyLeft ||
                    record.startPixel + contactInset >= stickyRight) {
                    record.labelElmt.style.display = "none";
                    continue;
                }

                const size = this._labelMainSize(record);
                const naturalLeft = Math.max(record.startPixel, stickyLeft);
                const maxContactLeft = record.endPixel - contactInset;

                if (naturalLeft >= maxContactLeft) {
                    record.labelElmt.style.display = "none";
                    continue;
                }

                const placement = placeSlidingLabel(
                    tracks,
                    naturalLeft,
                    size,
                    maxContactLeft
                );

                if (placement == null) {
                    record.labelElmt.style.display = "none";
                    continue;
                }

                reserveInterval(
                    tracks,
                    placement.track,
                    placement.left,
                    placement.left + size
                );
                spanPlacements.push({ record, placement, size });
            }

            const shiftedTracks = tracks.map(() => []);

            for (const { record, placement, size } of spanPlacements) {
                const rightStickyLeft = stickyRight - size;
                const left = Math.max(
                    stickyLeft,
                    Math.min(placement.left, rightStickyLeft)
                );
                const track = placeFixedLabel(
                    shiftedTracks,
                    left,
                    left + size
                );

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
                const track = placeFixedLabel(
                    tracks,
                    record.pixel,
                    record.pixel + size,
                    preferredTrack
                );

                record.track = track;
                record.labelElmt.style.display = "";
                this._setLabelPosition(record, record.pixel);
                reserveInterval(tracks, record.track, record.pixel, record.pixel + size);
            }

            return;
        }

        const occupied = {};
        const visibleOccupied = [];
        const contactInset = this._stickyContactThreshold(
            VERTICAL_STICKY_CONTACT_SIZE
        );
        const labelCrossEnd = (record, track) =>
            this._trackStart(track) + Math.max(this._trackSizeValue(), record.width || 0);

        const reserveLabel = (track, start, size, record) => {
            occupied[track] ??= [];
            occupied[track].push({ start, end: start + size + this._stickyGap });
            visibleOccupied.push({
                start,
                end: start + size + this._stickyGap,
                left: this._trackStart(track),
                right: labelCrossEnd(record, track)
            });
        };

        const stackForward = (track, start, size) => {
            let next = start;
            let changed = true;

            while (changed) {
                changed = false;
                for (const rect of occupied[track] || []) {
                    if (next < rect.end && next + size > rect.start) {
                        next = rect.end;
                        changed = true;
                    }
                }
            }

            return next;
        };

        const labelFitsRange = (record, main, size) => {
            const renderedStart = main + this._labelOffset;
            return renderedStart >= record.startPixel &&
                renderedStart + size <= record.endPixel;
        };

        const labelKeepsContact = (record, main) =>
            main + this._labelOffset + contactInset <= record.endPixel;

        const placeRangeLabel = (
            record,
            start,
            size,
            firstTrack = record.baseTrack,
            requireFullBounds = false
        ) => {
            const preferredTrack = Math.max(0, Math.floor(firstTrack || 0));
            const occupiedTracks = Object.keys(occupied).map(Number);
            const lastOccupiedTrack = occupiedTracks.length > 0
                ? Math.max(...occupiedTracks)
                : -1;
            const overflowTrack = Math.max(
                preferredTrack,
                this._trackCount - 1,
                lastOccupiedTrack
            ) + 1;
            let rerouting = requireFullBounds;

            for (let track = preferredTrack; track <= overflowTrack; track++) {
                const main = stackForward(track, start, size);
                const pushed = main > start;

                if ((!rerouting && !pushed) || labelFitsRange(record, main, size)) {
                    return { track, main };
                }

                rerouting = true;
            }

            return null;
        };

        const collidesVisible = (track, start, size, record) => {
            const left = this._trackStart(track);
            const right = labelCrossEnd(record, track);

            return visibleOccupied.some(rect =>
                start < rect.end &&
                start + size > rect.start &&
                left < rect.right &&
                right > rect.left
            );
        };

        const firstFreeInstantTrackOrOverflow = (start, size, startTrack, record) => {
            const firstTrack = Math.max(0, Math.floor(startTrack || 0));
            const maxTrack = firstTrack + this._trackCount + visibleOccupied.length + 2;

            for (let track = firstTrack; track <= maxTrack; track++) {
                if (!collidesVisible(track, start, size, record)) return track;
            }

            return maxTrack + 1;
        };

        for (const record of ranges) {
            const size = this._labelMainSize(record);
            const main = Math.max(
                record.startPixel,
                stickyMain,
                record.startPixel - this._labelOffset
            );
            const previousPlacement = record._verticalPlacement;
            const retainPushedPlacement = previousPlacement != null &&
                (previousPlacement.viewOffset == null ||
                    viewOffset <= previousPlacement.viewOffset);
            let placement = labelKeepsContact(record, main)
                ? placeRangeLabel(
                    record,
                    main,
                    size,
                    retainPushedPlacement
                        ? previousPlacement.track
                        : record.baseTrack
                )
                : null;

            if (placement != null &&
                retainPushedPlacement &&
                previousPlacement.track === placement.track &&
                previousPlacement.main > placement.main) {
                const retainedMain = previousPlacement.main;

                if (labelFitsRange(record, retainedMain, size)) {
                    placement.main = retainedMain;
                } else {
                    placement = placeRangeLabel(
                        record,
                        main,
                        size,
                        placement.track + 1,
                        true
                    );
                }
            }

            if (placement == null) {
                record.labelElmt.style.display = "none";
                record._verticalPlacement = null;
                this._rangePlacementState.delete(record.item);
                continue;
            }

            record.track = placement.track;
            placement.viewOffset = viewOffset;
            record._verticalPlacement = placement;
            this._rangePlacementState.set(record.item, placement);
            record.labelElmt.style.display = "";
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

            record.track = firstFreeInstantTrackOrOverflow(
                record.pixel,
                size,
                preferredTrack,
                record
            );
            record.labelElmt.style.display = "";
            this._setLabelPosition(record, record.pixel);
            reserveLabel(record.track, record.pixel, size, record);
        }
    };
}());
