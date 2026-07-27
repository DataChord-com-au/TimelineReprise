declare namespace Timeline {
    interface NarrativeDecoratorOptions<T = unknown>
        extends AttachmentOptions<T> {
        ranges?: readonly EventData<T>[];
        instants?: readonly EventData<T>[];
    }

    class NarrativeDecorator<T = unknown> {
        constructor(options?: NarrativeDecoratorOptions<T>);
        initialize(
            band: Band<T>,
            timeline: TimelineInstance<T>
        ): void;
        paint(): void;
        softPaint(): void;
    }
}
