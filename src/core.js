(function () {
    if (!window.Timeline || Timeline._flexibleBandWidthsPatchApplied) return;
    Timeline._flexibleBandWidthsPatchApplied = true;

    const proto = Timeline._Impl?.prototype;
    if (!proto || typeof proto._distributeWidths !== "function") return;

    const originalDistributeWidths = proto._distributeWidths;

    if (!Timeline.EmptyEtherPainter) {
        Timeline.EmptyEtherPainter = function () {};

        Timeline.EmptyEtherPainter.prototype.initialize = function (band, timeline) {
            this._band = band;
            this._timeline = timeline;

            this._backgroundLayer = band.createLayerDiv(0);
            this._backgroundLayer.setAttribute("name", "ether-background");
            this._backgroundLayer.className = "timeline-ether-bg";
        };
        Timeline.EmptyEtherPainter.prototype.setHighlight = function () {};
        Timeline.EmptyEtherPainter.prototype.paint = function () {};
        Timeline.EmptyEtherPainter.prototype.softPaint = function () {};
    }

    if (
        Timeline.DefaultEventSource &&
        !Timeline.DefaultEventSource._absoluteUriPatchApplied
    ) {
        Timeline.DefaultEventSource._absoluteUriPatchApplied = true;

        const proto = Timeline.DefaultEventSource.prototype;
        const originalResolveRelativeURL = proto._resolveRelativeURL;

        proto._resolveRelativeURL = function (url, base) {
            if (url != null && /^[a-z][a-z0-9+.-]*:/i.test(url)) {
                return url;
            }

            return originalResolveRelativeURL.call(this, url, base);
        };
    }

    if (!Timeline.ThemeIcons) {
        const colorAliases = Object.freeze({
            "black": "#2B2B2B",
            "blue": "#58A0DC",
            "dark-blue": "#2F6F9F",
            "dark-green": "#3D8F5A",
            "dark-red": "#A83F3F",
            "dull-blue": "#6F8FA8",
            "dull-green": "#78967F",
            "dull-red": "#A87878",
            "gray": "#9AA0A6",
            "green": "#58B878",
            "orange": "#E28A2E",
            "purple": "#9B6BD3",
            "red": "#D64B4B",
            "white": "#D8D8D8",
            "yellow": "#D6B84B"
        });

        Timeline.ThemeIcons = {
            colorAliases,

            normalizeColor: function (color) {
                return String(color ?? "").trim();
            },

            getCssColor: function (color) {
                color = this.normalizeColor(color);
                if (color === "") return null;

                return this.colorAliases[color.toLowerCase()] ?? color;
            },

            get: function (color, size) {
                const fill = this.getCssColor(color);
                if (!fill) return null;

                const dimension = Number.isFinite(size) && size > 0 ? size : 9;
                const center = dimension / 2;
                const radius = center - 0.5;

                const svg =
                    '<svg xmlns="http://www.w3.org/2000/svg" data-tr-theme-icon="1" width="' + dimension +
                    '" height="' + dimension + '" viewBox="0 0 ' + dimension + ' ' + dimension + '">' +
                    '<circle cx="' + center + '" cy="' + center + '" r="' + radius + '" fill="' + fill + '"/>' +
                    '</svg>';

                return "data:image/svg+xml," + encodeURIComponent(svg);
            }
        };
    }

    function isFlexWidth(widthSpec) {
        return widthSpec === "*" ||
            (typeof widthSpec === "string" && widthSpec.endsWith("fr"));
    }

    function getFlexWeight(widthSpec) {
        if (widthSpec === "*") return 1;
        return parseFloat(widthSpec) || 1;
    }

    function getFixedWidth(widthSpec, timelineWidth) {
        if (isFlexWidth(widthSpec)) return null;

        if (typeof widthSpec === "string") {
            if (widthSpec.endsWith("%")) {
                return Math.round(parseFloat(widthSpec) * timelineWidth / 100);
            }

            return parseInt(widthSpec, 10);
        }

        return widthSpec;
    }

    proto._distributeWidths = function () {
        const length = this.getPixelLength();
        const timelineWidth = this.getPixelWidth();
        const bandWidths = [];

        let fixedWidth = 0;
        let flexWeight = 0;

        for (let i = 0; i < this._bands.length; i++) {
            const widthSpec = this._bandInfos[i].width;
            const bandWidth = getFixedWidth(widthSpec, timelineWidth);

            if (bandWidth == null) {
                flexWeight += getFlexWeight(widthSpec);
            } else {
                fixedWidth += bandWidth;
            }

            bandWidths[i] = bandWidth;
        }

        const remainingWidth = Math.max(0, timelineWidth - fixedWidth);
        let roundingRemainder = remainingWidth;

        for (let i = 0; i < this._bands.length; i++) {
            if (bandWidths[i] != null) continue;

            const weight = getFlexWeight(this._bandInfos[i].width);
            bandWidths[i] = flexWeight > 0
                ? Math.round(remainingWidth * weight / flexWeight)
                : 0;

            roundingRemainder -= bandWidths[i];
        }

        for (let i = bandWidths.length - 1; roundingRemainder !== 0 && i >= 0; i--) {
            if (isFlexWidth(this._bandInfos[i].width)) {
                bandWidths[i] += roundingRemainder;
                break;
            }
        }

        let cumulativeWidth = 0;

        for (let i = 0; i < this._bands.length; i++) {
            this._bands[i].setBandShiftAndWidth(cumulativeWidth, bandWidths[i]);
            this._bands[i].setViewLength(length);
            cumulativeWidth += bandWidths[i];
        }
    };

    proto._distributeWidths._originalDistributeWidths = originalDistributeWidths;
}());
