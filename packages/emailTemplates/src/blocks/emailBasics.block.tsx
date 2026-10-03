import type { CSSProperties } from "react";
import { Button, Heading, Link, Section, Text } from "react-email";

import type { EmailLink, Rich, Tone } from "../emailTypes";
import { fontStack, monoStack } from "../theme/emailPalette";
import { useEmailPalette } from "./emailRenderContext";
import { RichText } from "./richText.block";

export const bodyText: CSSProperties = { margin: 0, fontFamily: fontStack, fontSize: 16, lineHeight: "26px" };

export function HeroBlock({ eyebrow, title, tone = "brand" }: { readonly eyebrow: string; readonly title: string; readonly tone?: Tone }) {
  const palette = useEmailPalette();
  return (
    <Section style={{ paddingBottom: 20 }}>
      <table role="presentation" cellPadding={0} cellSpacing={0} border={0} style={{ borderCollapse: "separate" }}>
        <tbody>
          <tr>
            <td className={`zm-tint-${tone}`} style={{ backgroundColor: palette.toneTint[tone], borderRadius: 999, padding: "5px 12px" }}>
              <span className={`zm-tone-${tone}`} style={{ fontFamily: fontStack, fontSize: 11, lineHeight: "14px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: palette.toneText[tone] }}>
                {eyebrow}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      <Heading as="h1" className="zm-text" style={{ margin: "16px 0 0", fontFamily: fontStack, fontSize: 26, lineHeight: "33px", fontWeight: 700, letterSpacing: "-0.02em", color: palette.text }}>
        {title}
      </Heading>
    </Section>
  );
}

export function ParagraphBlock({ text, muted }: { readonly text: Rich; readonly muted?: boolean }) {
  const palette = useEmailPalette();
  return (
    <Text className={muted ? "zm-muted" : "zm-text"} style={{ ...bodyText, fontSize: muted ? 14 : 16, lineHeight: muted ? "22px" : "26px", color: muted ? palette.muted : palette.text, paddingBottom: 16 }}>
      <RichText value={text} />
    </Text>
  );
}

export function ButtonBlock({ label, href, tone = "brand" }: { readonly label: string; readonly href: string; readonly tone?: "brand" | "danger" }) {
  const palette = useEmailPalette();
  const background = tone === "danger" ? palette.dangerButton : palette.button;
  return (
    <Section style={{ padding: "8px 0 24px" }}>
      <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td className={tone === "danger" ? undefined : "zm-btn"} align="center" {...({ bgcolor: background } as Record<string, string>)} style={{ backgroundColor: background, borderRadius: 10 }}>
              <Button href={href} style={{ display: "inline-block", padding: "14px 26px", fontFamily: fontStack, fontSize: 15, lineHeight: "20px", fontWeight: 700, color: palette.onButton, textDecoration: "none", borderRadius: 10 }}>
                {label}
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

export function LinksBlock({ items }: { readonly items: readonly EmailLink[] }) {
  const palette = useEmailPalette();
  return (
    <Text style={{ ...bodyText, fontSize: 14, lineHeight: "22px", paddingBottom: 16 }}>
      {items.map((item, index) => (
        <span key={item.href}>
          {index > 0 ? <span className="zm-muted" style={{ color: palette.muted }}>{"  ·  "}</span> : null}
          <Link href={item.href} className="zm-brand" style={{ color: palette.brand, fontWeight: 600, textDecoration: "underline" }}>
            {item.label}
          </Link>
        </span>
      ))}
    </Text>
  );
}

export function CalloutBlock({ tone, title, text }: { readonly tone: Tone; readonly title?: string; readonly text: Rich }) {
  const palette = useEmailPalette();
  return (
    <Section style={{ paddingBottom: 20 }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td className={`zm-solid-${tone}`} width={4} style={{ width: 4, backgroundColor: palette.toneSolid[tone], borderRadius: "4px 0 0 4px" }} />
            <td className={`zm-tint-${tone}`} style={{ backgroundColor: palette.toneTint[tone], padding: "14px 16px", borderRadius: "0 8px 8px 0" }}>
              {title ? (
                <Text className={`zm-tone-${tone}`} style={{ ...bodyText, fontSize: 14, lineHeight: "20px", fontWeight: 700, color: palette.toneText[tone], paddingBottom: 4 }}>
                  {title}
                </Text>
              ) : null}
              <Text className="zm-text" style={{ ...bodyText, fontSize: 14, lineHeight: "22px", color: palette.text }}>
                <RichText value={text} />
              </Text>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

export function DividerBlock() {
  const palette = useEmailPalette();
  return (
    <Section style={{ padding: "4px 0 20px" }}>
      <div className="zm-rule" style={{ height: 1, lineHeight: "1px", fontSize: 1, backgroundColor: palette.line }}>&nbsp;</div>
    </Section>
  );
}

export function ListBlock({ title, items }: { readonly title?: string; readonly items: readonly Rich[] }) {
  const palette = useEmailPalette();
  return (
    <Section style={{ paddingBottom: 16 }}>
      {title ? (
        <Text className="zm-text" style={{ ...bodyText, fontSize: 14, fontWeight: 700, color: palette.text, paddingBottom: 6 }}>
          {title}
        </Text>
      ) : null}
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td width={20} valign="top" className="zm-brand" style={{ width: 20, fontFamily: fontStack, fontSize: 15, lineHeight: "24px", color: palette.brand, fontWeight: 700 }}>
                •
              </td>
              <td className="zm-text" style={{ fontFamily: fontStack, fontSize: 15, lineHeight: "24px", color: palette.text, paddingBottom: 6 }}>
                <RichText value={item} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

export function QuoteBlock({ author, text, meta }: { readonly author: string; readonly text: string; readonly meta?: string }) {
  const palette = useEmailPalette();
  return (
    <Section style={{ paddingBottom: 20 }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td className="zm-sunken zm-line" style={{ backgroundColor: palette.sunken, border: `1px solid ${palette.line}`, borderRadius: 12, padding: "16px 18px" }}>
              <Text className="zm-text" style={{ ...bodyText, fontSize: 14, fontWeight: 700, color: palette.text }}>
                {author}
                {meta ? <span className="zm-muted" style={{ fontWeight: 400, color: palette.muted }}>{`  ·  ${meta}`}</span> : null}
              </Text>
              <Text className="zm-text" style={{ ...bodyText, fontSize: 15, lineHeight: "24px", color: palette.text, paddingTop: 6, whiteSpace: "pre-line" }}>
                {text}
              </Text>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

export function CodeBlock({ code, caption }: { readonly code: string; readonly caption: string }) {
  const palette = useEmailPalette();
  return (
    <Section style={{ paddingBottom: 20 }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td align="center" className="zm-tint-brand" style={{ backgroundColor: palette.toneTint.brand, borderRadius: 12, padding: "22px 16px" }}>
              <Text className="zm-text" style={{ margin: 0, fontFamily: monoStack, fontSize: 34, lineHeight: "40px", fontWeight: 700, letterSpacing: "0.32em", color: palette.text }}>
                {code}
              </Text>
              <Text className="zm-muted" style={{ ...bodyText, fontSize: 13, lineHeight: "20px", color: palette.muted, paddingTop: 8 }}>
                {caption}
              </Text>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}
