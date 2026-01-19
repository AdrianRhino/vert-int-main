exports.main = async (context = {}) => {
    try {
        const params = context.parameters || {};
        const fullOrder = params.fullOrder || {};
        const dealId = params.dealId || "";

        // Stub: pretend Hubspot created/updated an order record
        return {
            statusCode: 200,
            body: {
                ok: true,
                orderId: "ORDER_TEST_" + Date.now(),
                dealId: dealId,
                receivedLineCount: Array.isArray(fullOrder.lines) ? fullOrder.lines.length : 0,
            }
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: {
                ok: false,
                error: error?.message || "Unknown error"
            }
        };
    }
};