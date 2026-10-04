const mailboxDomain = process.env.NEXT_PUBLIC_MAIL_DOMAIN?.trim() || "zudomart.com";

export const adminSupportContactEmails = [process.env.NEXT_PUBLIC_ADMIN_ACCESS_EMAIL?.trim() || `security@${mailboxDomain}`] as const;
