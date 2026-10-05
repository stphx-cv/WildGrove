// Wild Grove | Billing document PDF template (Boleta / Factura)
// Uses @react-pdf/renderer. Intended for server-side rendering only.

import React from "react"
import fs from "node:fs"
import path from "path"
import { fileURLToPath } from "node:url"
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer"
import {
  getOrderDocumentCopy,
  normalizeOrderPdfLocale,
  type OrderPdfLocale,
} from "./orderDocumentCopy"

// ── Brand colors ─────────────────────────────────────────────────
const C = {
  green: "#3A5A40",
  greenLight: "#4A6D50",
  gold: "#A26A31",
  // Behind small white text the lighter amber falls under 4.5:1.
  goldDark: "#885624",
  bg: "#F3F6F0",
  text: "#1A1A18",
  muted: "#566650",
  border: "#CDD4C7",
  white: "#FFFFFF",
}

// ── Register fonts (local TTF files | no external network call) ──
// Both apps render this document, so the fonts live next to it in
// @wildgrove/core and are found the way emails/loadTemplate.ts finds the
// email templates: next to this module first, then from the app's directory
// or the repo root. Both apps copy them into their build through
// `outputFileTracingIncludes`.
function fontsDirCandidates(): string[] {
  const dirs: string[] = []
  try {
    dirs.push(path.join(path.dirname(fileURLToPath(import.meta.url)), "fonts"))
  } catch {
    // bundled without import.meta — fall through to the cwd candidates
  }
  const cwd = process.cwd()
  dirs.push(path.join(cwd, "..", "packages", "core", "pdf", "fonts"))
  dirs.push(path.join(cwd, "packages", "core", "pdf", "fonts"))
  return dirs
}

// When none exists, rendering fails naming the first candidate.
const fontsDir =
  fontsDirCandidates().find((dir) => fs.existsSync(path.join(dir, "DMSans-Variable.ttf"))) ??
  fontsDirCandidates()[0]

Font.register({
  family: "Playfair Display",
  fonts: [
    {
      src: path.join(fontsDir, "PlayfairDisplay-Variable.ttf"),
      fontWeight: 700,
    },
  ],
})

Font.register({
  family: "DM Sans",
  fonts: [
    {
      src: path.join(fontsDir, "DMSans-Variable.ttf"),
      fontWeight: 400,
    },
    {
      src: path.join(fontsDir, "DMSans-Variable.ttf"),
      fontWeight: 600,
    },
  ],
})

// ── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: "DM Sans",
    fontSize: 9,
    color: C.text,
    backgroundColor: C.white,
    paddingTop: 0,
    paddingBottom: 32,
    paddingHorizontal: 0,
  },
  // Header band
  headerBand: {
    backgroundColor: C.green,
    paddingVertical: 20,
    paddingHorizontal: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandName: {
    fontFamily: "Playfair Display",
    fontSize: 22,
    color: C.white,
    fontWeight: 700,
  },
  brandTagline: {
    fontSize: 8,
    color: "#A8C4AC",
    marginTop: 2,
  },
  docTypeBadge: {
    backgroundColor: C.goldDark,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
    alignItems: "center",
  },
  docTypeText: {
    color: C.white,
    fontSize: 9,
    fontWeight: 600,
  },
  docNumberText: {
    color: C.white,
    fontSize: 7,
    marginTop: 2,
    opacity: 0.85,
  },
  // Body
  body: {
    paddingHorizontal: 36,
    paddingTop: 20,
  },
  // Two-column info section
  infoRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  infoBox: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: 4,
    padding: 10,
  },
  infoBoxTitle: {
    fontSize: 7,
    fontWeight: 600,
    color: C.muted,
    textTransform: "uppercase",
    marginBottom: 6,
    letterSpacing: 0.8,
  },
  infoLine: {
    fontSize: 8.5,
    color: C.text,
    marginBottom: 2,
  },
  infoMuted: {
    fontSize: 8,
    color: C.muted,
    marginBottom: 2,
  },
  // Section heading
  sectionTitle: {
    fontSize: 7.5,
    fontWeight: 600,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  // Items table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.green,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  tableHeaderCell: {
    color: C.white,
    fontSize: 8,
    fontWeight: 600,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  tableRowAlt: {
    backgroundColor: C.bg,
  },
  tableCell: {
    fontSize: 8.5,
    color: C.text,
  },
  colName: { flex: 3 },
  colQty: { flex: 1, textAlign: "center" },
  colUnit: { flex: 1.75, textAlign: "right" },
  colTotal: { flex: 1.75, textAlign: "right" },
  colPriceStack: {
    flex: 1.75,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  priceOriginal: {
    fontSize: 7.5,
    color: C.muted,
    textDecoration: "line-through",
    marginBottom: 1,
  },
  priceDiscounted: {
    fontSize: 8.5,
    color: C.text,
    fontWeight: 600,
  },
  // Totals block
  totalsSection: {
    marginTop: 12,
    alignItems: "flex-end",
  },
  totalsBox: {
    width: 220,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalsLabel: {
    fontSize: 8.5,
    color: C.muted,
  },
  totalsValue: {
    fontSize: 8.5,
    color: C.text,
  },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    marginVertical: 4,
  },
  totalFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    backgroundColor: C.green,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  totalFinalLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: C.white,
  },
  totalFinalValue: {
    fontSize: 10,
    fontWeight: 600,
    color: C.white,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 16,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: C.muted,
  },
})

/** ~80 mm roll / ticket width (points), A4 height for imprimir en tira vertical. */
const BOLETA_PAGE_WIDTH_PT = (80 * 72) / 25.4
const BOLETA_PAGE_HEIGHT_PT = 841.89

