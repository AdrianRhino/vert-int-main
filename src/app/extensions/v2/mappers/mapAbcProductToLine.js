// src/app/extensions/v2/mappers/mapAbcProductToLine.js

import { makeEmptyLine } from "../normalize/canonicalLine";
import { normalizeLine } from "../normalize/normalizeLine";
import { cleanText, safeArray } from "../normalize/helpers";

export function mapAbcProductToLine(row) {
  const line = makeEmptyLine();

  line.supplierKey = "ABC";

  // ABC rows might use itemnumber, sku, or itemNumber depending on your data source
  line.sku = cleanText(row.itemnumber || row.itemNumber || row.sku || "");

  // Prefer marketingdescription -> familyname -> itemdescription -> fallback
  line.title = cleanText(
    row.marketingdescription ||
      row.familyname ||
      row.itemdescription ||
      row.description ||
      ""
  );

  // Quantity defaults to 1
  line.quantity = 1;

  // UOM: ABC may have uoms array or a single uom field
  const uoms = safeArray(row.uoms);
  if (uoms.length > 0) {
    line.uom = cleanText(uoms[0]).toUpperCase();
  } else {
    line.uom = cleanText(row.uom || "").toUpperCase();
  }

  // ABC might not have variants the same way SRS does.
  line.options = [];

  // Put extra supplier stuff in meta (optional; keep it minimal)
  line.meta = {
    id: row.id || "",
    images: row.images || null,
    hierarchy: row.hierarchy || null,
    isDimensional: row.isdimensional === true
  };

  return normalizeLine(line);
}
