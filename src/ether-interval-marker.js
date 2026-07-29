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

        if (!("show" in marker)) marker.show = true;
        if (!("hLength" in marker)) marker.hLength = DEFAULT_HORIZONTAL_LENGTH;
        if (!("vLength" in marker)) marker.vLength = DEFAULT_VERTICAL_LENGTH;

        return marker;
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
        showLine
    ) {
        var horizontal = timeline.isHorizontal();

        applyMarkerThemeDefaults(theme);
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
            var showMarker = markerTheme.show !== false;
            var targetMarkerLayer = showMarker
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

            if (showMarker && marker && marker.style) {
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

                if (length != null) {
                    marker.style[horizontal ? "height" : "width"] =
                        String(length);
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
