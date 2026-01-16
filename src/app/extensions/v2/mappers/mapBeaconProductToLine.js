// src/app/extensions/v2/mappers/mapBeaconProductToLine.js

import { makeEmptyLine } from "../normalize/canonicalLine";
import { normalizeLine } from "../normalize/normalizeLine";
import { cleanText, safeArray } from "../normalize/helpers";

export function mapBeaconProductToLine(row) {
  const line = makeEmptyLine();

  line.supplierKey = "BEACON";

  // Beacon rows might use itemnumber, sku, itemNumber, or productCode
  line.sku = cleanText(
    row.itemnumber || row.itemNumber || row.sku || row.productCode || ""
  );

  // Prefer marketingdescription -> familyname -> itemdescription -> fallback
  line.title = cleanText(
    row.marketingdescription ||
      row.familyname ||
      row.itemdescription ||
      row.description ||
      ""
  );

  line.quantity = 1;

  // UOM: Beacon may have uoms[] or uom
  const uoms = safeArray(row.uoms);
  if (uoms.length > 0) {
    line.uom = cleanText(uoms[0]).toUpperCase();
  } else {
    line.uom = cleanText(row.uom || "").toUpperCase();
  }

  // Options: keep empty unless Beacon provides variant list similar to SRS
  line.options = [];

  line.meta = {
    id: row.id || "",
    images: row.images || null,
    hierarchy: row.hierarchy || null,
    isDimensional: row.isdimensional === true
  };

  return normalizeLine(line);
}
