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
      // Debug: log available env vars
      const availableKeys = Object.keys(process.env).filter(k => 
        k.includes('API') || k.includes('KEY') || k.includes('ANTHROPIC') || k.includes('FORGE') || k.includes('CLAUDE')
      );
      console.log("[OCR] Available API-related env vars:", availableKeys);
      console.log("[OCR] forgeApiKey value:", ENV.forgeApiKey ? "SET (length:" + ENV.forgeApiKey.length + ")" : "NOT SET");
      
      const apiKey = ENV.forgeApiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
      if (!apiKey) {
        console.error("[OCR] No API key found. Available vars:", availableKeys);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Clé API non configurée. Vars disponibles: " + availableKeys.join(", ") });
      }

      // Call Anthropic API directly — forge proxy uses OpenAI format which doesn't support vision the same way
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
                  media_type: input.mimeType as any,
                  data: input.imageBase64,
                },
              },
              {
                type: "text",
                text: `Extract all invoice data. Return ONLY valid JSON, no markdown:
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
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("[OCR] Anthropic API error:", response.status, err.slice(0, 200));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erreur API (${response.status}): ${err.slice(0, 100)}` });
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      console.log("[OCR] Response:", text.slice(0, 300));

      try {
        const clean = text.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(clean);
        return { success: true, data: parsed };
      } catch (e) {
        console.error("[OCR] Parse failed. Raw:", text);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Impossible d'analyser la réponse. Essayez avec une image plus nette." });
      }
    }),
});
