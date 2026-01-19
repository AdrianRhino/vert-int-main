export function makeWizardState() {
    return {
        step: 1,

        orderType: "",

        supplierKey: "",
        templateId: "",
        ticketId: "",

        env: "sandbox", // "sandbox" | "prod"
        liveOrder: false,
        confirmationText: "",

        searchText: "",
        searchResults: [],
        searchError: "",
        isSearching: false,

        lines: [],
        pricing: null, // { priced: boolean, reasons: [] }
        
        hubspot: { ok:false, orderId:"", status:"" },

        submit: null,
        isSubmitting: false,
        submitError: "",

        context: { branchId: "", shipTo: "", accountId: "" },
    };
}