(function () {
    if (typeof Timeline === "undefined" || !Timeline.HotZoneGregorianEtherPainter) return;

    const proto = Timeline.HotZoneGregorianEtherPainter.prototype;
    if (!Timeline._timelineUtilsHotZoneBandInfoMultiplePatch) {
        const createHotZoneBandInfo = Timeline.createHotZoneBandInfo;

        Timeline.createHotZoneBandInfo = function (params) {
            const bandInfo = createHotZoneBandInfo.call(this, params);
            const baseMultiple = ("multiple" in params) ? params.multiple : 1;
            const baseUnit = params.intervalUnit;

            const hotZoneRanges = (params.zones || []).map(function (zone) {
                return {
                    startTime: SimileAjax.DateTime.parseGregorianDateTime(zone.start).getTime(),
                    endTime: SimileAjax.DateTime.parseGregorianDateTime(zone.end).getTime()
                };
            });

            if (bandInfo?.etherPainter?._zones) {
                bandInfo.etherPainter._zones.forEach(function (zone) {
                    const isHotZoneSegment = hotZoneRanges.some(function (range) {
                        return zone.startTime >= range.startTime &&
                            zone.endTime <= range.endTime;
                    });

                    if (!isHotZoneSegment && zone.unit === baseUnit) {
                        zone.multiple = baseMultiple;
                    }
                });
            }

            return bandInfo;
        };

        Timeline._timelineUtilsHotZoneBandInfoMultiplePatch = true;
    }

    if (!Timeline.createScaledZoneBand) {
        Timeline.createScaledZoneBand = function (params) {
            return Timeline.createHotZoneBandInfo(params);
        };
    }
    
    if (proto._timelineUtilsHotZoneBoundaryPatch) return;

    proto.paint = function () {
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

        var timeZone = this._band.getTimeZone();
        var labeller = this._band.getLabeller();

        var p = this;
        var incrementDate = function (date, zone) {
            for (var i = 0; i < zone.multiple; i++) {
                SimileAjax.DateTime.incrementByInterval(date, zone.unit);
            }
        };

        var zStart = 0;
        while (zStart < this._zones.length) {
            if (minDate.getTime() < this._zones[zStart].endTime) {
                break;
            }
            zStart++;
        }

        var zEnd = this._zones.length - 1;
        while (zEnd >= 0) {
            if (maxDate.getTime() > this._zones[zEnd].startTime) {
                break;
            }
            zEnd--;
        }

        for (var z = zStart; z <= zEnd; z++) {
            var zone = this._zones[z];

            var minDate2 = new Date(Math.max(minDate.getTime(), zone.startTime));
            var maxDate2 = new Date(Math.min(maxDate.getTime(), zone.endTime));

            SimileAjax.DateTime.roundDownToInterval(
                minDate2,
                zone.unit,
                timeZone,
                zone.multiple,
                this._theme.firstDayOfWeek
            );

            while (minDate2.getTime() < zone.startTime) {
                incrementDate(minDate2, zone);
            }

            SimileAjax.DateTime.roundUpToInterval(
                maxDate2,
                zone.unit,
                timeZone,
                zone.multiple,
                this._theme.firstDayOfWeek
            );

            while (
                minDate2.getTime() < maxDate2.getTime() &&
                minDate2.getTime() < zone.endTime
            ) {
                this._intervalMarkerLayout.createIntervalMarker(
                    minDate2,
                    labeller,
                    zone.unit,
                    this._markerLayer,
                    this._lineLayer
                );

                incrementDate(minDate2, zone);
            }
        }

        this._markerLayer.style.display = "block";
        this._lineLayer.style.display = "block";
    };

    proto._timelineUtilsHotZoneBoundaryPatch = true;
}());
