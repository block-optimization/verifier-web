import type { Config } from '@netlify/functions';

/*
 * 좌표 → 주소 (도로명 우선, 지번 폴백) + 건물명 + 산악(임야) 여부.
 *
 * Naver Cloud Platform Maps Reverse Geocoding API 를 서버(이 함수) 에서만 호출한다.
 * Client Secret 은 여기(Netlify 환경변수) 에만 존재하며 브라우저로 내려가지 않는다.
 * 프론트(src/api/location.ts) 는 이 함수를 same-origin 상대경로로만 호출한다
 * (netlify.toml 의 /api/public/v1/location/reverse-geocode 리다이렉트 참고).
 *
 * 이 함수는 Netlify 배포에서만 동작한다. NCP micro(SSH 정적 배포) 환경에는
 * 서버 로직이 없어 이 엔드포인트가 없다 — docs/HANDOFF.md 참고.
 */

const NAVER_REVERSE_GEOCODE_URL = 'https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc';

interface NaverLand {
  type?: string; // '1' 일반, '2' 산(임야). roadaddr 결과에서는 보통 빈 문자열.
  number1?: string;
  number2?: string;
  name?: string; // 도로명
  addition0?: { type?: string; value?: string }; // type 'building' 이면 건물명
}

interface NaverRegionArea {
  name?: string;
}

interface NaverResult {
  name?: 'roadaddr' | 'addr' | string;
  region?: {
    area1?: NaverRegionArea;
    area2?: NaverRegionArea;
    area3?: NaverRegionArea;
    area4?: NaverRegionArea;
  };
  land?: NaverLand;
}

interface NaverReverseGeocodeResponse {
  status?: { code?: number; name?: string; message?: string };
  results?: NaverResult[];
}

function joinNonEmpty(parts: Array<string | undefined>): string {
  return parts.filter((p): p is string => !!p && p.length > 0).join(' ');
}

function formatRoadAddress(r: NaverResult): string | undefined {
  const { area1, area2 } = r.region ?? {};
  const land = r.land;
  if (!land?.name) return undefined;
  const numbers = joinNonEmpty([land.number1, land.number2 ? `-${land.number2}` : undefined]).replace(' -', '-');
  return joinNonEmpty([area1?.name, area2?.name, land.name, numbers]) || undefined;
}

function formatJibunAddress(r: NaverResult): string | undefined {
  const { area1, area2, area3, area4 } = r.region ?? {};
  const land = r.land;
  if (!land?.number1) return undefined;
  const isMountain = land.type === '2';
  const numbers = `${isMountain ? '산 ' : ''}${land.number1}${land.number2 ? `-${land.number2}` : ''}`;
  return joinNonEmpty([area1?.name, area2?.name, area3?.name, area4?.name, numbers]) || undefined;
}

export interface ReverseGeocodeResult {
  roadAddress?: string;
  jibunAddress?: string;
  /** roadaddr 결과에 건물(POI) 정보가 실려 있을 때만 채워진다 (예: "서울특별시청"). */
  buildingName?: string;
  /** 지번 결과의 land.type === '2' — 임야/산악 지역. */
  isMountainous?: boolean;
}

function toResult(data: NaverReverseGeocodeResponse): ReverseGeocodeResult {
  const results = Array.isArray(data.results) ? data.results : [];
  const roadaddr = results.find((r) => r.name === 'roadaddr');
  const addr = results.find((r) => r.name === 'addr');

  return {
    roadAddress: roadaddr ? formatRoadAddress(roadaddr) : undefined,
    jibunAddress: addr ? formatJibunAddress(addr) : undefined,
    buildingName:
      roadaddr?.land?.addition0?.type === 'building' ? roadaddr.land.addition0.value : undefined,
    isMountainous: addr?.land?.type === '2',
  };
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405);
  }

  let body: { lat?: unknown; lng?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json body' }, 400);
  }
  const { lat, lng } = body;
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return json({ error: 'lat/lng (number) required' }, 400);
  }

  const clientId = process.env.NAVER_MAPS_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAPS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return json({ error: 'server not configured' }, 503);
  }

  const upstreamUrl = `${NAVER_REVERSE_GEOCODE_URL}?coords=${lng},${lat}&output=json&orders=roadaddr,addr`;
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: {
        'x-ncp-apigw-api-key-id': clientId,
        'x-ncp-apigw-api-key': clientSecret,
      },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return json({ error: 'upstream unreachable' }, 502);
  }
  if (!upstream.ok) {
    return json({ error: 'upstream error' }, 502);
  }

  const data = (await upstream.json()) as NaverReverseGeocodeResponse;
  return json(toResult(data), 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export const config: Config = {
  path: '/api/public/v1/location/reverse-geocode',
};
