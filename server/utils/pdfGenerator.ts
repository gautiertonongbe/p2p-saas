import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

interface Organization {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
}

interface Vendor {
  legalName: string;
  address?: string;
  phone?: string;
  email?: string;
}

interface POItem {
  itemName: string;
  description?: string | null;
  quantity: string | number;
  unit?: string | null;
  unitPrice: string | number;
  totalPrice: string | number;
}

interface PurchaseOrder {
  poNumber: string;
  issuedAt?: Date;
  createdAt: Date;
  expectedDeliveryDate?: Date | null;
  totalAmount: string | number;
  taxAmount: string | number;
  notes?: string | null;
  status: string;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface Invoice {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate?: Date | null;
  totalAmount: string | number;
  taxAmount: string | number;
  status: string;
  notes?: string | null;
}

export async function generatePurchaseOrderPDF(
  po: PurchaseOrder,
  items: POItem[],
  organization: Organization,
  vendor: Vendor
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('BON DE COMMANDE', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(po.poNumber, { align: 'center' });
    doc.moveDown(1.5);

    // Organization details (left)
    const startY = doc.y;
    doc.fontSize(10).font('Helvetica-Bold').text('Émetteur:', 50, startY);
    doc.font('Helvetica').fontSize(9);
    doc.text(organization.name, 50, doc.y + 5);
    if (organization.address) doc.text(organization.address);
    if (organization.phone) doc.text(`Tél: ${organization.phone}`);
    if (organization.email) doc.text(`Email: ${organization.email}`);
    if (organization.taxId) doc.text(`NIF: ${organization.taxId}`);

    // Vendor details (right)
    doc.fontSize(10).font('Helvetica-Bold').text('Fournisseur:', 320, startY);
    doc.font('Helvetica').fontSize(9);
    doc.text(vendor.legalName, 320, startY + 15);
    if (vendor.address) doc.text(vendor.address, 320);
    if (vendor.phone) doc.text(`Tél: ${vendor.phone}`, 320);
    if (vendor.email) doc.text(`Email: ${vendor.email}`, 320);

    doc.moveDown(3);

    // Order info
    const infoY = doc.y;
    doc.fontSize(9).font('Helvetica');
    doc.text(`Date d'émission: ${formatDate(po.issuedAt || po.createdAt)}`, 50, infoY);
    if (po.expectedDeliveryDate) {
      doc.text(`Livraison prévue: ${formatDate(po.expectedDeliveryDate)}`, 50, infoY + 15);
    }
    doc.text(`Statut: ${translateStatus(po.status)}`, 320, infoY);

    doc.moveDown(2);

    // Items table
    const tableTop = doc.y;
    const tableHeaders = ['Article', 'Description', 'Qté', 'P.U. (XOF)', 'Total (XOF)'];
    const colWidths = [120, 150, 60, 80, 85];
    const colPositions = [50, 170, 320, 380, 460];

    // Table header
    doc.fontSize(9).font('Helvetica-Bold');
    tableHeaders.forEach((header, i) => {
      doc.text(header, colPositions[i], tableTop, { width: colWidths[i], align: i >= 2 ? 'right' : 'left' });
    });

    // Header line
    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

    // Table rows
    doc.font('Helvetica').fontSize(8);
    let currentY = tableTop + 25;

    items.forEach((item) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      doc.text(item.itemName, colPositions[0], currentY, { width: colWidths[0] });
      doc.text(item.description || '-', colPositions[1], currentY, { width: colWidths[1] });
      doc.text(`${item.quantity} ${item.unit || 'pcs'}`, colPositions[2], currentY, { width: colWidths[2], align: 'right' });
      doc.text(formatCurrency(item.unitPrice), colPositions[3], currentY, { width: colWidths[3], align: 'right' });
      doc.text(formatCurrency(item.totalPrice), colPositions[4], currentY, { width: colWidths[4], align: 'right' });

      currentY += 20;
    });

    // Totals
    doc.moveTo(50, currentY).lineTo(545, currentY).stroke();
    currentY += 15;

    const subtotal = Number(po.totalAmount) - Number(po.taxAmount);
    doc.fontSize(9).font('Helvetica');
    doc.text('Sous-total:', 380, currentY);
    doc.text(formatCurrency(subtotal) + ' XOF', 460, currentY, { width: 85, align: 'right' });
    currentY += 15;

    doc.text('TVA (18%):', 380, currentY);
    doc.text(formatCurrency(po.taxAmount) + ' XOF', 460, currentY, { width: 85, align: 'right' });
    currentY += 15;

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('TOTAL:', 380, currentY);
    doc.text(formatCurrency(po.totalAmount) + ' XOF', 460, currentY, { width: 85, align: 'right' });

    // Notes
    if (po.notes) {
      doc.moveDown(2);
      doc.fontSize(9).font('Helvetica-Bold').text('Notes:');
      doc.font('Helvetica').fontSize(8).text(po.notes, { width: 495 });
    }

    // Footer
    doc.fontSize(7).font('Helvetica').text(
      'Ce document est généré électroniquement et ne nécessite pas de signature.',
      50,
      750,
      { align: 'center', width: 495 }
    );

    doc.end();
  });
}

