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
//
// 화면 순서는 FE 수정요청서(2026-09-20) 「화면 흐름」을 그대로 따른다:
//   응급상황인가요? → 119 전화 버튼 → 통화 연결 후 스피커폰 안내
//   → 현재 위치 확인 → 신고 스크립트 → (신고 후) 응급처치 가이드
// 어느 단계도 환자·카드 조회에 의존하지 않는다 — 위치 실패는 119 안내를 막지 않는다.

type LocationState =
  | { status: 'loading' }
  | {
      status: 'ready';
      lat: number;
      lng: number;
      accuracyMeters: number;
      /** 화면에 보여주는 표기 (지번이면 "(지번)" 꼬리표가 붙는다). */
      addressLine: string;
      /** 119에 그대로 읽어 주는 주소. 좌표뿐이면 없다. */
      spokenAddress?: string;
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

/** 따옴표째 그대로 읽는 문장. `◯` 는 발견자가 눈앞을 보고 채우는 빈칸이다. */
interface ScriptLine {
  /** 이 문장을 읽을 조건. 선택지가 하나뿐이면 생략한다. */
  when?: string;
  say: string;
}

interface ReportStep {
  /** 목록 key 이자 이 단계가 무엇인지 — 화면에는 그리지 않는다. 읽을 건 대사다. */
  title: string;
  /** 말하기 전에 해야 할 확인 동작. */
  cue?: string;
  script?: ScriptLine[];
  /** 문장 뒤에 붙는 보충 안내. */
  detail?: string;
  /** 눈에 보이는 상태를 눌러 대사의 빈칸을 채우는 단계인지. */
  symptomPicker?: boolean;
}

/*
 * 3단계에서 눌러 고르는 상태.
 *
 * 버튼 글자를 문장에 그대로 끼우면 "의식 없음 상태입니다" 처럼 읽을 수 없는 말이
 * 된다. 버튼은 짧게(`label`), 문장은 자연스럽게 — 이어 말할 때의 연결형(`conj`)과
 * 끝맺는 형(`end`)을 따로 갖는다. 여러 개를 고르면 마지막만 끝맺음이다:
 *   [의식 없음, 숨 안 쉼] → "의식이 없고, 숨을 쉬지 않습니다."
 */
interface Symptom {
  label: string;
  conj: string;
  end: string;
}

export const SYMPTOMS: Symptom[] = [
  { label: '의식 없음', conj: '의식이 없고', end: '의식이 없습니다' },
  { label: '숨 안 쉼', conj: '숨을 쉬지 않고', end: '숨을 쉬지 않습니다' },
  { label: '경련', conj: '경련을 하고', end: '경련을 하고 있습니다' },
  { label: '출혈', conj: '피가 많이 나고', end: '피가 많이 납니다' },
  { label: '안색 창백', conj: '안색이 창백하고', end: '안색이 창백합니다' },
  { label: '골절', conj: '뼈가 부러진 것 같고', end: '뼈가 부러진 것 같습니다' },
];

/** 고른 상태들을 한 문장으로. 고른 게 없으면 빈칸을 남긴다. */
export function conditionSentence(picked: string[]): string {
  const chosen = SYMPTOMS.filter((s) => picked.includes(s.label));
  if (chosen.length === 0) return '현재 환자는 ◯◯◯ 상태입니다.';
  const clauses = chosen.map((s, i) => (i === chosen.length - 1 ? s.end : s.conj));
  return `현재 환자는 ${clauses.join(', ')}.`;
}

/**
 * 위치 단계의 대본 — 화면이 실제로 아는 주소만 문장에 넣는다.
 *
 * 건물명이 잡혀도 "OO빌딩 앞입니다" 같은 문장은 만들지 않는다. 역지오코딩이 알려주는 건
 * 그 좌표의 건물이지 환자가 그 건물 앞에 있다는 사실이 아니다. 대신 발견자가 직접 보고
 * 채우는 빈칸("◯◯◯동 ◯◯◯호", "◯층 ◯◯◯호")으로 남긴다.
 *
 * 주소를 모를 때의 대안(큰 건물 상호 · 전봇대 번호 · 국가지점번호)은 소방청 ·
 * 행정안전부 안전배움터 「119 구급신고 요령」의 안내를 그대로 따른다.
 */
function locationStep(location: LocationState): ReportStep {
  const base = { title: '정확한 위치 말하기' } as const;

  if (location.status === 'loading') {
    return { ...base, detail: '위 위치 카드에 주소가 뜨면 그대로 읽어 주세요.' };
  }

  if (location.status === 'ready' && location.spokenAddress) {
    // 어느 상황인지는 화면이 판단한다. 역지오코딩이 산악 지목을 주면 산, 건물명을
    // 주면 건물(이름으로 아파트/그 외를 가른다), 둘 다 없으면 실외로 본다.
    // 발견자에게 전 상황을 나열해 고르게 하지 않는다 — 고르는 데 시간이 든다.
    const address: ScriptLine = { say: `여기는 ${location.spokenAddress}입니다.` };
    const APARTMENT = /아파트|APT|빌라|연립|주공|타운|자이|래미안|푸르지오|힐스테이트|e편한세상|캐슬|더샵/i;

    const cases = {
      mountain: {
        script: [
          { when: '표지판이 보이면', say: '국가지점번호 ◯◯ ◯◯◯◯ ◯◯◯◯입니다.' },
          { when: '표지판이 없으면', say: '가장 가까운 등산로 입구는 ◯◯◯입니다.' },
        ],
        detail: '국가지점번호판은 등산로 옆에 서 있고, 한글 두 글자와 숫자 여덟 자리입니다.',
      },
      apartment: {
        script: [{ say: '◯◯◯동 ◯◯◯호입니다.' }],
        detail: '동 · 호수는 현관이나 우편함에 적혀 있습니다. 공동현관이 잠겨 있으면 그것도 말해 주세요.',
      },
      building: {
        script: [{ say: '◯층 ◯◯◯호입니다.' }],
        detail: '건물 밖이라면 “건물 밖 길가입니다” 라고 알려 주세요. 들어오는 길이 막혀 있으면(정문 잠김 · 좁은 골목 · 주차된 차) 함께 말합니다.',
      },
      outdoor: {
        script: [{ when: '눈에 띄는 게 있으면', say: '근처에 ◯◯◯가 보입니다.' }],
        detail: '건물 안이라면 층과 호수를, 지하라면 지하 몇 층인지 덧붙여 주세요.',
      },
    } as const;

    const picked = location.isMountainous
      ? cases.mountain
      : location.buildingName
        ? APARTMENT.test(location.buildingName)
          ? cases.apartment
          : cases.building
        : cases.outdoor;

    return { ...base, script: [address, ...picked.script], detail: picked.detail };
  }

  // 주소를 못 잡았거나 좌표만 있는 경우 — 모른다고 말하는 것도 상담원에게는 유효한
  // 정보다. 대신 소방청이 안내하는 대체 수단을 문장으로 전부 펼쳐 둔다.
  return {
    ...base,
    script: [
      { say: '정확한 주소는 모르겠습니다.' },
      { when: '간판이 보이면', say: '근처에 ◯◯◯가 보입니다.' },
      { when: '전봇대가 보이면', say: '전봇대 번호는 ◯◯◯◯◯◯◯◯입니다.' },
    ],
    detail: '전봇대 번호는 “위험” 글자 아래에 적힌 여덟 자리입니다. 건물 안이면 엘리베이터에 붙은 번호도 됩니다.',
  };
}

/**
 * 소방청 「119 구급신고 요령」 6단계를 따른다 — §10 원칙과 동일하게 생성형 AI가 절차를
 * 새로 만들지 않고 공식 출처의 순서와 예시 문장을 옮긴다.
 * (소방청 nfa.go.kr · 행정안전부 안전배움터 · 중앙응급의료센터 E-Gen)
 *
 * 원문 예시에서 4단계만 뒤집었다. 원문은 `"65살이고 평소에 심장병이 있어서 약을 드세요"`
 * 처럼 가족이 신고하는 상황을 전제하는데, 이 화면의 사용자는 모르는 사람을 발견한
 * 행인이다. 모른다고 답하는 것을 기본 문장으로 두고 아는 경우를 예외로 뺐다.
 */
function buildSteps(location: LocationState, condition: string): ReportStep[] {
  // condition 은 이미 완성된 한 문장이다 (conditionSentence 참고).
  return [
    {
      title: '“환자가 있습니다”라고 먼저 알리기',
      script: [{ say: '안녕하세요. 환자가 있습니다.' }],
    },
    locationStep(location),
    {
      // 환자 상태는 화면이 판단할 수 없다. 그렇다고 가능한 상태를 전부 나열하면
      // 자기 경우를 찾는 데 시간이 든다 — 본 대로 채우는 한 문장으로 둔다.
      title: '환자 상태 · 질환 말하기',
      cue: '어깨를 두드리며 “괜찮으세요?” 하고 물어본 뒤, 가슴이 오르내리는지 보세요.',
      script: [{ say: condition }],
      detail: '보이는 대로 고르세요. 위 문장이 고른 대로 바뀝니다.',
      symptomPicker: true,
    },
    {
      title: '환자 나이 · 지병 말하기',
      script: [
        { say: '나이와 지병은 모르겠습니다.' },
        { when: '아는 경우에만', say: '◯◯살이고, 평소 ◯◯◯ 약을 드십니다.' },
      ],
    },
    {
      // 발견자가 먼저 물어야 의료지도가 시작된다. 상담원이 묻기를 기다리지 않게
      // 마지막 두 문장을 대사로 준다.
      title: '출동 요청하고 할 일 묻기',
      script: [
        { say: '출동 부탁드립니다.' },
        { say: '혹시 오시는 동안 제가 해야 할 일이 있을까요?' },
      ],
    },
  ];
}

/*
 * 대본은 4단계에서 끊는다.
 *
 * 소방청 원문의 5 · 6단계(신고자 이름 · 연락처, 의료지도 받기)는 상담원이 먼저
 * 물어보는 것들이라 대본이 필요 없다. 화면에 두면 목록만 길어져서 정작 앞의 네
 * 단계가 밀린다. 대신 "끊지 말라"는 한 문장만 남긴다 — 이건 발견자가 먼저 알아야
 * 한다(E-Gen: 상담원이 끊을 때까지 끊지 않고 질문에 답한다).
 */
const AFTER_SCRIPT = '여기까지 말했으면 전화를 끊지 마세요. 이름 · 연락처와 나머지는 상담원이 물어봅니다.';

/** `◯` 빈칸만 색을 달리해 "여기는 내가 채운다"가 한눈에 보이게 한다. */
function withBlanks(say: string) {
  return say.split(/(◯+)/).map((part, i) =>
    part.startsWith('◯') ? (
      <span className="script__blank" key={i}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function ScriptLines({ lines }: { lines: ScriptLine[] }) {
  return (
    <>
      {lines.map((line) => (
        <div className="script" key={line.say}>
          {line.when && <div className="script__when">{line.when}</div>}
          <p className="script__say">“{withBlanks(line.say)}”</p>
        </div>
      ))}
    </>
  );
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
/** 지도 인스턴스 중 우리가 쓰는 부분만. */
interface NaverMap {
  setCenter: (position: NaverLatLng) => void;
  setZoom: (level: number) => void;
  panTo?: (position: NaverLatLng) => void;
}
interface NaverMapsNamespace {
  maps: {
    LatLng: new (lat: number, lng: number) => NaverLatLng;
    Point: new (x: number, y: number) => NaverPoint;
    Map: new (el: HTMLElement, options: { center: NaverLatLng; zoom: number }) => NaverMap;
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
  // 지도를 밀거나 확대한 뒤 현재 위치로 되돌리기 위해 인스턴스와 최초 중심을 들고 있는다.
  const mapRef = useRef<NaverMap | null>(null);
  const mapCenterRef = useRef<NaverLatLng | null>(null);
  // 눌러서 고른 상태. 여러 개를 동시에 고를 수 있다 — 의식이 없으면서 숨도 안 쉬는
  // 경우가 가장 급한 조합이라 하나만 고르게 하면 안 된다.
  const [symptoms, setSymptoms] = useState<string[]>([]);

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
            setLocation({
              status: 'ready',
              ...base,
              addressLine: geo.roadAddress,
              spokenAddress: geo.roadAddress,
              addressSource: 'road',
            });
          } else if (geo.jibunAddress) {
            setLocation({
              status: 'ready',
              ...base,
              addressLine: `${geo.jibunAddress} (지번)`,
              spokenAddress: geo.jibunAddress,
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

  // 위치 API 는 "화면 진입 또는 사용자의 명시적 새로고침" 에만 호출한다
  // (FE 수정요청서 2026-09-20 「위치 API」). 진입 1회를 ref 로 못박아 두면
  // StrictMode 의 이중 마운트에서도 요청과 watchPosition 이 두 벌 생기지 않는다.
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (autoLoaded.current) return;
    autoLoaded.current = true;
    loadLocation();
  }, [loadLocation]);

  const steps = buildSteps(location, conditionSentence(symptoms));

  function toggleSymptom(symptom: string) {
    setSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom],
    );
  }

  function recenterMap() {
    const map = mapRef.current;
    const center = mapCenterRef.current;
    if (!map || !center) return;
    map.setZoom(16);
    if (map.panTo) map.panTo(center);
    else map.setCenter(center);
  }

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
        mapRef.current = map;
        mapCenterRef.current = center;

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

      <section className="report-block" aria-label="응급 신고 시작">
        <h1 className="report-block__question">응급상황인가요?</h1>
        <p className="report-block__lede">
          환자가 의식이 없거나 숨을 제대로 쉬지 못하면 <strong>지금 바로 119에 전화</strong>하세요.
          망설이지 말고 먼저 걸어도 됩니다.
        </p>
        <Call119Button variant="primary" />
        <p className="report-block__speaker">
          전화가 연결되면 <strong>스피커폰</strong>으로 바꾸고 휴대폰을 환자 옆에 내려놓으세요.
          두 손이 비어야 상담원의 안내대로 처치할 수 있어요.
        </p>
      </section>

      <section className="report-block" aria-label="현재 위치">
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
                  <div className="map-shell">
                    <div className="map-frame" ref={mapContainerRef} />
                    {mapState === 'ready' && (
                      <button type="button" className="map-recenter" onClick={recenterMap}>
                        현재 위치
                      </button>
                    )}
                  </div>
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
              <div className="step-list__body">
              {step.cue && <div className="step-list__detail">{step.cue}</div>}
              {step.script && <ScriptLines lines={step.script} />}
              {step.detail && <div className="step-list__detail">{step.detail}</div>}
              {step.symptomPicker && (
                <div className="symptom-picker" role="group" aria-label="보이는 상태 고르기">
                  {SYMPTOMS.map(({ label }) => {
                    const on = symptoms.includes(label);
                    return (
                      <button
                        type="button"
                        key={label}
                        className={on ? 'symptom symptom--on' : 'symptom'}
                        aria-pressed={on}
                        onClick={() => toggleSymptom(label)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
              </div>
            </li>
          ))}
        </ol>
        <p className="report-close">{AFTER_SCRIPT}</p>
        <p className="hint">
          따옴표 안의 문장을 그대로 읽으세요. <span className="script__blank">◯</span> 자리는 보고
          채우면 됩니다. 출처: 소방청 · 행정안전부 안전배움터 119 구급신고 요령
        </p>
      </section>

      <div className="sticky-actions" role="region" aria-label="상시 응급 도움">
        <div className="sticky-actions__inner sticky-actions__row">
          <Call119Button />
          <button type="button" className="btn btn--primary" onClick={onOpenGuide}>
            응급처치 가이드
          </button>
        </div>
      </div>
    </main>
  );
}
