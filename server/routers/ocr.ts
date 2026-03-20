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
        const dataUrl = `data:${input.mimeType};base64,${input.imageBase64}`;
        
        const result = await invokeLLM({
          messages: [{
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl, detail: "high" },
              },
              {
                type: "text",
                text: `You are an invoice data extractor. Look at this invoice image carefully and extract all data.

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "invoiceNumber": "string or null",
  "vendorName": "string or null", 
  "invoiceDate": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "subtotal": number or null,
  "taxAmount": number or null,
  "totalAmount": number or null,
  "currency": "string or null",
  "lineItems": [{"description": "string", "quantity": number, "unitPrice": number, "total": number}],
  "notes": "string or null"
}`,
              },
            ],
          }],
          temperature: 0,
          model: "gpt-4o",
        });

        console.log("[OCR] Raw result:", result.content?.slice(0, 200));
        const text = result.content || "";
        const clean = text.replace(/```json\n?|\n?```/g, "").trim();
        
        try {
          const parsed = JSON.parse(clean);
          return { success: true, data: parsed };
        } catch (parseErr) {
          console.error("[OCR] JSON parse error. Raw text:", text);
          throw new Error("Réponse non parseable: " + text.slice(0, 100));
        }
      } catch (e: any) {
        console.error("[OCR] Error:", e.message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Échec OCR: " + (e.message || "erreur inconnue"),
        });
      }
    }),
});
