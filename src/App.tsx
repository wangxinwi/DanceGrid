import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarRange,
  Clock3,
  Home,
  ListFilter,
  Plus,
  Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InviteGateScreen } from "@/components/InviteGateScreen";
import {
  clearBetaEntitlement,
  hasActiveBetaSession,
  readStoredBetaEntitlement,
  saveBetaEntitlement,
  validateBetaInviteCode,
} from "@/lib/betaAccess";
import { readJson, removeJson, writeJson } from "@/lib/storage";
import { cn } from "@/lib/utils";

type View = "month" | "week" | "day";
type LayoutMode = "grid" | "list";
type Page = "home" | "reconcile" | "more";
type MoreSection = "settings" | "studio";
type EditorMode = "create" | "edit";
type UILocale = "zh" | "en";
type ThemeMode = "light" | "dark";
type MonthKey = "2026-06" | "2026-07" | "2026-08";
type CourseType = "Regular" | "Substitute" | "Studio private" | "Student private" | "Small group" | "Workshop";
type CourseClassStatus = "待开" | "已开" | "停课" | "请假";
type PaymentStatus = "未收" | "已收" | "部分已收" | "超时未收";
type RepeatUnit = "week" | "month";
type RepeatEndMode = "count" | "date" | "month";

type ScheduleItem = {
  date: string;
  fee: number;
  sessions: number;
};

type AgendaItem = {
  time: string;
  title: string;
  meta: string;
  fee: string;
};

type MonthMeta = {
  title: string;
  summary: Array<{ label: string; value: string }>;
  list: AgendaItem[];
  note: string;
};

type ReconcileRow = {
  studioId: string;
  studio: string;
  sessions: number;
  canceled: number;
  leave: number;
  receivable: string;
  received: string;
  cashInMonth: string;
  settleableCount: number;
  expectedPayDay: string;
  status: "已到账" | "部分已收" | "待收";
};

type TimeBlock = {
  time: string;
  end: string;
  title: string;
  studio: string;
  type: CourseType;
  status: string;
  pay: string;
  note: string;
  weekend?: boolean;
};

type ScheduleEvent = CourseRecord & {
  status: CourseClassStatus;
  pay: PaymentStatus;
};

type DayDetail = {
  title: string;
  dateLabel: string;
  items: AgendaItem[];
  summary: Array<{ label: string; value: string }>;
  repeatRule: string;
};

type RepeatFields = {
  repeatEnabled: boolean;
  repeatIntervalValue: string;
  repeatIntervalUnit: RepeatUnit;
  repeatWeekday: string;
  repeatEndMode: RepeatEndMode;
  repeatEndValue: string;
};

type CourseRecord = {
  id: string;
  date: string;
  time: string;
  end: string;
  title: string;
  studioId: string;
  studio: string;
  type: CourseType;
  classStatus: CourseClassStatus;
  paymentStatus: PaymentStatus;
  fee: string;
  contentTag: string;
  contentDescription: string;
  departureMinutes: string;
  musicNote: string;
  attachments: string;
  note: string;
  paymentTime: string;
  actualReceivableAmount: string;
  actualReceivedAmount: string;
  createdAt: string;
  updatedAt: string;
  weekend?: boolean;
} & RepeatFields;

type CopyPreviewGroup = {
  studio: string;
  items: Array<{
    weekday: string;
    time: string;
    title: string;
    type: string;
    repeat: string;
    fee: string;
  }>;
};

type StudioRecord = {
  id: string;
  name: string;
  displayTypes: CourseType[];
  baseFee: string;
  payDay: string;
  contact: string;
  note: string;
  weeklySessionCount: string;
  address?: string;
  feeUnit?: string;
  cancelCompensationRatio?: string;
  contactName?: string;
  contactMethod?: string;
  groupTag?: string;
  archivedAt?: string;
};

type AppSnapshot = {
  version: 6;
  page: Page;
  activeView: View;
  activeMonthOffset: number;
  reconcileMonthOffset: number;
  selectedDate: string;
  monthLayoutMode: LayoutMode;
  weekLayoutMode: LayoutMode;
  moreSection: MoreSection;
  uiLocale: UILocale;
  themeMode: ThemeMode;
  studioRows: StudioRecord[];
  courseRecords: CourseRecord[];
};

type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmTone?: "default" | "destructive";
};

function isAppSnapshot(value: unknown): value is AppSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AppSnapshot> & {
    version?: unknown;
    studioRows?: unknown;
    courseRecords?: unknown;
  };
  return (
    (candidate.version === 5 || candidate.version === 6) &&
    Array.isArray(candidate.studioRows) &&
    Array.isArray(candidate.courseRecords)
  );
}

const courseTypeOptions: CourseType[] = [
  "Regular",
  "Substitute",
  "Studio private",
  "Student private",
  "Small group",
  "Workshop",
];
const studioDisplayTypeOptions = courseTypeOptions;
const studioFeeUnitOptions = ["/ hour"] as const;
const repeatSupportedTypes = new Set<CourseType>(["Regular", "Small group"]);
const manualCreateTypes = new Set<CourseType>(["Substitute", "Studio private", "Student private", "Workshop"]);
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
function getBeijingDateKey(reference = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(reference);
}

function getTodayDate() {
  return new Date(`${getBeijingDateKey()}T00:00:00`);
}

