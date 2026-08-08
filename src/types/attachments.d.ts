declare namespace Timeline {
    interface EventData<T = unknown> {
        id?: string | number;
        date?: unknown;
        start?: unknown;
        end?: unknown;
        startDate?: unknown;
        endDate?: unknown;
        latestStart?: unknown;
        earliestEnd?: unknown;
        eventTime?: CanonicalEventTime<T>;
        instant?: boolean;
        title?: RenderedContent;
        caption?: RenderedContent;
        description?: RenderedContent;
        tags?: readonly string[];
        duration?: RenderedContent;
        minimumDuration?: RenderedContent;
        bubbleDuration?: RenderedContent;
        bubbleMinimumDuration?: RenderedContent;
        track?: number | string;
        trackExplicit?: boolean;
        labels?: boolean;
        bubbles?: boolean;
        eventColorScope?: EventColorScope;
        emphasis?: string;
        color?: string;
        textColor?: string;
        labelColor?: string;
        iconColor?: string;
        tapeColor?: string;
        spanColor?: string;
        lineColor?: string;
        lineWidth?: number;
        cssClass?: string;
        labelCssClass?: string;
        [key: string]: unknown;
    }

    class DefaultEventSource implements EventSource {
        constructor(eventIndex?: unknown);
        addMany(events: readonly object[]): void;
    }

    interface AttachmentOptions<T = unknown> {
        visualTheme?: VisualThemeSelection | null;
        runtime?: RepriseRuntimeContract<T> | null;
        disableEmphasis?: boolean;
        spans?: boolean;
        dividers?: boolean;
        labels?: boolean;
        bubbles?: boolean;
        tooltips?: boolean;
    }

    function attachEvents<T = unknown>(
        bandInfo: EventBandInfo<T>,
        events?: readonly object[],
        options?: AttachmentOptions<T> | null
    ): void;

    function attachEvents<T = unknown>(
        bandInfos: readonly EventBandInfo<T>[],
        events?: readonly object[],
        options?: AttachmentOptions<T> | null
    ): void;

    function attachNarrativeDecorators<T = unknown>(
        bandInfo: BandInfo<T>,
        events?: readonly object[],
        options?: AttachmentOptions<T> | null
    ): void;
}
