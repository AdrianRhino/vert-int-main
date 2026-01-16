export function makeWizardState() {
    return {
        step: 1,
        orderType: "",
        supplierKey: "",
        template: "",
        ticketId: "",
        env: "sandbox",
        liveOrder: false,
        confirmationText: "",
    };
}