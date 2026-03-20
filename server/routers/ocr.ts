import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";

export const ocrRouter = router({
  extractInvoice: protectedProcedure
    .input(z.object({
      imageBase64: z.string(),
      mimeType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await invokeLLM({
          messages: [{
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${input.mimeType};base64,${input.imageBase64}`,
                },
              },
              {
                type: "text",
                text: `Extract all invoice data from this image. Return ONLY a valid JSON object with these fields (use null for missing values):
{
  "invoiceNumber": "string or null",
  "vendorName": "string or null",
  "invoiceDate": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "subtotal": number or null,
  "taxAmount": number or null,
  "totalAmount": number or null,
  "currency": "XOF or USD or EUR etc or null",
  "lineItems": [{"description": "string", "quantity": number, "unitPrice": number, "total": number}],
  "notes": "string or null"
}
Return ONLY the JSON object, no markdown fences, no explanation.`,
              },
            ],
          }],
          temperature: 0,
        });

        const text = result.content || "";
        const clean = text.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(clean);
        return { success: true, data: parsed };
      } catch (e: any) {
        console.error("[OCR] Error:", e.message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible d'analyser la facture. Essayez avec une image plus nette.",
        });
      }
    }),
});
