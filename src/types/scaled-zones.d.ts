declare namespace Timeline {
    interface ScaledZone {
        start: unknown;
        end: unknown;
        magnify: number;
        unit: number;
        multiple?: number;
    }

    interface ScaledZoneBandParams extends BandInfoParams<Date> {
        zones: readonly ScaledZone[];
    }

    function createScaledZoneBand(
        params: ScaledZoneBandParams & { eventSource: EventSource }
    ): EventBandInfo<Date>;
    function createScaledZoneBand(
        params: ScaledZoneBandParams
    ): BandInfo<Date>;
}
