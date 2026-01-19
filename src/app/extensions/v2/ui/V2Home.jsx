import React, { useMemo, useEffect, useState } from "react";
import { Text, Select, Input, Button, Divider } from "@hubspot/ui-extensions";
import { makeReceipt, addStep } from "../contracts/receipt";
import { makeWizardState } from "../contracts/wizardState";
import { getMissingFields } from "../contracts/requirements";
import { mapProductToLine } from "../mappers/mapProductToLine";

export default function V2Home({ runServerless }) {
  const [wizard, setWizard] = useState(() => makeWizardState());
  const [actionSteps, setActionSteps] = useState([]);

  const missing = useMemo(() => {
    return getMissingFields(wizard.step, wizard);
  }, [wizard]);

  const receipt = useMemo(() => {
    const r = makeReceipt("V2_WIZARD", wizard.env);
  
    addStep(r, "RENDER_PAGE", true, "V2 wizard page rendered successfully.");
  
    addStep(
      r,
      "VALIDATE_STEP_REQUIREMENTS",
      missing.length === 0,
      missing.length === 0
        ? "All required fields present."
        : "Missing: " + missing.join(", ")
    );
  
    const unlocked = isProdUnlocked(wizard);
    addStep(
      r,
      "SAFETY_LATCH",
      unlocked,
      unlocked
        ? (wizard.env === "prod" ? "Prod unlocked." : "Sandbox is safe.")
        : "Prod locked: set liveOrder and type PLACE LIVE ORDER."
    );

    for (const step of actionSteps) {
      addStep(r, step.name, step.ok, step.why);
    }
  
    return r;
  }, [wizard, missing, actionSteps]);
  
  useEffect(() => {
    console.log(JSON.stringify(receipt, null, 2));
  }, [receipt]);

  function setField(name, value) {
    setWizard((prev) => {
      const next = { ...prev };
  
      // Invariant: env is always sandbox/prod
      if (name === "env") {
        next.env = value === "prod" ? "prod" : "sandbox";
  
        // If we leave prod, relock it (prevents weird stale unlock state)
        if (next.env !== "prod") {
          next.liveOrder = false;
          next.confirmationText = "";
        }
        return next;
      }
  
      // Invariant: liveOrder is always a real boolean
      if (name === "liveOrder") {
        next.liveOrder = value === true;
        return next;
      }
  
      next[name] = value;
      return next;
    });
  }

  function goNext() {
    if (missing.length > 0) return;

    setWizard((prev) => ({
      ...prev,
      step: Math.min(prev.step + 1, 6),
    }));
  }

  function goBack() {
    setWizard((prev) => ({
      ...prev,
      step: Math.max(prev.step - 1, 1),
    }));
  }

  const nextDisabled = missing.length > 0;
  const backDisabled = wizard.step === 1;

  function isProdUnlocked(state) {
    if (state.env !== "prod") return true;
    if (state.liveOrder !== true) return false;
    if (String(state.confirmationText).trim() !== "PLACE LIVE ORDER") return false;
    return true;
  }

  async function searchProducts() {
    if (!runServerless) return;

    setWizard((prev) => ({
        ...prev,
        isSearching: true,
        searchError: "",
        searchResults: [],
    }));

    try {
        const resp = await runServerless({
            name: "supplierProducts",
            parameters: {
                supplierKey: wizard.supplierKey,
                query: wizard.searchText,
            },
        });

        const results = 
            resp?.response?.body?.results || 
            resp?.body?.results || 
            [];

            setWizard((prev) => ({
                ...prev,
                isSearching: false,
                searchResults: results,
            }))
        } catch (error) {
            setWizard((prev) => ({
                ...prev,
                isSearching: false,
                searchError: error.message || "Search failed",
            }));
        }

        try {
  setActionSteps([{ name: "SUPABASE_LOOKUP", ok: true, why: "Fetched search results." }]);
        } catch (error) {
          setActionSteps([{ name: "SUPABASE_LOOKUP", ok: false, why: error.message || "Failed to fetch search results." }]);
        }
    }

    function getRowTitle(row) {
        return row.title || row.productName || row.product_name || row.familyName || row.family_name || row.baseProductName || row.base_product_name || row.name || row.description || row.itemdescription || row.item_description || row.marketingDescription || row.marketing_description || row.productDescription || row.product_description || "";
    }
    function getRowSku(row) {
        return row.sku || row.itemnumber || row.itemNumber || row.productCode || "";
    }

    function addResultToCart(row) {
        // Ensure row includes supplier for routing
        const rowWithSupplier = {
            ...row,
            supplier: row.supplier || wizard.supplierKey.toLowerCase(),
            sku: getRowSku(row),
            title: getRowTitle(row),
        };

        const line = mapProductToLine(rowWithSupplier);

        setWizard((prev) => ({
            ...prev,
            lines: [...(prev.lines || []), line],
        }));

        setActionSteps([{ name: "NORMALIZE_LINES", ok: true, why: "Mapped product row into canonical line item." }]);

    }

    function removeLineAtIndex(indexToRemove) {
        setWizard((prev) => ({
            ...prev,
            lines: (prev.lines || []).filter((_, idx) => idx !== indexToRemove),
        }));
    }

    async function getPricing() {
        if (!runServerless) return;

        // basic check: need lines
        if (!wizard.lines || wizard.lines.length === 0) {
            setWizard((prev) => ({
                 ...prev,
                 pricing: { priced: false, reasons: ["NO_LINES"]}
            }))
            return;
        }

        try {
          const resp = await runServerless({
            name: "supplierProxy",
            parameters: {
                supplierKey: wizard.supplierKey,
                env: wizard.env,
                action: "price",
                payload: {
                    lines: wizard.lines,
                    context: {
                        ticketId: wizard.ticketId,
                        templateId: wizard.templateId,
                }
            }
        },
        });
     const body = resp?.response?.body || resp?.body || resp;

     const priced = body?.priced === true;
     const reasons = Array.isArray(body?.reasons) ? body?.reasons : [];

     setWizard((prev) => ({
        ...prev,
        pricing: { ok: true,priced, reasons },
     }));

     setActionSteps([
        { name: "SUPPLIER_PRICING_CALL", ok: true, why: "Called supplierProxy price action." },
        { name: "INTERPRET_PRICING", ok: true, why: "Converted response into priced + reasons." },
        { name: "RECEIPT_OUTPUT", ok: true, why: "Receipt shown in UI." }
      ]);
        } catch (error) {
          setWizard((prev) => ({
            ...prev,
            pricing: { ok: false, priced: false, reasons: ["PRICING_CALL_FAILED"] },
          }));
        
          setActionSteps([
            { name: "SUPPLIER_PRICING_CALL", ok: false, why: e?.message || "Pricing call failed." },
            { name: "RECEIPT_OUTPUT", ok: true, why: "Receipt shown in UI." },
          ]);
        }

       
    }

    function buildDraftPayload() {
      return {
        orderType: wizard.orderType,
        supplierKey: wizard.supplierKey,
        env: wizard.env,
        templateId: wizard.templateId,
        ticketId: wizard.ticketId,
        lines: wizard.lines || [],
        pricing: wizard.pricing || null,
        hubspot: wizard.hubspot || null,
      }
    }

    async function saveDraft() {
      if (!runServerless) return;

      try {
        const fullOrder = buildDraftPayload();

        const resp = await runServerless({
          name: "saveDraftToHubspot",
          parameters: {
            dealId: wizard.ticketId,
            fullOrder,
          },
        });

        const body = resp?.response?.body || resp?.body || resp;

        setWizard((prev) => ({
          ...prev,
          hubspot: {
            ok: body?.ok === true,
            orderId: body?.orderId || "",
            status: body?.ok ? "DRAFT_SAVED" : "FAILED",
          }
        }));

        setActionSteps([
          { name: "HUBSPOT_DRAFT_SAVE", ok: body?.ok === true, why: body?.ok ? "Draft saved to Hubspot." : "Failed to save draft." },
          { name: "RECEIPT_OUTPUT", ok: true, why: "Receipt shown in UI." }
        ]);
      } catch (error) {
        setWizard((prev) => ({
          ...prev,
          hubspot: {
            ok: false,
            orderId: "",
            status: "FAILED",
          }
        }));

        setActionSteps([
          { name: "HUBSPOT_DRAFT_SAVE", ok: false, why: error?.message || "Failed to save draft." },
          { name: "RECEIPT_OUTPUT", ok: false, why: "Receipt shown in UI." }
        ]);
      }
    }

  return (
    <>
      {wizard.step === 1 && (
        <>
          <Text>Step 1 - Choose Order Type</Text>
          <Select
            label="Order Type"
            options={[
              { label: "New Order", value: "New Order" },
              { label: "Draft Order", value: "Draft Order" },
              { label: "Submitted Order", value: "Submitted Order" },
            ]}
            value={wizard.orderType}
            onChange={(value) => setField("orderType", value)}
          />
          <Text></Text>
        </>
      )}

      {wizard.step === 2 && (
        <>
        <Text>Environment</Text>
        <Select
            label="Environment"
            options={[
                { label: "Sandbox", value: "sandbox" },
                { label: "Production", value: "prod" },
            ]}
            value={wizard.env}
            onChange={(value) => setField("env", value)}
        />
        <Text></Text>
            {wizard.env === "prod" && (
                <>
                <Text>⚠️ Production is locked by default.</Text>
                <Select
                    label="I understand this is live"
                    options={[
                        { label: "Yes", value: true },
                        { label: "No", value: false },
                    ]}
                    value={wizard.liveOrder}
                    onChange={(value) => setField("liveOrder", value)}
                />
                <Text>Confirmation Text</Text>
                <Input
                    label={`Type 'PLACE LIVE ORDER' to unlock`}
                    value={wizard.confirmationText}
                    onChange={(value) => setField("confirmationText", value)}
                />
                <Divider />
                </>
            )}
          <Text>Step 2 - Choose Supplier</Text>
          <Select
            label="Supplier"
            options={[
              { label: "ABC", value: "ABC" },
              { label: "SRS", value: "SRS" },
              { label: "BEACON", value: "BEACON" },
            ]}
            value={wizard.supplierKey}
            onChange={(value) => setField("supplierKey", value)}
          />

          <Text>Template ID </Text>
          <Input
            label="Template ID"
            value={wizard.templateId}
            onChange={(value) => setField("templateId", value)}
          />

          <Text>Ticket ID </Text>
          <Input
            label="Ticket ID"
            value={wizard.ticketId}
            onChange={(value) => setField("ticketId", value)}
          />

          <Text>
            {missing.length > 0
              ? "Missing: " + missing.join(", ")
              : "All required fields present."}
          </Text>
        </>
      )}

      {wizard.step === 3 && (
        <> <Text>Step 3 - Add Products</Text>
        <Input
      label="Search"
      value={wizard.searchText}
      onChange={(value) => setField("searchText", value)}
    />

    <Button onClick={searchProducts} disabled={wizard.isSearching}>
      {wizard.isSearching ? "Searching..." : "Search"}
    </Button>

    {wizard.searchError && <Text>Search error: {wizard.searchError}</Text>}

    <Text>Results</Text>
        {(wizard.searchResults || []).map((row, idx) => (
            <React.Fragment key={idx}>
                <Text>{row.title} - {row.sku}</Text>
                <Button onClick={() => addResultToCart(row)}>Add</Button>
                <Text></Text>
            </React.Fragment>
        ))}

        <Text>Cart</Text>
        {(wizard.lines || []).length === 0 && <Text>(Empty)</Text>}

        {(wizard.lines || []).map((line, idx) => (
            <React.Fragment key={idx}>
            <Text>
                {line.title} - {line.sku} ({line.quantity} {line.uom})
            </Text>
            <Button onClick={() => removeLineAtIndex(idx)}>Remove</Button>
            </React.Fragment>
        ))}
        </>
      )}

      {wizard.step === 4 && (
        <>
        <Text>Step 4 - Pricing</Text>
        <Text>Lines</Text>
        {(wizard.lines || []).map((line,idx) => (
            <Text key={idx}>{line.title} - {line.sku} ({line.quantity} {line.uom})</Text>
        ))}

        <Button onClick={getPricing}>Get Pricing</Button>

        {wizard.pricing && (
            <>
            <Text>Pricing Status: {wizard.pricing.priced ? "Priced" : "Not Priced"}</Text>
            <Text>Reasons: {wizard.pricing.reasons?.join(", ")}</Text>
            </>
        )}
        </>
      )}

      {wizard.step === 5 && (
        <>
        <Text>Step 5 - Save Draft</Text>
        <Button onClick={saveDraft} variant="primary">Save as Draft</Button>
        <Text>Hubspot Status: {wizard.hubspot.status || "(none)"} | orderId: {wizard.hubspot?.orderId || "(none)"}</Text>
        </>
      )}

      <Button onClick={goBack} disabled={backDisabled}>Back</Button>
      <Button onClick={goNext} variant="primary" disabled={nextDisabled}>Next</Button>
    </>
  );
}
