(function () {
    if (!window.Timeline || Timeline.CardinalAxis) return;

    Timeline.CardinalAxis = function (params) {
        this._params = params;
        this._theme = params.theme;
        this._startDate = params.startDate;
        this._endDate = params.endDate || null;
        this._unit = params.unit;
        this._multiple = ("multiple" in params) ? params.multiple : 1;
        this._startLabel = params.startLabel;
        this._endLabel = params.endLabel;
        this._labelForIndex = params.labelForIndex || function (index) {
            return String(index);
        };
        this._background = params.background !== false;
        this._cssClass = params.cssClass || null;
    };
    
    Timeline.CardinalAxis.prototype.initialize = function (band, timeline) {
        this._band = band;
        this._timeline = timeline;
 
        this._backgroundLayer = null;
        if (this._background) {
            this._backgroundLayer = band.createLayerDiv(0);
            this._backgroundLayer.setAttribute("name", "ether-background");
            this._backgroundLayer.className = "timeline-ether-bg";
        }

        this._markerLayer = null;
        this._lineLayer = null;

        var align = ("align" in this._params)
            ? this._params.align
            : this._theme.ether.interval.marker[timeline.isHorizontal() ? "hAlign" : "vAlign"];

        var showLine = ("showLine" in this._params)
            ? this._params.showLine
            : this._theme.ether.interval.line.show;

        this._intervalMarkerLayout = new Timeline.EtherIntervalMarkerLayout(
            this._timeline,
            this._band,
            this._theme,
            align,
            showLine
        );

        this._highlight = this._backgroundLayer
            ? new Timeline.EtherHighlight(
                this._timeline,
                this._band,
                this._theme,
                this._backgroundLayer
            )
            : null;
    };

    Timeline.CardinalAxis.prototype.setHighlight = function (startDate, endDate) {
        if (this._highlight) this._highlight.position(startDate, endDate);
    };

    Timeline.CardinalAxis.prototype.paint = function () {
        if (this._markerLayer) {
            this._band.removeLayerDiv(this._markerLayer);
        }

        this._markerLayer = this._band.createLayerDiv(100);
        this._markerLayer.setAttribute("name", "ether-markers");
        this._markerLayer.style.display = "none";

        if (this._lineLayer) {
            this._band.removeLayerDiv(this._lineLayer);
        }

        this._lineLayer = this._band.createLayerDiv(1);
        this._lineLayer.setAttribute("name", "ether-lines");
        this._lineLayer.style.display = "none";

        var minDate = this._band.getMinDate();
        var maxDate = this._band.getMaxDate();
        var p = this;

                var addStep = function (date) {
            var next = new Date(date.getTime());

            for (var i = 0; i < p._multiple; i++) {
                SimileAjax.DateTime.incrementByInterval(next, p._unit);
            }

            return next;
        };

        var compare = function (a, b) {
            return a.getTime() - b.getTime();
        };

        var makeLabeller = function (text, emphasized) {
            return {
                labelInterval: function () {
                    return {
                        text: text,
                        emphasized: !!emphasized
                    };
                }
            };
        };

        var date = new Date(this._startDate.getTime());
        var index = 0;

        while (compare(date, minDate) < 0) {
            date = addStep(date);
            index++;
        }

        while (compare(date, maxDate) <= 0) {
            if (this._endDate && compare(date, this._endDate) > 0) break;

            var isStart = compare(date, this._startDate) === 0;
            var isEnd = this._endDate && compare(date, this._endDate) === 0;

            var text = isStart && this._startLabel != null ? this._startLabel
                : isEnd && this._endLabel != null ? this._endLabel
                : this._labelForIndex(index);

            var div = this._intervalMarkerLayout.createIntervalMarker(
                date,
                makeLabeller(text, isStart || isEnd),
                this._unit,
                this._markerLayer,
                this._lineLayer
            );

            div.style.cursor = "default";
            div.style.userSelect = "none";
            if (p._cssClass) div.className += " " + p._cssClass;
            
            date = addStep(date);
            index++;
        }

        if (this._endDate && this._endLabel != null &&
            compare(this._endDate, minDate) >= 0 &&
            compare(this._endDate, maxDate) <= 0
        ) {
            var divEnd = this._intervalMarkerLayout.createIntervalMarker(
                this._endDate,
                makeLabeller(this._endLabel, true),
                this._unit,
                this._markerLayer,
                this._lineLayer
            );

            divEnd.style.cursor = "default";
            divEnd.style.userSelect = "none";
            if (p._cssClass) divEnd.className += " " + p._cssClass;
        }

        this._markerLayer.style.display = "block";
        this._lineLayer.style.display = "block";
    };

    Timeline.CardinalAxis.prototype.softPaint = function () {
    };
}());
