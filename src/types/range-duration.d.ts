declare namespace Timeline {
    type RangeDurationUnit =
        | "millisecond" | "second" | "minute" | "hour" | "day" | "week"
        | "year" | "decade" | "century" | "millennium" | "Ma" | "unit";

    /** Exactly one positive duration, e.g. { day: 1 } or { minute: 15 }. */
    type RangeDurationSpec = Partial<Record<RangeDurationUnit, number>>;
}
