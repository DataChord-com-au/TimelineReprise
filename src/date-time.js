const DATE_TIME_UNIT_NAMES = Object.freeze([
    "millisecond",
    "second",
    "minute",
    "hour",
    "day",
    "week",
    "month",
    "year",
    "decade",
    "century",
    "millennium"
]);

function resolveTimelineDateTimeUnit(unit, caller = "TimelineReprise.resolveTimelineDateTimeUnit") {
    const dateTime = globalThis.Timeline?.DateTime;

    if (dateTime == null) {
        throw new ReferenceError(`${caller} requires Timeline.DateTime.`);
    }

    const unitByName = {
        millisecond: dateTime.MILLISECOND,
        second: dateTime.SECOND,
        minute: dateTime.MINUTE,
        hour: dateTime.HOUR,
        day: dateTime.DAY,
        week: dateTime.WEEK,
        month: dateTime.MONTH,
        year: dateTime.YEAR,
        decade: dateTime.DECADE,
        century: dateTime.CENTURY,
        millennium: dateTime.MILLENNIUM
    };
    const normalized = String(unit ?? "day").trim().toLowerCase().replace(/s$/, "");
    const resolved = unitByName[normalized];

    if (resolved == null) {
        throw new RangeError(`${caller} unsupported timeline interval unit: ${unit}`);
    }

    return resolved;
}

export { DATE_TIME_UNIT_NAMES, resolveTimelineDateTimeUnit };
