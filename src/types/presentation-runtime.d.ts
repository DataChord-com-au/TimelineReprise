declare namespace Timeline {
    type RenderTarget = "text" | "html";
    type RenderedContent =
        | string
        | number
        | boolean
        | Node
        | readonly RenderedContent[]
        | null
        | undefined;

    interface CanonicalInstant<T = unknown> {
        readonly kind: "instant";
        readonly value: T;
        readonly latestStart?: T;
        readonly earliestEnd?: T;
    }

    interface CanonicalRange<T = unknown> {
        readonly kind: "range";
        readonly start: T;
        readonly end: T;
        readonly latestStart?: T;
        readonly earliestEnd?: T;
    }

    type CanonicalEventTime<T = unknown> =
        | CanonicalInstant<T>
        | CanonicalRange<T>;

    interface RepriseDuration<T = unknown> {
        readonly value: T;
        readonly text: string;
    }

    interface RepriseDurations<T = unknown> {
        readonly duration?: RepriseDuration<T>;
        readonly minimumDuration?: RepriseDuration<T>;
        readonly elapsed?: RepriseDuration<T>;
        readonly remaining?: RepriseDuration<T>;
    }

    interface DurationDerivationContext<T = unknown> {
        readonly eventTime: CanonicalEventTime<T> | null;
        readonly currentTime?: unknown;
        readonly durationPrecision: ElapsedDurationPrecision;
    }

    type CardinalAxisAnchor = "start" | "end";
    type CardinalAxisFinishing = "extend" | "truncate" | "drop";

    interface CardinalAxisProjectionContext {
        readonly range: unknown;
        readonly intervalUnit: DateTimeUnitName | number;
        readonly resolvedIntervalUnit: number;
        /** Positive finite interval units represented by one cardinal count. */
        readonly unitsPerCount: number;
        /** Positive finite cardinal counts between generated markers. */
        readonly countsPerMarker: number;
        readonly anchor: CardinalAxisAnchor;
        readonly finishing: CardinalAxisFinishing;
        readonly truncatePreviousMarkerThreshold: number;
    }

    interface CardinalAxisIndexContext<T = unknown> {
        readonly previousMarker: T;
        readonly nextMarker: T;
        /** Zero-based offset of previousMarker from the selected anchor. */
        readonly previousIndex: number;
        /** Zero-based offset of nextMarker from the selected anchor. */
        readonly nextIndex: number;
        readonly anchor: CardinalAxisAnchor;
        readonly finishing: CardinalAxisFinishing;
    }

    interface CardinalAxisProjection<T = unknown> {
        readonly range: ClampRange<T>;
        /** Resolves a projected value from a zero-based marker offset. */
        markerAtIndex(markerOffset: number): T | null;
        /** Returns a fractional marker offset, not a cardinal label value. */
        indexAtValue?(
            value: T,
            context: CardinalAxisIndexContext<T>
        ): number | null;
    }

    interface RenderContext<T = unknown> {
        readonly field: string;
        readonly target: RenderTarget;
        readonly eventTime: CanonicalEventTime<T> | null;
        readonly visualTheme: VisualTheme;
        readonly displayProfile?: DisplayProfile | null;
        readonly unit: TimelineUnit<T>;
        readonly labeller: TimelineLabeller<T>;
        readonly currentTime?: unknown;
        readonly durationPrecision: ElapsedDurationPrecision;
        readonly duration?: RepriseDuration;
        readonly minimumDuration?: RepriseDuration;
        readonly elapsed?: RepriseDuration;
        readonly remaining?: RepriseDuration;
        readonly relativeDurationRole?:
            | "duration"
            | "elapsed"
            | "remaining";
        readonly durationRole?: "elapsed" | "remaining";
        readonly intervalUnit?: number;
        readonly surface?: string;
        readonly [key: string]: unknown;
    }

    interface RenderContextInput<T = unknown> {
        field: string;
        target?: RenderTarget;
        eventTime?: CanonicalEventTime<T> | null;
        visualTheme?: VisualTheme;
        displayProfile?: DisplayProfile | null;
        currentTime?: unknown;
        durationPrecision?: ElapsedDurationPrecision;
        durationRole?: "elapsed" | "remaining";
        intervalUnit?: number;
        surface?: string;
        [key: string]: unknown;
    }

    interface RepriseRuntimeContract<T = unknown> {
        readonly unit: TimelineUnit<T>;
        readonly labeller: TimelineLabeller<T>;
        readonly durationPrecision?: ElapsedDurationPrecision;
        readCurrentTime?(): unknown;
        projectTimeValue(value: unknown): T | null;
        projectTimeRange(value: unknown): ClampRange<T> | null;
        projectCardinalAxis?(
            context: CardinalAxisProjectionContext
        ): CardinalAxisProjection<T> | null;
        readEventTime(event: object): CanonicalEventTime<T> | null;
        deriveDurations(
            event: object,
            context: DurationDerivationContext<T>
        ): RepriseDurations;
        render(
            template: unknown,
            event: object,
            context: RenderContextInput<T>
        ): RenderedContent;
    }

    interface RepriseRuntimeOptions<T = unknown> {
        unit?: TimelineUnit<T>;
        labeller?: TimelineLabeller<T> | null;
        durationPrecision?: ElapsedDurationPrecision;
        templateRenderer?: TemplateRenderer;
        readEventTime?: (
            this: RepriseRuntimeContract<T>,
            event: object
        ) => CanonicalEventTime<T> | null;
        readCurrentTime?: (
            this: RepriseRuntimeContract<T>
        ) => unknown;
        deriveDurations?: (
            this: RepriseRuntimeContract<T>,
            event: object,
            context: DurationDerivationContext<T>
        ) => RepriseDurations | null;
        projectTimeValue?: (
            this: RepriseRuntimeContract<T>,
            value: unknown
        ) => T | null;
        projectTimeRange?: (
            this: RepriseRuntimeContract<T>,
            value: unknown
        ) => ClampRange<T> | null;
        projectCardinalAxis?: (
            this: RepriseRuntimeContract<T>,
            context: CardinalAxisProjectionContext
        ) => CardinalAxisProjection<T> | null;
        render?: (
            this: RepriseRuntimeContract<T>,
            template: unknown,
            event: object,
            context: RenderContext<T>
        ) => RenderedContent;
    }

    class RepriseRuntime<T = unknown>
        implements RepriseRuntimeContract<T> {
        static readonly displayName: "RepriseRuntime";
        static readonly label: string;

        constructor(options?: RepriseRuntimeOptions<T>);

        readonly unit: TimelineUnit<T>;
        readonly labeller: TimelineLabeller<T>;
        readonly durationPrecision: ElapsedDurationPrecision;
        readonly templateRenderer: TemplateRenderer;
        readCurrentTime(): unknown;
        projectTimeValue(value: unknown): T | null;
        projectTimeRange(value: unknown): ClampRange<T> | null;
        projectCardinalAxis?(
            context: CardinalAxisProjectionContext
        ): CardinalAxisProjection<T> | null;
        readEventTime(event: object): CanonicalEventTime<T> | null;
        deriveDurations(
            event: object,
            context: DurationDerivationContext<T>
        ): RepriseDurations;
        render(
            template: unknown,
            event: object,
            context: RenderContextInput<T>
        ): RenderedContent;
    }
}
