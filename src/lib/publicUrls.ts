// Centralized base URL for public-facing links (proposals, contracts, etc.)
// Always uses the production custom domain so links sent to clients
// are stable and never expose preview/lovable URLs.
export const PUBLIC_BASE_URL = "https://evoluacrm.com.br";

export function proposalPublicUrl(shareToken: string, recipientId?: string): string {
  const base = `${PUBLIC_BASE_URL}/p/${shareToken}`;
  return recipientId ? `${base}?r=${recipientId}` : base;
}
