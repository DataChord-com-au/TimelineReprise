declare namespace Timeline {
    type EventColorScope = "none" | "label" | "graphic" | "both";
    type LabelColorSource = "graphic" | "theme" | "inherit";
    type LabelFlow = "normal" | "orthogonal";

    interface TrackSpec {
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

    interface InstantSpec {
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

    interface ShortRangeSpec {
        minDisplayLength?: number;
    }

    interface RangeSpec {
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

    interface LabelSpec {
        stickyInset?: number;
        stickyGap?: number;
        offset?: number;
        color?: string;
        colorSource?: LabelColorSource;
        flow?: LabelFlow;
    }

    interface OrientableLabelSpec extends LabelSpec {
        horizontal?: LabelSpec;
        vertical?: LabelSpec;
    }

    interface BubbleSpec {
        width?: number;
        maxHeight?: number | null;
    }

    interface LayerSpec {
        /** Z-index for Narrative span graphics. */
        zIndex?: number;

        /** Z-index for Narrative instant divider lines. */
        dividerZIndex?: number;

        /** Z-index for Narrative labels. */
        labelZIndex?: number;
    }

    interface VisualThemeConfig {
        id?: string;
        disableEmphasis?: boolean;
        eventColorScope?: EventColorScope;
        spans?: boolean;
        dividers?: boolean;
        labels?: boolean;
        bubbles?: boolean;
        tooltips?: boolean;
        track?: OrientableTrackSpec;
        instant?: OrientableInstantSpec;
        range?: OrientableRangeSpec;
        label?: OrientableLabelSpec;
        bubble?: BubbleSpec;
        layer?: LayerSpec;
        tagsToIconColor?: Readonly<Record<string, string>>;
        presentation?: DisplayProfileSelection | null;
    }

    class VisualTheme {
        static readonly displayName: "VisualTheme";
        static readonly label: string;

        constructor(config?: VisualThemeConfig);

        readonly id?: string;
        readonly disableEmphasis: boolean;
        readonly eventColorScope: EventColorScope;
        readonly spans: boolean;
        readonly dividers: boolean;
        readonly labels: boolean;
        readonly bubbles: boolean;
        readonly tooltips: boolean;
        readonly track: Readonly<OrientableTrackSpec>;
        readonly instant: Readonly<OrientableInstantSpec>;
        readonly range: Readonly<OrientableRangeSpec>;
        readonly label: Readonly<OrientableLabelSpec>;
        readonly bubble: Readonly<BubbleSpec>;
        readonly layer: Readonly<LayerSpec>;
        readonly tagsToIconColor: Readonly<Record<string, string>>;
        readonly presentation: DisplayProfileSelection | null;
    }

    type VisualThemeSelection = string | VisualTheme;

    const defaultVisualTheme: VisualTheme;

    function deriveVisualTheme(
        base: VisualTheme,
        overrides?: VisualThemeConfig
    ): VisualTheme;
}
