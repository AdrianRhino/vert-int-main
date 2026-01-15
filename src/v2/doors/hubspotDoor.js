/**
 * V2 HubSpot Door - Save draft to HubSpot
 * Creates/updates Material Order with idempotency
 */

const { makeReceipt, addValidationError, addRequestError } = require("../contracts/receipt");
const { pushReceipt } = require("../debug/debugStore");
const { RECEIPT_KIND_HUBSPOT_DRAFT, STATUS_DRAFT } = require("../contracts/invariants");
const { upsertMaterialOrder } = require("../hubspot/materialOrder");

/**
 * Save draft to HubSpot
 */
async function saveDraftToHubspot(input) {
  const { dealId, supplierKey, env, context, normalizedLines, pricingReceiptOptional } = input || {};
  
  // Create receipt
  const receipt = makeReceipt(RECEIPT_KIND_HUBSPOT_DRAFT, env, supplierKey, context || {});
  receipt.context.dealId = dealId || "";
  receipt.raw.requestPayload = { dealId, supplierKey, env, context, normalizedLines };
  
  // Validate required fields
  if (!dealId || dealId.trim() === "") {
    addValidationError(receipt, "dealId", "dealId is required");
  }
  if (!supplierKey || supplierKey.trim() === "") {
    addValidationError(receipt, "supplierKey", "supplierKey is required");
  }
  if (env !== "sandbox" && env !== "prod") {
    addValidationError(receipt, "env", "env must be 'sandbox' or 'prod'");
  }
  
  // If validation failed, return early
  if (!receipt.validation.ok) {
    pushReceipt(receipt);
    return receipt;
  }
  
  // Create payload_snapshot
  const payloadSnapshot = {
    supplierKey,
    env,
    context: context || {},
    normalizedLines: normalizedLines || [],
    timestamp: new Date().toISOString(),
  };
  
  if (pricingReceiptOptional) {
    payloadSnapshot.pricingReceipt = {
      pricedCount: pricingReceiptOptional.result?.summary?.priced || 0,
      unpricedCount: pricingReceiptOptional.result?.summary?.unpriced || 0,
    };
  }
  
  const payloadSnapshotString = JSON.stringify(payloadSnapshot);
  
  // Upsert Material Order
  try {
    const result = await upsertMaterialOrder(
      dealId,
      supplierKey,
      env,
      {
        status: STATUS_DRAFT,
      },
      payloadSnapshotString
    );
    
    if (result.ok) {
      receipt.result.requestSucceeded = true;
      receipt.context.externalKey = `deal:${dealId}|supplier:${supplierKey}|env:${env}`;
      receipt.raw.response = {
        materialOrderId: result.materialOrderId,
        status: result.status,
      };
    } else {
      addRequestError(receipt, "HUBSPOT_SAVE_FAILED", result.error || "Failed to save to HubSpot");
      receipt.raw.response = { error: result.error };
    }
  } catch (error) {
    addRequestError(receipt, "HUBSPOT_ERROR", error.message || "HubSpot operation failed");
    receipt.raw.response = { error: error.message };
  }
  
  // Push to debug store and return
  pushReceipt(receipt);
  return receipt;
}

module.exports = {
  saveDraftToHubspot,
};
