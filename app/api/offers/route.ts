import { listPublishedOffers } from "../../lib/price-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const offers = await listPublishedOffers();
    return Response.json(
      { offers },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "가격 정보를 불러오지 못했습니다.";
    return Response.json({ error: message, offers: [] }, { status: 503 });
  }
}
