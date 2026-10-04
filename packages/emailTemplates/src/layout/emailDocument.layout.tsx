import { Body, Container, Head, Html, Preview, Section } from "react-email";

import { EmailBlockList } from "../blocks/emailBlockList.block";
import type { EmailBlock, EmailContext, EmailKind } from "../emailTypes";
import { buildDarkModeCss, fontStack, selectPalette } from "../theme/emailPalette";
import { EmailFooter } from "./emailFooter.layout";
import { BrandStrip, EmailHeader } from "./emailHeader.layout";

const responsiveCss =
  "@media only screen and (max-width:620px){.zm-outer{padding:16px 10px!important}.zm-pad{padding:26px 20px 10px!important}.zm-stack{display:block!important;width:100%!important;padding-left:0!important;padding-right:0!important}}" +
  "a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}u+#body a{color:inherit;text-decoration:none}";

export interface EmailDocumentProps {
  readonly context: EmailContext;
  readonly kind: EmailKind;
  readonly subject: string;
  readonly preheader: string;
  readonly blocks: readonly EmailBlock[];
  readonly reference?: string;
  readonly reason?: string;
}

export function EmailDocument({ context, kind, subject, preheader, blocks, reference, reason }: EmailDocumentProps) {
  const palette = selectPalette(context.theme);
  const colorScheme = context.theme === "auto" ? "light dark" : context.theme === "dark" ? "dark" : "light";
  const css = `${context.theme === "light" ? "" : buildDarkModeCss()}${responsiveCss}`;
  return (
    <Html lang={context.locale} dir="ltr">
      <Head>
        <title>{subject}</title>
        <meta name="color-scheme" content={colorScheme} />
        <meta name="supported-color-schemes" content={colorScheme} />
        <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />
        <style>{css}</style>
      </Head>
      <Preview useTitleTag={false}>{preheader}</Preview>
        <Body id="body" lang={context.locale} className="zm-page" style={{ margin: 0, padding: 0, backgroundColor: palette.page, fontFamily: fontStack, WebkitTextSizeAdjust: "100%" }}>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} className="zm-page" style={{ backgroundColor: palette.page }}>
            <tbody>
              <tr>
                <td align="center" className="zm-outer" style={{ padding: "28px 16px" }}>
                  <Container style={{ width: "100%", maxWidth: 600, margin: "0 auto" }}>
                    <EmailHeader reference={reference} />
                    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} className="zm-card" style={{ backgroundColor: palette.card, border: `1px solid ${palette.line}`, borderRadius: 16, borderCollapse: "separate" }}>
                      <tbody>
                        <tr>
                          <td>
                            <BrandStrip />
                          </td>
                        </tr>
                        <tr>
                          <td className="zm-pad" style={{ padding: "34px 36px 14px" }}>
                            <Section>
                              <EmailBlockList blocks={blocks} />
                            </Section>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <EmailFooter kind={kind} reason={reason} />
                  </Container>
                </td>
              </tr>
            </tbody>
          </table>
        </Body>
    </Html>
  );
}
