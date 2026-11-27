import { ApiError } from "@/errors/api.error";

export const isCoinTransferFeeChanged = (error: unknown) =>
  error instanceof ApiError && error.code === "COIN_TRANSFER_FEE_CHANGED";

export const isDefinitiveCoinTransferRejection = (error: unknown) =>
  error instanceof ApiError && [400, 401, 402, 403, 404, 422].includes(error.status);
