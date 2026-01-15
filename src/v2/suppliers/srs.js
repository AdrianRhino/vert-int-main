/**
 * V2 SRS Distribution - Supplier Adapter
 * Simple functions: login, getPricing, order, orderDryRun
 */

const axios = require("axios");
const { getSupplierConfig } = require("./config");
const { normalizeLineItems } = require("../normalize/normalizeLineItems");

// Get token (login helper)
async function getToken(config) {
  const authParams = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "ALL"
  });
  
  const response = await axios.post(
    config.authUrl,
    authParams.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );
  
  const token = response.data.access_token;
  if (!token) {
    throw new Error("SRS: No token returned from login");
  }
  
  return token;
}

// Login action
async function login(env, payload) {
  try {
    const config = getSupplierConfig("SRS", env);
    const token = await getToken(config);
    
    return {
      ok: true,
      access_token: token,
      environment: config.environment,
    };
  } catch (error) {
    return {
      ok: false,
      errorMessage: error.message || "SRS login failed",
    };
  }
}

// Get pricing
async function getPricing(env, payload, normalizedLines) {
  try {
    const config = getSupplierConfig("SRS", env);
    const token = await getToken(config);
    
    if (!normalizedLines || normalizedLines.length === 0) {
      return {
        ok: false,
        pricedLines: [],
        unpricedLines: [],
        errorMessage: "No valid items to price",
      };
    }
    
    // Convert to SRS format
    const productList = normalizedLines.map((item) => {
      const payloadItem = {
        productName: item.title || "",
        quantity: item.quantity,
        uom: item.uom,
      };
      
      // SRS can use productId (numeric) or itemCode (SKU string)
      const productId = Number(item.sku);
      if (Number.isFinite(productId) && productId > 0) {
        payloadItem.productId = productId;
      } else {
        payloadItem.itemCode = item.sku;
      }
      
      return payloadItem;
    });
    
    const fullOrder = payload?.fullOrder || {};
    const requestPayload = {
      sourceSystem: fullOrder.sourceSystem || "RHINO",
      customerCode: fullOrder.customerCode || fullOrder.accountId || "RCO207",
      branchCode: fullOrder.branchCode || "SSSAN",
      transactionId: fullOrder.transactionId || `SPR-${Date.now()}`,
      jobAccountNumber: Number(fullOrder.jobAccountNumber || fullOrder.jobNumber || 1) || 1,
      productList,
    };
    
    const response = await axios.post(
      `${config.baseUrl}/products/v2/price`,
      requestPayload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
    
    const productList = response.data?.productList || [];
    const pricedLines = [];
    const unpricedLines = [];
    
    // Create map of normalized items by SKU/productId
    const itemMap = new Map();
    normalizedLines.forEach(item => {
      itemMap.set(item.sku, item);
    });
    
    productList.forEach((product, index) => {
      const sku = product.itemCode || String(product.productId || "");
      const normalizedItem = itemMap.get(sku) || normalizedLines[index] || {};
      const lineId = normalizedItem.lineId || String(index);
      const quantity = normalizedItem.quantity || 1;
      const uom = product.uom || normalizedItem.uom || "EA";
      const unitPrice = product.unitPrice || product.price || 0;
      
      // Check if unpriced
      const isUnpriced = product.error || 
                        unitPrice === 0 ||
                        product.message?.toLowerCase().includes("call for pricing") ||
                        product.message?.toLowerCase().includes("not found");
      
      if (isUnpriced) {
        unpricedLines.push({
          lineId,
          sku,
          quantity,
          uom,
          reason: "CALL_FOR_PRICING",
          message: product.message || product.error || "Call for pricing",
        });
      } else {
        const extendedPrice = unitPrice * quantity;
        pricedLines.push({
          lineId,
          sku,
          quantity,
          uom,
          unitPrice,
          extendedPrice,
        });
      }
    });
    
    // Handle items not in response
    const respondedSkus = new Set(productList.map(p => p.itemCode || String(p.productId || "")));
    normalizedLines.forEach((item, index) => {
      if (!respondedSkus.has(item.sku)) {
        unpricedLines.push({
          lineId: item.lineId || String(index),
          sku: item.sku,
          quantity: item.quantity,
          uom: item.uom,
          reason: "NOT_AVAILABLE",
          message: "Product not found in pricing response",
        });
      }
    });
    
    return {
      ok: true,
      pricedLines,
      unpricedLines,
    };
  } catch (error) {
    return {
      ok: false,
      pricedLines: [],
      unpricedLines: [],
      errorMessage: error.response?.data?.error || error.response?.data?.message || error.message,
    };
  }
}

// Order dry run (never hits supplier)
async function orderDryRun(env, payload, normalizedLines) {
  try {
    if (!normalizedLines || normalizedLines.length === 0) {
      return {
        ok: false,
        dryRunResult: null,
        errorMessage: "No valid items to order",
      };
    }
    
    return {
      ok: true,
      dryRunResult: {
        message: "Order validation successful (dry run)",
        supplierKey: "SRS",
        env,
        lineCount: normalizedLines.length,
        lines: normalizedLines.map(item => ({
          lineId: item.lineId,
          sku: item.sku,
          quantity: item.quantity,
          uom: item.uom,
        })),
      },
    };
  } catch (error) {
    return {
      ok: false,
      dryRunResult: null,
      errorMessage: error.message || "SRS orderDryRun failed",
    };
  }
}

// Submit order
async function order(env, payload, normalizedLines) {
  try {
    const config = getSupplierConfig("SRS", env);
    const token = await getToken(config);
    
    if (!normalizedLines || normalizedLines.length === 0) {
      return {
        ok: false,
        orderResult: null,
        errorMessage: "No valid items to order",
      };
    }
    
    // Format for SRS order API (simplified - adjust based on actual API)
    const productList = normalizedLines.map((item) => {
      const payloadItem = {
        productName: item.title || "",
        quantity: item.quantity,
        uom: item.uom,
      };
      
      const productId = Number(item.sku);
      if (Number.isFinite(productId) && productId > 0) {
        payloadItem.productId = productId;
      } else {
        payloadItem.itemCode = item.sku;
      }
      
      return payloadItem;
    });
    
    const fullOrder = payload?.fullOrder || {};
    const requestPayload = {
      sourceSystem: fullOrder.sourceSystem || "RHINO",
      customerCode: fullOrder.customerCode || fullOrder.accountId || "RCO207",
      branchCode: fullOrder.branchCode || "SSSAN",
      transactionId: fullOrder.transactionId || `ORD-${Date.now()}`,
      jobAccountNumber: Number(fullOrder.jobAccountNumber || fullOrder.jobNumber || 1) || 1,
      productList,
    };
    
    const response = await axios.post(
      `${config.baseUrl}/orders/v2/orders`,
      requestPayload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
    
    return {
      ok: true,
      orderResult: response.data,
    };
  } catch (error) {
    return {
      ok: false,
      orderResult: null,
      errorMessage: error.response?.data?.error || 
                   error.response?.data?.message || 
                   error.response?.statusText || 
                   error.message,
    };
  }
}

module.exports = {
  login,
  getPricing,
  order,
  orderDryRun,
};
