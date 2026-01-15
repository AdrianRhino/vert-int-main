/**
 * V2 Supplier Config - Simple wrapper for credentials
 * Tries to use existing getCredentials, falls back to env vars
 */

let getCredentials = null;
try {
  // Try to use existing credentials system
  const credentialsModule = require("../../app/app.functions/suppliers/config/getCredentials");
  getCredentials = credentialsModule.getCredentials;
} catch (error) {
  // Fallback: use environment variables directly
  console.log("V2: Credentials system not found, will use environment variables or HubSpot secrets");
}

/**
 * Get supplier config for V2
 */
function getSupplierConfig(supplierKey, env) {
  if (env !== "sandbox" && env !== "prod") {
    throw new Error(`Invalid environment: ${env}. Must be "sandbox" or "prod"`);
  }

  if (getCredentials) {
    // Use existing system
    const credentials = getCredentials(supplierKey, env === "prod" ? "prod" : null);
    return {
      environment: credentials.environment || env,
      baseUrl: credentials.apiBaseUrl,
      authUrl: credentials.authUrl,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      username: credentials.username,
      password: credentials.password,
      apiSiteId: credentials.apiSiteId,
    };
  } else {
    // Fallback: Try HubSpot secrets first, then env vars
    // HubSpot serverless functions have access to secrets via context.secrets
    // For now, use environment variables pattern
    // Note: In HubSpot, secrets are accessed via context.secrets in serverless functions
    // This will be passed through from the serverless function context
    
    const config = {
      environment: env,
      baseUrl: process.env[`${supplierKey}_BASE_URL_${env.toUpperCase()}`] || "",
      authUrl: process.env[`${supplierKey}_AUTH_URL_${env.toUpperCase()}`] || "",
      clientId: process.env[`${supplierKey}_CLIENT_ID_${env.toUpperCase()}`] || "",
      clientSecret: process.env[`${supplierKey}_CLIENT_SECRET_${env.toUpperCase()}`] || "",
      username: process.env[`${supplierKey}_USERNAME_${env.toUpperCase()}`] || "",
      password: process.env[`${supplierKey}_PASSWORD_${env.toUpperCase()}`] || "",
      apiSiteId: process.env[`${supplierKey}_SITE_ID_${env.toUpperCase()}`] || "",
    };
    
    // If no credentials found, throw helpful error
    if (!config.clientId && !config.username) {
      throw new Error(
        `V2: No credentials found for ${supplierKey} ${env}. ` +
        `Please set up credentials in suppliers/config/getCredentials.js or set environment variables. ` +
        `Required: ${supplierKey}_CLIENT_ID_${env.toUpperCase()} and ${supplierKey}_CLIENT_SECRET_${env.toUpperCase()} ` +
        `(or ${supplierKey}_USERNAME_${env.toUpperCase()} and ${supplierKey}_PASSWORD_${env.toUpperCase()} for BEACON)`
      );
    }
    
    return config;
  }
}

module.exports = {
  getSupplierConfig,
};
