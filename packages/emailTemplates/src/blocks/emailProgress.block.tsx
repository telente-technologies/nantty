import type { CSSProperties } from "react";
import { Link, Section, Text } from "react-email";

import type { EmailLink, PersonCard, StepState, Tone } from "../emailTypes";
import type { EmailPalette } from "../theme/emailPalette";
import { fontStack } from "../theme/emailPalette";
import { bodyText } from "./emailBasics.block";
import { useEmailPalette } from "./emailRenderContext";

interface TrackProps {
  readonly steps: readonly string[];
  readonly current: number;
  readonly tone?: Tone;
  readonly caption?: string;
}

const hairline = (color: string, className: string): React.JSX.Element => (
  <div className={className} style={{ height: 2, lineHeight: "2px", fontSize: 1, backgroundColor: color }}>&nbsp;</div>
);

function Dot({ state, tone, palette, size = 12 }: { readonly state: StepState; readonly tone: Tone; readonly palette: EmailPalette; readonly size?: number }) {
  const solid = tone === "brand" ? palette.button : palette.toneSolid[tone];
  const solidClass = tone === "brand" ? "zm-btn" : `zm-solid-${tone}`;
  const base: CSSProperties = { width: size, height: size, borderRadius: size, fontSize: 1, lineHeight: `${size}px`, boxSizing: "border-box", margin: "0 auto" };
  if (state === "done") return <div className={solidClass} style={{ ...base, backgroundColor: solid }}>&nbsp;</div>;
  if (state === "current") return <div className={`zm-ring zm-edge-${tone === "brand" ? "brand" : tone}`} style={{ ...base, width: size + 4, height: size + 4, borderRadius: size + 4, lineHeight: `${size - 2}px`, border: `4px solid ${solid}`, backgroundColor: palette.card }}>&nbsp;</div>;
  return <div className="zm-ring" style={{ ...base, border: `2px solid ${palette.lineStrong}`, backgroundColor: palette.card }}>&nbsp;</div>;
}

