"use client"

// ══════════════════════════════════════════════════════════════════
// ChatReservationFlow — Step-by-step inline reservation form
// Replaces the ChatInput area while a reservation is being collected.
// Steps: date → time → guests → notes_prompt → notes_input
// ══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useMemo } from "react"
import type { ClosedTimeRange } from "@wildgrove/core/reservation-schedule"
import {
    generateTimeSlots,
    getWeekdayFromDate,
    isOpenDay,
    parseClosedTimeRanges,
    parseOperatingDays,
} from "@wildgrove/core/reservation-schedule"
import { limaEarliestBookableDateIso, limaMaxBookableDateIso } from "@wildgrove/core/reservation-dates-lima"
import { formatWallClockSlotLabel, normalizeTimeFormatPreference } from "@wildgrove/core/app-datetime-format"
import { TimePicker12hSlotLabel } from "@/components/forms/TimePicker"
import {
    CalendarIcon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronUpIcon,
    ClockIcon,
    CloseReversedIcon,
    GuestsIcon,
    MinusIcon,
    PlusIcon,
    SpinnerArrowsIcon,
} from "@wildgrove/ui/icons"
import { Textarea } from "@wildgrove/ui/Textarea"

const DRAFT_KEY = "wg_reservation_draft"
const DEFAULT_OPERATING_DAYS = [1, 2, 3, 4, 5, 6, 7]

function readDraft(sessionKey: string | null): Record<string, unknown> {
  try {
    const storedKey = sessionStorage.getItem("wg_flow_session_key")
    // If the stored draft belongs to a different chat session, ignore it
    if (sessionKey && storedKey && storedKey !== sessionKey) return {}
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null") ?? {}
  } catch { return {} }
}

export interface ReservationFlowData {
  date: string    // YYYY-MM-DD
  time: string    // HH:MM
  guests: number
  notes: string
}

type Step = "date" | "time" | "guests" | "notes_prompt" | "notes_input"

interface ChatReservationFlowProps {
  onSubmit: (data: ReservationFlowData) => Promise<void>
  onCancel: () => void
  isSubmitting: boolean
  locale: string
  sessionKey: string | null
}

