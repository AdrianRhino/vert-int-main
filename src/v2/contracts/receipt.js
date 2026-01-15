/**
 * V2 Receipt - Receipt creation and manipulation
 * Simple functions only, no abstractions
 */

const {
  RECEIPT_KIND_LOGIN,
  RECEIPT_KIND_PRICING,
  RECEIPT_KIND_ORDER,
  RECEIPT_KIND_ORDER_DRY_RUN,
  RECEIPT_KIND_SEARCH,
  RECEIPT_KIND_HUBSPOT_DRAFT,
  RECEIPT_KIND_SUBMIT_PIPELINE,
} = require("./invariants");

/**
 * Generate a simple random ID
 */
function makeId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Create base receipt structure
 */
function makeReceipt(kind, env, supplierKey, context) {
  const receipt = {
    id: makeId(),
    timestamp: new Date().toISOString(),
    kind: kind || "",
    env: env || "",
    supplierKey: supplierKey || "",
    context: {
      dealId: context?.dealId || "",
      branchNumber: context?.branchNumber || "",
      shipToNumber: context?.shipToNumber || "",
      externalKey: context?.externalKey || "",
    },
    validation: {
      ok: true,
      errors: [],
    },
    result: {
      requestSucceeded: false,
      summary: {
        requested: 0,
        priced: 0,
        unpriced: 0,
      },
      pricedLines: [],
      unpricedLines: [],
      requestErrors: [],
    },
    raw: {},
  };
  return receipt;
}

/**
 * Add validation error to receipt
 */
function addValidationError(receipt, path, message) {
  if (!receipt.validation) {
    receipt.validation = { ok: true, errors: [] };
  }
  receipt.validation.errors.push({ path: path || "", message: message || "" });
  receipt.validation.ok = false;
}

/**
 * Add request error to receipt
 */
function addRequestError(receipt, code, message) {
  if (!receipt.result) {
    receipt.result = { requestErrors: [] };
  }
  if (!receipt.result.requestErrors) {
    receipt.result.requestErrors = [];
  }
  receipt.result.requestErrors.push({ code: code || "", message: message || "" });
  receipt.result.requestSucceeded = false;
}

/**
 * Calculate summary counts from priced/unpriced arrays
 */
function finalizeSummary(receipt) {
  if (!receipt.result) {
    receipt.result = {};
  }
  if (!receipt.result.summary) {
    receipt.result.summary = { requested: 0, priced: 0, unpriced: 0 };
  }
  
  const pricedCount = receipt.result.pricedLines ? receipt.result.pricedLines.length : 0;
  const unpricedCount = receipt.result.unpricedLines ? receipt.result.unpricedLines.length : 0;
  
  receipt.result.summary.requested = pricedCount + unpricedCount;
  receipt.result.summary.priced = pricedCount;
  receipt.result.summary.unpriced = unpricedCount;
}

module.exports = {
  makeId,
  makeReceipt,
  addValidationError,
  addRequestError,
  finalizeSummary,
};
