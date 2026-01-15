/**
 * V2 Beacon Building Products - Supplier Adapter
 * Simple functions: login, getPricing, order, orderDryRun
 */

const axios = require("axios");
const { getSupplierConfig } = require("./config");
const { normalizeLineItems } = require("../normalize/normalizeLineItems");

// Get cookies (login helper)
async function getCookies(config) {
  const response = await axios.post(
    `${config.baseUrl}/v1/rest/com/becn/login`,
    {
      username: config.username,
      password: config.password,
      siteId: "homeSite",
      persistentLoginType: "RememberMe",
      userAgent: "desktop",
      apiSiteId: config.apiSiteId || "UAT",
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  
  const cookies = response.headers["set-cookie"]?.join("; ") || "";
  if (!cookies) {
    throw new Error("BEACON: No cookies returned from login");
  }
  
  return cookies;
}

// Login action
async function login(env, payload) {
  try {
    const config = getSupplierConfig("BEACON", env);
    const cookies = await getCookies(config);
    
    return {
      ok: true,
      cookies: cookies,
      environment: config.environment,
    };
  } catch (error) {
    return {
      ok: false,
      errorMessage: error.message || "BEACON login failed",
    };
  }
}

// Get pricing
async function getPricing(env, payload, normalizedLines) {
  try {
    const config = getSupplierConfig("BEACON", env);
    const cookies = await getCookies(config);
    
    if (!normalizedLines || normalizedLines.length === 0) {
      return {
        ok: false,
        pricedLines: [],
        unpricedLines: [],
        errorMessage: "No valid items to price",
      };
    }
    
    // Convert to BEACON format (comma-separated SKU list)
    const skuIds = normalizedLines.map((item) => item.sku).join(",");
    
    const response = await axios.get(
      `${config.baseUrl}/v1/rest/com/becn/pricing`,
      {
        headers: {
          Cookie: cookies,
        },
        params: {
          skuIds: skuIds,
        },
      }
    );
    
    const responseData = response.data;
    const priceInfo = responseData.priceInfo || {};
    const message = responseData.message || "";
    
    // Extract invalid SKUs from message
    const invalidSkus = message.match(/These skuIds (.+) are invalid/)?.[1]
      ?.split(",")
      .map(s => s.trim()) || [];
    
    const pricedLines = [];
    const unpricedLines = [];
    
    normalizedLines.forEach((normalizedItem) => {
      const lineId = normalizedItem.lineId;
      const sku = normalizedItem.sku;
      const quantity = normalizedItem.quantity;
      const requestedUom = normalizedItem.uom || "EA";
      
      // Try exact SKU match, then base SKU (handle "SKU - variant" format)
      const baseSku = sku.split(" - ")[0].trim();
      const itemPriceInfo = priceInfo[sku] || priceInfo[baseSku];
      
      if (itemPriceInfo && typeof itemPriceInfo === "object") {
        // Found priceInfo for this SKU
        const availableUoms = Object.keys(itemPriceInfo).filter(uom => {
          const price = itemPriceInfo[uom];
          return price !== undefined && price !== null && price !== "" && Number(price) > 0;
        });
        
        if (availableUoms.length > 0) {
          // Try requested UOM first, then first available
          let matchedUom = requestedUom.toUpperCase();
          let unitPrice = itemPriceInfo[matchedUom];
          
          if (!unitPrice || unitPrice === 0) {
            matchedUom = availableUoms[0];
            unitPrice = itemPriceInfo[matchedUom];
          }
          
          if (unitPrice && Number(unitPrice) > 0) {
            // Priced line
            const extendedPrice = Number(unitPrice) * quantity;
            pricedLines.push({
              lineId,
              sku,
              quantity,
              uom: matchedUom,
              unitPrice: Number(unitPrice),
              extendedPrice,
            });
          } else {
            // Unpriced - no valid price found
            unpricedLines.push({
              lineId,
              sku,
              quantity,
              uom: requestedUom,
              reason: "CALL_FOR_PRICING",
              message: "Price unavailable for requested UOM",
            });
          }
        } else {
          // Unpriced - priceInfo exists but no valid prices
          unpricedLines.push({
            lineId,
            sku,
            quantity,
            uom: requestedUom,
            reason: "CALL_FOR_PRICING",
            message: "No valid prices found in priceInfo",
          });
        }
      } else if (invalidSkus.includes(sku) || invalidSkus.includes(baseSku)) {
        // Unpriced - SKU is invalid
        unpricedLines.push({
          lineId,
          sku,
          quantity,
          uom: requestedUom,
          reason: "INVALID_INPUT",
          message: "Invalid SKU",
        });
      } else {
        // Unpriced - SKU not found in priceInfo
        unpricedLines.push({
          lineId,
          sku,
          quantity,
          uom: requestedUom,
          reason: "NOT_AVAILABLE",
          message: "SKU not found in pricing response",
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
        supplierKey: "BEACON",
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
      errorMessage: error.message || "BEACON orderDryRun failed",
    };
  }
}

// Submit order
async function order(env, payload, normalizedLines) {
  try {
    const config = getSupplierConfig("BEACON", env);
    const cookies = await getCookies(config);
    
    if (!normalizedLines || normalizedLines.length === 0) {
      return {
        ok: false,
        orderResult: null,
        errorMessage: "No valid items to order",
      };
    }
    
    // Format for BEACON order API (simplified - adjust based on actual API)
    const orderItems = normalizedLines.map((item) => ({
      sku: item.sku,
      quantity: item.quantity,
      uom: item.uom,
    }));
    
    const requestPayload = {
      items: orderItems,
      // Add other required fields from payload
    };
    
    const response = await axios.post(
      `${config.baseUrl}/v1/rest/com/becn/order`,
      requestPayload,
      {
        headers: {
          Cookie: cookies,
          "Content-Type": "application/json",
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
