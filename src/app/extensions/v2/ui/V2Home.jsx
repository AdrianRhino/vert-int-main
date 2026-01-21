import React, { useMemo, useEffect, useState } from "react";
import { Text, Select, Input, Button, Divider, Heading } from "@hubspot/ui-extensions";
import { makeReceipt, addStep } from "../contracts/receipt";
import { makeWizardState } from "../contracts/wizardState";
import { getMissingFields } from "../contracts/requirements";
import { mapProductToLine } from "../mappers/mapProductToLine";
import { CAPABILITIES } from "../contracts/capabilities";

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

  // Booleans

  const nextDisabled = missing.length > 0;
  const backDisabled = wizard.step === 1;

  const pricingOk = wizard.pricing && wizard.pricing?.ok === true;
  const hubspotOk = wizard.hubspot && wizard.hubspot?.ok === true;

  const prodUnlocked = isProdUnlocked(wizard);

  const submitDisabled =
    !hubspotOk ||
    !pricingOk ||
    (wizard.env === "prod" && !prodUnlocked);

    const pricingContextReqs = CAPABILITIES[wizard.supplierKey]?.pricing?.requires || [];

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

            setActionSteps([{ name: "SUPABASE_LOOKUP", ok: true, why: "Fetched search results." }]);
        } catch (error) {
            setWizard((prev) => ({
                ...prev,
                isSearching: false,
                searchError: error.message || "Search failed",
            }));

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
                 pricing: { ok: false, priced: false, reasons: ["NO_LINES"]}
            }))
            return;
        }

        try {

          console.error("[UI getPricing] about to call supplierProxy", JSON.stringify({
            supplierKey: wizard.supplierKey,
            env: wizard.env,
            action: "price",
            linesPreview: (wizard.lines || []).slice(0, 2),
            supplierContext: wizard.context || {},
          }, null, 2));

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
                        supplierContext: wizard.context || {},
                }
            }
        },
        });
     const body = resp?.response?.body || resp?.body || resp;
     console.error("[UI getPricing] supplierProxy response body", JSON.stringify(body, null, 2));

     const ok = body?.ok === true;
const priced = body?.priced === true;
const reasons = Array.isArray(body?.reasons) ? body.reasons : [];

