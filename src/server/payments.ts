/**
 * Payments adapter.
 *
 * Version 1 uses payment at the business: the business records what was paid
 * when it marks an appointment completed (PaymentRecord, method "at_business").
 * No card data is ever handled or stored by BUBER.
 *
 * Future deposits/refunds plug in by implementing PaymentProvider with a
 * PCI-compliant processor (hosted checkout / tokenized payments) and storing
 * only the provider reference in PaymentRecord.externalRef.
 */
export interface PaymentProvider {
  name: string;
  createDeposit(args: {
    appointmentId: string;
    amountAgorot: number;
    customerEmail: string;
    returnUrl: string;
  }): Promise<{ checkoutUrl: string; externalRef: string }>;
  refund(args: { externalRef: string; amountAgorot: number }): Promise<{ externalRef: string }>;
}

export class PayAtBusinessProvider implements PaymentProvider {
  name = "pay_at_business";
  async createDeposit(): Promise<never> {
    throw new Error("Deposits are not enabled. Configure a payment provider first.");
  }
  async refund(): Promise<never> {
    throw new Error("Refunds are not enabled. Configure a payment provider first.");
  }
}

export function paymentProvider(): PaymentProvider {
  return new PayAtBusinessProvider();
}
