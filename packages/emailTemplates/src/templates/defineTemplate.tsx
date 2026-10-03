import type { EmailBlock, EmailCategory, EmailContext, EmailKind } from "../emailTypes";
import { EmailDocument } from "../layout/emailDocument.layout";

export interface EmailTemplateSpec<P> {
  readonly key: string;
  readonly name: string;
  readonly category: EmailCategory;
  readonly kind: EmailKind;
  readonly audience: string;
  readonly trigger: string;
  readonly consent: string;
  readonly subject: (props: P, context: EmailContext) => string;
  readonly preheader: (props: P, context: EmailContext) => string;
  readonly blocks: (props: P, context: EmailContext) => readonly EmailBlock[];
  readonly reference?: (props: P) => string | undefined;
  readonly reason?: (props: P) => string | undefined;
  readonly sample: P;
}

export interface EmailTemplateDefinition<P> extends EmailTemplateSpec<P> {
  readonly Component: (props: { readonly data: P; readonly context: EmailContext }) => React.JSX.Element;
}

export function defineEmailTemplate<P>(spec: EmailTemplateSpec<P>): EmailTemplateDefinition<P> {
  function Component({ data, context }: { readonly data: P; readonly context: EmailContext }) {
    return (
      <EmailDocument
        context={context}
        kind={spec.kind}
        subject={spec.subject(data, context)}
        preheader={spec.preheader(data, context)}
        blocks={spec.blocks(data, context)}
        reference={spec.reference?.(data)}
        reason={spec.reason?.(data)}
      />
    );
  }
  Component.displayName = `${spec.key}Email`;
  return { ...spec, Component };
}

export const consentRules = {
  always: "Always sent; required for the account or transaction",
  security: "Always sent; security alerts cannot be turned off",
  legal: "Always sent; legally required notice",
  transactionalOptOut: "Sent by default; can be turned off in notification settings",
  marketing: "Only with marketing email consent; unsubscribe in every email",
} as const;
