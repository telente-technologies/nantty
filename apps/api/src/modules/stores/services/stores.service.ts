import type { EventBus } from "@zudojs/events";

import { findCurrencyForCountry } from "../../../configs/currency.config.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { notFound, unprocessable } from "../../../errors/domain.error.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { UserDirectory } from "../../../interfaces/userDirectory.interface.js";
import { publishEvent } from "../../../loaders/events.loader.js";
import type { FieldCipher } from "../../../utils/crypto.util.js";
import { createUniqueSlugFromText } from "../../../utils/slug.util.js";
import { convertSellerApplicationToDto, type SellerApplicationDto } from "../dtos/stores.dto.js";
import { StoreCreatedEvent } from "../events/storeCreated.event.js";
import { MAXIMUM_STORES_PER_OWNER, type SellerApplicationRecord, type StoreRecord } from "../models/stores.model.js";
import type { SellerApplicationsRepository } from "../repositories/sellerApplications.repository.js";
import type { StoresRepository } from "../repositories/stores.repository.js";
import type { CreateStoreBody } from "../validators/stores.validator.js";
import type { BankDirectory } from "../../wallets/services/bankDirectory.service.js";
import type { StoreAccessService } from "./storeAccess.service.js";

export interface StoresDependencies {
  readonly stores: StoresRepository;
  readonly applications: SellerApplicationsRepository;
  readonly storeAccess: StoreAccessService;
  readonly cipher: FieldCipher;
  readonly audit: AuditRecorder;
  readonly events: EventBus;
  readonly userDirectory: UserDirectory;
  readonly countPublishedProductsForStore: (storeId: string) => Promise<number>;
  readonly countAllProductsForStore: (storeId: string) => Promise<number>;
  readonly bankDirectory?: BankDirectory;
}

export class StoresService {
  public constructor(public readonly dependencies: StoresDependencies) {}

  public async findStoreOrThrow(storeId: string): Promise<StoreRecord> {
    const store = await this.dependencies.stores.findById(storeId);
    if (store === undefined) throw notFound("Store");
    return store;
  }

  public async findPubliclyVisibleStoreOrThrow(lookup: { readonly id: string } | { readonly slug: string }): Promise<StoreRecord> {
    const { stores } = this.dependencies;
    const store = "id" in lookup ? await stores.findById(lookup.id) : await stores.findBySlug(lookup.slug);
    if (store === undefined || store.status !== "active") throw notFound("Store");
    return store;
  }

  public async createStoreOwnedBy(ownerId: string, input: CreateStoreBody, currency: CurrencyCode): Promise<StoreRecord> {
    const { stores, events } = this.dependencies;
    if ((await stores.countOwnedBy(ownerId)) >= MAXIMUM_STORES_PER_OWNER) {
      throw unprocessable(`A seller can own at most ${MAXIMUM_STORES_PER_OWNER} stores.`);
    }
    const store = await stores.createWithOwner({
      ownerId,
      name: input.name.trim(),
      slug: createUniqueSlugFromText(input.name),
      description: input.description ?? "",
      currency,
      shippingFee: input.shippingFee ?? 0,
      discountBps: input.discountBps ?? 0,
      shippingPolicy: input.shippingPolicy ?? "",
      returnPolicy: input.returnPolicy ?? "",
      logoUrl: input.logoUrl ?? null,
      bannerUrl: input.bannerUrl ?? null,
    });
    await publishEvent(events, StoreCreatedEvent, { storeId: store.id, ownerId });
    return store;
  }

  public async chooseStoreCurrencyForUser(userId: string): Promise<CurrencyCode> {
    const preference = await this.dependencies.userDirectory.findUserLocalePreference(userId);
    return preference?.currency ?? findCurrencyForCountry(preference?.countryCode ?? null).currency;
  }

  public async assertStoreCurrencyCanChange(store: StoreRecord, requestedCurrency: CurrencyCode | undefined): Promise<void> {
    if (requestedCurrency === undefined || requestedCurrency === store.currency) return;
    if ((await this.dependencies.countAllProductsForStore(store.id)) > 0) {
      throw unprocessable("The store currency cannot change once the store has products.");
    }
  }

  public async convertApplicationWithDecryptedPhone(application: SellerApplicationRecord): Promise<SellerApplicationDto> {
    return convertSellerApplicationToDto(application, await this.dependencies.cipher.decryptText(application.phoneEncrypted));
  }
}
