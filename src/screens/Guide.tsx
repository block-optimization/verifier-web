import { useEffect, useState } from 'react';
import { DemoBanner } from '../components/DemoBanner';
import { Call119Button } from '../components/Call119Button';
import { fetchGuides, type GuideItem } from '../api/guides';

/*
 * 응급처치 원문 가이드.
 *
 * 목록 뷰 → 카드 탭 → 상세 뷰 (원본 URL 을 iframe 으로 임베드).
 *
 * KDCA · safekorea 자료는 각각 공공누리 4유형 (변경금지) / 저작권 유보 상태라
 * 앱 UI 로 재조립하지 않고 원본 페이지 그대로 표시한다.
 * §10 "생성형 AI가 응급처치 내용을 만들지 않는다" 원칙 준수.
 *
 * 리스트에는 순번 · 아이콘 · 소스 · 라이선스 뱃지를 유리 카드로 표현한다.
 */

interface GuideVisual {
  icon: string;
  accent: string;
}

const GUIDE_VISUALS: Record<string, GuideVisual> = {
  'cpr-adult': { icon: '♡', accent: 'coral' },
  'airway-obstruction': { icon: '◈', accent: 'amber' },
  'bleeding': { icon: '✚', accent: 'mint' },
};

export function Guide({ onBack }: { onBack: () => void }) {
  const [guides, setGuides] = useState<GuideItem[] | null>(null);
  const [selected, setSelected] = useState<GuideItem | null>(null);

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

  if (selected) {
    return (
      <GuideDetail
        guide={selected}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <GuideList
      guides={guides}
      onBack={onBack}
      onSelect={setSelected}
    />
  );
}

function GuideList({
  guides,
  onBack,
  onSelect,
}: {
  guides: GuideItem[] | null;
  onBack: () => void;
  onSelect: (g: GuideItem) => void;
}) {
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

      <section className="guide-hero">
        <span className="guide-hero__eyebrow">Emergency First Aid</span>
        <h1 className="guide-hero__title">
          공식 원문 <em>그대로</em>
        </h1>
        <p className="guide-hero__lede">
          소방청 119 생활응급처치 매뉴얼의 절차를 요약해 정리했습니다.
          원문 PDF 는 각 항목 하단 <strong>출처 · 라이선스</strong> 토글에서 그대로 확인할 수 있습니다.
        </p>
      </section>

      <div className="triage" role="alert">
        먼저 의식 · 호흡을 확인하고 즉시 119에 신고하세요.
      </div>

      <section className="guide-cards" aria-label="공식 원문 가이드 목록">
        {guides === null && <p className="hint">불러오는 중…</p>}
        {guides && guides.length === 0 && (
          <p className="hint">목록을 가져오지 못했습니다.</p>
        )}
        {guides?.map((g, i) => {
          const visual = GUIDE_VISUALS[g.slug] ?? { icon: '·', accent: 'neutral' };
          return (
            <button
              key={g.slug}
              type="button"
              className={`guide-card guide-card--${visual.accent}`}
              onClick={() => onSelect(g)}
            >
              <span className="guide-card__index" aria-hidden>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="guide-card__icon" aria-hidden>
                {visual.icon}
              </span>
              <div className="guide-card__body">
                <div className="guide-card__title">{g.title}</div>
                <div className="guide-card__source">
                  {g.source}
                </div>
                <div className="guide-card__meta">
                  <span className="chip chip--license">{g.license}</span>
                </div>
              </div>
              <span className="guide-card__chevron" aria-hidden>
                ›
              </span>
            </button>
          );
        })}
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

function GuideDetail({
  guide,
  onBack,
}: {
  guide: GuideItem;
  onBack: () => void;
}) {
  const visual = GUIDE_VISUALS[guide.slug] ?? { icon: '·', accent: 'neutral' };
  const { content } = guide;

  return (
    <main className={`page page--content page--detail-${visual.accent}`}>
      <header className="topbar">
        <button
          type="button"
          className="link-btn back-btn"
          onClick={onBack}
          aria-label="가이드 목록으로"
        >
          ← 목록
        </button>
        <div className="brand brand--truncate" title={guide.title}>
          <span className="brand__icon" aria-hidden>{visual.icon}</span>
          {guide.title}
        </div>
        <span aria-hidden />
      </header>

      <DemoBanner />

      <div className="triage" role="alert">
        먼저 의식 · 호흡을 확인하고 즉시 119에 신고하세요.
      </div>

      <p className="guide-detail__lede">{content.lede}</p>

      {content.quickChecks && (
        <section className="quick-checks" aria-label="상황 판단">
          <div className="quick-checks__heading">상황 판단</div>
          <dl className="quick-checks__list">
            {content.quickChecks.map((qc) => (
              <div className="quick-checks__row" key={qc.when}>
                <dt>{qc.when}</dt>
                <dd>{qc.then}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="guide-sections" aria-label="처치 절차">
        {content.sections.map((section, i) => (
          <article className="guide-section" key={section.heading}>
            <header className="guide-section__head">
              <span className="guide-section__index" aria-hidden>
                {String(i + 1).padStart(2, '0')}
              </span>
              <h2 className="guide-section__heading">{section.heading}</h2>
            </header>
            {section.intro && (
              <p className="guide-section__intro">{section.intro}</p>
            )}
            {section.steps && (
              <ol className="step-list">
                {section.steps.map((step) => (
                  <li className="step-list__item" key={step.title}>
                    <div className="step-list__title">{step.title}</div>
                    {step.detail && (
                      <div className="step-list__detail">{step.detail}</div>
                    )}
                    {step.caution && (
                      <div className="step-list__caution">
                        <span aria-hidden>⚠</span> {step.caution}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {section.bullets && (
              <ul className="bullet-list">
                {section.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </section>

      {content.criticalWarnings && content.criticalWarnings.length > 0 && (
        <section className="critical-warnings" role="note" aria-label="반드시 지킬 것">
          <div className="critical-warnings__heading">
            <span aria-hidden>⚠</span> 반드시 지킬 것
          </div>
          <ul>
            {content.criticalWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="footnote">
        본 내용은 소방청 자료를 참고해 요약한 일반 안내이며 개인별 의료 판단이 아닙니다.
        응급 상황에서는 119 지시를 우선하세요.
      </p>

      <details className="citation-toggle">
        <summary>
          <span className="citation-toggle__label">출처 · 라이선스</span>
          <span className="citation-toggle__chevron" aria-hidden>›</span>
        </summary>
        <div className="citation-toggle__body">
          <dl className="citation-toggle__meta">
            <dt>출처</dt>
            <dd>{guide.source}</dd>
            <dt>라이선스</dt>
            <dd>{guide.license}</dd>
          </dl>
          <a
            className="btn btn--secondary"
            href={guide.pdfPath}
            target="_blank"
            rel="noopener noreferrer"
          >
            원문 PDF 보기 ↗
          </a>
        </div>
      </details>

      <div className="sticky-actions" role="region" aria-label="상시 응급 도움">
        <div className="sticky-actions__inner">
          <Call119Button />
        </div>
      </div>
    </main>
  );
}
