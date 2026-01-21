const axios = require("axios");

function ok200(body) {
  return { statusCode: 200, body };
}  

exports.priceABC = async ({ env, lines, supplierContext }) => {

  // If ABC now only authorizes pricing via PROD creds, force prod here:
  const FORCE_PROD_PRICING_CREDS = true;
  const useProd = FORCE_PROD_PRICING_CREDS || env === "prod";

  const basicSandbox = Buffer.from(
    `${process.env.ABCClientSandbox}:${process.env.ABCClientSecretSandbox}`
  ).toString("base64");

  const basicProd = Buffer.from(
    `${process.env.ABCClient}:${process.env.ABCClientSecret}`
  ).toString("base64");

  const apiUrlAuth = useProd ? process.env.ABCurlProdAuth : process.env.ABCurlSandboxAuth;
  const apiUrl = useProd ? process.env.ABCurlProd : process.env.ABCurlSandbox;
  const basic = useProd ? basicProd : basicSandbox;

  if (!basic || !apiUrlAuth || !apiUrl) {
    return ok200({ ok: false, priced: false, reasons: ["MISSING_API_KEY_OR_URL"] });
  }

  try {
    const payload = {
      branchId: supplierContext.branchId,
      shipTo: supplierContext.shipTo,
      items: lines.map((l) => ({
        sku: l.sku,
        qty: l.quantity,
        uom: (l.uom || "EA").toUpperCase(),
      })),
    };

    // OAuth token request: form-encoded
    const tokenBody = new URLSearchParams({
      grant_type: "client_credentials",
      scope: "pricing.read",
    }).toString();

    const authResp = await axios.post(`${apiUrlAuth}/v1/token`, tokenBody, {
      headers: {
        Authorization: `Basic ${basic}`, 
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
    });

    const token = authResp?.data?.access_token;
    if (!token) {
      return ok200({ ok: false, priced: false, reasons: ["MISSING_ACCESS_TOKEN"] });
    }

    const resp = await axios.post(`${apiUrl}/api/pricing/v2/prices`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });


    // Don’t put SUCCESS in reasons; reasons should be for “why not priced”
    return ok200({ ok: true, priced: true, reasons: [], data: resp.data });
  } catch (error) {
   
    // inside catch
const status = error?.response?.status;
const data = error?.response?.data;
const url = error?.config?.url;

console.error("[ABC pricing error]", JSON.stringify({ status, url, data }, null, 2));

return ok200({
  ok: false,
  priced: false,
  reasons: ["TECHNICAL_FAILURE"],
  error: JSON.stringify({ status, url, data }, null, 2),
});
  }
};
