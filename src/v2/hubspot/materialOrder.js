/**
 * V2 HubSpot Material Order - CRUD operations with idempotency
 * Uses externalKey for idempotency: "deal:{dealId}|supplier:{supplierKey}|env:{env}"
 */

const axios = require("axios");
const {
  MATERIAL_ORDER_TYPE,
  STATUS_DRAFT,
  STATUS_PROCESSING,
  STATUS_SUBMITTED,
  STATUS_FAILED,
  ALLOWED_TRANSITIONS,
  PROP_EXTERNAL_KEY,
  PROP_PAYLOAD_SNAPSHOT,
  PROP_STATUS,
  PROP_ENV,
  PROP_SUPPLIER_KEY,
  PROP_PDF_URL,
  PROP_STATUS_REASON,
} = require("../contracts/invariants");

/**
 * Make external key for idempotency
 */
function makeExternalKey(dealId, supplierKey, env) {
  return `deal:${dealId}|supplier:${supplierKey}|env:${env}`;
}

/**
 * Simple retry helper (3 attempts with delays)
 */
async function retry3(fn) {
  let lastError;
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      // Small delay before retry (100ms, 200ms)
      if (i < 2) {
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Validate status transition
 */
function transitionStatus(currentStatus, nextStatus) {
  if (!currentStatus) {
    // No current status, allow any initial status
    return true;
  }
  
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

/**
 * Search for Material Order by externalKey
 */
async function findMaterialOrderByExternalKey(externalKey, apiKey) {
  try {
    const searchUrl = `https://api.hubapi.com/crm/v3/objects/${MATERIAL_ORDER_TYPE}/search`;
    const response = await axios.post(
      searchUrl,
      {
        filterGroups: [
          {
            filters: [
              {
                propertyName: PROP_EXTERNAL_KEY,
                operator: "EQ",
                value: externalKey,
              },
            ],
          },
        ],
        limit: 1,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    
    const results = response.data?.results || [];
    if (results.length > 0) {
      return results[0].id;
    }
    return null;
  } catch (error) {
    // If search fails, return null (will create new)
    console.log("Search failed, will create new:", error.message);
    return null;
  }
}

/**
 * Create Material Order
 */
async function createMaterialOrder(properties, apiKey) {
  const createUrl = `https://api.hubapi.com/crm/v3/objects/${MATERIAL_ORDER_TYPE}`;
  const response = await axios.post(
    createUrl,
    { properties },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data.id;
}

/**
 * Update Material Order (patch - only set known properties)
 */
async function updateMaterialOrder(materialOrderId, properties, apiKey) {
  const updateUrl = `https://api.hubapi.com/crm/v3/objects/${MATERIAL_ORDER_TYPE}/${materialOrderId}`;
  await axios.patch(
    updateUrl,
    { properties },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );
}

/**
 * Ensure association to deal
 */
async function ensureAssociation(materialOrderId, dealId, apiKey) {
  try {
    const associateUrl = `https://api.hubapi.com/crm/v4/objects/${MATERIAL_ORDER_TYPE}/${materialOrderId}/associations/deal/${dealId}`;
    await axios.put(
      associateUrl,
      [
        {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId: 1, // Primary Deal association
        },
      ],
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    return true;
  } catch (error) {
    // If association already exists, that's fine
    if (error.response?.status === 409) {
      return true;
    }
    throw error;
  }
}

/**
 * Upsert Material Order (find by externalKey or create)
 */
async function upsertMaterialOrder(dealId, supplierKey, env, patch, payloadSnapshotString) {
  const apiKey = process.env.HUBSPOT_API_KEY2 || process.env.HUBSPOT_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      materialOrderId: null,
      status: null,
      error: "HUBSPOT_API_KEY2 or HUBSPOT_API_KEY not set",
    };
  }
  
  try {
    const externalKey = makeExternalKey(dealId, supplierKey, env);
    
    // Search for existing order
    const existingId = await retry3(() => findMaterialOrderByExternalKey(externalKey, apiKey));
    
    // Build properties
    const properties = {
      [PROP_EXTERNAL_KEY]: externalKey,
      [PROP_PAYLOAD_SNAPSHOT]: payloadSnapshotString,
      [PROP_ENV]: env,
      [PROP_SUPPLIER_KEY]: supplierKey,
    };
    
    // Add patch properties (only known properties)
    if (patch.status) {
      properties[PROP_STATUS] = patch.status;
    }
    if (patch.pdfUrl) {
      properties[PROP_PDF_URL] = patch.pdfUrl;
    }
    if (patch.statusReason) {
      properties[PROP_STATUS_REASON] = patch.statusReason;
    }
    
    let materialOrderId;
    let currentStatus = null;
    
    if (existingId) {
      // Update existing
      materialOrderId = existingId;
      
      // Get current status first (if needed for transition check)
      try {
        const getUrl = `https://api.hubapi.com/crm/v3/objects/${MATERIAL_ORDER_TYPE}/${existingId}?properties=${PROP_STATUS}`;
        const getResponse = await axios.get(getUrl, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        currentStatus = getResponse.data?.properties?.[PROP_STATUS] || null;
      } catch (getError) {
        // Ignore - will use null
      }
      
      // Check status transition if setting status
      if (patch.status && currentStatus) {
        if (!transitionStatus(currentStatus, patch.status)) {
          return {
            ok: false,
            materialOrderId: existingId,
            status: currentStatus,
            error: `Invalid status transition: ${currentStatus} -> ${patch.status}`,
          };
        }
      }
      
      // Update
      await retry3(() => updateMaterialOrder(existingId, properties, apiKey));
    } else {
      // Create new
      if (!patch.status) {
        properties[PROP_STATUS] = STATUS_DRAFT; // Default to DRAFT
      }
      materialOrderId = await retry3(() => createMaterialOrder(properties, apiKey));
      
      // Associate to deal
      await retry3(() => ensureAssociation(materialOrderId, dealId, apiKey));
    }
    
    // Ensure association (in case it was missing)
    if (existingId) {
      await retry3(() => ensureAssociation(materialOrderId, dealId, apiKey));
    }
    
    return {
      ok: true,
      materialOrderId,
      status: properties[PROP_STATUS] || currentStatus || STATUS_DRAFT,
    };
  } catch (error) {
    return {
      ok: false,
      materialOrderId: null,
      status: null,
      error: error.response?.data?.message || error.message || "HubSpot operation failed",
    };
  }
}

module.exports = {
  makeExternalKey,
  upsertMaterialOrder,
  ensureAssociation,
  transitionStatus,
  retry3,
};
