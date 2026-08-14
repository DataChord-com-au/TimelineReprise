declare namespace Timeline {
    interface CardinalAxisSpec {
        range: unknown;
        intervalUnit: DateTimeUnitName | number;
        /** Positive finite interval units represented by one cardinal count. */
        unitsPerCount?: number;
        /** Positive finite cardinal counts between generated markers. */
        countsPerMarker?: number;
        anchorValue?: number;
        anchor?: CardinalAxisAnchor;
        finishing?: CardinalAxisFinishing;
        truncatePreviousMarkerThreshold?: number;
        startLabel?: string | null;
        endLabel?: string | null;
        /** Receives the normalized anchor-relative cardinal value. */
        labelForIndex?: (index: number) => string;
        /** Positive integer label cadence over generated marker offsets. */
        labelEvery?: number;
    }

    interface AttachCardinalAxisOptions<T = Date> {
        runtime?: RepriseRuntimeContract<T> | null;
        theme?: NativeTheme | null;
        markerLength?: MarkerLength;
        cssClass?: string | null;
        align?: string;
        showLine?: boolean;
        /** Whether generated marker label content is visible. Defaults to true. */
        showLabels?: boolean;
        /** Whether generated marker tick elements are rendered. Defaults to true. */
        showTicks?: boolean;
        /** Optional inline color for generated cardinal label content. */
        labelColor?: string;
        /** Derive a light/dark label color from labelColor. Defaults to false. */
        deriveLabelColor?: boolean;
        /** Content used for marker labels skipped by labelEvery. */
        unlabeledMarkerText?: string;
    }

    interface CardinalAxisOptions<T = Date> {
        theme: NativeTheme;
        /** @internal Prefer AttachCardinalAxisOptions.markerLength. */
        markerLength?: MarkerLength;
        runtime?: RepriseRuntimeContract<T> | null;
        startDate: T;
        endDate?: T | null;
        unit: number;
        /** Positive finite interval units represented by one cardinal count. */
        unitsPerCount?: number;
        /** Positive finite cardinal counts between generated markers. */
        countsPerMarker?: number;
        anchorValue?: number;
        anchor?: CardinalAxisAnchor;
        finishing?: CardinalAxisFinishing;
        truncatePreviousMarkerThreshold?: number;
        startLabel?: string | null;
        endLabel?: string | null;
        /** Receives the normalized anchor-relative cardinal value. */
        labelForIndex?: (index: number) => string;
        /** Resolves a projected value from a zero-based marker offset. */
        markerAtIndex?: ((markerOffset: number) => T | null) | null;
        /** Returns a fractional marker offset for a truncated boundary. */
        indexAtValue?: ((
            value: T,
            context: CardinalAxisIndexContext<T>
        ) => number | null) | null;
        background?: boolean;
        cssClass?: string | null;
        align?: string;
        showLine?: boolean;
        /** Whether generated marker label content is visible. Defaults to true. */
        showLabels?: boolean;
        /** Whether generated marker tick elements are rendered. Defaults to true. */
        showTicks?: boolean;
        /** @internal Resolved inline color supplied by attachCardinalAxis. */
        labelColor?: string;
        /** Positive integer label cadence over generated marker offsets. */
        labelEvery?: number;
        /** Content used for marker labels skipped by labelEvery. */
        unlabeledMarkerText?: string;
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
