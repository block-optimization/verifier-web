import type { ItemSource, VerificationStatus } from '../types';

export function VerificationBadge({
  status,
  source,
}: {
  status: VerificationStatus;
  source: ItemSource;
}) {
  if (status === 'TEST_VERIFIED') {
    const label = source.displayName ?? 'Demo 발급기';
    return <span className="badge badge--verified">✓ {label} 인증</span>;
  }
  return <span className="badge badge--unverified">✎ 본인 입력 · 미인증</span>;
}
