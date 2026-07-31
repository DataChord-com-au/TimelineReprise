declare namespace Timeline {
    interface CardinalAxisSpec {
        range: unknown;
        intervalUnit: DateTimeUnitName | number;
        unitsPerCount?: number;
        countsPerMarker?: number;
        anchorValue?: number;
        startLabel?: string | null;
        endLabel?: string | null;
        labelForIndex?: (index: number) => string;
    }

    interface AttachCardinalAxisOptions<T = Date> {
        runtime?: RepriseRuntimeContract<T> | null;
        theme?: NativeTheme | null;
        markerTheme?: EtherIntervalMarkerTheme | null;
        cssClass?: string | null;
        align?: string;
        showLine?: boolean;
    }

    interface CardinalAxisOptions<T = Date> {
        theme: NativeTheme;
        markerTheme?: EtherIntervalMarkerTheme | null;
        runtime?: RepriseRuntimeContract<T> | null;
        startDate: T;
        endDate?: T | null;
        unit: number;
        unitsPerCount?: number;
        countsPerMarker?: number;
        anchorValue?: number;
        startLabel?: string | null;
        endLabel?: string | null;
        labelForIndex?: (index: number) => string;
        background?: boolean;
        cssClass?: string | null;
        align?: string;
        showLine?: boolean;
    }

    class CardinalAxis<T = Date> {
        constructor(options: CardinalAxisOptions<T>);
        initialize(
            band: Band<T>,
            timeline: TimelineInstance<T>
        ): void;
        setHighlight(startDate: T, endDate: T): void;
        paint(): void;
        softPaint(): void;
    }

    function attachCardinalAxis<T = Date>(
        bandInfo: BandInfo<T>,
        spec: CardinalAxisSpec,
        options?: AttachCardinalAxisOptions<T>
    ): void;
}
