import React, { useMemo, useEffect, useState } from "react";
import { Text, Select, Input, Button, Divider } from "@hubspot/ui-extensions";
import { makeReceipt, addStep } from "../contracts/receipt";
import { makeWizardState } from "../contracts/wizardState";
import { getMissingFields } from "../contracts/requirements";

export default function V2Home() {
  const [wizard, setWizard] = useState(() => makeWizardState());

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
  
    return r;
  }, [wizard, missing]);
  
  useEffect(() => {
    console.log(JSON.stringify(receipt, null, 2));
  }, [receipt]);

  function setField(name, value) {
    setWizard((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function goNext() {
    if (missing.length > 0) return;

    setWizard((prev) => ({
      ...prev,
      step: Math.min(prev.step + 1, 2),
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
      <Button onClick={goBack} disabled={backDisabled}>Back</Button>
      <Button onClick={goNext} variant="primary" disabled={nextDisabled}>Next</Button>
    </>
  );
}
