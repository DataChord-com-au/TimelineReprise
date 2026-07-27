/**
 * Shared SIMILE integration types used by the Timeline Reprise entry point.
 */
declare namespace Timeline {
    type BandWidth = number | string;

    interface NativeTheme {
        eventTheme?: EventTheme | EventThemeConfig;
        emphasisSpecs?: Readonly<Record<string, EmphasisStyle>>;
        [key: string]: unknown;
    }

    interface EventSource {
        addMany(events: readonly object[]): void;
    }

    interface EventPainter {
        [key: string]: unknown;
    }

    interface Ether<T = unknown> {
        pixelOffsetToDate(offset: number): T;
    }

    interface Band<T = unknown> {
        getCenterVisibleDate(): T;
        setCenterVisibleDate(value: T): void;
        getViewLength(): number;
        getEther(): Ether<T>;
        getLabeller?(): TimelineLabeller<T>;
        getMinDate?(): T;
        getMaxDate?(): T;
        createLayerDiv?(index: number): HTMLDivElement;
        removeLayerDiv?(element: Element): void;
        busy?(): boolean;
        zoom?(...args: unknown[]): unknown;
        [key: string]: unknown;
    }

    interface TimelineInstance<T = unknown> {
        getBandCount(): number;
        getBand(index: number): Band<T>;
        getUnit(): TimelineUnit<T>;
        shiftOK(bandIndex: number, delta: number): boolean;
        dispose?(): void;
        layout?(): void;
        [key: string]: unknown;
    }

    interface BandInfo<T = unknown> {
        width?: BandWidth;
        eventSource?: EventSource | null;
        timeZone?: number;
        labeller?: TimelineLabeller<T>;
        unit?: TimelineUnit<T>;
        ether?: Ether<T>;
        etherPainter?: object;
        eventPainter?: EventPainter;
        theme: NativeTheme;
        decorators?: object[];
        syncWith?: number;
        highlight?: boolean;
        zoomIndex?: number;
        zoomSteps?: readonly unknown[] | null;
        [key: string]: unknown;
    }

    interface EventBandInfo<T = unknown> extends BandInfo<T> {
        eventSource: EventSource;
        eventPainter: EventPainter;
    }

    interface BandInfoParams<T = Date> {
        width?: BandWidth;
        eventSource?: EventSource | null;
        date?: unknown;
        intervalUnit: number;
        intervalPixels: number;
        multiple?: number;
        theme?: NativeTheme;
        timeZone?: number;
        labeller?: TimelineLabeller<T>;
        overview?: boolean;
        layout?: "overview" | "detailed" | "original" | string;
        showEventText?: boolean;
        trackHeight?: number;
        trackGap?: number;
        syncWith?: number;
        highlight?: boolean;
        [key: string]: unknown;
    }

    function createBandInfo<T = Date>(
        params: BandInfoParams<T> & { eventSource: EventSource }
    ): EventBandInfo<T>;
    function createBandInfo<T = Date>(
        params: BandInfoParams<T>
    ): BandInfo<T>;

    function create<T = Date>(
        container: HTMLElement,
        bandInfos: readonly BandInfo<T>[],
        orientation?: TimelineOrientationValue,
        unit?: TimelineUnit<T>
    ): TimelineInstance<T>;

    namespace ClassicTheme {
        function create(): NativeTheme;
    }

    interface LinearEtherOptions<T = unknown> {
        centersOn: T;
        interval: number;
        pixelsPerInterval: number;
        theme?: NativeTheme;
    }

    class LinearEther<T = unknown> implements Ether<T> {
        constructor(options: LinearEtherOptions<T>);
        pixelOffsetToDate(offset: number): T;
    }
}
