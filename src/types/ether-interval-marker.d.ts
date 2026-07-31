declare namespace Timeline {
    /**
     * A CSS length, "label" for the rendered label extent, or null for native
     * SIMILE stylesheet sizing.
     */
    type EtherIntervalMarkerLength =
        | "label"
        | (string & {})
        | null;

    interface EtherIntervalMarkerTheme {
        show?: never;

        /**
         * Marker alignment for a horizontal timeline.
         */
        hAlign?: string;

        /**
         * Marker alignment for a vertical timeline.
         */
        vAlign?: string;

        /**
         * Cross-axis tick length for a horizontal timeline. A CSS length fixes
         * the tick height, "label" follows the rendered label height, and null
         * retains SIMILE's native stylesheet sizing. The label keeps its
         * natural size.
         */
        hLength?: EtherIntervalMarkerLength;

        /**
         * Cross-axis tick length for a vertical timeline. A CSS length fixes
         * the tick width, "label" follows the rendered label width, and null
         * retains SIMILE's native stylesheet sizing. Defaults to "2.5em"; the
         * label keeps its natural size.
         */
        vLength?: EtherIntervalMarkerLength;

        [key: string]: unknown;
    }

    interface EtherIntervalTheme {
        marker?: EtherIntervalMarkerTheme;
        line?: {
            show?: boolean;
            opacity?: number;
            [key: string]: unknown;
        };
        weekend?: {
            opacity?: number;
            [key: string]: unknown;
        };
        [key: string]: unknown;
    }

    interface EtherTheme {
        interval?: EtherIntervalTheme;
        [key: string]: unknown;
    }

    interface NativeTheme {
        ether?: EtherTheme;
    }
}
