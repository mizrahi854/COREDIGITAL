/**
 * Payments boundary. The demo uses DemoPayments only: no card data is collected,
 * stored or sent anywhere, and every result is labelled as a demo.
 * Production: replace with a PCI-compliant provider using hosted checkout / tokenization,
 * confirm payments via server-side webhooks, and store only the provider reference.
 */
export interface PaymentAdapter {
  readonly simulated: boolean;
  chargeDeposit(args: { amount: number; outcome: "success" | "failure" }): Promise<{ ok: boolean; reference: string }>;
}

export const DemoPayments: PaymentAdapter = {
  simulated: true,
  async chargeDeposit({ outcome }) {
    await new Promise((r) => setTimeout(r, 900));
    return { ok: outcome === "success", reference: `demo_${Date.now().toString(36)}` };
  },
};
