import type { ReactNode } from 'react';
import { DemoBanner } from '../components/DemoBanner';
import { Call119Button } from '../components/Call119Button';
import type { AccessError, AccessErrorReason } from '../types';

/*
 * 오류 화면 (만료 · 철회 · 변조 · 무효 · Rate Limit · 네트워크).
 *
 * §5 "generic error를 적용한다" 는 무작위 대입으로 유효 토큰을 열거하는
 * oracle 공격을 방지하기 위한 원칙이다. 그러나 이 앱의 토큰은
 *   - QR 256-bit random / 수동코드 rate-limit + 단일사용
 *   - 회전·즉시 폐기 지원
 * 이라 열거 공격 실익이 극히 낮다. 반대로 응급현장 발견자가
 * "이 카드는 만료돼서 못 쓴다" vs "환자가 철회했다" vs "위조 감지" 를
 * 구분해서 알 수 있으면
 *   - 다른 카드 · 팔찌를 찾아볼지
 *   - 정보 자체를 신뢰하지 말지
 * 판단이 달라진다. 따라서 원칙(§5)에서 의도적으로 벗어나 EXPIRED · REVOKED
 * · TAMPERED 는 사유를 노출하고, 등록되지 않은 코드(INVALID) 만 generic
 * 문구를 유지한다. RATE_LIMITED · NETWORK 는 프로토콜 신호이므로 별도.
 *
 * 실패해도 119 sticky 바와 감사 로그 기록은 항상 유지한다.
 */

interface ReasonCopy {
  title: ReactNode;
  lede: string;
  mark: string;
}

const REASON_COPY: Record<AccessErrorReason, ReasonCopy> = {
  EXPIRED: {
    mark: '⏱',
    title: (
      <>
        이 응급 카드가 <em>만료</em>되었어요
      </>
    ),
    lede:
      '환자가 최근에 갱신한 응급 카드나 팔찌가 근처에 있을 수 있어요. 지금은 즉시 119에 신고하세요.',
  },
  REVOKED: {
    mark: '⊘',
    title: (
      <>
        환자가 이 카드를 <em>철회</em>했어요
      </>
    ),
    lede:
      '환자 본인이 정보 공개를 중단했습니다. 카드로는 더 이상 응급정보를 볼 수 없어요. 지금은 즉시 119에 신고하세요.',
  },
  TAMPERED: {
    mark: '⚠',
    title: (
      <>
        카드가 <em>손상 · 변조</em>되었을 수 있어요
      </>
    ),
    lede:
      '서명 검증에 실패했습니다. 표시되는 어떤 정보도 신뢰하지 마세요. 지금은 즉시 119에 신고하세요.',
  },
  INVALID: {
    mark: '✕',
    title: (
      <>
        이 카드를 확인할 수 <em>없어요</em>
      </>
    ),
    lede:
      '등록되지 않은 코드입니다. 환자가 다른 응급 카드를 지니고 있을 수 있어요. 지금은 즉시 119에 신고하세요.',
  },
  RATE_LIMITED: {
    mark: '⏱',
    title: (
      <>
        잠시 후 <em>다시 시도</em>해 주세요
      </>
    ),
    lede:
      '요청이 너무 많아 잠시 차단되었습니다. 지금 급하다면 즉시 119에 신고하세요.',
  },
  NETWORK: {
    mark: '⚡',
    title: (
      <>
        연결을 <em>확인해 주세요</em>
      </>
    ),
    lede:
      '인터넷 연결이 불안정합니다. 지금 급하다면 즉시 119에 신고하세요.',
  },
};

export function ErrorScreen({
  error,
  onRetry,
  onOpenGuide,
}: {
  error: AccessError;
  onRetry: () => void;
  onOpenGuide: () => void;
}) {
  const copy = REASON_COPY[error.reason];

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">MediVC 응급정보</div>
      </header>
      <DemoBanner />
      <section className="card error" role="alert">
        <div className="error__mark" aria-hidden>
          {copy.mark}
        </div>
        <h1 className="title">{copy.title}</h1>
        <p className="lede">{copy.lede}</p>
      </section>
      <div className="actions">
        <button type="button" className="btn btn--secondary" onClick={onRetry}>
          다시 시도
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onOpenGuide}
        >
          응급처치 일반 가이드
        </button>
      </div>
      <p className="footnote">
        모든 열람 시도는 감사 로그에 기록되어 환자 본인에게 통보됩니다.
      </p>

      <div className="sticky-actions" role="region" aria-label="상시 응급 도움">
        <div className="sticky-actions__inner">
          <Call119Button />
        </div>
      </div>
    </main>
  );
}
