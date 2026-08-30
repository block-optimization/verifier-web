import { DemoBanner } from '../components/DemoBanner';
import { Call119Button } from '../components/Call119Button';

// V2 · 검증 중 (5초 목표). 어떤 실패가 나도 119 버튼은 유지된다.
export function Verifying() {
  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">MediVC 응급정보</div>
      </header>
      <DemoBanner />
      <section className="card verifying">
        <div className="spinner" aria-hidden />
        <h1 className="title"><em>서명</em>을 확인하고 있어요</h1>
        <ul className="check-list" aria-label="검증 항목">
          <li>· 카드 활성 · 만료</li>
          <li>· VC 테스트 서명</li>
          <li>· 데이터 출처</li>
        </ul>
        <p className="hint">최대 5초</p>
      </section>
      <div className="sticky-actions" role="region" aria-label="상시 응급 도움">
        <div className="sticky-actions__inner">
          <Call119Button />
        </div>
      </div>
    </main>
  );
}
