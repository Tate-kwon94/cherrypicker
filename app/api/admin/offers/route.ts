import { getAuthorizedAdmin } from "../../../lib/admin-auth";
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
  const admin = await getAuthorizedAdmin();
  if (!admin) return Response.json({ error: "권한이 없습니다." }, { status: 403 });

  try {
    return Response.json({ offers: await listAdminOffers() });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
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
