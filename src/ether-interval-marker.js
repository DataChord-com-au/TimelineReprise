(function () {
    if (
        typeof Timeline === "undefined" ||
        !Timeline.EtherIntervalMarkerLayout ||
        Timeline._etherIntervalMarkerThemePatchApplied
    ) {
        return;
    }

    Timeline._etherIntervalMarkerThemePatchApplied = true;

    var DEFAULT_HORIZONTAL_LENGTH = null;
    var DEFAULT_VERTICAL_LENGTH = "2.5em";
    var DEFAULT_TICK_Z_INDEX = 100;
    var DEFAULT_LABEL_Z_INDEX = 102;

    function getMarkerTheme(theme) {
        return theme &&
            theme.ether &&
            theme.ether.interval &&
            theme.ether.interval.marker;
    }

    function applyMarkerThemeDefaults(theme) {
        var marker = getMarkerTheme(theme);
        if (!marker) return marker;

        if (!("hLength" in marker)) marker.hLength = DEFAULT_HORIZONTAL_LENGTH;
        if (!("vLength" in marker)) marker.vLength = DEFAULT_VERTICAL_LENGTH;
        if (!("tickZIndex" in marker)) marker.tickZIndex = DEFAULT_TICK_Z_INDEX;
        if (!("labelZIndex" in marker)) marker.labelZIndex = DEFAULT_LABEL_Z_INDEX;

        return marker;
    }

    function addClass(element, className) {
        element.className += " " + className;
    }

    function markerZIndex(markerConfig, field, fallback) {
        var value = markerConfig[field];
        if (value === undefined) return fallback;
        if (typeof value !== "number" || !isFinite(value)) {
            throw new RangeError(
                "Timeline ether.interval.marker." + field +
                " must be a finite number."
            );
        }
        return value;
    }

    function releaseMarkerLayer(markerLayer) {
        var layer = markerLayer && markerLayer.parentNode;
        if (layer && layer.style) layer.style.zIndex = "auto";
    }

    function moveMarkerContent(marker, content) {
        if (marker.firstChild) {
            while (marker.firstChild) {
                content.appendChild(marker.firstChild);
            }
            return;
        }

        var html = marker.innerHTML;
        var text = marker.textContent;
        marker.innerHTML = "";
        marker.textContent = "";
        if (html) {
            content.innerHTML = html;
        } else if (text) {
            content.textContent = text;
        }
    }

    function layerEtherIntervalMarker(
        marker,
        markerLayer,
        timeline,
        markerConfig,
        align
    ) {
        var horizontal = timeline.isHorizontal();
        var orientation = horizontal ? "horizontal" : "vertical";
        var edge = horizontal
            ? (align === "Top" ? "top" : "bottom")
            : (align === "Left" ? "left" : "right");
        var length = horizontal
            ? (
                "hLength" in markerConfig
                    ? markerConfig.hLength
                    : DEFAULT_HORIZONTAL_LENGTH
            )
            : (
                "vLength" in markerConfig
                    ? markerConfig.vLength
                    : DEFAULT_VERTICAL_LENGTH
            );
        var tickZIndex = markerZIndex(
            markerConfig,
            "tickZIndex",
            DEFAULT_TICK_Z_INDEX
        );
        var labelZIndex = markerZIndex(
            markerConfig,
            "labelZIndex",
            DEFAULT_LABEL_Z_INDEX
        );
        var document = timeline.getDocument();
        var content = document.createElement("span");
        var tick = document.createElement("span");

        releaseMarkerLayer(markerLayer);
        addClass(marker, "timeline-reprise-date-label-" + orientation);
        addClass(marker, "timeline-reprise-date-label-" + edge);
        addClass(marker, "timeline-reprise-date-label-layered");
        if (length != null) {
            addClass(marker, "timeline-reprise-date-label-ticked");
        }

        content.className = "timeline-reprise-date-label-content";
        content.style.zIndex = String(labelZIndex);
        moveMarkerContent(marker, content);
        marker.appendChild(content);

        tick.className = "timeline-reprise-date-label-tick";
        tick.setAttribute("aria-hidden", "true");
        tick.style.zIndex = String(tickZIndex);
        tick.style[horizontal ? "height" : "width"] =
            length == null || length === "label" ? "100%" : String(length);
        marker.appendChild(tick);

        return marker;
    }

    Timeline._layerEtherIntervalMarker = layerEtherIntervalMarker;

    if (Timeline.ClassicTheme && Timeline.ClassicTheme.create) {
        var originalCreateTheme = Timeline.ClassicTheme.create;

        Timeline.ClassicTheme.create = function () {
            var theme = originalCreateTheme.apply(this, arguments);
            applyMarkerThemeDefaults(theme);
            return theme;
        };

        Timeline.ClassicTheme.create._originalCreate =
            originalCreateTheme._originalCreate || originalCreateTheme;
    }

    if (Timeline._defaultTheme) {
        applyMarkerThemeDefaults(Timeline._defaultTheme);
    }

    var OriginalEtherIntervalMarkerLayout =
        Timeline.EtherIntervalMarkerLayout;

    Timeline.EtherIntervalMarkerLayout = function (
        timeline,
        band,
        theme,
        align,
        showLine,
        intervalMarkers
    ) {
        var bandInfo = band && band._bandInfo;
        var showMarkers = typeof intervalMarkers === "boolean"
            ? intervalMarkers
            : !bandInfo || bandInfo.intervalMarkers !== false;

        OriginalEtherIntervalMarkerLayout.call(
            this,
            timeline,
            band,
            theme,
            align,
            showLine
        );

        var originalCreateIntervalMarker = this.createIntervalMarker;

        this.createIntervalMarker = function (
            date,
            labeller,
            unit,
            markerLayer,
            lineLayer
        ) {
            var markerConfig = getMarkerTheme(theme) || {};
            var targetMarkerLayer = showMarkers
                ? markerLayer
                : { appendChild: function () {} };
            var marker = originalCreateIntervalMarker.call(
                this,
                date,
                labeller,
                unit,
                targetMarkerLayer,
                lineLayer
            );

            if (showMarkers && marker && marker.style) {
                layerEtherIntervalMarker(
                    marker,
                    markerLayer,
                    timeline,
                    markerConfig,
                    align
                );
            }

            return marker;
        };
    };

    Timeline.EtherIntervalMarkerLayout.prototype =
        OriginalEtherIntervalMarkerLayout.prototype;
    Timeline.EtherIntervalMarkerLayout._originalLayout =
        OriginalEtherIntervalMarkerLayout._originalLayout ||
        OriginalEtherIntervalMarkerLayout;
}());
