import type { DeliveryRepository } from "../../../../interfaces/repositories.interface.js";

export class ListFailedEmailDeliveriesHandler {
  public constructor(private readonly deliveries: DeliveryRepository) {}

  public execute(limit = 50) {
    return this.deliveries.listFailedEmails(limit);
  }
}
