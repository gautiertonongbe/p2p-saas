import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { ENV } from "../_core/env";

export const ocrRouter = router({
  extractInvoice: protectedProcedure
    .input(z.object({
      imageBase64: z.string(),
      mimeType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ENV.forgeApiKey) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "API key not configured" });
      }

      // Use Anthropic API directly with vision
      const apiUrl = ENV.forgeApiUrl
        ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/messages`
        : "https://api.anthropic.com/v1/messages";

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "x-api-key": ENV.forgeApiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-opus-4-20250514",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: input.mimeType,
                  data: input.imageBase64,
                },
              },
              {
                type: "text",
                text: `Extract all invoice data from this image. Return ONLY a valid JSON object with these fields (null for missing):
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
Return ONLY the JSON object, no markdown, no explanation.`,
              },
            ],
          }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("[OCR] API error:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "OCR extraction failed: " + err.slice(0, 100) });
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || "";

      try {
        const clean = text.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(clean);
        return { success: true, data: parsed };
      } catch (e) {
        console.error("[OCR] Parse error:", e, "Raw:", text);
        // Return partial data even if parse fails
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Impossible d'analyser la facture. Essayez avec une image plus nette." });
      }
    }),
});
