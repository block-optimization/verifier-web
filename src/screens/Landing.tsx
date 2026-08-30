import { useState, type FormEvent } from 'react';
import { DemoBanner } from '../components/DemoBanner';
import { Call119Button } from '../components/Call119Button';
import type { AccessRequest } from '../api/emergencyAccess';

// V1 · 카메라 없이 진입 (수동코드 대체 경로).
// 정상 흐름은 QR → OS 카메라 → https://demo.medivc.kr/e#t=<token>
// 로 진입해 App.tsx가 자동 검증을 트리거한다.
export function Landing({
  onSubmit,
  onOpenGuide,
}: {
  onSubmit: (req: AccessRequest) => void;
  onOpenGuide: () => void;
}) {
  const [code, setCode] = useState('');
  const trimmed = code.trim().toUpperCase();
  const normalized = trimmed.includes('-')
    ? trimmed
    : trimmed.length === 8
    ? `${trimmed.slice(0, 4)}-${trimmed.slice(4)}`
    : trimmed;
  const canSubmit = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ manualCode: normalized });
  }

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">MediVC 응급정보</div>
      </header>
      <DemoBanner />
      <section className="card">
        <h1 className="title">응급 카드를 <em>확인합니다</em></h1>
        <p className="lede">
          QR을 스캔하면 자동으로 검증이 시작됩니다. 카메라를 쓸 수 없다면 카드의 수동코드를 입력하세요.
        </p>
        <form className="manual-form" onSubmit={submit}>
          <label htmlFor="code" className="label">
            수동코드
          </label>
          <input
            id="code"
            className="input"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="M3D1-____"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={9}
            aria-describedby="code-help"
          />
          <p id="code-help" className="hint">
            앞 4자리 · 뒤 4자리 (예: M3D1-7K9Q)
          </p>
          <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
            코드로 열기
          </button>
        </form>
      </section>
      <details className="demo-hints">
        <summary>데모 코드 안내</summary>
        <ul>
          <li>
            <code>M3D1-7K9Q</code> — 정상 카드 (V3 최소정보)
          </li>
          <li>
            <code>M3D1-EXPR</code> — 만료
          </li>
          <li>
            <code>M3D1-REVK</code> — 철회
          </li>
          <li>
            <code>M3D1-TAMP</code> — 변조 감지
          </li>
          <li>
            <code>M3D1-RATE</code> — 요청 과다 (Rate Limit)
          </li>
        </ul>
        <p>정상 코드는 1회만 사용됩니다. 두 번째 조회는 실패로 처리됩니다.</p>
      </details>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={onOpenGuide}
      >
        응급처치 일반 가이드
      </button>
      <div className="sticky-actions" role="region" aria-label="상시 응급 도움">
        <div className="sticky-actions__inner">
          <Call119Button />
        </div>
      </div>
    </main>
  );
}
