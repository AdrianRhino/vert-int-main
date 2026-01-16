exports.main = async (context = {}) => {
    const { supplierKey, query } = context.parameters || {};

    const q = String(query || "").trim();

    return {
        status: "success",
        body: {
            ok: true,
            results: q.length === 0 ? [] : [
                { supplier: supplierKey || "UNKNOWN", sku: "TEST-001", title: "Test product 1" },
                { supplier: supplierKey || "UNKNOWN", sku: "TEST-002", title: "Test product 2" },
            ],
        }
    };
};