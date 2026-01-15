/**
 * V2 Normalize Line Items - Simple normalization rules
 * Input: array of raw items
 * Output: array of NormalizedLineItem objects
 */

/**
 * Normalize line items from raw format
 */
function normalizeLineItems(rawItems) {
  if (!Array.isArray(rawItems)) {
    return [];
  }
  
  const normalized = [];
  
  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    if (!raw || typeof raw !== "object") {
      continue;
    }
    
    // Extract SKU
    const sku = (raw.sku || raw.itemNumber || "").trim();
    if (sku === "") {
      continue; // Skip items with empty SKU
    }
    
    // Extract quantity
    let quantity = Number(raw.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      quantity = 1;
    }
    
    // Extract UOM
    let uom = raw.uom || "";
    
    // UOM corrections based on title
    const title = (raw.title || "").toUpperCase();
    if (uom === "EA" && title.includes("SQ")) {
      uom = "SQ";
    } else if (uom === "EA" && title.includes("BNDL")) {
      uom = "BNDL";
    } else if (uom === "EA" && title.includes("RL")) {
      uom = "RL";
    } else if (uom === "EA" && title.includes("LF")) {
      uom = "LF";
    } else if (uom === "EA" && title.includes("BX")) {
      uom = "BX";
    }
    
    // Extract lineId
    const lineId = raw.lineId || sku || String(i);
    
    // Build normalized item
    const item = {
      lineId: lineId,
      sku: sku,
      quantity: quantity,
      uom: uom,
    };
    
    // Optional fields
    if (raw.length !== undefined) {
      item.length = raw.length;
    }
    if (raw.title) {
      item.title = raw.title;
    }
    
    normalized.push(item);
  }
  
  return normalized;
}

module.exports = {
  normalizeLineItems,
};