function getInitialLocale(): UILocale {
  if (typeof navigator === "undefined") return "en";
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function getInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getLocalizedValue<T extends string>(locale: UILocale, zh: T, en: T) {
  return locale === "zh" ? zh : en;
}

function normalizePercentageInput(value: unknown) {
  return String(value ?? "").replace(/%/g, "").trim();
}

function normalizeLocale(locale: unknown): UILocale {
  return typeof locale === "string" && locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function normalizeCourseType(type: unknown): CourseType {
  return type === "Regular" || type === "Substitute" || type === "Studio private" || type === "Student private" || type === "Small group" || type === "Workshop"
    ? type
    : "Regular";
}

function normalizeCourseClassStatus(status: unknown): CourseClassStatus {
  return status === "待开" || status === "已开" || status === "停课" || status === "请假" ? status : "待开";
}

function normalizePaymentStatus(status: unknown): PaymentStatus {
  return status === "未收" || status === "已收" || status === "部分已收" || status === "超时未收" ? status : "未收";
}

function normalizeStudioDisplayTypes(types: unknown): CourseType[] {
  return Array.isArray(types) ? uniqueStudioTypes(types.map((type) => normalizeCourseType(type))) : ["Regular"];
}

function normalizeSnapshotStudios(studios: unknown): StudioRecord[] {
  if (!Array.isArray(studios)) return [];
  return studios.map((studio) => {
    const source = (studio ?? {}) as Partial<StudioRecord>;
    return {
      id: source.id ?? `studio-${Date.now()}`,
      name: source.name ?? "",
      displayTypes: normalizeStudioDisplayTypes(source.displayTypes),
      baseFee: source.baseFee ?? "",
      payDay: source.payDay ?? "28",
      contact: source.contact ?? "",
      note: source.note ?? "",
      weeklySessionCount: source.weeklySessionCount ?? "1",
      address: source.address,
      feeUnit: source.feeUnit,
      cancelCompensationRatio: source.cancelCompensationRatio,
      contactName: source.contactName,
      contactMethod: source.contactMethod,
      groupTag: source.groupTag,
      archivedAt: source.archivedAt,
    };
  });
}

function normalizeRepeatFields(source: Partial<RepeatFields>, fallbackEnabled = false): RepeatFields {
  return {
    repeatEnabled: typeof source.repeatEnabled === "boolean" ? source.repeatEnabled : fallbackEnabled,
    repeatIntervalValue: source.repeatIntervalValue ?? "1",
    repeatIntervalUnit: source.repeatIntervalUnit === "month" ? "month" : "week",
    repeatWeekday: typeof source.repeatWeekday === "string" ? source.repeatWeekday : "Tuesday",
    repeatEndMode: source.repeatEndMode === "date" || source.repeatEndMode === "month" ? source.repeatEndMode : "count",
    repeatEndValue: source.repeatEndValue ?? "",
  };
}

function normalizeDateOnlyValue(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const dateKey = trimmed.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : "";
}

function normalizeSnapshotRecords(records: unknown): CourseRecord[] {
  if (!Array.isArray(records)) return [];
  return records.map((record) => {
    const source = (record ?? {}) as Partial<CourseRecord>;
    return {
      id: source.id ?? `record-${Date.now()}`,
      date: source.date ?? getBeijingDateKey(),
      time: source.time ?? "18:00",
      end: source.end ?? "19:30",
      title: source.title ?? "",
      studioId: source.studioId ?? "",
      studio: source.studio ?? "",
      type: normalizeCourseType(source.type),
      classStatus: normalizeCourseClassStatus(source.classStatus),
      paymentStatus: normalizePaymentStatus(source.paymentStatus),
      fee: source.fee ?? "0",
      contentTag: source.contentTag ?? "",
      contentDescription: source.contentDescription ?? "",
      departureMinutes: source.departureMinutes ?? "30",
      musicNote: source.musicNote ?? "",
      attachments: source.attachments ?? "",
      note: source.note ?? "",
      paymentTime: normalizeDateOnlyValue(source.paymentTime ?? ""),
      actualReceivableAmount: source.actualReceivableAmount ?? "",
      actualReceivedAmount: source.actualReceivedAmount ?? "",
      createdAt: source.createdAt ?? new Date().toISOString(),
      updatedAt: source.updatedAt ?? new Date().toISOString(),
      weekend: source.weekend,
      ...normalizeRepeatFields({
        repeatEnabled: source.repeatEnabled,
        repeatIntervalValue: source.repeatIntervalValue,
        repeatIntervalUnit: source.repeatIntervalUnit,
        repeatWeekday: source.repeatWeekday,
        repeatEndMode: source.repeatEndMode,
        repeatEndValue: source.repeatEndValue,
      }),
    };
  });
}

const weekdayShortLabelsByLocale: Record<UILocale, string[]> = {
  zh: ["一", "二", "三", "四", "五", "六", "日"],
  en: ["M", "T", "W", "T", "F", "S", "S"],
};

const weekdayLongLabelsByLocale: Record<UILocale, string[]> = {
  zh: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

const weekdayOptionsByLocale: Record<UILocale, string[]> = {
  zh: weekdayLongLabelsByLocale.zh,
  en: weekdayLongLabelsByLocale.en,
};

const monthNamesByLocale: Record<UILocale, string[]> = {
  zh: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
};

const courseTypeLabelsByLocale: Record<UILocale, Record<CourseType, string>> = {
  zh: {
    Regular: "常规课",
    Substitute: "代课",
    "Studio private": "工作室私教",
    "Student private": "学生私教",
    "Small group": "小班课",
    Workshop: "Workshop",
  },
  en: {
    Regular: "Regular",
    Substitute: "Substitute",
    "Studio private": "Studio private",
    "Student private": "Student private",
    "Small group": "Small group",
    Workshop: "Workshop",
  },
};

const repeatUnitLabelsByLocale: Record<UILocale, Record<RepeatUnit, string>> = {
  zh: { week: "周", month: "月" },
  en: { week: "week", month: "month" },
};

const repeatEndModeLabelsByLocale: Record<UILocale, Record<RepeatEndMode, string>> = {
  zh: { count: "按次数结束", date: "按日期结束", month: "按月末结束" },
  en: { count: "After", date: "Until", month: "At month end" },
};

const classStatusLabelsByLocale: Record<UILocale, Record<CourseClassStatus, string>> = {
  zh: { 待开: "待开", 已开: "已开", 停课: "停课", 请假: "请假" },
  en: { 待开: "Pending", 已开: "Held", 停课: "Canceled", 请假: "Leave" },
};

const paymentStatusLabelsByLocale: Record<UILocale, Record<PaymentStatus, string>> = {
  zh: { 未收: "未收", 已收: "已收", 部分已收: "部分已收", 超时未收: "超时未收" },
  en: { 未收: "Unpaid", 已收: "Paid", 部分已收: "Partially paid", 超时未收: "Overdue unpaid" },
};

function formatMonthLabel(locale: UILocale, date: Date) {
  const month = (monthNamesByLocale[locale] ?? monthNamesByLocale.en)[date.getMonth()] ?? "";
  return locale === "zh" ? `${date.getFullYear()}年${month}` : `${month} ${date.getFullYear()}`;
}

function formatWeekLabel(locale: UILocale, date: Date) {
  const day = (weekdayLongLabelsByLocale[locale] ?? weekdayLongLabelsByLocale.en)[(date.getDay() + 6) % 7] ?? "";
  return locale === "zh"
    ? `${date.getMonth() + 1}月${date.getDate()}日 ${day}`
    : date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatWeekRangeLabel(locale: UILocale, start: Date, end: Date) {
  const startDay = (weekdayLongLabelsByLocale[locale] ?? weekdayLongLabelsByLocale.en)[(start.getDay() + 6) % 7] ?? "";
  const endDay = (weekdayLongLabelsByLocale[locale] ?? weekdayLongLabelsByLocale.en)[(end.getDay() + 6) % 7] ?? "";
  return locale === "zh"
    ? `${start.getDate()}日 ${startDay} - ${end.getDate()}日 ${endDay}`
    : `${start.getDate()} ${startDay} - ${end.getDate()} ${endDay}`;
}

function formatRangeDateLabel(locale: UILocale, date: Date) {
  const weekday = (weekdayLongLabelsByLocale[locale] ?? weekdayLongLabelsByLocale.en)[(date.getDay() + 6) % 7] ?? "";
  if (locale === "zh") {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`;
  }
  const month = (monthNamesByLocale.en ?? monthNamesByLocale.en)[date.getMonth()] ?? "";
  return `${month.slice(0, 3)} ${date.getDate()} ${weekday}`;
}

function getRecordHourlyFeeValue(record: CourseRecord) {
  const fee = parseNumericValue(record.fee);
  return fee > 0 ? fee : getCourseFee(record.type);
}

function getRecordDurationMinutes(record: CourseRecord) {
  return Math.max(toTimeMinutes(record.end) - toTimeMinutes(record.time), 0);
}

function getRecordDurationHours(record: CourseRecord) {
  return getRecordDurationMinutes(record) / 60;
}

function getRecordListFeeValue(record: CourseRecord) {
  return Math.round(getRecordHourlyFeeValue(record) * getRecordDurationHours(record));
}

function formatDurationHours(locale: UILocale, hours: number) {
  const normalized = Number.isFinite(hours) ? Math.max(hours, 0) : 0;
  const label = normalized.toFixed(1).replace(/\.0$/, "");
  return locale === "zh" ? `${label}小时` : `${label}h`;
}

type RangeListItem = {
  record: CourseRecord;
  studioName: string;
  dateLabel: string;
  contentLabel: string;
  timeLabel: string;
  durationHours: number;
  feeValue: number;
};

type RangeStudioSummary = {
  studioId: string;
  studioName: string;
  totalHours: number;
  totalFee: number;
  classCount: number;
};

function buildRangeListItems(locale: UILocale, records: CourseRecord[], studios: StudioRecord[]) {
  return toArray(records)
    .slice()
    .sort(compareRecordDateTime)
    .map((record) => {
      const date = getRecordDate(record);
      const studioName = getStudioDisplayName(studios, record.studioId, record.studio);
      return {
        record,
        studioName,
        dateLabel: formatRangeDateLabel(locale, date),
        contentLabel: record.contentTag || record.title,
        timeLabel: `${record.time} - ${record.end}`,
        durationHours: getRecordDurationHours(record),
        feeValue: getRecordListFeeValue(record),
      };
    });
}

function buildRangeStudioSummaries(records: CourseRecord[], studios: StudioRecord[]) {
  const summaryMap = new Map<string, RangeStudioSummary>();
  toArray(records).forEach((record) => {
    const studioId = record.studioId || record.studio;
    const studioName = getStudioDisplayName(studios, record.studioId, record.studio || studioId);
    const current = summaryMap.get(studioId) ?? {
      studioId,
      studioName,
      totalHours: 0,
      totalFee: 0,
      classCount: 0,
    };
    current.totalHours += getRecordDurationHours(record);
    current.totalFee += getRecordListFeeValue(record);
    current.classCount += 1;
    summaryMap.set(studioId, current);
  });
  return Array.from(summaryMap.values()).sort((left, right) => right.totalHours - left.totalHours || left.studioName.localeCompare(right.studioName));
}

function RangeListView({
  locale,
  records,
  studios,
  onOpenDetail,
  summaryLabel,
  selectedIds,
  onToggleSelected,
  onSelectAllVisible,
  onClearSelection,
  onBatchDelete,
  onBatchSetClassStatus,
  onBatchSetPaymentStatus,
}: {
  locale: UILocale;
  records: CourseRecord[];
  studios: StudioRecord[];
  onOpenDetail: (recordId: string) => void;
  summaryLabel: string;
  selectedIds: string[];
  onToggleSelected: (recordId: string) => void;
  onSelectAllVisible: (recordIds: string[]) => void;
  onClearSelection: () => void;
  onBatchDelete: () => void;
  onBatchSetClassStatus: (status: CourseClassStatus) => void;
  onBatchSetPaymentStatus: (status: PaymentStatus) => void;
}) {
  const items = useMemo(() => buildRangeListItems(locale, records, studios), [locale, records, studios]);
  const summaries = useMemo(() => buildRangeStudioSummaries(records, studios), [records, studios]);
  const totalHours = items.reduce((sum, item) => sum + item.durationHours, 0);
  const totalFee = items.reduce((sum, item) => sum + item.feeValue, 0);
  const visibleRecordIds = useMemo(() => items.map((item) => item.record.id), [items]);
  const selectedCount = selectedIds.length;
  const allSelected = visibleRecordIds.length > 0 && visibleRecordIds.every((recordId) => selectedIds.includes(recordId));
  const someSelected = selectedCount > 0 && !allSelected;
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [bulkAction, setBulkAction] = useState<string>("");

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  return (
    <section className="range-list-shell">
      <div className="range-list-head">
        <div>
          <strong>{summaryLabel}</strong>
          <p>
            {getLocalizedValue(
              locale,
              `共 ${items.length} 节课 · ${formatDurationHours(locale, totalHours)} · ${formatCurrency(totalFee)}`,
              `${items.length} classes · ${formatDurationHours(locale, totalHours)} · ${formatCurrency(totalFee)}`,
            )}
          </p>
        </div>
        <div className="range-bulk-bar">
          <span className="range-bulk-count">
            {getLocalizedValue(locale, `${selectedCount} 已选`, `${selectedCount} selected`)}
          </span>
          <Select
            value={bulkAction}
            onValueChange={(value) => {
              if (selectedCount === 0) return;
              setBulkAction(value);
              if (value === "delete") {
                onBatchDelete();
              } else if (value === "paid") {
                onBatchSetPaymentStatus("已收");
              } else if (value === "open") {
                onBatchSetClassStatus("已开");
              } else if (value === "canceled") {
                onBatchSetClassStatus("停课");
              } else if (value === "leave") {
                onBatchSetClassStatus("请假");
              }
              setBulkAction("");
            }}
            disabled={selectedCount === 0}
          >
            <SelectTrigger className="range-bulk-select">
              <SelectValue placeholder={getLocalizedValue(locale, "操作", "Actions")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="delete">{getLocalizedValue(locale, "删除", "Delete")}</SelectItem>
              <SelectItem value="paid">{getLocalizedValue(locale, "已收款", "Mark paid")}</SelectItem>
              <SelectItem value="open">{getLocalizedValue(locale, "开课", "Held")}</SelectItem>
              <SelectItem value="canceled">{getLocalizedValue(locale, "停课", "Canceled")}</SelectItem>
              <SelectItem value="leave">{getLocalizedValue(locale, "请假", "Leave")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {items.length > 0 ? (
          <div className="range-list-table" role="table" aria-label={summaryLabel}>
          <div className="range-list-row range-list-row-head" role="row">
            <span role="columnheader" className="range-list-select-cell">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelected}
                aria-checked={someSelected ? "mixed" : allSelected}
                onChange={() => {
                  if (allSelected) {
                    onClearSelection();
                  } else {
                    onSelectAllVisible(visibleRecordIds);
                  }
                }}
                aria-label={getLocalizedValue(locale, "全选课程", "Select all classes")}
              />
            </span>
            <span role="columnheader">{getLocalizedValue(locale, "日期", "Date")}</span>
            <span role="columnheader">{getLocalizedValue(locale, "工作室", "Studio")}</span>
            <span role="columnheader">{getLocalizedValue(locale, "时间", "Time")}</span>
            <span role="columnheader">{getLocalizedValue(locale, "课时费", "Fee")}</span>
            <span role="columnheader">{getLocalizedValue(locale, "时长", "Duration")}</span>
          </div>

          {items.map((item) => (
            <div
              key={item.record.id}
              className="range-list-row"
              role="row"
              tabIndex={0}
              aria-selected={selectedIds.includes(item.record.id)}
              data-selected={selectedIds.includes(item.record.id) ? "true" : "false"}
              onClick={() => onOpenDetail(item.record.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenDetail(item.record.id);
                }
              }}
            >
              <span role="cell" className="range-list-select-cell" onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.record.id)}
                  onChange={() => onToggleSelected(item.record.id)}
                  aria-label={getLocalizedValue(locale, `选择 ${item.dateLabel} ${item.studioName}`, `Select ${item.dateLabel} ${item.studioName}`)}
                />
              </span>
              <span role="cell" className="range-list-date">
                {item.dateLabel}
              </span>
              <span role="cell" className="range-list-main">
                <strong>{item.studioName}</strong>
                <small>{item.contentLabel}</small>
              </span>
              <span role="cell" className="range-list-time">
                {item.timeLabel}
              </span>
              <span role="cell" className="range-list-fee">
                {formatCurrency(item.feeValue)}
              </span>
              <span role="cell" className="range-list-duration">
                {formatDurationHours(locale, item.durationHours)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>{getLocalizedValue(locale, "当前范围没有课程", "No classes in this range")}</strong>
          <p>{getLocalizedValue(locale, "切换到其他月份或周，看看是否有排课。", "Switch to another month or week to see scheduled classes.")}</p>
        </div>
      )}

      <div className="range-summary-shell">
        <div className="range-summary-head">
          <strong>{getLocalizedValue(locale, "当前范围统计", "Range summary")}</strong>
          <span>{getLocalizedValue(locale, `${items.length} 节课`, `${items.length} classes`)}</span>
        </div>
        {summaries.length > 0 ? (
          <div className="range-summary-list">
            {summaries.map((item) => (
              <div className="range-summary-row" key={item.studioId}>
                <div className="range-summary-main">
                  <strong>{item.studioName}</strong>
                  <small>{getLocalizedValue(locale, `${item.classCount} 节课`, `${item.classCount} classes`)}</small>
                </div>
                <div className="range-summary-stat">
                  {formatDurationHours(locale, item.totalHours)}
                </div>
                <div className="range-summary-stat">
                  {formatCurrency(item.totalFee)}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function formatWeekdayLabel(locale: UILocale, weekday: string) {
  const index = weekdayLongLabelsByLocale.en.indexOf(weekday);
  return index >= 0 ? (weekdayLongLabelsByLocale[locale] ?? weekdayLongLabelsByLocale.en)[index] ?? weekday : weekday;
}

function formatWeekdayList(locale: UILocale, weekdays: string[]) {
  return weekdays.map((weekday) => formatWeekdayLabel(locale, weekday)).join(" / ");
}

function formatCourseTypeLabel(locale: UILocale, type: CourseType) {
  return (courseTypeLabelsByLocale[locale] ?? courseTypeLabelsByLocale.en)[type] ?? type;
}

function formatClassStatusLabel(locale: UILocale, status: CourseClassStatus) {
  return (classStatusLabelsByLocale[locale] ?? classStatusLabelsByLocale.en)[status] ?? status;
}

function formatPaymentStatusLabel(locale: UILocale, status: PaymentStatus) {
  return (paymentStatusLabelsByLocale[locale] ?? paymentStatusLabelsByLocale.en)[status] ?? status;
}

function formatRepeatUnitLabel(locale: UILocale, unit: RepeatUnit) {
  return (repeatUnitLabelsByLocale[locale] ?? repeatUnitLabelsByLocale.en)[unit];
}

function formatRepeatEndModeLabel(locale: UILocale, mode: RepeatEndMode) {
  return (repeatEndModeLabelsByLocale[locale] ?? repeatEndModeLabelsByLocale.en)[mode];
}

const studioFeeUnitLabelsByLocale: Record<UILocale, Record<(typeof studioFeeUnitOptions)[number], string>> = {
  zh: { "/ hour": "/ 小时" },
  en: { "/ hour": "/ hour" },
};

function formatStudioFeeUnit(locale: UILocale, unit: (typeof studioFeeUnitOptions)[number]) {
  return (studioFeeUnitLabelsByLocale[locale] ?? studioFeeUnitLabelsByLocale.en)[unit];
}

const initialDate = getTodayDate();
const clockHourOptions = Array.from({ length: 24 }, (_, index) => pad(index));
const clockMinuteOptions = Array.from({ length: 12 }, (_, index) => pad(index * 5));

const scheduleData: Record<MonthKey, ScheduleItem[]> = {};

const monthMetaData: Record<MonthKey, MonthMeta> = {};

const reconcileRows: ReconcileRow[] = [];

const initialStudioRows: StudioRecord[] = [];

const initialCourseRecords: CourseRecord[] = [];

const appSnapshotKey = "dancegrid-app-snapshot";

function formatCurrency(value: number) {
  return `¥${value.toLocaleString("en-US")}`;
}

function parseNumericValue(value: string | number | null | undefined) {
  const normalized = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(normalized) ? normalized : 0;
}

function parsePayDayValue(payDay: string) {
  const parsed = Number(payDay.match(/\d{1,2}/)?.[0] ?? "");
  if (!Number.isFinite(parsed)) return 31;
  return Math.min(31, Math.max(1, parsed));
}

function toArray<T>(value: readonly T[] | null | undefined): T[] {
  return Array.isArray(value) ? [...value] : [];
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getPayDayDate(referenceDate: Date, payDay: string) {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), Math.min(parsePayDayValue(payDay), daysInMonth(referenceDate)));
}

function getRecordMonthKey(record: CourseRecord) {
  return record.date.slice(0, 7) as MonthKey;
}

function getRecordDate(record: CourseRecord) {
  return new Date(`${record.date}T00:00:00`);
}

function getStudioByName(studios: StudioRecord[], studioName: string) {
  return studios.find((studio) => studio.name === studioName) ?? null;
}

function getStudioById(studios: StudioRecord[], studioId: string) {
  return studios.find((studio) => studio.id === studioId) ?? null;
}

function getStudioDisplayName(studios: StudioRecord[], studioId: string, fallbackName = "") {
  return getStudioById(studios, studioId)?.name ?? fallbackName;
}

function isRecordOverdue(record: CourseRecord, studio: StudioRecord | null, referenceDate: Date = initialDate) {
  if (record.paymentStatus === "已收") return false;
  const dueDate = getPayDayDate(getRecordDate(record), studio?.payDay ?? "31");
  return referenceDate > dueDate;
}

function getEffectivePaymentStatus(record: CourseRecord, studio: StudioRecord | null, referenceDate: Date = initialDate) {
  if (record.paymentStatus === "已收") return "已收" as const;
  if (record.paymentStatus === "超时未收") return "超时未收" as const;
  return isRecordOverdue(record, studio, referenceDate) ? "超时未收" : record.paymentStatus;
}

function getRecordFeeValue(record: CourseRecord) {
  const actualReceivable = parseNumericValue(record.actualReceivableAmount);
  if (actualReceivable > 0) return actualReceivable;
  const fee = parseNumericValue(record.fee);
  return fee > 0 ? fee : getCourseFee(record.type);
}

function getRecordReceivedValue(record: CourseRecord) {
  const received = parseNumericValue(record.actualReceivedAmount);
  if (received > 0) return received;
  return record.paymentStatus === "已收" ? getRecordFeeValue(record) : 0;
}

function parseDateOnlyValue(value: string) {
  const normalized = normalizeDateOnlyValue(value);
  if (!normalized) return null;
  const date = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getReceiptMonthKey(record: CourseRecord) {
  if (record.paymentStatus === "未收") return null;
  const paymentDate = parseDateOnlyValue(record.paymentTime);
  if (!paymentDate || Number.isNaN(paymentDate.getTime())) return null;
  return formatMonthKey(paymentDate);
}

function formatRecordSummary(locale: UILocale, record: CourseRecord, studio: StudioRecord | null, referenceDate: Date = initialDate) {
  const paymentStatus = getEffectivePaymentStatus(record, studio, referenceDate);
  const tags = [
    formatCourseTypeLabel(locale, record.type),
    formatClassStatusLabel(locale, record.classStatus),
    formatPaymentStatusLabel(locale, record.paymentStatus),
  ];
  if (paymentStatus === "超时未收" && record.paymentStatus !== "超时未收") {
    tags.push(getLocalizedValue(locale, "超时未收", "Overdue unpaid"));
  }
  return tags.join(" · ");
}

function toAgendaItem(locale: UILocale, record: CourseRecord, studio: StudioRecord | null, referenceDate: Date = initialDate) {
  return {
    time: record.time,
    title: `${studio?.name ?? record.studio} · ${record.contentTag || record.title}`,
    meta: formatRecordSummary(locale, record, studio, referenceDate),
    fee: formatCurrency(getRecordFeeValue(record)),
  };
}

function getRepeatRuleLabel(locale: UILocale, repeat: RepeatFields | null) {
  if (!repeat || !repeat.repeatEnabled) return getLocalizedValue(locale, "暂无重复规则。", "No repeat rule set for this class.");
  const weekdays = formatWeekdayLabel(locale, repeat.repeatWeekday);
  const endLabel =
    repeat.repeatEndMode === "count"
      ? `${getLocalizedValue(locale, "次数后结束", "After")} ${repeat.repeatEndValue}`
      : repeat.repeatEndMode === "date"
        ? `${getLocalizedValue(locale, "截至", "Until")} ${repeat.repeatEndValue}`
        : getLocalizedValue(locale, "月末结束", "At month end");
  return `${repeat.repeatIntervalUnit === "week" ? getLocalizedValue(locale, "每周", "Weekly") : getLocalizedValue(locale, "每月", "Monthly")} · ${weekdays} · ${repeat.repeatIntervalValue} · ${endLabel}`;
}

function buildDayDetail(locale: UILocale, date: Date, records: CourseRecord[], studios: StudioRecord[]) {
  const safeRecords = toArray(records);
  const safeStudios = toArray(studios);
  const repeat = safeRecords.find((record) => record.repeatEnabled) ?? null;
  const totalFee = safeRecords.reduce((sum, record) => sum + getRecordFeeValue(record), 0);
  const totalReceived = safeRecords.reduce((sum, record) => sum + getRecordReceivedValue(record), 0);
  const activeStatus = safeRecords.some((record) => record.classStatus === "停课")
    ? "停课"
    : safeRecords.some((record) => record.classStatus === "请假")
      ? "请假"
      : safeRecords.some((record) => record.classStatus === "已开")
        ? "已开"
        : "待开";
  const statusLabel = safeRecords.length > 0 ? formatClassStatusLabel(locale, activeStatus) : getLocalizedValue(locale, "空闲", "Idle");

  return {
    title: formatWeekLabel(locale, date),
    dateLabel: locale === "zh" ? `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日` : date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    summary: [
      { label: getLocalizedValue(locale, "课程数", "Classes"), value: String(safeRecords.length) },
      { label: getLocalizedValue(locale, "状态", "Status"), value: statusLabel },
      { label: getLocalizedValue(locale, "应收", "Fee"), value: formatCurrency(totalFee) },
      { label: getLocalizedValue(locale, "已收", "Received"), value: formatCurrency(totalReceived) },
    ],
    repeatRule: getRepeatRuleLabel(locale, repeat),
    items: safeRecords.map((record) => toAgendaItem(locale, record, getStudioById(safeStudios, record.studioId))),
  };
}

function compareRecordDateTime(left: CourseRecord, right: CourseRecord) {
  return `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`);
}

function buildCopyPreviewGroups(locale: UILocale, records: CourseRecord[]) {
  return toArray(records).reduce<CopyPreviewGroup[]>((groups, record) => {
    if (!record.repeatEnabled) return groups;
    const group = groups.find((item) => item.studio === record.studio);
    const entry = {
      weekday: formatWeekdayLabel(locale, record.repeatWeekday),
      time: record.time,
      title: record.contentTag || record.title,
      type: formatCourseTypeLabel(locale, record.type),
      repeat: getRepeatRuleLabel(locale, record),
      fee: formatCurrency(getRecordFeeValue(record)),
    };

    if (group) {
      group.items.push(entry);
    } else {
      groups.push({
        studio: record.studio,
        items: [entry],
      });
    }

    return groups;
  }, []);
}

function getMonthRecords(records: CourseRecord[], monthKey: MonthKey) {
  return toArray(records).filter((record) => getRecordMonthKey(record) === monthKey).sort(compareRecordDateTime);
}

function getDateRecords(records: CourseRecord[], dateKey: string) {
  return toArray(records).filter((record) => record.date === dateKey).sort((left, right) => left.time.localeCompare(right.time));
}

function getDateRangeRecords(records: CourseRecord[], dateKeys: string[]) {
  const dateSet = new Set(dateKeys);
  return toArray(records)
    .filter((record) => dateSet.has(record.date))
    .sort(compareRecordDateTime);
}

function computeReconcileRows(locale: UILocale, studios: StudioRecord[], records: CourseRecord[], monthDate: Date, referenceDate: Date = initialDate) {
  const safeStudios = toArray(studios);
  const safeRecords = toArray(records);
  const monthKey = formatMonthKey(monthDate);
  const previousMonthDate = shiftMonth(monthDate, -1);
  const previousMonthKey = formatMonthKey(previousMonthDate);
  const receiptMonthRecords = safeRecords.filter((record) => getReceiptMonthKey(record) === monthKey).sort(compareRecordDateTime);
  const previousMonthRecords = getMonthRecords(safeRecords, previousMonthKey);

  return safeStudios.map((studio) => {
    const studioReceiptMonthRecords = receiptMonthRecords.filter((record) => record.studioId === studio.id);
    const studioPreviousMonthRecords = previousMonthRecords.filter((record) => record.studioId === studio.id);
    const sessions = studioPreviousMonthRecords.length;
    const canceled = studioPreviousMonthRecords.filter((record) => record.classStatus === "停课").length;
    const leave = studioPreviousMonthRecords.filter((record) => record.classStatus === "请假").length;
    const receivable = studioPreviousMonthRecords.reduce((sum, record) => sum + getRecordFeeValue(record), 0);
    const received = studioPreviousMonthRecords.reduce((sum, record) => sum + getRecordReceivedValue(record), 0);
    const cashInMonth = studioReceiptMonthRecords.reduce((sum, record) => sum + getRecordReceivedValue(record), 0);
    const dueDate = getPayDayDate(monthDate, studio.payDay);
    const partialCount = studioReceiptMonthRecords.filter((record) => record.paymentStatus === "部分已收").length;
    const status: ReconcileRow["status"] = sessions === 0 ? "待收" : cashInMonth === 0 ? "待收" : partialCount > 0 ? "部分已收" : "已到账";

    return {
      studioId: studio.id,
      studio: studio.name,
      sessions,
      canceled,
      leave,
      receivable: formatCurrency(receivable),
      received: formatCurrency(received),
      cashInMonth: formatCurrency(cashInMonth),
      expectedPayDay: locale === "zh" ? `${dueDate.getMonth() + 1}月${dueDate.getDate()}日` : dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      settleableCount: studioPreviousMonthRecords.length,
      status,
    };
  });
}

function shiftMonth(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function getCopyRecordGroupKey(record: CourseRecord) {
  return [
    record.studioId,
    record.title,
    record.type,
    record.time,
    record.end,
    record.fee,
    record.contentTag,
    record.contentDescription,
    record.departureMinutes,
    record.musicNote,
    record.attachments,
    record.note,
    record.repeatEnabled ? "1" : "0",
    record.repeatIntervalValue,
    record.repeatIntervalUnit,
    record.repeatWeekday,
    record.repeatEndMode,
    record.repeatEndValue,
  ].join("::");
}

function getWeeklyCopyDates(record: CourseRecord, targetMonthStart: Date) {
  const sourceDate = parseDateOnlyValue(record.date);
  if (!sourceDate) return [];

  const targetYear = targetMonthStart.getFullYear();
  const targetMonthIndex = targetMonthStart.getMonth();
  const weekday = getWeekdayIndex(record.repeatWeekday) ?? sourceDate.getDay();
  const intervalValue = Math.max(1, Number(record.repeatIntervalValue) || 1);
  const startOfTargetMonth = new Date(targetYear, targetMonthIndex, 1);
  const endOfTargetMonth = new Date(targetYear, targetMonthIndex + 1, 0);
  const dates: string[] = [];

  for (let cursor = new Date(startOfTargetMonth); cursor <= endOfTargetMonth; cursor.setDate(cursor.getDate() + 1)) {
    if (cursor.getDay() !== weekday) continue;
    const diffDays = Math.floor((cursor.getTime() - sourceDate.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays < 0) continue;
    if (Math.floor(diffDays / 7) % intervalValue !== 0) continue;
    dates.push(formatDateKey(cursor));
  }

  return dates;
}

function getMonthlyCopyDates(record: CourseRecord, targetMonthStart: Date) {
  const sourceDate = parseDateOnlyValue(record.date);
  if (!sourceDate) return [];
  const targetDate = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth(), Math.min(sourceDate.getDate(), daysInMonth(targetMonthStart)));
  return [formatDateKey(targetDate)];
}

function buildCopyRecords(
  sourceRecords: CourseRecord[],
  sourceMonthKey: MonthKey,
  targetMonthKey: MonthKey,
  strategy: "overwrite" | "skip" | "manual",
) {
  const sourceMonthRecords = getMonthRecords(sourceRecords, sourceMonthKey).filter((record) => record.repeatEnabled);
  const targetMonthStart = new Date(`${targetMonthKey}-01T00:00:00`);
  const currentTargetRecords = getMonthRecords(sourceRecords, targetMonthKey);
  const currentTargetKeys = new Set(currentTargetRecords.map((record) => `${record.date}__${record.time}__${record.studioId}`));
  const uniqueSourceRecords = sourceMonthRecords.filter((record, index, records) => {
    const groupKey = getCopyRecordGroupKey(record);
    return records.findIndex((candidate) => getCopyRecordGroupKey(candidate) === groupKey) === index;
  });
  const copiedEntries = uniqueSourceRecords.flatMap((record) => {
    const targetDates = record.repeatIntervalUnit === "month" ? getMonthlyCopyDates(record, targetMonthStart) : getWeeklyCopyDates(record, targetMonthStart);
    return targetDates.map((dateKey) => ({
      key: `${dateKey}__${record.time}__${record.studioId}`,
      record: {
        ...record,
        id: `course-${dateKey}-${record.time.replace(":", "")}-${Math.random().toString(16).slice(2, 6)}`,
        date: dateKey,
        classStatus: "待开" as const,
        paymentStatus: "未收" as const,
        actualReceivedAmount: "0",
        paymentTime: dateKey,
        createdAt: `${dateKey}T08:00:00`,
        updatedAt: `${dateKey}T08:00:00`,
      } satisfies CourseRecord,
    }));
  });

  const uniqueCopiedEntries = copiedEntries.filter((entry, index, allEntries) => {
    const firstIndex = allEntries.findIndex((candidate) => candidate.key === entry.key);
    return firstIndex === index;
  });
  const conflictKeys = new Set(uniqueCopiedEntries.filter((entry) => currentTargetKeys.has(entry.key)).map((entry) => entry.key));
  const kept = sourceRecords.filter((record) => {
    if (getRecordMonthKey(record) !== targetMonthKey) return true;
    if (strategy === "overwrite") {
      return !conflictKeys.has(`${record.date}__${record.time}__${record.studioId}`);
    }
    return true;
  });

  const additions = uniqueCopiedEntries.filter((entry) => {
    if (strategy === "skip" || strategy === "manual") {
      return !currentTargetKeys.has(entry.key);
    }
    return true;
  });

  return [...kept, ...additions.map((entry) => entry.record)];
}

function getWeekdayIndex(weekday: string) {
  const index = weekdayLongLabelsByLocale.en.indexOf(weekday);
  return index >= 0 ? (index + 1) % 7 : null;
}

function cloneRecordForDate(record: CourseRecord, dateKey: string, createdAt: string): CourseRecord {
  return {
    ...record,
    id: `course-${dateKey}-${record.time.replace(":", "")}-${Math.random().toString(16).slice(2, 8)}`,
    date: dateKey,
    paymentTime: normalizeDateOnlyValue(record.paymentTime) || dateKey,
    weekend: new Date(`${dateKey}T00:00:00`).getDay() === 0 || new Date(`${dateKey}T00:00:00`).getDay() === 6,
    createdAt,
    updatedAt: createdAt,
  };
}

function buildRepeatRecordDates(record: CourseRecord) {
  if (!record.repeatEnabled) return [record.date];

  const startDate = parseDateOnlyValue(record.date);
  if (!startDate) return [record.date];

  const intervalValue = Math.max(1, Number(record.repeatIntervalValue) || 1);
  const result: string[] = [];

  if (record.repeatIntervalUnit === "month") {
    const endDate =
      record.repeatEndMode === "count"
        ? (() => {
            const count = Math.max(1, Number(record.repeatEndValue) || 1);
            const dates: string[] = [];
            let current = new Date(startDate);
            for (let index = 0; index < count; index += 1) {
              dates.push(formatDateKey(current));
              const nextMonth = new Date(current.getFullYear(), current.getMonth() + intervalValue, 1);
              const day = Math.min(startDate.getDate(), daysInMonth(nextMonth));
              current = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), day);
            }
            return dates;
          })()
        : (() => {
            const dates: string[] = [];
            let current = new Date(startDate);
            const limit =
              record.repeatEndMode === "date"
                ? parseDateOnlyValue(record.repeatEndValue) ?? startDate
                : new Date(startDate.getFullYear(), startDate.getMonth(), daysInMonth(startDate));
            while (current <= limit) {
              dates.push(formatDateKey(current));
              const nextMonth = new Date(current.getFullYear(), current.getMonth() + intervalValue, 1);
              const day = Math.min(startDate.getDate(), daysInMonth(nextMonth));
              current = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), day);
            }
            return dates;
          })();
    return endDate.length > 0 ? endDate : [record.date];
  }

  const targetWeekday = getWeekdayIndex(record.repeatWeekday) ?? startDate.getDay();
  let current = new Date(startDate);
  while (current.getDay() !== targetWeekday) {
    current.setDate(current.getDate() + 1);
  }

  const pushCurrent = () => result.push(formatDateKey(current));
  const advance = () => current.setDate(current.getDate() + intervalValue * 7);

  if (record.repeatEndMode === "count") {
    const count = Math.max(1, Number(record.repeatEndValue) || 1);
    for (let index = 0; index < count; index += 1) {
      pushCurrent();
      advance();
    }
    return result.length > 0 ? result : [record.date];
  }

  const limit =
    record.repeatEndMode === "date"
      ? parseDateOnlyValue(record.repeatEndValue) ?? startDate
      : new Date(startDate.getFullYear(), startDate.getMonth(), daysInMonth(startDate));

  while (current <= limit) {
    pushCurrent();
    advance();
  }

  return result.length > 0 ? result : [record.date];
}

function buildCreatedCourseRecords(record: CourseRecord) {
  const dates = buildRepeatRecordDates(record);
  const createdAt = new Date().toISOString();
  return dates.map((dateKey) => cloneRecordForDate(record, dateKey, createdAt));
}

function isValidTimeRange(record: CourseRecord) {
  return toTimeMinutes(record.end) > toTimeMinutes(record.time);
}

function hasTimeOverlap(left: CourseRecord, right: CourseRecord) {
  if (left.date !== right.date) return false;
  if (left.studioId !== right.studioId) return false;
  const leftStart = toTimeMinutes(left.time);
  const leftEnd = toTimeMinutes(left.end);
  const rightStart = toTimeMinutes(right.time);
  const rightEnd = toTimeMinutes(right.end);
  return leftStart < rightEnd && rightStart < leftEnd;
}

function findTimeConflict(candidates: CourseRecord[], existing: CourseRecord[], ignoreRecordId?: string) {
  const safeExisting = toArray(existing);
  for (const candidate of candidates) {
    for (const record of safeExisting) {
      if (ignoreRecordId && record.id === ignoreRecordId) continue;
      if (record.id === candidate.id) continue;
      if (hasTimeOverlap(candidate, record)) {
        return { candidate, record };
      }
    }
  }
  return null;
}

function formatTimeConflictLabel(locale: UILocale, conflict: { candidate: CourseRecord; record: CourseRecord }) {
  const leftLabel = `${conflict.candidate.date} ${conflict.candidate.time}-${conflict.candidate.end}`;
  const rightLabel = `${conflict.record.date} ${conflict.record.time}-${conflict.record.end}`;
  return getLocalizedValue(
    locale,
    `时间冲突：${leftLabel} 与已有课程 ${rightLabel} 重叠。`,
    `Time conflict: ${leftLabel} overlaps with existing class ${rightLabel}.`,
  );
}

const dayDetailByKey: Record<string, DayDetail> = {};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatMonthKey(date: Date): MonthKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}` as MonthKey;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthFromOffset(offset: number) {
  return new Date(initialDate.getFullYear(), initialDate.getMonth() + offset, 1);
}

function monthOffsetFromDate(date: Date) {
  return (date.getFullYear() - initialDate.getFullYear()) * 12 + (date.getMonth() - initialDate.getMonth());
}

function getGridDates(monthDate: Date) {
  const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(startOfMonth);
  const offset = (startOfMonth.getDay() + 6) % 7;
  gridStart.setDate(startOfMonth.getDate() - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + index);
    return current;
  });
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function isWeekend(date: Date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

function toTimeMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function weekStart(date: Date) {
  const current = new Date(date);
  const day = (current.getDay() + 6) % 7;
  current.setDate(current.getDate() - day);
  current.setHours(0, 0, 0, 0);
  return current;
}

function getWeekDates(date: Date) {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    return current;
  });
}

function toScheduleEvent(record: CourseRecord, studio: StudioRecord | null, referenceDate: Date = initialDate): ScheduleEvent {
  const studioName = studio?.name ?? record.studio;
  return {
    ...record,
    studio: studioName,
    status: record.classStatus,
    pay: getEffectivePaymentStatus(record, studio, referenceDate),
  };
}

function getEventsForDate(records: CourseRecord[], studios: StudioRecord[], dateKey: string, referenceDate: Date = initialDate) {
  return getDateRecords(records, dateKey).map((record) => toScheduleEvent(record, getStudioById(toArray(studios), record.studioId), referenceDate));
}

function parseClockTime(input?: string | null) {
  const raw = input?.split("-")[0]?.trim() ?? "18:00";
  const [hour = "18", minute = "00"] = raw.split(":");
  return {
    hour: clockHourOptions.includes(hour.padStart(2, "0")) ? hour.padStart(2, "0") : "18",
    minute: clockMinuteOptions.includes(minute.padStart(2, "0")) ? minute.padStart(2, "0") : "00",
  };
}

function addMinutes(time: string, minutes: number) {
  const [hour = "18", minute = "00"] = time.split(":");
  const total = Number(hour) * 60 + Number(minute) + minutes;
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const nextHour = Math.floor(normalized / 60);
  const nextMinute = normalized % 60;
  return `${pad(nextHour)}:${pad(nextMinute)}`;
}

function parseTimeRange(input?: string | null) {
  const [startRaw, endRaw] = (input ?? "").split("-").map((part) => part.trim());
  const start = parseClockTime(startRaw || "18:00");
  const startTime = `${start.hour}:${start.minute}`;
  const end = parseClockTime(endRaw || addMinutes(startTime, 90));
  return {
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end.hour,
    endMinute: end.minute,
  };
}

function getCourseTypeTone(type: CourseType) {
  switch (type) {
    case "Regular":
      return "success" as const;
    case "Workshop":
      return "neutral" as const;
    case "Small group":
      return "secondary" as const;
    default:
      return "warning" as const;
  }
}

function getClassStatusTone(status: CourseClassStatus) {
  switch (status) {
    case "已开":
      return "success" as const;
    case "待开":
      return "secondary" as const;
    case "停课":
      return "destructive" as const;
    case "请假":
      return "warning" as const;
  }
}

function getPaymentStatusTone(status: PaymentStatus) {
  switch (status) {
    case "已收":
      return "success" as const;
    case "未收":
      return "warning" as const;
    case "部分已收":
      return "secondary" as const;
    case "超时未收":
      return "destructive" as const;
  }
}

function getStudioTypeTone(type: CourseType) {
  switch (type) {
    case "Regular":
      return "success" as const;
    case "Substitute":
      return "secondary" as const;
    case "Studio private":
      return "warning" as const;
    case "Student private":
      return "default" as const;
    case "Small group":
      return "secondary" as const;
    case "Workshop":
      return "destructive" as const;
  }
}

function formatStudioDisplayTypes(types: CourseType[], locale: UILocale = "en") {
  return types.length > 0 ? types.map((type) => formatCourseTypeLabel(locale, type)).join(" · ") : getLocalizedValue(locale, "未设置", "Not set");
}

function uniqueStudioTypes(types: CourseType[]) {
  return studioDisplayTypeOptions.filter((type) => types.includes(type));
}

function getActiveStudios(studios: StudioRecord[]) {
  return toArray(studios).filter((studio) => !studio.archivedAt);
}

function countLinkedCoursesByStudio(records: CourseRecord[], studioId: string) {
  return toArray(records).filter((record) => record.studioId === studioId).length;
}

function toggleStudioType(types: CourseType[], type: CourseType) {
  if (types.includes(type)) {
    const next = types.filter((item) => item !== type);
    return next.length > 0 ? next : types;
  }
  return uniqueStudioTypes([...types, type]);
}

function getCourseFee(type: CourseType) {
  switch (type) {
    case "Workshop":
      return 500;
    case "Studio private":
      return 500;
    default:
      return 300;
  }
}

function getCourseTypeHint(locale: UILocale, type: CourseType) {
  switch (type) {
    case "Regular":
      return getLocalizedValue(locale, "常规课可开启重复规则。", "Regular classes can enable repeat rules.");
    case "Substitute":
      return getLocalizedValue(locale, "代课保持手动录入，表单更短。", "Substitute classes stay manual and keep the short form.");
    case "Studio private":
      return getLocalizedValue(locale, "工作室私教保持简表，费用需要手动填写。", "Studio private classes keep the short form and require manual fee entry.");
    case "Student private":
      return getLocalizedValue(locale, "学生私教只保留核心课时信息。", "Student private classes stay focused on the core session details.");
    case "Small group":
      return getLocalizedValue(locale, "小班课在需要时仍可展开重复规则。", "Small group classes can still use repeat details when needed.");
    case "Workshop":
      return getLocalizedValue(locale, "Workshop 默认按单次课程处理，重复控件保持隐藏。", "Workshops stay one-off and keep repeat controls hidden by default.");
  }
}

function shouldShowRepeatControls(type: CourseType) {
  return repeatSupportedTypes.has(type);
}

function isManualCreateType(type: CourseType) {
  return manualCreateTypes.has(type);
}

function useMonthState(locale: UILocale, activeMonthOffset: number, selectedDate: Date, records: CourseRecord[], studios: StudioRecord[]) {
  return useMemo(() => {
    const safeRecords = toArray(records);
    const safeStudios = toArray(studios);
    const monthDate = monthFromOffset(activeMonthOffset);
    const monthKey = formatMonthKey(monthDate);
    const monthRecords = getMonthRecords(safeRecords, monthKey);
    const totalSessions = monthRecords.length;
    const totalFee = monthRecords.reduce((sum, record) => sum + getRecordFeeValue(record), 0);
    const totalReceived = monthRecords.reduce((sum, record) => sum + getRecordReceivedValue(record), 0);
    const gridDates = getGridDates(monthDate);
    const selectedKey = formatDateKey(selectedDate);
    const selectedRecords = getDateRecords(safeRecords, selectedKey);
    const dayDetail = buildDayDetail(locale, selectedDate, selectedRecords, safeStudios);
    const selectedEvents = selectedRecords.map((record) => toScheduleEvent(record, getStudioById(safeStudios, record.studioId)));
    const selectedItems = selectedRecords.map((record) => toAgendaItem(locale, record, getStudioById(safeStudios, record.studioId)));

    return {
      monthDate,
      monthKey,
      monthRecords,
      totalSessions,
      totalFee,
      totalReceived,
      gridDates,
      selectedKey,
      selectedDate,
      selectedRecords,
      selectedItems,
      dayDetail,
      selectedEvents,
    };
  }, [locale, activeMonthOffset, selectedDate, records, studios]);
}

function getWeekRangeRecords(records: CourseRecord[], weekDates: Date[]) {
  return getDateRangeRecords(
    records,
    weekDates.map((date) => formatDateKey(date)),
  );
}

function useReconcileState(locale: UILocale, reconcileMonthOffset: number, records: CourseRecord[], studios: StudioRecord[]) {
  return useMemo(() => {
    const safeRecords = toArray(records);
    const safeStudios = toArray(studios);
    const monthDate = monthFromOffset(reconcileMonthOffset);
    const previousMonthDate = shiftMonth(monthDate, -1);
    const summaryRows = computeReconcileRows(locale, safeStudios, safeRecords, monthDate, initialDate);
    const totalSessions = summaryRows.reduce((sum, row) => sum + row.sessions, 0);
    const totalReceivable = summaryRows.reduce((sum, row) => sum + parseNumericValue(row.receivable), 0);
    const totalReceived = summaryRows.reduce((sum, row) => sum + parseNumericValue(row.received), 0);
    const totalStudiosWithReceipts = summaryRows.filter((row) => parseNumericValue(row.cashInMonth) > 0).length;
    const totalStudiosWaiting = summaryRows.filter((row) => parseNumericValue(row.cashInMonth) === 0).length;

    return {
      monthDate,
      monthLabel: formatMonthLabel(locale, monthDate),
      previousMonthDate,
      summaryRows,
      totalSessions,
      totalReceivable,
      totalReceived,
      totalStudiosWithReceipts,
      totalStudiosWaiting,
    };
  }, [locale, reconcileMonthOffset, records, studios]);
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="section-label">{children}</p>;
}

function TabIcon({ name }: { name: "home" | "reconcile" | "more" }) {
  if (name === "home") return <Home size={18} strokeWidth={1.9} aria-hidden="true" />;
  if (name === "reconcile") return <ListFilter size={18} strokeWidth={1.9} aria-hidden="true" />;
  return <Settings2 size={18} strokeWidth={1.9} aria-hidden="true" />;
}

function AppShell({ locale, page, setPage, children }: { locale: UILocale; page: Page; setPage: (page: Page) => void; children: ReactNode }) {
  return (
    <div className={classNames("app-shell", page === "home" && "home-shell", page !== "home" && "page-shell")}>
      <aside className="hero-copy">
        <p className="eyebrow">DanceGrid UI v0.1</p>
        <p className="lead">
          {getLocalizedValue(locale, "面向街舞老师在练习后查看当天课程、编辑重复排课，并且不离开手机完成结算。", "Designed for a street dance teacher checking the day’s classes after practice, editing repeat schedules, and settling fees without leaving the phone.")}
        </p>

        <div className="page-switcher desktop-switcher" aria-label={getLocalizedValue(locale, "页面", "Pages")}>
          {[
            ["home", getLocalizedValue(locale, "首页", "Home")],
            ["reconcile", getLocalizedValue(locale, "对账", "Reconcile")],
            ["more", getLocalizedValue(locale, "设置", "Settings")],
          ].map(([key, label]) => (
            <Button key={key} variant={page === key ? "default" : "outline"} size="sm" onClick={() => setPage(key as Page)} className="page-chip">
              {key === "more" ? <Settings2 size={14} /> : key === "reconcile" ? <ListFilter size={14} /> : <Home size={14} />}
              {label}
            </Button>
          ))}
        </div>
      </aside>

      <section className="phone-frame" aria-label="DanceGrid mobile prototype">
        <div className="device">{children}</div>
      </section>
    </div>
  );
}

function MobileFrame({ locale, activeView, setActiveView, monthTitle, onPrevMonth, onNextMonth, onToday, onAdd, page, setPage, children }: {
  locale: UILocale;
  activeView: View;
  setActiveView: (view: View) => void;
  monthTitle: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onAdd: () => void;
  page: Page;
  setPage: (page: Page) => void;
  children: ReactNode;
}) {
  return (
    <>
      <header className="status-bar">
        <span>9:41</span>
        <span>DanceGrid</span>
        <span>100%</span>
      </header>

      <div className="screen">
        <div className="screen-chrome">
          {page === "home" ? (
            <>
              <div className="topbar">
                <div>
                  <SectionLabel>{getLocalizedValue(locale, "课程总表", "Studio ledger")}</SectionLabel>
                  <div className="month-nav">
                    <Button variant="ghost" size="icon" className="month-step" onClick={onPrevMonth} aria-label={getLocalizedValue(locale, "上个月", "Previous month")}>
                      <ArrowLeft size={16} />
                    </Button>
                    <h2>{monthTitle}</h2>
                    <Button variant="ghost" size="icon" className="month-step" onClick={onNextMonth} aria-label={getLocalizedValue(locale, "下个月", "Next month")}>
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                </div>
                <div className="topbar-actions">
                  <Button variant="ghost" size="sm" className="toolbar-link today-link" onClick={onToday}>
                    {getLocalizedValue(locale, "今天", "Today")}
                  </Button>
                </div>
              </div>

              <Tabs value={activeView} onValueChange={(value) => setActiveView(value as View)}>
                <TabsList className="segmented view-tabs" aria-label={getLocalizedValue(locale, "视图切换", "Views")}>
                  <TabsTrigger value="day">
                    <Clock3 size={13} strokeWidth={1.9} />
                    {getLocalizedValue(locale, "日", "Day")}
                  </TabsTrigger>
                  <TabsTrigger value="week">
                    <CalendarRange size={13} strokeWidth={1.9} />
                    {getLocalizedValue(locale, "周", "Week")}
                  </TabsTrigger>
                  <TabsTrigger value="month">
                    <CalendarDays size={13} strokeWidth={1.9} />
                    {getLocalizedValue(locale, "月", "Month")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </>
          ) : (
            <div className="page-topbar">
              <div>
                <SectionLabel>{page === "reconcile" ? getLocalizedValue(locale, "对账", "Reconcile") : getLocalizedValue(locale, "设置", "Settings")}</SectionLabel>
                <h2>{page === "reconcile" ? getLocalizedValue(locale, "月度收款对账", "Monthly fee review") : getLocalizedValue(locale, "管理工具", "Secondary tools")}</h2>
              </div>
            </div>
          )}
        </div>

        <div className="screen-body">
          <main className="screen-main">{children}</main>

          <div className="mobile-bottom-nav" role="tablist" aria-label="Primary">
            {[
              ["home", getLocalizedValue(locale, "首页", "Home"), Home],
              ["reconcile", getLocalizedValue(locale, "对账", "Reconcile"), ListFilter],
              ["more", getLocalizedValue(locale, "设置", "Settings"), Settings2],
            ].map(([key, label]) => (
              <Button
                key={key}
                data-testid={`primary-${key}`}
                variant={page === key ? "default" : "ghost"}
                className={classNames("nav-item", page === key && "active")}
                onClick={() => setPage(key as Page)}
              >
                <TabIcon name={key as "home" | "reconcile" | "more"} />
                {label}
              </Button>
            ))}
          </div>

          {page === "home" && (
            <Button type="button" className="fab" data-testid="add-class" onClick={onAdd} aria-label={getLocalizedValue(locale, "添加课程", "Add class")}>
              <Plus size={18} />
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function MonthView({
  locale,
  data,
  studios,
  onSelectDate,
  onCopyLastMonth,
  onOpenDetail,
  layoutMode,
  onToggleLayout,
  selectedIds,
  onToggleSelected,
  onSelectAllVisible,
  onClearSelection,
  onBatchDelete,
  onBatchSetClassStatus,
  onBatchSetPaymentStatus,
}: {
  locale: UILocale;
  data: ReturnType<typeof useMonthState>;
  studios: StudioRecord[];
  onSelectDate: (date: Date) => void;
  onCopyLastMonth: () => void;
  onOpenDetail: (recordId: string) => void;
  layoutMode: LayoutMode;
  onToggleLayout: () => void;
  selectedIds: string[];
  onToggleSelected: (recordId: string) => void;
  onSelectAllVisible: (recordIds: string[]) => void;
  onClearSelection: () => void;
  onBatchDelete: () => void;
  onBatchSetClassStatus: (status: CourseClassStatus) => void;
  onBatchSetPaymentStatus: (status: PaymentStatus) => void;
}) {
  const selectedIsToday = data.selectedKey === formatDateKey(initialDate);
  const selectedEvents = data.selectedEvents;
  const selectedExpectedIncome = data.selectedRecords.reduce((sum, item) => sum + getRecordFeeValue(item), 0);
  const selectedSessions = selectedEvents.length;

  return (
    <section className="view-panel active" data-panel="month">
      <div className="month-header">
        <div>
          <h3>{formatMonthLabel(locale, data.monthDate)}</h3>
        </div>
        <div className="month-header-actions">
          <Button variant="outline" size="sm" className="range-action-button" onClick={onCopyLastMonth}>
            {getLocalizedValue(locale, "复制上月", "Copy last month")}
          </Button>
          <Button variant="outline" size="sm" className="range-action-button" onClick={onToggleLayout}>
            <ListFilter size={13} strokeWidth={1.9} />
            {layoutMode === "grid" ? getLocalizedValue(locale, "列表", "List") : getLocalizedValue(locale, "网格", "Grid")}
          </Button>
        </div>
      </div>

      {layoutMode === "grid" ? (
        <>
          <div className="month-grid-wrap">
            <div className="weekday-row" aria-hidden="true">
              {weekdayShortLabelsByLocale[locale].map((label, index) => (
                <span key={`${label}-${index}`}>{label}</span>
              ))}
            </div>

            <div className="month-grid" role="grid" aria-label={getLocalizedValue(locale, "月历", "Month calendar")}>
              {data.gridDates.map((date) => {
                const dateKey = formatDateKey(date);
                const inMonth = date.getMonth() === data.monthDate.getMonth();
                const classCount = getDateRecords(data.monthRecords, dateKey).length;
                const isSelected = data.selectedKey === dateKey;
                const isToday = dateKey === formatDateKey(initialDate);
                return (
                  <button
                    key={dateKey}
                    type="button"
                    className={classNames(
                      "day-cell",
                      !inMonth && "muted",
                      isWeekend(date) && "weekend",
                      isSelected && "selected",
                      isToday && "today",
                    )}
                    onClick={() => onSelectDate(date)}
                  >
                    <span className="date-number">{date.getDate()}</span>
                    {inMonth && classCount > 0 ? <span className="day-count-badge">{classCount}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="summary-panel">
            <div className="section-head">
              <div>
                <SectionLabel>{selectedIsToday ? getLocalizedValue(locale, "今日待开课程", "Today's classes") : getLocalizedValue(locale, "选中日期课表", "Selected date classes")}</SectionLabel>
                <h3>{formatWeekLabel(locale, data.selectedDate)}</h3>
              </div>
              <span className="text-button-like">{data.selectedItems.length} {getLocalizedValue(locale, "节课", "classes")}</span>
            </div>

            <div className="today-stack">
              <div className="today-card">
                <div className="today-card-head">
                  <strong>{selectedIsToday ? getLocalizedValue(locale, "今日待开课程", "Today's classes") : getLocalizedValue(locale, "待开课程", "Pending classes")}</strong>
                  <span>{data.selectedItems.length} {getLocalizedValue(locale, "节课", "classes")}</span>
                </div>

                {data.selectedItems.length > 0 ? (
                  <div className="today-list">
                    {selectedEvents.map((event, index) => (
                      <button className="agenda-row today-row" type="button" key={`${event.id}-${index}`} onClick={() => onOpenDetail(event.id)}>
                        <span className="agenda-time">{event.time}</span>
                        <span className="agenda-main">
                          <strong>{event.studio} · {event.contentTag || event.title}</strong>
                          <small>{formatCourseTypeLabel(locale, event.type)} · {formatClassStatusLabel(locale, event.status)} · {formatPaymentStatusLabel(locale, event.pay)}</small>
                        </span>
                        <span className="agenda-meta">{formatCurrency(getRecordFeeValue(event))}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state tight">
                    <strong>{getLocalizedValue(locale, "今天没有课程", "No classes today")}</strong>
                    <p>{getLocalizedValue(locale, "今天还没有待开课程。", "Today has no pending class yet.")}</p>
                  </div>
                )}
              </div>

              <div className="today-card">
                <div className="today-card-head">
                  <strong>{selectedIsToday ? getLocalizedValue(locale, "今日应收", "Today's receivable") : getLocalizedValue(locale, "本日应收", "Selected receivable")}</strong>
                  <span>{selectedIsToday ? getLocalizedValue(locale, "今天", "Today") : getLocalizedValue(locale, "选中", "Selected")}</span>
                </div>
                <div className="today-income">
                  <div className="today-income-amount">¥{selectedExpectedIncome}</div>
                  <p>{data.selectedItems.length > 0 ? `${data.selectedItems.length} ${getLocalizedValue(locale, "节课", "classes")} · ${selectedSessions} ${getLocalizedValue(locale, "节", "sessions")}` : getLocalizedValue(locale, "当天暂无课程安排", "No classes scheduled for this date")}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <RangeListView
          locale={locale}
          records={data.monthRecords}
          studios={studios}
          onOpenDetail={onOpenDetail}
          summaryLabel={getLocalizedValue(locale, "月度列表", "Month list")}
          selectedIds={selectedIds}
          onToggleSelected={onToggleSelected}
          onSelectAllVisible={onSelectAllVisible}
          onClearSelection={onClearSelection}
          onBatchDelete={onBatchDelete}
          onBatchSetClassStatus={onBatchSetClassStatus}
          onBatchSetPaymentStatus={onBatchSetPaymentStatus}
        />
      )}
    </section>
  );
}

function TimeRail({ start = 7, end = 24, step = 1 }: { start?: number; end?: number; step?: number }) {
  return (
    <div className="time-rail" aria-hidden="true">
      {Array.from({ length: Math.max(1, Math.floor((end - start) / step) + 1) }, (_, index) => {
        const hour = start + index * step;
        return (
          <div className="time-rail-row" key={hour}>
            <span>{`${pad(hour)}:00`}</span>
          </div>
        );
      })}
    </div>
  );
}

function EventBadge({ label, tone }: { label: string; tone: "success" | "warning" | "danger" | "neutral" | "secondary" }) {
  const variant = tone === "neutral" || tone === "secondary" ? "secondary" : tone === "danger" ? "destructive" : tone;
  return <Badge variant={variant as "secondary" | "success" | "warning" | "destructive"}>{label}</Badge>;
}

function EventCard({ event, style, onOpenDetail }: { event: ScheduleEvent; style: CSSProperties; onOpenDetail: (recordId: string) => void }) {
  return (
    <button
      className={classNames("schedule-event", `schedule-event-${event.type.toLowerCase()}`, event.weekend && "weekend")}
      type="button"
      style={style}
      onClick={() => onOpenDetail(event.id)}
      aria-label={`Open ${event.title}`}
    >
      <span className="drag-grip" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
      <span className="event-time">
        {event.time}
        <small>{event.end}</small>
      </span>
      <span className="event-main">
        <strong>{event.title}</strong>
        <small>{event.studio} · {event.type}</small>
      </span>
      <span className="event-meta">
        <EventBadge label={event.status} tone={getClassStatusTone(event.status)} />
        <EventBadge label={event.pay} tone={getPaymentStatusTone(event.pay)} />
      </span>
      <span className="event-handle event-handle-top" aria-hidden="true" />
      <span className="event-handle event-handle-bottom" aria-hidden="true" />
    </button>
  );
}

function WeekAgendaCard({ event, onOpenDetail, style }: { event: ScheduleEvent; onOpenDetail: (recordId: string) => void; style?: CSSProperties }) {
  return (
    <button
      className={classNames("week-mobile-event", `week-mobile-event-${event.type.toLowerCase()}`, event.weekend && "weekend")}
      type="button"
      style={style}
      onClick={() => onOpenDetail(event.id)}
      aria-label={`Open ${event.title}`}
    >
      <div className="week-mobile-event-time">
        {event.time}
        <small>{event.end}</small>
      </div>
      <div className="week-mobile-event-main">
        <strong>{event.title}</strong>
        <p>{event.studio} · {event.type}</p>
      </div>
      <div className="week-mobile-event-meta">
        <EventBadge label={event.status} tone={getClassStatusTone(event.status)} />
        <EventBadge label={event.pay} tone={getPaymentStatusTone(event.pay)} />
      </div>
    </button>
  );
}

function WeekMobileView({
  locale,
  weekDates,
  selectedDate,
  onSelectDate,
  onOpenDetail,
  records,
  studios,
}: {
  locale: UILocale;
  weekDates: Date[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onOpenDetail: (recordId: string) => void;
  records: CourseRecord[];
  studios: StudioRecord[];
}) {
  const slotCount = 24 - 7 + 1;
  return (
    <section className="week-mobile-board" aria-label={getLocalizedValue(locale, "周视图", "Week schedule")}>
      <div className="week-mobile-scroll">
        <div className="week-mobile-scroll-body">
          <div className="week-mobile-week-grid">
            <div className="week-mobile-time-rail" aria-hidden="true">
              {Array.from({ length: slotCount }, (_, index) => {
                const hour = 7 + index;
                return (
                  <div className="week-mobile-time-slot" key={hour}>
                    <span>{`${pad(hour)}:00`}</span>
                  </div>
                );
              })}
            </div>

            <div className="week-mobile-columns">
              {weekDates.map((date) => {
                const dateKey = formatDateKey(date);
                const events = getEventsForDate(records, studios, dateKey);
                const active = dateKey === formatDateKey(selectedDate);
                return (
                  <div
                    className={classNames("week-mobile-day-column", active && "active")}
                    key={dateKey}
                    onClick={() => onSelectDate(date)}
                    role="button"
                    tabIndex={0}
                    aria-label={getLocalizedValue(locale, `选择 ${weekdayLongLabelsByLocale.zh[date.getDay() === 0 ? 6 : date.getDay() - 1]} ${date.getDate()} 日`, `Select ${weekdayLongLabelsByLocale.en[date.getDay() === 0 ? 6 : date.getDay() - 1]} ${date.getDate()}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectDate(date);
                      }
                    }}
                  >
                    <div className="week-mobile-day-column-head">
                      <strong>{weekdayLongLabelsByLocale[locale][date.getDay() === 0 ? 6 : date.getDay() - 1]}</strong>
                      <span>{date.getDate()}</span>
                    </div>

                    <div className="week-mobile-day-track">
                      {Array.from({ length: slotCount }, (_, index) => (
                        <div className="week-mobile-hour-line" key={index} />
                      ))}
                      {events.length > 0 ? (
                        events.map((event) => {
                          const top = ((toTimeMinutes(event.time) - 7 * 60) / 60) * 3.8;
                          const height = Math.max(((toTimeMinutes(event.end) - toTimeMinutes(event.time)) / 60) * 3.8, 2.3);
                          return (
                            <WeekAgendaCard
                              key={`${event.date}-${event.time}-${event.title}`}
                              event={event}
                              onOpenDetail={onOpenDetail}
                              style={{
                                top: `${top}rem`,
                                height: `${height}rem`,
                              }}
                            />
                          );
                        })
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DayTimeline({ locale, date, events, onOpenDetail }: { locale: UILocale; date: Date; events: ScheduleEvent[]; onOpenDetail: (recordId: string) => void }) {
  const start = 7;
  const end = 24;
  const timelineHeight = (end - start + 1) * 4.5;
  return (
    <section className="timeline-panel day-timeline-panel">
      <div className="day-timeline-head">
        <div>
          <SectionLabel>{getLocalizedValue(locale, "日程", "Day timeline")}</SectionLabel>
          <h3>{formatWeekLabel(locale, date)}</h3>
        </div>
        <span className="text-button-like">{events.length} {getLocalizedValue(locale, "节课", "classes")}</span>
      </div>
      <div className="day-timeline-grid">
        <TimeRail start={start} end={end} />
        <div className="day-timeline-track" style={{ "--track-height": `${timelineHeight}rem` } as CSSProperties}>
          {Array.from({ length: end - start + 1 }, (_, index) => (
            <div className="hour-line" key={index} />
          ))}
          {events.map((event) => {
            const top = ((toTimeMinutes(event.time) - start * 60) / 60) * 4.5;
            const height = Math.max(((toTimeMinutes(event.end) - toTimeMinutes(event.time)) / 60) * 4.5, 2.75);
            return (
              <EventCard
                key={`${event.date}-${event.time}-${event.title}`}
                event={event}
                onOpenDetail={onOpenDetail}
                style={{
                  top: `${top}rem`,
                  height: `${height}rem`,
                }}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WeekView({
  locale,
  selectedDate,
  onSelectDate,
  onOpenDetail,
  onJumpToToday,
  onShiftWeek,
  records,
  studios,
  layoutMode,
  onToggleLayout,
  selectedIds,
  onToggleSelected,
  onSelectAllVisible,
  onClearSelection,
  onBatchDelete,
  onBatchSetClassStatus,
  onBatchSetPaymentStatus,
}: {
  locale: UILocale;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onOpenDetail: (recordId: string) => void;
  onJumpToToday: () => void;
  onShiftWeek: (delta: number) => void;
  records: CourseRecord[];
  studios: StudioRecord[];
  layoutMode: LayoutMode;
  onToggleLayout: () => void;
  selectedIds: string[];
  onToggleSelected: (recordId: string) => void;
  onSelectAllVisible: (recordIds: string[]) => void;
  onClearSelection: () => void;
  onBatchDelete: () => void;
  onBatchSetClassStatus: (status: CourseClassStatus) => void;
  onBatchSetPaymentStatus: (status: PaymentStatus) => void;
}) {
  const weekDates = getWeekDates(selectedDate);
  const weekRecords = useMemo(() => getWeekRangeRecords(records, weekDates), [records, weekDates]);
  return (
    <section className="view-panel active" data-panel="week">
      <div className="day-header">
        <div>
          <h3>{formatWeekRangeLabel(locale, weekDates[0], weekDates[6])}</h3>
        </div>
        <div className="week-nav">
          <Button variant="ghost" size="icon" className="month-step week-step" onClick={() => onShiftWeek(-7)} aria-label={getLocalizedValue(locale, "上一周", "Previous week")}>
            <ArrowLeft size={16} />
          </Button>
          <Button variant="ghost" size="sm" className="toolbar-link week-reset" onClick={onJumpToToday}>
            <CalendarRange size={13} strokeWidth={1.9} />
            {getLocalizedValue(locale, "本周", "This week")}
          </Button>
          <Button variant="ghost" size="icon" className="month-step week-step" onClick={() => onShiftWeek(7)} aria-label={getLocalizedValue(locale, "下一周", "Next week")}>
            <ArrowRight size={16} />
          </Button>
          <Button variant="outline" size="sm" className="range-action-button" onClick={onToggleLayout}>
            <ListFilter size={13} strokeWidth={1.9} />
            {layoutMode === "grid" ? getLocalizedValue(locale, "列表", "List") : getLocalizedValue(locale, "网格", "Grid")}
          </Button>
        </div>
      </div>

      {layoutMode === "grid" ? (
        <>
          <div className="week-board">
            <div className="week-grid-shell">
              <div className="week-grid-body">
                <TimeRail />
                <div className="week-columns">
                  {weekDates.map((date) => {
                    const events = getEventsForDate(records, studios, formatDateKey(date));
                    const active = formatDateKey(date) === formatDateKey(selectedDate);
                    return (
                      <div className={classNames("week-column", active && "active", isWeekend(date) && "weekend")} key={formatDateKey(date)}>
                        <button type="button" className="week-column-head" onClick={() => onSelectDate(date)} aria-label={getLocalizedValue(locale, `选择 ${weekdayLongLabelsByLocale.zh[date.getDay() === 0 ? 6 : date.getDay() - 1]} ${date.getDate()} 日`, `Select ${weekdayLongLabelsByLocale.en[date.getDay() === 0 ? 6 : date.getDay() - 1]} ${date.getDate()}`)}>
                          <strong>{weekdayLongLabelsByLocale[locale][date.getDay() === 0 ? 6 : date.getDay() - 1]}</strong>
                          <span>{date.getDate()}</span>
                        </button>
                        <div className="week-column-track">
                          {events.map((event) => {
                            const top = ((toTimeMinutes(event.time) - 7 * 60) / 60) * 3.8;
                            const height = Math.max(((toTimeMinutes(event.end) - toTimeMinutes(event.time)) / 60) * 3.8, 2.3);
                            return (
                              <EventCard
                                key={`${event.date}-${event.time}-${event.title}`}
                                event={event}
                                onOpenDetail={onOpenDetail}
                                style={{
                                  top: `${top}rem`,
                                  height: `${height}rem`,
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <WeekMobileView locale={locale} weekDates={weekDates} selectedDate={selectedDate} onSelectDate={onSelectDate} onOpenDetail={onOpenDetail} records={records} studios={studios} />
        </>
      ) : (
        <RangeListView
          locale={locale}
          records={weekRecords}
          studios={studios}
          onOpenDetail={onOpenDetail}
          summaryLabel={getLocalizedValue(locale, "周度列表", "Week list")}
          selectedIds={selectedIds}
          onToggleSelected={onToggleSelected}
          onSelectAllVisible={onSelectAllVisible}
          onClearSelection={onClearSelection}
          onBatchDelete={onBatchDelete}
          onBatchSetClassStatus={onBatchSetClassStatus}
          onBatchSetPaymentStatus={onBatchSetPaymentStatus}
        />
      )}
    </section>
  );
}

function DayView({
  locale,
  data,
  onOpenDetail,
  onSelectDate,
  onJumpToToday,
  onShiftWeek,
  records,
  studios,
}: {
  locale: UILocale;
  data: ReturnType<typeof useMonthState>;
  onOpenDetail: (recordId: string) => void;
  onSelectDate: (date: Date) => void;
  onJumpToToday: () => void;
  onShiftWeek: (delta: number) => void;
  records: CourseRecord[];
  studios: StudioRecord[];
}) {
  const dateKey = data.selectedKey;
  const events = getEventsForDate(records, studios, dateKey);
  const weekDates = getWeekDates(data.selectedDate);
  return (
    <section className="view-panel active" data-panel="day">
      <div className="day-header">
        <div>
          <h3>{data.dayDetail.title}</h3>
        </div>
        <div className="day-nav">
          <Button variant="ghost" size="sm" className="toolbar-link day-reset" onClick={onJumpToToday}>
            <CalendarDays size={13} strokeWidth={1.9} />
            {getLocalizedValue(locale, "今天", "Today")}
          </Button>
        </div>
      </div>

      <div className="day-date-strip-shell">
        <Button variant="ghost" size="icon" className="month-step week-step day-week-step" onClick={() => onShiftWeek(-7)} aria-label={getLocalizedValue(locale, "上一周", "Previous week")}>
          <ArrowLeft size={12} />
        </Button>
        <div className="day-date-strip" aria-label="Week dates">
          {weekDates.map((date) => {
            const active = formatDateKey(date) === dateKey;
            return (
              <button key={formatDateKey(date)} type="button" className={classNames("day-date-chip", active && "active")} onClick={() => onSelectDate(date)}>
                <strong>{weekdayLongLabelsByLocale[locale][date.getDay() === 0 ? 6 : date.getDay() - 1]}</strong>
                <span>{date.getDate()}</span>
              </button>
            );
          })}
        </div>
        <Button variant="ghost" size="icon" className="month-step week-step day-week-step" onClick={() => onShiftWeek(7)} aria-label={getLocalizedValue(locale, "下一周", "Next week")}>
          <ArrowRight size={12} />
        </Button>
      </div>

      <DayTimeline locale={locale} date={data.selectedDate} events={events} onOpenDetail={onOpenDetail} />

      <div className="day-summary">
        {data.dayDetail.summary.map((item) => (
          <div className="stat-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="agenda-list">
        {data.dayDetail.items.length > 0 ? (
          data.dayDetail.items.map((item, index) => (
            <button className="agenda-row" type="button" key={`${item.time}-${item.title}`} onClick={() => onOpenDetail(events[index]?.id ?? "")}>
              <span className="agenda-time">{item.time}</span>
              <span className="agenda-main">
                <strong>{item.title}</strong>
                <small>{item.meta}</small>
              </span>
              <span className="agenda-meta">{item.fee}</span>
            </button>
          ))
        ) : (
          <div className="empty-state">
            <strong>{getLocalizedValue(locale, "今天没有课程", "No classes today")}</strong>
            <p>{getLocalizedValue(locale, "可以切换到其他日期，或点击悬浮按钮添加课程。", "Open another date or add a class from the floating button.")}</p>
          </div>
        )}
      </div>

    </section>
  );
}

function ReconcilePage({
  locale,
  data,
  onPrevMonth,
  onNextMonth,
  onJumpToCurrentMonth,
  onSettlePreviousMonth,
  onResetPreviousMonth,
}: {
  locale: UILocale;
  data: ReturnType<typeof useReconcileState>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onJumpToCurrentMonth: () => void;
  onSettlePreviousMonth: (studioId: string) => void;
  onResetPreviousMonth: (studioId: string) => void;
}) {
  const summaryRows = data.summaryRows;

  return (
    <section className="page-panel">
      <div className="reconcile-header">
        <div>
          <SectionLabel>{getLocalizedValue(locale, "对账", "Reconcile")}</SectionLabel>
          <h3>{data.monthLabel}</h3>
          <p>{getLocalizedValue(locale, `当前页只显示上月课时收款信息。已到账工作室 ${data.totalStudiosWithReceipts} 家，待到账 ${data.totalStudiosWaiting} 家。`, `This page only shows last month's class payment information. ${data.totalStudiosWithReceipts} studios have receipts and ${data.totalStudiosWaiting} are still waiting.`)}</p>
        </div>
        <div className="reconcile-nav">
          <Button variant="ghost" size="icon" className="month-step" onClick={onPrevMonth} aria-label={getLocalizedValue(locale, "上个月", "Previous month")}>
            <ArrowLeft size={16} />
          </Button>
          <Button variant="ghost" size="sm" className="toolbar-link reconcile-reset" onClick={onJumpToCurrentMonth}>
            <CalendarDays size={13} strokeWidth={1.9} />
            {getLocalizedValue(locale, "本月", "Current")}
          </Button>
          <Button variant="ghost" size="icon" className="month-step" onClick={onNextMonth} aria-label={getLocalizedValue(locale, "下个月", "Next month")}>
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>

      <div className="summary-strip">
        <div className="stat-card"><span>{getLocalizedValue(locale, "总课时", "Total sessions")}</span><strong>{data.totalSessions}</strong></div>
        <div className="stat-card"><span>{getLocalizedValue(locale, "应收", "Receivable")}</span><strong>{formatCurrency(data.totalReceivable)}</strong></div>
        <div className="stat-card"><span>{getLocalizedValue(locale, "实收", "Received")}</span><strong>{formatCurrency(data.totalReceived)}</strong></div>
        <div className="stat-card"><span>{getLocalizedValue(locale, "待到账工作室", "Waiting studios")}</span><strong>{data.totalStudiosWaiting}</strong></div>
      </div>

      <div className="stack-section">
        {summaryRows.map((row) => (
          <article className="reconcile-card" key={row.studio}>
            <div className="reconcile-top">
              <div>
                <strong>{row.studio}</strong>
                <p>{getLocalizedValue(locale, `总课时 ${row.sessions} · 停课 ${row.canceled} · 请假 ${row.leave}`, `Total ${row.sessions} · Canceled ${row.canceled} · Leave ${row.leave}`)}</p>
              </div>
              <div className="reconcile-top-actions">
                <div className="reconcile-actions-row">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="reconcile-settle"
                    disabled={row.settleableCount === 0}
                    onClick={() => onSettlePreviousMonth(row.studioId)}
                  >
                    一键已收
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="reconcile-reset"
                    disabled={row.settleableCount === 0}
                    onClick={() => onResetPreviousMonth(row.studioId)}
                  >
                    一键重置
                  </Button>
                </div>
                <Badge variant={row.status === "已到账" ? "success" : row.status === "部分已收" ? "warning" : "secondary"}>{row.status}</Badge>
              </div>
            </div>
            <dl className="metrics">
              <div><dt>{getLocalizedValue(locale, "应收", "Receivable")}</dt><dd>{row.receivable}</dd></div>
              <div><dt>{getLocalizedValue(locale, "实收", "Received")}</dt><dd>{row.received}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function StudioPage({
  locale,
  studios,
  onAddStudio,
  onOpenStudio,
  onArchiveStudio,
  onRestoreStudio,
}: {
  locale: UILocale;
  studios: typeof initialStudioRows;
  onAddStudio: () => void;
  onOpenStudio: (studio: StudioRecord) => void;
  onArchiveStudio: (studio: StudioRecord) => void;
  onRestoreStudio: (studio: StudioRecord) => void;
}) {
  return (
    <section className="page-panel">
      <div className="section-head">
        <div>
          <SectionLabel>{getLocalizedValue(locale, "工作室", "Studio")}</SectionLabel>
          <h3>{getLocalizedValue(locale, "工作室列表", "Studio list")}</h3>
        </div>
        <button className="text-button" type="button" onClick={onAddStudio}>
          {getLocalizedValue(locale, "+ 新增工作室", "+ New studio")}
        </button>
      </div>
      <div className="list-stack">
        {studios.map((studio) => (
          <div className={classNames("list-row", "studio-row", studio.archivedAt && "is-archived")} key={studio.id}>
            <button className="list-row-main" type="button" onClick={() => onOpenStudio(studio)} aria-label={getLocalizedValue(locale, `查看工作室 ${studio.name}`, `Open studio ${studio.name}`)}>
              <strong>{studio.name}</strong>
              <p>{formatStudioDisplayTypes(studio.displayTypes, locale)} · {studio.baseFee} · {studio.payDay}</p>
              <small>{studio.contact}</small>
            </button>
            <div className="studio-badge-stack">
              {studio.archivedAt ? <Badge variant="secondary">{getLocalizedValue(locale, "已归档", "Archived")}</Badge> : null}
              {studio.displayTypes.slice(0, 2).map((type) => (
                <Badge key={type} variant={getStudioTypeTone(type)}>{formatCourseTypeLabel(locale, type)}</Badge>
              ))}
              {studio.displayTypes.length > 2 ? <Badge variant="secondary">+{studio.displayTypes.length - 2}</Badge> : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="archive-action"
                onClick={() => (studio.archivedAt ? onRestoreStudio(studio) : onArchiveStudio(studio))}
              >
                {studio.archivedAt ? getLocalizedValue(locale, "恢复", "Restore") : getLocalizedValue(locale, "归档", "Archive")}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SettingsPage({
  locale,
  themeMode,
  onLocaleChange,
  onThemeChange,
}: {
  locale: UILocale;
  themeMode: ThemeMode;
  onLocaleChange: (locale: UILocale) => void;
  onThemeChange: (theme: ThemeMode) => void;
}) {
  const copy = locale === "zh"
    ? {
        languageTitle: "语言",
        languageDesc: "切换界面语言。",
        themeTitle: "白天 / 夜晚",
        themeDesc: "切换浅色或深色模式。",
        languageZh: "中文",
        languageEn: "English",
        dayMode: "白天模式",
        nightMode: "夜晚模式",
      }
    : {
        languageTitle: "Language",
        languageDesc: "Switch the interface language.",
        themeTitle: "Day / night",
        themeDesc: "Toggle light or dark mode.",
        languageZh: "中文",
        languageEn: "English",
        dayMode: "Day mode",
        nightMode: "Night mode",
      };

  return (
    <section className="page-panel">
      <div className="section-head">
        <div>
          <SectionLabel>{getLocalizedValue(locale, "设置", "Settings")}</SectionLabel>
          <h3>{getLocalizedValue(locale, "界面偏好", "Preferences")}</h3>
        </div>
      </div>

      <div className="settings-grid">
        <article className="settings-card">
          <strong>{copy.languageTitle}</strong>
          <p>{copy.languageDesc}</p>
          <div className="settings-actions">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={classNames("settings-toggle", locale === "zh" && "is-selected")}
              onClick={() => onLocaleChange("zh")}
            >
              {copy.languageZh}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={classNames("settings-toggle", locale === "en" && "is-selected")}
              onClick={() => onLocaleChange("en")}
            >
              {copy.languageEn}
            </Button>
          </div>
        </article>
        <article className="settings-card">
          <strong>{copy.themeTitle}</strong>
          <p>{copy.themeDesc}</p>
          <div className="settings-actions">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={classNames("settings-toggle", themeMode === "light" && "is-selected")}
              onClick={() => onThemeChange("light")}
            >
              {copy.dayMode}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={classNames("settings-toggle", themeMode === "dark" && "is-selected")}
              onClick={() => onThemeChange("dark")}
            >
              {copy.nightMode}
            </Button>
          </div>
        </article>
      </div>
    </section>
  );
}

function MorePage({
  section,
  setSection,
  studios,
  locale,
  themeMode,
  onLocaleChange,
  onThemeChange,
  onAddStudio,
  onOpenStudio,
  onArchiveStudio,
  onRestoreStudio,
}: {
  section: MoreSection;
  setSection: (section: MoreSection) => void;
  studios: typeof initialStudioRows;
  locale: UILocale;
  themeMode: ThemeMode;
  onLocaleChange: (locale: UILocale) => void;
  onThemeChange: (theme: ThemeMode) => void;
  onAddStudio: () => void;
  onOpenStudio: (studio: StudioRecord) => void;
  onArchiveStudio: (studio: StudioRecord) => void;
  onRestoreStudio: (studio: StudioRecord) => void;
}) {
  const tabLabels = locale === "zh"
    ? { settings: "设置", studio: "工作室" }
    : { settings: "Settings", studio: "Studio" };

  return (
    <section className="page-panel">

      <div className="secondary-tabs">
        {[
          ["settings", tabLabels.settings],
          ["studio", tabLabels.studio],
        ].map(([key, label]) => (
          <button
            key={key}
            data-testid={`more-${key}`}
            type="button"
            className={classNames("chip", section === key && "active")}
            onClick={() => setSection(key as MoreSection)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="more-stack">
        {section === "settings" ? (
          <SettingsPage
            locale={locale}
            themeMode={themeMode}
            onLocaleChange={onLocaleChange}
            onThemeChange={onThemeChange}
          />
        ) : section === "studio" ? (
          <StudioPage
            studios={studios}
            onAddStudio={onAddStudio}
            onOpenStudio={onOpenStudio}
            onArchiveStudio={onArchiveStudio}
            onRestoreStudio={onRestoreStudio}
          />
        ) : null}
      </div>
    </section>
  );
}

function StudioDialog({
  locale,
  open,
  onClose,
  mode,
  studio,
  onCreate,
  onUpdate,
}: {
  locale: UILocale;
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  studio: StudioRecord | null;
  onCreate: (studio: StudioRecord) => void;
  onUpdate: (studio: StudioRecord) => void;
}) {
  const seed: StudioDraft = {
    name: "",
    address: "",
    baseFee: "300",
    feeUnit: "/ hour",
    payDay: "28",
    cancelCompensationRatio: "50",
    weeklySessionCount: "1",
    displayTypes: ["Regular"],
    contactName: "",
    contactMethod: "",
    note: "",
    groupTag: "General",
  };

  const isEditMode = mode === "edit";
  const [name, setName] = useState(seed.name);
  const [address, setAddress] = useState(seed.address);
  const [baseFee, setBaseFee] = useState(seed.baseFee);
  const [feeUnit, setFeeUnit] = useState(seed.feeUnit);
  const [payDay, setPayDay] = useState(seed.payDay);
  const [cancelCompensationRatio, setCancelCompensationRatio] = useState(seed.cancelCompensationRatio);
  const [weeklySessionCount, setWeeklySessionCount] = useState(seed.weeklySessionCount);
  const [displayTypes, setDisplayTypes] = useState<CourseType[]>(seed.displayTypes);
  const [contactName, setContactName] = useState(seed.contactName);
  const [contactMethod, setContactMethod] = useState(seed.contactMethod);
  const [note, setNote] = useState(seed.note);
  const [groupTag, setGroupTag] = useState(seed.groupTag);

  useEffect(() => {
    if (open) {
      const source = studio ?? null;
      setName(source?.name ?? seed.name);
      setAddress(source?.address ?? seed.address);
      setBaseFee(source ? source.baseFee.replace(/^¥/, "").split(" ")[0] ?? seed.baseFee : seed.baseFee);
      setFeeUnit(source?.feeUnit === "/ session" || source?.feeUnit === "/ class" || source?.feeUnit === "/ month" ? "/ hour" : source?.feeUnit ?? seed.feeUnit);
      setPayDay(source?.payDay ?? seed.payDay);
      setCancelCompensationRatio(normalizePercentageInput(source?.cancelCompensationRatio ?? seed.cancelCompensationRatio));
      setWeeklySessionCount(source?.weeklySessionCount ?? seed.weeklySessionCount);
      setDisplayTypes(source?.displayTypes?.length ? source.displayTypes : seed.displayTypes);
      setContactName(source?.contactName ?? seed.contactName);
      setContactMethod(source?.contactMethod ?? seed.contactMethod);
      setNote(source?.note ?? seed.note);
      setGroupTag(source?.groupTag ?? seed.groupTag);
    }
  }, [open, studio]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    const nextStudio: StudioRecord = {
      id: studio?.id ?? `studio-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: name.trim(),
      displayTypes: uniqueStudioTypes(displayTypes.length > 0 ? displayTypes : seed.displayTypes),
      baseFee: `¥${baseFee.trim()} ${feeUnit}`,
      payDay,
      contact: [contactName.trim(), contactMethod.trim()].filter(Boolean).join(" · "),
      note: note.trim(),
      weeklySessionCount: weeklySessionCount.trim() || "1",
      address: address.trim(),
      feeUnit: "/ hour",
      cancelCompensationRatio: normalizePercentageInput(cancelCompensationRatio),
      contactName: contactName.trim(),
      contactMethod: contactMethod.trim(),
      groupTag: groupTag.trim(),
    };
    if (isEditMode) {
      onUpdate(nextStudio);
    } else {
      onCreate(nextStudio);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="editor-dialog">
        <DialogHeader>
          <DialogTitle>{isEditMode ? getLocalizedValue(locale, "工作室详情", "Studio details") : getLocalizedValue(locale, "新增工作室", "New studio")}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? getLocalizedValue(locale, "查看完整工作室信息，仅更新当前工作室。", "Review the full studio record and update only this studio.")
              : getLocalizedValue(locale, "记录用于排课和结算的工作室信息。", "Capture the studio details used for scheduling and settlement.")}
          </DialogDescription>
        </DialogHeader>

        <div className="editor-scroll">
          {isEditMode ? (
            <div className="editor-section">
              <div className="editor-section-head">
                <strong>{getLocalizedValue(locale, "概览", "Overview")}</strong>
                <span>{getLocalizedValue(locale, "可编辑的工作室记录", "Editable studio record")}</span>
              </div>
              <div className="detail-grid">
                <div><span>{getLocalizedValue(locale, "工作室", "Studio")}</span><strong>{name || getLocalizedValue(locale, "未命名工作室", "Untitled studio")}</strong></div>
                <div>
                  <span>{getLocalizedValue(locale, "展示类型", "Display type")}</span>
                  <strong className="studio-type-summary">
                    {displayTypes.length > 0 ? displayTypes.map((type) => (
                      <Badge key={type} variant={getStudioTypeTone(type)}>{formatCourseTypeLabel(locale, type)}</Badge>
                    )) : getLocalizedValue(locale, "未设置", "Not set")}
                  </strong>
                </div>
                <div><span>{getLocalizedValue(locale, "每周排课节数", "Weekly classes")}</span><strong>{weeklySessionCount || "1"} / {getLocalizedValue(locale, "周", "week")}</strong></div>
                <div><span>{getLocalizedValue(locale, "费用", "Fee")}</span><strong>{`¥${baseFee || "0"} / ${getLocalizedValue(locale, "小时", "hour")}`}</strong></div>
                <div><span>{getLocalizedValue(locale, "打款日", "Pay day")}</span><strong>{payDay}</strong></div>
                <div><span>{getLocalizedValue(locale, "联系人", "Contact")}</span><strong>{[contactName, contactMethod].filter(Boolean).join(" · ") || getLocalizedValue(locale, "未设置", "Not set")}</strong></div>
              </div>
            </div>
          ) : null}

          <div className="editor-section">
              <div className="editor-section-head">
              <strong>{getLocalizedValue(locale, "工作室信息", "Studio details")}</strong>
              <span>{getLocalizedValue(locale, "仅本地管理", "Local management only")}</span>
              </div>
              <div className="form-grid">
                <label className="ui-field">
                <span>{getLocalizedValue(locale, "工作室名称", "Studio name")}</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder={getLocalizedValue(locale, "输入工作室名称", "Enter studio name")} />
                </label>
                <label className="ui-field">
                <span>{getLocalizedValue(locale, "分组标签", "Group tag")}</span>
                <input value={groupTag} onChange={(event) => setGroupTag(event.target.value)} placeholder={getLocalizedValue(locale, "主教室", "Main room")} />
                </label>
                <label className="wide ui-field">
                <span>{getLocalizedValue(locale, "地址", "Address")}</span>
                <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder={getLocalizedValue(locale, "工作室地址", "Studio address")} />
                </label>
                <label className="ui-field">
                <span>{getLocalizedValue(locale, "每周排课节数", "Weekly classes")}</span>
                <input type="number" min="0" value={weeklySessionCount} onChange={(event) => setWeeklySessionCount(event.target.value)} inputMode="numeric" placeholder="2" />
                <small className="field-hint">{getLocalizedValue(locale, "按周填写排课节数，不与其他表关联。", "Enter weekly classes. This does not link to other tables.")}</small>
                </label>
            </div>
          </div>

          <div className="editor-section">
            <div className="editor-section-head">
              <strong>{getLocalizedValue(locale, "费用与结算", "Fee and settlement")}</strong>
              <span>{getLocalizedValue(locale, "基础费用和打款日", "Base fee and pay day")}</span>
            </div>
            <div className="form-grid">
              <label className="ui-field">
                <span>{getLocalizedValue(locale, "基础费用", "Base fee")}</span>
                <div className="field-with-suffix">
                  <input value={baseFee} onChange={(event) => setBaseFee(event.target.value)} placeholder="300" />
                  <span>{getLocalizedValue(locale, "/小时", "/ hour")}</span>
                </div>
              </label>
              <label className="ui-field">
                <span>{getLocalizedValue(locale, "打款日", "Pay day")}</span>
                <input type="number" min="1" max="31" value={payDay} onChange={(event) => setPayDay(event.target.value)} placeholder="28" />
              </label>
              <label className="ui-field">
                <span>{getLocalizedValue(locale, "停课补偿比例", "Cancel ratio")}</span>
                <div className="inline-field percentage-field">
                  <input inputMode="decimal" value={cancelCompensationRatio} onChange={(event) => setCancelCompensationRatio(normalizePercentageInput(event.target.value))} placeholder="50" />
                  <span>%</span>
                </div>
              </label>
            </div>
          </div>

          <div className="editor-section">
            <div className="editor-section-head">
              <strong>{getLocalizedValue(locale, "联系信息", "Contact")}</strong>
              <span>{getLocalizedValue(locale, "联系人和联系方式", "Contact person and method")}</span>
            </div>
            <div className="form-grid">
              <label className="ui-field">
                <span>{getLocalizedValue(locale, "联系人姓名", "Contact name")}</span>
                <input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Miki" />
              </label>
              <label className="ui-field">
                <span>{getLocalizedValue(locale, "联系方式", "Contact method")}</span>
                <input value={contactMethod} onChange={(event) => setContactMethod(event.target.value)} placeholder="138-0000-0001" />
              </label>
              <label className="wide ui-field">
                <span>{getLocalizedValue(locale, "备注", "Notes")}</span>
                <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder={getLocalizedValue(locale, "可选备注", "Optional notes")} />
              </label>
            </div>
          </div>

          <div className="editor-section">
            <div className="editor-section-head">
              <strong>{getLocalizedValue(locale, "展示类型", "Display type")}</strong>
              <span>{getLocalizedValue(locale, "可多选标签", "Multiple tags are allowed")}</span>
            </div>
            <div className="studio-type-picker" role="group" aria-label={getLocalizedValue(locale, "工作室展示类型", "Studio display type")}>
              {studioDisplayTypeOptions.map((option) => {
                const selected = displayTypes.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    className={cn("studio-type-chip", `studio-type-chip--${option.toLowerCase().replace(/\s+/g, "-")}`, selected && "is-selected")}
                    aria-pressed={selected}
                    onClick={() => setDisplayTypes((current) => toggleStudioType(current, option))}
                  >
                    {selected ? "✓" : "+"}
                    <span>{formatCourseTypeLabel(locale, option)}</span>
                  </button>
                );
              })}
            </div>
            <small className="field-hint">{getLocalizedValue(locale, "选择一个或多个该工作室可用于的课程类型。", "Select one or more types that this studio can be used for.")}</small>
          </div>

          <div className="sheet-actions">
            <Button variant="outline" size="sm" onClick={onClose}>
              {getLocalizedValue(locale, "取消", "Cancel")}
            </Button>
            <Button size="sm" onClick={handleSubmit}>
              {isEditMode ? getLocalizedValue(locale, "更新工作室", "Update studio") : getLocalizedValue(locale, "创建工作室", "Create studio")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailSheet({
  locale,
  open,
  onClose,
  onEdit,
  onDelete,
  record,
  studios,
}: {
  locale: UILocale;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  record: CourseRecord | null;
  studios: StudioRecord[];
}) {
  const studio = record ? getStudioById(studios, record.studioId) : null;
  const paymentStatus = record ? getEffectivePaymentStatus(record, studio) : "未收";
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="detail-dialog">
        <DialogHeader>
          <DialogTitle>{getLocalizedValue(locale, "课程详情", "Class detail")}</DialogTitle>
          <DialogDescription>{getLocalizedValue(locale, "查看当前课程记录、重复规则和主要操作。", "Review the current class record, repeat rule, and primary actions.")}</DialogDescription>
        </DialogHeader>

        <div className="detail-scroll">
          <div className="sheet-card">
          {record ? (
            <>
              <div className="detail-grid">
                <div><span>{getLocalizedValue(locale, "日期", "Date")}</span><strong>{record.date}</strong></div>
                <div><span>{getLocalizedValue(locale, "时间", "Time")}</span><strong>{record.time} - {record.end}</strong></div>
                <div><span>{getLocalizedValue(locale, "课程状态", "Class status")}</span><strong>{formatClassStatusLabel(locale, record.classStatus)}</strong></div>
                <div><span>{getLocalizedValue(locale, "收款状态", "Payment status")}</span><strong>{formatPaymentStatusLabel(locale, paymentStatus)}</strong></div>
                <div><span>{getLocalizedValue(locale, "费用", "Fee")}</span><strong>{formatCurrency(getRecordFeeValue(record))}</strong></div>
                <div><span>{getLocalizedValue(locale, "工作室", "Studio")}</span><strong>{studio?.name ?? record.studio}</strong></div>
                <div><span>{getLocalizedValue(locale, "内容", "Content")}</span><strong>{record.contentTag || record.title}</strong></div>
                <div><span>{getLocalizedValue(locale, "内容说明", "Content description")}</span><strong>{record.contentDescription || getLocalizedValue(locale, "未设置", "Not set")}</strong></div>
                <div><span>{getLocalizedValue(locale, "提前出发时间", "Departure")}</span><strong>{record.departureMinutes} {getLocalizedValue(locale, "分钟", "min")}</strong></div>
                <div><span>{getLocalizedValue(locale, "应收", "Receivable")}</span><strong>{formatCurrency(getRecordFeeValue(record))}</strong></div>
                <div><span>{getLocalizedValue(locale, "已收", "Received")}</span><strong>{formatCurrency(getRecordReceivedValue(record))}</strong></div>
                <div><span>{getLocalizedValue(locale, "预计应收", "Expected receivable")}</span><strong>{formatCurrency(parseNumericValue(record.actualReceivableAmount) || getRecordFeeValue(record))}</strong></div>
                <div><span>{getLocalizedValue(locale, "实际收款", "Actual received")}</span><strong>{formatCurrency(parseNumericValue(record.actualReceivedAmount))}</strong></div>
                <div><span>{getLocalizedValue(locale, "打款日期", "Payment date")}</span><strong>{record.paymentTime || getLocalizedValue(locale, "未设置", "Not set")}</strong></div>
                <div><span>{getLocalizedValue(locale, "重复", "Repeat")}</span><strong>{getRepeatRuleLabel(locale, record)}</strong></div>
                <div><span>{getLocalizedValue(locale, "音乐备注", "Music note")}</span><strong>{record.musicNote || getLocalizedValue(locale, "未设置", "Not set")}</strong></div>
                <div><span>{getLocalizedValue(locale, "附件", "Attachments")}</span><strong>{record.attachments || getLocalizedValue(locale, "未设置", "Not set")}</strong></div>
                <div><span>{getLocalizedValue(locale, "周末", "Weekend")}</span><strong>{record.weekend ? getLocalizedValue(locale, "是", "Yes") : getLocalizedValue(locale, "否", "No")}</strong></div>
                <div><span>{getLocalizedValue(locale, "备注", "Note")}</span><strong>{record.note || getLocalizedValue(locale, "未设置", "Not set")}</strong></div>
                <div><span>{getLocalizedValue(locale, "创建时间", "Created")}</span><strong>{record.createdAt}</strong></div>
                <div><span>{getLocalizedValue(locale, "更新时间", "Updated")}</span><strong>{record.updatedAt}</strong></div>
              </div>

              <div className="repeat-box">
                <SectionLabel>{getLocalizedValue(locale, "重复规则", "Repeat rule")}</SectionLabel>
                <strong>{getRepeatRuleLabel(locale, record)}</strong>
                <p>{record.contentDescription || record.note || getLocalizedValue(locale, "无额外备注", "No extra note")}</p>
              </div>

              <div className="repeat-box">
                <SectionLabel>{getLocalizedValue(locale, "历史", "History")}</SectionLabel>
                <strong>{getLocalizedValue(locale, "创建时间", "Created")} {record.createdAt}</strong>
                <p>{getLocalizedValue(locale, "更新时间", "Updated")} {record.updatedAt}</p>
              </div>

              <div className="sheet-actions">
                <Button variant="outline" size="sm" onClick={onEdit}>{getLocalizedValue(locale, "编辑", "Edit")}</Button>
                <Button variant="destructive" size="sm" onClick={onDelete}>{getLocalizedValue(locale, "删除", "Delete")}</Button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <strong>{getLocalizedValue(locale, "未选择课程", "No class selected")}</strong>
              <p>{getLocalizedValue(locale, "请从月视图、周视图或日视图打开一条课程记录。", "Open a class from month, week, or day view to inspect it.")}</p>
            </div>
          )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({
  locale,
  open,
  onClose,
  onConfirm,
  record,
  studios,
}: {
  locale: UILocale;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  record: CourseRecord | null;
  studios: StudioRecord[];
}) {
  const studioName = record ? getStudioDisplayName(studios, record.studioId, record.studio) : "";
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="confirm-dialog">
        <DialogHeader>
          <DialogTitle>{getLocalizedValue(locale, "删除这条课程？", "Delete this class?")}</DialogTitle>
          <DialogDescription>{getLocalizedValue(locale, "这会移除当前课程记录。历史结算会保留，但所选记录会消失。", "This will remove the class record. Historical settlement stays intact, but the selected record will be gone.")}</DialogDescription>
        </DialogHeader>

        <div className="confirm-card">
          <strong>{record ? `${record.date} · ${record.time} - ${record.end}` : getLocalizedValue(locale, "未选择课程", "No class selected")}</strong>
          <p>{record ? `${studioName || record.studio} · ${formatCourseTypeLabel(locale, record.type)} · ${formatClassStatusLabel(locale, record.classStatus)} · ${formatPaymentStatusLabel(locale, record.paymentStatus)}` : getLocalizedValue(locale, "该操作只针对当前所选记录。", "This action only applies to the currently selected record.")}</p>
          {record ? <small>{record.repeatEnabled ? getLocalizedValue(locale, "这是一个开启了重复规则的记录。", "This record has repeat enabled.") : getLocalizedValue(locale, "这是一个单次手动记录。", "This is a one-off manual record.")}</small> : null}
        </div>

        <div className="sheet-actions">
          <Button variant="outline" size="sm" onClick={onClose}>{getLocalizedValue(locale, "取消", "Cancel")}</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>{getLocalizedValue(locale, "删除", "Delete")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({
  locale,
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmTone = "default",
}: {
  locale: UILocale;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmTone?: "default" | "destructive";
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="confirm-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="confirm-card">
          <p>{locale === "zh" ? "此操作会在应用内继续执行。" : "This action will continue inside the app."}</p>
        </div>

        <div className="sheet-actions">
          <Button variant="outline" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={confirmTone === "destructive" ? "destructive" : "default"} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CopyMonthDialog({
  locale,
  open,
  onClose,
  monthLabel,
  groups,
  onConfirm,
}: {
  locale: UILocale;
  open: boolean;
  onClose: () => void;
  monthLabel: string;
  groups: CopyPreviewGroup[];
  onConfirm: (strategy: "overwrite" | "skip" | "manual") => void;
}) {
  const [strategy, setStrategy] = useState<"overwrite" | "skip" | "manual">("skip");

  useEffect(() => {
    if (open) {
      setStrategy("skip");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="copy-dialog">
        <DialogHeader>
          <DialogTitle>{getLocalizedValue(locale, "预览上月", "Preview last month")}</DialogTitle>
          <DialogDescription>{getLocalizedValue(locale, "先按工作室查看上月内容，再复制到当前月。", "Review the previous month by studio before copying it into the current month.")}</DialogDescription>
        </DialogHeader>

        <div className="copy-preview-shell">
          <div className="copy-preview-head">
            <div>
              <SectionLabel>{getLocalizedValue(locale, "来源月份", "Source month")}</SectionLabel>
              <h4>{monthLabel}</h4>
            </div>
            <span className="text-button-like">{groups.reduce((sum, group) => sum + group.items.length, 0)} {getLocalizedValue(locale, "条", "blocks")}</span>
          </div>

          <div className="copy-preview-list">
            {groups.map((group) => (
              <article className="copy-group" key={group.studio}>
                <div className="copy-group-head">
                  <strong>{group.studio}</strong>
                  <span>{group.items.length} {getLocalizedValue(locale, "节课", "classes")}</span>
                </div>
                <div className="copy-group-items">
                  {group.items.map((item) => (
                    <div className="copy-row" key={`${group.studio}-${item.title}-${item.time}`}>
                      <div className="copy-row-main">
                        <strong>{item.weekday}</strong>
                        <p>
                          {item.time} · {item.title}
                        </p>
                      </div>
                      <div className="copy-row-meta">
                        <Badge variant="secondary">{item.type}</Badge>
                        <Badge variant="secondary">{item.repeat}</Badge>
                        <span>{item.fee}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="editor-section">
            <div className="editor-section-head">
              <strong>{getLocalizedValue(locale, "冲突处理", "Conflict handling")}</strong>
              <span>{getLocalizedValue(locale, "选择如何处理目标月份的重叠课程。", "Choose how to handle target-month overlaps")}</span>
            </div>
            <Select value={strategy} onValueChange={(value) => setStrategy(value as "overwrite" | "skip" | "manual")}>
              <SelectTrigger>
                <SelectValue placeholder={getLocalizedValue(locale, "选择策略", "Select strategy")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">{getLocalizedValue(locale, "跳过重复", "Skip duplicates")}</SelectItem>
                <SelectItem value="overwrite">{getLocalizedValue(locale, "覆盖重复", "Overwrite duplicates")}</SelectItem>
                <SelectItem value="manual">{getLocalizedValue(locale, "手动保留", "Manual keep")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="sheet-actions">
            <Button variant="outline" size="sm" onClick={onClose}>{getLocalizedValue(locale, "取消", "Cancel")}</Button>
            <Button size="sm" onClick={() => onConfirm(strategy)}>{getLocalizedValue(locale, "复制到本月", "Copy into this month")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditorSheet({
  locale,
  open,
  onClose,
  record,
  mode,
  studios,
  existingRecords,
  onCreate,
  onUpdate,
}: {
  locale: UILocale;
  open: boolean;
  onClose: () => void;
  record: CourseRecord | null;
  mode: EditorMode;
  studios: StudioRecord[];
  existingRecords: CourseRecord[];
  onCreate: (records: CourseRecord[]) => void;
  onUpdate: (record: CourseRecord) => void;
}) {
  const isEditMode = mode === "edit";
  const activeStudios = getActiveStudios(studios);
  const availableStudios = isEditMode ? studios : activeStudios.length > 0 ? activeStudios : studios;
  const [courseType, setCourseType] = useState<CourseType>(record?.type ?? "Regular");
  const [studioId, setStudioId] = useState(record?.studioId ?? studios[0]?.id ?? "");
  const [dateValue, setDateValue] = useState(record?.date ?? getBeijingDateKey());
  const [startHour, setStartHour] = useState(record?.time?.split(":")[0] ?? "18");
  const [startMinute, setStartMinute] = useState(record?.time?.split(":")[1] ?? "00");
  const [endHour, setEndHour] = useState(record?.end?.split(":")[0] ?? "19");
  const [endMinute, setEndMinute] = useState(record?.end?.split(":")[1] ?? "30");
  const [contentTag, setContentTag] = useState(record?.contentTag ?? "");
  const [contentDescription, setContentDescription] = useState(record?.contentDescription ?? "");
  const [fee, setFee] = useState(record ? String(getRecordFeeValue(record)) : "");
  const [paymentTime, setPaymentTime] = useState(normalizeDateOnlyValue(record?.paymentTime ?? record?.date ?? getBeijingDateKey()));
  const [classStatus, setClassStatus] = useState<CourseClassStatus>(record?.classStatus ?? "待开");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(record?.paymentStatus ?? "未收");
  const [departureMinutes, setDepartureMinutes] = useState(record?.departureMinutes ?? "30");
  const [musicNote, setMusicNote] = useState(record?.musicNote ?? "");
  const [attachments, setAttachments] = useState(record?.attachments ?? "");
  const [note, setNote] = useState(record?.note ?? "");
  const [actualReceivableAmount, setActualReceivableAmount] = useState(record?.actualReceivableAmount ?? "");
  const [actualReceivedAmount, setActualReceivedAmount] = useState(record?.actualReceivedAmount ?? "");
  const [repeatEnabled, setRepeatEnabled] = useState(Boolean(record?.repeatEnabled));
  const [repeatIntervalValue, setRepeatIntervalValue] = useState(record?.repeatIntervalValue ?? "1");
  const [repeatIntervalUnit, setRepeatIntervalUnit] = useState<RepeatUnit>(record?.repeatIntervalUnit ?? "week");
  const [repeatWeekday, setRepeatWeekday] = useState(record?.repeatWeekday ?? "Tuesday");
  const [repeatEndMode, setRepeatEndMode] = useState<RepeatEndMode>(record?.repeatEndMode ?? "count");
  const [repeatEndValue, setRepeatEndValue] = useState(record?.repeatEndValue ?? "");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!open) return;
    const source = record ?? null;
    setSubmitError("");
    setCourseType(source?.type ?? "Regular");
    setStudioId(source?.studioId ?? getStudioByName(studios, source?.studio ?? "")?.id ?? studios[0]?.id ?? "");
    setDateValue(source?.date ?? getBeijingDateKey());
    const parsedTime = parseTimeRange(source ? `${source.time} - ${source.end}` : null);
    setStartHour(parsedTime.startHour);
    setStartMinute(parsedTime.startMinute);
    setEndHour(parsedTime.endHour);
    setEndMinute(parsedTime.endMinute);
    setContentTag(source?.contentTag ?? "");
    setContentDescription(source?.contentDescription ?? "");
    setFee(source ? String(getRecordFeeValue(source)) : "");
    setPaymentTime(normalizeDateOnlyValue(source?.paymentTime ?? source?.date ?? getBeijingDateKey()));
    setClassStatus(source?.classStatus ?? "待开");
    setPaymentStatus(source?.paymentStatus ?? "未收");
    setDepartureMinutes(source?.departureMinutes ?? "30");
    setMusicNote(source?.musicNote ?? "");
    setAttachments(source?.attachments ?? "");
    setNote(source?.note ?? "");
    setActualReceivableAmount(source?.actualReceivableAmount ?? "");
    setActualReceivedAmount(source?.actualReceivedAmount ?? "");
    setRepeatEnabled(Boolean(source?.repeatEnabled));
    setRepeatIntervalValue(source?.repeatIntervalValue ?? "1");
    setRepeatIntervalUnit(source?.repeatIntervalUnit ?? "week");
    setRepeatWeekday(source?.repeatWeekday ?? "Tuesday");
    setRepeatEndMode(source?.repeatEndMode ?? "count");
    setRepeatEndValue(source?.repeatEndValue ?? "");
  }, [open, record, studios]);

  useEffect(() => {
    if (!open || isEditMode) return;
    if (isManualCreateType(courseType)) {
      setRepeatEnabled(false);
    }
  }, [open, isEditMode, courseType]);

  const supportsRepeatControls = isEditMode || shouldShowRepeatControls(courseType);
  const timePreview = `${startHour}:${startMinute} - ${endHour}:${endMinute}`;
  const paymentPreview = paymentTime || getLocalizedValue(locale, "未设置", "Not set");
  const createHint = isManualCreateType(courseType)
    ? getLocalizedValue(locale, "代课、私教和 workshop 以单次录入为主。", "Substitute, private, and workshop classes stay one-off by default.")
    : getLocalizedValue(locale, "常规课和小班课可以按需要打开重复规则。", "Regular and small group classes can open repeat rules when needed.");
  const submitLabel = isEditMode ? getLocalizedValue(locale, "更新", "Update") : getLocalizedValue(locale, "保存", "Save");
  const normalizedStudioId = studioId || getStudioByName(studios, record?.studio ?? "")?.id || studios[0]?.id || "";
  const selectedStudioName = getStudioDisplayName(studios, normalizedStudioId);

  const handleSubmit = async () => {
    setSubmitError("");
    const normalizedDate = dateValue || getBeijingDateKey();
    const normalizedPaymentTime = normalizeDateOnlyValue(paymentTime) || normalizedDate;
    const normalizedFee = fee.trim() || String(getCourseFee(courseType));
    if (!normalizedStudioId || !selectedStudioName) return;
    if (toTimeMinutes(`${endHour}:${endMinute}`) <= toTimeMinutes(`${startHour}:${startMinute}`)) {
      setSubmitError(getLocalizedValue(locale, "结束时间必须晚于开始时间。", "End time must be later than start time."));
      return;
    }
    const nextRecord: CourseRecord = {
      id: record?.id ?? `course-${normalizedDate}-${startHour}${startMinute}-${Math.random().toString(16).slice(2, 8)}`,
      date: normalizedDate,
      time: `${startHour}:${startMinute}`,
      end: `${endHour}:${endMinute}`,
      title: contentTag.trim() || `${selectedStudioName} · ${courseType}`,
      studioId: normalizedStudioId,
      studio: selectedStudioName,
      type: courseType,
      classStatus: isEditMode ? classStatus : "待开",
      paymentStatus: isEditMode ? paymentStatus : "未收",
      fee: normalizedFee,
      contentTag: contentTag.trim() || courseType,
      contentDescription: contentDescription.trim(),
      departureMinutes: departureMinutes.trim() || "30",
      musicNote: musicNote.trim(),
      attachments: attachments.trim(),
      note: note.trim(),
      paymentTime: normalizedPaymentTime,
      actualReceivableAmount: actualReceivableAmount.trim() || normalizedFee,
      actualReceivedAmount: actualReceivedAmount.trim() || (isEditMode && paymentStatus === "已收" ? normalizedFee : "0"),
      createdAt: record?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      weekend: new Date(`${normalizedDate}T00:00:00`).getDay() === 0 || new Date(`${normalizedDate}T00:00:00`).getDay() === 6,
      repeatEnabled: supportsRepeatControls ? repeatEnabled : false,
      repeatIntervalValue: supportsRepeatControls ? repeatIntervalValue : "1",
      repeatIntervalUnit: supportsRepeatControls ? repeatIntervalUnit : "week",
      repeatWeekday: supportsRepeatControls ? repeatWeekday : "Tuesday",
      repeatEndMode: supportsRepeatControls ? repeatEndMode : "count",
      repeatEndValue: supportsRepeatControls ? repeatEndValue : "",
    };
    const candidates = isEditMode ? [nextRecord] : buildCreatedCourseRecords({
      ...nextRecord,
      classStatus: "待开",
      paymentStatus: "未收",
      actualReceivedAmount: "0",
      actualReceivableAmount: actualReceivableAmount.trim() || normalizedFee,
    });
    const conflict = findTimeConflict(candidates, existingRecords, isEditMode ? nextRecord.id : undefined);
    if (conflict) {
      setSubmitError(formatTimeConflictLabel(locale, conflict));
      return;
    }

    if (isEditMode && nextRecord.classStatus === "待开" && nextRecord.paymentStatus === "已收") {
      const confirmed = await requestConfirm({
        title: getLocalizedValue(locale, "保存前确认", "Confirm before saving"),
        description: getLocalizedValue(locale, "待开 + 已收 不建议同时出现，仍然保存吗？", "Pending + paid is discouraged. Save anyway?"),
        confirmLabel: getLocalizedValue(locale, "仍然保存", "Save anyway"),
        cancelLabel: getLocalizedValue(locale, "取消", "Cancel"),
        confirmTone: "destructive",
      });
      if (!confirmed) return;
    }

    if (isEditMode) {
      onUpdate(nextRecord);
    } else {
      onCreate(candidates);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="editor-dialog">
        <DialogHeader>
          <DialogTitle>{isEditMode ? getLocalizedValue(locale, "编辑课程", "Edit class") : getLocalizedValue(locale, "新增课程", "Add class")}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? getLocalizedValue(locale, "查看全部字段，更新课程记录，并保持历史清晰。", "Review every field, update the class record, and keep the history explicit.")
              : getLocalizedValue(locale, "直接新建课程，不依赖模板。重复规则只在需要时展开。", "Create a class directly without templates. Repeat rules expand only when needed.")}
          </DialogDescription>
        </DialogHeader>

        <div className="editor-scroll">
          <div className="sheet-card editor-card">
            <div className="editor-banner">
              <div>
                <SectionLabel>{isEditMode ? getLocalizedValue(locale, "编辑模式", "Edit mode") : getLocalizedValue(locale, "新增模式", "Add mode")}</SectionLabel>
                <strong>{isEditMode ? getLocalizedValue(locale, "完整记录编辑", "Full record editing") : isManualCreateType(courseType) ? getLocalizedValue(locale, "单次课程录入", "One-off class entry") : getLocalizedValue(locale, "重复课程录入", "Repeatable class entry")}</strong>
                <p>{isEditMode ? getLocalizedValue(locale, "所有字段都可见，历史保持清晰。", "All fields are visible so history stays explicit.") : createHint}</p>
              </div>
              <Badge variant={isEditMode ? "warning" : "success"}>{isEditMode ? getLocalizedValue(locale, "编辑", "Edit") : getLocalizedValue(locale, "创建", "Create")}</Badge>
            </div>

            <div className="editor-section">
              <div className="editor-section-head">
                <strong>{getLocalizedValue(locale, "基础信息", "Basic info")}</strong>
                <span>{getLocalizedValue(locale, "工作室、日期和时间", "Studio, date, and time")}</span>
              </div>

              <div className="form-grid">
                <label className="ui-field">
                  <span>{getLocalizedValue(locale, "课程类型", "Course type")}</span>
                  <select data-testid="edit-type" value={courseType} onChange={(event) => setCourseType(event.target.value as CourseType)}>
                    {courseTypeOptions.map((type) => (
                      <option key={type} value={type}>{formatCourseTypeLabel(locale, type)}</option>
                    ))}
                  </select>
                </label>
                <label className="ui-field">
                  <span>{getLocalizedValue(locale, "工作室", "Studio")}</span>
                  <select data-testid="edit-studio" value={studioId} onChange={(event) => setStudioId(event.target.value)}>
                    {availableStudios.map((studioRecord) => (
                      <option key={studioRecord.id} value={studioRecord.id}>{studioRecord.name}</option>
                    ))}
                  </select>
                </label>
                <label className="ui-field">
                  <span>{getLocalizedValue(locale, "日期", "Date")}</span>
                  <input data-testid="edit-date" type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
                </label>
                <label className="wide ui-field">
                  <span>{getLocalizedValue(locale, "时间", "Time")}</span>
                  <div className="alarm-range" data-testid="edit-time">
                    <div className="alarm-block">
                      <span className="alarm-label">{getLocalizedValue(locale, "开始", "Start")}</span>
                      <div className="alarm-picker">
                        <Select value={startHour} onValueChange={setStartHour}>
                          <SelectTrigger className="alarm-select">
                            <SelectValue placeholder={getLocalizedValue(locale, "时", "HH")} />
                          </SelectTrigger>
                          <SelectContent>
                            {clockHourOptions.map((hour) => (
                              <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="alarm-divider">:</span>
                        <Select value={startMinute} onValueChange={setStartMinute}>
                          <SelectTrigger className="alarm-select">
                            <SelectValue placeholder={getLocalizedValue(locale, "分", "MM")} />
                          </SelectTrigger>
                          <SelectContent>
                            {clockMinuteOptions.map((minute) => (
                              <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="alarm-block">
                      <span className="alarm-label">{getLocalizedValue(locale, "结束", "End")}</span>
                      <div className="alarm-picker">
                        <Select value={endHour} onValueChange={setEndHour}>
                          <SelectTrigger className="alarm-select">
                            <SelectValue placeholder={getLocalizedValue(locale, "时", "HH")} />
                          </SelectTrigger>
                          <SelectContent>
                            {clockHourOptions.map((hour) => (
                              <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="alarm-divider">:</span>
                        <Select value={endMinute} onValueChange={setEndMinute}>
                          <SelectTrigger className="alarm-select">
                            <SelectValue placeholder={getLocalizedValue(locale, "分", "MM")} />
                          </SelectTrigger>
                          <SelectContent>
                            {clockMinuteOptions.map((minute) => (
                              <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="alarm-preview">{getLocalizedValue(locale, "时间段", "Time range")} · {timePreview}</div>
                </label>
              </div>
            </div>

            <div className="editor-section">
              <div className="editor-section-head">
                <strong>{getLocalizedValue(locale, "课程内容", "Content")}</strong>
                <span>{getLocalizedValue(locale, "这节课的内容", "What this class is about")}</span>
              </div>

              <div className="form-grid">
                <label className="ui-field">
                  <span>{getLocalizedValue(locale, "内容标签", "Content tag")}</span>
                  <input value={contentTag} onChange={(event) => setContentTag(event.target.value)} placeholder={getLocalizedValue(locale, "例如：核心编舞", "For example: core choreo")} />
                </label>
                <label className="wide ui-field">
                  <span>{getLocalizedValue(locale, "内容说明", "Content description")}</span>
                  <textarea rows={3} value={contentDescription} onChange={(event) => setContentDescription(event.target.value)} placeholder={getLocalizedValue(locale, "描述课程内容或提醒", "Describe the class content or reminder")} />
                </label>
              </div>
            </div>

            <div className="editor-section">
              <div className="editor-section-head">
                <strong>{getLocalizedValue(locale, "结算", "Settlement")}</strong>
                <span>{getLocalizedValue(locale, "打款日期始终必填", "Payment date is always required")}</span>
              </div>
              <div className="form-grid">
                <label className="wide ui-field">
                  <span>{getLocalizedValue(locale, "打款日期", "Payment date")}</span>
                  <input type="date" required value={paymentTime} onChange={(event) => setPaymentTime(event.target.value)} />
                  <small className="field-hint">{getLocalizedValue(locale, "无论是否有模板，新增课程都要填写这个日期。", "This field is required for every new class.")}</small>
                </label>
              </div>
            </div>

            <div className="editor-section">
              <div className="editor-section-head">
                <strong>{getLocalizedValue(locale, "费用", "Fee")}</strong>
                <span>{getLocalizedValue(locale, "金额与结算", "Amount and settlement")}</span>
              </div>
              <div className="form-grid">
                <label className="ui-field">
                  <span>{getLocalizedValue(locale, "费用", "Fee")}</span>
                  <input data-testid="edit-fee" type="text" value={fee} onChange={(event) => setFee(event.target.value)} />
                </label>
                {isEditMode ? (
                  <>
                    <label className="ui-field">
                      <span>{getLocalizedValue(locale, "课程状态", "Class status")}</span>
                      <select value={classStatus} onChange={(event) => setClassStatus(event.target.value as CourseClassStatus)}>
                        <option value="待开">{getLocalizedValue(locale, "待开", "Pending")}</option>
                        <option value="已开">{getLocalizedValue(locale, "已开", "Held")}</option>
                        <option value="停课">{getLocalizedValue(locale, "停课", "Canceled")}</option>
                        <option value="请假">{getLocalizedValue(locale, "请假", "Leave")}</option>
                      </select>
                    </label>
                    <label className="ui-field">
                      <span>{getLocalizedValue(locale, "收款状态", "Payment status")}</span>
                      <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus)}>
                        <option value="未收">{getLocalizedValue(locale, "未收", "Unpaid")}</option>
                        <option value="已收">{getLocalizedValue(locale, "已收", "Paid")}</option>
                        <option value="部分已收">{getLocalizedValue(locale, "部分已收", "Partially paid")}</option>
                        <option value="超时未收">{getLocalizedValue(locale, "超时未收", "Overdue unpaid")}</option>
                      </select>
                    </label>
                    <label className="ui-field">
                      <span>{getLocalizedValue(locale, "预计应收", "Expected receivable")}</span>
                      <input type="text" value={actualReceivableAmount} onChange={(event) => setActualReceivableAmount(event.target.value)} placeholder={getLocalizedValue(locale, "可选", "Optional")} />
                    </label>
                    <label className="ui-field">
                      <span>{getLocalizedValue(locale, "实际收款", "Received amount")}</span>
                      <input type="text" value={actualReceivedAmount} onChange={(event) => setActualReceivedAmount(event.target.value)} placeholder={getLocalizedValue(locale, "可选", "Optional")} />
                    </label>
                    <label className="ui-field">
                      <span>{getLocalizedValue(locale, "提前出发时间", "Departure minutes")}</span>
                      <input type="number" min="0" value={departureMinutes} onChange={(event) => setDepartureMinutes(event.target.value)} />
                    </label>
                    <label className="ui-field">
                      <span>{getLocalizedValue(locale, "音乐备注", "Music note")}</span>
                      <input type="text" value={musicNote} onChange={(event) => setMusicNote(event.target.value)} placeholder={getLocalizedValue(locale, "播放备注或音乐提示", "Playback notes or music cues")} />
                    </label>
                    <label className="wide ui-field">
                      <span>{getLocalizedValue(locale, "附件", "Attachments")}</span>
                      <input type="text" value={attachments} onChange={(event) => setAttachments(event.target.value)} placeholder={getLocalizedValue(locale, "本地附件引用", "Local attachment references")} />
                    </label>
                    <label className="wide ui-field">
                      <span>{getLocalizedValue(locale, "备注", "Note")}</span>
                      <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder={getLocalizedValue(locale, "可选备注", "Optional notes")} />
                    </label>
                  </>
                ) : (
                  <div className="wide create-default-note">
                    <strong>{getLocalizedValue(locale, "保存后默认值", "Defaults on save")}</strong>
                    <p>{getLocalizedValue(locale, "新增时课程状态默认待开，收款状态默认未收。", "New classes default to Pending and Unpaid.")}</p>
                  </div>
                )}
              </div>
            </div>

            {supportsRepeatControls ? (
              <div className="editor-section">
                <div className="editor-section-head">
                  <strong>{getLocalizedValue(locale, "重复排课", "Repeat schedule")}</strong>
                  <span>{getLocalizedValue(locale, "确认需要重复时再展开详细规则", "Expand details only when repeat is enabled")}</span>
                </div>

                <div className="repeat-section">
                  <div className="repeat-toggle">
                    <div>
                      <span>{getLocalizedValue(locale, "是否重复", "Repeat class")}</span>
                      <small>{repeatEnabled ? getLocalizedValue(locale, "已展开重复规则。", "Repeat details are expanded.") : getLocalizedValue(locale, "当前只显示折叠状态。", "Repeat rules stay collapsed until enabled.")}</small>
                    </div>
                    <label className="switch">
                      <input data-testid="repeat-enable" type="checkbox" checked={repeatEnabled} onChange={(event) => setRepeatEnabled(event.target.checked)} />
                      <span />
                    </label>
                  </div>

                  {repeatEnabled ? (
                    <>
                      <div className="repeat-fields">
                        <label className="ui-field">
                          <span>{getLocalizedValue(locale, "重复间隔", "Repeat interval")}</span>
                          <div className="inline-field">
                            <input data-testid="repeat-interval-value" type="number" min="1" value={repeatIntervalValue} onChange={(event) => setRepeatIntervalValue(event.target.value)} />
                            <select data-testid="repeat-interval-unit" value={repeatIntervalUnit} onChange={(event) => setRepeatIntervalUnit(event.target.value as RepeatUnit)}>
                              <option value="week">{getLocalizedValue(locale, "周", "week")}</option>
                              <option value="month">{getLocalizedValue(locale, "月", "month")}</option>
                            </select>
                          </div>
                        </label>

                        <label className="ui-field">
                          <span>{getLocalizedValue(locale, "重复日期", "Repeat on")}</span>
                          <select data-testid="repeat-weekday" value={repeatWeekday} onChange={(event) => setRepeatWeekday(event.target.value)}>
                            {weekdayOptionsByLocale.en.map((weekday) => (
                              <option key={weekday} value={weekday}>{formatWeekdayLabel(locale, weekday)}</option>
                            ))}
                          </select>
                        </label>

                        <label className="ui-field">
                          <span>{getLocalizedValue(locale, "结束方式", "Ends")}</span>
                          <div className="inline-field">
                            <select data-testid="repeat-end-mode" value={repeatEndMode} onChange={(event) => setRepeatEndMode(event.target.value as RepeatEndMode)}>
                              <option value="count">{getLocalizedValue(locale, "按次数结束", "After")}</option>
                              <option value="date">{getLocalizedValue(locale, "按日期结束", "Until")}</option>
                              <option value="month">{getLocalizedValue(locale, "按月末结束", "At month end")}</option>
                            </select>
                            <input data-testid="repeat-end-value" type="text" value={repeatEndValue} onChange={(event) => setRepeatEndValue(event.target.value)} />
                          </div>
                        </label>
                      </div>

                      <div className="repeat-summary">
                        <strong>{getRepeatRuleLabel(locale, {
                          repeatEnabled,
                          repeatIntervalValue,
                          repeatIntervalUnit,
                          repeatWeekday,
                          repeatEndMode,
                          repeatEndValue,
                        })}</strong>
                        <p>{paymentPreview}</p>
                      </div>
                    </>
                  ) : (
                    <div className="create-default-note">
                      <strong>{getLocalizedValue(locale, "重复规则未展开", "Repeat rules collapsed")}</strong>
                      <p>{getLocalizedValue(locale, "如果这节课需要重复，打开开关后再填写详细规则。", "Turn on the switch and fill the repeat details only if this class should repeat.")}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="editor-section footer-section">
              {mode === "edit" ? (
                <div className="create-default-note">
                  <strong>{getLocalizedValue(locale, "当前打款日期", "Current payment date")}</strong>
                  <p>{paymentPreview}</p>
                </div>
              ) : null}

              {submitError ? <div className="submit-error" role="alert">{submitError}</div> : null}

              <div className="sheet-actions">
                <Button variant="outline" size="sm" onClick={onClose}>
                  {getLocalizedValue(locale, "取消", "Cancel")}
                </Button>
                <Button size="sm" onClick={handleSubmit}>
                  {submitLabel}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HomePage({ locale, activeView, setActiveView, data, setActiveMonthOffset, onSelectDate, onCopyLastMonth, onOpenDetail, onAdd, onToday, onJumpToToday, onShiftWeek, records, studios, monthLayoutMode, weekLayoutMode, onToggleMonthLayout, onToggleWeekLayout, monthListSelection, weekListSelection, onToggleMonthListSelection, onToggleWeekListSelection, onSelectAllMonthList, onSelectAllWeekList, onClearMonthListSelection, onClearWeekListSelection, onBatchDeleteMonthList, onBatchDeleteWeekList, onBatchSetMonthListClassStatus, onBatchSetWeekListClassStatus, onBatchSetMonthListPaymentStatus, onBatchSetWeekListPaymentStatus }: {
  locale: UILocale;
  activeView: View;
  setActiveView: (view: View) => void;
  data: ReturnType<typeof useMonthState>;
  setActiveMonthOffset: (offset: number) => void;
  onSelectDate: (date: Date) => void;
  onCopyLastMonth: () => void;
  onOpenDetail: (recordId: string) => void;
  onAdd: () => void;
  onToday: () => void;
  onJumpToToday: () => void;
  onShiftWeek: (delta: number) => void;
  records: CourseRecord[];
  studios: StudioRecord[];
  monthLayoutMode: LayoutMode;
  weekLayoutMode: LayoutMode;
  onToggleMonthLayout: () => void;
  onToggleWeekLayout: () => void;
  monthListSelection: string[];
  weekListSelection: string[];
  onToggleMonthListSelection: (recordId: string) => void;
  onToggleWeekListSelection: (recordId: string) => void;
  onSelectAllMonthList: (recordIds: string[]) => void;
  onSelectAllWeekList: (recordIds: string[]) => void;
  onClearMonthListSelection: () => void;
  onClearWeekListSelection: () => void;
  onBatchDeleteMonthList: () => void;
  onBatchDeleteWeekList: () => void;
  onBatchSetMonthListClassStatus: (status: CourseClassStatus) => void;
  onBatchSetWeekListClassStatus: (status: CourseClassStatus) => void;
  onBatchSetMonthListPaymentStatus: (status: PaymentStatus) => void;
  onBatchSetWeekListPaymentStatus: (status: PaymentStatus) => void;
}) {
  void setActiveMonthOffset;
  void onToday;
  return (
    <>
      {activeView === "month" && (
        <MonthView
          locale={locale}
          data={data}
          studios={studios}
          onSelectDate={onSelectDate}
          onCopyLastMonth={onCopyLastMonth}
          onOpenDetail={onOpenDetail}
          layoutMode={monthLayoutMode}
          onToggleLayout={onToggleMonthLayout}
          selectedIds={monthListSelection}
          onToggleSelected={onToggleMonthListSelection}
          onSelectAllVisible={onSelectAllMonthList}
          onClearSelection={onClearMonthListSelection}
          onBatchDelete={onBatchDeleteMonthList}
          onBatchSetClassStatus={onBatchSetMonthListClassStatus}
          onBatchSetPaymentStatus={onBatchSetMonthListPaymentStatus}
        />
      )}
      {activeView === "week" && (
        <WeekView
          locale={locale}
          selectedDate={data.selectedDate}
          onSelectDate={onSelectDate}
          onOpenDetail={onOpenDetail}
          onJumpToToday={onJumpToToday}
          onShiftWeek={onShiftWeek}
          records={records}
          studios={studios}
          layoutMode={weekLayoutMode}
          onToggleLayout={onToggleWeekLayout}
          selectedIds={weekListSelection}
          onToggleSelected={onToggleWeekListSelection}
          onSelectAllVisible={onSelectAllWeekList}
          onClearSelection={onClearWeekListSelection}
          onBatchDelete={onBatchDeleteWeekList}
          onBatchSetClassStatus={onBatchSetWeekListClassStatus}
          onBatchSetPaymentStatus={onBatchSetWeekListPaymentStatus}
        />
      )}
      {activeView === "day" && <DayView locale={locale} data={data} onOpenDetail={onOpenDetail} onSelectDate={onSelectDate} onJumpToToday={onJumpToToday} onShiftWeek={onShiftWeek} records={records} studios={studios} />}
    </>
  );
}

function ReconcileView({
  locale,
  data,
  onPrevMonth,
  onNextMonth,
  onJumpToCurrentMonth,
  onSettlePreviousMonth,
  onResetPreviousMonth,
}: {
  locale: UILocale;
  data: ReturnType<typeof useReconcileState>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onJumpToCurrentMonth: () => void;
  onSettlePreviousMonth: (studioId: string) => void;
  onResetPreviousMonth: (studioId: string) => void;
}) {
  return (
    <ReconcilePage
      locale={locale}
      data={data}
      onPrevMonth={onPrevMonth}
      onNextMonth={onNextMonth}
      onJumpToCurrentMonth={onJumpToCurrentMonth}
      onSettlePreviousMonth={onSettlePreviousMonth}
      onResetPreviousMonth={onResetPreviousMonth}
    />
  );
}

export function App() {
  const [gateReady, setGateReady] = useState(false);
  const [entitled, setEntitled] = useState(() => hasActiveBetaSession());
  const [hydrated, setHydrated] = useState(false);
  const [uiLocale, setUiLocale] = useState<UILocale>(getInitialLocale());
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode());
  const [page, setPage] = useState<Page>("home");
  const [activeView, setActiveView] = useState<View>("month");
  const [monthLayoutMode, setMonthLayoutMode] = useState<LayoutMode>("grid");
  const [weekLayoutMode, setWeekLayoutMode] = useState<LayoutMode>("grid");
  const [activeMonthOffset, setActiveMonthOffset] = useState(0);
  const [reconcileMonthOffset, setReconcileMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [moreSection, setMoreSection] = useState<MoreSection>("settings");
  const [studioRows, setStudioRows] = useState<StudioRecord[]>(initialStudioRows);
  const [courseRecords, setCourseRecords] = useState<CourseRecord[]>(initialCourseRecords);
  const [studioDialogOpen, setStudioDialogOpen] = useState(false);
  const [studioDialogMode, setStudioDialogMode] = useState<"create" | "edit">("create");
  const [studioDialogStudio, setStudioDialogStudio] = useState<StudioRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [copyPreviewOpen, setCopyPreviewOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorRecord, setEditorRecord] = useState<CourseRecord | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const initialSnapshotSignatureRef = useRef<string | null>(null);
  const loadedSnapshotSignatureRef = useRef<string | null>(null);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);
  const [monthListSelection, setMonthListSelection] = useState<string[]>([]);
  const [weekListSelection, setWeekListSelection] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const entitlement = await readStoredBetaEntitlement();
      if (!active) return;
      if (entitlement) {
        setEntitled(true);
      } else {
        await clearBetaEntitlement();
        setEntitled(false);
      }
      setGateReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!gateReady || !entitled) return;
    let active = true;
    setHydrated(false);
    void (async () => {
      const snapshot = await readJson<unknown>(appSnapshotKey);
      if (!active) return;
      if (isAppSnapshot(snapshot)) {
        loadedSnapshotSignatureRef.current = JSON.stringify(snapshot);
        setPage(snapshot.page);
        setActiveView(snapshot.activeView);
        setActiveMonthOffset(snapshot.activeMonthOffset);
        setReconcileMonthOffset(snapshot.reconcileMonthOffset);
        setSelectedDate(new Date(snapshot.selectedDate));
        setMonthLayoutMode(snapshot.monthLayoutMode ?? "grid");
        setWeekLayoutMode(snapshot.weekLayoutMode ?? "grid");
        setMoreSection(snapshot.moreSection);
        setUiLocale(normalizeLocale(snapshot.uiLocale));
        setThemeMode(snapshot.themeMode);
        setStudioRows(normalizeSnapshotStudios(snapshot.studioRows));
        setCourseRecords(normalizeSnapshotRecords(snapshot.courseRecords));
      } else if (snapshot !== null) {
        await removeJson(appSnapshotKey);
        loadedSnapshotSignatureRef.current = null;
      } else {
        loadedSnapshotSignatureRef.current = null;
      }
      setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, [gateReady, entitled]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark");
    document.documentElement.setAttribute("lang", uiLocale === "zh" ? "zh-CN" : "en");
  }, [themeMode, uiLocale]);

  const safeStudioRows = Array.isArray(studioRows) ? studioRows : initialStudioRows;
  const safeCourseRecords = Array.isArray(courseRecords) ? courseRecords : initialCourseRecords;
  const data = useMonthState(uiLocale, activeMonthOffset, selectedDate, safeCourseRecords, safeStudioRows);
  const reconcileData = useReconcileState(uiLocale, reconcileMonthOffset, safeCourseRecords, safeStudioRows);
  const currentWeekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const currentWeekRecords = useMemo(() => getWeekRangeRecords(safeCourseRecords, currentWeekDates), [safeCourseRecords, currentWeekDates]);
  const monthTitle = formatMonthLabel(uiLocale, data.monthDate);
  const copyPreviewMonthDate = monthFromOffset(activeMonthOffset - 1);
  const copyPreviewMonthLabel = formatMonthLabel(uiLocale, copyPreviewMonthDate);
  const copyPreviewGroups = useMemo(() => buildCopyPreviewGroups(uiLocale, getMonthRecords(safeCourseRecords, formatMonthKey(copyPreviewMonthDate))), [uiLocale, safeCourseRecords, activeMonthOffset]);
  const selectedRecord = useMemo(() => safeCourseRecords.find((record) => record.id === selectedRecordId) ?? data.selectedRecords[0] ?? null, [safeCourseRecords, selectedRecordId, data.selectedRecords]);
  const monthRecordIdSet = useMemo(() => new Set(data.monthRecords.map((record) => record.id)), [data.monthRecords]);
  const weekRecordIdSet = useMemo(() => new Set(currentWeekRecords.map((record) => record.id)), [currentWeekRecords]);

  useEffect(() => {
    setMonthListSelection((current) => current.filter((id) => monthRecordIdSet.has(id)));
  }, [monthRecordIdSet]);

  useEffect(() => {
    setWeekListSelection((current) => current.filter((id) => weekRecordIdSet.has(id)));
  }, [weekRecordIdSet]);

  const buildSnapshot = useMemo(
    () => (): AppSnapshot => ({
      version: 6,
      page,
      activeView,
      activeMonthOffset,
      reconcileMonthOffset,
      selectedDate: selectedDate.toISOString(),
      monthLayoutMode,
      weekLayoutMode,
      moreSection,
      uiLocale,
      themeMode,
      studioRows: safeStudioRows,
      courseRecords: safeCourseRecords,
    }),
    [page, activeView, activeMonthOffset, reconcileMonthOffset, selectedDate, monthLayoutMode, weekLayoutMode, moreSection, uiLocale, themeMode, safeStudioRows, safeCourseRecords],
  );
  if (initialSnapshotSignatureRef.current === null) {
    initialSnapshotSignatureRef.current = JSON.stringify(buildSnapshot());
  }

  const closeConfirmDialog = (value: boolean) => {
    confirmResolverRef.current?.(value);
    confirmResolverRef.current = null;
    setConfirmDialog(null);
  };

  const requestConfirm = (dialog: ConfirmDialogState) =>
    new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmDialog(dialog);
    });

  const handleToday = () => {
    setActiveMonthOffset(0);
    setSelectedDate(new Date(initialDate));
    setActiveView("month");
    setMonthLayoutMode("grid");
    setWeekLayoutMode("grid");
    setPage("home");
  };

  const handleJumpToToday = () => {
    setActiveMonthOffset(0);
    setSelectedDate(new Date(initialDate));
  };

  const handleJumpToCurrentReconcileMonth = () => {
    setReconcileMonthOffset(0);
  };

  const handleShiftWeek = (delta: number) => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + delta);
    setSelectedDate(nextDate);
    setActiveMonthOffset(monthOffsetFromDate(nextDate));
  };

  const handleToggleMonthLayout = () => {
    setMonthLayoutMode((current) => (current === "grid" ? "list" : "grid"));
  };

  const handleToggleWeekLayout = () => {
    setWeekLayoutMode((current) => (current === "grid" ? "list" : "grid"));
  };

  const openEditor = ({
    record = null,
    mode = "create",
  }: {
    record?: CourseRecord | null;
    mode?: EditorMode;
  }) => {
    setEditorRecord(record);
    setEditorMode(mode);
    setEditorOpen(true);
  };

  const handleAddStudio = () => {
    setStudioDialogOpen(true);
    setStudioDialogMode("create");
    setStudioDialogStudio(null);
    setMoreSection("studio");
    setPage("more");
  };

  const handleOpenStudio = (studio: StudioRecord) => {
    setStudioDialogOpen(true);
    setStudioDialogMode("edit");
    setStudioDialogStudio(studio);
    setMoreSection("studio");
    setPage("more");
  };

  const handleCreateStudio = (studio: StudioRecord) => {
    setStudioRows((current) => [...toArray(current), studio]);
  };

  const handleUpdateStudio = (studio: StudioRecord) => {
    setStudioRows((current) =>
      toArray(current).map((row) => (row.id === studio.id ? { ...studio, archivedAt: row.archivedAt ?? studio.archivedAt } : row)),
    );
    setCourseRecords((current) =>
      toArray(current).map((record) =>
        record.studioId === studio.id
          ? {
              ...record,
              studio: studio.name,
              title: record.contentTag.trim() ? record.title : `${studio.name} · ${record.type}`,
              updatedAt: new Date().toISOString(),
            }
          : record,
      ),
    );
  };

  const handleArchiveStudio = (studio: StudioRecord) => {
    const linkedCourses = countLinkedCoursesByStudio(safeCourseRecords, studio.id);
    void (async () => {
      const confirmed = await requestConfirm({
        title: getLocalizedValue(uiLocale, "归档工作室", "Archive studio"),
        description: getLocalizedValue(uiLocale, `归档 ${studio.name}？有 ${linkedCourses} 条课程记录使用这个工作室。历史会保留，但这个工作室不会再出现在新建选择中。`, `Archive ${studio.name}? ${linkedCourses} class records use this studio. History stays intact, but the studio will be hidden from new selections.`),
        confirmLabel: getLocalizedValue(uiLocale, "继续归档", "Archive"),
        cancelLabel: getLocalizedValue(uiLocale, "取消", "Cancel"),
        confirmTone: "destructive",
      });
      if (!confirmed) return;
      const timestamp = new Date().toISOString();
      setStudioRows((current) =>
        toArray(current).map((row) => (row.id === studio.id ? { ...row, archivedAt: timestamp } : row)),
      );
    })();
  };

  const handleRestoreStudio = (studio: StudioRecord) => {
    setStudioRows((current) =>
      toArray(current).map((row) => (row.id === studio.id ? { ...row, archivedAt: undefined } : row)),
    );
  };

  const openCopyPreview = () => {
    setCopyPreviewOpen(true);
  };

  const handleOpenDetail = (recordId: string) => {
    if (!recordId) return;
    setSelectedRecordId(recordId);
    setDetailOpen(true);
  };

  const handleCreateRecord = (records: CourseRecord[]) => {
    const createdRecords = toArray(records);
    if (createdRecords.length === 0) return;
    setCourseRecords((current) => [...toArray(current), ...createdRecords]);
    const focusDate = new Date(`${createdRecords[0].date}T00:00:00`);
    setSelectedDate(focusDate);
    setActiveMonthOffset(monthOffsetFromDate(focusDate));
  };

  const handleUpdateRecord = (record: CourseRecord) => {
    setCourseRecords((current) => toArray(current).map((item) => (item.id === record.id ? record : item)));
    setSelectedRecordId(record.id);
    setSelectedDate(new Date(`${record.date}T00:00:00`));
    setActiveMonthOffset(monthOffsetFromDate(new Date(`${record.date}T00:00:00`)));
  };

  const handleDeleteRecord = () => {
    if (!selectedRecord) return;
    setCourseRecords((current) => toArray(current).filter((record) => record.id !== selectedRecord.id));
    setDeleteConfirmOpen(false);
    setDetailOpen(false);
    setSelectedRecordId(null);
  };

  const handleCopyCurrentMonth = (strategy: "overwrite" | "skip" | "manual") => {
    const sourceMonthDate = monthFromOffset(activeMonthOffset - 1);
    const sourceMonthKey = formatMonthKey(sourceMonthDate);
    const currentMonthKey = formatMonthKey(data.monthDate);
    const sourceMonthRecords = getMonthRecords(safeCourseRecords, sourceMonthKey);
    const hasCopyableRecords = sourceMonthRecords.some((record) => record.repeatEnabled);
    if (!hasCopyableRecords) {
      setCopyPreviewOpen(false);
      void (async () => {
        await requestConfirm({
          title: getLocalizedValue(uiLocale, "上月没课", "No classes last month"),
          description: getLocalizedValue(uiLocale, "上个月没有可复制的课程，已直接关闭复制窗口。", "There are no copyable classes last month, so the copy window has been closed."),
          confirmLabel: getLocalizedValue(uiLocale, "知道了", "Got it"),
          cancelLabel: getLocalizedValue(uiLocale, "关闭", "Close"),
        });
      })();
      return;
    }
    const copied = buildCopyRecords(safeCourseRecords, sourceMonthKey, currentMonthKey, strategy);
    setCourseRecords(copied);
    setCopyPreviewOpen(false);
  };

  const handleSettlePreviousMonth = (studioId: string) => {
    const targetMonthDate = reconcileData.previousMonthDate;
    const targetMonthKey = formatMonthKey(targetMonthDate);
    const receiptMonthEnd = new Date(reconcileData.monthDate.getFullYear(), reconcileData.monthDate.getMonth() + 1, 0);
    const receiptMonthValue = formatDateKey(receiptMonthEnd);
    setCourseRecords((current) => {
      const safeCurrent = toArray(current);
      const targetRecords = safeCurrent
        .filter((record) => record.studioId === studioId && getRecordMonthKey(record) === targetMonthKey)
        .sort(compareRecordDateTime);

      if (targetRecords.length === 0) return safeCurrent;

      return safeCurrent.map((record) => {
        if (record.studioId !== studioId || getRecordMonthKey(record) !== targetMonthKey) return record;
        const nextReceived = getRecordFeeValue(record);
        return {
          ...record,
          paymentStatus: "已收",
          paymentTime: receiptMonthValue,
          actualReceivedAmount: String(nextReceived),
          updatedAt: new Date().toISOString(),
        };
      });
    });
  };

  const handleResetPreviousMonth = (studioId: string) => {
    const targetMonthDate = reconcileData.previousMonthDate;
    const targetMonthKey = formatMonthKey(targetMonthDate);
    setCourseRecords((current) => {
      const safeCurrent = toArray(current);
      const targetRecords = safeCurrent
        .filter((record) => record.studioId === studioId && getRecordMonthKey(record) === targetMonthKey)
        .sort(compareRecordDateTime);

      if (targetRecords.length === 0) return safeCurrent;

      return safeCurrent.map((record) => {
        if (record.studioId !== studioId || getRecordMonthKey(record) !== targetMonthKey) return record;
        return {
          ...record,
          paymentStatus: "未收",
          paymentTime: "",
          actualReceivedAmount: "0",
          updatedAt: new Date().toISOString(),
        };
      });
    });
  };

  const applyBatchRecordChange = (recordIds: string[], updater: (record: CourseRecord) => CourseRecord | null) => {
    const recordIdSet = new Set(recordIds);
    if (recordIdSet.size === 0) return;
    setCourseRecords((current) => {
      const safeCurrent = toArray(current);
      return safeCurrent.flatMap((record) => {
        if (!recordIdSet.has(record.id)) return [record];
        const nextRecord = updater(record);
        return nextRecord ? [nextRecord] : [];
      });
    });
  };

  const clearMonthListSelection = () => setMonthListSelection([]);
  const clearWeekListSelection = () => setWeekListSelection([]);

  const toggleMonthListSelection = (recordId: string) => {
    setMonthListSelection((current) => (current.includes(recordId) ? current.filter((id) => id !== recordId) : [...current, recordId]));
  };

  const toggleWeekListSelection = (recordId: string) => {
    setWeekListSelection((current) => (current.includes(recordId) ? current.filter((id) => id !== recordId) : [...current, recordId]));
  };

  const selectAllMonthList = (recordIds: string[]) => setMonthListSelection(Array.from(new Set(recordIds)));
  const selectAllWeekList = (recordIds: string[]) => setWeekListSelection(Array.from(new Set(recordIds)));

  const handleBatchDelete = (recordIds: string[], clearSelection: () => void) => {
    if (recordIds.length === 0) return;
    void (async () => {
      const confirmed = await requestConfirm({
        title: getLocalizedValue(uiLocale, "批量删除", "Batch delete"),
        description: getLocalizedValue(uiLocale, `确定删除 ${recordIds.length} 条课程吗？`, `Delete ${recordIds.length} classes?`),
        confirmLabel: getLocalizedValue(uiLocale, "删除", "Delete"),
        cancelLabel: getLocalizedValue(uiLocale, "取消", "Cancel"),
        confirmTone: "destructive",
      });
      if (!confirmed) return;
      const idSet = new Set(recordIds);
      setCourseRecords((current) => toArray(current).filter((record) => !idSet.has(record.id)));
      if (selectedRecordId && idSet.has(selectedRecordId)) {
        setDetailOpen(false);
        setSelectedRecordId(null);
      }
      clearSelection();
    })();
  };

  const handleBatchSetClassStatus = (recordIds: string[], status: CourseClassStatus, clearSelection: () => void) => {
    if (recordIds.length === 0) return;
    applyBatchRecordChange(recordIds, (record) => ({
      ...record,
      classStatus: status,
      updatedAt: new Date().toISOString(),
    }));
    clearSelection();
    if (selectedRecordId && recordIds.includes(selectedRecordId)) {
      setSelectedRecordId(selectedRecordId);
    }
  };

  const handleBatchSetPaymentStatus = (recordIds: string[], status: PaymentStatus, clearSelection: () => void) => {
    if (recordIds.length === 0) return;
    const selectedRecords = safeCourseRecords.filter((record) => recordIds.includes(record.id));
    if (status === "已收" && selectedRecords.some((record) => record.classStatus === "待开")) {
      void (async () => {
        const confirmed = await requestConfirm({
          title: getLocalizedValue(uiLocale, "收款确认", "Confirm payment"),
          description: getLocalizedValue(uiLocale, "有待开课程被标记为已收，仍然继续吗？", "Some selected classes are still pending. Mark them as paid anyway?"),
          confirmLabel: getLocalizedValue(uiLocale, "继续", "Continue"),
          cancelLabel: getLocalizedValue(uiLocale, "取消", "Cancel"),
          confirmTone: "destructive",
        });
        if (!confirmed) return;
        const paymentDate = getBeijingDateKey();
        applyBatchRecordChange(recordIds, (record) => {
          const nextFee = getRecordFeeValue(record);
          return {
            ...record,
            paymentStatus: status,
            paymentTime: status === "已收" ? paymentDate : status === "未收" ? "" : record.paymentTime,
            actualReceivedAmount: status === "已收" ? String(nextFee) : status === "未收" ? "0" : record.actualReceivedAmount,
            updatedAt: new Date().toISOString(),
          };
        });
        clearSelection();
      })();
      return;
    }
    const paymentDate = getBeijingDateKey();
    applyBatchRecordChange(recordIds, (record) => {
      const nextFee = getRecordFeeValue(record);
      return {
        ...record,
        paymentStatus: status,
        paymentTime: status === "已收" ? paymentDate : status === "未收" ? "" : record.paymentTime,
        actualReceivedAmount: status === "已收" ? String(nextFee) : status === "未收" ? "0" : record.actualReceivedAmount,
        updatedAt: new Date().toISOString(),
      };
    });
    clearSelection();
  };

  const handleBatchDeleteMonthList = () => handleBatchDelete(monthListSelection, clearMonthListSelection);
  const handleBatchDeleteWeekList = () => handleBatchDelete(weekListSelection, clearWeekListSelection);
  const handleBatchSetMonthListClassStatus = (status: CourseClassStatus) =>
    handleBatchSetClassStatus(monthListSelection, status, clearMonthListSelection);
  const handleBatchSetWeekListClassStatus = (status: CourseClassStatus) =>
    handleBatchSetClassStatus(weekListSelection, status, clearWeekListSelection);
  const handleBatchSetMonthListPaymentStatus = (status: PaymentStatus) =>
    handleBatchSetPaymentStatus(monthListSelection, status, clearMonthListSelection);
  const handleBatchSetWeekListPaymentStatus = (status: PaymentStatus) =>
    handleBatchSetPaymentStatus(weekListSelection, status, clearWeekListSelection);

  useEffect(() => {
    if (!gateReady || !entitled || !hydrated) return;
    const snapshot = buildSnapshot();
    const signature = JSON.stringify(snapshot);
    if (loadedSnapshotSignatureRef.current === null && signature === initialSnapshotSignatureRef.current) return;
    loadedSnapshotSignatureRef.current = signature;
    void writeJson(appSnapshotKey, snapshot);
  }, [gateReady, entitled, hydrated, buildSnapshot]);

  const handleSubmitInviteCode = async (inviteCode: string) => {
    const entitlement = await validateBetaInviteCode(inviteCode);
    await saveBetaEntitlement(entitlement);
    setEntitled(true);
  };

  if (!gateReady) {
    return (
      <main className="invite-gate">
        <section className="invite-card">
          <span className="eyebrow">DanceGrid</span>
          <h1>{getLocalizedValue(uiLocale, "加载中", "Loading")}</h1>
          <p>{getLocalizedValue(uiLocale, "正在检查邀请码授权并加载已保存数据。", "Checking invite access and loading saved data.")}</p>
        </section>
      </main>
    );
  }

  if (!entitled) {
    return <InviteGateScreen locale={uiLocale} onSubmitInviteCode={handleSubmitInviteCode} />;
  }

  if (!hydrated) {
    return (
      <main className="invite-gate">
        <section className="invite-card">
          <span className="eyebrow">DanceGrid</span>
          <h1>{getLocalizedValue(uiLocale, "同步本地数据", "Syncing local data")}</h1>
          <p>{getLocalizedValue(uiLocale, "正在加载已保存的工作室和课程记录。", "Loading saved studios and class records.")}</p>
        </section>
      </main>
    );
  }

  return (
    <AppShell locale={uiLocale} page={page} setPage={setPage}>
      <MobileFrame
        locale={uiLocale}
        activeView={activeView}
        setActiveView={setActiveView}
        monthTitle={monthTitle}
        onPrevMonth={() => setActiveMonthOffset(monthOffsetFromDate(data.monthDate) - 1)}
        onNextMonth={() => setActiveMonthOffset(monthOffsetFromDate(data.monthDate) + 1)}
        onToday={handleToday}
        onAdd={() => openEditor({ mode: "create" })}
        page={page}
        setPage={setPage}
      >
        {page === "home" ? (
          <HomePage
            locale={uiLocale}
            activeView={activeView}
            setActiveView={setActiveView}
            data={data}
            setActiveMonthOffset={setActiveMonthOffset}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setActiveMonthOffset(monthOffsetFromDate(date));
            }}
            onCopyLastMonth={openCopyPreview}
            onOpenDetail={handleOpenDetail}
            onAdd={() => openEditor({ mode: "create" })}
            onToday={handleToday}
            onJumpToToday={handleJumpToToday}
            onShiftWeek={handleShiftWeek}
            records={safeCourseRecords}
            studios={safeStudioRows}
            monthLayoutMode={monthLayoutMode}
            weekLayoutMode={weekLayoutMode}
            onToggleMonthLayout={handleToggleMonthLayout}
            onToggleWeekLayout={handleToggleWeekLayout}
            monthListSelection={monthListSelection}
            weekListSelection={weekListSelection}
            onToggleMonthListSelection={toggleMonthListSelection}
            onToggleWeekListSelection={toggleWeekListSelection}
            onSelectAllMonthList={selectAllMonthList}
            onSelectAllWeekList={selectAllWeekList}
            onClearMonthListSelection={clearMonthListSelection}
            onClearWeekListSelection={clearWeekListSelection}
            onBatchDeleteMonthList={handleBatchDeleteMonthList}
            onBatchDeleteWeekList={handleBatchDeleteWeekList}
            onBatchSetMonthListClassStatus={handleBatchSetMonthListClassStatus}
            onBatchSetWeekListClassStatus={handleBatchSetWeekListClassStatus}
            onBatchSetMonthListPaymentStatus={handleBatchSetMonthListPaymentStatus}
            onBatchSetWeekListPaymentStatus={handleBatchSetWeekListPaymentStatus}
          />
        ) : page === "reconcile" ? (
          <ReconcileView
            locale={uiLocale}
            data={reconcileData}
            onPrevMonth={() => setReconcileMonthOffset((value) => value - 1)}
            onNextMonth={() => setReconcileMonthOffset((value) => value + 1)}
            onJumpToCurrentMonth={handleJumpToCurrentReconcileMonth}
            onSettlePreviousMonth={handleSettlePreviousMonth}
            onResetPreviousMonth={handleResetPreviousMonth}
          />
        ) : (
          <MorePage
            section={moreSection}
            setSection={setMoreSection}
            studios={safeStudioRows}
            locale={uiLocale}
            themeMode={themeMode}
            onLocaleChange={setUiLocale}
            onThemeChange={setThemeMode}
            onAddStudio={handleAddStudio}
            onOpenStudio={handleOpenStudio}
            onArchiveStudio={handleArchiveStudio}
            onRestoreStudio={handleRestoreStudio}
          />
        )}
      </MobileFrame>
      <DetailSheet
        locale={uiLocale}
        open={detailOpen}
        record={selectedRecord}
        studios={safeStudioRows}
        onClose={() => setDetailOpen(false)}
        onEdit={() => {
          setDetailOpen(false);
          openEditor({ record: selectedRecord, mode: "edit" });
        }}
        onDelete={() => {
          setDetailOpen(false);
          setDeleteConfirmOpen(true);
        }}
      />
      <ConfirmDialog
        locale={uiLocale}
        open={Boolean(confirmDialog)}
        onClose={() => closeConfirmDialog(false)}
        onConfirm={() => closeConfirmDialog(true)}
        title={confirmDialog?.title ?? ""}
        description={confirmDialog?.description ?? ""}
        confirmLabel={confirmDialog?.confirmLabel ?? getLocalizedValue(uiLocale, "确定", "Confirm")}
        cancelLabel={confirmDialog?.cancelLabel ?? getLocalizedValue(uiLocale, "取消", "Cancel")}
        confirmTone={confirmDialog?.confirmTone}
      />
      <DeleteConfirmDialog
        locale={uiLocale}
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteRecord}
        record={selectedRecord}
        studios={safeStudioRows}
      />
      <CopyMonthDialog locale={uiLocale} open={copyPreviewOpen} onClose={() => setCopyPreviewOpen(false)} monthLabel={copyPreviewMonthLabel} groups={copyPreviewGroups} onConfirm={handleCopyCurrentMonth} />
      <StudioDialog
        locale={uiLocale}
        open={studioDialogOpen}
        onClose={() => setStudioDialogOpen(false)}
        mode={studioDialogMode}
        studio={studioDialogStudio}
        onCreate={handleCreateStudio}
        onUpdate={handleUpdateStudio}
      />
      <EditorSheet
        locale={uiLocale}
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditorRecord(null);
          setEditorMode("create");
        }}
        record={editorRecord}
        mode={editorMode}
        studios={safeStudioRows}
        existingRecords={safeCourseRecords}
        onCreate={handleCreateRecord}
        onUpdate={handleUpdateRecord}
      />
    </AppShell>
  );
}
