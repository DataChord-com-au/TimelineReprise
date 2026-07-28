declare namespace Timeline {
    interface DurationLabeller {
        labelDuration(value: number): unknown;
    }

    interface DurationUnit<T = unknown> {
        duration(start: T, end: T): number | null;
    }

    class PlanningDayLabeller
        implements TimelineLabeller<number>, DurationLabeller {
        labelPrecise(value: number): string;
        labelInterval(
            value: number,
            intervalUnit?: number
        ): { text: string; emphasized: boolean };
        labelDuration(value: number): string;
    }

    interface PlanningDayUnitContract
        extends TimelineUnit<number>, DurationUnit<number> {
        getParser(): (value: unknown) => number | null;
        makeDefaultValue(): number;
        cloneValue(value: number): number;
        toNumber(value: number): number;
        fromNumber(value: number): number;
        earlier(left: number, right: number): number;
        later(left: number, right: number): number;
        change(value: number, delta: number): number;
        createLabeller(
            locale?: string,
            timeZone?: number
        ): PlanningDayLabeller;
    }

    const PlanningDayUnit: PlanningDayUnitContract;

    class HistoricalYear {
        constructor(value: number | string);
        readonly value: number;
        valueOf(): number;
        toString(): string;
    }

    class HistoricalYearLabeller
        implements TimelineLabeller<HistoricalYear>, DurationLabeller {
        labelPrecise(value: HistoricalYear): string;
        labelInterval(
            value: HistoricalYear,
            intervalUnit?: number
        ): { text: string; emphasized: boolean };
        labelDuration(value: number): string;
    }

    interface HistoricalYearUnitContract
        extends TimelineUnit<HistoricalYear>, DurationUnit<HistoricalYear> {
        readonly HistoricalYear: typeof HistoricalYear;
        getParser(): (value: unknown) => HistoricalYear | null;
        makeDefaultValue(): HistoricalYear;
        cloneValue(value: HistoricalYear): HistoricalYear;
        toNumber(value: HistoricalYear): number;
        fromNumber(value: number): HistoricalYear;
        earlier(
            left: HistoricalYear,
            right: HistoricalYear
        ): HistoricalYear;
        later(
            left: HistoricalYear,
            right: HistoricalYear
        ): HistoricalYear;
        change(value: HistoricalYear, delta: number): HistoricalYear;
        createLabeller(
            locale?: string,
            timeZone?: number
        ): HistoricalYearLabeller;
    }

    const HistoricalYearUnit: HistoricalYearUnitContract;

    class Ma {
        constructor(value: number | string);
        value: number;
        valueOf(): number;
        toString(): string;
    }

    class MaLabeller implements TimelineLabeller<Ma>, DurationLabeller {
        labelPrecise(value: Ma): string;
        labelInterval(
            value: Ma,
            intervalUnit?: number
        ): { text: string; emphasized: boolean };
        labelDuration(value: number): string;
    }

    interface MaUnitContract extends TimelineUnit<Ma>, DurationUnit<Ma> {
        readonly Ma: typeof Ma;
        getParser(): (value: unknown) => Ma | null;
        makeDefaultValue(): Ma;
        cloneValue(value: Ma): Ma;
        toNumber(value: Ma): number;
        fromNumber(value: number): Ma;
        earlier(left: Ma, right: Ma): Ma;
        later(left: Ma, right: Ma): Ma;
        change(value: Ma, delta: number): Ma;
        createLabeller(locale?: string, timeZone?: number): MaLabeller;
    }

    const MaUnit: MaUnitContract;
}
