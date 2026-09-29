import { CommandHandler } from "@zudojs/cqrs";

import type { ProductsService } from "../../services/products.service.js";
import type { ChangeProductEngagementCommand } from "./changeProductEngagement.command.js";

export class ChangeProductEngagementHandler extends CommandHandler<ChangeProductEngagementCommand, { readonly engaged: boolean }> {
  public readonly commandType = "products.changeProductEngagement" as const;

  public constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async execute(command: ChangeProductEngagementCommand): Promise<{ readonly engaged: boolean }> {
    const { engagement } = this.productsService.dependencies;
    await this.productsService.findPubliclyVisibleProductOrThrow(command.productId);
    if (command.engaged) {
      await engagement.add(command.kind, command.productId, command.principal.userId);
    } else {
      await engagement.remove(command.kind, command.productId, command.principal.userId);
    }
    return { engaged: command.engaged };
  }
}
