/**
 * CSP 위반 리포트 수신지.
 *
 * 정책을 `Report-Only` 로 두는 이유는 "무엇이 깨지는지 먼저 보고 enforce 로
 * 올린다"였는데, 받는 곳이 없으면 그 관측이 아예 일어나지 않는다. 막지도
 * 않고 보고도 받지 않는 정책은 문서일 뿐이다.
 *
 * 로그로만 남긴다. 저장하지 않는 이유는 이 리포트가 사용자가 어떤 페이지를
 * 봤는지 담고 있어서다 — 보관 기간·수집 명세를 정하기 전에는 남기지 않는
 * 편이 맞다.
 */
export const dynamic = "force-dynamic";

/** 브라우저가 보내는 두 가지 형식. */
type LegacyReport = {
  "csp-report"?: Record<string, unknown>;
};

type ReportingApiEntry = {
  type?: string;
  body?: Record<string, unknown>;
};

/** 로그에 남길 필드만 고른다. 원본을 통째로 찍으면 URL 전체가 남는다. */
function summarize(report: Record<string, unknown>): string {
  const directive =
    report["effective-directive"] ??
    report["effectiveDirective"] ??
    report["violated-directive"] ??
    report["violatedDirective"] ??
    "unknown";
  const blocked = report["blocked-uri"] ?? report["blockedURL"] ?? "unknown";

  // 차단된 자원은 출처까지만 남긴다. 경로에는 토큰이 실릴 수 있다.
  let origin = String(blocked);
  try {
    origin = new URL(origin).origin;
  } catch {
    // `inline`·`eval` 같은 키워드는 URL 이 아니다. 그대로 둔다.
  }

  return `${String(directive)} <- ${origin}`;
}

export async function POST(request: Request) {
  // 본문을 읽지 못해도 실패로 만들지 않는다. 리포트 수신이 사용자 요청을
  // 방해하면 안 된다.
  try {
    const raw: unknown = await request.json();
    const reports: Record<string, unknown>[] = Array.isArray(raw)
      ? (raw as ReportingApiEntry[])
          .filter((entry) => entry?.type === "csp-violation" || entry?.body)
          .map((entry) => entry.body ?? {})
      : [((raw as LegacyReport)?.["csp-report"] ?? {}) as Record<string, unknown>];

    for (const report of reports) {
      if (Object.keys(report).length === 0) continue;
      console.warn(`[csp] ${summarize(report)}`);
    }
  } catch {
    console.warn("[csp] 위반 리포트를 읽지 못했습니다.");
  }

  // 204. 브라우저는 본문을 쓰지 않는다.
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}
