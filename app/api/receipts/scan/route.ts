import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { fail, ok } from "@/lib/http";

export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const MEDIA_TYPES = ["image/jpeg", "image/png"] as const;

const ScannedReceipt = z.object({
  store_name: z.string().describe("가게 이름. 보이지 않으면 빈 문자열"),
  items: z
    .array(
      z.object({
        menu_name: z.string(),
        quantity: z.number().int(),
        unit_price: z.number().int().describe("1개당 가격(원). 할인 행은 음수가 아닌 별도 행으로 두지 말고 반영"),
      }),
    )
    .describe("영수증에 적힌 순서대로의 메뉴 목록"),
});

const PROMPT = `이 사진은 한국 식당/카페 영수증입니다. 메뉴별 더치페이에 쓸 수 있도록 가게 이름과 품목을 추출해 주세요.
- 품목마다 메뉴 이름, 수량, 1개당 단가(원, 정수)를 적어 주세요. 금액 칸이 수량×단가 합계라면 수량으로 나눈 값을 단가로 쓰세요.
- 합계, 부가세, 결제 수단, 카드 승인 정보 같은 품목이 아닌 줄은 제외하세요.
- 사진이 영수증이 아니거나 읽을 수 없으면 items 를 빈 배열로 두세요.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return fail("사진 인식이 아직 설정되지 않았어요. 직접 입력으로 등록해 주세요.", 503);
  }
  const form = await request.formData().catch(() => null);
  const image = form?.get("image");
  if (!(image instanceof Blob)) return fail("영수증 사진을 선택해 주세요.");
  const mediaType = MEDIA_TYPES.find((t) => t === image.type);
  if (!mediaType) return fail("JPG 또는 PNG 사진만 올릴 수 있어요.");
  if (image.size > MAX_BYTES) return fail("사진은 최대 10MB까지 올릴 수 있어요.");

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { format: betaZodOutputFormat(ScannedReceipt) },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: Buffer.from(await image.arrayBuffer()).toString("base64") },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return fail("영수증을 읽지 못했어요. 직접 입력으로 등록해 주세요.", 422);
    }
    const { store_name, items } = response.parsed_output;
    const cleaned = items
      .filter((i) => i.menu_name.trim() && i.quantity > 0 && i.unit_price >= 0)
      .map((i) => ({ menu_name: i.menu_name.trim().slice(0, 40), quantity: i.quantity, unit_price: i.unit_price }));
    if (!cleaned.length) return fail("영수증에서 메뉴를 찾지 못했어요. 직접 입력으로 등록해 주세요.", 422);
    return ok({ store_name: store_name.trim().slice(0, 40), items: cleaned });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return fail("요청이 많아요. 잠시 후 다시 시도해 주세요.", 429);
    if (error instanceof Anthropic.APIError) {
      console.error("receipt scan failed", error.status, error.message);
      return fail("사진 인식 중 문제가 생겼어요. 다시 시도해 주세요.", 502);
    }
    throw error;
  }
}
