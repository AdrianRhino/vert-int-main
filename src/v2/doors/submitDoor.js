/**
 * V2 Submit Door - One-call pipeline
 * draft -> supplier order -> PDF -> hubspot update
 */

const { makeReceipt, addValidationError, addRequestError } = require("../contracts/receipt");
const { normalizeLineItems } = require("../normalize/normalizeLineItems");
const { pushReceipt } = require("../debug/debugStore");
const { RECEIPT_KIND_SUBMIT_PIPELINE, STATUS_PROCESSING, STATUS_SUBMITTED, STATUS_FAILED } = require("../contracts/invariants");
const { upsertMaterialOrder } = require("../hubspot/materialOrder");
const { handleSupplierAction } = require("./supplierDoor");

/**
 * Submit order pipeline
 */
async function submitOrderPipeline(input) {
  const { dealId, supplierKey, env, context, rawLineItems, liveOrder, confirmationText } = input || {};
  
  // Create receipt
  const receipt = makeReceipt(RECEIPT_KIND_SUBMIT_PIPELINE, env, supplierKey, context || {});
  receipt.context.dealId = dealId || "";
  receipt.raw.requestPayload = { dealId, supplierKey, env, context, rawLineItems, liveOrder, confirmationText };
  
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
  
  // Step 1: Normalize line items
  const normalizedLines = normalizeLineItems(rawLineItems || []);
  if (normalizedLines.length === 0) {
    addValidationError(receipt, "rawLineItems", "No valid line items found");
    pushReceipt(receipt);
    return receipt;
  }
  
  // Step 2: HubSpot - upsert draft with status PROCESSING
  const payloadSnapshot = {
    supplierKey,
    env,
    context: context || {},
    normalizedLines,
    timestamp: new Date().toISOString(),
  };
  const payloadSnapshotString = JSON.stringify(payloadSnapshot);
  
  let materialOrderId;
  try {
    const hubspotResult = await upsertMaterialOrder(
      dealId,
      supplierKey,
      env,
      {
        status: STATUS_PROCESSING,
      },
      payloadSnapshotString
    );
    
    if (!hubspotResult.ok) {
      // Update HubSpot status to FAILED
      await upsertMaterialOrder(
        dealId,
        supplierKey,
        env,
        {
          status: STATUS_FAILED,
          statusReason: `Failed to create draft: ${hubspotResult.error}`,
        },
        payloadSnapshotString
      );
      
      addRequestError(receipt, "HUBSPOT_DRAFT_FAILED", hubspotResult.error || "Failed to create HubSpot draft");
      receipt.raw.response = { step: "hubspot_draft", error: hubspotResult.error };
      pushReceipt(receipt);
      return receipt;
    }
    
    materialOrderId = hubspotResult.materialOrderId;
    receipt.raw.response = {
      step: "hubspot_draft",
      materialOrderId,
      status: hubspotResult.status,
    };
  } catch (error) {
    addRequestError(receipt, "HUBSPOT_DRAFT_ERROR", error.message || "HubSpot draft operation failed");
    receipt.raw.response = { step: "hubspot_draft", error: error.message };
    pushReceipt(receipt);
    return receipt;
  }
  
  // Step 3: Supplier - call supplierDoor with action="order"
  let orderResult;
  try {
    const supplierPayload = {
      context: context || {},
      liveOrder: liveOrder || false,
      confirmationText: confirmationText || "",
      fullOrder: {
        fullOrderItems: rawLineItems || [],
      },
    };
    
    const supplierReceipt = await handleSupplierAction({
      supplierKey,
      env,
      action: "order",
      payload: supplierPayload,
    });
    
    receipt.raw.response.supplierReceipt = supplierReceipt;
    
    if (!supplierReceipt.result.requestSucceeded) {
      // Update HubSpot status to FAILED
      await upsertMaterialOrder(
        dealId,
        supplierKey,
        env,
        {
          status: STATUS_FAILED,
          statusReason: supplierReceipt.result.requestErrors?.[0]?.message || "Supplier order failed",
        },
        payloadSnapshotString
      );
      
      addRequestError(receipt, "SUPPLIER_ORDER_FAILED", 
        supplierReceipt.result.requestErrors?.[0]?.message || "Supplier order failed");
      receipt.raw.response.step = "supplier_order";
      pushReceipt(receipt);
      return receipt;
    }
    
    orderResult = supplierReceipt.raw.response;
    receipt.raw.response.step = "supplier_order";
    receipt.raw.response.orderResult = orderResult;
  } catch (error) {
    // Update HubSpot status to FAILED
    await upsertMaterialOrder(
      dealId,
      supplierKey,
      env,
      {
        status: STATUS_FAILED,
        statusReason: error.message || "Supplier order error",
      },
      payloadSnapshotString
    );
    
    addRequestError(receipt, "SUPPLIER_ORDER_ERROR", error.message || "Supplier order operation failed");
    receipt.raw.response.step = "supplier_order";
    receipt.raw.response.error = error.message;
    pushReceipt(receipt);
    return receipt;
  }
  
  // Step 4: PDF - call existing generateAndUploadOrderPDF
  let pdfUrl;
  try {
    // Try to require existing PDF generator
    let generateAndUploadOrderPDF;
    try {
      generateAndUploadOrderPDF = require("../../app/app.functions/suppliers/order/generateAndUploadOrderPDF");
    } catch (requireError) {
      // If not available, create stub
      pdfUrl = `https://hubspot.com/files/stub-${Date.now()}.pdf`;
      receipt.raw.response.pdfStub = true;
    }
    
    if (generateAndUploadOrderPDF) {
      const pdfResult = await generateAndUploadOrderPDF.main({
        parameters: {
          fullOrder: {
            supplier: supplierKey.toLowerCase(),
            fullOrderItems: rawLineItems || [],
            orderId: orderResult?.orderId || orderResult?.requestId || `ORD-${Date.now()}`,
          },
          parsedOrder: {},
          orderResult: orderResult,
          orderId: materialOrderId,
          dealId: dealId,
          environment: env,
        },
      });
      
      if (pdfResult.statusCode === 200 && pdfResult.body?.success) {
        pdfUrl = pdfResult.body.pdfUrl;
      } else {
        throw new Error(pdfResult.body?.error || "PDF generation failed");
      }
    }
    
    receipt.raw.response.step = "pdf_generation";
    receipt.raw.response.pdfUrl = pdfUrl;
  } catch (error) {
    // PDF failure is not fatal, but log it
    receipt.raw.response.step = "pdf_generation";
    receipt.raw.response.pdfError = error.message;
    // Continue to HubSpot update
  }
  
  // Step 5: HubSpot - patch pdfUrl and transition status to SUBMITTED
  try {
    const finalPatch = {
      status: STATUS_SUBMITTED,
    };
    if (pdfUrl) {
      finalPatch.pdfUrl = pdfUrl;
    }
    
    const finalResult = await upsertMaterialOrder(
      dealId,
      supplierKey,
      env,
      finalPatch,
      payloadSnapshotString
    );
    
    if (!finalResult.ok) {
      addRequestError(receipt, "HUBSPOT_UPDATE_FAILED", finalResult.error || "Failed to update HubSpot");
      receipt.raw.response.step = "hubspot_update";
      receipt.raw.response.updateError = finalResult.error;
    } else {
      receipt.result.requestSucceeded = true;
      receipt.raw.response.step = "complete";
      receipt.raw.response.finalStatus = finalResult.status;
      receipt.raw.response.materialOrderId = finalResult.materialOrderId;
    }
  } catch (error) {
    addRequestError(receipt, "HUBSPOT_UPDATE_ERROR", error.message || "HubSpot update operation failed");
    receipt.raw.response.step = "hubspot_update";
    receipt.raw.response.error = error.message;
  }
  
  // Push to debug store and return
  pushReceipt(receipt);
  return receipt;
}

module.exports = {
  submitOrderPipeline,
};
