import type { CSSProperties } from "react";
import { Img, Link, Section, Text } from "react-email";

import { useEmailEnvironment } from "../blocks/emailRenderContext";
import type { EmailKind } from "../emailTypes";
import { fontStack } from "../theme/emailPalette";

export const defaultReasons: Record<EmailKind, string> = {
  transactional: "You're getting this email because of activity on your Zudomart account.",
  security: "We send security emails to every account owner so you always know what happens to your account. You can't turn these off.",
  legal: "We send this to everyone with a Zudomart account because it affects your rights and how we handle your information.",
  marketing: "You're getting this because you said yes to deals and recommendations from Zudomart. We only feature verified sellers and brands.",
};

function StoreBadge({ label, href, imageUrl }: { readonly label: string; readonly href: string; readonly imageUrl: string | null }) {
  const { palette } = useEmailEnvironment();
  if (imageUrl) {
    return (
      <Link href={href} style={{ display: "inline-block", marginRight: 8 }}>
        <Img src={imageUrl} alt={label} height={40} style={{ display: "block", height: 40, width: "auto", border: 0 }} />
      </Link>
    );
  }
  return (
    <Link href={href} style={{ display: "inline-block", marginRight: 8, marginBottom: 6, padding: "8px 14px", borderRadius: 8, backgroundColor: palette.text, color: palette.card, fontFamily: fontStack, fontSize: 12, lineHeight: "16px", fontWeight: 700, textDecoration: "none" }}>
      {label}
    </Link>
  );
}

export function EmailFooter({ kind, reason }: { readonly kind: EmailKind; readonly reason?: string }) {
  const { palette, context } = useEmailEnvironment();
  const { brand, links } = context;
  const small: CSSProperties = { margin: 0, fontFamily: fontStack, fontSize: 12, lineHeight: "19px", color: palette.muted };
  const linkStyle: CSSProperties = { color: palette.muted, textDecoration: "underline" };
  const year = new Date().getFullYear();
  return (
    <Section style={{ padding: "28px 8px 8px" }}>
      <Text className="zm-text" style={{ ...small, fontSize: 13, fontWeight: 700, color: palette.text, paddingBottom: 10 }}>
        Shop, sell and go live on the Zudomart app
      </Text>
      <div style={{ paddingBottom: 18 }}>
        <StoreBadge label="Download on the App Store" href={brand.appStoreUrl} imageUrl={brand.appStoreBadgeUrl} />
        <StoreBadge label="Get it on Google Play" href={brand.playStoreUrl} imageUrl={brand.playStoreBadgeUrl} />
      </div>
      <div className="zm-rule" style={{ height: 1, lineHeight: "1px", fontSize: 1, backgroundColor: palette.line, marginBottom: 14 }}>&nbsp;</div>
      <Text className="zm-muted" style={{ ...small, paddingBottom: 8 }}>{reason ?? defaultReasons[kind]}</Text>
      <Text className="zm-muted" style={{ ...small, paddingBottom: 8 }}>
        {kind === "marketing" ? (
          <>
            <Link href={links.unsubscribeUrl} className="zm-muted" style={{ ...linkStyle, fontWeight: 700 }}>Unsubscribe</Link>
            {"   ·   "}
            <Link href={links.preferencesUrl} className="zm-muted" style={linkStyle}>Manage email preferences</Link>
          </>
        ) : (
          <Link href={links.manageNotificationsUrl} className="zm-muted" style={linkStyle}>Manage notifications</Link>
        )}
        {"   ·   "}
        <Link href={brand.helpCenterUrl} className="zm-muted" style={linkStyle}>Help Centre</Link>
      </Text>
      <Text className="zm-muted" style={{ ...small, paddingBottom: 8 }}>
        {"Need a hand? Email "}
        {brand.supportEmails.map((email, index) => (
          <span key={email}>
            {index > 0 ? " or " : ""}
            <Link href={`mailto:${email}`} className="zm-muted" style={linkStyle}>{email}</Link>
          </span>
        ))}
        . Zudomart will never ask for your password, PIN or one-time code by email.
      </Text>
      <Text className="zm-muted" style={small}>
        {`© ${year} ${brand.companyLegalName}. ${brand.companyAddress}.`}
      </Text>
    </Section>
  );
}
