/**
 * V2 Product Door - Product search wrapper
 * Simple wrapper for product search
 */

const { makeReceipt, addValidationError, addRequestError } = require("../contracts/receipt");
const { validateEnv, validateSupplierKey } = require("../contracts/validate");
const { pushReceipt } = require("../debug/debugStore");
const { RECEIPT_KIND_SEARCH } = require("../contracts/invariants");

/**
 * Handle product search
 */
async function handleProductSearch(input) {
  const { supplierKey, env, query, page, pageSize } = input || {};
  
  // Create receipt
  const receipt = makeReceipt(RECEIPT_KIND_SEARCH, env, supplierKey, {});
  receipt.raw.requestPayload = { query, page, pageSize };
  
  // Validate env
  const envErrors = validateEnv(env);
  envErrors.forEach(err => addValidationError(receipt, err.path, err.message));
  
  // Validate supplierKey
  const supplierErrors = validateSupplierKey(supplierKey);
  supplierErrors.forEach(err => addValidationError(receipt, err.path, err.message));
  
  // If validation failed, return early
  if (!receipt.validation.ok) {
    pushReceipt(receipt);
    return receipt;
  }
  
  // Try to call existing supplierProducts function
  try {
    // Try to require existing supplierProducts
    let supplierProducts;
    try {
      supplierProducts = require("../../app/app.functions/suppliers/supabase/supplierProducts");
    } catch (requireError) {
      // If not available, return stub response
      receipt.result.requestSucceeded = true;
      receipt.result.summary = { requested: 0, priced: 0, unpriced: 0 };
      receipt.raw.response = {
        message: "Product search not yet implemented",
        query,
        supplierKey,
        env,
      };
      pushReceipt(receipt);
      return receipt;
    }
    
    // Call supplierProducts
    const result = await supplierProducts.main({
      parameters: {
        supplierKey,
        env,
        query,
        page: page || 1,
        pageSize: pageSize || 20,
      },
    });
    
    receipt.result.requestSucceeded = true;
    receipt.result.summary = {
      requested: result?.body?.products?.length || 0,
      priced: 0,
      unpriced: 0,
    };
    receipt.raw.response = result?.body || result;
    
  } catch (error) {
    addRequestError(receipt, "SEARCH_FAILED", error.message || "Product search failed");
    receipt.raw.response = { error: error.message };
  }
  
  // Push to debug store and return
  pushReceipt(receipt);
  return receipt;
}

module.exports = {
  handleProductSearch,
};
