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

        return marker;
    }

    function addClass(element, className) {
        element.className += " " + className;
    }

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
        var horizontal = timeline.isHorizontal();
        var orientation = horizontal ? "horizontal" : "vertical";
        var edge = horizontal
            ? (align === "Top" ? "top" : "bottom")
            : (align === "Left" ? "left" : "right");
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
            var markerTheme = getMarkerTheme(theme) || {};
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
                var length = horizontal
                    ? (
                        "hLength" in markerTheme
                            ? markerTheme.hLength
                            : DEFAULT_HORIZONTAL_LENGTH
                    )
                    : (
                        "vLength" in markerTheme
                            ? markerTheme.vLength
                            : DEFAULT_VERTICAL_LENGTH
                );

                addClass(
                    marker,
                    "timeline-reprise-date-label-" + orientation
                );
                addClass(marker, "timeline-reprise-date-label-" + edge);

                if (length != null) {
                    var tick = timeline.getDocument().createElement("span");

                    addClass(marker, "timeline-reprise-date-label-ticked");
                    tick.className = "timeline-reprise-date-label-tick";
                    tick.setAttribute("aria-hidden", "true");
                    tick.style[horizontal ? "height" : "width"] =
                        length === "label" ? "100%" : String(length);
                    marker.appendChild(tick);
                }
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