export function TrackBlock({ steps, current, tone = "brand", caption }: TrackProps) {
  const palette = useEmailPalette();
  const width = `${Math.floor(100 / steps.length)}%`;
  const activeLine = tone === "brand" ? palette.button : palette.toneSolid[tone];
  const activeClass = tone === "brand" ? "zm-btn" : `zm-solid-${tone}`;
  return (
    <Section style={{ paddingBottom: 24 }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} style={{ tableLayout: "fixed" }}>
        <tbody>
          <tr>
            {steps.map((step, index) => {
              const state: StepState = index < current ? "done" : index === current ? "current" : "todo";
              const leftColor = index === 0 ? "transparent" : index <= current ? activeLine : palette.line;
              const rightColor = index === steps.length - 1 ? "transparent" : index < current ? activeLine : palette.line;
              const leftClass = index === 0 ? "" : index <= current ? activeClass : "zm-rule";
              const rightClass = index === steps.length - 1 ? "" : index < current ? activeClass : "zm-rule";
              return (
                <td key={step} width={width} valign="top" style={{ width }}>
                  <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
                    <tbody>
                      <tr>
                        <td width="50%" valign="middle">{hairline(leftColor, leftClass)}</td>
                        <td width={16} valign="middle" align="center" style={{ width: 16, height: 16 }}>
                          <Dot state={state} tone={tone} palette={palette} />
                        </td>
                        <td width="50%" valign="middle">{hairline(rightColor, rightClass)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <Text className={state === "todo" ? "zm-subtle" : "zm-text"} style={{ ...bodyText, fontSize: 11, lineHeight: "15px", paddingTop: 8, paddingLeft: 2, paddingRight: 2, textAlign: "center", fontWeight: state === "current" ? 700 : 500, color: state === "todo" ? palette.subtle : palette.text }}>
                    {step}
                  </Text>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
      {caption ? <Text className="zm-muted" style={{ ...bodyText, fontSize: 13, lineHeight: "20px", color: palette.muted, paddingTop: 14, textAlign: "center" }}>{caption}</Text> : null}
    </Section>
  );
}

export function StepsBlock({ items }: { readonly items: readonly { readonly title: string; readonly text: string; readonly state: StepState }[] }) {
  const palette = useEmailPalette();
  return (
    <Section style={{ paddingBottom: 14 }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          {items.flatMap((item, index) => {
            const isLast = index === items.length - 1;
            const lineColor = item.state === "done" ? palette.toneSolid.success : palette.line;
            const tone: Tone = item.state === "done" ? "success" : "brand";
            return [
              <tr key={`${item.title}-head`}>
                <td colSpan={2} width={30} valign="middle" style={{ width: 30 }}>
                  <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width={16}>
                    <tbody>
                      <tr>
                        <td width={16} height={20} align="center" valign="middle" style={{ width: 16, height: 20 }}>
                          <Dot state={item.state} tone={tone} palette={palette} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
                <td valign="middle">
                  <Text className={item.state === "todo" ? "zm-muted" : "zm-text"} style={{ ...bodyText, fontSize: 15, lineHeight: "20px", fontWeight: 700, color: item.state === "todo" ? palette.muted : palette.text }}>
                    {item.title}
                    {item.state === "current" ? <span className="zm-tone-brand" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: palette.toneText.brand, paddingLeft: 8 }}>Now</span> : null}
                  </Text>
                </td>
              </tr>,
              <tr key={`${item.title}-body`}>
                <td width={7} style={{ width: 7 }} />
                <td width={23} className={isLast ? undefined : item.state === "done" ? "zm-edge-success" : "zm-line"} style={{ width: 23, borderLeft: isLast ? "none" : `2px solid ${lineColor}` }} />
                <td style={{ paddingTop: 3, paddingBottom: isLast ? 6 : 18 }}>
                  <Text className="zm-muted" style={{ ...bodyText, fontSize: 14, lineHeight: "21px", color: palette.muted }}>{item.text}</Text>
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </Section>
  );
}

export function ProgressBlock({ items }: { readonly items: readonly { readonly label: string; readonly value: number; readonly target: number; readonly display?: string }[] }) {
  const palette = useEmailPalette();
  return (
    <Section style={{ paddingBottom: 18 }}>
      {items.map((item) => {
        const ratio = Math.max(0, Math.min(1, item.target === 0 ? 1 : item.value / item.target));
        const percent = Math.round(ratio * 100);
        const isMet = ratio >= 1;
        return (
          <table key={item.label} role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} style={{ marginBottom: 16 }}>
            <tbody>
              <tr>
                <td className="zm-text" style={{ fontFamily: fontStack, fontSize: 14, lineHeight: "20px", fontWeight: 600, color: palette.text, paddingBottom: 7 }}>{item.label}</td>
                <td align="right" className={isMet ? "zm-tone-success" : "zm-muted"} style={{ fontFamily: fontStack, fontSize: 13, lineHeight: "20px", fontWeight: isMet ? 700 : 500, color: isMet ? palette.toneText.success : palette.muted, paddingBottom: 7, whiteSpace: "nowrap" }}>
                  {isMet ? "Done  ·  " : ""}
                  {item.display ?? `${item.value.toLocaleString("en")} / ${item.target.toLocaleString("en")}`}
                </td>
              </tr>
              <tr>
                <td colSpan={2}>
                  <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} className="zm-tint-neutral" style={{ backgroundColor: palette.toneTint.neutral, borderRadius: 6 }}>
                    <tbody>
                      <tr>
                        {percent > 0 ? <td className={isMet ? "zm-solid-success" : "zm-btn"} width={`${percent}%`} style={{ height: 8, lineHeight: "8px", fontSize: 1, borderRadius: 6, backgroundColor: isMet ? palette.toneSolid.success : palette.button }}>&nbsp;</td> : null}
                        {percent < 100 ? <td style={{ height: 8, lineHeight: "8px", fontSize: 1 }}>&nbsp;</td> : null}
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        );
      })}
    </Section>
  );
}

function initialsFor(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function PeopleBlock({ items, more }: { readonly items: readonly PersonCard[]; readonly more?: string }) {
  const palette = useEmailPalette();
  return (
    <Section style={{ paddingBottom: 18 }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          {items.map((person, index) => (
            <tr key={person.handle}>
              <td width={52} valign="middle" className="zm-line" style={{ width: 52, padding: "12px 0", borderTop: index === 0 ? "none" : `1px solid ${palette.line}` }}>
                <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
                  <tbody>
                    <tr>
                      <td align="center" valign="middle" className="zm-tint-brand zm-tone-brand" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.toneTint.brand, color: palette.toneText.brand, fontFamily: fontStack, fontSize: 14, lineHeight: "40px", fontWeight: 700 }}>
                        {initialsFor(person.name)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
              <td valign="middle" className="zm-line" style={{ padding: "12px 0", borderTop: index === 0 ? "none" : `1px solid ${palette.line}` }}>
                <Text className="zm-text" style={{ ...bodyText, fontSize: 15, lineHeight: "20px", fontWeight: 600, color: palette.text }}>
                  {person.name} <span className="zm-subtle" style={{ fontWeight: 400, color: palette.subtle }}>{`@${person.handle}`}</span>
                </Text>
                {person.note ? <Text className="zm-muted" style={{ ...bodyText, fontSize: 13, lineHeight: "19px", color: palette.muted, paddingTop: 2 }}>{person.note}</Text> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {more ? <Text className="zm-muted" style={{ ...bodyText, fontSize: 13, lineHeight: "20px", color: palette.muted, paddingTop: 4 }}>{more}</Text> : null}
    </Section>
  );
}

export function RatingBlock({ question, options }: { readonly question: string; readonly options: readonly EmailLink[] }) {
  const palette = useEmailPalette();
  return (
    <Section style={{ paddingBottom: 22 }}>
      <Text className="zm-text" style={{ ...bodyText, fontSize: 15, lineHeight: "22px", fontWeight: 700, color: palette.text, paddingBottom: 12 }}>{question}</Text>
      <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            {options.map((option) => (
              <td key={option.href} style={{ paddingRight: 8, paddingBottom: 8 }}>
                <Link href={option.href} className="zm-line-strong zm-text" style={{ display: "inline-block", border: `1px solid ${palette.lineStrong}`, borderRadius: 999, padding: "9px 16px", fontFamily: fontStack, fontSize: 13, lineHeight: "18px", fontWeight: 600, color: palette.text, textDecoration: "none" }}>
                  {option.label}
                </Link>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </Section>
  );
}
