import type { UserSummary } from "../../../interfaces/userDirectory.interface.js";
import type { ProductCardDto } from "../../products/dtos/products.dto.js";
import type { StoreDto } from "../../stores/dtos/stores.dto.js";

export interface SearchResultsDto {
  readonly query: string;
  readonly products?: readonly ProductCardDto[];
  readonly stores?: readonly StoreDto[];
  readonly users?: readonly UserSummary[];
}
