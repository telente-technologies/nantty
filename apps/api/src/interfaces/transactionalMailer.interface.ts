export interface TransactionalEmail {
  readonly to: string | readonly string[];
  readonly subject: string;
  readonly text: string;
}

export interface TransactionalMailer {
  sendTransactionalEmail(message: TransactionalEmail): Promise<void>;
}
