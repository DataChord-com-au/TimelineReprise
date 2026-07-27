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
        overviewColor?: string;
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
        eventTheme?: EventThemeSelection;
        runtime?: RepriseRuntimeContract<T>;
    }

    function attachEvents<T = unknown>(
        bandInfo: EventBandInfo<T>,
        events?: readonly EventData<T>[],
        options?: AttachmentOptions<T>
    ): void;

    function attachNarrativeDecorators<T = unknown>(
        bandInfo: BandInfo<T>,
        events?: readonly EventData<T>[],
        options?: AttachmentOptions<T>
    ): void;
}
