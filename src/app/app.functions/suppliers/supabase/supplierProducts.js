const axios = require("axios");

exports.main = async (context = {}) => {
  const { supplierKey, query } = context.parameters || {};
  const q = String(query || "").trim();

  // Keep existing “no query => no results” behavior to avoid huge scans
  if (q.length === 0) {
    return {
      status: "success",
      body: { ok: true, results: [] },
    };
  }

  const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return {
      status: "success",
      body: { ok: false, results: [] },
    };
  }

  try {
    const endpoint = `${SUPABASE_URL}/rest/v1/products`;

    // PostgREST params
    const params = {
      select: "*",
      limit: 25,
    };

    // Filter by supplier column if supplierKey provided
    // `ilike.X` is case-insensitive; no wildcards means "exact match ignoring case"
    if (supplierKey) {
      params.supplier = `eq.${supplierKey.toLowerCase()}`;
    }

    const resp = await axios.get(endpoint, {
      params,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Accept: "application/json",
      },
    });

    console.log("supplierProducts resp:", resp.data.length);

    const rows = Array.isArray(resp.data) ? resp.data : [];
   // console.log("supplierProducts rows:", rows);
    return {
      status: "success",
      body: { ok: true, results: rows },
    };
  } catch (err) {
       // IMPORTANT: log useful info WITHOUT leaking headers/secrets
       const details = {
        message: err?.message,
        code: err?.code,
        status: err?.response?.status,
        statusText: err?.response?.statusText,
        data: err?.response?.data,
      };
      console.error("supplierProducts Supabase REST error:", JSON.stringify(details, null, 2));
   
      return { status: "success", body: { ok: false, results: [] } };
  }
};
