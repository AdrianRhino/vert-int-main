const axios = require("axios");

function ok200(body) {
  return { statusCode: 200, body };
}

function logAxiosError(prefix, err) {
  const details = {
    message: err?.message,
    code: err?.code,
    status: err?.response?.status,
    statusText: err?.response?.statusText,
    data: err?.response?.data,
  };
  console.error(prefix, JSON.stringify(details, null, 2));
}

function printDebug(env, lines, supplierContext) {
    console.log(
      "ABC pricing debug:",
      JSON.stringify(
        { env, lineCount: lines?.length, firstLine: lines?.[0], supplierContext },
        null,
        2
      )
    );
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
        uom: l.uom,
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

    printDebug(env, lines, supplierContext);


    // Don’t put SUCCESS in reasons; reasons should be for “why not priced”
    return ok200({ ok: true, priced: true, reasons: [], data: resp.data });
  } catch (error) {
    logAxiosError("ABC pricing exception:", error);
    printDebug(env, lines, supplierContext);
    return ok200({
      ok: false,
      priced: false,
      reasons: ["TECHNICAL_FAILURE"],
      error: error?.message || "ABC pricing failed",
    });
  }
};
