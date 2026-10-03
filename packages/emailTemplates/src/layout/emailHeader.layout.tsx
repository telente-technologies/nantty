import { Img, Link, Section } from "react-email";

import { useEmailEnvironment } from "../blocks/emailRenderContext";
import { fontStack, monoStack } from "../theme/emailPalette";

function InlineWordmark() {
  const { palette } = useEmailEnvironment();
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
      <tbody>
        <tr>
          <td className="zm-btn" align="center" valign="middle" width={30} height={30} style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: palette.button, fontFamily: fontStack, fontSize: 19, lineHeight: "30px", fontWeight: 800, color: palette.onButton }}>
            z
          </td>
          <td className="zm-brand" valign="middle" style={{ paddingLeft: 9, fontFamily: fontStack, fontSize: 22, lineHeight: "30px", fontWeight: 700, letterSpacing: "-0.03em", color: palette.brand }}>
            zudomart
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function EmailHeader({ reference }: { readonly reference?: string }) {
  const { palette, context } = useEmailEnvironment();
  const { brand } = context;
  return (
    <Section style={{ padding: "0 0 18px" }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td valign="middle">
              <Link href={brand.webBaseUrl} style={{ textDecoration: "none" }}>
                {brand.logoUrl ? (
                  <Img src={brand.logoUrl} alt={brand.productName} width={brand.logoWidth} style={{ display: "block", border: 0, height: "auto", fontFamily: fontStack, fontSize: 22, fontWeight: 700, color: palette.brand }} />
                ) : (
                  <InlineWordmark />
                )}
              </Link>
            </td>
            {reference ? (
              <td valign="middle" align="right" className="zm-muted" style={{ fontFamily: monoStack, fontSize: 12, lineHeight: "16px", letterSpacing: "0.04em", color: palette.muted }}>
                {reference}
              </td>
            ) : null}
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

export function BrandStrip() {
  const { palette } = useEmailEnvironment();
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
      <tbody>
        <tr>
          <td className="zm-btn" width="78%" style={{ height: 5, lineHeight: "5px", fontSize: 1, backgroundColor: palette.button, borderRadius: "16px 0 0 0" }}>&nbsp;</td>
          <td width="22%" style={{ height: 5, lineHeight: "5px", fontSize: 1, backgroundColor: palette.accent, borderRadius: "0 16px 0 0" }}>&nbsp;</td>
        </tr>
      </tbody>
    </table>
  );
}
