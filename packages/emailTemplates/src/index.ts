export { renderEmail, createEmailContext, type RenderEmailOptions, type RenderedEmail } from "./render/renderEmail";
export { emailTemplates, emailTemplateKeys, readEmailTemplate, type EmailTemplateKey, type EmailTemplateProps } from "./templates/templateRegistry";
export { listEmailTemplateCatalogue, renderEmailSample, isEmailTemplateKey, type EmailTemplateCatalogueEntry } from "./catalogue";
export { defaultEmailBrand, readEmailBrandFromEnvironment, isBrandConfigComplete, companyAddressPlaceholder, companyLegalNamePlaceholder } from "./config/emailBrand.config";
export { formatMoney } from "./format/emailFormat";
export type { EmailTemplateDefinition } from "./templates/defineTemplate";
export type * from "./emailTypes";
