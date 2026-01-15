/**
 * V2 Simple Credentials - Reads from credentials.json and process.env
 * Simple version for V2 - no master environment file needed
 */

const fs = require("fs");
const path = require("path");

/**
 * Gets credentials for a supplier based on environment
 */
function getCredentials(supplierName, environment = null) {
  // Normalize environment
  if (!environment) {
    environment = "prod"; // Default to prod
  }
  
  // Load credentials registry
  const credentialsPath = path.join(__dirname, "credentials.json");
  let credentialsRegistry;
  
  try {
    const credentialsData = fs.readFileSync(credentialsPath, "utf8");
    credentialsRegistry = JSON.parse(credentialsData);
  } catch (error) {
    console.error(`Error reading credentials.json: ${error.message}`);
    throw new Error("Credentials registry not found. Please create suppliers/config/credentials.json");
  }

  // Validate supplier exists
  if (!credentialsRegistry[supplierName]) {
    throw new Error(`Supplier ${supplierName} not found in credentials registry`);
  }

  // Get credential config for supplier + environment
  const credentialConfig = credentialsRegistry[supplierName][environment];
  
  if (!credentialConfig) {
    throw new Error(
      `Environment "${environment}" not found for supplier ${supplierName}`
    );
  }

  // Build credential object
  const credentials = {
    environment,
    authUrl: credentialConfig.authUrl,
    apiBaseUrl: credentialConfig.apiBaseUrl,
  };

  // ABC and SRS use clientId/clientSecret
  if (credentialConfig.clientIdEnv && credentialConfig.clientSecretEnv) {
    credentials.clientId = process.env[credentialConfig.clientIdEnv];
    credentials.clientSecret = process.env[credentialConfig.clientSecretEnv];
    
    if (!credentials.clientId || !credentials.clientSecret) {
      console.warn(
        `Missing credentials for ${supplierName} ${environment}: ` +
        `${credentialConfig.clientIdEnv}, ${credentialConfig.clientSecretEnv}`
      );
    }
  }

  // BEACON uses username/password
  if (credentialConfig.usernameEnv && credentialConfig.passwordEnv) {
    credentials.username = process.env[credentialConfig.usernameEnv];
    credentials.password = process.env[credentialConfig.passwordEnv];
    
    if (!credentials.username || !credentials.password) {
      console.warn(
        `Missing credentials for ${supplierName} ${environment}: ` +
        `${credentialConfig.usernameEnv}, ${credentialConfig.passwordEnv}`
      );
    }
    
    if (credentialConfig.apiSiteId) {
      credentials.apiSiteId = credentialConfig.apiSiteId;
    }
  }

  return credentials;
}

module.exports = { getCredentials };
