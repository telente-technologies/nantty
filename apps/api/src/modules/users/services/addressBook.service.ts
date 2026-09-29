import type { AddressBook, ShippingAddress } from "../../../interfaces/addressBook.interface.js";
import type { FieldCipher } from "../../../utils/crypto.util.js";
import type { AddressesRepository } from "../repositories/addresses.repository.js";

export class RepositoryAddressBook implements AddressBook {
  public constructor(private readonly addresses: AddressesRepository, private readonly cipher: FieldCipher) {}

  public async findOwnedShippingAddress(userId: string, addressId: string): Promise<ShippingAddress | undefined> {
    const address = await this.addresses.findOwnedAddress(userId, addressId);
    if (address === undefined) return undefined;
    return {
      fullName: address.fullName,
      phone: await this.cipher.decryptText(address.phoneEncrypted),
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      country: address.country,
      postalCode: address.postalCode,
    };
  }
}
