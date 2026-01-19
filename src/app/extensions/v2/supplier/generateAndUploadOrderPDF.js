exports.main = async (context = {}) => {
    try {
        const params = context.parameters || {};
        const env = params.env || "sandbox";
        const supplierOrderId = params.supplierOrderId || "";
        const dealId = params.dealId || "";

        // Stub: return a fake PDF url
        return {
            statusCode: 200,
            body: {
                ok: true,
                env,
                supplierOrderId,
                pdfUrl: "https://example.com/pdf/" + supplierOrderId + ".pdf",
                dealId,
            }
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: { ok: false, error: error?.message || "generateAndUploadOrderPDF failed" }
        };
    }
    };
