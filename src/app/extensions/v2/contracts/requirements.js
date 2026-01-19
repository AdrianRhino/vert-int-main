import { CAPABILITIES } from "./capabilities";

export function getMissingFields(step, state) {
  const missing = [];

  if (step === 1) {
    if (!state.orderType) missing.push("orderType");
  }

  if (step === 2) {
    if (!state.supplierKey) missing.push("supplierKey");
    if (!state.templateId) missing.push("templateId");
    if (!state.ticketId) missing.push("ticketId");
  }

  if (step === 3) {
    const lines = state.lines || [];
    if (lines.length === 0) missing.push("cartLines");
  }

  if (step === 4) {
   const supplierKey = state.supplierKey || "";
   const requires = CAPABILITIES[supplierKey]?.pricing?.requires || [];
   const ctx = state.context || {};

   for (const key of requires) {
    if (!String(ctx[key] || "").trim()) missing.push("context." + key);
  }

  if (!state.pricing) missing.push("pricing");
}

  if (step === 5) {
    if (!state.hubspot || state.hubspot.ok !== true) missing.push("hubspot.ok");
  }

  return missing;
}
