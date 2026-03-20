import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

export const ocrRouter = router({
  extractInvoice: protectedProcedure
    .input(z.object({
      imageBase64: z.string(), // base64 encoded image or PDF page
      mimeType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ ctx, input }) => {
      const apiKey = process.env.ANTHROPIC_API_KEY || process.env.BUILT_IN_FORGE_API_KEY;
      if (!apiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "API key not configured" });

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
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
                text: `Extract invoice data from this image. Return ONLY a JSON object with these exact fields (use null for missing values):
{
  "invoiceNumber": "string or null",
  "vendorName": "string or null",
  "vendorTaxId": "string or null",
  "invoiceDate": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "subtotal": number or null,
  "taxAmount": number or null,
  "totalAmount": number or null,
  "currency": "3-letter code or null",
  "lineItems": [{"description": "string", "quantity": number, "unitPrice": number, "total": number}],
  "notes": "string or null"
}
Return ONLY the JSON, no explanation.`,
              },
            ],
          }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("[OCR] API error:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "OCR extraction failed" });
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || "";

      try {
        const clean = text.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(clean);
        return { success: true, data: parsed };
      } catch (e) {
        console.error("[OCR] Parse error:", e, "Raw:", text);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not parse invoice data" });
      }
    }),
});
