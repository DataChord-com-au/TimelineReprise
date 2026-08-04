declare namespace Timeline {
    type TemplateFormatter = (
        args: readonly unknown[],
        context: TemplateRenderContext
    ) => RenderedContent;

    interface TemplateRenderContext<T = unknown>
        extends Partial<RenderContext<T>> {
        resolveSelector?: (
            name: string,
            event: object,
            context: TemplateRenderContext<T>
        ) => RenderedContent;
        readonly [key: string]: unknown;
    }

    interface TemplateSelectorExtension {
        hasSelector(name: string): boolean;
        hasFormat(formatName: string, selectorName: string): boolean;
        resolveSelector(
            name: string,
            formatName: string | null,
            event: object,
            context: TemplateRenderContext
        ): RenderedContent;
    }

    interface TemplateRendererOptions {
        formatters?: Readonly<Record<string, TemplateFormatter>>;
        selectorExtensions?: readonly TemplateSelectorExtension[];
    }

    class TemplateRenderer {
        static readonly displayName: "TemplateRenderer";
        static readonly label: string;
        static readonly BUILTIN_FORMATTER: Readonly<{
            JOIN: "join";
            JOIN_UNIQUE: "joinUnique";
            WRAP: "wrap";
            PAREN: "paren";
            PREFIX: "prefix";
            SUFFIX: "suffix";
            LINES: "lines";
        }>;

        static validateTemplate(
            template: string,
            options?: TemplateRendererOptions
        ): void;

        constructor(options?: TemplateRendererOptions);

        readonly formatters: Map<string, TemplateFormatter>;
        readonly selectorExtensions: readonly TemplateSelectorExtension[];
        registerFormatter(name: string, formatter: TemplateFormatter): void;
        validateTemplate(
            template: string,
            options?: { caller?: string }
        ): void;
        render(
            template: string,
            event?: object,
            context?: TemplateRenderContext
        ): string;
    }
}
