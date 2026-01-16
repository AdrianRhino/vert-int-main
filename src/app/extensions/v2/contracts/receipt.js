export function makeRunId() {
    return "run_" + Math.random().toString(16).slice(2);
}

export function makeReceipt(kind, env) {
    return {
        runId: makeRunId(),
        timestamp: new Date().toISOString(),
        kind: kind || "UNKNOWN",
        env: env || "sandbox",
        steps: [],
        errors: []
    };
}

export function addStep(receipt, name, ok, why) {
receipt.steps.push({
    name: name || "STEP",
    ok: ok === true,
    why: why || ""
});
return receipt;
}

export function addError(receipt, code, message) {
    receipt.errors.push({
        code: code || "ERROR",
        message: message || ""
    });
    return receipt;
}