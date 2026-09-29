import type { QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import type { CurrencyConverter } from "../../../interfaces/currencyConverter.interface.js";
import type { UserSummary } from "../../../interfaces/userDirectory.interface.js";
import { findAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { findViewerLocale } from "../../../middlewares/viewerLocale.middleware.js";
import { json, validationFailed } from "../../../utils/http.util.js";
import { convertProductToCardDto, type SponsorableProduct } from "../../products/dtos/products.dto.js";
import { convertStoreToDto } from "../../stores/dtos/stores.dto.js";
import type { StoreRecord } from "../../stores/models/stores.model.js";
import type { SearchResultsDto } from "../dtos/search.dto.js";
import { SearchProductsQuery } from "../queries/searchProducts/searchProducts.query.js";
import { SearchStoresQuery } from "../queries/searchStores/searchStores.query.js";
import { SearchUsersQuery } from "../queries/searchUsers/searchUsers.query.js";
import { SearchQuerySchema } from "../validators/search.validator.js";

const DEFAULT_RESULTS_PER_TYPE = 20;

export class SearchController {
  public constructor(private readonly queries: QueryBus, private readonly currencyConverter: CurrencyConverter) {}

  public readonly search = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = SearchQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const term = query.data.q.trim();
    const scope = query.data.scope ?? "all";
    const limit = query.data.limit ?? DEFAULT_RESULTS_PER_TYPE;
    const includes = (wanted: "products" | "stores" | "people") => scope === "all" || scope === wanted;
    const locale = findViewerLocale(ctx);
    const viewer = { viewerId: findAuthenticatedPrincipal(ctx)?.userId, country: locale.countryCode };
    const [products, stores, users] = await Promise.all([
      includes("products") ? this.queries.execute<SearchProductsQuery, readonly SponsorableProduct[]>(new SearchProductsQuery(term, limit, viewer)) : undefined,
      includes("stores") ? this.queries.execute<SearchStoresQuery, readonly StoreRecord[]>(new SearchStoresQuery(term, limit)) : undefined,
      includes("people") ? this.queries.execute<SearchUsersQuery, readonly UserSummary[]>(new SearchUsersQuery(term, limit)) : undefined,
    ]);
    const convert = await this.currencyConverter.prepareConversionInto(locale.currency);
    const results: SearchResultsDto = {
      query: term,
      products: (products ?? []).map((product) => convertProductToCardDto(product, convert)),
      stores: (stores ?? []).map((store) => convertStoreToDto(store, convert)),
      people: users ?? [],
    };
    return json(200, results);
  };
}
