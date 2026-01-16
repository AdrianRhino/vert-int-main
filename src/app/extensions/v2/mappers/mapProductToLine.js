import { mapSrsProductToLine } from "./mapSrsProductToLine";
import { mapAbcProductToLine } from "./mapAbcProductToLine";
import { mapBeaconProductToLine } from "./mapBeaconProductToLine";
import { normalizeLine } from "../normalize/normalizeLine";

export function mapProductToLine(row) {
    const supplier = String(row.supplier || row.supplierKey || "").toUpperCase();

if (supplier.toUpperCase() === "SRS") {
    return mapSrsProductToLine(row);
}
if (supplier.toUpperCase() === "ABC") {
    return mapAbcProductToLine(row);
}
if (supplier.toUpperCase() === "BEACON") {
    return mapBeaconProductToLine(row);
}

// unknown supplier
return normalizeLine({
    supplierKey: supplier.toUpperCase(),
    sku: row.itemnumber || row.sku || "",
    title: row.marketingdescription || row.description || "",
    quantity: 1,
    uom: "",
    variantCode: "",
    options: [],
    meta: {}
});

    
}