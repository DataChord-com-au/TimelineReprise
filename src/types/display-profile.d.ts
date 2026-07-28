declare namespace Timeline {
    type DisplayTemplateSpec =
        | string
        | Readonly<{
            instant?: string;
            range?: string;
        }>;

    interface LabelDisplayFields {
        title?: DisplayTemplateSpec;
        caption?: DisplayTemplateSpec;
    }

    interface BubbleDisplayFields {
        image?: DisplayTemplateSpec;
        title?: DisplayTemplateSpec;
        link?: DisplayTemplateSpec;
        bubbleByline?: DisplayTemplateSpec;
        bubbleStart?: DisplayTemplateSpec;
        bubbleLatestStart?: DisplayTemplateSpec;
        bubbleEarliestEnd?: DisplayTemplateSpec;
        bubbleEnd?: DisplayTemplateSpec;
        bubbleDuration?: DisplayTemplateSpec;
        bubbleMinimumDuration?: DisplayTemplateSpec;
        bubbleElapsed?: DisplayTemplateSpec;
        bubbleRemaining?: DisplayTemplateSpec;
        bubbleLocation?: DisplayTemplateSpec;
        bubblePeople?: DisplayTemplateSpec;
        bubbleTags?: DisplayTemplateSpec;
        description?: DisplayTemplateSpec;
    }

    interface DisplayProfileConfig {
        id: string;
        label?: LabelDisplayFields;
        bubble?: BubbleDisplayFields;
    }

    interface DisplayProfileOptions {
        templateRenderer?: TemplateRenderer;
    }

    class DisplayProfile {
        static readonly displayName: "DisplayProfile";
        static readonly label: string;

        constructor(
            config: DisplayProfileConfig,
            options?: DisplayProfileOptions
        );

        readonly id: string;
        readonly templateRenderer: TemplateRenderer;
        readonly label: Readonly<LabelDisplayFields>;
        readonly bubble: Readonly<BubbleDisplayFields>;
        resolveTemplate(
            field: string,
            context?: {
                surface?: string;
                eventTime?: CanonicalEventTime | null;
            }
        ): string | null;
        hasTemplate(
            field: string,
            context?: {
                surface?: string;
                eventTime?: CanonicalEventTime | null;
            }
        ): boolean;
    }

    type DisplayProfileSelection = string | DisplayProfile;
}
