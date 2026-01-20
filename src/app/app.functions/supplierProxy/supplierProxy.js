const { priceABC } = require("../suppliers/abc");
const { priceSRS } = require("../suppliers/srs");
const { priceBEACON } = require("../suppliers/beacon");

const CONTEXT_REQS = {
    ABC: ["branchId", "shipTo"],
    SRS:["accountId"],
    BEACON: ["branchId"],
};

function ok200(body) {
    return { statusCode: 200, body };
}

function missingContextReasons(supplierKey, supplierContext) {
    const reqs = CONTEXT_REQS[supplierKey] || [];
    const missing = reqs.filter((k) => !String(supplierContext?.[k] || "").trim());
    return missing.map((k) => `MISSING_${k.toUpperCase()}`);
}

exports.main = async (context = {}) => {
    const p = context.parameters || {};

    const supplierKey = String(p.supplierKey || "").trim().toUpperCase();
    const env = p.env === "prod" ? "prod" : "sandbox";
    const action = String(p.action || "").trim().toLowerCase();
    const payload = p.payload || {};

    if (action!== "price") {
        return ok200({ ok: true, priced: false, reasons: ["UNSUPPORTED_ACTION"] });
    }

    const lines = Array.isArray(payload.lines) ? payload.lines : [];
    if (lines.length === 0) {
        return ok200({ ok: true, priced: false, reasons: ["NO_LINES"]});
    }

    const supplierContext = payload?.context?.supplierContext || {};
    const missingReasons = missingContextReasons(supplierKey, supplierContext);
    if (missingReasons.length > 0) {
        return ok200({ ok: true, priced: false, reasons: missingReasons });
    }

    try {
        if (supplierKey.toUpperCase() === "ABC") return await priceABC({ env, lines, supplierContext });
        if (supplierKey.toUpperCase() === "SRS") return await priceSRS({ env, lines, supplierContext });
        if (supplierKey.toUpperCase() === "BEACON") return await priceBEACON({ env, lines, supplierContext });

        return ok200({ ok: true, priced: false, reasons: ["UNKNOWN_SUPPLIER"] });
    } catch (error) {
        console.error("supplierProxy exception:", error);
        return ok200({ ok: false, priced: false, reasons: ["TECHNICAL_FAILURE"] , error: error.message || "supplierProxy price failed"});
    }
};