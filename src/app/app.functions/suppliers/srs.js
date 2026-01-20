function ok200(body) {
    return { statusCode: 200, body };
}

exports.priceSRS = async ({ env, lines, supplierContext }) => {
    // TODO: Implement the actual pricing logic
    return ok200({ ok: true, priced: false, reasons: ["CALL_FOR_PRICING"] });
}