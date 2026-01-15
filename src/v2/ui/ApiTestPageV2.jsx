/**
 * V2 API Test Page - Simple testing interface for V2 doors
 * Displays Receipt objects - "Receipt is truth"
 */

import React, { useState } from "react";
import {
  Text,
  Heading,
  Button,
  Divider,
  Select,
  Input,
  TextArea,
  Checkbox,
} from "@hubspot/ui-extensions";

const ApiTestPageV2 = ({ context, runServerless }) => {
  // Debug: log to verify component is being called
  console.log("ApiTestPageV2 rendering", { hasContext: !!context, hasRunServerless: !!runServerless });
  
  // State
  const [supplierKey, setSupplierKey] = useState("ABC");
  const [env, setEnv] = useState("sandbox");
  const [branchNumber, setBranchNumber] = useState("461");
  const [shipToNumber, setShipToNumber] = useState("2063975-2");
  const [lineItemsJson, setLineItemsJson] = useState(JSON.stringify([
    { sku: "0110004585", quantity: 10, uom: "EA" }
  ], null, 2));
  const [liveOrder, setLiveOrder] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Parse line items
  const parseLineItems = () => {
    try {
      return JSON.parse(lineItemsJson);
    } catch (error) {
      return [];
    }
  };

  // Test login
  const testLogin = async () => {
    setIsLoading(true);
    try {
      const response = await runServerless({
        name: "supplierProxyV2",
        parameters: {
          supplierKey,
          env,
          action: "login",
          payload: {},
        },
      });
      // HubSpot returns response directly or wrapped in body
      const receipt = response?.body || response;
      setReceipt(receipt);
    } catch (error) {
      setReceipt({
        id: "error",
        timestamp: new Date().toISOString(),
        kind: "ERROR",
        result: {
          requestSucceeded: false,
          requestErrors: [{ code: "ERROR", message: error.message }],
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test getPricing
  const testGetPricing = async () => {
    setIsLoading(true);
    try {
      const lineItems = parseLineItems();
      const response = await runServerless({
        name: "supplierProxyV2",
        parameters: {
          supplierKey,
          env,
          action: "getPricing",
          payload: {
            context: {
              branchNumber,
              shipToNumber,
            },
            fullOrder: {
              fullOrderItems: lineItems,
            },
          },
        },
      });
      // HubSpot returns response directly or wrapped in body
      const receipt = response?.body || response;
      setReceipt(receipt);
    } catch (error) {
      setReceipt({
        id: "error",
        timestamp: new Date().toISOString(),
        kind: "ERROR",
        result: {
          requestSucceeded: false,
          requestErrors: [{ code: "ERROR", message: error.message }],
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test orderDryRun
  const testOrderDryRun = async () => {
    setIsLoading(true);
    try {
      const lineItems = parseLineItems();
      const response = await runServerless({
        name: "supplierProxyV2",
        parameters: {
          supplierKey,
          env,
          action: "orderDryRun",
          payload: {
            context: {
              branchNumber,
              shipToNumber,
            },
            fullOrder: {
              fullOrderItems: lineItems,
            },
          },
        },
      });
      // HubSpot returns response directly or wrapped in body
      const receipt = response?.body || response;
      setReceipt(receipt);
    } catch (error) {
      setReceipt({
        id: "error",
        timestamp: new Date().toISOString(),
        kind: "ERROR",
        result: {
          requestSucceeded: false,
          requestErrors: [{ code: "ERROR", message: error.message }],
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test order
  const testOrder = async () => {
    setIsLoading(true);
    try {
      const lineItems = parseLineItems();
      const response = await runServerless({
        name: "supplierProxyV2",
        parameters: {
          supplierKey,
          env,
          action: "order",
          payload: {
            context: {
              branchNumber,
              shipToNumber,
            },
            fullOrder: {
              fullOrderItems: lineItems,
            },
            liveOrder: liveOrder,
            confirmationText: confirmationText,
          },
        },
      });
      // HubSpot returns response directly or wrapped in body
      const receipt = response?.body || response;
      setReceipt(receipt);
    } catch (error) {
      setReceipt({
        id: "error",
        timestamp: new Date().toISOString(),
        kind: "ERROR",
        result: {
          requestSucceeded: false,
          requestErrors: [{ code: "ERROR", message: error.message }],
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test submitPipeline
  const testSubmitPipeline = async () => {
    setIsLoading(true);
    try {
      const lineItems = parseLineItems();
      const response = await runServerless({
        name: "submitOrderPipelineV2",
        parameters: {
          dealId: context.objectId || "test-deal",
          supplierKey,
          env,
          context: {
            branchNumber,
            shipToNumber,
          },
          rawLineItems: lineItems,
          liveOrder: liveOrder,
          confirmationText: confirmationText,
        },
      });
      // HubSpot returns response directly or wrapped in body
      const receipt = response?.body || response;
      setReceipt(receipt);
    } catch (error) {
      setReceipt({
        id: "error",
        timestamp: new Date().toISOString(),
        kind: "ERROR",
        result: {
          requestSucceeded: false,
          requestErrors: [{ code: "ERROR", message: error.message }],
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Safety check - ensure runServerless is available
  if (!runServerless) {
    return (
      <>
        <Text format={{ color: "red" }}>Error: runServerless function not available</Text>
      </>
    );
  }

  return (
    <>
      <Heading>V2 API Test Page</Heading>
      <Text>Simple testing interface - Receipt is truth</Text>
      <Divider />

      <Divider />
      <Select
          label="Supplier"
          value={supplierKey}
          onChange={(value) => setSupplierKey(value)}
          options={[
            { label: "ABC", value: "ABC" },
            { label: "SRS", value: "SRS" },
            { label: "BEACON", value: "BEACON" },
          ]}
        />
        <Select
          label="Environment"
          value={env}
          onChange={(value) => setEnv(value)}
          options={[
            { label: "Sandbox", value: "sandbox" },
            { label: "Production", value: "prod" },
          ]}
        />

      {supplierKey === "ABC" && (
        <>
          <Divider />
          <Input
            label="Branch Number"
            value={branchNumber}
            onInput={(value) => setBranchNumber(value)}
          />
          <Input
            label="Ship To Number"
            value={shipToNumber}
            onInput={(value) => setShipToNumber(value)}
          />
        </>
      )}

      <Divider />
      <TextArea
          label="Line Items (JSON)"
          value={lineItemsJson}
          onInput={(value) => setLineItemsJson(value)}
          rows={5}
        />

      {env === "prod" && (
        <>
          <Divider />
          <Checkbox
            label="Live Order"
            checked={liveOrder}
            onChange={(checked) => setLiveOrder(checked)}
          />
          <Input
            label="Confirmation Text (must be 'PLACE LIVE ORDER')"
            value={confirmationText}
            onInput={(value) => setConfirmationText(value)}
          />
        </>
      )}

      <Divider />
      <Button
          type="button"
          onClick={testLogin}
          disabled={isLoading}
        >
          Login
        </Button>
        <Button
          type="button"
          onClick={testGetPricing}
          disabled={isLoading}
        >
          Get Pricing
        </Button>
        <Button
          type="button"
          onClick={testOrderDryRun}
          disabled={isLoading}
        >
          Order Dry Run
        </Button>
        <Button
          type="button"
          onClick={testOrder}
          disabled={isLoading}
        >
          Order
        </Button>
        <Button
          type="button"
          onClick={testSubmitPipeline}
          disabled={isLoading}
        >
          Submit Pipeline
        </Button>

      {receipt && (
        <>
          <Divider />
          <Heading>Receipt</Heading>
            <Text format={{ fontWeight: "bold" }}>Kind: {receipt.kind}</Text>
            <Text>Env: {receipt.env}</Text>
            <Text>Supplier: {receipt.supplierKey}</Text>
            <Text>Request Succeeded: {receipt.result?.requestSucceeded ? "Yes" : "No"}</Text>
            {receipt.validation?.errors?.length > 0 && (
              <Text format={{ color: "red" }}>
                Validation Errors: {receipt.validation.errors.length}
              </Text>
            )}
            {receipt.result?.requestErrors?.length > 0 && (
              <Text format={{ color: "red" }}>
                Request Errors: {receipt.result.requestErrors.length}
              </Text>
            )}
            {receipt.result?.summary && (
              <Text>
                Summary: {receipt.result.summary.priced} priced, {receipt.result.summary.unpriced} unpriced
              </Text>
            )}
            <TextArea
              label="Full Receipt (JSON)"
              value={JSON.stringify(receipt, null, 2)}
              rows={20}
              readOnly
            />
        </>
      )}
    </>
  );
};

export default ApiTestPageV2;
