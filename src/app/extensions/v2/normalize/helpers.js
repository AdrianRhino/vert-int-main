export function toText(x) {
    if (x === null || x === undefined) return "";
    return String(x);
}

export function cleanText(x) {
    return toText(x).trim();
}

export function toNumber(x, defaultValue) {
    const n = Number(x);
    if (Number.isNaN(n)) return defaultValue;
    return n;
}

export function safeArray(x) {
    if (Array.isArray(x)) return x;
    return [];
}