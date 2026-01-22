const axios = require("axios");


// Helpers 

function ok200(body) {
    return { statusCode: 200, body };
}

function collectStrings(node, out) {
    if (node == null) return;
    if (typeof node === "string") return void out.push(node);
    if (Array.isArray(node)) return void node.forEach(v => collectStrings(v, out));
    if (typeof node === "object") return void Object.values(node).forEach((v) => collectStrings(v, out));
}

function extractCallForPricing(respData) {
    const strings = [];
    collectStrings(respData, strings);

    const callMsgs = strings.filter(
        (s) =>
            /call for pricing/i.test(s) ||
            /cannot price/i.test(s) ||
            /pricing not entered/i.test(s)
    );

    // Extract SKUs from messages like: "Cannot price item 11GAUR22. Call for pricing."
    const skus = [];
    for (const msg of callMsgs) {
        const re = /cannot price item\s+([A-Z0-9_-]+)/ig;
        let m;
        while ((m = re.exec(msg))) skus.push(m[1]);
    }

    const uniqueSkus = [...new Set(skus)];
    const flags = uniqueSkus.length
        ? { callForPricingSkus: uniqueSkus, callForPricingMessages: callMsgs.slice(0, 5) }
        : null;

    const priced = uniqueSkus.length === 0;
    const reasons = priced ? [] : ["CALL_FOR_PRICING"];

    return { priced, reasons, flags };
}

function getAxiosErrInfo(error) {
    return {
        status: error?.response?.status,
        url: error?.config?.url,
        data: error?.response?.data,
        message: error?.message || String(error),
    };
}

exports.priceABC = async ({ env, lines, supplierContext }) => {

    // If ABC now only authorizes pricing via PROD creds, force prod here:
    const FORCE_PROD_PRICING_CREDS = true;
    const useProd = FORCE_PROD_PRICING_CREDS || env === "prod";

    const basicSandbox = Buffer.from(
        `${process.env.ABCClientSandbox}:${process.env.ABCClientSecretSandbox}`
    ).toString("base64");

    const basicProd = Buffer.from(
        `${process.env.ABCClient}:${process.env.ABCClientSecret}`
    ).toString("base64");

    const apiUrlAuth = useProd ? process.env.ABCurlProdAuth : process.env.ABCurlSandboxAuth;
    const apiUrl = useProd ? process.env.ABCurlProd : process.env.ABCurlSandbox;
    const basic = useProd ? basicProd : basicSandbox;

    if (!basic || !apiUrlAuth || !apiUrl) {
        return ok200({ ok: false, priced: false, reasons: ["MISSING_API_KEY_OR_URL"] });
    }

    let payload = null;

    try {
        payload = {
            branchNumber: String(supplierContext?.branchId || "").trim(),
            shipToNumber: String(supplierContext?.shipTo || "").trim(),
            requestId: `Pricing-${Date.now()}`,
            purpose: "estimating",
            lines: (lines || []).map((l) => ({
                id: String(l.lineId || Math.random()),
                itemNumber: String(l.sku || "").trim(),
                quantity: Number(l.quantity || 0),
                uom: String(l.uom || "EA").trim().toUpperCase(),
            })),
        };

        // OAuth token request: form-encoded
        const tokenBody = new URLSearchParams({
            grant_type: "client_credentials",
            scope: "pricing.read",
        }).toString();

        const authResp = await axios.post(`${apiUrlAuth}/v1/token`, tokenBody, {
            headers: {
                Authorization: `Basic ${basic}`,
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
            },
        });

        const token = authResp?.data?.access_token;
        if (!token) {
            return ok200({ ok: false, priced: false, reasons: ["MISSING_ACCESS_TOKEN"] });
        }

        const resp = await axios.post(`${apiUrl}/api/pricing/v2/prices`, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        });


        // Don’t put SUCCESS in reasons; reasons should be for “why not priced”
        return ok200({ ok: true, priced, reasons, flags, data: resp.data });
    } catch (error) {

        const errInfo = getAxiosErrInfo(error);

        console.error("[ABC pricing error]", JSON.stringify(errInfo, null, 2));
        return ok200({
            ok: false,
            priced: false,
            reasons: ["TECHNICAL_FAILURE"],
            error: JSON.stringify(errInfo, null, 2),
        });
    }
};
