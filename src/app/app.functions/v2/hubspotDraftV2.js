/**
 * V2 HubSpot Draft - Serverless endpoint wrapper
 * Calls hubspotDoor.saveDraftToHubspot
 */

const { saveDraftToHubspot } = require("../../../v2/doors/hubspotDoor");

exports.main = async (context = {}) => {
  try {
    const input = context.parameters || {};
    const receipt = await saveDraftToHubspot(input);
    
    return {
      statusCode: 200,
      body: receipt,
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: {
        error: error.message || "HubSpot draft save failed",
        kind: "ERROR",
      },
    };
  }
};