export function ChatReservationFlow({
  onSubmit,
  onCancel,
  isSubmitting,
  locale,
  sessionKey,
}: ChatReservationFlowProps) {
  const [step, setStep] = useState<Step>(() => (readDraft(sessionKey).step as Step) ?? "date")
  const [date, setDate] = useState<string>(() => (readDraft(sessionKey).date as string) ?? "")
  const [time, setTime] = useState<string>(() => (readDraft(sessionKey).time as string) ?? "")
  const [notesText, setNotesText] = useState<string>(() => (readDraft(sessionKey).notesText as string) ?? "")
  const [collapsed, setCollapsed] = useState<boolean>(() => (readDraft(sessionKey).collapsed as boolean) ?? false)
  const [confirmingExit, setConfirmingExit] = useState(false)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const [advanceNoticeMs, setAdvanceNoticeMs] = useState(2 * 60 * 60 * 1000)
  const [maxGuests, setMaxGuests] = useState(40)
  const [timeSlotIncrement, setTimeSlotIncrement] = useState(30)
  const [openingTime, setOpeningTime] = useState("09:00")
  const [closingTime, setClosingTime] = useState("22:00")
  const [enabledWeekdays, setEnabledWeekdays] = useState<number[]>(DEFAULT_OPERATING_DAYS)
  const [maxDaysAhead, setMaxDaysAhead] = useState(30)
  const [closedBreaks, setClosedBreaks] = useState<ClosedTimeRange[]>([])
  const [displayTimeFormat, setDisplayTimeFormat] = useState<"12h" | "24h">("24h")
  const [nowMs] = useState<number>(() => new Date().getTime())
  const [guests, setGuests] = useState<number>(() => {
    const draftGuests = (readDraft(sessionKey).guests as number) ?? 2
    return Math.min(Math.max(draftGuests, 1), 40)
  })

  const isSpa = locale === "es"

  // Lima-local "today" string for date restrictions
  const todayStr = useMemo(
    () => new Date(nowMs).toLocaleDateString("en-CA", { timeZone: "America/Lima" }),
    [nowMs]
  )
  // Minimum selectable date based on advance notice
  const minDateStr = useMemo(
    () => limaEarliestBookableDateIso(advanceNoticeMs, nowMs),
    [nowMs, advanceNoticeMs]
  )

  const maxDateStr = useMemo(() => limaMaxBookableDateIso(maxDaysAhead), [maxDaysAhead])

  // Fetch advance notice setting from public config endpoint
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.advanceReservationMs === "number") {
          setAdvanceNoticeMs(d.advanceReservationMs)
        }
        if (typeof d.maxPartySize === "number" && Number.isFinite(d.maxPartySize)) {
          const normalizedMaxGuests = Math.min(Math.max(Math.floor(d.maxPartySize), 1), 50)
          setMaxGuests(normalizedMaxGuests)
          setGuests((current) => Math.min(Math.max(current, 1), normalizedMaxGuests))
        }
        if (typeof d.timeSlotIncrement === "number" && Number.isFinite(d.timeSlotIncrement)) {
          setTimeSlotIncrement(d.timeSlotIncrement)
        }
        if (typeof d.openingTime === "string") {
          setOpeningTime(d.openingTime)
        }
        if (typeof d.closingTime === "string") {
          setClosingTime(d.closingTime)
        }
        if (typeof d.operatingDays === "string") {
          const parsedDays = parseOperatingDays(d.operatingDays)
          if (parsedDays.length > 0) {
            setEnabledWeekdays(parsedDays)
          }
        }
        if (typeof d.maxDaysAhead === "number" && Number.isFinite(d.maxDaysAhead)) {
          const nextMax = Math.min(Math.max(Math.floor(d.maxDaysAhead), 1), 365)
          setMaxDaysAhead(nextMax)
        }
        if (d.closedTimeRanges !== undefined) {
          setClosedBreaks(parseClosedTimeRanges(d.closedTimeRanges))
        }
        if (typeof d.timeFormat === "string") {
          setDisplayTimeFormat(normalizeTimeFormatPreference(d.timeFormat))
        }
      })
      .catch(() => {}) // silently fall back to 2h default
  }, [])

  useEffect(() => {
    if (!date || date <= maxDateStr) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- narrow max window from /api/config can invalidate a persisted draft date
    setDate("")
    setTime("")
    setStep("date")
  }, [date, maxDateStr])

  // Persist form state to sessionStorage so it survives page refreshes
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step, date, time, guests, notesText, collapsed }))
    } catch {}
  }, [step, date, time, guests, notesText, collapsed])

  // Focus the notes textarea when that step is reached
  useEffect(() => {
    if (step === "notes_input") {
      const t = setTimeout(() => notesRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [step])

  // ── Step handlers ─────────────────────────────────────────────
  function handleDateSelect(d: string) {
    setDate(d)
    setTime("") // reset time if date changes
    setStep("time")
  }

  function handleTimeSelect(t: string) {
    setTime(t)
    setStep("guests")
  }

  function handleGuestsConfirm() {
    setStep("notes_prompt")
  }

  function handleNotesYes() {
    setStep("notes_input")
  }

  async function handleNotesNo() {
    await onSubmit({ date, time, guests, notes: "" })
  }

  async function handleNotesSend() {
    await onSubmit({ date, time, guests, notes: notesText.trim() })
  }

  function goBack() {
    if (step === "time") setStep("date")
    else if (step === "guests") setStep("time")
    else if (step === "notes_prompt") setStep("guests")
    else if (step === "notes_input") setStep("notes_prompt")
  }

  function requestExit() {
    const hasChoices = date !== "" || time !== "" || notesText.trim() !== ""
    if (!hasChoices) {
      onCancel()
      return
    }
    setCollapsed(false)
    setConfirmingExit(true)
  }

  // ── Formatting helpers ────────────────────────────────────────
  function fmtDate(d: string) {
    if (!d) return ""
    const [y, m, day] = d.split("-").map(Number)
    return new Date(y, m - 1, day).toLocaleDateString(
      isSpa ? "es-PE" : "en-US",
      { weekday: "short", month: "short", day: "numeric" }
    )
  }

  function fmtTime(t: string) {
    if (!t) return ""
    return formatWallClockSlotLabel(t, displayTimeFormat)
  }

  // ── Submitting state ──────────────────────────────────────────
  if (isSubmitting) {
    return (
      <div className="flex items-center justify-center gap-2.5 px-4 py-5 border-t border-wg-muted/20 dark:border-wg-dark-muted/20 bg-white dark:bg-wg-dark-bg">
        <SpinnerArrowsIcon className="w-4 h-4 animate-spin text-wg-primary dark:text-wg-secondary" />
        <span className="text-sm text-wg-muted dark:text-wg-dark-muted">
          {isSpa ? "Enviando tu solicitud…" : "Sending your request…"}
        </span>
      </div>
    )
  }

  const exitButton = (
    <button
      type="button"
      onClick={requestExit}
      className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-wg-muted/10 dark:hover:bg-wg-dark-muted/10 flex items-center justify-center text-wg-muted dark:text-wg-dark-muted transition-colors"
      aria-label={isSpa ? "Salir del formulario" : "Leave the form"}
    >
      <CloseReversedIcon className="w-3.5 h-3.5" strokeWidth={2} />
    </button>
  )

  // ── Leave the form: only after a date, a time or a note ──────
  if (confirmingExit) {
    return (
      <div className="border-t border-wg-muted/20 dark:border-wg-dark-muted/20 bg-white dark:bg-wg-dark-bg px-3 py-3 space-y-3">
        <p className="text-sm text-center text-wg-text dark:text-wg-dark-text">
          {isSpa
            ? "¿Sales del formulario? Lo que llevas elegido se pierde."
            : "Leave the form? What you've chosen will be lost."}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmingExit(false)}
            className="flex-1 py-2.5 rounded-xl border border-wg-border dark:border-wg-dark-border text-sm font-medium text-wg-text dark:text-wg-dark-text hover:bg-wg-surface dark:hover:bg-wg-dark-surface transition-colors"
          >
            {isSpa ? "Seguir reservando" : "Keep booking"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-wg-primary text-white text-sm font-medium hover:bg-wg-primary/90 transition-colors"
          >
            {isSpa ? "Salir" : "Leave"}
          </button>
        </div>
      </div>
    )
  }

  // ── Collapsed (minimized) state ───────────────────────────────
  if (collapsed) {
    return (
      <div className="border-t border-wg-muted/20 dark:border-wg-dark-muted/20 bg-white dark:bg-wg-dark-bg flex items-center">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex-1 min-w-0 flex items-center justify-between px-3 py-2.5 hover:bg-wg-surface/60 dark:hover:bg-wg-dark-surface/60 transition-colors group"
        >
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-[11px] font-semibold text-wg-primary dark:text-wg-secondary">
              {isSpa ? "Reserva en curso" : "Reservation in progress"}
            </span>
            {date && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-wg-primary/10 dark:bg-wg-primary/20 text-wg-primary dark:text-wg-secondary rounded-full px-2 py-0.5 font-medium">
                <CalendarIcon className="w-3 h-3" />
                {fmtDate(date)}
              </span>
            )}
            {time && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-wg-primary/10 dark:bg-wg-primary/20 text-wg-primary dark:text-wg-secondary rounded-full px-2 py-0.5 font-medium">
                <ClockIcon className="w-3 h-3" />
                {fmtTime(time)}
              </span>
            )}
          </div>
          <ChevronUpIcon
            className="w-4 h-4 text-wg-muted dark:text-wg-dark-muted group-hover:text-wg-primary dark:group-hover:text-wg-secondary transition-colors flex-shrink-0 ml-2"
            strokeWidth={2}
          />
        </button>
        <div className="pr-2">{exitButton}</div>
      </div>
    )
  }

  return (
    <div className="border-t border-wg-muted/20 dark:border-wg-dark-muted/20 bg-white dark:bg-wg-dark-bg">
      {/* ── Summary header ──────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-wg-muted/10 dark:border-wg-dark-muted/10 bg-wg-surface/60 dark:bg-wg-dark-surface/60">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Back button */}
          {step !== "date" && (
            <button
              onClick={goBack}
              className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-wg-muted/10 dark:hover:bg-wg-dark-muted/10 flex items-center justify-center text-wg-muted dark:text-wg-dark-muted transition-colors mr-0.5"
              aria-label={isSpa ? "Retroceder" : "Go back"}
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          )}
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {date && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-wg-primary/10 dark:bg-wg-primary/20 text-wg-primary dark:text-wg-secondary rounded-full px-2 py-0.5 font-medium">
                <CalendarIcon className="w-3 h-3" />
                {fmtDate(date)}
              </span>
            )}
            {time && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-wg-primary/10 dark:bg-wg-primary/20 text-wg-primary dark:text-wg-secondary rounded-full px-2 py-0.5 font-medium">
                <ClockIcon className="w-3 h-3" />
                {fmtTime(time)}
              </span>
            )}
            {step !== "date" && step !== "time" && step !== "guests" && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-wg-primary/10 dark:bg-wg-primary/20 text-wg-primary dark:text-wg-secondary rounded-full px-2 py-0.5 font-medium">
                <GuestsIcon className="w-3 h-3" />
                {guests} {isSpa ? (guests === 1 ? "persona" : "personas") : (guests === 1 ? "guest" : "guests")}
              </span>
            )}
            {!date && (
              <span className="text-[11px] text-wg-muted dark:text-wg-dark-muted">
                {isSpa ? "Nueva reserva" : "New reservation"}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-wg-muted/10 dark:hover:bg-wg-dark-muted/10 flex items-center justify-center text-wg-muted dark:text-wg-dark-muted transition-colors"
            aria-label={isSpa ? "Minimizar" : "Minimize"}
          >
            <ChevronDownIcon className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
          {exitButton}
        </div>
      </div>

      {/* ── Step content ────────────────────────────────────── */}
      <div className="px-3 py-3 max-h-72 overflow-y-auto [scrollbar-width:thin]">
        {step === "date" && (
          <CompactDatePicker
            todayStr={todayStr}
            minDateStr={minDateStr}
            maxDateStr={maxDateStr}
            enabledWeekdays={enabledWeekdays}
            value={date}
            onSelect={handleDateSelect}
            locale={locale}
          />
        )}

        {step === "time" && (
          <CompactTimePicker
            date={date}
            value={time}
            onSelect={handleTimeSelect}
            locale={locale}
            advanceNoticeMs={advanceNoticeMs}
            openingTime={openingTime}
            closingTime={closingTime}
            timeSlotIncrement={timeSlotIncrement}
            enabledWeekdays={enabledWeekdays}
            closedTimeRanges={closedBreaks}
            nowMs={nowMs}
            displayTimeFormat={displayTimeFormat}
          />
        )}

        {step === "guests" && (
          <CompactGuestsPicker
            value={guests}
            onChange={(next) => setGuests(Math.min(Math.max(next, 1), maxGuests))}
            onConfirm={handleGuestsConfirm}
            locale={locale}
            maxGuests={maxGuests}
          />
        )}

        {step === "notes_prompt" && (
          <div className="space-y-3 py-1">
            <p className="text-sm text-center text-wg-text dark:text-wg-dark-text">
              {isSpa
                ? "¿Quieres agregar un comentario opcional?"
                : "Would you like to add an optional note?"}
            </p>
            <p className="text-xs text-center text-wg-muted dark:text-wg-dark-muted -mt-1">
              {isSpa
                ? "(alergias, ocasión especial, etc.)"
                : "(allergies, special occasion, etc.)"}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleNotesYes}
                className="flex-1 py-2.5 rounded-xl border border-wg-border dark:border-wg-dark-border text-sm font-medium text-wg-text dark:text-wg-dark-text hover:bg-wg-surface dark:hover:bg-wg-dark-surface transition-colors"
              >
                {isSpa ? "Sí, agregar" : "Yes, add one"}
              </button>
              <button
                onClick={handleNotesNo}
                className="flex-1 py-2.5 rounded-xl bg-wg-primary text-white text-sm font-medium hover:bg-wg-primary/90 transition-colors"
              >
                {isSpa ? "No, reservar" : "No, book now"}
              </button>
            </div>
          </div>
        )}

        {step === "notes_input" && (
          <div className="space-y-2">
            <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
              {isSpa ? "Tu comentario (opcional):" : "Your note (optional):"}
            </p>
            <Textarea
              maxHeight={120}
              resizable={false}
              ref={notesRef}
              value={notesText}
              onChange={(v) => setNotesText(v.slice(0, 500))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleNotesSend()
                }
              }}
              placeholder={
                isSpa
                  ? "Ej: soy vegano, es nuestro aniversario…"
                  : "E.g. vegan diet, it's our anniversary…"
              }
              minRows={3}
              className="rounded-xl border border-wg-muted/30 dark:border-wg-dark-muted/30 bg-wg-surface/50 dark:bg-wg-dark-surface/50 px-3 py-2 text-sm text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted dark:placeholder:text-wg-dark-muted focus:outline-none focus:ring-2 focus:ring-wg-primary/30"
            />
            {notesText.length > 400 && (
              <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted text-right">
                {notesText.length}/500
              </p>
            )}
            <button
              onClick={handleNotesSend}
              className="w-full py-2.5 rounded-xl bg-wg-primary text-white text-sm font-medium hover:bg-wg-primary/90 transition-colors"
            >
              {isSpa ? "Enviar solicitud" : "Send request"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// CompactDatePicker — Inline calendar (no portal, no trigger button)
// ══════════════════════════════════════════════════════════════════

function CompactDatePicker({
  todayStr,
  minDateStr,
  maxDateStr,
  enabledWeekdays,
  value,
  onSelect,
  locale,
}: {
  todayStr: string
  minDateStr: string
  maxDateStr: string
  enabledWeekdays: number[]
  value: string
  onSelect: (d: string) => void
  locale: string
}) {
  const isSpa = locale === "es"
  const base = value || minDateStr

  const [viewYear, setViewYear] = useState(() => parseInt(base.split("-")[0]))
  const [viewMonth, setViewMonth] = useState(() => parseInt(base.split("-")[1]) - 1)

  const MONTHS = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(isSpa ? "es-PE" : "en-US", { month: "long" }).format(
      new Date(2024, i, 1)
    )
  )
  const DAYS = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 7 + i) // Jan 7, 2024 is a Sunday
    return new Intl.DateTimeFormat(isSpa ? "es-PE" : "en-US", { weekday: "narrow" }).format(d)
  })

  function getDaysInMonth(y: number, m: number) {
    return new Date(y, m + 1, 0).getDate()
  }
  function getFirstDay(y: number, m: number) {
    return new Date(y, m, 1).getDay()
  }
  function isDisabled(y: number, m: number, d: number) {
    const curIso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    if (curIso < minDateStr) return true
    if (curIso > maxDateStr) return true

    if (enabledWeekdays.length > 0) {
      const weekday = getWeekdayFromDate(curIso)
      if (weekday === null || !enabledWeekdays.includes(weekday)) return true
    }
    return false
  }
  function isSelected(y: number, m: number, d: number) {
    if (!value) return false
    const [vy, vm, vd] = value.split("-").map(Number)
    return vy === y && vm - 1 === m && vd === d
  }
  function isToday(y: number, m: number, d: number) {
    const [ty, tm, td] = todayStr.split("-").map(Number)
    return ty === y && tm - 1 === m && td === d
  }
  function selectDay(d: number) {
    const m = String(viewMonth + 1).padStart(2, "0")
    const day = String(d).padStart(2, "0")
    onSelect(`${viewYear}-${m}-${day}`)
  }
  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(v => v - 1) }
    else setViewMonth(v => v - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(v => v + 1) }
    else setViewMonth(v => v + 1)
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDay(viewYear, viewMonth)
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      <p className="text-[11px] font-semibold text-wg-muted dark:text-wg-dark-muted mb-2.5 text-center uppercase tracking-wide">
        {isSpa ? "¿Qué fecha prefieres?" : "Choose a date"}
      </p>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition text-wg-muted dark:text-wg-dark-muted"
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
        <span className="text-xs font-semibold text-wg-text dark:text-wg-dark-text capitalize select-none">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition text-wg-muted dark:text-wg-dark-muted"
        >
          <ChevronRightIcon className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {DAYS.map((d, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-medium text-wg-muted dark:text-wg-dark-muted py-0.5 select-none"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} />
          const disabled = isDisabled(viewYear, viewMonth, day)
          const selected = isSelected(viewYear, viewMonth, day)
          const today = isToday(viewYear, viewMonth, day)

          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => selectDay(day)}
              className={`
                relative w-8 h-8 mx-auto flex items-center justify-center text-xs rounded-full transition select-none
                ${selected
                  ? "bg-wg-accent text-white font-semibold"
                  : disabled
                    ? "text-wg-muted/30 dark:text-wg-dark-muted/30 cursor-not-allowed"
                    : today
                      ? "text-wg-accent dark:text-wg-dark-accent font-semibold hover:bg-wg-bg dark:hover:bg-wg-dark-raised"
                      : "text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised"
                }
              `}
            >
              {day}
              {today && !selected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-wg-accent dark:bg-wg-dark-accent" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// CompactTimePicker — Inline lunch/dinner slot grid
// ══════════════════════════════════════════════════════════════════

function CompactTimePicker({
  date,
  value,
  onSelect,
  locale,
  advanceNoticeMs = 2 * 60 * 60 * 1000,
  openingTime = "09:00",
  closingTime = "22:00",
  timeSlotIncrement = 30,
  enabledWeekdays = DEFAULT_OPERATING_DAYS,
  closedTimeRanges = [],
  nowMs,
  displayTimeFormat = "24h",
}: {
  date: string
  value: string
  onSelect: (t: string) => void
  locale: string
  advanceNoticeMs?: number
  openingTime?: string
  closingTime?: string
  timeSlotIncrement?: number
  enabledWeekdays?: number[]
  closedTimeRanges?: ClosedTimeRange[]
  nowMs: number
  displayTimeFormat?: "12h" | "24h"
}) {
  const isSpa = locale === "es"
  const slots = useMemo(
    () => generateTimeSlots(openingTime, closingTime, timeSlotIncrement, closedTimeRanges),
    [openingTime, closingTime, timeSlotIncrement, closedTimeRanges]
  )
  const dateIsOpen = isOpenDay(date, enabledWeekdays)

  function isSlotDisabled(slot: string) {
    if (!date) return true
    const slotStartUTC = new Date(`${date}T${slot}:00-05:00`)
    return slotStartUTC.getTime() < nowMs + advanceNoticeMs
  }

  const tf = normalizeTimeFormatPreference(displayTimeFormat)
  const is12h = tf === "12h"

  const slotBase = is12h
    ? "min-h-[2.5rem] px-1.5 py-1.5 text-[11px] rounded-lg transition font-medium text-center leading-tight"
    : "py-1.5 px-1 text-[11px] rounded-lg transition font-medium text-center"
  const slotActive = "bg-wg-accent text-white"
  const slotIdle = "bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text hover:bg-wg-secondary/20 dark:hover:bg-wg-dark-border border border-wg-border dark:border-wg-dark-border"
  const slotDisabled = "bg-wg-bg dark:bg-wg-dark-raised text-wg-muted/35 dark:text-wg-dark-muted/35 border border-wg-border/40 cursor-not-allowed line-through"

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-wg-muted dark:text-wg-dark-muted text-center uppercase tracking-wide">
        {isSpa ? "¿A qué hora?" : "Choose a time"}
      </p>
      {!dateIsOpen ? (
        <p className="text-xs text-center text-wg-muted dark:text-wg-dark-muted">
          {isSpa ? "Ese día está cerrado para reservas." : "That day is closed for reservations."}
        </p>
      ) : slots.length === 0 ? (
        <p className="text-xs text-center text-wg-muted dark:text-wg-dark-muted">
          {isSpa ? "No hay horarios configurados ahora." : "No booking slots are configured right now."}
        </p>
      ) : (
        <div className={is12h ? "grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2" : "grid grid-cols-3 gap-1"}>
          {slots.map((slot) => {
            const disabled = isSlotDisabled(slot)
            const label = formatWallClockSlotLabel(slot, tf)
            return (
              <button
                key={slot}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && onSelect(slot)}
                className={`${slotBase} ${disabled ? slotDisabled : value === slot ? slotActive : slotIdle}`}
              >
                {is12h ? <TimePicker12hSlotLabel label={label} /> : label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// CompactGuestsPicker — Stepper + quick-select grid
// ══════════════════════════════════════════════════════════════════

function CompactGuestsPicker({
  value,
  onChange,
  onConfirm,
  locale,
  maxGuests,
}: {
  value: number
  onChange: (n: number) => void
  onConfirm: () => void
  locale: string
  maxGuests: number
}) {
  const isSpa = locale === "es"

  const numBase = "py-1.5 text-xs rounded-lg transition font-medium text-center"
  const numActive = "bg-wg-accent text-white"
  const numIdle = "bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text hover:bg-wg-secondary/20 dark:hover:bg-wg-dark-border border border-wg-border dark:border-wg-dark-border"

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-wg-muted dark:text-wg-dark-muted text-center uppercase tracking-wide">
        {isSpa ? "¿Para cuántas personas?" : "How many guests?"}
      </p>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={() => value > 1 && onChange(value - 1)}
          disabled={value <= 1}
          className="w-9 h-9 rounded-full border border-wg-border dark:border-wg-dark-border flex items-center justify-center text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={isSpa ? "Reducir" : "Decrease"}
        >
          <MinusIcon className="w-4 h-4" strokeWidth={2} />
        </button>

        <div className="text-center min-w-[56px]">
          <span className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">
            {value}
          </span>
          <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
            {isSpa
              ? value === 1 ? "persona" : "personas"
              : value === 1 ? "guest" : "guests"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => value < maxGuests && onChange(value + 1)}
          disabled={value >= maxGuests}
          className="w-9 h-9 rounded-full border border-wg-border dark:border-wg-dark-border flex items-center justify-center text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={isSpa ? "Aumentar" : "Increase"}
        >
          <PlusIcon className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>

      <div className="h-px bg-wg-border dark:bg-wg-dark-border" />

      {/* Quick-select 1–10 */}
      <div className="grid grid-cols-5 gap-1">
        {Array.from({ length: Math.min(10, maxGuests) }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`${numBase} ${value === n ? numActive : numIdle}`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Show 11+ range when needed */}
      {maxGuests > 10 && (
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: Math.min(10, Math.max(maxGuests - 10, 0)) }, (_, i) => i + 11).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`${numBase} ${value === n ? numActive : numIdle}`}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {value >= 8 && (
        <p className="text-[11px] text-wg-accent dark:text-wg-dark-accent text-center leading-relaxed">
          {isSpa
            ? "Para grupos de 8+, el equipo verificará disponibilidad."
            : "For parties of 8+, the team will verify availability."}
        </p>
      )}

      <button
        type="button"
        onClick={onConfirm}
        className="w-full py-2.5 rounded-xl bg-wg-primary text-white text-sm font-medium hover:bg-wg-primary/90 transition-colors"
      >
        {isSpa ? "Continuar" : "Continue"}
      </button>
    </div>
  )
}
