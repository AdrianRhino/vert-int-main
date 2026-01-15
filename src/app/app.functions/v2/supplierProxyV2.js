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
    return {
      statusCode: 500,
      body: {
        error: error.message || "Supplier proxy failed",
        kind: "ERROR",
      },
    };
  }
};
