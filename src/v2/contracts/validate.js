/**
 * V2 Validate - Validation functions
 * Each returns array of errors: [{path, message}]
 */

const { ERROR_CODE_INVALID_ENV, ERROR_CODE_INVALID_SUPPLIER, ERROR_CODE_MISSING_CONTEXT } = require("./invariants");

/**
 * Validate env must be "sandbox" or "prod"
 */
function validateEnv(env) {
  const errors = [];
  if (env !== "sandbox" && env !== "prod") {
    errors.push({
      path: "env",
      message: `env must be "sandbox" or "prod", got: ${env}`,
    });
  }
  return errors;
}

/**
 * Validate supplierKey must be "ABC", "SRS", or "BEACON"
 */
function validateSupplierKey(supplierKey) {
  const errors = [];
  const validKeys = ["ABC", "SRS", "BEACON"];
  if (!validKeys.includes(supplierKey)) {
    errors.push({
      path: "supplierKey",
      message: `supplierKey must be one of: ${validKeys.join(", ")}, got: ${supplierKey}`,
    });
  }
  return errors;
}

/**
 * Validate line items array structure
 */
function validateLineItems(lines) {
  const errors = [];
  if (!Array.isArray(lines)) {
    errors.push({
      path: "lineItems",
      message: "lineItems must be an array",
    });
    return errors;
  }
  
  for (let i = 0; i < lines.length; i++) {
    const item = lines[i];
    if (!item || typeof item !== "object") {
      errors.push({
        path: `lineItems[${i}]`,
        message: "line item must be an object",
      });
      continue;
    }
    
    const sku = item.sku || item.itemNumber || "";
    if (!sku || sku.trim() === "") {
      errors.push({
        path: `lineItems[${i}].sku`,
        message: "line item must have sku or itemNumber",
      });
    }
  }
  
  return errors;
}

/**
 * Validate ABC context requires branchNumber and shipToNumber
 */
function validateABCContext(context) {
  const errors = [];
  if (!context) {
    errors.push({
      path: "context",
      message: "context is required for ABC",
    });
    return errors;
  }
  
  if (!context.branchNumber || context.branchNumber.trim() === "") {
    errors.push({
      path: "context.branchNumber",
      message: "branchNumber is required for ABC",
    });
  }
  
  if (!context.shipToNumber || context.shipToNumber.trim() === "") {
    errors.push({
      path: "context.shipToNumber",
      message: "shipToNumber is required for ABC",
    });
  }
  
  return errors;
}

module.exports = {
  validateEnv,
  validateSupplierKey,
  validateLineItems,
  validateABCContext,
};
