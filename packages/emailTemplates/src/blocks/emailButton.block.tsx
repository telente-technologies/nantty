import { fontStack } from "../theme/emailPalette";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);

interface BulletproofButtonProps {
  readonly label: string;
  readonly href: string;
  readonly background: string;
  readonly color: string;
  readonly darkClass?: string;
}

export function BulletproofButton({ label, href, background, color, darkClass }: BulletproofButtonProps) {
  const safeLabel = escapeHtml(label);
  const safeHref = escapeHtml(href);
  const width = Math.min(520, Math.max(160, Math.round(label.length * 8.6 + 56)));
  const classAttribute = darkClass ? ` class="${darkClass}"` : "";
  const html =
    `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:48px;v-text-anchor:middle;width:${width}px;" arcsize="25%" stroke="f" fillcolor="${background}"><w:anchorlock/><center style="color:${color};font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${safeLabel}</center></v:roundrect><![endif]-->` +
    `<!--[if !mso]><!-- --><table role="presentation" cellpadding="0" cellspacing="0" border="0" class="zm-full" style="border-collapse:separate"><tr><td align="center" bgcolor="${background}"${classAttribute} style="background-color:${background};border-radius:12px">` +
    `<a href="${safeHref}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${fontStack.replace(/"/g, "'")};font-size:15px;line-height:20px;font-weight:600;letter-spacing:-0.005em;color:${color};text-decoration:none;border-radius:12px;mso-hide:all">${safeLabel}</a>` +
    `</td></tr></table><!--<![endif]-->`;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
