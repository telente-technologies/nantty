import type { UserDirectory } from "../../../interfaces/userDirectory.interface.js";
import type { ProductsService } from "../../products/services/products.service.js";

export class SearchService {
  public constructor(public readonly productsService: ProductsService, public readonly userDirectory: UserDirectory) {}
}
