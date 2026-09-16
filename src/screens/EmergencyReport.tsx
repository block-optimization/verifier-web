import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import logo from '../assets/logo.png';
import { Call119Button } from '../components/Call119Button';
import {
  getCurrentFix,
  reverseGeocode,
  hasNaverMapsClientId,
  loadNaverMapsScript,
  type LocationErrorReason,
} from '../api/location';

// 119 신고 중심 피봇: 발견자에게 환자의 질병 · 약물 정보를 보여주지 않는다.
// 대신 (1) 즉시 119 신고를 유도하고 (2) 통화 중 불러줄 정확한 위치와
// (3) 무슨 말을 해야 할지 순서를 제공한 뒤 (4) 응급처치 가이드로 넘긴다.

type LocationState =
  | { status: 'loading' }
  | {
      status: 'ready';
      lat: number;
      lng: number;
      accuracyMeters: number;
      addressLine: string;
      addressSource: 'road' | 'jibun' | 'coords';
      buildingName?: string;
      isMountainous?: boolean;
    }
  | { status: 'error'; reason: LocationErrorReason };

// 위치 확인 실패 시 안내 — 소방청 · 지자체 소방본부 공식 "주소를 모를 때" 대안을 그대로 안내한다.
const ADDRESS_UNKNOWN_TIP =
  '근처 큰 건물의 상호나 전화번호, 엘리베이터 고유번호, 전봇대 번호, 고속도로라면 이정표 숫자를 대신 말씀하세요.';

const LOCATION_ERROR_COPY: Record<LocationErrorReason, string> = {
  PERMISSION_DENIED: `위치 권한이 거부되어 있어요. 브라우저 설정에서 위치 접근을 허용해 다시 시도하거나, ${ADDRESS_UNKNOWN_TIP}`,
  UNAVAILABLE: `지금 위치를 확인할 수 없어요. ${ADDRESS_UNKNOWN_TIP}`,
  TIMEOUT: `위치 확인이 오래 걸리고 있어요. 실내라면 창가로 이동해 다시 시도하거나, ${ADDRESS_UNKNOWN_TIP}`,
  UNSUPPORTED: `이 브라우저는 위치 확인을 지원하지 않아요. ${ADDRESS_UNKNOWN_TIP}`,
  NETWORK: `주소 변환 서버에 연결할 수 없어요. ${ADDRESS_UNKNOWN_TIP}`,
};

/*
 * 위치 케이스 — 한 번에 하나만 보여준다(너무 길면 안 읽힌다).
 * 전부 공식 소방기관 자료로 검증됨:
 *  · 건물명·층수 예시("2층 집이예요") — 대전광역시 소방본부 119 신고요령
 *  · 국가지점번호 · 등산로 위치표지판(산 속) — 소방청 · 대전소방본부 · 충남소방본부 공통
 *  · 전봇대 "위험" 문구 아래 8자리, 큰 건물 상호 — 충남소방본부 · 소방청
 */
type LocationCase = 'building' | 'mountain' | 'unclear' | null;

function locationCase(location: LocationState): LocationCase {
  if (location.status !== 'ready') return null;
  if (location.buildingName) return 'building';
  if (location.isMountainous) return 'mountain';
  if (location.addressSource === 'coords') return 'unclear';
  return null;
}

const LOCATION_CASE_COPY: Record<Exclude<LocationCase, null>, { label: string; detail: string }> = {
  building: {
    label: '건물 안이라면',
    detail: '층수 · 호실을 함께 말하세요. (예: “OO빌딩 2층”)',
  },
  mountain: {
    label: '산악 지역이에요',
    detail: '등산로의 119 위치표지판 번호나 국가지점번호판이 보이면 그 번호를 알려주세요.',
  },
  unclear: {
    label: '특정하기 어려운 위치예요',
    detail: '근처 큰 건물 상호, 버스정류장 이름, 전봇대의 "위험" 글자 아래 8자리 중 보이는 것을 알려주세요.',
  },
};

interface ReportStep {
  title: string;
  detail?: string;
  isLocationStep?: boolean;
}

/**
 * 소방청 "119 구급신고 요령"(6단계)을 그대로 따른다 — §10 원칙과 동일하게
 * 생성형 AI가 절차를 새로 만들지 않고 공식 출처의 사실·순서만 옮긴다.
 * 발견자 화면은 환자의 질병 · 나이 정보를 갖고 있지 않으므로(§ 119 신고 중심 피봇),
 * 해당 단계는 발견자가 직접 확인해 말하도록 안내만 한다.
 */
