/**
 * V2 Supplier Proxy - Serverless endpoint wrapper
 * Calls supplierDoor.handleSupplierAction
 */

const { handleSupplierAction } = require("../../../v2/doors/supplierDoor");

exports.main = async (context = {}) => {
  try {
    const input = context.parameters || {};
    const receipt = await handleSupplierAction(input);
    
    return {
      statusCode: 200,
      body: receipt,
    };
  } catch (error) {
    // Log full error for debugging
    console.error("V2 SupplierProxy error:", error);
    console.error("Error stack:", error.stack);
    
    // Return detailed error in receipt format
    return {
      statusCode: 500,
      body: {
        id: "error-" + Date.now(),
        timestamp: new Date().toISOString(),
        kind: "ERROR",
        env: input.env || "",
        supplierKey: input.supplierKey || "",
        validation: {
          ok: false,
          errors: [{ path: "serverless", message: error.message }],
        },
        result: {
          requestSucceeded: false,
          requestErrors: [
            {
              code: "SERVERLESS_ERROR",
              message: error.message || "Supplier proxy failed",
            },
          ],
        },
        raw: {
          error: error.message,
          stack: error.stack,
        },
      },
    };
  }
};
