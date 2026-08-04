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

    interface RepriseDuration {
        readonly value: number;
        readonly text: string;
    }

    type CardinalAxisAnchor = "start" | "end";
    type CardinalAxisFinishing = "extend" | "truncate" | "drop";

    interface CardinalAxisProjectionContext {
        readonly range: unknown;
        readonly intervalUnit: DateTimeUnitName | number;
        readonly resolvedIntervalUnit: number;
        readonly unitsPerCount: number;
        readonly countsPerMarker: number;
        readonly anchor: CardinalAxisAnchor;
        readonly finishing: CardinalAxisFinishing;
        readonly truncatePreviousMarkerThreshold: number;
    }

    interface CardinalAxisIndexContext<T = unknown> {
        readonly previousMarker: T;
        readonly nextMarker: T;
        readonly previousIndex: number;
        readonly nextIndex: number;
        readonly anchor: CardinalAxisAnchor;
        readonly finishing: CardinalAxisFinishing;
    }

    interface CardinalAxisProjection<T = unknown> {
        readonly range: ClampRange<T>;
        markerAtIndex(index: number): T | null;
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
        readonly currentTime?: T;
        readonly durationPrecision: ElapsedDurationPrecision;
        readonly duration?: RepriseDuration;
        readonly minimumDuration?: RepriseDuration;
        readonly elapsed?: RepriseDuration;
        readonly remaining?: RepriseDuration;
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
        currentTime?: T | null;
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
        readCurrentTime?(): T | null;
        projectTimeValue(value: unknown): T | null;
        projectTimeRange(value: unknown): ClampRange<T> | null;
        projectCardinalAxis?(
            context: CardinalAxisProjectionContext
        ): CardinalAxisProjection<T> | null;
        readEventTime(event: object): CanonicalEventTime<T> | null;
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
        ) => T | null;
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
        readCurrentTime(): T | null;
        projectTimeValue(value: unknown): T | null;
        projectTimeRange(value: unknown): ClampRange<T> | null;
        projectCardinalAxis?(
            context: CardinalAxisProjectionContext
        ): CardinalAxisProjection<T> | null;
        readEventTime(event: object): CanonicalEventTime<T> | null;
        render(
            template: unknown,
            event: object,
            context: RenderContextInput<T>
        ): RenderedContent;
    }
}
