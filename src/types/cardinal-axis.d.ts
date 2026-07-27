declare namespace Timeline {
    interface CardinalAxisOptions {
        theme: NativeTheme;
        startDate: Date;
        endDate?: Date | null;
        unit: number;
        multiple?: number;
        startLabel?: string;
        endLabel?: string;
        labelForIndex?: (index: number) => string;
        background?: boolean;
        cssClass?: string;
        align?: string;
        showLine?: boolean;
    }

    class CardinalAxis {
        constructor(options: CardinalAxisOptions);
        initialize(
            band: Band<Date>,
            timeline: TimelineInstance<Date>
        ): void;
        setHighlight(startDate: Date, endDate: Date): void;
        paint(): void;
        softPaint(): void;
    }
}
