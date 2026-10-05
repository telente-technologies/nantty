import type { BrandDocumentKind, OfficialStoreRequest } from "@/types/brands.type";

function TrademarkCertificateArtwork({ request }: { readonly request: OfficialStoreRequest }) {
  return (
    <svg viewBox="0 0 600 420" role="img" aria-label="Trademark registration certificate">
      <rect x="0" y="0" width="600" height="420" fill="#fbf8ef" stroke="#8a6d1d" strokeWidth="6" />
      <rect x="18" y="18" width="564" height="384" fill="none" stroke="#c9a94a" strokeWidth="2" />
      <text x="300" y="66" textAnchor="middle" fontSize="15" fontFamily="serif" fill="#4a3b10">{request.trademark.jurisdiction.toUpperCase()}</text>
      <text x="300" y="104" textAnchor="middle" fontSize="26" fontFamily="serif" fontWeight="700" fill="#2b2206">Certificate of Registration of Trade Mark</text>
      <text x="60" y="160" fontSize="15" fontFamily="serif" fill="#2b2206">Registration No.: {request.trademark.registrationNumber}</text>
      <text x="60" y="192" fontSize="15" fontFamily="serif" fill="#2b2206">Registered owner: {request.trademark.registeredOwner}</text>
      <text x="60" y="224" fontSize="15" fontFamily="serif" fill="#2b2206">Class: {request.trademark.niceClass} (Nice Classification)</text>
      <text x="60" y="256" fontSize="15" fontFamily="serif" fill="#2b2206">Registered on: {request.trademark.registeredOn}</text>
      <text x="60" y="288" fontSize="15" fontFamily="serif" fill="#2b2206">Renewal due: {request.trademark.expiresOn}</text>
      <circle cx="480" cy="330" r="48" fill="none" stroke="#8a6d1d" strokeWidth="3" />
      <text x="480" y="336" textAnchor="middle" fontSize="12" fontFamily="serif" fill="#8a6d1d">REGISTRAR</text>
      <line x1="60" y1="360" x2="260" y2="360" stroke="#2b2206" />
      <text x="60" y="380" fontSize="12" fontFamily="serif" fill="#4a3b10">Registrar of Trade Marks</text>
    </svg>
  );
}

function CacCertificateArtwork({ request }: { readonly request: OfficialStoreRequest }) {
  return (
    <svg viewBox="0 0 600 420" role="img" aria-label="Certificate of incorporation">
      <rect x="0" y="0" width="600" height="420" fill="#f3f8f3" stroke="#1f6b3a" strokeWidth="6" />
      <text x="300" y="64" textAnchor="middle" fontSize="15" fontFamily="serif" fill="#1f6b3a">CORPORATE AFFAIRS COMMISSION</text>
      <text x="300" y="104" textAnchor="middle" fontSize="26" fontFamily="serif" fontWeight="700" fill="#0f3a1f">Certificate of Incorporation</text>
      <text x="300" y="170" textAnchor="middle" fontSize="16" fontFamily="serif" fill="#0f3a1f">I hereby certify that</text>
      <text x="300" y="210" textAnchor="middle" fontSize="22" fontFamily="serif" fontWeight="700" fill="#0f3a1f">{request.cacCompanyName.toUpperCase()}</text>
      <text x="300" y="250" textAnchor="middle" fontSize="15" fontFamily="serif" fill="#0f3a1f">is this day incorporated under the Companies and Allied Matters Act</text>
      <text x="300" y="300" textAnchor="middle" fontSize="18" fontFamily="monospace" fill="#0f3a1f">{request.cacRegistrationNumber}</text>
      <line x1="200" y1="360" x2="400" y2="360" stroke="#0f3a1f" />
      <text x="300" y="382" textAnchor="middle" fontSize="12" fontFamily="serif" fill="#1f6b3a">Registrar-General</text>
    </svg>
  );
}

function AuthorizationLetterArtwork({ request }: { readonly request: OfficialStoreRequest }) {
  const signatory = request.submittedBy?.displayName ?? "Brand owner";
  return (
    <svg viewBox="0 0 600 420" role="img" aria-label="Authorization letter">
      <rect x="0" y="0" width="600" height="420" fill="#ffffff" stroke="#c9ccd6" strokeWidth="2" />
      <text x="50" y="60" fontSize="18" fontFamily="sans-serif" fontWeight="700" fill="#201884">{request.cacCompanyName}</text>
      <text x="50" y="82" fontSize="12" fontFamily="sans-serif" fill="#5b5b5b">{request.contactEmail}</text>
      <text x="50" y="130" fontSize="14" fontFamily="sans-serif" fill="#000">To: Zudomart Brand Protection</text>
      <text x="50" y="160" fontSize="14" fontFamily="sans-serif" fontWeight="700" fill="#000">Re: Authorisation to operate our Official Store</text>
      <text x="50" y="196" fontSize="13" fontFamily="sans-serif" fill="#000">We confirm that {signatory} is authorised to manage our brand</text>
      <text x="50" y="216" fontSize="13" fontFamily="sans-serif" fill="#000">and sell genuine products under trade mark {request.trademark.registrationNumber}</text>
      <text x="50" y="236" fontSize="13" fontFamily="sans-serif" fill="#000">on Zudomart.</text>
      <path d="M60 320 C 90 290, 120 340, 150 305 S 210 330, 230 300" fill="none" stroke="#201884" strokeWidth="2" />
      <text x="50" y="350" fontSize="12" fontFamily="sans-serif" fill="#5b5b5b">Director, for and on behalf of {request.cacCompanyName}</text>
    </svg>
  );
}

export function BrandDocumentArtwork({ kind, request }: { readonly kind: BrandDocumentKind; readonly request: OfficialStoreRequest }) {
  if (kind === "TRADEMARK_CERTIFICATE") return <TrademarkCertificateArtwork request={request} />;
  if (kind === "CAC_CERTIFICATE") return <CacCertificateArtwork request={request} />;
  return <AuthorizationLetterArtwork request={request} />;
}
