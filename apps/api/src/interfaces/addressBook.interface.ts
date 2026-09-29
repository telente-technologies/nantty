export interface ShippingAddress {
  readonly fullName: string;
  readonly phone: string;
  readonly line1: string;
  readonly line2: string;
  readonly city: string;
  readonly state: string;
  readonly country: string;
  readonly postalCode: string;
}

export interface AddressBook {
  findOwnedShippingAddress(userId: string, addressId: string): Promise<ShippingAddress | undefined>;
}
