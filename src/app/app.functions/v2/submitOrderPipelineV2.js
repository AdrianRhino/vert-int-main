/**
 * V2 Submit Order Pipeline - Serverless endpoint wrapper
 * Calls submitDoor.submitOrderPipeline
 */

const { submitOrderPipeline } = require("../../../v2/doors/submitDoor");

exports.main = async (context = {}) => {
  try {
    const input = context.parameters || {};
    const receipt = await submitOrderPipeline(input);
    
    return {
      statusCode: 200,
      body: receipt,
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: {
        error: error.message || "Submit order pipeline failed",
        kind: "ERROR",
      },
    };
  }
};
