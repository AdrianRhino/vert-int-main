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

  return missing;
}
