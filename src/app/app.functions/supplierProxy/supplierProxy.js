exports.main = async (context = {}) => {
    const params = context.parameters || {};

    const supplierKey = params.supplierKey || "";
    const env = params.env || "sandbox";
    const action = params.action || "";
    const payload = params.payload || {};

    try {
        if (supplierKey === "ABC" && action === "price") {
            const result = await priceABC({ env, payload });
            return result.status(200).json(result);
        }

        return res.status(200).json({ 
            ok: true, 
            priced: false,
        reasons: ["Call for pricing"],
     });
    } catch (error) {
        console.error("supplierProxy exception:", error);
        return res.status(200).json({
            ok: false,
            priced: false,
            reasons: ["TECHNICAL_FAILURE"],
        });
    }

    async function priceABC({ env, payload}) {
        const branchId = payload?.branchId;
        const items = payload?.items;

        if (!branchId) {
            return { ok: true, priced: false, reasons: ["MISSING_BRANCH"]};
        }
        if (!Array.isArray(items) || items.length === 0) {
            return { ok: true, priced: false, reasons: ["NO_ITEMS"]};
        }

        // TODO: Implement the actual pricing logic
        // const response = await fetch(url, { method: "POST", body: JSON.stringify(payload)});

        return { ok: true, priced: false, reasons: ["CALL_FOR_PRICING"]};

        // If it returns with real numbers
       // return { ok: true, priced: true, reasons: [], pricedLines: [], unpricedLines: []};
    }
    
};