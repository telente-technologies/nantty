export interface OutgoingEmail {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly from?: string;
  readonly replyTo?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly tags?: Readonly<Record<string, string>>;
}

export interface EmailSender {
  send(email: OutgoingEmail): Promise<{ readonly messageId: string }>;
}
