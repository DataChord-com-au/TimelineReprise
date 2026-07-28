const _TEMPLATE_RENDERER_LABEL = "TimelineReprise.TemplateRenderer";

const _BUILTIN_FORMATTERS = Object.freeze({
    JOIN: "join",
    JOIN_UNIQUE: "joinUnique",
    WRAP: "wrap",
    PAREN: "paren",
    PREFIX: "prefix",
    SUFFIX: "suffix",
    LINES: "lines"
});

function _isObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
}

function _assertSelectorExtension(extension, caller, index) {
    const path = `${caller}.selectorExtensions[${index}]`;

    if (!_isObject(extension)) {
        throw new TypeError(`${path} must be an object.`);
    }
    if (typeof extension.hasSelector !== "function") {
        throw new TypeError(`${path}.hasSelector must be a function.`);
    }
    if (typeof extension.hasFormat !== "function") {
        throw new TypeError(`${path}.hasFormat must be a function.`);
    }
    if (typeof extension.resolveSelector !== "function") {
        throw new TypeError(`${path}.resolveSelector must be a function.`);
    }
}

class TemplateRenderer {
    static get displayName() { return "TemplateRenderer"; }
    static get label() { return _TEMPLATE_RENDERER_LABEL; }
    static get BUILTIN_FORMATTER() { return _BUILTIN_FORMATTERS; }

    static validateTemplate(template, options = {}) {
        new this(options).validateTemplate(template);
    }

    constructor({ formatters = {}, selectorExtensions = [] } = {}) {
        const caller = `${this.constructor.label}.ctor`;

        if (!_isObject(formatters)) {
            throw new TypeError(`${caller}.formatters must be an object.`);
        }
        if (!Array.isArray(selectorExtensions)) {
            throw new TypeError(`${caller}.selectorExtensions must be an array.`);
        }

        selectorExtensions.forEach((extension, index) =>
            _assertSelectorExtension(extension, caller, index)
        );

        this.formatters = new Map();
        this.selectorExtensions = Object.freeze([...selectorExtensions]);

        const BF = this.constructor.BUILTIN_FORMATTER;
        this.registerFormatter(BF.JOIN, this._join);
        this.registerFormatter(BF.JOIN_UNIQUE, this._joinUnique);
        this.registerFormatter(BF.WRAP, this._wrap);
        this.registerFormatter(BF.PAREN, this._paren);
        this.registerFormatter(BF.PREFIX, this._prefix);
        this.registerFormatter(BF.SUFFIX, this._suffix);
        this.registerFormatter(BF.LINES, this._lines);

        for (const [name, formatter] of Object.entries(formatters)) {
            this.registerFormatter(name, formatter);
        }
    }

    registerFormatter(name, formatter) {
        const caller = `${this.constructor.label}.registerFormatter`;

        if (typeof name !== "string" || name.trim() === "") {
            throw new TypeError(`${caller} name must be a non-empty string.`);
        }
        if (typeof formatter !== "function") {
            throw new TypeError(`${caller} '${name}' must be a function.`);
        }

        this.formatters.set(name.trim(), formatter);
    }

    validateTemplate(
        template,
        { caller = `${this.constructor.label}.validateTemplate` } = {}
    ) {
        if (typeof template !== "string") {
            throw new TypeError(`${caller} must be a string template.`);
        }

        for (const expression of this._readExpressions(template, caller)) {
            this._validateExpression(expression, caller);
        }
    }

    render(template, event = {}, context = {}) {
        const caller = `${this.constructor.label}.render`;
        if (typeof template !== "string") {
            throw new TypeError(`${caller} template must be a string.`);
        }

        this.validateTemplate(template, { caller });

        return template.replace(/\{([^{}]+)\}/g, (_match, expression) => {
            const value = this._evaluate(expression.trim(), event, context);
            return value == null ? "" : String(value);
        });
    }

    _readExpressions(template, caller) {
        const expressions = [];
        let start = -1;

        for (let index = 0; index < template.length; index += 1) {
            const character = template[index];
            if (character === "{") {
                if (start >= 0) {
                    throw new SyntaxError(`${caller} contains a nested '{'.`);
                }
                start = index + 1;
            } else if (character === "}") {
                if (start < 0) {
                    throw new SyntaxError(`${caller} contains an unmatched '}'.`);
                }
                const expression = template.slice(start, index).trim();
                if (expression === "") {
                    throw new SyntaxError(`${caller} contains an empty expression.`);
                }
                expressions.push(expression);
                start = -1;
            }
        }

        if (start >= 0) {
            throw new SyntaxError(`${caller} contains an unmatched '{'.`);
        }

        return expressions;
    }

