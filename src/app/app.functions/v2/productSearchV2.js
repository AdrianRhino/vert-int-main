/**
 * V2 Product Search - Serverless endpoint wrapper
 * Calls productDoor.handleProductSearch
 */

const { handleProductSearch } = require("../../../v2/doors/productDoor");

exports.main = async (context = {}) => {
  try {
    const input = context.parameters || {};
    const receipt = await handleProductSearch(input);
    
    return {
      statusCode: 200,
      body: receipt,
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: {
        error: error.message || "Product search failed",
        kind: "ERROR",
      },
    };
  }
};
