/**
 * V2 ABC Supply - Supplier Adapter
 * Simple functions: login, getPricing, order, orderDryRun
 */

const axios = require("axios");
const { getSupplierConfig } = require("./config");
const { normalizeLineItems } = require("../normalize/normalizeLineItems");

// Get token (login helper)
async function getToken(config) {
  const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const authUrl = config.authUrl.split("?")[0];
  
  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("scope", "product.read pricing.read location.read account.read order.write");
  
  const response = await axios.post(authUrl, params.toString(), {
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  
  const token = response.data.access_token;
  if (!token) {
    throw new Error("ABC: No token returned from login");
  }
  
  return token;
}

// Login action
async function login(env, payload) {
  try {
    const config = getSupplierConfig("ABC", env);
    const token = await getToken(config);
    
    return {
      ok: true,
      access_token: token,
      environment: config.environment,
    };
  } catch (error) {
    return {
      ok: false,
      errorMessage: error.message || "ABC login failed",
    };
  }
}

// Get pricing
async function getPricing(env, payload, normalizedLines) {
  try {
    const config = getSupplierConfig("ABC", env);
    const token = await getToken(config);
    
    const context = payload?.context || {};
    const branchNumber = context.branchNumber;
    const shipToNumber = context.shipToNumber;
    
    if (!branchNumber || !shipToNumber) {
      return {
        ok: false,
        pricedLines: [],
        unpricedLines: [],
        errorMessage: "ABC requires branchNumber and shipToNumber in payload.context",
      };
    }
    
    if (!normalizedLines || normalizedLines.length === 0) {
      return {
        ok: false,
        pricedLines: [],
        unpricedLines: [],
        errorMessage: "No valid items to price",
      };
    }
    
    // Convert to ABC format
    const formattedItems = normalizedLines.map((item) => ({
      id: item.lineId,
      itemNumber: item.sku,
      quantity: item.quantity,
      uom: item.uom,
    }));
    
    const pricingUrl = `${config.baseUrl}/api/pricing/v2/prices`;
    const requestData = {
      branchNumber: String(branchNumber),
      shipToNumber: String(shipToNumber),
      requestId: `Pricing-${Date.now()}`,
      purpose: "estimating",
      lines: formattedItems,
    };
    
    const response = await axios.post(pricingUrl, requestData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    
    const lines = response.data?.lines || [];
    const pricedLines = [];
    const unpricedLines = [];
    
    lines.forEach((line, index) => {
      const normalizedItem = normalizedLines[index] || {};
      const lineId = normalizedItem.lineId || String(index);
      const quantity = line.quantity || normalizedItem.quantity || 1;
      const uom = line.uom || normalizedItem.uom || "EA";
      const unitPrice = line.unitPrice || 0;
      const statusCode = line.status?.code || "";
      const statusMessage = (line.status?.message || "").toLowerCase();
      
      // Check if unpriced
      const isUnpriced = statusCode === "Error" || 
                        unitPrice === 0 ||
                        statusMessage.includes("call for pricing") ||
                        statusMessage.includes("cannot price") ||
                        statusMessage.includes("pricing not entered");
      
      if (isUnpriced) {
        unpricedLines.push({
          lineId,
          sku: line.itemNumber || normalizedItem.sku || "",
          quantity,
          uom,
          reason: "CALL_FOR_PRICING",
          message: line.status?.message || "Call for pricing",
        });
      } else {
        const extendedPrice = unitPrice * quantity;
        pricedLines.push({
          lineId,
          sku: line.itemNumber || normalizedItem.sku || "",
          quantity,
          uom,
          unitPrice,
          extendedPrice,
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
    const context = payload?.context || {};
    const branchNumber = context.branchNumber;
    const shipToNumber = context.shipToNumber;
    
    if (!branchNumber || !shipToNumber) {
      return {
        ok: false,
        dryRunResult: null,
        errorMessage: "ABC requires branchNumber and shipToNumber in payload.context",
      };
    }
    
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
        supplierKey: "ABC",
        env,
        branchNumber,
        shipToNumber,
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
      errorMessage: error.message || "ABC orderDryRun failed",
    };
  }
}

// Submit order
async function order(env, payload, normalizedLines) {
  try {
    const config = getSupplierConfig("ABC", env);
    const token = await getToken(config);
    
    const context = payload?.context || {};
    const branchNumber = context.branchNumber;
    const shipToNumber = context.shipToNumber;
    
    if (!branchNumber || !shipToNumber) {
      return {
        ok: false,
        orderResult: null,
        errorMessage: "ABC requires branchNumber and shipToNumber in payload.context",
      };
    }
    
    if (!normalizedLines || normalizedLines.length === 0) {
      return {
        ok: false,
        orderResult: null,
        errorMessage: "No valid items to order",
      };
    }
    
    // Format lines according to ABC API
    const lines = normalizedLines.map((item) => ({
      id: parseInt(item.lineId) || Math.floor(Math.random() * 1000000),
      itemNumber: item.sku,
      orderedQty: {
        value: item.quantity,
        uom: item.uom,
      },
    }));
    
    const requestData = {
      requestId: `Order-${Date.now()}`,
      branchNumber: String(branchNumber),
      typeCode: "SO",
      deliveryService: context?.deliveryService || payload?.deliveryService || "OTG",
      shipTo: {
        number: String(shipToNumber),
        name: context?.shipToName || payload?.shipToName || "ABC Supply",
        address: context?.shipToAddress || payload?.shipToAddress || {
          line1: "",
          city: "",
          state: "",
          postal: "",
          country: "USA",
        },
        contacts: context?.shipToContacts || payload?.shipToContacts || [],
      },
      lines: lines,
    };
    
    const response = await axios.post(
      `${config.baseUrl}/api/order/v2/orders`,
      requestData,
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
