declare namespace Timeline {
    type TimelineOrientation = "horizontal" | "vertical";
    type TimelineOrientationValue = typeof HORIZONTAL | typeof VERTICAL;

    const HORIZONTAL: 0;
    const VERTICAL: 1;
    const TIMELINE_ORIENTATIONS: readonly TimelineOrientation[];

    function assertTimelineOrientation(
        value: unknown,
        caller?: string
    ): asserts value is TimelineOrientation;
    function normalizeTimelineOrientation(
        value: unknown,
        caller?: string
    ): TimelineOrientation;
}
