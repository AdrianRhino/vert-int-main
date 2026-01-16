export function normalizeLine(line) {
    const out = { ...line };

    outSupplierKey = cleanText(out.supplierKey).toUpperCase();
    out.sku = cleanText(out.sku);
    out.title = cleanText(out.title);

    out.quantity = toNumber(out.quantity, 1);
    if (out.quantity <= 0) out.quantity = 1;

    out.uom = cleanText(out.uom).toUpperCase();
    out.variantCode = cleanText(out.variantCode);

    out.options = safeArray(out.options);

    if (!out.meta || typeof out.meta !== "object") out.meta = {};

    return out;
}