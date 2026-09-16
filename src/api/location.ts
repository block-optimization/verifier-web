// 발견자의 현재 위치 → 도로명 주소.
//
// 좌표 획득은 브라우저 Geolocation API 로 프론트에서 직접 수행한다(백엔드 불필요).
// 좌표 → 사람이 읽을 수 있는 주소(역지오코딩)는 Naver Maps 의 Client Secret 을
// 브라우저에 노출할 수 없어 백엔드 프록시 `/api/public/v1/location/reverse-geocode`
// 를 거친다 (docs/BACKEND_INTEGRATION.md 계약 참고, 백엔드 미구현 시 실패해 폴백 문구로 이어짐).

const HIGH_ACCURACY_THRESHOLD_M = 30;
const REFINE_WINDOW_MS = 8_000;

export interface LocationFix {
  lat: number;
  lng: number;
  accuracyMeters: number;
}

export type LocationErrorReason =
  | 'PERMISSION_DENIED'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'UNSUPPORTED'
  | 'NETWORK';

export interface LocationError {
  reason: LocationErrorReason;
}

function toFix(pos: GeolocationPosition): LocationFix {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracyMeters: Math.round(pos.coords.accuracy),
  };
}

function toLocationError(err: GeolocationPositionError): LocationError {
  if (err.code === err.PERMISSION_DENIED) return { reason: 'PERMISSION_DENIED' };
  if (err.code === err.TIMEOUT) return { reason: 'TIMEOUT' };
  return { reason: 'UNAVAILABLE' };
}

/**
 * 최초 fix 의 정확도가 나쁘면(> 30m) 최대 8초간 더 나은 fix 를 기다린다.
 * 그 안에서 가장 정확했던 샘플을 채택한다 — "정확한 주소" 요구사항 대응.
 */
function refine(initial: LocationFix, resolve: (fix: LocationFix) => void) {
  let best = initial;
  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const fix = toFix(pos);
      if (fix.accuracyMeters < best.accuracyMeters) best = fix;
      if (fix.accuracyMeters <= HIGH_ACCURACY_THRESHOLD_M) {
        navigator.geolocation.clearWatch(watchId);
        resolve(fix);
      }
    },
    () => {
      /* 개선 시도 중 오류는 무시하고 이미 확보한 best fix 를 유지한다. */
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: REFINE_WINDOW_MS },
  );
  setTimeout(() => {
    navigator.geolocation.clearWatch(watchId);
    resolve(best);
  }, REFINE_WINDOW_MS);
}

export function getCurrentFix(): Promise<LocationFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject({ reason: 'UNSUPPORTED' } satisfies LocationError);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const fix = toFix(pos);
        if (fix.accuracyMeters <= HIGH_ACCURACY_THRESHOLD_M) {
          resolve(fix);
          return;
        }
        refine(fix, resolve);
      },
      (err) => reject(toLocationError(err)),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}

export interface ReverseGeocodeResult {
  /** 도로명 주소. 있으면 최우선으로 표시한다. */
  roadAddress?: string;
  /** 도로명 주소가 없는 지역(신규/농어촌 등)에서의 지번 주소 폴백. */
  jibunAddress?: string;
  /** 도로명 결과에 건물(POI) 정보가 실려 있을 때만 채워진다 (예: "서울특별시청"). */
  buildingName?: string;
  /** 지번 결과가 산(임야) 지목일 때 true — 국가지점번호 안내로 전환할지 판단에 쓴다. */
  isMountainous?: boolean;
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult> {
  let res: Response;
  try {
    res = await fetch('/api/public/v1/location/reverse-geocode', {
      method: 'POST',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ lat, lng }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw { reason: 'NETWORK' } satisfies LocationError;
  }
  if (!res.ok) throw { reason: 'NETWORK' } satisfies LocationError;
  return (await res.json()) as ReverseGeocodeResult;
}

// -----------------------------------------------------------------------------
// Naver Maps 클라이언트 SDK — "지도로 보기" 토글에서만 지연 로드한다.
// Client ID 는 공개돼도 안전하다(NCP 콘솔의 서비스 URL 제한으로 보호).
// 지도 위 임의 지점을 눌러 그 주소를 알려주는 기능은 후순위 — 아직 미구현.
// -----------------------------------------------------------------------------

declare global {
  interface Window {
    naver?: { maps: unknown };
  }
}

export function hasNaverMapsClientId(): boolean {
  return !!import.meta.env.VITE_NAVER_MAPS_CLIENT_ID;
}

let naverMapsLoadPromise: Promise<void> | null = null;

export function loadNaverMapsScript(): Promise<void> {
  const clientId = import.meta.env.VITE_NAVER_MAPS_CLIENT_ID;
  if (!clientId) return Promise.reject(new Error('VITE_NAVER_MAPS_CLIENT_ID not configured'));
  if (typeof window !== 'undefined' && window.naver?.maps) return Promise.resolve();
  if (naverMapsLoadPromise) return naverMapsLoadPromise;

  naverMapsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      naverMapsLoadPromise = null;
      reject(new Error('failed to load Naver Maps script'));
    };
    document.head.appendChild(script);
  });
  return naverMapsLoadPromise;
}
