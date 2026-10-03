import type { Address, GeoCountry, ShippingAddressInput } from "@/types";

export type AddressErrors = Partial<Record<keyof ShippingAddressInput, string>>;

export const emptyAddressInput: ShippingAddressInput = {
  fullName: "",
  phone: "",
  line1: "",
  postalCode: "",
  details: "",
  countryId: "",
  stateId: null,
  lgaId: null,
  cityId: null,
  isDefault: false,
};

export const addressToInput = (address: Address): ShippingAddressInput => ({
  fullName: address.fullName,
  phone: address.phone,
  line1: address.line1,
  postalCode: address.postalCode,
  details: address.details,
  countryId: address.countryId,
  stateId: address.stateId,
  lgaId: address.lgaId,
  cityId: address.cityId,
  isDefault: address.isDefault,
});

export function validateAddressInput(input: ShippingAddressInput, country: GeoCountry | null): AddressErrors {
  const errors: AddressErrors = {};
  if (input.fullName.trim().length < 2) errors.fullName = "Enter the recipient's name";
  if (input.phone.replace(/\D/g, "").length < 7) errors.phone = "Enter a valid phone number";
  if (input.line1.trim().length < 3) errors.line1 = "Enter the street address";
  if (!country) errors.countryId = "Choose a country";
  if (country?.levels.includes("state") && !input.stateId) errors.stateId = `Choose a ${country.stateLabel.toLowerCase()}`;
  if (country?.levels.includes("lga") && !input.lgaId) errors.lgaId = `Choose a ${country.lgaLabel}`;
  if (country?.levels.includes("city") && !input.cityId) errors.cityId = "Choose a city or town";
  return errors;
}

export const formatAddressLocation = (address: Address) =>
  [address.line1, address.city, address.lga, address.state, address.country].filter(Boolean).join(", ");
