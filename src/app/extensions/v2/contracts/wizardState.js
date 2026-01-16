export function makeWizardState() {
    return {
        step: 1,
        orderType: "",
        supplierKey: "",
        template: "",
        ticketId: "",
        env: "",
        liveOrder: false,
        confirmationText: "",
    };
}