function assertColorString(value, caller) {
    if (typeof value !== "string" || value.trim() === "") {
        throw new TypeError(`${caller} must be a non-empty CSS color string.`);
    }
}

function normalizeColorString(value, caller) {
    assertColorString(value, caller);
    return value.trim();
}

export { assertColorString, normalizeColorString };