function buildSteps(location: LocationState): ReportStep[] {
  const locationDetail =
    location.status === 'ready'
      ? '위 위치 카드의 주소를 그대로 전달하세요.'
      : location.status === 'error'
        ? ADDRESS_UNKNOWN_TIP
        : '위 위치 카드에 확인되는 대로 그 주소를 전달하세요.';

  return [
    { title: '“환자가 있습니다”라고 먼저 알리기' },
    { title: '정확한 위치 말하기', detail: locationDetail, isLocationStep: true },
    {
      title: '환자 상태 말하기',
      detail: '아픈 부위 · 의식 유무 · 호흡 여부를 확인해 전달하세요.',
    },
    {
      title: '환자 나이 · 지병 말하기',
      detail: '나이와 평소 앓는 지병, 복용 중인 약을 아는 경우에만 알려주세요.',
    },
    { title: '신고자 본인 이름 · 연락 가능한 번호 말하기' },
    {
      title: '전화를 끊지 말고 상담원 지시 따르기',
      detail: '의료지도를 받으며 침착하게 처치를 이어가세요.',
    },
  ];
}

interface NaverLatLng {
  lat: () => number;
  lng: () => number;
}
interface NaverPoint {}
interface NaverPointerEvent {
  coord: NaverLatLng;
}
interface NaverInfoWindow {
  setContent: (html: string) => void;
  open: (map: unknown, position: NaverLatLng) => void;
}
interface NaverMapsNamespace {
  maps: {
    LatLng: new (lat: number, lng: number) => NaverLatLng;
    Point: new (x: number, y: number) => NaverPoint;
    Map: new (el: HTMLElement, options: { center: NaverLatLng; zoom: number }) => unknown;
    Marker: new (options: {
      position: NaverLatLng;
      map: unknown;
      icon?: { content: string; anchor: NaverPoint };
    }) => unknown;
    InfoWindow: new (options: { content: string }) => NaverInfoWindow;
    Event: {
      addListener: (
        target: unknown,
        eventName: string,
        handler: (e: NaverPointerEvent) => void,
      ) => unknown;
    };
  };
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (c) => entities[c] ?? c);
}

function pinInfoContent(state: 'loading' | 'error' | { building?: string; address: string }): string {
  if (state === 'loading') {
    return '<div style="padding:10px 12px;font-size:13px;">불러오는 중…</div>';
  }
  if (state === 'error') {
    return '<div style="padding:10px 12px;font-size:13px;color:#c8271a;">주소를 확인할 수 없어요</div>';
  }
  const building = state.building
    ? `<div style="font-weight:700;color:#0b7d8c;margin-bottom:2px;">${escapeHtml(state.building)}</div>`
    : '';
  return `<div style="padding:10px 12px;max-width:220px;font-size:13px;line-height:1.5;">${building}<div>${escapeHtml(state.address)}</div></div>`;
}

