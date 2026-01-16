export function makeEmptyLine() {
    return {
        supplierKey: "",     // "SRS" | "ABC" | "BEACON"
        sku: "",             // supplier item number
        title: "",           // display name
        quantity: 1,         // number
        uom: "",             // "EA", "1G", "5G", "PAL", etc
        variantCode: "",     // optional
        options: [],         // list of selectable variants (for UI)
        meta: {}             // anything extra, optional
    };
}