import type { VerificationApplicationDetail, VerificationDocumentKind } from "@/types/verification.type";

interface ArtworkProps {
  readonly kind: VerificationDocumentKind;
  readonly application: VerificationApplicationDetail;
}

function IdentityCardArtwork({ application, title }: { readonly application: VerificationApplicationDetail; readonly title: string }) {
  const [surname = "", ...givenNames] = application.applicant.legalName.split(" ").reverse();
  return (
    <svg viewBox="0 0 640 400" role="img" aria-label={`${title} for ${application.applicant.legalName}`}>
      <rect width="640" height="400" rx="22" fill="#f4f7ef" stroke="#8aa37b" strokeWidth="3" />
      <rect width="640" height="70" rx="22" fill="#1f7a3e" />
      <text x="28" y="44" fontSize="22" fontWeight="700" fill="#fff" fontFamily="sans-serif">{title.toUpperCase()}</text>
      <rect x="32" y="100" width="150" height="190" rx="10" fill="#cfd8c6" />
      <circle cx="107" cy="170" r="42" fill="#9fb191" />
      <rect x="62" y="220" width="90" height="60" rx="30" fill="#9fb191" />
      {[["SURNAME", surname], ["GIVEN NAMES", givenNames.reverse().join(" ")], ["NATIONALITY", application.applicant.country], ["DOCUMENT NO.", `A${application.id.replace(/\D/g, "").padStart(8, "0")}`]].map(([label, value], index) => (
        <g key={label} transform={`translate(210 ${110 + index * 58})`}>
          <text fontSize="12" fill="#5b6b52" fontFamily="sans-serif">{label}</text>
          <text y="24" fontSize="20" fontWeight="600" fill="#1b2616" fontFamily="monospace">{value}</text>
        </g>
      ))}
      <rect x="32" y="320" width="576" height="46" rx="6" fill="#e3eadc" />
      <text x="44" y="350" fontSize="14" fill="#5b6b52" fontFamily="monospace">{"<<<"}{application.applicant.legalName.toUpperCase().replace(/\s+/g, "<")}{"<<<<<<<<<<"}</text>
    </svg>
  );
}

function CertificateArtwork({ application, title, issuer }: { readonly application: VerificationApplicationDetail; readonly title: string; readonly issuer: string }) {
  const subject = application.applicant.businessName ?? application.applicant.agencyName ?? application.applicant.legalName;
  return (
    <svg viewBox="0 0 600 780" role="img" aria-label={`${title} for ${subject}`}>
      <rect width="600" height="780" fill="#fffdf6" stroke="#b89b5e" strokeWidth="10" />
      <rect x="24" y="24" width="552" height="732" fill="none" stroke="#d8c38f" strokeWidth="2" />
      <circle cx="300" cy="120" r="46" fill="none" stroke="#1f7a3e" strokeWidth="4" />
      <text x="300" y="128" textAnchor="middle" fontSize="18" fontWeight="700" fill="#1f7a3e" fontFamily="serif">SEAL</text>
      <text x="300" y="215" textAnchor="middle" fontSize="16" fill="#4a4a4a" fontFamily="serif">{issuer.toUpperCase()}</text>
      <text x="300" y="262" textAnchor="middle" fontSize="28" fontWeight="700" fill="#222" fontFamily="serif">{title}</text>
      <text x="300" y="330" textAnchor="middle" fontSize="15" fill="#555" fontFamily="serif">This is to certify that</text>
      <text x="300" y="380" textAnchor="middle" fontSize="26" fontWeight="700" fill="#111" fontFamily="serif">{subject}</text>
      <text x="300" y="430" textAnchor="middle" fontSize="15" fill="#555" fontFamily="serif">is registered under number</text>
      <text x="300" y="470" textAnchor="middle" fontSize="22" fill="#111" fontFamily="monospace">{application.applicant.registrationNumber ?? "OFFICIAL"}</text>
      <text x="300" y="540" textAnchor="middle" fontSize="14" fill="#555" fontFamily="serif">Principal: {application.applicant.legalName}</text>
      <line x1="120" y1="660" x2="260" y2="660" stroke="#333" />
      <line x1="340" y1="660" x2="480" y2="660" stroke="#333" />
      <text x="190" y="684" textAnchor="middle" fontSize="12" fill="#555" fontFamily="serif">Registrar</text>
      <text x="410" y="684" textAnchor="middle" fontSize="12" fill="#555" fontFamily="serif">Date</text>
    </svg>
  );
}

function SelfieArtwork({ application }: { readonly application: VerificationApplicationDetail }) {
  return (
    <svg viewBox="0 0 480 600" role="img" aria-label={`Liveness selfie for ${application.applicant.legalName}`}>
      <rect width="480" height="600" fill="#20263f" />
      <ellipse cx="240" cy="250" rx="130" ry="170" fill="none" stroke="#f5e320" strokeWidth="4" strokeDasharray="12 10" />
      <circle cx="240" cy="230" r="80" fill="#8b6a55" />
      <rect x="130" y="330" width="220" height="200" rx="100" fill="#8b6a55" />
      <text x="240" y="570" textAnchor="middle" fontSize="16" fill="#c3c9ee" fontFamily="sans-serif">Liveness passed · face match 0.97</text>
    </svg>
  );
}

export function VerificationDocumentArtwork({ kind, application }: ArtworkProps) {
  if (kind === "SELFIE") return <SelfieArtwork application={application} />;
  if (kind === "CAC_CERTIFICATE") return <CertificateArtwork application={application} title="Certificate of Registration" issuer="Corporate Affairs Commission" />;
  if (kind === "GOVERNMENT_LETTER") return <CertificateArtwork application={application} title="Letter of Authorisation" issuer={application.applicant.agencyName ?? "Government agency"} />;
  if (kind === "UTILITY_BILL") return <CertificateArtwork application={application} title="Electricity Bill" issuer="Ikeja Electric" />;
  const titles: Record<string, string> = { NATIONAL_ID: "National Identity Card", PASSPORT: "Passport", DRIVERS_LICENCE: "Driver's Licence" };
  return <IdentityCardArtwork application={application} title={titles[kind] ?? "Identity document"} />;
}
