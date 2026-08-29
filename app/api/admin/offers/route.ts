import { getAuthorizedAdmin } from "../../../lib/admin-auth";
import {
  featureDisabledResponse,
  isFeatureEnabled,
} from "../../../lib/runtime-flags";
import {
  OfferValidationError,
  offerStatuses,
  parseOfferDraft,
  type OfferStatus,
} from "../../../lib/offer-input";
import {
  changeOfferStatus,
  createDraftOffer,
  listAdminOffers,
} from "../../../lib/price-store";

export const dynamic = "force-dynamic";

export async function GET() {
  // 인증보다 먼저. 로그인 여부·권한 상태가 응답 차이로 새지 않게 한다.
  if (!(await isFeatureEnabled("ADMIN_UI_ENABLED"))) {
    return featureDisabledResponse();
  }
  const admin = await getAuthorizedAdmin();
  if (!admin) return Response.json({ error: "권한이 없습니다." }, { status: 403 });

  try {
    return Response.json({ offers: await listAdminOffers() });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  if (!(await isFeatureEnabled("ADMIN_UI_ENABLED"))) {
    return featureDisabledResponse();
  }
  const admin = await getAuthorizedAdmin();
  if (!admin) return Response.json({ error: "권한이 없습니다." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "JSON 요청만 허용합니다." }, { status: 415 });
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const action = payload.action;

    if (action === "create") {
      const draft = parseOfferDraft(payload);
      const offer = await createDraftOffer(draft, admin.email);
      return Response.json({ offer }, { status: 201 });
    }

    if (action === "import") {
      // sync-coupang-products 가 만든 등록안 배열. 전부 draft 로 들어가고
      // 승인은 여전히 사람이 한 건씩 한다 — 일괄 등록이지 일괄 검수가 아니다.
      const drafts = payload.drafts;
      if (!Array.isArray(drafts) || drafts.length === 0) {
        return Response.json(
          { error: "drafts 배열이 비어 있습니다." },
          { status: 400 },
        );
      }
      if (drafts.length > 50) {
        return Response.json(
          { error: "한 번에 50건까지만 등록할 수 있습니다." },
          { status: 400 },
        );
      }
      const results: Array<{
        ok: boolean;
        productId: string;
        id?: string;
        error?: string;
      }> = [];
      const summary = () => ({
        results,
        created: results.filter((item) => item.ok).length,
        failed: results.filter((item) => !item.ok).length,
      });
      for (const item of drafts) {
        const label =
          item && typeof item === "object" && typeof (item as Record<string, unknown>).productId === "string"
            ? ((item as Record<string, unknown>).productId as string)
            : "(productId 없음)";
        try {
          const draft = parseOfferDraft(item);
          const offer = await createDraftOffer(draft, admin.email);
          results.push({ ok: true, productId: label, id: offer.id });
        } catch (error) {
          if (!(error instanceof OfferValidationError)) {
            // 저장 계층 오류로 중단하더라도, 이미 등록된 건을 숨기면
            // 재시도가 그 건들을 중복 등록한다 — 부분 결과를 함께 돌려준다.
            return Response.json(
              {
                error: `${label} 처리 중 중단됐습니다: ${
                  error instanceof Error ? error.message : "알 수 없는 오류"
                }`,
                ...summary(),
              },
              { status: 500 },
            );
          }
          // 한 건의 검증 실패로 나머지를 버리지 않는다. 무엇이 왜 빠졌는지
          // 건별로 돌려준다.
          results.push({ ok: false, productId: label, error: error.message });
        }
      }
      return Response.json(summary());
    }

    if (action === "status") {
      const id = typeof payload.id === "string" ? payload.id.trim() : "";
      const status = payload.status;
      if (!id || !isOfferStatus(status)) {
        return Response.json(
          { error: "가격 ID와 검수 상태를 확인해 주세요." },
          { status: 400 },
        );
      }
      const offer = await changeOfferStatus(id, status, admin.email);
      return Response.json({ offer });
    }

    return Response.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
  } catch (error) {
    return routeError(error);
  }
}

function isOfferStatus(value: unknown): value is OfferStatus {
  return typeof value === "string" && offerStatuses.includes(value as OfferStatus);
}

function routeError(error: unknown): Response {
  const message =
    error instanceof Error ? error.message : "가격 작업을 완료하지 못했습니다.";
  const status = error instanceof OfferValidationError ? 400 : 500;
  return Response.json({ error: message }, { status });
}
