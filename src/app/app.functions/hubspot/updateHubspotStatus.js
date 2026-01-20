exports.main =async (context = {}) => {
    try {
        const params = context.parameters || {};
        const orderId = params.orderId || "";
        const dealId = params.dealId || "";
        const status = params.status || "SUBMITTED";

        // Stub: return a fake status update
        return {
            statusCode: 200,
            body: {
                ok: true,
                orderId,
                dealId,
                hubspotStatus: status,
            }
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: { ok: false, error: error?.message || "updateHubspotStatus failed" }
        };
    }
}