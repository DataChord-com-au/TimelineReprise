declare namespace Timeline {
    function composeEventTheme(
        nativeTheme: NativeTheme,
        explicit?: EventThemeSelection | null
    ): EventTheme;
    function resolveEventTheme(
        explicit: EventThemeSelection | null | undefined,
        nativeTheme?: NativeTheme | null
    ): EventTheme;
    function loadEventThemes(
        eventThemes?: readonly (EventTheme | EventThemeConfig)[] | null
    ): Readonly<Record<string, EventTheme>>;
    function loadEmphasisStyles(
        emphasisStyles?: readonly EmphasisStyleConfig[] | null
    ): Readonly<Record<string, EmphasisStyle>>;

    function keyItemsById<T extends { readonly id: string }>(
        items: readonly T[],
        caller?: string
    ): Readonly<Record<string, T>>;
    function selectItemsById<T extends { readonly id: string }>(
        specs: readonly T[],
        selection?: string | readonly string[] | null,
        caller?: string
    ): Readonly<Record<string, T>>;
    function validateSpecId(
        id: unknown,
        caller?: string,
        path?: string
    ): string;
}
