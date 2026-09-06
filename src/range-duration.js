const _RANGE_ELAPSED_UNITS = Object.freeze({
    millisecond: 1,
    second: 1000,
    minute: 60000,
    hour: 3600000,
    day: 86400000,
    week: 604800000
});
const _RANGE_YEAR_UNITS = Object.freeze({
    year: 1,
    decade: 10,
    century: 100,
    millennium: 1000,
    Ma: 1000000
});
const RANGE_DURATION_UNITS = Object.freeze([
    ...Object.keys(_RANGE_ELAPSED_UNITS),
    ...Object.keys(_RANGE_YEAR_UNITS),
    "unit"
]);

function resolveRangeMinDuration(unit, spec) {
    if (spec == null) return null;

    const [name, amount] = Object.entries(spec)[0];
    if (name === "unit") return amount;

    const timeline = globalThis.Timeline;
    let scale;
    if (unit != null && unit === timeline?.PlanningDayUnit) {
        scale = _RANGE_ELAPSED_UNITS[name] / _RANGE_ELAPSED_UNITS.day;
    } else if (unit != null && unit === timeline?.HistoricalYearUnit) {
        scale = _RANGE_YEAR_UNITS[name];
    } else if (unit != null && unit === timeline?.MaUnit) {
        scale = _RANGE_YEAR_UNITS[name] / _RANGE_YEAR_UNITS.Ma;
    } else if (unit != null && (
        unit === timeline?.NativeDateUnit ||
        unit === globalThis.SimileAjax?.NativeDateUnit
    )) {
        scale = _RANGE_ELAPSED_UNITS[name];
    }

    if (!Number.isFinite(scale)) {
        throw new TypeError(
            `range.minDuration.${name} is not supported by this timeline unit; ` +
            "use { unit: number } for a duration in the runtime's own units."
        );
    }
    const duration = amount * scale;
    if (!Number.isFinite(duration)) {
        throw new RangeError("range.minDuration must resolve to a finite duration.");
    }
    return duration;
}

export { RANGE_DURATION_UNITS, resolveRangeMinDuration };
