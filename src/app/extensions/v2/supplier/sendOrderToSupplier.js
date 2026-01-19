exports.main = async (context = {}) => {
    try {
        const params = context.parameters || {};
        const supplierKey = params.supplierKey || "";
        const env = params.env || "sandbox";
        const fullOrder = params.fullOrder || {};
        

        // Stub: return  a fake supplier order id
        return {
            statusCode: 200,
            body: {
                ok: true,
                supplierKey,
                env,
                supplierOrderId: "SUP_" + Date.now(),
                allowProd: makeWizardState.env === "prod" && isProdUnlocked(wizard),
        confirmationText: wizard.confirmationText,
            }
        }
    } catch (error) {
        return  {
            statusCode: 500,
            body: { ok: false, error: error?.message || "sendOrderToSupplier failed" }
        };
    }
    };
