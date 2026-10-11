import { Body, Head, Html, Preview, Section } from "react-email";

import { EmailBlockList } from "../blocks/emailBlockList.block";
import type { EmailBlock, EmailContext, EmailKind } from "../emailTypes";
import { buildDarkModeCss, fontStack, selectPalette } from "../theme/emailPalette";
import { EmailFooter } from "./emailFooter.layout";
import { EmailHeader } from "./emailHeader.layout";

const responsiveCss =
  "@media only screen and (max-width:620px){.zm-outer{padding:12px 8px 24px!important}.zm-head{padding:22px 22px 0!important}.zm-pad{padding:24px 22px 8px!important}.zm-foot{padding:24px 22px 8px!important}.zm-h1{font-size:24px!important;line-height:31px!important}.zm-stack{display:block!important;width:100%!important;padding-left:0!important;padding-right:0!important}.zm-full{width:100%!important}.zm-full a{display:block!important}.zm-hide-sm{display:none!important}.zm-tight{padding-left:14px!important;padding-right:14px!important}.zm-gap{padding-left:12px!important}.zm-num{font-size:30px!important;line-height:36px!important}}" +
  "a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}u+#body a{color:inherit;text-decoration:none}#MessageViewBody a{color:inherit;text-decoration:none}";

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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="x-apple-disable-message-reformatting" />
        <meta name="color-scheme" content={colorScheme} />
        <meta name="supported-color-schemes" content={colorScheme} />
        <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" />
        <style>{css}</style>
      </Head>
      <Preview useTitleTag={false}>{preheader}</Preview>
        <Body id="body" lang={context.locale} className="zm-page" style={{ margin: 0, padding: 0, backgroundColor: palette.page, fontFamily: fontStack, WebkitTextSizeAdjust: "100%" }}>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} className="zm-page" style={{ backgroundColor: palette.page }}>
            <tbody>
              <tr>
                <td align="center" className="zm-outer" style={{ padding: "32px 16px 40px" }}>
                  <table role="presentation" width={600} align="center" cellPadding={0} cellSpacing={0} border={0} style={{ width: "100%", maxWidth: 600, margin: "0 auto" }}>
                    <tbody>
                      <tr>
                        <td>
                        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} className="zm-card" style={{ backgroundColor: palette.card, border: `1px solid ${palette.line}`, borderRadius: 20, borderCollapse: "separate" }}>
                          <tbody>
                            <tr>
                              <td className="zm-head" style={{ padding: "28px 40px 0" }}>
                                <EmailHeader reference={reference} />
                              </td>
                            </tr>
                            <tr>
                              <td className="zm-pad" style={{ padding: "32px 40px 16px" }}>
                                <Section>
                                  <EmailBlockList blocks={blocks} />
                                </Section>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <EmailFooter kind={kind} reason={reason} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </Body>
    </Html>
  );
}
