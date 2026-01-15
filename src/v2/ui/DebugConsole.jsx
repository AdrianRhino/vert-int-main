/**
 * V2 Debug Console - Receipt viewer
 * Shows all receipts from debugStore - one place to look when things break
 */

import React, { useState, useEffect } from "react";
import {
  Text,
  Heading,
  Button,
  Divider,
  Panel,
  PanelSection,
  PanelBody,
  TextArea,
  hubspot,
} from "@hubspot/ui-extensions";

const DebugConsole = ({ context, runServerless }) => {
  const [receipts, setReceipts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load receipts
  const loadReceipts = async () => {
    setIsLoading(true);
    try {
      const response = await runServerless({
        name: "getDebugReceiptsV2",
        parameters: { limit: 50 },
      });
      setReceipts(response.body?.receipts || []);
    } catch (error) {
      console.error("Error loading receipts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load on mount
  useEffect(() => {
    loadReceipts();
  }, []);

  // Get receipt color
  const getReceiptColor = (receipt) => {
    if (!receipt.result?.requestSucceeded) {
      return "red";
    }
    if (receipt.validation?.errors?.length > 0 || receipt.result?.requestErrors?.length > 0) {
      return "yellow";
    }
    return "green";
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <Panel>
      <PanelSection>
        <Heading>V2 Debug Console</Heading>
        <Text>One place to look when things break</Text>
        <Button
          type="button"
          onClick={loadReceipts}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </PanelSection>

      <PanelSection>
        <Divider />
        <Text>Total Receipts: {receipts.length}</Text>
      </PanelSection>

      <PanelSection>
        <Divider />
        {receipts.length === 0 ? (
          <Text>No receipts found</Text>
        ) : (
          receipts.map((receipt) => (
            <PanelBody key={receipt.id}>
              <Button
                type="button"
                onClick={() => setSelectedReceipt(selectedReceipt?.id === receipt.id ? null : receipt)}
                variant={selectedReceipt?.id === receipt.id ? "primary" : "secondary"}
              >
                <Text format={{ color: getReceiptColor(receipt) }}>
                  [{receipt.kind}] {receipt.supplierKey || "N/A"} - {receipt.env} - {formatTimestamp(receipt.timestamp)}
                </Text>
              </Button>
              {selectedReceipt?.id === receipt.id && (
                <PanelBody>
                  <Divider />
                  <Text format={{ fontWeight: "bold" }}>Receipt Details</Text>
                  <Text>ID: {receipt.id}</Text>
                  <Text>Kind: {receipt.kind}</Text>
                  <Text>Env: {receipt.env}</Text>
                  <Text>Supplier: {receipt.supplierKey || "N/A"}</Text>
                  <Text>Request Succeeded: {receipt.result?.requestSucceeded ? "Yes" : "No"}</Text>
                  
                  {receipt.validation?.errors?.length > 0 && (
                    <>
                      <Text format={{ fontWeight: "bold", color: "red" }}>Validation Errors:</Text>
                      {receipt.validation.errors.map((err, idx) => (
                        <Text key={idx} format={{ color: "red" }}>
                          {err.path}: {err.message}
                        </Text>
                      ))}
                    </>
                  )}
                  
                  {receipt.result?.requestErrors?.length > 0 && (
                    <>
                      <Text format={{ fontWeight: "bold", color: "red" }}>Request Errors:</Text>
                      {receipt.result.requestErrors.map((err, idx) => (
                        <Text key={idx} format={{ color: "red" }}>
                          {err.code}: {err.message}
                        </Text>
                      ))}
                    </>
                  )}
                  
                  {receipt.result?.summary && (
                    <>
                      <Text format={{ fontWeight: "bold" }}>Summary:</Text>
                      <Text>Requested: {receipt.result.summary.requested}</Text>
                      <Text>Priced: {receipt.result.summary.priced}</Text>
                      <Text>Unpriced: {receipt.result.summary.unpriced}</Text>
                    </>
                  )}
                  
                  {receipt.result?.pricedLines?.length > 0 && (
                    <>
                      <Text format={{ fontWeight: "bold", color: "green" }}>Priced Lines:</Text>
                      {receipt.result.pricedLines.slice(0, 5).map((line, idx) => (
                        <Text key={idx}>
                          {line.sku} x{line.quantity} @ ${line.unitPrice} = ${line.extendedPrice}
                        </Text>
                      ))}
                      {receipt.result.pricedLines.length > 5 && (
                        <Text>... and {receipt.result.pricedLines.length - 5} more</Text>
                      )}
                    </>
                  )}
                  
                  {receipt.result?.unpricedLines?.length > 0 && (
                    <>
                      <Text format={{ fontWeight: "bold", color: "yellow" }}>Unpriced Lines:</Text>
                      {receipt.result.unpricedLines.slice(0, 5).map((line, idx) => (
                        <Text key={idx}>
                          {line.sku} x{line.quantity} - {line.reason}: {line.message}
                        </Text>
                      ))}
                      {receipt.result.unpricedLines.length > 5 && (
                        <Text>... and {receipt.result.unpricedLines.length - 5} more</Text>
                      )}
                    </>
                  )}
                  
                  <TextArea
                    label="Full Receipt (JSON)"
                    value={JSON.stringify(receipt, null, 2)}
                    rows={15}
                    readOnly
                  />
                </PanelBody>
              )}
            </PanelBody>
          ))
        )}
      </PanelSection>
    </Panel>
  );
};

export default DebugConsole;
