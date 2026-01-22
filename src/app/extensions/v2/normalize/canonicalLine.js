export function makeEmptyLine() {
    return {
        supplierKey: "",     // "SRS" | "ABC" | "BEACON"
        sku: "",             // supplier item number
        title: "",           // display name
        quantity: 1,         // number
        uom: "",             // "EA", "1G", "5G", "PAL", etc
        variantCode: "",     // optional
        options: [],         // list of selectable variants (for UI)
        meta: {},             // anything extra, optional

        // Pricing Placeholder Fields: 
        unitPrice: 0,
        extendedPrice: 0,
        pricingStatus: "UNPRICED", // PRICED | CALL_FOR_PRICING | NOT_FOUND | UNPRICED
        pricingMessage: "",
    };
}