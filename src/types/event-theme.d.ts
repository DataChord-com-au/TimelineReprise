declare namespace Timeline {
    type EventColorScope = "none" | "label" | "graphic" | "both";
    type LabelColorSource = "graphic" | "theme" | "inherit";

    interface PresentationFieldSpec {
        template?: unknown;
        templateId?: string;
    }

    type PresentationMap = Readonly<
        Record<string, PresentationFieldSpec | unknown>
    >;

    interface PresentationCarrier {
        presentation?: PresentationMap;
        template?: unknown;
        templateId?: string;
        templates?: Readonly<Record<string, unknown>>;
    }

    interface TrackSpec extends PresentationCarrier {
        count?: number;
        offset?: number;
        endPadding?: number;
        size?: number;
        gap?: number;
        align?: "start" | "end";
    }

    interface OrientableTrackSpec extends TrackSpec {
        horizontal?: TrackSpec;
        vertical?: TrackSpec;
    }

    interface InstantSpec extends PresentationCarrier {
        iconColor?: string;
        width?: number;
        height?: number;
        tickWidth?: number;
        lineWidth?: number;
        toLabelGap?: number;
        cssClass?: string;
        labelCssClass?: string;
    }

    interface OrientableInstantSpec extends InstantSpec {
        horizontal?: InstantSpec;
        vertical?: InstantSpec;
    }

    interface ShortRangeSpec extends PresentationCarrier {
        minDisplayLength?: number;
    }

    interface RangeSpec extends PresentationCarrier {
        iconColor?: string;
        colors?: readonly string[];
        width?: number;
        offset?: number;
        size?: number;
        eventRoutingThreshold?: number;
        tapeGap?: number;
        toLabelGap?: number;
        minLabelGap?: number;
        labelRoutingGap?: number;
        labelTrackGap?: number;
        labelWidth?: number;
        sparklineStagger?: number;
        stickyLeftInset?: number;
        stickyTopInset?: number;
        toEventGap?: number;
        cssClass?: string;
        labelCssClass?: string;
        short?: ShortRangeSpec;
    }

    interface OrientableRangeSpec extends RangeSpec {
        horizontal?: RangeSpec;
        vertical?: RangeSpec;
    }

    interface LabelSpec extends PresentationCarrier {
        stickyInset?: number;
        stickyGap?: number;
        offset?: number;
        color?: string;
        colorSource?: LabelColorSource;
    }

    interface OrientableLabelSpec extends LabelSpec {
        horizontal?: LabelSpec;
        vertical?: LabelSpec;
    }

    interface BubbleSpec extends PresentationCarrier {
        width?: number;
        maxHeight?: number | null;
    }

    interface LayerSpec extends PresentationCarrier {
        zIndex?: number;
        labelZIndex?: number;
    }

    interface EventThemeConfig extends PresentationCarrier {
        id?: string;
        disableEmphasis?: boolean;
        eventColorScope?: EventColorScope;
        spans?: boolean;
        dividers?: boolean;
        labels?: boolean;
        bubbles?: boolean;
        track?: OrientableTrackSpec;
        instant?: OrientableInstantSpec;
        range?: OrientableRangeSpec;
        label?: OrientableLabelSpec;
        bubble?: BubbleSpec;
        layer?: LayerSpec;
        tagsToIconColor?: Readonly<Record<string, string>>;
    }

    class EventTheme {
        static readonly displayName: "EventTheme";
        static readonly label: string;

        constructor(config?: EventThemeConfig);

        readonly id?: string;
        readonly disableEmphasis: boolean;
        readonly eventColorScope: EventColorScope;
        readonly spans: boolean;
        readonly dividers: boolean;
        readonly labels: boolean;
        readonly bubbles: boolean;
        readonly track: Readonly<OrientableTrackSpec>;
        readonly instant: Readonly<OrientableInstantSpec>;
        readonly range: Readonly<OrientableRangeSpec>;
        readonly label: Readonly<OrientableLabelSpec>;
        readonly bubble: Readonly<BubbleSpec>;
        readonly layer: Readonly<LayerSpec>;
        readonly tagsToIconColor: Readonly<Record<string, string>>;
        readonly presentation: PresentationMap;
        readonly template?: unknown;
        readonly templateId?: string;
        readonly templates: Readonly<Record<string, unknown>>;
    }

    type EventThemeSelection = string | EventTheme;

    const defaultEventTheme: EventTheme;

    function deriveEventTheme(
        base: EventTheme,
        overrides?: EventThemeConfig
    ): EventTheme;
}
