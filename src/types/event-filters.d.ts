declare namespace Timeline {
    interface EventFilterOptions {
        tagsContain?: readonly string[];
        tagsNotContain?: readonly string[];
        tagsNotOnlyContain?: readonly string[];
    }

    function filterEvents<
        T extends { readonly tags?: readonly string[] }
    >(
        events: readonly T[],
        options?: EventFilterOptions
    ): T[];
}
