import { Img, Link } from "react-email";

import { useEmailEnvironment } from "../blocks/emailRenderContext";
import { fontStack, monoStack } from "../theme/emailPalette";

function InlineWordmark() {
  const { palette } = useEmailEnvironment();
  return (
    <span className="zm-brand" style={{ fontFamily: fontStack, fontSize: 22, lineHeight: "28px", fontWeight: 700, fontStyle: "italic", letterSpacing: "-0.02em", color: palette.brand }}>
      zudomart
    </span>
  );
}

function referenceParts(reference: string): { readonly label: string | null; readonly value: string } {
  const match = reference.match(/^([A-Za-z][A-Za-z ]{1,18})\s+([A-Z0-9][\w-]*)$/);
  return match ? { label: match[1] ?? null, value: match[2] ?? reference } : { label: null, value: reference };
}

export function EmailHeader({ reference }: { readonly reference?: string }) {
  const { palette, context } = useEmailEnvironment();
  const { brand } = context;
  const parts = reference ? referenceParts(reference) : null;
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
      <tbody>
        <tr>
          <td valign="middle">
            <Link href={brand.webBaseUrl} style={{ textDecoration: "none" }}>
              {brand.logoUrl ? (
                <Img src={brand.logoUrl} alt={brand.productName} width={brand.logoWidth} style={{ display: "block", border: 0, height: "auto", fontFamily: fontStack, fontSize: 20, fontWeight: 700, color: palette.text }} />
              ) : (
                <InlineWordmark />
              )}
            </Link>
          </td>
          {parts ? (
            <td valign="middle" align="right" style={{ textAlign: "right" }}>
              {parts.label ? (
                <span className="zm-subtle" style={{ display: "block", fontFamily: fontStack, fontSize: 10, lineHeight: "14px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: palette.subtle }}>
                  {parts.label}
                </span>
              ) : null}
              <span className="zm-text" style={{ display: "block", fontFamily: monoStack, fontSize: 12, lineHeight: "16px", fontWeight: 500, letterSpacing: "0.02em", color: palette.text }}>
                {parts.value}
              </span>
            </td>
          ) : null}
        </tr>
      </tbody>
    </table>
  );
}

export function BrandStrip() {
  const { palette } = useEmailEnvironment();
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
      <tbody>
        <tr>
          <td className="zm-btn" width="86%" style={{ height: 4, lineHeight: "4px", fontSize: 1, backgroundColor: palette.button, borderRadius: "20px 0 0 0", msoLineHeightRule: "exactly" } as React.CSSProperties}>&nbsp;</td>
          <td width="14%" style={{ height: 4, lineHeight: "4px", fontSize: 1, backgroundColor: palette.accent, borderRadius: "0 20px 0 0", msoLineHeightRule: "exactly" } as React.CSSProperties}>&nbsp;</td>
        </tr>
      </tbody>
    </table>
  );
}
