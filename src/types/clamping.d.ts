declare namespace Timeline {
    interface ClampRange<TInput = unknown> {
        start?: TInput | null;
        end?: TInput | null;
    }

    interface ClampController {
        readonly disposed: boolean;
        dispose(): void;
    }

    function clampBandChains<T = unknown>(
        timeline: TimelineInstance<T>,
        range: ClampRange
    ): ClampController;
}
