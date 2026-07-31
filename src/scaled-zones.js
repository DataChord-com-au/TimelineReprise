class UnitScaledZoneEther {
    constructor(params) {
        this._params = params;
        this._interval = params.interval;
        this._pixelsPerInterval = params.pixelsPerInterval;
    }

    initialize(band, timeline) {
        this._band = band;
        this._timeline = timeline;
        this._unit = timeline.getUnit();
        this._segments = this._createSegments(this._params.zones ?? []);

        if ("startsOn" in this._params) {
            this._start = this._parse(this._params.startsOn);
        } else if ("endsOn" in this._params) {
            this._start = this._parse(this._params.endsOn);
            this.shiftPixels(-timeline.getPixelLength());
        } else {
            this._start = "centersOn" in this._params
                ? this._parse(this._params.centersOn)
                : this._unit.makeDefaultValue();
            this.shiftPixels(-timeline.getPixelLength() / 2);
        }
    }

    setDate(value) {
        this._start = this._unit.cloneValue(value);
    }

    shiftPixels(pixels) {
        this._start = this.pixelOffsetToDate(pixels);
    }

    dateToPixelOffset(value) {
        return this._coordinateDistanceToPixels(
            this._coordinate(this._start),
            this._coordinate(value)
        );
    }

    pixelOffsetToDate(pixels) {
        if (!Number.isFinite(pixels)) {
            throw new RangeError(
                "TimelineReprise scaled-zone pixel offset must be finite."
            );
        }

        const direction = Math.sign(pixels);
        if (direction === 0) return this._unit.cloneValue(this._start);

        let coordinate = this._coordinate(this._start);
        let remaining = Math.abs(pixels);

        while (remaining > 0) {
            const segment = this._segmentAt(coordinate, direction);
            const boundary = direction > 0
                ? segment.end
                : segment.start;
            const distance = Number.isFinite(boundary)
                ? Math.abs(boundary - coordinate)
                : Number.POSITIVE_INFINITY;
            const availablePixels = distance *
                segment.magnify /
                this._getScale();

            if (remaining <= availablePixels) {
                coordinate += direction *
                    remaining *
                    this._getScale() /
                    segment.magnify;
                remaining = 0;
            } else {
                coordinate = boundary;
                remaining -= availablePixels;
            }
        }

        return this._unit.fromNumber(coordinate);
    }

    zoom(zoomIn) {
        const steps = this._band?._zoomSteps;
        if (!Array.isArray(steps) || steps.length === 0) return 0;

        const previousIndex = this._band._zoomIndex;
        const nextIndex = zoomIn
            ? Math.max(0, previousIndex - 1)
            : Math.min(steps.length - 1, previousIndex + 1);
        const previousInterval = this._interval;
        const nextInterval = Number(
            steps[nextIndex].interval ?? steps[nextIndex].unit
        );

        if (!Number.isFinite(nextInterval) || nextInterval <= 0) return 0;

        this._band._zoomIndex = nextIndex;
        this._interval = nextInterval;
        this._pixelsPerInterval =
            steps[nextIndex].pixelsPerInterval ?? this._pixelsPerInterval;
        return nextInterval - previousInterval;
    }

    _parse(value) {
        const parsed = this._unit.parseFromObject(value);
        this._coordinate(parsed);
        return parsed;
    }

    _coordinate(value) {
        const coordinate = this._unit.toNumber(value);
        if (!Number.isFinite(coordinate)) {
            throw new TypeError(
                "TimelineReprise scaled-zone unit projection must be finite."
            );
        }
        return coordinate;
    }

    _createSegments(zones) {
        const projected = zones.map(zone => {
            const first = this._coordinate(zone.start);
            const second = this._coordinate(zone.end);
            return {
                start: Math.min(first, second),
                end: Math.max(first, second),
                magnify: zone.magnify
            };
        });
        const boundaries = [...new Set(
            projected.flatMap(zone => [zone.start, zone.end])
        )].sort((left, right) => left - right);
        const segments = [];
        let start = Number.NEGATIVE_INFINITY;

        for (const end of [...boundaries, Number.POSITIVE_INFINITY]) {
            const magnify = projected.reduce((result, zone) =>
                zone.start < end && zone.end > start
                    ? result * zone.magnify
                    : result,
            1);
            segments.push({ start, end, magnify });
            start = end;
        }

        return segments;
    }

    _segmentAt(coordinate, direction) {
        let segment = null;
        if (direction > 0) {
            segment = this._segments.find(candidate =>
                coordinate >= candidate.start &&
                coordinate < candidate.end
            );
        } else {
            for (let index = this._segments.length - 1; index >= 0; index--) {
                const candidate = this._segments[index];
                if (
                    coordinate > candidate.start &&
                    coordinate <= candidate.end
                ) {
                    segment = candidate;
                    break;
                }
            }
        }

        if (segment == null) {
            throw new RangeError(
                "TimelineReprise could not resolve a scaled-zone segment."
            );
        }
        return segment;
    }

    _coordinateDistanceToPixels(start, end) {
        const direction = Math.sign(end - start);
        if (direction === 0) return 0;

        let coordinate = start;
        let pixels = 0;

        while (direction * (end - coordinate) > 0) {
            const segment = this._segmentAt(coordinate, direction);
            const boundary = direction > 0
                ? Math.min(end, segment.end)
                : Math.max(end, segment.start);
            pixels += direction *
                Math.abs(boundary - coordinate) *
                segment.magnify /
                this._getScale();
            coordinate = boundary;
        }

        return pixels;
    }

    _getScale() {
        return this._interval / this._pixelsPerInterval;
    }
}

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

export { UnitScaledZoneEther };
