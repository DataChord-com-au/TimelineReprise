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

    interface RenderContext<T = unknown> {
        readonly field: string;
        readonly target: RenderTarget;
        readonly eventTime: CanonicalEventTime<T> | null;
        readonly eventTheme: EventTheme;
        readonly unit: TimelineUnit<T>;
        readonly labeller: TimelineLabeller<T>;
        readonly duration?: RepriseDuration;
        readonly minimumDuration?: RepriseDuration;
        readonly intervalUnit?: number;
        readonly surface?: string;
        readonly [key: string]: unknown;
    }

    interface RenderContextInput<T = unknown> {
        field: string;
        target?: RenderTarget;
        eventTime?: CanonicalEventTime<T> | null;
        eventTheme?: EventTheme;
        intervalUnit?: number;
        surface?: string;
        [key: string]: unknown;
    }

    interface RepriseRuntimeContract<T = unknown> {
        readonly unit: TimelineUnit<T>;
        readonly labeller: TimelineLabeller<T>;
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
        readEventTime?: (
            this: RepriseRuntimeContract<T>,
            event: object
        ) => CanonicalEventTime<T> | null;
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
        readEventTime(event: object): CanonicalEventTime<T> | null;
        render(
            template: unknown,
            event: object,
            context: RenderContextInput<T>
        ): RenderedContent;
    }
}
