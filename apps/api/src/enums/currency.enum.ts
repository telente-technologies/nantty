export const Currency = { NGN: "NGN" } as const;
export type Currency = (typeof Currency)[keyof typeof Currency];
