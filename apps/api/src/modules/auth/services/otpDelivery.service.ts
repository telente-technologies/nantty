import { email } from "../../../integrations/email.integration.js";
import type { AppLogger } from "../../../loggers/app.logger.js";
import type { OtpPurpose } from "../models/auth.model.js";
import type { ContactAddress } from "./contact.service.js";
import type { OneTimeCodeDelivery } from "./otp.service.js";

const SUBJECTS: Readonly<Record<OtpPurpose, string>> = {
  verify_contact: "Verify your Zudomart account",
  login: "Your Zudomart sign-in code",
  reset_password: "Reset your Zudomart password",
};

export class EmailOneTimeCodeDelivery implements OneTimeCodeDelivery {
  public constructor(private readonly logger: AppLogger) {}

  public async deliverOneTimeCode(contact: ContactAddress, code: string, purpose: OtpPurpose): Promise<void> {
    if (contact.kind === "phone") {
      this.logger.warn("No SMS provider is configured; the one-time code was not sent.", { purpose });
      return;
    }
    await email().send({
      to: contact.value,
      subject: SUBJECTS[purpose],
      text: `Your Zudomart code is ${code}. It expires in 5 minutes. If you did not ask for it, ignore this message.`,
    });
  }
}
