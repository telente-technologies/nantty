import { callApi, describeResponse, registerUser, uniqueSuffix, uploadSampleImage, waitFor, type UserActor } from "../smokeBridge.js";

export interface SeededStore {
  readonly seller: UserActor;
  readonly storeId: string;
  readonly businessProfileId: string;
  readonly handle: string;
  readonly productId: string;
  readonly productName: string;
  readonly variantId: string;
}

function must(condition: boolean, what: string, response: Parameters<typeof describeResponse>[0]): void {
  if (!condition) throw new Error(`${what}: ${describeResponse(response)}`);
}

export async function seedStoreWithProduct(label: string, priceMinor = 250_000, seller?: UserActor): Promise<SeededStore> {
  const suffix = uniqueSuffix();
  const owner = seller ?? (await registerUser(label));
  const handle = `e2e${label}${suffix}`.slice(0, 30).toLowerCase();
  const profile = await callApi("POST", "/api/v1/users/me/business-profiles", { token: owner.accessToken, body: { displayName: `E2E ${label} ${suffix}`, handle, description: "Browser e2e store", businessType: "business", purpose: "store", categories: [{ customName: "Fashion" }] } });
  must(profile.status === 201, "business profile", profile);
  const businessProfileId: string = profile.body.id ?? profile.body.profile?.id;
  const store = await callApi("POST", "/api/v1/stores", { token: owner.accessToken, body: { businessProfileId, name: `E2E ${label} ${suffix}`, description: "Browser e2e store", countryCode: "NG" } });
  must(store.status === 201, "store", store);
  const storeId: string = store.body.id ?? store.body.store?.id;
  const headers = { "X-Seller-Store": storeId };
  await callApi("POST", "/api/v1/seller/shipping/rules", { token: owner.accessToken, headers, body: { zoneName: "Nationwide", destinations: [{ level: "country", countryCode: "NG" }], type: "flat_fee", feeMinor: 150000, active: true } });
  const locations = await callApi("GET", "/api/v1/seller/locations", { token: owner.accessToken, headers });
  const locationId = locations.body?.data?.[0]?.id;
  const image = await uploadSampleImage(owner.accessToken, "product");
  const productName = `E2E ${label} item ${suffix}`;
  const product = await callApi("POST", "/api/v1/seller/products", { token: owner.accessToken, headers, body: { name: productName, description: "Browser e2e item", status: "active", taxable: false, trackInventory: true, publishedOnline: true, tags: ["e2e"], options: [], imageMediaIds: [image.mediaId], variants: [{ optionValues: {}, sku: `E2E-${suffix}`.toUpperCase(), priceMinor, lowStockThreshold: 1, openingStock: locationId === undefined ? [] : [{ locationId, quantity: 50 }] }] } });
  must(product.status === 201, "product", product);
  const productId: string = product.body.id ?? product.body.product?.id;
  await waitFor(async () => ((await callApi("GET", `/api/v1/products/${productId}`)).status === 200 ? true : undefined), 15_000, 500);
  return { seller: owner, storeId, businessProfileId, handle, productId, productName, variantId: product.body.variants?.[0]?.id ?? product.body.product?.variants?.[0]?.id };
}

export async function addDefaultAddress(user: UserActor): Promise<string> {
  const countries = await callApi("GET", "/api/v1/geo/countries");
  const nigeria = countries.body.data.find((country: { code: string }) => country.code === "NG");
  const regions = await callApi("GET", `/api/v1/geo/countries/${nigeria.id}/regions`);
  const lagos = regions.body.data.find((region: { name: string }) => /lagos/i.test(region.name)) ?? regions.body.data[0];
  const areas = await callApi("GET", `/api/v1/geo/regions/${lagos.id}/admin-areas`);
  const lga = areas.body.data.find((area: { name: string }) => /ikeja/i.test(area.name)) ?? areas.body.data[0];
  const address = await callApi("POST", "/api/v1/users/me/addresses", { token: user.accessToken, body: { label: "Home", fullName: "E2E Buyer", phone: "+2348012345678", line1: "4 Allen Avenue", countryId: nigeria.id, stateId: lagos.id, lgaId: lga.id, city: "Ikeja", isDefault: true } });
  must(address.status === 201, "address", address);
  return address.body.id;
}

export async function createPublicPost(user: UserActor, text: string): Promise<string> {
  const created = await callApi("POST", "/api/v1/posts", { token: user.accessToken, body: { text, audience: "everyone" } });
  must(created.status === 201 || created.status === 200, "post", created);
  return created.body.id ?? created.body.post?.id;
}
