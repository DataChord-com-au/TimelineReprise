declare namespace Timeline {
    interface EmphasisStyleConfig {
        id?: string;
        labels?: boolean;
        bubbles?: boolean;
        color?: string;
        iconColor?: string;
        labelColor?: string;
        spanColor?: string;
        lineColor?: string;
        lineWidth?: number;
    }

    class EmphasisStyle {
        static readonly displayName: "EmphasisStyle";
        static readonly label: string;

        constructor(config?: EmphasisStyleConfig);

        readonly id?: string;
        readonly labels?: boolean;
        readonly bubbles?: boolean;
        readonly color?: string;
        readonly iconColor?: string;
        readonly labelColor?: string;
        readonly spanColor?: string;
        readonly lineColor?: string;
        readonly lineWidth?: number;
    }
}
