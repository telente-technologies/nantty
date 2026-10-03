import { Link, Section, Text } from "react-email";

import type { EmailLink, PersonCard, StepState, Tone } from "../emailTypes";
import { fontStack } from "../theme/emailPalette";
import { bodyText } from "./emailBasics.block";
import { useEmailPalette } from "./emailRenderContext";

interface TrackProps {
  readonly steps: readonly string[];
  readonly current: number;
  readonly tone?: Tone;
  readonly caption?: string;
}

export function TrackBlock({ steps, current, tone = "brand", caption }: TrackProps) {
  const palette = useEmailPalette();
  const width = `${Math.floor(100 / steps.length)}%`;
  return (
    <Section style={{ paddingBottom: 22 }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} style={{ tableLayout: "fixed" }}>
        <tbody>
          <tr>
            {steps.map((step, index) => {
              const isDone = index < current;
              const isCurrent = index === current;
              const barColor = isCurrent ? (tone === "brand" ? palette.accent : palette.toneSolid[tone]) : isDone ? palette.button : palette.line;
              const barClass = isCurrent ? (tone === "brand" ? "" : `zm-solid-${tone}`) : isDone ? "zm-btn" : "zm-rule";
              return (
                <td key={step} width={width} valign="top" style={{ width, paddingRight: index === steps.length - 1 ? 0 : 4 }}>
                  <div className={barClass} style={{ height: 6, lineHeight: "6px", fontSize: 1, borderRadius: 3, backgroundColor: barColor }}>&nbsp;</div>
                  <Text
                    className={isCurrent ? "zm-text" : "zm-muted"}
                    style={{ ...bodyText, fontSize: 11, lineHeight: "15px", paddingTop: 8, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? palette.text : palette.muted }}
                  >
                    {isDone ? `✓ ${step}` : step}
                  </Text>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
      {caption ? <Text className="zm-muted" style={{ ...bodyText, fontSize: 13, lineHeight: "20px", color: palette.muted, paddingTop: 10 }}>{caption}</Text> : null}
    </Section>
  );
}

const stepMarks: Record<StepState, string> = { done: "✓", current: "●", todo: "○" };

export function StepsBlock({ items }: { readonly items: readonly { readonly title: string; readonly text: string; readonly state: StepState }[] }) {
  const palette = useEmailPalette();
  return (
    <Section style={{ paddingBottom: 16 }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          {items.map((item) => {
            const markColor = item.state === "done" ? palette.toneText.success : item.state === "current" ? palette.brand : palette.muted;
            const markClass = item.state === "done" ? "zm-tone-success" : item.state === "current" ? "zm-brand" : "zm-muted";
            return (
              <tr key={item.title}>
                <td width={28} valign="top" className={markClass} style={{ width: 28, fontFamily: fontStack, fontSize: 15, lineHeight: "22px", fontWeight: 700, color: markColor }}>
                  {stepMarks[item.state]}
                </td>
                <td style={{ paddingBottom: 14 }}>
                  <Text className={item.state === "todo" ? "zm-muted" : "zm-text"} style={{ ...bodyText, fontSize: 15, lineHeight: "22px", fontWeight: 700, color: item.state === "todo" ? palette.muted : palette.text }}>
                    {item.title}
                  </Text>
                  <Text className="zm-muted" style={{ ...bodyText, fontSize: 14, lineHeight: "21px", color: palette.muted }}>{item.text}</Text>
                </td>
              </tr>
            );
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
          <table key={item.label} role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} style={{ marginBottom: 14 }}>
            <tbody>
              <tr>
                <td className="zm-text" style={{ fontFamily: fontStack, fontSize: 14, fontWeight: 600, color: palette.text, paddingBottom: 6 }}>{isMet ? `✓ ${item.label}` : item.label}</td>
                <td align="right" className={isMet ? "zm-tone-success" : "zm-muted"} style={{ fontFamily: fontStack, fontSize: 13, color: isMet ? palette.toneText.success : palette.muted, paddingBottom: 6 }}>
                  {item.display ?? `${item.value.toLocaleString("en")} / ${item.target.toLocaleString("en")}`}
                </td>
              </tr>
              <tr>
                <td colSpan={2}>
                  <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} className="zm-sunken" style={{ backgroundColor: palette.sunken, borderRadius: 4 }}>
                    <tbody>
                      <tr>
                        {percent > 0 ? <td className={isMet ? "zm-solid-success" : "zm-btn"} width={`${percent}%`} style={{ height: 8, lineHeight: "8px", fontSize: 1, borderRadius: 4, backgroundColor: isMet ? palette.toneSolid.success : palette.button }}>&nbsp;</td> : null}
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
    <Section style={{ paddingBottom: 16 }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          {items.map((person) => (
            <tr key={person.handle}>
              <td width={52} valign="middle" style={{ width: 52, paddingBottom: 12 }}>
                <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
                  <tbody>
                    <tr>
                      <td align="center" className="zm-tint-brand zm-brand" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.toneTint.brand, color: palette.brand, fontFamily: fontStack, fontSize: 14, fontWeight: 700 }}>
                        {initialsFor(person.name)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
              <td valign="middle" style={{ paddingBottom: 12 }}>
                <Text className="zm-text" style={{ ...bodyText, fontSize: 15, lineHeight: "20px", fontWeight: 600, color: palette.text }}>
                  {person.name} <span className="zm-muted" style={{ fontWeight: 400, color: palette.muted }}>{`@${person.handle}`}</span>
                </Text>
                {person.note ? <Text className="zm-muted" style={{ ...bodyText, fontSize: 13, lineHeight: "19px", color: palette.muted }}>{person.note}</Text> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {more ? <Text className="zm-muted" style={{ ...bodyText, fontSize: 13, color: palette.muted }}>{more}</Text> : null}
    </Section>
  );
}

export function RatingBlock({ question, options }: { readonly question: string; readonly options: readonly EmailLink[] }) {
  const palette = useEmailPalette();
  return (
    <Section style={{ paddingBottom: 20 }}>
      <Text className="zm-text" style={{ ...bodyText, fontSize: 15, fontWeight: 700, color: palette.text, paddingBottom: 10 }}>{question}</Text>
      <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            {options.map((option) => (
              <td key={option.href} style={{ paddingRight: 8 }}>
                <Link href={option.href} className="zm-line zm-text" style={{ display: "inline-block", border: `1px solid ${palette.line}`, borderRadius: 10, padding: "9px 12px", fontFamily: fontStack, fontSize: 13, fontWeight: 600, color: palette.text, textDecoration: "none" }}>
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
