function assertColorString(value, caller) {
    if (typeof value !== "string" || value.trim() === "") {
        throw new TypeError(`${caller} must be a non-empty CSS color string.`);
    }
}

function normalizeColorString(value, caller) {
    assertColorString(value, caller);
    return value.trim();
}

function _parseGraphicColorChannels(color) {
    const source = String(color ?? "").trim();
    const rgb = source.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (rgb) {
        return [
            Number(rgb[1]) / 255,
            Number(rgb[2]) / 255,
            Number(rgb[3]) / 255
        ];
    }

    const hex = source.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (!hex) return null;

    const value = hex[1];
    const full = value.length === 3
        ? value.split("").map(part => part + part).join("")
        : value.slice(0, 6);

    return [
        parseInt(full.slice(0, 2), 16) / 255,
        parseInt(full.slice(2, 4), 16) / 255,
        parseInt(full.slice(4, 6), 16) / 255
    ];
}

function deriveGraphicLabelColor(color) {
    const channels = _parseGraphicColorChannels(color);
    if (!channels) return color ?? null;

    const [r, g, b] = channels;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const light = (max + min) / 2;

    if (max === min) {
        return light > 0.55 ? "hsl(0, 0%, 28%)" : "hsl(0, 0%, 72%)";
    }

    const delta = max - min;
    const sat = light > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    let hue = max === r
        ? (g - b) / delta + (g < b ? 6 : 0)
        : max === g
            ? (b - r) / delta + 2
            : (r - g) / delta + 4;

    hue *= 60;
    const yellowish = hue >= 35 && hue <= 75;
    const lightSat = yellowish
        ? Math.max(sat * 0.72, 0.46)
        : Math.max(sat * 0.55, 0.34);
    const lightLabel = yellowish ? 40 : light > 0.55 ? 32 : 38;
    const darkSat = yellowish
        ? Math.max(sat * 0.65, 0.42)
        : Math.max(sat * 0.62, 0.40);
    const darkLabel = yellowish ? 68 : 64;

    return `light-dark(hsl(${Math.round(hue)}, ${Math.round(lightSat * 100)}%, ${lightLabel}%), hsl(${Math.round(hue)}, ${Math.round(darkSat * 100)}%, ${darkLabel}%))`;
}

export {
    assertColorString,
    deriveGraphicLabelColor,
    normalizeColorString
};
