declare namespace Timeline {
    interface EtherIntervalMarkerTheme {
        /**
         * Whether ether interval date markers are rendered. Defaults to true.
         */
        show?: boolean;

        /**
         * Marker alignment for a horizontal timeline.
         */
        hAlign?: string;

        /**
         * Marker alignment for a vertical timeline.
         */
        vAlign?: string;

        /**
         * Cross-axis marker length for a horizontal timeline. This is applied
         * as CSS height. Nullish values retain SIMILE's stylesheet sizing.
         */
        hLength?: string | null;

        /**
         * Cross-axis marker length for a vertical timeline. This is applied as
         * CSS width and defaults to "2.5em".
         */
        vLength?: string | null;

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
