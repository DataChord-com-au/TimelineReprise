declare namespace Timeline {
    interface EmptyEtherPainterOptions {
        backgroundColor?: string | null;
    }

    class EmptyEtherPainter<T = unknown> {
        constructor(options?: EmptyEtherPainterOptions);
        initialize(
            band: Band<T>,
            timeline: TimelineInstance<T>
        ): void;
        setHighlight(): void;
        paint(): void;
        softPaint(): void;
    }

    interface ThemeIconRegistry {
        readonly colorAliases: Readonly<Record<string, string>>;
        normalizeColor(color: unknown): string;
        getCssColor(color: unknown): string | null;
        get(color: unknown, size?: number): string | null;
    }

    const ThemeIcons: ThemeIconRegistry;
}