export function EmergencyReport({ onOpenGuide }: { onOpenGuide: () => void }) {
  const [location, setLocation] = useState<LocationState>({ status: 'loading' });
  const [mapState, setMapState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInitialized = useRef(false);
  const infoWindowRef = useRef<NaverInfoWindow | null>(null);

  const loadLocation = useCallback(() => {
    setLocation({ status: 'loading' });
    getCurrentFix()
      .then(async (fix) => {
        try {
          const geo = await reverseGeocode(fix.lat, fix.lng);
          const base = {
            lat: fix.lat,
            lng: fix.lng,
            accuracyMeters: fix.accuracyMeters,
            buildingName: geo.buildingName,
            isMountainous: geo.isMountainous,
          } as const;
          if (geo.roadAddress) {
            setLocation({ status: 'ready', ...base, addressLine: geo.roadAddress, addressSource: 'road' });
          } else if (geo.jibunAddress) {
            setLocation({
              status: 'ready',
              ...base,
              addressLine: `${geo.jibunAddress} (지번)`,
              addressSource: 'jibun',
            });
          } else {
            setLocation({
              status: 'ready',
              ...base,
              addressLine: `좌표 ${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}`,
              addressSource: 'coords',
            });
          }
        } catch {
          setLocation({ status: 'error', reason: 'NETWORK' });
        }
      })
      .catch((err: { reason?: LocationErrorReason }) => {
        setLocation({ status: 'error', reason: err.reason ?? 'UNAVAILABLE' });
      });
  }, []);

  useEffect(loadLocation, [loadLocation]);

  const steps = buildSteps(location);
  const activeCase = locationCase(location);

  function handleMapToggle(e: SyntheticEvent<HTMLDetailsElement>) {
    if (!e.currentTarget.open) return;
    if (mapInitialized.current || location.status !== 'ready') return;
    mapInitialized.current = true;
    setMapState('loading');
    loadNaverMapsScript()
      .then(() => {
        if (!mapContainerRef.current || !window.naver || location.status !== 'ready') {
          throw new Error('map container or SDK unavailable');
        }
        const { maps } = window.naver as unknown as NaverMapsNamespace;
        const center = new maps.LatLng(location.lat, location.lng);
        const map = new maps.Map(mapContainerRef.current, { center, zoom: 16 });

        // 현재 위치 — 점(dot) 표시로. 지도 위 다른 지점을 누르면 그 주소를 보여주는
        // 마커/InfoWindow와 시각적으로 구분되게 한다.
        new maps.Marker({
          position: center,
          map,
          icon: {
            content:
              '<span style="display:block;width:14px;height:14px;border-radius:50%;background:var(--mv-key,#0b7d8c);border:2px solid #fff;box-shadow:0 0 0 2px rgba(11,125,140,0.35);"></span>',
            anchor: new maps.Point(7, 7),
          },
        });

        const infoWindow = new maps.InfoWindow({ content: pinInfoContent('loading') });
        infoWindowRef.current = infoWindow;

        maps.Event.addListener(map, 'click', (e: NaverPointerEvent) => {
          const lat = e.coord.lat();
          const lng = e.coord.lng();
          infoWindow.setContent(pinInfoContent('loading'));
          infoWindow.open(map, e.coord);
          reverseGeocode(lat, lng)
            .then((geo) => {
              const address = geo.roadAddress ?? geo.jibunAddress ?? `좌표 ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
              infoWindow.setContent(pinInfoContent({ building: geo.buildingName, address }));
            })
            .catch(() => infoWindow.setContent(pinInfoContent('error')));
        });

        setMapState('ready');
      })
      .catch(() => {
        mapInitialized.current = false;
        setMapState('error');
      });
  }

  return (
    <main className="page">
      <header className="topbar">
        <img className="brand" src={logo} alt="MediVC 응급정보" />
      </header>

      <section className="report-block" aria-label="119 신고 안내 및 현재 위치">
        <p className="report-block__lede">
          지금 바로 전화를 걸고 <strong>스피커폰</strong>으로 전환한 뒤, 아래 위치와 상황을 그대로 전달해 주세요.
        </p>
        <Call119Button variant="primary" />

        <div className="report-block__label">위치</div>
        {location.status === 'loading' && <p className="hint">위치를 확인하는 중…</p>}
        {location.status === 'error' && (
          <>
            <p className="report-block__error">{LOCATION_ERROR_COPY[location.reason]}</p>
            <button type="button" className="btn btn--secondary" onClick={loadLocation}>
              위치 다시 확인
            </button>
          </>
        )}
        {location.status === 'ready' && (
          <>
            {location.buildingName && (
              <p className="report-block__building">{location.buildingName}</p>
            )}
            <p
              className={
                location.buildingName
                  ? 'report-block__address report-block__address--secondary'
                  : 'report-block__address'
              }
            >
              {location.addressLine}
            </p>
            {location.accuracyMeters > 50 && (
              <p className="hint">
                정확도 반경 약 {location.accuracyMeters}m — 주변 건물이나 표지판도 함께 알려주세요.
              </p>
            )}
            {hasNaverMapsClientId() && (
              <details className="citation-toggle" onToggle={handleMapToggle}>
                <summary>
                  <span className="citation-toggle__label">지도로 보기</span>
                  <span className="citation-toggle__chevron" aria-hidden>
                    ›
                  </span>
                </summary>
                <div className="citation-toggle__body">
                  {mapState === 'error' && <p className="hint">지도를 불러오지 못했어요.</p>}
                  <div className="map-frame" ref={mapContainerRef} />
                </div>
              </details>
            )}
          </>
        )}
      </section>

      <section className="report-block" aria-label="신고 순서">
        <div className="report-block__label">이 순서로 말씀하세요</div>
        <ol className="step-list step-list--emphasis">
          {steps.map((step) => (
            <li className="step-list__item" key={step.title}>
              <div className="step-list__title">{step.title}</div>
              {step.detail && <div className="step-list__detail">{step.detail}</div>}
              {step.isLocationStep && activeCase && (
                <div className="location-case">
                  <strong>{LOCATION_CASE_COPY[activeCase].label}</strong>{' '}
                  {LOCATION_CASE_COPY[activeCase].detail}
                </div>
              )}
            </li>
          ))}
        </ol>
        <p className="hint">출처: 소방청 · 대전광역시 소방본부 · 충남소방본부 119 신고요령</p>
      </section>

      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={onOpenGuide}>
          신고 완료 · 응급처치 가이드 보기
        </button>
      </div>

      <div className="sticky-actions" role="region" aria-label="상시 응급 도움">
        <div className="sticky-actions__inner">
          <Call119Button />
        </div>
      </div>
    </main>
  );
}
