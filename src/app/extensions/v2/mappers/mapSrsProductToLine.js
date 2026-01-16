import { makeEmptyLine } from "../normalize/canonicalLine";
import { normalizeLine, cleanText, safeArray } from "../normalize/normalizeLine";

export function mapSrsProductToLine(row) {
 const line = makeEmptyLine();

 line.supplierKey = "SRS";
 line.sku = cleanText(row.itemnumber || row.sku || "");
 line.title = cleanText(row.marketingdescription || row.familyname || row.itemdescription || "");

 const familyItems = safeArray(row.familyitems);

 line.options = familyItems.map((x) => {
    return {
        variantCode: cleanText(x.variantCode),
        orderUOM: cleanText(x.orderUOM).toUpperCase(),
        selectedOption: cleanText(x.selectedOption),
        colorName: cleanText(x.colorName),
        sizeName: cleanText(x.sizeName),
        uoms: safeArray(x.uoMs).map((u) => cleanText(u).toUpperCase()),
    };
 });

 // Pick a default option
 let chosen = null;

 // Try specific variants first
 if (row.specifications && row.specifications.variant) {
    chosen = row.specifications.variant;
} else if (line.options.length > 0) {
    chosen = line.options[0];
}

if (chosen) {
    line.variantCode = cleanText(chosen.variantCode);
    line.uom = cleanText(chosen.orderUOM || chosen.orderUOM).toUpperCase();
} else {
    const uoms = safeArray(row.uoms);
    line.uom = uoms.length > 0 ? cleanText(uoms[0]).toUpperCase() : "";
}

// Put the extra stuff in meta
line.meta = {
    id: row.id,
    heirarchy: row.hierarchy,
    images: row.images,
    isDimensional: row.isdimensional === true,
    supplierName: row.suppliername
}

return normalizeLine(line);
}