export async function generateInvoicePDF(
  invoice: Invoice,
  items: InvoiceItem[],
  organization: Organization,
  vendor: Vendor
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('FACTURE', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(invoice.invoiceNumber, { align: 'center' });
    doc.moveDown(1.5);

    // Organization details (left)
    const startY = doc.y;
    doc.fontSize(10).font('Helvetica-Bold').text('Client:', 50, startY);
    doc.font('Helvetica').fontSize(9);
    doc.text(organization.name, 50, doc.y + 5);
    if (organization.address) doc.text(organization.address);
    if (organization.phone) doc.text(`Tél: ${organization.phone}`);
    if (organization.email) doc.text(`Email: ${organization.email}`);
    if (organization.taxId) doc.text(`NIF: ${organization.taxId}`);

    // Vendor details (right)
    doc.fontSize(10).font('Helvetica-Bold').text('Fournisseur:', 320, startY);
    doc.font('Helvetica').fontSize(9);
    doc.text(vendor.legalName, 320, startY + 15);
    if (vendor.address) doc.text(vendor.address, 320);
    if (vendor.phone) doc.text(`Tél: ${vendor.phone}`, 320);
    if (vendor.email) doc.text(`Email: ${vendor.email}`, 320);

    doc.moveDown(3);

    // Invoice info
    const infoY = doc.y;
    doc.fontSize(9).font('Helvetica');
    doc.text(`Date de facture: ${formatDate(invoice.invoiceDate)}`, 50, infoY);
    if (invoice.dueDate) {
      doc.text(`Date d'échéance: ${formatDate(invoice.dueDate)}`, 50, infoY + 15);
    }
    doc.text(`Statut: ${translateInvoiceStatus(invoice.status)}`, 320, infoY);

    doc.moveDown(2);

    // Items table
    const tableTop = doc.y;
    const tableHeaders = ['Description', 'Quantité', 'P.U. (XOF)', 'Montant (XOF)'];
    const colWidths = [250, 80, 100, 110];
    const colPositions = [50, 300, 380, 480];

    // Table header
    doc.fontSize(9).font('Helvetica-Bold');
    tableHeaders.forEach((header, i) => {
      doc.text(header, colPositions[i], tableTop, { width: colWidths[i], align: i >= 1 ? 'right' : 'left' });
    });

    // Header line
    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

    // Table rows
    doc.font('Helvetica').fontSize(8);
    let currentY = tableTop + 25;

    items.forEach((item) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      doc.text(item.description, colPositions[0], currentY, { width: colWidths[0] });
      doc.text(item.quantity.toString(), colPositions[1], currentY, { width: colWidths[1], align: 'right' });
      doc.text(formatCurrency(item.unitPrice), colPositions[2], currentY, { width: colWidths[2], align: 'right' });
      doc.text(formatCurrency(item.amount), colPositions[3], currentY, { width: colWidths[3], align: 'right' });

      currentY += 20;
    });

    // Totals
    doc.moveTo(50, currentY).lineTo(545, currentY).stroke();
    currentY += 15;

    const subtotal = Number(invoice.totalAmount) - Number(invoice.taxAmount);
    doc.fontSize(9).font('Helvetica');
    doc.text('Sous-total:', 380, currentY);
    doc.text(formatCurrency(subtotal) + ' XOF', 480, currentY, { width: 110, align: 'right' });
    currentY += 15;

    doc.text('TVA (18%):', 380, currentY);
    doc.text(formatCurrency(invoice.taxAmount) + ' XOF', 480, currentY, { width: 110, align: 'right' });
    currentY += 15;

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('TOTAL À PAYER:', 380, currentY);
    doc.text(formatCurrency(invoice.totalAmount) + ' XOF', 480, currentY, { width: 110, align: 'right' });

    // Notes
    if (invoice.notes) {
      doc.moveDown(2);
      doc.fontSize(9).font('Helvetica-Bold').text('Notes:');
      doc.font('Helvetica').fontSize(8).text(invoice.notes, { width: 495 });
    }

    // Footer
    doc.fontSize(7).font('Helvetica').text(
      'Merci pour votre confiance. Paiement à effectuer selon les modalités convenues.',
      50,
      750,
      { align: 'center', width: 495 }
    );

    doc.end();
  });
}

function formatCurrency(amount: string | number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function translateStatus(status: string): string {
  const translations: Record<string, string> = {
    draft: 'Brouillon',
    issued: 'Émis',
    confirmed: 'Confirmé',
    partially_received: 'Partiellement reçu',
    received: 'Reçu',
    closed: 'Clôturé',
    cancelled: 'Annulé',
  };
  return translations[status] || status;
}

function translateInvoiceStatus(status: string): string {
  const translations: Record<string, string> = {
    draft: 'Brouillon',
    pending: 'En attente',
    approved: 'Approuvée',
    paid: 'Payée',
    rejected: 'Rejetée',
    cancelled: 'Annulée',
  };
  return translations[status] || status;
}
