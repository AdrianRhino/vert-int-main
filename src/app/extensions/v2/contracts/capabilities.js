export const CAPABILITIES = {
    ABC: { pricing: { requires: ["branchId", "shipTo"] }, order: { requires: ["branchId", "shipTo"] } },
    SRS: { pricing: { requires: ["accountId"] }, order: { requires: ["accountId"] } },
    BEACON: { pricing: { requires: ["branchId"] }, order: { requires: ["branchId"] } },
};