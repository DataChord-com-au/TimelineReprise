declare namespace Timeline {
    type EventColorScope = "none" | "label" | "graphic" | "both";
    type LabelColorSource = "graphic" | "theme" | "inherit";
    type LabelFlow = "normal" | "orthogonal";
    type RangeLabelAlign = "start" | "center";
    type RangeGraphic = "span" | "start" | "end" | "both" | "none";

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
        cssClass?: string;
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
        graphic?: RangeGraphic;
        width?: number;
        lineWidth?: number;
        offset?: number;
        size?: number;
        eventRoutingThreshold?: number;
        tapeGap?: number;
        sparklineStagger?: number;
        toEventGap?: number;
        cssClass?: string;
        short?: ShortRangeSpec;
    }

    interface OrientableRangeSpec extends RangeSpec {
        horizontal?: RangeSpec;
        vertical?: RangeSpec;
    }

    interface LabelSpec {
        stickyInset?: number;
        offset?: number;
        toRangeGap?: number;
        toInstantGap?: number;
        toRangeBlockGap?: number;
        routingGap?: number;
        trackGap?: number;
        width?: number;
        length?: number | null;
        rangeCssClass?: string;
        instantCssClass?: string;
        color?: string;
        colorSource?: LabelColorSource;
        flow?: LabelFlow;
        rangeAlign?: RangeLabelAlign;
    }

    interface OrientableLabelSpec extends LabelSpec {
        horizontal?: LabelSpec;
        vertical?: LabelSpec;
    }

    interface BubbleSpec {
        width?: number;
        maxHeight?: number | null;
    }

    interface TooltipSpec {
        maxWidth?: number;
    }

    interface LayerSpec {
        /** Z-index for Narrative range graphics. */
        zIndex?: number;

        /** Z-index for Narrative instant divider lines. */
        dividerZIndex?: number;

        /** Z-index for Narrative labels. */
        labelZIndex?: number;
    }

    interface VisualThemeConfig {
        id?: string;
        backgroundColor?: string | null;
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
        tooltip?: TooltipSpec;
        layer?: LayerSpec;
        tagsToIconColor?: Readonly<Record<string, string>>;
        presentation?: DisplayProfileSelection | null;
    }

    class VisualTheme {
        static readonly displayName: "VisualTheme";
        static readonly label: string;

        constructor(config?: VisualThemeConfig);

        readonly id?: string;
        readonly backgroundColor: string | null;
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
        readonly tooltip: Readonly<TooltipSpec>;
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
