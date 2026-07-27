declare namespace Timeline {
    function assertColorString(
        value: unknown,
        caller?: string
    ): asserts value is string;
    function normalizeColorString(
        value: unknown,
        caller?: string
    ): string;
}
