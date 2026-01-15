/**
 * V2 Debug Store - In-memory receipt storage (ring buffer)
 * Simple array with max size
 */

const MAX_RECEIPTS = 50;

// Module-level array
const receipts = [];

/**
 * Push receipt to store, remove oldest if over limit
 */
function pushReceipt(receipt) {
  receipts.push(receipt);
  if (receipts.length > MAX_RECEIPTS) {
    receipts.shift(); // Remove oldest
  }
}

/**
 * List last N receipts (newest first)
 */
function listReceipts(limit) {
  const num = limit || 50;
  const start = Math.max(0, receipts.length - num);
  const result = receipts.slice(start);
  return result.reverse(); // Newest first
}

module.exports = {
  pushReceipt,
  listReceipts,
};
