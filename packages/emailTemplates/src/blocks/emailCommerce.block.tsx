import { Column, Img, Link, Row, Section, Text } from "react-email";

import type { DetailRow, Money, ProductCard, SellerItemGroup } from "../emailTypes";
import { addMoney, multiplyMoney } from "../format/emailFormat";
import { fontStack, monoStack } from "../theme/emailPalette";
import { bodyText, SectionLabel } from "./emailBasics.block";
import { useEmailEnvironment, useEmailPalette } from "./emailRenderContext";

export function DetailsBlock({ title, rows }: { readonly title?: string; readonly rows: readonly DetailRow[] }) {
  const palette = useEmailPalette();
  return (
    <Section style={{ paddingBottom: 22 }}>
      {title ? <SectionLabel>{title}</SectionLabel> : null}
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} className="zm-sunken" style={{ backgroundColor: palette.sunken, borderRadius: 14, borderCollapse: "separate" }}>
        <tbody>
          <tr>
            <td className="zm-tight" style={{ padding: "6px 18px" }}>
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
                <tbody>
                  {rows.map((row, index) => {
                    const borderTop = index === 0 ? "none" : `1px solid ${palette.line}`;
                    return (
                      <tr key={row.label}>
                        <td className="zm-muted zm-line" valign="top" style={{ padding: "11px 12px 11px 0", borderTop, fontFamily: fontStack, fontSize: 14, lineHeight: "20px", color: palette.muted }}>
                          {row.label}
                        </td>
                        <td align="right" valign="top" className="zm-text zm-line" style={{ padding: "11px 0", borderTop, fontFamily: row.mono ? monoStack : fontStack, fontSize: row.mono ? 13 : 14, lineHeight: "20px", fontWeight: row.strong ? 700 : 500, color: palette.text, textAlign: "right" }}>
                          {row.value}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

function groupSubtotal(group: SellerItemGroup): Money {
  return addMoney(...group.items.map((item) => multiplyMoney(item.unitPrice, item.quantity)));
}

function VerifiedMark() {
  const palette = useEmailPalette();
  return (
    <span className="zm-tint-brand zm-tone-brand" style={{ display: "inline-block", marginLeft: 6, padding: "1px 7px", borderRadius: 999, backgroundColor: palette.toneTint.brand, color: palette.toneText.brand, fontFamily: fontStack, fontSize: 10, lineHeight: "16px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", verticalAlign: "1px" }}>
      Verified
    </span>
  );
}

function SellerGroupCard({ group }: { readonly group: SellerItemGroup }) {
  const { palette, context } = useEmailEnvironment();
  const cell = { fontFamily: fontStack, fontSize: 13, lineHeight: "20px" } as const;
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} className="zm-line" style={{ border: `1px solid ${palette.line}`, borderRadius: 14, borderCollapse: "separate", marginBottom: 14 }}>
      <tbody>
        <tr>
          <td className="zm-line zm-tight" style={{ padding: "13px 18px", borderBottom: `1px solid ${palette.line}` }}>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
              <tbody>
                <tr>
                  <td>
                    <span className="zm-subtle" style={{ ...cell, fontSize: 12, color: palette.subtle }}>Sold by </span>
                    <span className="zm-text" style={{ ...cell, fontWeight: 700, color: palette.text }}>{group.sellerName}</span>
                    {group.sellerVerified ? <VerifiedMark /> : null}
                  </td>
                  {group.status ? <td align="right" className="zm-muted" style={{ ...cell, fontSize: 12, color: palette.muted }}>{group.status}</td> : null}
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
        {group.items.map((item, index) => (
          <tr key={`${item.name}-${item.variant ?? ""}`}>
            <td className="zm-tight" style={{ padding: index === 0 ? "16px 18px 0" : "14px 18px 0" }}>
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
                <tbody>
                  <tr>
                    <td width={56} valign="top" style={{ width: 56 }}>
                      <Img src={item.imageUrl} alt={item.name} width={56} height={56} className="zm-sunken" style={{ display: "block", width: 56, height: 56, borderRadius: 10, objectFit: "cover", border: 0, backgroundColor: palette.sunken }} />
                    </td>
                    <td valign="top" className="zm-gap" style={{ paddingLeft: 14 }}>
                      <Text className="zm-text" style={{ ...bodyText, fontSize: 15, lineHeight: "21px", fontWeight: 600, color: palette.text }}>{item.name}</Text>
                      <Text className="zm-muted" style={{ ...bodyText, fontSize: 13, lineHeight: "19px", color: palette.muted, paddingTop: 3 }}>
                        {[item.variant, `Qty ${item.quantity}`, item.quantity > 1 ? `${context.money(item.unitPrice)} each` : undefined].filter(Boolean).join("  ·  ")}
                      </Text>
                    </td>
                    <td valign="top" align="right" className="zm-text" style={{ fontFamily: fontStack, fontSize: 15, lineHeight: "21px", fontWeight: 600, color: palette.text, whiteSpace: "nowrap", paddingLeft: 12 }}>
                      {context.money(multiplyMoney(item.unitPrice, item.quantity))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        ))}
        <tr>
          <td className="zm-tight" style={{ padding: "16px 18px 15px" }}>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} className="zm-line" style={{ borderTop: `1px dashed ${palette.lineStrong}` }}>
              <tbody>
                <tr>
                  <td className="zm-muted" style={{ ...cell, paddingTop: 12, color: palette.muted }}>{`Shipping${group.shippingMethod ? ` · ${group.shippingMethod}` : ""}`}</td>
                  <td align="right" className="zm-text" style={{ ...cell, paddingTop: 12, color: palette.text, whiteSpace: "nowrap" }}>{group.shipping.amountMinor === 0 ? "Free" : context.money(group.shipping)}</td>
                </tr>
                <tr>
                  <td className="zm-text" style={{ ...cell, paddingTop: 4, fontWeight: 700, color: palette.text }}>From this seller</td>
                  <td align="right" className="zm-text" style={{ ...cell, paddingTop: 4, fontWeight: 700, color: palette.text, whiteSpace: "nowrap" }}>{context.money(addMoney(groupSubtotal(group), group.shipping))}</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function OrderGroupsBlock({ groups }: { readonly groups: readonly SellerItemGroup[] }) {
  return (
    <Section style={{ paddingBottom: 8 }}>
      {groups.map((group) => (
        <SellerGroupCard key={group.sellerName} group={group} />
      ))}
    </Section>
  );
}

interface TotalsProps {
  readonly rows: readonly { readonly label: string; readonly amount: Money; readonly credit?: boolean }[];
  readonly total: { readonly label: string; readonly amount: Money };
}

export function TotalsBlock({ rows, total }: TotalsProps) {
  const { palette, context } = useEmailEnvironment();
  const cell = { fontFamily: fontStack, fontSize: 14, lineHeight: "20px" } as const;
  return (
    <Section style={{ paddingBottom: 24 }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} className="zm-sunken" style={{ backgroundColor: palette.sunken, borderRadius: 14, borderCollapse: "separate" }}>
        <tbody>
          <tr>
            <td className="zm-tight" style={{ padding: "14px 18px 16px" }}>
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label}>
                      <td className="zm-muted" style={{ ...cell, padding: "4px 12px 4px 0", color: palette.muted }}>{row.label}</td>
                      <td align="right" className={row.credit ? "zm-tone-success" : "zm-text"} style={{ ...cell, padding: "4px 0", whiteSpace: "nowrap", fontWeight: 500, color: row.credit ? palette.toneText.success : palette.text }}>
                        {row.credit ? `−${context.money(row.amount)}` : context.money(row.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} style={{ paddingTop: 10 }}>
                      <div className="zm-line" style={{ borderTop: `1px dashed ${palette.lineStrong}`, height: 1, lineHeight: "1px", fontSize: 1 }}>&nbsp;</div>
                    </td>
                  </tr>
                  <tr>
                    <td className="zm-text" valign="bottom" style={{ ...cell, paddingTop: 8, fontSize: 15, fontWeight: 700, color: palette.text }}>{total.label}</td>
                    <td align="right" valign="bottom" className="zm-text" style={{ paddingTop: 8, fontFamily: fontStack, fontSize: 22, lineHeight: "28px", fontWeight: 700, letterSpacing: "-0.02em", color: palette.text, whiteSpace: "nowrap" }}>
                      {context.money(total.amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

function ProductTile({ item }: { readonly item: ProductCard }) {
  const { palette, context } = useEmailEnvironment();
  return (
    <Link href={item.href} style={{ textDecoration: "none", display: "block" }}>
      <Img src={item.imageUrl} alt={item.name} width={250} className="zm-sunken" style={{ display: "block", width: "100%", maxWidth: 250, height: "auto", borderRadius: 14, border: 0, backgroundColor: palette.sunken }} />
      {item.badge ? (
        <Text className="zm-tone-success" style={{ ...bodyText, fontSize: 11, lineHeight: "16px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: palette.toneText.success, paddingTop: 12 }}>
          {item.badge}
        </Text>
      ) : null}
      <Text className="zm-text" style={{ ...bodyText, fontSize: 15, lineHeight: "21px", fontWeight: 600, color: palette.text, paddingTop: item.badge ? 3 : 12 }}>{item.name}</Text>
      <Text className="zm-muted" style={{ ...bodyText, fontSize: 13, lineHeight: "19px", color: palette.muted, paddingTop: 2 }}>{item.sellerName}</Text>
      <Text className="zm-text" style={{ ...bodyText, fontSize: 15, lineHeight: "22px", fontWeight: 700, color: palette.text, paddingTop: 6 }}>
        {context.money(item.price)}
        {item.compareAtPrice ? (
          <span className="zm-subtle" style={{ fontWeight: 400, fontSize: 13, color: palette.subtle, textDecoration: "line-through", paddingLeft: 8 }}>
            {context.money(item.compareAtPrice)}
          </span>
        ) : null}
      </Text>
    </Link>
  );
}

export function ProductsBlock({ title, items }: { readonly title?: string; readonly items: readonly ProductCard[] }) {
  const palette = useEmailPalette();
  const rows: ProductCard[][] = [];
  items.forEach((item, index) => {
    if (index % 2 === 0) rows.push([item]);
    else rows[rows.length - 1]?.push(item);
  });
  return (
    <Section style={{ paddingBottom: 10 }}>
      {title ? <Text className="zm-text" style={{ ...bodyText, fontSize: 18, lineHeight: "24px", fontWeight: 700, letterSpacing: "-0.015em", color: palette.text, paddingBottom: 14 }}>{title}</Text> : null}
      {rows.map((row, rowIndex) => (
        <Row key={rowIndex} style={{ paddingBottom: 22 }}>
          {row.map((item, columnIndex) => (
            <Column key={item.href} className="zm-stack" valign="top" style={{ width: "50%", verticalAlign: "top", paddingRight: columnIndex === 0 ? 9 : 0, paddingLeft: columnIndex === 1 ? 9 : 0, paddingBottom: 4 }}>
              <ProductTile item={item} />
            </Column>
          ))}
          {row.length === 1 ? <Column className="zm-stack" style={{ width: "50%" }} /> : null}
        </Row>
      ))}
    </Section>
  );
}
