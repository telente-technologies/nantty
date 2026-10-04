import type { CSSProperties } from "react";
import { Img, Link, Text } from "react-email";

import { useEmailEnvironment } from "../blocks/emailRenderContext";
import type { EmailKind } from "../emailTypes";
import { fontStack } from "../theme/emailPalette";

export const defaultReasons: Record<EmailKind, string> = {
  transactional: "You're getting this email because of activity on your Zudomart account.",
  security: "We send security emails to every account owner so you always know what happens to your account. You can't turn these off.",
  legal: "We send this to everyone with a Zudomart account because it affects your rights and how we handle your information.",
  marketing: "You're getting this because you said yes to deals and recommendations from Zudomart. We only feature verified sellers and brands.",
};

export const storeTrademarkLine = "Apple and the Apple logo are trademarks of Apple Inc., registered in the U.S. and other countries and regions. App Store is a service mark of Apple Inc. Google Play and the Google Play logo are trademarks of Google LLC.";

const appleBadge = { alt: "Download on the App Store", width: 120, height: 40 } as const;
const googleBadge = { alt: "Get it on Google Play", width: 155, height: 60 } as const;

function TextStoreButton({ label, href }: { readonly label: string; readonly href: string }) {
  return (
    <Link href={href} style={{ display: "inline-block", padding: "9px 14px", borderRadius: 8, border: "1px solid #A6A6A6", backgroundColor: "#000000", color: "#FFFFFF", fontFamily: fontStack, fontSize: 12, lineHeight: "16px", fontWeight: 600, textDecoration: "none" }}>
      {label}
    </Link>
  );
}

function StoreBadges() {
  const { brand } = useEmailEnvironment().context;
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0} style={{ marginLeft: -10 }}>
      <tbody>
        <tr>
          <td valign="middle" style={{ padding: 10 }}>
            {brand.appStoreBadgeUrl ? (
              <Link href={brand.appStoreUrl} style={{ display: "block", lineHeight: 0 }}>
                <Img src={brand.appStoreBadgeUrl} alt={appleBadge.alt} width={appleBadge.width} height={appleBadge.height} style={{ display: "block", width: appleBadge.width, height: appleBadge.height, border: 0 }} />
              </Link>
            ) : (
              <TextStoreButton label={appleBadge.alt} href={brand.appStoreUrl} />
            )}
          </td>
          <td valign="middle" style={{ padding: brand.playStoreBadgeUrl ? 0 : 10 }}>
            {brand.playStoreBadgeUrl ? (
              <Link href={brand.playStoreUrl} style={{ display: "block", lineHeight: 0 }}>
                <Img src={brand.playStoreBadgeUrl} alt={googleBadge.alt} width={googleBadge.width} height={googleBadge.height} style={{ display: "block", width: googleBadge.width, height: googleBadge.height, border: 0 }} />
              </Link>
            ) : (
              <TextStoreButton label={googleBadge.alt} href={brand.playStoreUrl} />
            )}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function EmailFooter({ kind, reason }: { readonly kind: EmailKind; readonly reason?: string }) {
  const { palette, context } = useEmailEnvironment();
  const { brand, links } = context;
  const small: CSSProperties = { margin: 0, fontFamily: fontStack, fontSize: 12, lineHeight: "19px", color: palette.subtle };
  const linkStyle: CSSProperties = { color: palette.muted, textDecoration: "underline", fontWeight: 600 };
  const separator = <span className="zm-subtle" style={{ color: palette.subtle, padding: "0 8px" }}>·</span>;
  const year = new Date().getFullYear();
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
      <tbody>
        <tr>
          <td className="zm-foot" style={{ padding: "28px 40px 8px" }}>
            <Text className="zm-text" style={{ ...small, fontSize: 14, lineHeight: "20px", fontWeight: 700, color: palette.text }}>
              Shop, sell and go live on the Zudomart app
            </Text>
            <StoreBadges />
            <Text className="zm-muted" style={{ ...small, color: palette.muted, paddingTop: 10, paddingBottom: 14 }}>
              {kind === "marketing" ? (
                <>
                  <Link href={links.unsubscribeUrl} className="zm-muted" style={linkStyle}>Unsubscribe</Link>
                  {separator}
                  <Link href={links.preferencesUrl} className="zm-muted" style={linkStyle}>Email preferences</Link>
                </>
              ) : (
                <Link href={links.manageNotificationsUrl} className="zm-muted" style={linkStyle}>Manage notifications</Link>
              )}
              {separator}
              <Link href={brand.helpCenterUrl} className="zm-muted" style={linkStyle}>Help Centre</Link>
            </Text>
            <Text className="zm-subtle" style={{ ...small, paddingBottom: 10 }}>{reason ?? defaultReasons[kind]}</Text>
            <Text className="zm-subtle" style={{ ...small, paddingBottom: 10 }}>
              {"Questions? Write to "}
              {brand.supportEmails.map((email, index) => (
                <span key={email}>
                  {index > 0 ? " or " : ""}
                  <Link href={`mailto:${email}`} className="zm-muted" style={linkStyle}>{email}</Link>
                </span>
              ))}
              . We will never ask for your password, PIN or one-time code by email.
            </Text>
            <Text className="zm-subtle" style={{ ...small, paddingBottom: 10 }}>
              {`© ${year} ${brand.companyLegalName}`}
              <br />
              {brand.companyAddress}
            </Text>
            <Text className="zm-subtle" style={{ ...small, fontSize: 10, lineHeight: "15px" }}>{storeTrademarkLine}</Text>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
