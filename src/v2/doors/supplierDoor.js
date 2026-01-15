/**
 * V2 Supplier Door - Single entry point for supplier actions
 * Handles login, pricing, order, orderDryRun with prod lock
 */

const { makeReceipt, addValidationError, addRequestError, finalizeSummary } = require("../contracts/receipt");
const { validateEnv, validateSupplierKey, validateLineItems, validateABCContext } = require("../contracts/validate");
const { normalizeLineItems } = require("../normalize/normalizeLineItems");
const { pushReceipt } = require("../debug/debugStore");
const {
  RECEIPT_KIND_LOGIN,
  RECEIPT_KIND_PRICING,
  RECEIPT_KIND_ORDER,
  RECEIPT_KIND_ORDER_DRY_RUN,
  ERROR_CODE_PROD_ORDER_LOCKED,
} = require("../contracts/invariants");

// Supplier adapters
const abcAdapter = require("../suppliers/abc");
const srsAdapter = require("../suppliers/srs");
const beaconAdapter = require("../suppliers/beacon");

/**
 * Handle supplier action
 */
async function handleSupplierAction(input) {
  const { supplierKey, env, action, payload } = input || {};
  
  // Determine receipt kind based on action
  let kind;
  if (action === "login") {
    kind = RECEIPT_KIND_LOGIN;
  } else if (action === "getPricing") {
    kind = RECEIPT_KIND_PRICING;
  } else if (action === "order") {
    kind = RECEIPT_KIND_ORDER;
  } else if (action === "orderDryRun") {
    kind = RECEIPT_KIND_ORDER_DRY_RUN;
  } else {
    kind = RECEIPT_KIND_PRICING; // Default
  }
  
  // Create receipt
  const receipt = makeReceipt(kind, env, supplierKey, payload?.context || {});
  receipt.raw.requestPayload = payload;
  
  // Validate env
  const envErrors = validateEnv(env);
  envErrors.forEach(err => addValidationError(receipt, err.path, err.message));
  
  // Validate supplierKey
  const supplierErrors = validateSupplierKey(supplierKey);
  supplierErrors.forEach(err => addValidationError(receipt, err.path, err.message));
  
  // Validate action
  const validActions = ["login", "getPricing", "order", "orderDryRun"];
  if (!validActions.includes(action)) {
    addValidationError(receipt, "action", `action must be one of: ${validActions.join(", ")}, got: ${action}`);
  }
  
  // If validation failed, return early
  if (!receipt.validation.ok) {
    pushReceipt(receipt);
    return receipt;
  }
  
  // Normalize line items for pricing/order actions
  let normalizedLines = [];
  if (action === "getPricing" || action === "order" || action === "orderDryRun") {
    const rawItems = payload?.fullOrder?.fullOrderItems || payload?.lineItems || [];
    normalizedLines = normalizeLineItems(rawItems);
    
    // Validate line items
    const lineErrors = validateLineItems(normalizedLines);
    lineErrors.forEach(err => addValidationError(receipt, err.path, err.message));
    
    if (normalizedLines.length === 0 && action !== "login") {
      addValidationError(receipt, "lineItems", "No valid line items found");
    }
  }
  
  // ABC context validation
  if (supplierKey === "ABC" && (action === "getPricing" || action === "order" || action === "orderDryRun")) {
    const contextErrors = validateABCContext(payload?.context || {});
    contextErrors.forEach(err => addValidationError(receipt, err.path, err.message));
  }
  
  // If validation failed, return early
  if (!receipt.validation.ok) {
    pushReceipt(receipt);
    return receipt;
  }
  
  // PROD order lock check
  if (action === "order" && env === "prod") {
    const allowProd = process.env.ALLOW_PROD_ORDERS === "true";
    const liveOrder = payload?.liveOrder === true;
    const confirmationText = payload?.confirmationText === "PLACE LIVE ORDER";
    
    if (!allowProd || !liveOrder || !confirmationText) {
      addRequestError(receipt, ERROR_CODE_PROD_ORDER_LOCKED, 
        "Production orders require: ALLOW_PROD_ORDERS=true, liveOrder=true, confirmationText='PLACE LIVE ORDER'");
      pushReceipt(receipt);
      return receipt;
    }
  }
  
  // Route to adapter
  let adapter;
  if (supplierKey === "ABC") {
    adapter = abcAdapter;
  } else if (supplierKey === "SRS") {
    adapter = srsAdapter;
  } else if (supplierKey === "BEACON") {
    adapter = beaconAdapter;
  } else {
    addRequestError(receipt, "INVALID_SUPPLIER", `Unknown supplier: ${supplierKey}`);
    pushReceipt(receipt);
    return receipt;
  }
  
  // Call adapter function
  try {
    let result;
    
    if (action === "login") {
      result = await adapter.login(env, payload);
      if (result.ok) {
        receipt.result.requestSucceeded = true;
        receipt.raw.response = { access_token: result.access_token, environment: result.environment };
      } else {
        addRequestError(receipt, "LOGIN_FAILED", result.errorMessage);
      }
    } else if (action === "getPricing") {
      result = await adapter.getPricing(env, payload, normalizedLines);
      if (result.ok) {
        receipt.result.requestSucceeded = true;
        receipt.result.pricedLines = result.pricedLines || [];
        receipt.result.unpricedLines = result.unpricedLines || [];
        receipt.raw.response = result;
      } else {
        addRequestError(receipt, "PRICING_FAILED", result.errorMessage);
      }
    } else if (action === "orderDryRun") {
      result = await adapter.orderDryRun(env, payload, normalizedLines);
      if (result.ok) {
        receipt.result.requestSucceeded = true;
        receipt.raw.response = result.dryRunResult;
      } else {
        addRequestError(receipt, "ORDER_DRY_RUN_FAILED", result.errorMessage);
      }
    } else if (action === "order") {
      result = await adapter.order(env, payload, normalizedLines);
      if (result.ok) {
        receipt.result.requestSucceeded = true;
        receipt.raw.response = result.orderResult;
      } else {
        addRequestError(receipt, "ORDER_FAILED", result.errorMessage);
      }
    }
    
    // Finalize summary for pricing
    if (action === "getPricing") {
      finalizeSummary(receipt);
    }
    
  } catch (error) {
    addRequestError(receipt, "NETWORK_ERROR", error.message || "Network request failed");
    receipt.raw.response = { error: error.message };
  }
  
  // Push to debug store and return
  pushReceipt(receipt);
  return receipt;
}

module.exports = {
  handleSupplierAction,
};
