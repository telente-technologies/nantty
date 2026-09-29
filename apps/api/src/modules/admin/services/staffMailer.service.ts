import { email } from "../../../integrations/email.integration.js";
import type { TransactionalEmail, TransactionalMailer } from "../../../interfaces/transactionalMailer.interface.js";

export class IntegrationTransactionalMailer implements TransactionalMailer {
  public async sendTransactionalEmail(message: TransactionalEmail): Promise<void> {
    await email().send({ to: message.to, subject: message.subject, text: message.text });
  }
}
