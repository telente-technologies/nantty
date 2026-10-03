import { Column, Img, Link, Row, Section, Text } from "react-email";

import type { DetailRow, Money, ProductCard, SellerItemGroup } from "../emailTypes";
import { addMoney, multiplyMoney } from "../format/emailFormat";
import { fontStack, monoStack } from "../theme/emailPalette";
import { bodyText } from "./emailBasics.block";
import { useEmailEnvironment, useEmailPalette } from "./emailRenderContext";

export function DetailsBlock({ title, rows }: { readonly title?: string; readonly rows: readonly DetailRow[] }) {
  const palette = useEmailPalette();
  return (
    <Section style={{ paddingBottom: 20 }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} className="zm-line" style={{ border: `1px solid ${palette.line}`, borderRadius: 12, borderCollapse: "separate" }}>
        <tbody>
          {title ? (
            <tr>
              <td colSpan={2} className="zm-sunken zm-muted" style={{ backgroundColor: palette.sunken, padding: "10px 16px", borderRadius: "12px 12px 0 0", fontFamily: fontStack, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: palette.muted }}>
                {title}
              </td>
            </tr>
          ) : null}
          {rows.map((row, index) => {
            const borderTop = index === 0 && !title ? "none" : `1px solid ${palette.line}`;
            return (
              <tr key={row.label}>
                <td className="zm-muted zm-line" style={{ padding: "11px 16px", borderTop, fontFamily: fontStack, fontSize: 14, lineHeight: "20px", color: palette.muted, verticalAlign: "top" }}>
                  {row.label}
                </td>
                <td align="right" className="zm-text zm-line" style={{ padding: "11px 16px", borderTop, fontFamily: row.mono ? monoStack : fontStack, fontSize: row.mono ? 13 : 14, lineHeight: "20px", fontWeight: row.strong ? 700 : 500, color: palette.text, textAlign: "right" }}>
                  {row.value}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

function groupSubtotal(group: SellerItemGroup): Money {
  return addMoney(...group.items.map((item) => multiplyMoney(item.unitPrice, item.quantity)));
}

function SellerGroupCard({ group }: { readonly group: SellerItemGroup }) {
  const { palette, context } = useEmailEnvironment();
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} className="zm-line" style={{ border: `1px solid ${palette.line}`, borderRadius: 12, borderCollapse: "separate", marginBottom: 14 }}>
      <tbody>
        <tr>
          <td className="zm-sunken" style={{ backgroundColor: palette.sunken, padding: "11px 16px", borderRadius: "12px 12px 0 0" }}>
            <span className="zm-muted" style={{ fontFamily: fontStack, fontSize: 12, color: palette.muted }}>Sold by </span>
            <span className="zm-text" style={{ fontFamily: fontStack, fontSize: 13, fontWeight: 700, color: palette.text }}>{group.sellerName}</span>
            {group.sellerVerified ? <span className="zm-brand" style={{ fontFamily: fontStack, fontSize: 12, fontWeight: 700, color: palette.brand }}>{"  ✓ Verified"}</span> : null}
            {group.status ? <span className="zm-muted" style={{ fontFamily: fontStack, fontSize: 12, color: palette.muted, float: "right" }}>{group.status}</span> : null}
          </td>
        </tr>
        {group.items.map((item) => (
          <tr key={`${item.name}-${item.variant ?? ""}`}>
            <td className="zm-line" style={{ padding: "14px 16px 0" }}>
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
                <tbody>
                  <tr>
                    <td width={64} valign="top" style={{ width: 64 }}>
                      <Img src={item.imageUrl} alt={item.name} width={64} height={64} style={{ display: "block", width: 64, height: 64, borderRadius: 8, objectFit: "cover", border: 0 }} />
                    </td>
                    <td valign="top" style={{ paddingLeft: 14 }}>
                      <Text className="zm-text" style={{ ...bodyText, fontSize: 15, lineHeight: "21px", fontWeight: 600, color: palette.text }}>{item.name}</Text>
                      <Text className="zm-muted" style={{ ...bodyText, fontSize: 13, lineHeight: "19px", color: palette.muted, paddingTop: 2 }}>
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
          <td style={{ padding: "14px 16px" }}>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} className="zm-line" style={{ borderTop: `1px dashed ${palette.line}` }}>
              <tbody>
                <tr>
                  <td className="zm-muted" style={{ paddingTop: 10, fontFamily: fontStack, fontSize: 13, color: palette.muted }}>{`Shipping${group.shippingMethod ? ` · ${group.shippingMethod}` : ""}`}</td>
                  <td align="right" className="zm-text" style={{ paddingTop: 10, fontFamily: fontStack, fontSize: 13, color: palette.text }}>{group.shipping.amountMinor === 0 ? "Free" : context.money(group.shipping)}</td>
                </tr>
                <tr>
                  <td className="zm-text" style={{ paddingTop: 4, fontFamily: fontStack, fontSize: 13, fontWeight: 700, color: palette.text }}>From this seller</td>
                  <td align="right" className="zm-text" style={{ paddingTop: 4, fontFamily: fontStack, fontSize: 13, fontWeight: 700, color: palette.text }}>{context.money(addMoney(groupSubtotal(group), group.shipping))}</td>
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
  return (
    <Section style={{ paddingBottom: 20 }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="zm-muted" style={{ padding: "4px 0", fontFamily: fontStack, fontSize: 14, color: palette.muted }}>{row.label}</td>
              <td align="right" className={row.credit ? "zm-tone-success" : "zm-text"} style={{ padding: "4px 0", fontFamily: fontStack, fontSize: 14, color: row.credit ? palette.toneText.success : palette.text }}>
                {row.credit ? `−${context.money(row.amount)}` : context.money(row.amount)}
              </td>
            </tr>
          ))}
          <tr>
            <td className="zm-text zm-line" style={{ paddingTop: 12, borderTop: `2px solid ${palette.text}`, fontFamily: fontStack, fontSize: 16, fontWeight: 700, color: palette.text }}>{total.label}</td>
            <td align="right" className="zm-text zm-line" style={{ paddingTop: 12, borderTop: `2px solid ${palette.text}`, fontFamily: fontStack, fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", color: palette.text }}>
              {context.money(total.amount)}
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
      <Img src={item.imageUrl} alt={item.name} width={256} style={{ display: "block", width: "100%", maxWidth: 256, height: "auto", borderRadius: 12, border: 0 }} />
      {item.badge ? (
        <Text className="zm-tone-success" style={{ ...bodyText, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: palette.toneText.success, paddingTop: 10 }}>
          {item.badge}
        </Text>
      ) : null}
      <Text className="zm-text" style={{ ...bodyText, fontSize: 15, lineHeight: "21px", fontWeight: 600, color: palette.text, paddingTop: item.badge ? 2 : 10 }}>{item.name}</Text>
      <Text className="zm-muted" style={{ ...bodyText, fontSize: 13, lineHeight: "19px", color: palette.muted }}>{`${item.sellerName}  ✓`}</Text>
      <Text className="zm-text" style={{ ...bodyText, fontSize: 15, lineHeight: "22px", fontWeight: 700, color: palette.text, paddingTop: 4 }}>
        {context.money(item.price)}
        {item.compareAtPrice ? (
          <span className="zm-muted" style={{ fontWeight: 400, fontSize: 13, color: palette.muted, textDecoration: "line-through", paddingLeft: 8 }}>
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
    <Section style={{ paddingBottom: 12 }}>
      {title ? <Text className="zm-text" style={{ ...bodyText, fontSize: 17, fontWeight: 700, color: palette.text, paddingBottom: 12 }}>{title}</Text> : null}
      {rows.map((row, rowIndex) => (
        <Row key={rowIndex} style={{ paddingBottom: 20 }}>
          {row.map((item, columnIndex) => (
            <Column key={item.href} className="zm-stack" valign="top" style={{ width: "50%", verticalAlign: "top", paddingRight: columnIndex === 0 ? 10 : 0, paddingLeft: columnIndex === 1 ? 10 : 0 }}>
              <ProductTile item={item} />
            </Column>
          ))}
          {row.length === 1 ? <Column className="zm-stack" style={{ width: "50%" }} /> : null}
        </Row>
      ))}
    </Section>
  );
}
