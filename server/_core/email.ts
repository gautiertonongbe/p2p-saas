/**
 * Email service using Resend API
 * Sign up at resend.com — free tier: 3000 emails/month
 * Add RESEND_API_KEY to Railway environment variables
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@p2p-saas.com";
const APP_URL = process.env.APP_URL || "https://p2p-saas-production.up.railway.app";

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log(`[Email] No RESEND_API_KEY set — would have sent to ${payload.to}: ${payload.subject}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Email] Failed to send to ${payload.to}:`, err);
      return false;
    }
    console.log(`[Email] Sent to ${payload.to}: ${payload.subject}`);
    return true;
  } catch (e) {
    console.error(`[Email] Error:`, e);
    return false;
  }
}

function baseTemplate(content: string, preheader: string = "") {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>P2P Platform</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr><td style="background:#1e40af;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">📋 Plateforme P2P</h1>
        </td></tr>
        <!-- Content -->
        <tr><td style="padding:32px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #f0f0f0;background:#fafafa;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Cet email a été envoyé automatiquement par votre plateforme P2P. Ne pas répondre à cet email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(text: string, url: string, color = "#1e40af") {
  return `<a href="${url}" style="display:inline-block;background:${color};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:4px 4px 4px 0;">${text}</a>`;
}

// ── Email templates ──────────────────────────────────────────────────────────

export async function sendApprovalRequestEmail(opts: {
  to: string;
  approverName: string;
  requesterName: string;
  requestTitle: string;
  requestNumber: string;
  amount: number;
  approvalId: number;
}) {
  const url = `${APP_URL}/approvals/${opts.approvalId}`;
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  
  return sendEmail({
    to: opts.to,
    subject: `Action requise : ${opts.requestTitle} (${opts.requestNumber})`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Nouvelle demande à approuver</h2>
      <p style="margin:0 0 24px;color:#6b7280;">Bonjour ${opts.approverName},</p>
      <p style="margin:0 0 24px;color:#374151;">
        <strong>${opts.requesterName}</strong> a soumis une demande d'achat qui nécessite votre approbation.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;">
        <tr><td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;">Référence</span></td><td style="padding:4px 0;text-align:right;font-weight:600;font-size:13px;">${opts.requestNumber}</td></tr>
        <tr><td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;">Intitulé</span></td><td style="padding:4px 0;text-align:right;font-weight:600;font-size:13px;">${opts.requestTitle}</td></tr>
        <tr><td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;">Montant estimé</span></td><td style="padding:4px 0;text-align:right;font-weight:700;font-size:15px;color:#1e40af;">${fmt(opts.amount)} XOF</td></tr>
      </table>
      <p style="margin:0 0 20px;">
        ${btn("✅ Approuver", url + "?action=approve", "#16a34a")}
        ${btn("❌ Rejeter", url + "?action=reject", "#dc2626")}
        ${btn("Voir les détails", url, "#6b7280")}
      </p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">Ces boutons vous redirigent vers la plateforme pour confirmer votre décision.</p>
    `, `Action requise: ${opts.requestTitle}`),
  });
}

export async function sendApprovalDecisionEmail(opts: {
  to: string;
  requesterName: string;
  requestTitle: string;
  requestNumber: string;
  decision: "approved" | "rejected";
  approverName: string;
  comment?: string;
  requestId: number;
}) {
  const approved = opts.decision === "approved";
  const url = `${APP_URL}/purchase-requests/${opts.requestId}`;

  return sendEmail({
    to: opts.to,
    subject: `${approved ? "✅ Approuvée" : "❌ Refusée"} : ${opts.requestTitle}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">
        ${approved ? "✅ Votre demande a été approuvée" : "❌ Votre demande a été refusée"}
      </h2>
      <p style="margin:0 0 24px;color:#6b7280;">Bonjour ${opts.requesterName},</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;">
        <tr><td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;">Référence</span></td><td style="padding:4px 0;text-align:right;font-weight:600;font-size:13px;">${opts.requestNumber}</td></tr>
        <tr><td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;">Décision par</span></td><td style="padding:4px 0;text-align:right;font-weight:600;font-size:13px;">${opts.approverName}</td></tr>
        ${opts.comment ? `<tr><td colspan="2" style="padding:8px 0 0;"><span style="color:#6b7280;font-size:13px;">Commentaire:</span><br><span style="font-size:14px;color:#374151;">${opts.comment}</span></td></tr>` : ""}
      </table>
      ${btn("Voir la demande", url)}
    `, `${approved ? "Approuvée" : "Refusée"}: ${opts.requestTitle}`),
  });
}

export async function sendVendorInvoiceSubmittedEmail(opts: {
  to: string;
  buyerName: string;
  vendorName: string;
  invoiceNumber: string;
  amount: number;
}) {
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  const url = `${APP_URL}/invoices`;

  return sendEmail({
    to: opts.to,
    subject: `Nouvelle facture fournisseur : ${opts.invoiceNumber}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Nouvelle facture soumise</h2>
      <p style="margin:0 0 24px;color:#6b7280;">Bonjour ${opts.buyerName},</p>
      <p style="margin:0 0 24px;color:#374151;">
        Le fournisseur <strong>${opts.vendorName}</strong> a soumis une nouvelle facture via le portail fournisseur.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;">
        <tr><td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;">N° Facture</span></td><td style="padding:4px 0;text-align:right;font-weight:600;">${opts.invoiceNumber}</td></tr>
        <tr><td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;">Montant</span></td><td style="padding:4px 0;text-align:right;font-weight:700;color:#1e40af;">${fmt(opts.amount)} XOF</td></tr>
      </table>
      ${btn("Examiner la facture", url)}
    `),
  });
}

export async function sendPOIssuedEmail(opts: {
  to: string;
  vendorName: string;
  orderNumber: string;
  amount: number;
  poId: number;
}) {
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  const portalUrl = `${APP_URL}/supplier-portal`;

  return sendEmail({
    to: opts.to,
    subject: `Nouveau bon de commande : ${opts.orderNumber}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Bon de commande reçu</h2>
      <p style="margin:0 0 24px;color:#6b7280;">Bonjour,</p>
      <p style="margin:0 0 24px;color:#374151;">
        Vous avez reçu un nouveau bon de commande.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;">
        <tr><td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;">N° BC</span></td><td style="padding:4px 0;text-align:right;font-weight:600;">${opts.orderNumber}</td></tr>
        <tr><td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;">Montant</span></td><td style="padding:4px 0;text-align:right;font-weight:700;color:#1e40af;">${fmt(opts.amount)} XOF</td></tr>
      </table>
      <p style="margin:0 0 16px;color:#374151;">Connectez-vous au portail fournisseur pour consulter les détails et soumettre votre facture.</p>
      ${btn("Accéder au portail fournisseur", portalUrl)}
    `),
  });
}
