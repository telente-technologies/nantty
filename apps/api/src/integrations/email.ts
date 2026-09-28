import { createTransport } from "nodemailer";

import type { AppConfig } from "../configs/index.js";
import type { Integration, IntegrationContext } from "./integration.js";

/** A message to send. */
export interface EmailMessage {
  readonly to: string | readonly string[];
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
}

/** Sends email; swap implementations through EMAIL_TRANSPORT. */
export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
  verify(): Promise<boolean>;
  close(): void;
}

function consoleTransport(logger: IntegrationContext["logger"]): EmailTransport {
  return {
    async send(message) {
      logger.info("Email (console transport, not sent)", {
        to: message.to,
        subject: message.subject,
      });
    },
    async verify() {
      return true;
    },
    close() {},
  };
}

function smtpTransport(settings: AppConfig["email"]): EmailTransport {
  const transporter = createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    ...(settings.smtpUser === ""
      ? {}
      : { auth: { user: settings.smtpUser, pass: settings.smtpPassword } }),
  });
  return {
    async send(message) {
      await transporter.sendMail({
        from: settings.from,
        to: typeof message.to === "string" ? message.to : [...message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html === undefined ? {} : { html: message.html }),
      });
    },
    async verify() {
      return transporter.verify().then(() => true, () => false);
    },
    close() {
      transporter.close();
    },
  };
}

let transport: EmailTransport | undefined;

/** The configured transport. Throws before the runtime has started. */
export function email(): EmailTransport {
  if (transport === undefined) {
    throw new Error("Email is not configured: start the runtime first.");
  }
  return transport;
}

export const emailIntegration: Integration = {
  name: "email",

  async start({ config, logger }) {
    const kind = config.email.transport;
    if (kind !== "console" && kind !== "smtp") {
      throw new Error(`EMAIL_TRANSPORT must be "console" or "smtp", got "${kind}".`);
    }
    transport = kind === "smtp" ? smtpTransport(config.email) : consoleTransport(logger);
  },

  async stop() {
    transport?.close();
    transport = undefined;
  },

  async health() {
    return transport === undefined ? false : transport.verify();
  },
};
