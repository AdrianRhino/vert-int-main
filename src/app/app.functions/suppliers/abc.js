function ok200(body) {
    return { statusCode: 200, body };
  }
  
  exports.priceABC = async ({ env, lines, supplierContext }) => {
    console.error(
      "priceABC reached:",
      JSON.stringify(
        {
          env,
          lineCount: Array.isArray(lines) ? lines.length : 0,
          firstLine: Array.isArray(lines) ? lines[0] : null,
          supplierContext,
        },
        null,
        2
      )
    );
  
    return ok200({
      ok: true,
      priced: false,
      reasons: ["ABC_PROVIDER_REACHED"], // proves routing works
    });
  };
  