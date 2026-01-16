exports.main = async (context = {}) => {
    const params = context.parameters || {};

    const supplierKey = params.supplierKey || "";
    const env = params.env || "sandbox";
    const action = params.action || "";
    const payload = params.payload || {};

    // Stub Response
    return {
        statusCode: 200,
        body: {
            ok: true,
            supplierKey,
            env,
            action,
            priced: false,
            reasons: ["CALL_FOR_PRICING"],
            echo: {
                lineCount: Array.isArray(payload.lines) ? payload.lines.length : 0
            }
        }
    };
};