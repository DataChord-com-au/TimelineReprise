declare namespace Timeline {
    interface BandUnit<T = unknown> extends TimelineUnit<T> {
        makeDefaultValue(): T;
        cloneValue(value: T): T;
        toNumber(value: T): number;
        fromNumber(value: number): T;
        change(value: T, delta: number): T;
        createLabeller?(
            locale?: string,
            timeZone?: number
        ): TimelineLabeller<T>;
    }

    interface RepriseScaledZoneSpec<TInput = unknown> {
        id: string;
        start: TInput;
        end: TInput;
        magnify?: number;
        unit?: DateTimeUnitName | number;
        multiple?: number;
    }

    interface RepriseBandSpec<T = unknown> {
        id?: string;
        width?: BandWidth;
        date?: unknown;
        intervalUnit?: DateTimeUnitName | number;
        interval?: number;
        intervalPixels: number;
        multiple?: number;
        eventSource?: EventSource | null;
        unit?: BandUnit<T>;
        labeller?: TimelineLabeller<T> | null;
        runtime?: RepriseRuntimeContract<T> | null;
        visualTheme?: VisualThemeSelection | null;
        etherTheme?: RepriseEtherTheme | null;
        intervalMarkers?: boolean;
        intervalLines?: boolean;
        markerAlign?: BandMarkerAlign | string | null;
        markerLength?: MarkerLength;
        emphasisSpecs?: Readonly<Record<string, EmphasisStyle>> | null;
        backgroundColor?: string | null;
        scaledZones?: boolean | string | readonly string[];
        timeZone?: number;
        overview?: boolean;
        layout?: "overview" | "detailed" | "original" | string;
        showEventText?: boolean;
        trackHeight?: number;
        trackGap?: number;
        eventPainterParams?: Readonly<Record<string, unknown>>;
        eventPainter?: object | (new (params: object) => object);
        ether?: Ether<T>;
        etherPainter?: object | false | null;
        decorators?: object[];
        zoomIndex?: number;
        zoomSteps?: readonly unknown[] | null;
    }

    interface RepriseEtherIntervalMarkerTheme {
        show?: never;
        hAlign?: never;
        vAlign?: never;
        hLength?: never;
        vLength?: never;
        tickZIndex?: number;
        labelZIndex?: number;
        [key: string]: unknown;
    }

    interface RepriseEtherIntervalTheme {
        marker?: RepriseEtherIntervalMarkerTheme;
        line?: {
            show?: never;
            opacity?: number;
            [key: string]: unknown;
        };
        weekend?: {
            opacity?: number;
            [key: string]: unknown;
        };
        [key: string]: unknown;
    }

    interface RepriseEtherTheme {
        interval?: RepriseEtherIntervalTheme;
        [key: string]: unknown;
    }

    interface RepriseNamedBandSpec<T = unknown>
        extends RepriseBandSpec<T> {
        id: string;
    }

    type RepriseBandSetSpec<T = unknown> = Partial<
        Omit<RepriseBandSpec<T>, "id" | "eventSource">
    > & {
        bands: readonly RepriseNamedBandSpec<T>[];
        orientation?: TimelineOrientation;
        syncTarget?: string | null;
        highlight?:
            | readonly string[]
            | string
            | null;
        initialDate?: unknown;
        clampRange?: unknown;
        zones?:
            | readonly RepriseScaledZoneSpec[]
            | null;
    };

    interface RepriseBandSet<T = unknown> {
        readonly bandInfos: EventBandInfo<T>[];
        readonly byId: Record<string, EventBandInfo<T>>;
        readonly indexById: Record<string, number>;
        readonly orientation: TimelineOrientation;
        readonly syncTarget: string | null;
        readonly runtime: RepriseRuntimeContract<T>;
        readonly unit: BandUnit<T>;
        readonly initialDate: T | null;
        readonly clampRange: ClampRange<T> | null;
        clampController: ClampController | null;
        timeline: TimelineInstance<T> | null;
    }

    function createBand<T = Date>(
        spec: RepriseBandSpec<T>,
        context?: Partial<RepriseBandSpec<T>>
    ): EventBandInfo<T>;

    function createBandSet<T = Date>(
        spec:
            | RepriseBandSetSpec<T>
            | readonly RepriseNamedBandSpec<T>[]
    ): RepriseBandSet<T>;

    function createTimeline<T = Date>(
        container: HTMLElement,
        bandSet: RepriseBandSet<T>
    ): TimelineInstance<T>;
}
