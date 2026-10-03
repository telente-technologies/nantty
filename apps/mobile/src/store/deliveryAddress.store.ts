import { create } from "zustand";

interface DeliveryAddressState {
  readonly chosenAddressId: string | null;
  readonly chooseDeliveryAddress: (addressId: string | null) => void;
}

export const useDeliveryAddressStore = create<DeliveryAddressState>((set) => ({
  chosenAddressId: null,
  chooseDeliveryAddress: (addressId) => set({ chosenAddressId: addressId }),
}));
