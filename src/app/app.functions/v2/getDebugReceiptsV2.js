/**
 * V2 Get Debug Receipts - Serverless endpoint wrapper
 * Returns debugStore.listReceipts
 */

const { listReceipts } = require("../../../v2/debug/debugStore");

exports.main = async (context = {}) => {
  try {
    const limit = context.parameters?.limit || 50;
    const receipts = listReceipts(limit);
    
    return {
      statusCode: 200,
      body: {
        receipts,
        count: receipts.length,
      },
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: {
        error: error.message || "Get debug receipts failed",
        receipts: [],
      },
    };
  }
};