    _validateExpression(expression, caller) {
        if (this._isStringLiteral(expression)) return;

        const call = this._parseFormatterCall(expression, caller);
        if (call != null) {
            if (!this.formatters.has(call.name)) {
                throw new RangeError(`${caller} unknown formatter: ${call.name}.`);
            }
            call.args.forEach(argument =>
                this._validateExpression(argument, caller)
            );
            return;
        }

        const { name, formatName } = this._parseSelector(expression, caller);
        if (formatName == null) return;

        const extension = this._findSelectorExtension(name);
        if (
            extension == null ||
            !extension.hasFormat(formatName, name)
        ) {
            throw new RangeError(
                `${caller} unknown format '${formatName}' for selector '${name}'.`
            );
        }
    }

    _evaluate(expression, event, context) {
        if (this._isStringLiteral(expression)) {
            return this._parseStringLiteral(expression);
        }

        const call = this._parseFormatterCall(
            expression,
            `${this.constructor.label}.render`
        );
        if (call != null) {
            const formatter = this.formatters.get(call.name);
            const args = call.args.map(argument =>
                this._evaluate(argument, event, context)
            );
            return formatter.call(this, args, context);
        }

        const { name, formatName } = this._parseSelector(
            expression,
            `${this.constructor.label}.render`
        );
        const extension = this._findSelectorExtension(name);
        if (extension != null) {
            return extension.resolveSelector(
                name,
                formatName,
                event,
                context
            );
        }

        if (typeof context.resolveSelector === "function") {
            return context.resolveSelector(name, event, context);
        }

        return event?.[name] ?? null;
    }

    _parseFormatterCall(expression, caller) {
        const open = expression.indexOf("(");
        if (open < 0) return null;
        if (open === 0 || !expression.endsWith(")")) {
            throw new SyntaxError(`${caller} invalid formatter expression: ${expression}.`);
        }

        const name = expression.slice(0, open).trim();
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
            throw new SyntaxError(`${caller} invalid formatter name: ${name}.`);
        }

        return {
            name,
            args: this._splitArguments(
                expression.slice(open + 1, -1),
                caller
            )
        };
    }

    _splitArguments(text, caller) {
        const args = [];
        let current = "";
        let depth = 0;
        let inString = false;
        let escaped = false;

        for (const character of text) {
            if (escaped) {
                current += character;
                escaped = false;
                continue;
            }
            if (character === "\\") {
                current += character;
                escaped = true;
                continue;
            }
            if (character === "'") {
                current += character;
                inString = !inString;
                continue;
            }
            if (!inString) {
                if (character === "(") depth += 1;
                if (character === ")") depth -= 1;
                if (depth < 0) {
                    throw new SyntaxError(`${caller} has unbalanced parentheses.`);
                }
                if (character === "," && depth === 0) {
                    if (current.trim() === "") {
                        throw new SyntaxError(`${caller} contains an empty argument.`);
                    }
                    args.push(current.trim());
                    current = "";
                    continue;
                }
            }

            current += character;
        }

        if (escaped || inString || depth !== 0) {
            throw new SyntaxError(`${caller} contains an unterminated expression.`);
        }
        if (current.trim() !== "") {
            args.push(current.trim());
        } else if (args.length > 0) {
            throw new SyntaxError(`${caller} contains an empty argument.`);
        }

        return args;
    }

    _parseSelector(expression, caller) {
        const parts = expression.split(":");
        if (parts.length > 2) {
            throw new SyntaxError(`${caller} invalid selector: ${expression}.`);
        }

        const name = parts[0].trim();
        const formatName = parts.length === 2 ? parts[1].trim() : null;
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
            throw new SyntaxError(`${caller} invalid selector: ${name}.`);
        }
        if (
            formatName != null &&
            !/^[A-Za-z][A-Za-z0-9_-]*$/.test(formatName)
        ) {
            throw new SyntaxError(`${caller} invalid format name: ${formatName}.`);
        }

        return { name, formatName };
    }

    _findSelectorExtension(name) {
        return this.selectorExtensions.find(extension =>
            extension.hasSelector(name)
        ) ?? null;
    }

    _isStringLiteral(expression) {
        return (
            expression.length >= 2 &&
            expression[0] === "'" &&
            expression.at(-1) === "'"
        );
    }

    _parseStringLiteral(expression) {
        return expression.slice(1, -1)
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, "\\");
    }

    _join(args) {
        const [separator = "", ...values] = args;
        return values
            .filter(value => value != null && String(value) !== "")
            .join(String(separator));
    }

    _joinUnique(args) {
        const [separator = "", ...values] = args;
        return this._join([separator, ...new Set(
            values.filter(value => value != null && String(value) !== "")
                .map(String)
        )]);
    }

    _wrap(args) {
        const [left = "", value, right = ""] = args;
        if (value == null || String(value) === "") return "";
        return `${String(left)}${String(value)}${String(right)}`;
    }

    _paren(args) {
        return this._wrap(["(", args[0], ")"]);
    }

    _prefix(args) {
        return this._wrap([args[0] ?? "", args[1], ""]);
    }

    _suffix(args) {
        return this._wrap(["", args[0], args[1] ?? ""]);
    }

    _lines(args, context) {
        return this._join([
            context?.target === "html" ? "<br>" : "\n",
            ...args
        ]);
    }
}

export { TemplateRenderer };