// ── Boleta (ticket vertical, simple) ─────────────────────────────
const b = StyleSheet.create({
  page: {
    fontFamily: "DM Sans",
    fontSize: 8,
    color: C.text,
    backgroundColor: C.white,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 14,
  },
  center: {
    textAlign: "center",
  },
  brand: {
    fontFamily: "Playfair Display",
    fontSize: 15,
    fontWeight: 700,
    color: C.green,
    textAlign: "center",
  },
  tagline: {
    fontSize: 6.5,
    color: C.muted,
    textAlign: "center",
    marginTop: 2,
  },
  docPill: {
    alignSelf: "center",
    backgroundColor: C.goldDark,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 3,
    marginTop: 8,
  },
  docPillText: {
    color: C.white,
    fontSize: 7,
    fontWeight: 600,
    textAlign: "center",
  },
  docNumber: {
    textAlign: "center",
    fontSize: 9,
    fontWeight: 600,
    color: C.text,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  rule: {
    borderBottomWidth: 0.75,
    borderBottomColor: C.border,
    borderStyle: "dashed",
    marginVertical: 10,
  },
  ruleSolid: {
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    marginVertical: 8,
  },
  blockTitle: {
    fontSize: 6.5,
    fontWeight: 600,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  line: {
    fontSize: 7.5,
    color: C.text,
    marginBottom: 2,
  },
  lineMuted: {
    fontSize: 7,
    color: C.muted,
    marginBottom: 2,
  },
  sectionLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: C.green,
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
    gap: 6,
  },
  itemLeft: {
    flex: 1,
    flexShrink: 1,
  },
  itemQtyName: {
    fontSize: 7.5,
    color: C.text,
  },
  itemNotes: {
    fontSize: 6.5,
    color: C.muted,
    marginTop: 1,
  },
  itemRight: {
    fontSize: 7.5,
    fontWeight: 600,
    color: C.text,
    textAlign: "right",
    minWidth: 52,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalsLabel: {
    fontSize: 7.5,
    color: C.muted,
  },
  totalsValue: {
    fontSize: 7.5,
    color: C.text,
  },
  totalBig: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: C.green,
    borderRadius: 3,
  },
  totalBigLabel: {
    fontSize: 9,
    fontWeight: 600,
    color: C.white,
  },
  totalBigValue: {
    fontSize: 11,
    fontWeight: 600,
    color: C.white,
  },
  thanks: {
    fontSize: 7,
    color: C.muted,
    textAlign: "center",
    marginTop: 10,
  },
  footId: {
    fontSize: 6,
    color: C.muted,
    textAlign: "center",
    marginTop: 6,
  },
})

// ── Types ─────────────────────────────────────────────────────────

export interface OrderDocumentData {
  /** UI language for labels (Boleta / Factura). */
  locale: OrderPdfLocale
  // Order info
  orderId: string
  orderNumber: number
  createdAt: string          // ISO string
  currency: string           // "PEN" | "USD"
  subtotal: string
  discountTotal: string
  deliveryFee: string
  total: string
  fulfillment: "PICKUP" | "DELIVERY"
  deliveryAddress?: string | null
  // Document
  documentType: "BOLETA" | "FACTURA"
  documentSeries: string
  documentNumber: string
  buyerDni?: string | null
  fiscalRuc?: string | null
  fiscalLegalName?: string | null
  fiscalAddress?: string | null
  // Customer
  customerName?: string | null
  // Items
  items: Array<{
    nameSnapshot: string
    quantity: number
    /** Catalog / list unit price before automatic discount (optional for legacy rows). */
    listUnitPrice?: string | null
    unitPrice: string
    lineTotal: string
    notes?: string | null
  }>
  // Restaurant (from AppSettings)
  restaurant: {
    legalName: string
    ruc: string
    fiscalAddress: string
    igvRate: number         // e.g. 18
  }
}

// ── Helper ────────────────────────────────────────────────────────

function currencySymbol(currency: string) {
  return currency === "USD" ? "$" : "S/"
}

function fmt(value: string, currency: string) {
  const sym = currencySymbol(currency)
  return `${sym} ${parseFloat(value).toFixed(2)}`
}

/** True when we have a list price snapshot and it is higher than the charged unit price. */
function showListVersusPaid(listUnitPrice: string | null | undefined, unitPrice: string) {
  if (listUnitPrice == null || listUnitPrice === "") return false
  const list = parseFloat(listUnitPrice)
  const paid = parseFloat(unitPrice)
  if (Number.isNaN(list) || Number.isNaN(paid)) return false
  return list > paid + 0.000001
}

// ── Component ─────────────────────────────────────────────────────

export function OrderDocument({ data }: { data: OrderDocumentData }) {
  const sym = currencySymbol(data.currency)
  const locale = normalizeOrderPdfLocale(data.locale)
  const copy = getOrderDocumentCopy(locale)
  const isFactura = data.documentType === "FACTURA"
  const docLabel = isFactura ? copy.docFactura : copy.docBoleta
  const docCode = `${data.documentSeries}-${data.documentNumber}`
  const dateLocale = locale === "es" ? "es-PE" : "en-GB"
  const date = new Date(data.createdAt).toLocaleDateString(dateLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  const discount = parseFloat(data.discountTotal)
  const deliveryFee = parseFloat(data.deliveryFee)
  const total = parseFloat(data.total)
  const igvRate = data.restaurant.igvRate / 100
  // Total (subtotal − descuento + delivery) is IGV-inclusive | derive base + IGV for both Boleta and Factura
  const igvAmount = total * igvRate / (1 + igvRate)
  const baseAmount = total - igvAmount

  const docTitle = `Wild Grove | ${docLabel} ${docCode}`

  // ── Boleta: tira vertical estrecha (tipo ticket), distinta a la factura A4 ──
  if (!isFactura) {
    return (
      <Document title={docTitle} author="Wild Grove">
        <Page
          size={[BOLETA_PAGE_WIDTH_PT, BOLETA_PAGE_HEIGHT_PT]}
          style={b.page}
          wrap
        >
          <Text style={b.brand}>Wild Grove</Text>
          <Text style={b.tagline}>{copy.tagline}</Text>
          <View style={b.docPill}>
            <Text style={b.docPillText}>{copy.docBoleta}</Text>
          </View>
          <Text style={b.docNumber}>{docCode}</Text>
          <Text style={[b.lineMuted, b.center, { marginTop: 4 }]}>{date}</Text>

          <View style={b.rule} />

          <Text style={b.blockTitle}>{copy.issuer}</Text>
          <Text style={[b.line, b.center]}>
            {data.restaurant.legalName || copy.defaultLegalName}
          </Text>
          {data.restaurant.ruc ? (
            <Text style={[b.lineMuted, b.center]}>RUC {data.restaurant.ruc}</Text>
          ) : null}
          {data.restaurant.fiscalAddress ? (
            <Text style={[b.lineMuted, b.center]}>{data.restaurant.fiscalAddress}</Text>
          ) : null}

          <View style={b.ruleSolid} />

          <Text style={b.blockTitle}>{copy.customer}</Text>
          {data.customerName ? (
            <Text style={b.line}>{data.customerName}</Text>
          ) : null}
          {data.buyerDni ? (
            <Text style={b.lineMuted}>DNI {data.buyerDni}</Text>
          ) : null}

          <View style={b.ruleSolid} />

          <Text style={b.blockTitle}>{copy.order}</Text>
          <Text style={b.line}>#{data.orderNumber}</Text>
          <Text style={b.lineMuted}>
            {data.fulfillment === "PICKUP" ? copy.pickup : copy.delivery}
          </Text>
          {data.deliveryAddress ? (
            <Text style={b.lineMuted}>{data.deliveryAddress}</Text>
          ) : null}

          <View style={b.rule} />

          <Text style={b.sectionLabel}>{copy.detail}</Text>
          {data.items.map((item, i) => {
            const paidUnit = parseFloat(item.unitPrice)
            const paidLine = parseFloat(item.lineTotal)
            const showOriginal = showListVersusPaid(item.listUnitPrice, item.unitPrice)
            const listLineAmount =
              showOriginal && item.listUnitPrice
                ? parseFloat(item.listUnitPrice) * item.quantity
                : 0

            return (
              <View key={i} style={b.itemRow} wrap={false}>
                <View style={b.itemLeft}>
                  <Text style={b.itemQtyName}>
                    {item.quantity} × {item.nameSnapshot}
                  </Text>
                  {item.notes ? (
                    <Text style={b.itemNotes}>{item.notes}</Text>
                  ) : null}
                  {showOriginal ? (
                    <Text style={b.itemNotes}>
                      {copy.listUnitRef(
                        sym,
                        parseFloat(item.listUnitPrice ?? "0").toFixed(2),
                        paidUnit.toFixed(2)
                      )}
                    </Text>
                  ) : null}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  {showOriginal ? (
                    <Text
                      style={{
                        fontSize: 6.5,
                        color: C.muted,
                        textDecoration: "line-through",
                        marginBottom: 1,
                      }}
                    >
                      {sym} {listLineAmount.toFixed(2)}
                    </Text>
                  ) : null}
                  <Text style={b.itemRight}>{sym} {paidLine.toFixed(2)}</Text>
                </View>
              </View>
            )
          })}

          <View style={b.ruleSolid} />

          <View style={b.totalsRow}>
            <Text style={b.totalsLabel}>{copy.subtotal}</Text>
            <Text style={b.totalsValue}>{fmt(data.subtotal, data.currency)}</Text>
          </View>
          {discount > 0 ? (
            <View style={b.totalsRow}>
              <Text style={b.totalsLabel}>{copy.discount}</Text>
              <Text style={[b.totalsValue, { color: C.gold }]}>
                − {fmt(data.discountTotal, data.currency)}
              </Text>
            </View>
          ) : null}
          {deliveryFee > 0 ? (
            <View style={b.totalsRow}>
              <Text style={b.totalsLabel}>{copy.deliveryFee}</Text>
              <Text style={b.totalsValue}>{fmt(data.deliveryFee, data.currency)}</Text>
            </View>
          ) : null}

          <View style={b.ruleSolid} />

          <View style={b.totalsRow}>
            <Text style={b.totalsLabel}>{copy.taxableBase}</Text>
            <Text style={b.totalsValue}>
              {sym} {baseAmount.toFixed(2)}
            </Text>
          </View>
          <View style={b.totalsRow}>
            <Text style={b.totalsLabel}>{copy.igvLabel(data.restaurant.igvRate)}</Text>
            <Text style={b.totalsValue}>
              {sym} {igvAmount.toFixed(2)}
            </Text>
          </View>

          <View style={b.totalBig}>
            <Text style={b.totalBigLabel}>{copy.totalDue}</Text>
            <Text style={b.totalBigValue}>{fmt(data.total, data.currency)}</Text>
          </View>

          <Text style={b.thanks}>{copy.thanks}</Text>
          <Text style={b.footId}>
            {copy.footerDocLine(docLabel, docCode, data.orderNumber)}
          </Text>
        </Page>
      </Document>
    )
  }

  // ── Factura: formato formal A4 (sin cambios de estructura) ──
  return (
    <Document title={docTitle} author="Wild Grove">
      <Page size="A4" style={s.page}>
        {/* ── Header ─────────────────────── */}
        <View style={s.headerBand}>
          <View>
            <Text style={s.brandName}>Wild Grove</Text>
            <Text style={s.brandTagline}>{copy.tagline}</Text>
          </View>
          <View style={s.docTypeBadge}>
            <Text style={s.docTypeText}>{docLabel}</Text>
            <Text style={s.docNumberText}>{docCode}</Text>
          </View>
        </View>

        <View style={s.body}>
          {/* ── Info columns ───────────────── */}
          <View style={s.infoRow}>
            {/* Restaurant */}
            <View style={s.infoBox}>
              <Text style={s.infoBoxTitle}>{copy.issuer}</Text>
              <Text style={s.infoLine}>{data.restaurant.legalName || copy.defaultLegalName}</Text>
              {data.restaurant.ruc ? (
                <Text style={s.infoMuted}>RUC: {data.restaurant.ruc}</Text>
              ) : null}
              {data.restaurant.fiscalAddress ? (
                <Text style={s.infoMuted}>{data.restaurant.fiscalAddress}</Text>
              ) : null}
            </View>

            {/* Customer */}
            <View style={s.infoBox}>
              <Text style={s.infoBoxTitle}>{copy.customerInvoice}</Text>
              {data.fiscalRuc ? (
                <Text style={s.infoMuted}>RUC: {data.fiscalRuc}</Text>
              ) : null}
              {data.fiscalLegalName ? (
                <Text style={s.infoMuted}>{data.fiscalLegalName}</Text>
              ) : null}
              {data.fiscalAddress ? (
                <Text style={s.infoMuted}>{data.fiscalAddress}</Text>
              ) : null}
            </View>

            {/* Order meta */}
            <View style={s.infoBox}>
              <Text style={s.infoBoxTitle}>{copy.order}</Text>
              <Text style={s.infoLine}>#{data.orderNumber}</Text>
              <Text style={s.infoMuted}>{copy.datePrefix(date)}</Text>
              <Text style={s.infoMuted}>
                {data.fulfillment === "PICKUP" ? copy.pickup : copy.delivery}
              </Text>
              {data.deliveryAddress ? (
                <Text style={s.infoMuted}>{data.deliveryAddress}</Text>
              ) : null}
            </View>
          </View>

          {/* ── Items table ────────────────── */}
          <Text style={s.sectionTitle}>{copy.productsSection}</Text>

          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderCell, s.colName]}>{copy.tableDescription}</Text>
            <Text style={[s.tableHeaderCell, s.colQty]}>{copy.tableQty}</Text>
            <Text style={[s.tableHeaderCell, s.colUnit]}>{copy.tableUnit}</Text>
            <Text style={[s.tableHeaderCell, s.colTotal]}>{copy.tableLineTotal}</Text>
          </View>

          {data.items.map((item, i) => {
            const paidUnit = parseFloat(item.unitPrice)
            const paidLine = parseFloat(item.lineTotal)
            const showOriginal = showListVersusPaid(item.listUnitPrice, item.unitPrice)
            const listLineAmount =
              showOriginal && item.listUnitPrice
                ? parseFloat(item.listUnitPrice) * item.quantity
                : 0

            return (
              <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
                <View style={s.colName}>
                  <Text style={s.tableCell}>{item.nameSnapshot}</Text>
                  {item.notes ? (
                    <Text style={[s.tableCell, { color: C.muted, fontSize: 7.5 }]}>
                      {item.notes}
                    </Text>
                  ) : null}
                </View>
                <Text style={[s.tableCell, s.colQty]}>{item.quantity}</Text>
                {showOriginal ? (
                  <View style={s.colPriceStack}>
                    <Text style={s.priceOriginal}>
                      {sym} {parseFloat(item.listUnitPrice ?? "0").toFixed(2)}
                    </Text>
                    <Text style={s.priceDiscounted}>
                      {sym} {paidUnit.toFixed(2)}
                    </Text>
                  </View>
                ) : (
                  <Text style={[s.tableCell, s.colUnit]}>
                    {sym} {paidUnit.toFixed(2)}
                  </Text>
                )}
                {showOriginal ? (
                  <View style={s.colPriceStack}>
                    <Text style={s.priceOriginal}>
                      {sym} {listLineAmount.toFixed(2)}
                    </Text>
                    <Text style={s.priceDiscounted}>
                      {sym} {paidLine.toFixed(2)}
                    </Text>
                  </View>
                ) : (
                  <Text style={[s.tableCell, s.colTotal]}>
                    {sym} {paidLine.toFixed(2)}
                  </Text>
                )}
              </View>
            )
          })}

          {/* ── Totals ─────────────────────── */}
          <View style={s.totalsSection}>
            <View style={s.totalsBox}>
              <View style={s.totalsRow}>
                <Text style={s.totalsLabel}>{copy.subtotal}</Text>
                <Text style={s.totalsValue}>{fmt(data.subtotal, data.currency)}</Text>
              </View>
              {discount > 0 && (
                <View style={s.totalsRow}>
                  <Text style={s.totalsLabel}>{copy.discount}</Text>
                  <Text style={[s.totalsValue, { color: C.gold }]}>
                    − {fmt(data.discountTotal, data.currency)}
                  </Text>
                </View>
              )}
              {deliveryFee > 0 && (
                <View style={s.totalsRow}>
                  <Text style={s.totalsLabel}>{copy.deliveryFee}</Text>
                  <Text style={s.totalsValue}>{fmt(data.deliveryFee, data.currency)}</Text>
                </View>
              )}
              <View style={s.divider} />
              <View style={s.totalsRow}>
                <Text style={s.totalsLabel}>{copy.taxableBase}</Text>
                <Text style={s.totalsValue}>
                  {sym} {baseAmount.toFixed(2)}
                </Text>
              </View>
              <View style={s.totalsRow}>
                <Text style={s.totalsLabel}>
                  {copy.igvLabel(data.restaurant.igvRate)}
                </Text>
                <Text style={s.totalsValue}>
                  {sym} {igvAmount.toFixed(2)}
                </Text>
              </View>
              <View style={s.totalFinalRow}>
                <Text style={s.totalFinalLabel}>{copy.total}</Text>
                <Text style={s.totalFinalValue}>{fmt(data.total, data.currency)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Footer ─────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Wild Grove | {copy.tagline}</Text>
          <Text style={s.footerText}>{docLabel} · {docCode}</Text>
        </View>
      </Page>
    </Document>
  )
}
