import { useEffect, useState } from 'react';
import { DemoBanner } from '../components/DemoBanner';
import { Call119Button } from '../components/Call119Button';
import { fetchGuides, type GuideItem } from '../api/guides';

// 응급처치 일반 가이드 화면.
// MASTER_PLAN §6 IA: "가이드 목록 (공개, 버전·출처 포함)"
// MASTER_PLAN §10: 공식 자료 · 출처 · 개정일 · 이용조건 · AI 미생성 원칙
export function Guide({ onBack }: { onBack: () => void }) {
  const [guides, setGuides] = useState<GuideItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchGuides()
      .then((g) => {
        if (!cancelled) setGuides(g);
      })
      .catch(() => {
        if (!cancelled) setGuides([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="page">
      <header className="topbar">
        <button
          type="button"
          className="link-btn back-btn"
          onClick={onBack}
          aria-label="이전 화면으로"
        >
          ← 뒤로
        </button>
        <div className="brand">응급처치 가이드</div>
        <span aria-hidden />
      </header>
      <DemoBanner />

      <div className="triage" role="alert">
        먼저 의식 · 호흡을 확인하고 즉시 119에 신고하세요.
      </div>

      <p className="lede guide-lede">
        질병관리청 · 행정안전부의 <strong>공식 원문 페이지</strong>로 이동합니다.
        앱은 응급처치 지시를 임의로 생성하지 않습니다.
      </p>

      <section className="items" aria-label="공식 원문 페이지 목록">
        {guides === null && <p className="hint">불러오는 중…</p>}
        {guides && guides.length === 0 && (
          <p className="hint">목록을 가져오지 못했습니다.</p>
        )}
        {guides?.map((g) => (
          <a
            key={g.slug}
            className="item guide-item"
            href={g.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="item__value">{g.title}</div>
            <div className="item__label">
              {g.source} · {g.revisionYear} 기준
            </div>
            <div className="item__meta">
              <span className="badge badge--verified">공식 원문</span>
              <span className="license">{g.license}</span>
              <span className="external-hint">원문 열기 ↗</span>
            </div>
          </a>
        ))}
      </section>

      <p className="footnote">
        일반 안내이며 개인별 의료 판단이 아닙니다. 응급 상황에서는 119 지시를 우선하세요.
      </p>

      <div className="sticky-actions" role="region" aria-label="상시 응급 도움">
        <div className="sticky-actions__inner">
          <Call119Button />
        </div>
      </div>
    </main>
  );
}
