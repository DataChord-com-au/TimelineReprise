declare namespace Timeline {
    function composeVisualTheme(
        nativeTheme: NativeTheme,
        explicit?: VisualThemeSelection | null
    ): VisualTheme;
    function resolveVisualTheme(
        explicit: VisualThemeSelection | null | undefined,
        nativeTheme?: NativeTheme | null
    ): VisualTheme;
    function loadVisualThemes(
        visualThemes?: readonly (VisualTheme | VisualThemeConfig)[] | null
    ): Readonly<Record<string, VisualTheme>>;
    function loadDisplayProfiles(
        displayProfiles?:
            | readonly (DisplayProfile | DisplayProfileConfig)[]
            | null,
        options?: DisplayProfileOptions
    ): Readonly<Record<string, DisplayProfile>>;
    function resolveDisplayProfile(
        explicit: DisplayProfileSelection | null | undefined
    ): DisplayProfile | null;
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
