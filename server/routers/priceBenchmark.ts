import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const priceBenchmarkRouter = router({
  // ── Query historical prices for an item name ──────────────────────────────
  getHistorical: protectedProcedure
    .input(z.object({
      itemName: z.string().min(2),
      unit: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return null;
      try {
        const keyword = input.itemName.replace(/'/g, "''").toLowerCase();

        // Pull from PO items (actual paid prices — most reliable)
        const poRows = await dbInstance.execute(`
          SELECT poi.itemName, poi.unitPrice, poi.unit, v.legalName as vendorName, po.createdAt
          FROM purchaseOrderItems poi
          JOIN purchaseOrders po ON poi.poId = po.id
          LEFT JOIN vendors v ON po.vendorId = v.id
          WHERE po.organizationId = ${ctx.user.organizationId}
            AND LOWER(poi.itemName) LIKE '%${keyword}%'
            AND po.status NOT IN ('cancelled','draft')
          ORDER BY po.createdAt DESC
          LIMIT 20
        `) as any;

        // Pull from PR items (estimated prices — less reliable but more data)
        const prRows = await dbInstance.execute(`
          SELECT pri.itemName, pri.unitPrice, pri.unit, pr.createdAt
          FROM purchaseRequestItems pri
          JOIN purchaseRequests pr ON pri.requestId = pr.id
          WHERE pr.organizationId = ${ctx.user.organizationId}
            AND LOWER(pri.itemName) LIKE '%${keyword}%'
            AND pr.status = 'approved'
          ORDER BY pr.createdAt DESC
          LIMIT 20
        `) as any;

        const poData = (poRows[0] || []) as any[];
        const prData = (prRows[0] || []) as any[];

        if (poData.length === 0 && prData.length === 0) return null;

        // Use PO prices (actual) preferentially
        const prices = poData.length > 0
          ? poData.map((r: any) => parseFloat(r.unitPrice))
          : prData.map((r: any) => parseFloat(r.unitPrice));

        const validPrices = prices.filter(p => p > 0);
        if (validPrices.length === 0) return null;

        const avg = validPrices.reduce((s, p) => s + p, 0) / validPrices.length;
        const min = Math.min(...validPrices);
        const max = Math.max(...validPrices);
        const last = validPrices[0];

        // Best vendor (lowest price from PO data)
        const bestPO = poData.length > 0
          ? poData.reduce((best: any, curr: any) =>
              parseFloat(curr.unitPrice) < parseFloat(best.unitPrice) ? curr : best
            )
          : null;

        return {
          source: poData.length > 0 ? "actual" : "estimated",
          sampleSize: validPrices.length,
          avg: Math.round(avg),
          min: Math.round(min),
          max: Math.round(max),
          last: Math.round(last),
          bestVendor: bestPO?.vendorName || null,
          bestVendorPrice: bestPO ? Math.round(parseFloat(bestPO.unitPrice)) : null,
          lastDate: poData[0]?.createdAt || prData[0]?.createdAt || null,
        };
      } catch (e) {
        console.error("priceBenchmark.getHistorical error:", e);
        return null;
      }
    }),

  // ── AI market price estimate when no history exists ───────────────────────
  getAIEstimate: protectedProcedure
    .input(z.object({
      itemName: z.string().min(2),
      description: z.string().optional(),
      unit: z.string().optional(),
      quantity: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 300,
            system: `You are a procurement price analyst specializing in West Africa (Benin, Côte d'Ivoire, Sénégal). 
You provide realistic market price estimates in XOF (West African CFA franc) for goods and services.
Always respond ONLY with valid JSON, no explanation. Format:
{
  "estimatedUnitPrice": <number in XOF>,
  "priceRange": { "min": <number>, "max": <number> },
  "confidence": "high" | "medium" | "low",
  "marketNotes": "<brief 1-sentence note about the market>",
  "negotiationTip": "<1 specific tip for negotiating this item in West Africa>"
}`,
            messages: [{
              role: "user",
              content: `Estimate the market price for: "${input.itemName}"${input.description ? ` (${input.description})` : ""}${input.unit ? `, unit: ${input.unit}` : ""}${input.quantity ? `, quantity: ${input.quantity}` : ""}.
Context: B2B procurement in Benin/Côte d'Ivoire, formal supplier, standard commercial terms.`
            }]
          })
        });

        const data = await response.json();
        const text = data.content?.[0]?.text || "";
        const clean = text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(clean);

        return {
          source: "ai",
          estimatedUnitPrice: parsed.estimatedUnitPrice,
          priceRange: parsed.priceRange,
          confidence: parsed.confidence,
          marketNotes: parsed.marketNotes,
          negotiationTip: parsed.negotiationTip,
        };
      } catch (e) {
        return null;
      }
    }),

  // ── Batch check all items in a PR ────────────────────────────────────────
  checkItems: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        itemName: z.string(),
        unitPrice: z.number(),
        unit: z.string().optional(),
      }))
    }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];
      const results = await Promise.all(
        input.items.map(async (item) => {
          if (!item.itemName || item.unitPrice <= 0) return null;
          try {
            const keyword = item.itemName.replace(/'/g, "''").toLowerCase();
            const rows = await dbInstance.execute(`
              SELECT poi.unitPrice FROM purchaseOrderItems poi
              JOIN purchaseOrders po ON poi.poId = po.id
              WHERE po.organizationId = ${ctx.user.organizationId}
                AND LOWER(poi.itemName) LIKE '%${keyword}%'
                AND po.status NOT IN ('cancelled','draft')
              ORDER BY po.createdAt DESC LIMIT 10
            `) as any;
            const prices = ((rows[0] || []) as any[]).map((r: any) => parseFloat(r.unitPrice)).filter(p => p > 0);
            if (prices.length === 0) return { itemName: item.itemName, status: "no_data" };
            const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
            const pct = ((item.unitPrice - avg) / avg) * 100;
            return {
              itemName: item.itemName,
              quotedPrice: item.unitPrice,
              avgHistorical: Math.round(avg),
              pctAboveAvg: Math.round(pct * 10) / 10,
              status: pct > 20 ? "high" : pct > 5 ? "slightly_high" : pct < -5 ? "good_deal" : "fair",
            };
          } catch { return null; }
        })
      );
      return results.filter(Boolean);
    }),
});
