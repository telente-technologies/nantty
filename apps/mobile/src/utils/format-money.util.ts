import type { Kobo } from "@/types";

const naira = new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

export const formatKoboAsNaira = (amount: Kobo, { decimals = true }: { decimals?: boolean } = {}) =>
  `₦${(decimals ? naira : whole).format(amount / 100)}`;
