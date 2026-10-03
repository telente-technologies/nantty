declare module "@paystack/inline-js" {
  interface PaystackPopupCallbacks {
    onSuccess?: (transaction: { id: number; reference: string; message: string }) => void;
    onCancel?: () => void;
    onError?: (error: { message: string }) => void;
    onLoad?: (transaction: { id: number; accessCode: string }) => void;
  }
  export default class PaystackPop {
    resumeTransaction(accessCode: string, callbacks?: PaystackPopupCallbacks): unknown;
  }
}
