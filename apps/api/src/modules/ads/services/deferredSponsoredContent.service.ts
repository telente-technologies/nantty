import type { SponsoredContentProvider, SponsoredInsertion, SponsoredPlacementRequest } from "../../../interfaces/discovery.interface.js";

export class DeferredSponsoredContent implements SponsoredContentProvider {
  private provider: SponsoredContentProvider | undefined;

  public attach(provider: SponsoredContentProvider): void {
    this.provider = provider;
  }

  public async selectSponsoredItems(request: SponsoredPlacementRequest): Promise<readonly SponsoredInsertion[]> {
    return this.provider === undefined ? [] : this.provider.selectSponsoredItems(request);
  }
}
