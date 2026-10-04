import type { CSSProperties } from "react";
import { Heading, Link, Section, Text } from "react-email";

import type { EmailLink, Rich, Tone } from "../emailTypes";
import { fontStack, monoStack } from "../theme/emailPalette";
import { BulletproofButton } from "./emailButton.block";
import { useEmailPalette } from "./emailRenderContext";
import { RichText } from "./richText.block";

export const bodyText: CSSProperties = { margin: 0, fontFamily: fontStack, fontSize: 16, lineHeight: "26px" };

export function StatusPill({ label, tone }: { readonly label: string; readonly tone: Tone }) {
  const palette = useEmailPalette();
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0} style={{ borderCollapse: "separate" }}>
      <tbody>
        <tr>
          <td className={`zm-tint-${tone}`} style={{ backgroundColor: palette.toneTint[tone], borderRadius: 999, padding: "5px 12px 5px 10px", whiteSpace: "nowrap" }}>
            <span className={`zm-solid-${tone}`} style={{ display: "inline-block", width: 7, height: 7, borderRadius: 7, backgroundColor: palette.toneSolid[tone], verticalAlign: "middle", marginRight: 7, fontSize: 1, lineHeight: "7px" }}>&nbsp;</span>
            <span className={`zm-tone-${tone}`} style={{ fontFamily: fontStack, fontSize: 11, lineHeight: "16px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: palette.toneText[tone], verticalAlign: "middle" }}>
              {label}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function HeroBlock({ eyebrow, title, tone = "brand" }: { readonly eyebrow: string; readonly title: string; readonly tone?: Tone }) {
  const palette = useEmailPalette();
  return (
    <Section style={{ paddingBottom: 22 }}>
      <StatusPill label={eyebrow} tone={tone} />
      <Heading as="h1" className="zm-text zm-h1" style={{ margin: "18px 0 0", fontFamily: fontStack, fontSize: 28, lineHeight: "36px", fontWeight: 700, letterSpacing: "-0.025em", color: palette.text }}>
        {title}
      </Heading>
    </Section>
  );
}

export function ParagraphBlock({ text, muted }: { readonly text: Rich; readonly muted?: boolean }) {
  const palette = useEmailPalette();
  return (
    <Text className={muted ? "zm-muted" : "zm-text"} style={{ ...bodyText, fontSize: muted ? 14 : 16, lineHeight: muted ? "22px" : "26px", color: muted ? palette.muted : palette.text, paddingBottom: muted ? 14 : 18 }}>
      <RichText value={text} />
    </Text>
  );
}

export function ButtonBlock({ label, href, tone = "brand" }: { readonly label: string; readonly href: string; readonly tone?: "brand" | "danger" }) {
  const palette = useEmailPalette();
  return (
    <Section style={{ padding: "6px 0 26px" }}>
      <BulletproofButton label={label} href={href} background={tone === "danger" ? palette.dangerButton : palette.button} color={palette.onButton} darkClass={tone === "danger" ? undefined : "zm-btn"} />
    </Section>
  );
}

export function LinksBlock({ items }: { readonly items: readonly EmailLink[] }) {
  const palette = useEmailPalette();
  return (
    <Text style={{ ...bodyText, fontSize: 14, lineHeight: "22px", paddingBottom: 18 }}>
      {items.map((item, index) => (
        <span key={item.href}>
          {index > 0 ? <span className="zm-subtle" style={{ color: palette.subtle, padding: "0 8px" }}>·</span> : null}
          <Link href={item.href} className="zm-brand" style={{ color: palette.brand, fontWeight: 600, textDecoration: "none", borderBottom: `1px solid ${palette.brand}` }}>
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
    <Section style={{ paddingBottom: 22 }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} style={{ borderCollapse: "separate" }}>
        <tbody>
          <tr>
            <td className={`zm-tint-${tone} zm-edge-${tone}`} style={{ backgroundColor: palette.toneTint[tone], borderLeft: `3px solid ${palette.toneSolid[tone]}`, borderRadius: 12, padding: "14px 18px 15px 16px" }}>
              {title ? (
                <Text className={`zm-tone-${tone}`} style={{ ...bodyText, fontSize: 14, lineHeight: "20px", fontWeight: 700, color: palette.toneText[tone], paddingBottom: 3 }}>
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
    <Section style={{ padding: "6px 0 24px" }}>
      <div className="zm-rule" style={{ height: 1, lineHeight: "1px", fontSize: 1, backgroundColor: palette.line }}>&nbsp;</div>
    </Section>
  );
}

export function SectionLabel({ children }: { readonly children: string }) {
  const palette = useEmailPalette();
  return (
    <Text className="zm-subtle" style={{ ...bodyText, fontSize: 11, lineHeight: "16px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: palette.subtle, paddingBottom: 10 }}>
      {children}
    </Text>
  );
}

export function ListBlock({ title, items }: { readonly title?: string; readonly items: readonly Rich[] }) {
  const palette = useEmailPalette();
  return (
    <Section style={{ paddingBottom: 18 }}>
      {title ? <SectionLabel>{title}</SectionLabel> : null}
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td width={18} valign="top" style={{ width: 18, paddingTop: 10 }}>
                <div className="zm-btn" style={{ width: 6, height: 6, borderRadius: 6, backgroundColor: palette.button, fontSize: 1, lineHeight: "6px" }}>&nbsp;</div>
              </td>
              <td className="zm-text" style={{ fontFamily: fontStack, fontSize: 15, lineHeight: "24px", color: palette.text, paddingBottom: 8 }}>
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
    <Section style={{ paddingBottom: 22 }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} style={{ borderCollapse: "separate" }}>
        <tbody>
          <tr>
            <td className="zm-sunken zm-line" style={{ backgroundColor: palette.sunken, border: `1px solid ${palette.line}`, borderRadius: 14, padding: "16px 18px 17px" }}>
              <Text className="zm-text" style={{ ...bodyText, fontSize: 14, lineHeight: "20px", fontWeight: 700, color: palette.text }}>
                {author}
                {meta ? <span className="zm-subtle" style={{ fontWeight: 500, color: palette.subtle }}>{`  ·  ${meta}`}</span> : null}
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
    <Section style={{ paddingBottom: 24 }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} style={{ borderCollapse: "separate" }}>
        <tbody>
          <tr>
            <td align="center" className="zm-sunken zm-line-strong" style={{ backgroundColor: palette.sunken, border: `1px dashed ${palette.lineStrong}`, borderRadius: 16, padding: "26px 16px 22px" }}>
              <Text className="zm-text zm-num" style={{ margin: 0, fontFamily: monoStack, fontSize: 36, lineHeight: "44px", fontWeight: 700, letterSpacing: "0.28em", paddingLeft: "0.28em", color: palette.text }}>
                {code}
              </Text>
              <Text className="zm-muted" style={{ ...bodyText, fontSize: 13, lineHeight: "20px", color: palette.muted, paddingTop: 10 }}>
                {caption}
              </Text>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}