setWizard(prev => ({
  ...prev,
  pricing: { ok, priced, reasons, error: body?.error || "" },
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
            { name: "SUPPLIER_PRICING_CALL", ok: false, why: error?.message || "Pricing call failed." },
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
        context: wizard.context || {},
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
          { name: "RECEIPT_OUTPUT", ok: true, why: "Receipt shown in UI." }
        ]);
      }
    }

    async function submitOrder() {
      if (!runServerless) return;

      // hard gate (extra safety)
      if (!wizard.hubspot?.ok) return;
      if (!(wizard.pricing && wizard.pricing.ok === true)) return;
      if (wizard.env === "prod" && !isProdUnlocked(wizard)) return;

      setActionSteps([{ name: "SUBMIT_START", ok: true, why: "Starting order submission." }]);

      setWizard((prev) => ({
        ...prev,
        isSubmitting: true,
        submitError: "",
        submit: null,
      }))

      const fullOrder = buildDraftPayload();

      try {
        const r1 = await runServerless({
          name: "sendOrderToSupplier",
          parameters: {
            supplierKey: wizard.supplierKey,
            env: wizard.env,
            fullOrder,
          },
        });
        
        const b1 = r1?.response?.body || r1?.body || r1;
        if (!b1?.ok) throw new Error(b1?.error || "Failed to send order to supplier.");

        setActionSteps([
          { name: "SUBMIT_START", ok: true, why: "Submit started." },
          { name: "SUPPLIER_ORDER_CALL", ok: true, why: "Supplier order created: " + b1.supplierOrderId },
        ])

        // 2) Generate/upload PDF
        const r2 = await runServerless({
          name: "generateAndUploadOrderPDF",
          parameters: {
            env: wizard.env,
            dealId: wizard.ticketId,
            supplierOrderId: b1.supplierOrderId,
          },
        });

        const b2 = r2?.response?.body || r2?.body || r2;
        if (!b2?.ok) throw new Error(b2?.error || "PDF generation/upload failed.");

        setActionSteps([
          { name: "SUBMIT_START", ok: true, why: "Submit started." },
          { name: "SUPPLIER_ORDER_CALL", ok: true, why: "Supplier order created: " + b1.supplierOrderId },
          { name: "PDF_GENERATE_UPLOAD", ok: true, why: "PDF created: " + b2.pdfUrl },
        ])

        // 3) Update Hubspot status
        const r3 = await runServerless({
          name: "updateHubspotStatus",
          parameters: {
            dealId: wizard.ticketId,
            orderId: wizard.hubspot?.orderId,
            status: "SUBMITTED",
          }
        });

        const b3 = r3?.response?.body || r3?.body || r3;
        if (!b3?.ok) throw new Error(b3?.error || "HubSpot update failed");

        // Final State
        setWizard((prev) => ({
          ...prev,
          isSubmitting: false,
          submit: {
            ok: true,
            supplierOrderId: b1.supplierOrderId,
            pdfUrl: b2.pdfUrl,
            hubspotStatus: b3.hubspotStatus,
          },
        }));

        setActionSteps([
          { name: "SUBMIT_START", ok: true, why: "Submit started." },
          { name: "SUPPLIER_ORDER_CALL", ok: true, why: "Supplier order created: " + b1.supplierOrderId },
          { name: "PDF_GENERATE_UPLOAD", ok: true, why: "PDF created: " + b2.pdfUrl },
          { name: "HUBSPOT_STATUS_UPDATE", ok: true, why: "HubSpot status updated to SUBMITTED." },
          { name: "SUBMIT_DONE", ok: true, why: "Submit complete."}
        ]);
      } catch (error) {
        setWizard((prev) => ({
          ...prev,
          isSubmitting: false,
          submitError: error?.message || "Submit failed.",
          submit: { ok: false },
        }));

        setActionSteps([
          { name: "SUBMIT_START", ok: true, why: "Submit started." },
          { name: "SUBMIT_DONE", ok: false, why: error?.message || "Submit failed." },
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

          <Text>Supplier Context</Text>
          {pricingContextReqs.includes("branchId") && (
            <Input 
            label="Branch ID" 
            value={wizard.context.branchId || ""} 
            onChange={(value) => setField("context", { ...wizard.context, branchId: value })} 
            />
          )}

          {pricingContextReqs.includes("shipTo") && (
            <Input
            label="Ship To ID"
            value={wizard.context.shipTo || ""}
            onChange={(value) => setField("context", { ...wizard.context, shipTo: value })}
            />
          )}

          {pricingContextReqs.includes("accountId") && (
            <Input
            label="Account ID"
            value={wizard.context.accountId || ""}
            onChange={(value) => setField("context", { ...wizard.context, accountId: value })}
            />
          )}

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
                <Text>{getRowTitle(row)} - {getRowSku(row)}</Text>
                <Button onClick={() => addResultToCart(row)}>Add</Button>
                <Text></Text>
            </React.Fragment>
        ))}
        <Divider />
        <Heading>Cart</Heading>
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

{wizard.step === 6 && (
  <>
    <Text>Step 6 - Submit</Text>

    {wizard.env === "prod" && !prodUnlocked && (
      <Text>Prod is locked. Unlock required to submit.</Text>
    )}

    {!pricingOk && <Text>Pricing must succeed before submit.</Text>}
    {!wizard.hubspot?.ok && <Text>Draft must be saved before submit.</Text>}

    <Button onClick={submitOrder} variant="primary" disabled={submitDisabled || wizard.isSubmitting}>
      {wizard.isSubmitting ? "Submitting..." : "Submit Order"}
    </Button>

    {wizard.submitError && <Text>Submit error: {wizard.submitError}</Text>}

    {wizard.submit?.ok && (
      <>
        <Text>Supplier Order ID: {wizard.submit.supplierOrderId}</Text>
        <Text>PDF URL: {wizard.submit.pdfUrl}</Text>
        <Text>HubSpot Status: {wizard.submit.hubspotStatus}</Text>
      </>
    )}
  </>
)}

      <Button onClick={goBack} disabled={backDisabled}>Back</Button>
      <Button onClick={goNext} variant="primary" disabled={nextDisabled}>Next</Button>
    </>
  );
}
