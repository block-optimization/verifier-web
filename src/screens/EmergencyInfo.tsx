import { useState } from 'react';
import { DemoBanner } from '../components/DemoBanner';
import { Call119Button } from '../components/Call119Button';
import { VerificationBadge } from '../components/VerificationBadge';
import { callEmergencyContact } from '../api/emergencyAccess';
import type {
  EmergencyAccessResponse,
  EmergencyItem,
  ItemCode,
} from '../types';

// V3 · 발견자 최소정보 (MEDIVC_MASTER_PLAN §7 #8)
// 데이터 행은 정책이 허용한 최소 집합만. 원문: 약물 알레르기 · 항응고제 · 응급 메모.
// 인적사항·주민번호·전체 병력·전체 처방은 노출하지 않는다.
// 비상연락은 데이터로 노출하지 않고, 서버 중계 호출 버튼으로만 제공한다.

const ITEM_LABEL: Record<ItemCode, string> = {
  DRUG_ALLERGY: '약물 알레르기',
  ANTICOAGULANT_FLAG: '항응고제 복용',
  EMERGENCY_NOTE: '응급 메모',
  BLOOD_TYPE: '혈액형',
  MEDICATION_SUMMARY: '복용 요약',
  CONDITION: '주요 질환',
  IDENTITY: '인적사항',
  EMERGENCY_CONTACT: '비상연락',
};

const DISPLAY_ORDER: ItemCode[] = [
  'DRUG_ALLERGY',
  'ANTICOAGULANT_FLAG',
  'EMERGENCY_NOTE',
  'BLOOD_TYPE',
  'MEDICATION_SUMMARY',
  'CONDITION',
  'IDENTITY',
  'EMERGENCY_CONTACT',
];

function sortItems(items: EmergencyItem[]): EmergencyItem[] {
  return [...items].sort(
    (a, b) => DISPLAY_ORDER.indexOf(a.code) - DISPLAY_ORDER.indexOf(b.code),
  );
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function EmergencyInfo({
  data,
  onDone,
  onOpenGuide,
}: {
  data: EmergencyAccessResponse;
  onDone: () => void;
  onOpenGuide: () => void;
}) {
  const items = sortItems(data.items);
  const [contactState, setContactState] =
    useState<'idle' | 'dialing' | 'done'>('idle');
  const [detailsOpen, setDetailsOpen] = useState(false);

  async function onCallContact() {
    if (contactState !== 'idle') return;
    setContactState('dialing');
    try {
      await callEmergencyContact(data.accessSessionId);
      setContactState('done');
    } catch {
      setContactState('idle');
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">MediVC 응급정보</div>
        <span className="signature-ok" aria-label="서명 검증됨">
          서명 검증 ✓
        </span>
      </header>
      <DemoBanner />

      <div className="triage" role="alert">
        먼저 의식 · 호흡을 확인하고 즉시 119에 신고하세요.
      </div>

      <section className="items" aria-label="응급 최소정보">
        {items.map((item) => (
          <article className="item" key={item.code}>
            <div className="item__label">{ITEM_LABEL[item.code]}</div>
            <div className="item__value">{item.value}</div>
            <div className="item__meta">
              <VerificationBadge
                status={item.verificationStatus}
                source={item.source}
              />
            </div>
          </article>
        ))}
      </section>

      <div className="actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onOpenGuide}
        >
          응급처치 일반 가이드
        </button>
      </div>

      <button
        type="button"
        className="disclosure"
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen((v) => !v)}
      >
        {detailsOpen ? '출처 · 검증 상세 닫기' : '출처 · 검증 상세 >'}
      </button>
      {detailsOpen && (
        <dl className="provenance" aria-label="카드 정보">
          <dt>출처</dt>
          <dd>{data.card.issuer}</dd>
          <dt>서명</dt>
          <dd>{data.card.signatureVerified ? '✓ 검증됨' : '⚠ 미검증'}</dd>
          <dt>만료</dt>
          <dd>{formatExpiry(data.card.expiresAt)}</dd>
          <dt>정책</dt>
          <dd>v{data.policyVersion}</dd>
          <dt>대상</dt>
          <dd>일반 발견자</dd>
        </dl>
      )}

      <p className="footnote">
        이 열람은 기록되며 본인에게 통보됩니다. 인적사항 · 병력 · 처방은 공개되지 않습니다.
      </p>
      <button className="link-btn" type="button" onClick={onDone}>
        처음으로
      </button>

      <div className="sticky-actions" role="region" aria-label="상시 응급 도움">
        <div className="sticky-actions__inner">
          <Call119Button />
          {data.emergencyContactPresent && (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onCallContact}
              disabled={contactState !== 'idle'}
            >
              {contactState === 'idle' && '비상연락 호출'}
              {contactState === 'dialing' && '연결 중…'}
              {contactState === 'done' && '연결 요청됨'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
