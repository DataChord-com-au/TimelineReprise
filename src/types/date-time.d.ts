declare namespace Timeline {
    type DateTimeUnitName =
        | "millisecond"
        | "second"
        | "minute"
        | "hour"
        | "day"
        | "week"
        | "month"
        | "year"
        | "decade"
        | "century"
        | "millennium";

    namespace DateTime {
        const MILLISECOND: number;
        const SECOND: number;
        const MINUTE: number;
        const HOUR: number;
        const DAY: number;
        const WEEK: number;
        const MONTH: number;
        const YEAR: number;
        const DECADE: number;
        const CENTURY: number;
        const MILLENNIUM: number;
    }

    interface TimelineLabeller<T = unknown> {
        labelPrecise(value: T): unknown;
        labelInterval(value: T, intervalUnit?: number): unknown;
    }

    interface TimelineUnit<T = unknown> {
        parseFromObject(value: unknown): T | null;
        compare(left: T, right: T): number;
        createLabeller?(
            locale: string,
            timeZone: number
        ): TimelineLabeller<T>;
    }

    const NativeDateUnit: TimelineUnit<Date>;
    const DATE_TIME_UNIT_NAMES: readonly DateTimeUnitName[];

    function resolveTimelineDateTimeUnit(
        unit?: unknown,
        caller?: string
    ): number;
}
