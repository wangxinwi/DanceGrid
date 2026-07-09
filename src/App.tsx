import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";

type View = "month" | "week" | "day";
type Page = "home" | "reconcile" | "more";
type MoreSection = "settings" | "studio" | "templates";
type EditorMode = "create" | "edit";
type MonthKey = "2026-06" | "2026-07" | "2026-08";
type CourseType = "Regular" | "Substitute" | "Studio private" | "Student private" | "Small group" | "Workshop";

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
  studio: string;
  sessions: number;
  receivable: string;
  received: string;
  unpaid: string;
  overdue: string;
  payDay: string;
  status: "Paid" | "Pending" | "Overdue" | "Closed" | "Leave";
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

type ScheduleEvent = TimeBlock & {
  date: string;
};

type DayDetail = {
  title: string;
  dateLabel: string;
  items: AgendaItem[];
  summary: Array<{ label: string; value: string }>;
  repeatRule: string;
};

type TemplatePreset = {
  key: string;
  title: string;
  detail: string;
  extra: string;
  status: "Live" | "Draft" | "Hold";
  studio: string;
  type: CourseType;
  weekday: string;
  time: string;
  repeatUnit: "week" | "month";
  repeatEndMode: "count" | "date" | "month";
  repeatEndValue: string;
  fee: string;
};

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
};

type StudioDraft = {
  name: string;
  address: string;
  baseFee: string;
  feeUnit: string;
  payDay: string;
  cancelCompensationRatio: string;
  weeklySessionCount: string;
  displayTypes: CourseType[];
  contactName: string;
  contactMethod: string;
  note: string;
  groupTag: string;
};

type TemplateDraft = {
  title: string;
  studio: string;
  weekday: string;
  time: string;
  detail: string;
  extra: string;
  fee: string;
};

const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"];
const weekdayLongLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const courseTypeOptions: CourseType[] = [
  "Regular",
  "Substitute",
  "Studio private",
  "Student private",
  "Small group",
  "Workshop",
];
const studioDisplayTypeOptions = courseTypeOptions;
const studioFeeUnitOptions = ["/ session", "/ class", "/ month"] as const;
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
const initialDate = new Date(2026, 6, 7);
const clockHourOptions = Array.from({ length: 24 }, (_, index) => pad(index));
const clockMinuteOptions = Array.from({ length: 12 }, (_, index) => pad(index * 5));

const scheduleData: Record<MonthKey, ScheduleItem[]> = {
  "2026-06": [
    { date: "2026-06-04", fee: 300, sessions: 1 },
    { date: "2026-06-11", fee: 300, sessions: 2 },
    { date: "2026-06-18", fee: 500, sessions: 1 },
    { date: "2026-06-25", fee: 300, sessions: 2 },
  ],
  "2026-07": [
    { date: "2026-07-02", fee: 300, sessions: 2 },
    { date: "2026-07-04", fee: 200, sessions: 1 },
    { date: "2026-07-07", fee: 800, sessions: 2 },
    { date: "2026-07-09", fee: 300, sessions: 3 },
    { date: "2026-07-11", fee: 300, sessions: 1 },
    { date: "2026-07-16", fee: 600, sessions: 2 },
    { date: "2026-07-19", fee: 300, sessions: 1 },
    { date: "2026-07-24", fee: 300, sessions: 2 },
    { date: "2026-07-29", fee: 300, sessions: 1 },
  ],
  "2026-08": [],
};

const monthMetaData: Record<MonthKey, MonthMeta> = {
  "2026-06": {
    title: "June 2026",
    summary: [
      { label: "Sessions", value: "16" },
      { label: "Receivable", value: "¥4,800" },
      { label: "Received", value: "¥3,900" },
    ],
    list: [
      { time: "19:00", title: "Studio A", meta: "Regular · Open · Paid", fee: "¥300" },
      { time: "21:00", title: "Studio C", meta: "Workshop · Closed · Pending", fee: "¥500" },
    ],
    note: "Past month history is visible here, including fee totals and reconciliation context.",
  },
  "2026-07": {
    title: "July 2026",
    summary: [
      { label: "Sessions", value: "23" },
      { label: "Receivable", value: "¥6,900" },
      { label: "Received", value: "¥4,700" },
    ],
    list: [
      { time: "18:00", title: "Studio A", meta: "Regular · Open · Paid", fee: "¥300" },
      { time: "20:30", title: "Studio B", meta: "Studio private · Pending · Unpaid", fee: "¥500" },
    ],
    note: "Current month schedule with live day summary and reconciliation totals.",
  },
  "2026-08": {
    title: "August 2026",
    summary: [],
    list: [],
    note: "No classes have been added yet. Start from Add class or copy last month.",
  },
};

const reconcileRows: ReconcileRow[] = [
  {
    studio: "Studio A",
    sessions: 12,
    receivable: "¥3,600",
    received: "¥2,400",
    unpaid: "¥1,200",
    overdue: "¥0",
    payDay: "28th",
    status: "Paid",
  },
  {
    studio: "Studio B",
    sessions: 8,
    receivable: "¥2,800",
    received: "¥1,600",
    unpaid: "¥1,200",
    overdue: "¥600",
    payDay: "30th",
    status: "Overdue",
  },
  {
    studio: "Studio C",
    sessions: 5,
    receivable: "¥1,700",
    received: "¥1,700",
    unpaid: "¥0",
    overdue: "¥0",
    payDay: "31st",
    status: "Closed",
  },
];

const initialStudioRows: StudioRecord[] = [
  {
    id: "studio-a",
    name: "Studio A",
    displayTypes: ["Regular", "Small group"],
    baseFee: "¥300 / session",
    payDay: "28th",
    contact: "Miki · 138-0000-0001",
    note: "Repeat weekly Tue 18:00",
    weeklySessionCount: "2",
    address: "Central district",
    feeUnit: "/ session",
    cancelCompensationRatio: "50%",
    contactName: "Miki",
    contactMethod: "138-0000-0001",
    groupTag: "Main room",
  },
  {
    id: "studio-b",
    name: "Studio B",
    displayTypes: ["Studio private", "Student private"],
    baseFee: "¥500 / session",
    payDay: "30th",
    contact: "Ken · 138-0000-0002",
    note: "Weekend sessions included",
    weeklySessionCount: "1",
    address: "North district",
    feeUnit: "/ session",
    cancelCompensationRatio: "60%",
    contactName: "Ken",
    contactMethod: "138-0000-0002",
    groupTag: "Private room",
  },
  {
    id: "studio-c",
    name: "Studio C",
    displayTypes: ["Workshop"],
    baseFee: "¥800 / session",
    payDay: "31st",
    contact: "Aya · 138-0000-0003",
    note: "One-off events and special slots",
    weeklySessionCount: "1",
    address: "West district",
    feeUnit: "/ session",
    cancelCompensationRatio: "40%",
    contactName: "Aya",
    contactMethod: "138-0000-0003",
    groupTag: "Events",
  },
];

const initialTemplates: TemplatePreset[] = [
  {
    key: "studio-a-tue",
    title: "Tuesday 18:00 · Studio A",
    detail: "Repeats every week",
    extra: "Repeat for 8 weeks",
    status: "Live",
    studio: "Studio A",
    type: "Regular",
    weekday: "Tuesday",
    time: "18:00 - 19:30",
    repeatUnit: "week",
    repeatEndMode: "count",
    repeatEndValue: "8 weeks",
    fee: "300",
  },
  {
    key: "studio-b-fri",
    title: "Friday 20:30 · Studio B",
    detail: "Repeats every week",
    extra: "Repeat for 6 weeks",
    status: "Draft",
    studio: "Studio B",
    type: "Regular",
    weekday: "Friday",
    time: "20:30 - 22:00",
    repeatUnit: "week",
    repeatEndMode: "count",
    repeatEndValue: "6 weeks",
    fee: "500",
  },
  {
    key: "studio-c-sat",
    title: "Saturday 14:00 · Studio C",
    detail: "Regular class template",
    extra: "Repeat until Aug 2026",
    status: "Hold",
    studio: "Studio C",
    type: "Regular",
    weekday: "Saturday",
    time: "14:00 - 16:00",
    repeatUnit: "month",
    repeatEndMode: "date",
    repeatEndValue: "Aug 2026",
    fee: "300",
  },
];

const scheduleEvents: ScheduleEvent[] = [
  { date: "2026-07-07", time: "08:00", end: "09:00", title: "Warm-up", studio: "Studio A", type: "Regular", status: "Open", pay: "Paid", note: "Daily practice", weekend: false },
  { date: "2026-07-07", time: "10:30", end: "12:00", title: "Core Choreo", studio: "Studio A", type: "Regular", status: "Open", pay: "Paid", note: "Repeat weekly" },
  { date: "2026-07-07", time: "18:00", end: "19:30", title: "Private Coaching", studio: "Studio B", type: "Studio private", status: "Pending", pay: "Overdue", note: "Manual confirm" },
  { date: "2026-07-08", time: "09:30", end: "11:00", title: "Technique Lab", studio: "Studio A", type: "Regular", status: "Open", pay: "Paid", note: "Weekday flow" },
  { date: "2026-07-08", time: "18:00", end: "19:00", title: "Studio Check-in", studio: "Studio C", type: "Substitute", status: "Leave", pay: "Pending", note: "Adjusted this week", weekend: false },
  { date: "2026-07-09", time: "15:00", end: "16:30", title: "Youth Session", studio: "Studio C", type: "Small group", status: "Leave", pay: "Pending", note: "Weekend included", weekend: true },
  { date: "2026-07-10", time: "19:00", end: "20:30", title: "Night Drill", studio: "Studio B", type: "Student private", status: "Closed", pay: "Paid", note: "One-off slot" },
  { date: "2026-07-11", time: "20:30", end: "22:00", title: "Weekend Workshop", studio: "Studio B", type: "Workshop", status: "Closed", pay: "Paid", note: "Friday night block" },
  { date: "2026-07-12", time: "14:00", end: "15:30", title: "Open Training", studio: "Studio A", type: "Regular", status: "Open", pay: "Paid", note: "Weekend included", weekend: true },
  { date: "2026-07-13", time: "16:00", end: "18:00", title: "Wrap-up Rehearsal", studio: "Studio C", type: "Workshop", status: "Pending", pay: "Pending", note: "Sunday close", weekend: true },
];

const dayDetailByKey: Record<string, DayDetail> = {
  "2026-07-07": {
    title: "Tue, Jul 7",
    dateLabel: "July 7, 2026",
    summary: [
      { label: "Classes", value: "2" },
      { label: "Status", value: "Open" },
      { label: "Fee", value: "¥800" },
    ],
    repeatRule: "Repeats every week · Tuesday · 10:30 - 12:00 · Repeat for 8 weeks",
    items: [
      { time: "18:00", title: "Studio A", meta: "Regular · Open · Paid", fee: "¥300" },
      { time: "20:30", title: "Studio B", meta: "Studio private · Pending · Unpaid", fee: "¥500" },
    ],
  },
  "2026-07-08": {
    title: "Wed, Jul 8",
    dateLabel: "July 8, 2026",
    summary: [
      { label: "Classes", value: "1" },
      { label: "Status", value: "Pending" },
      { label: "Fee", value: "¥300" },
    ],
    repeatRule: "Repeats every week · Wednesday · 18:00 - 19:30 · Repeat until Aug 2026",
    items: [{ time: "18:00", title: "Studio A", meta: "Regular · Open · Paid", fee: "¥300" }],
  },
};

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

function getEventsForDate(dateKey: string) {
  return scheduleEvents.filter((event) => event.date === dateKey);
}

function formatWeekLabel(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
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

function formatStudioDisplayTypes(types: CourseType[]) {
  return types.length > 0 ? types.join(" · ") : "Not set";
}

function uniqueStudioTypes(types: CourseType[]) {
  return studioDisplayTypeOptions.filter((type) => types.includes(type));
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

function getCourseTypeHint(type: CourseType) {
  switch (type) {
    case "Regular":
      return "Regular classes are template-first and can show repeat rules.";
    case "Substitute":
      return "Substitute classes stay manual and keep the short form.";
    case "Studio private":
      return "Studio private classes keep the short form and require manual fee entry.";
    case "Student private":
      return "Student private classes stay focused on the core session details.";
    case "Small group":
      return "Small group classes can still use repeat details when needed.";
    case "Workshop":
      return "Workshops stay one-off and keep repeat controls hidden by default.";
  }
}

function shouldShowRepeatControls(type: CourseType) {
  return repeatSupportedTypes.has(type);
}

function isManualCreateType(type: CourseType) {
  return manualCreateTypes.has(type);
}

function groupTemplatesByStudio(source: TemplatePreset[]) {
  return source.reduce<CopyPreviewGroup[]>((groups, template) => {
    const group = groups.find((item) => item.studio === template.studio);
    const entry = {
      weekday: template.weekday,
      time: template.time,
      title: template.type,
      type: template.type,
      repeat: `${template.repeatUnit === "week" ? "Weekly" : "Monthly"} · ${template.repeatEndMode === "count" ? template.repeatEndValue : `Until ${template.repeatEndValue}`}`,
      fee: `¥${template.fee}`,
    };

    if (group) {
      group.items.push(entry);
    } else {
      groups.push({
        studio: template.studio,
        items: [entry],
      });
    }

    return groups;
  }, []);
}

function useMonthState(activeMonthOffset: number, selectedDate: Date) {
  return useMemo(() => {
    const monthDate = monthFromOffset(activeMonthOffset);
    const monthKey = formatMonthKey(monthDate);
    const monthMeta = monthMetaData[monthKey];
    const schedule = scheduleData[monthKey] ?? [];
    const totalSessions = schedule.reduce((sum, item) => sum + item.sessions, 0);
    const totalFee = schedule.reduce((sum, item) => sum + item.fee, 0);
    const totalReceived = monthKey === "2026-06" ? 3900 : monthKey === "2026-07" ? 4700 : 0;
    const gridDates = getGridDates(monthDate);
    const selectedKey = formatDateKey(selectedDate);
    const selectedEvents = getEventsForDate(selectedKey);
    const selectedItems = selectedEvents.map((event) => ({
      time: event.time,
      title: `${event.studio} · ${event.title}`,
      meta: `${event.type} · ${event.status} · ${event.pay}`,
      fee: `¥${getCourseFee(event.type)}`,
    }));
    const dayDetail = dayDetailByKey[selectedKey] ?? {
      title: formatWeekLabel(selectedDate),
      dateLabel: selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      summary: [
        { label: "Classes", value: String(selectedItems.length) },
        { label: "Status", value: selectedItems.length > 0 ? "Open" : "Empty" },
        { label: "Fee", value: selectedItems.length > 0 ? `¥${selectedEvents.reduce((sum, item) => sum + getCourseFee(item.type), 0)}` : "¥0" },
      ],
      repeatRule: "Repeat rule appears here after a class is selected.",
      items: selectedItems,
    };

    return {
      monthDate,
      monthKey,
      monthMeta,
      schedule,
      totalSessions,
      totalFee,
      totalReceived,
      gridDates,
      selectedKey,
      selectedDate,
      selectedItems,
      dayDetail,
    };
  }, [activeMonthOffset, selectedDate]);
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="section-label">{children}</p>;
}

function TabIcon({ name }: { name: "home" | "reconcile" | "more" }) {
  if (name === "home") return <Home size={18} strokeWidth={1.9} aria-hidden="true" />;
  if (name === "reconcile") return <ListFilter size={18} strokeWidth={1.9} aria-hidden="true" />;
  return <Settings2 size={18} strokeWidth={1.9} aria-hidden="true" />;
}

function AppShell({ page, setPage, children }: { page: Page; setPage: (page: Page) => void; children: ReactNode }) {
  return (
    <div className={classNames("app-shell", page === "home" && "home-shell", page !== "home" && "page-shell")}>
      <aside className="hero-copy">
        <p className="eyebrow">DanceGrid UI v0.1</p>
        <h1>Schedule and reconcile dance classes with one clean mobile workbench.</h1>
        <p className="lead">
          Designed for a street dance teacher checking the day’s classes after practice, editing repeat schedules, and settling fees without leaving the phone.
        </p>

        <div className="page-switcher desktop-switcher" aria-label="Pages">
          {[
            ["home", "Home"],
            ["reconcile", "Reconcile"],
            ["more", "Settings"],
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

function MobileFrame({ activeView, setActiveView, monthTitle, onPrevMonth, onNextMonth, onToday, onAdd, page, setPage, children }: {
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
                  <SectionLabel>Studio ledger</SectionLabel>
                  <div className="month-nav">
                    <Button variant="ghost" size="icon" className="month-step" onClick={onPrevMonth} aria-label="Previous month">
                      <ArrowLeft size={16} />
                    </Button>
                    <h2>{monthTitle}</h2>
                    <Button variant="ghost" size="icon" className="month-step" onClick={onNextMonth} aria-label="Next month">
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                </div>
                <div className="topbar-actions">
                  <Button variant="ghost" size="sm" className="toolbar-link today-link" onClick={onToday}>
                    Today
                  </Button>
                </div>
              </div>

              <Tabs value={activeView} onValueChange={(value) => setActiveView(value as View)}>
                <TabsList className="segmented view-tabs" aria-label="Views">
                  <TabsTrigger value="day">
                    <Clock3 size={13} strokeWidth={1.9} />
                    Day
                  </TabsTrigger>
                  <TabsTrigger value="week">
                    <CalendarRange size={13} strokeWidth={1.9} />
                    Week
                  </TabsTrigger>
                  <TabsTrigger value="month">
                    <CalendarDays size={13} strokeWidth={1.9} />
                    Month
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </>
          ) : (
            <div className="page-topbar">
              <div>
                <SectionLabel>{page === "reconcile" ? "Reconcile" : "Settings"}</SectionLabel>
                <h2>{page === "reconcile" ? "Monthly fee review" : "Secondary tools"}</h2>
              </div>
            </div>
          )}
        </div>

        <div className="screen-body">
          <main className="screen-main">{children}</main>

          <div className="mobile-bottom-nav" role="tablist" aria-label="Primary">
            {[
              ["home", "Home", Home],
              ["reconcile", "Reconcile", ListFilter],
              ["more", "Settings", Settings2],
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
            <Button type="button" className="fab" data-testid="add-class" onClick={onAdd} aria-label="Add class">
              <Plus size={18} />
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function MonthView({ data, onSelectDate, onCopyLastMonth, onOpenDetail }: { data: ReturnType<typeof useMonthState>; onSelectDate: (date: Date) => void; onCopyLastMonth: () => void; onOpenDetail: () => void }) {
  const selectedIsToday = data.selectedKey === formatDateKey(initialDate);
  const selectedEvents = getEventsForDate(data.selectedKey);
  const selectedItems = selectedEvents.map((event) => ({
    time: event.time,
    title: `${event.studio} · ${event.title}`,
    meta: `${event.type} · ${event.status} · ${event.pay}`,
    fee: `¥${getCourseFee(event.type)}`,
  }));
  const selectedExpectedIncome = selectedEvents.reduce((sum, item) => sum + getCourseFee(item.type), 0);
  const selectedSessions = selectedEvents.length;

  return (
    <section className="view-panel active" data-panel="month">
      <div className="month-header">
        <div>
          <SectionLabel>Month view</SectionLabel>
          <h3>{data.monthMeta.title}</h3>
        </div>
        <button className="text-button" type="button" onClick={onCopyLastMonth}>
          Copy last month
        </button>
      </div>

      <div className="month-grid-wrap">
        <div className="weekday-row" aria-hidden="true">
          {weekdayLabels.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>

        <div className="month-grid" role="grid" aria-label="Month calendar">
          {data.gridDates.map((date) => {
            const dateKey = formatDateKey(date);
            const inMonth = date.getMonth() === data.monthDate.getMonth();
            const classCount = getEventsForDate(dateKey).length;
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
            <SectionLabel>{selectedIsToday ? "今日待开课程" : "选中日期课表"}</SectionLabel>
            <h3>{data.selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</h3>
          </div>
          <span className="text-button-like">{selectedItems.length} classes</span>
        </div>

        <div className="today-stack">
          <div className="today-card">
            <div className="today-card-head">
              <strong>{selectedIsToday ? "今日待开课程" : "待开课程"}</strong>
              <span>{selectedItems.length} classes</span>
            </div>

            {selectedItems.length > 0 ? (
              <div className="today-list">
                {selectedItems.map((item) => (
                  <button className="agenda-row today-row" type="button" key={`${item.time}-${item.title}`} onClick={onOpenDetail}>
                    <span className="agenda-time">{item.time}</span>
                    <span className="agenda-main">
                      <strong>{item.title}</strong>
                      <small>{item.meta}</small>
                    </span>
                    <span className="agenda-meta">{item.fee}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state tight">
                <strong>No classes today</strong>
                <p>Today has no pending class yet.</p>
              </div>
            )}
          </div>

          <div className="today-card">
            <div className="today-card-head">
              <strong>{selectedIsToday ? "今日应该收入" : "本日应该收入"}</strong>
              <span>{selectedIsToday ? "Today" : "Selected"}</span>
            </div>
            <div className="today-income">
              <div className="today-income-amount">¥{selectedExpectedIncome}</div>
              <p>{selectedItems.length > 0 ? `${selectedItems.length} classes · ${selectedSessions} sessions` : "No classes scheduled for this date"}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TimeRail({ start = 7, end = 22, step = 1 }: { start?: number; end?: number; step?: number }) {
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

function EventCard({ event, style, onOpenDetail }: { event: ScheduleEvent; style: CSSProperties; onOpenDetail: () => void }) {
  return (
    <button
      className={classNames("schedule-event", `schedule-event-${event.type.toLowerCase()}`, event.weekend && "weekend")}
      type="button"
      style={style}
      onClick={onOpenDetail}
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
        <small>{event.studio}</small>
      </span>
      <span className="event-meta">
        <EventBadge label={event.type} tone={getCourseTypeTone(event.type)} />
        <EventBadge label={event.pay} tone={event.pay === "Paid" ? "success" : event.pay === "Pending" ? "warning" : "danger"} />
      </span>
      <span className="event-handle event-handle-top" aria-hidden="true" />
      <span className="event-handle event-handle-bottom" aria-hidden="true" />
    </button>
  );
}

function WeekAgendaCard({ event, onOpenDetail, style }: { event: ScheduleEvent; onOpenDetail: () => void; style?: CSSProperties }) {
  return (
    <button
      className={classNames("week-mobile-event", `week-mobile-event-${event.type.toLowerCase()}`, event.weekend && "weekend")}
      type="button"
      style={style}
      onClick={onOpenDetail}
      aria-label={`Open ${event.title}`}
    >
      <div className="week-mobile-event-time">
        {event.time}
        <small>{event.end}</small>
      </div>
      <div className="week-mobile-event-main">
        <strong>{event.title}</strong>
        <p>{event.studio}</p>
      </div>
      <div className="week-mobile-event-meta">
        <EventBadge label={event.type} tone={getCourseTypeTone(event.type)} />
        <EventBadge label={event.pay} tone={event.pay === "Paid" ? "success" : event.pay === "Pending" ? "warning" : "danger"} />
      </div>
    </button>
  );
}

function WeekMobileView({
  weekDates,
  selectedDate,
  onSelectDate,
  onOpenDetail,
}: {
  weekDates: Date[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onOpenDetail: () => void;
}) {
  return (
    <section className="week-mobile-board" aria-label="Week schedule">
      <div className="week-mobile-scroll">
        <div className="week-mobile-scroll-body">
          <div className="week-mobile-week-grid">
            <div className="week-mobile-time-rail" aria-hidden="true">
              {Array.from({ length: 16 }, (_, index) => {
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
                const events = getEventsForDate(dateKey);
                const active = dateKey === formatDateKey(selectedDate);
                return (
                  <div
                    className={classNames("week-mobile-day-column", active && "active")}
                    key={dateKey}
                    onClick={() => onSelectDate(date)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Select ${weekdayLongLabels[date.getDay() === 0 ? 6 : date.getDay() - 1]} ${date.getDate()}`}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectDate(date);
                      }
                    }}
                  >
                    <div className="week-mobile-day-column-head">
                      <strong>{weekdayLongLabels[date.getDay() === 0 ? 6 : date.getDay() - 1]}</strong>
                      <span>{date.getDate()}</span>
                    </div>

                    <div className="week-mobile-day-track">
                      {Array.from({ length: 16 }, (_, index) => (
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

function DayTimeline({ date, events, onOpenDetail }: { date: Date; events: ScheduleEvent[]; onOpenDetail: () => void }) {
  const start = 7;
  const end = 22;
  const timelineHeight = (end - start + 1) * 4.5;
  return (
    <section className="timeline-panel day-timeline-panel">
      <div className="day-timeline-head">
        <div>
          <SectionLabel>Day timeline</SectionLabel>
          <h3>{formatWeekLabel(date)}</h3>
        </div>
        <span className="text-button-like">{events.length} classes</span>
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
  selectedDate,
  onSelectDate,
  onOpenDetail,
  onJumpToToday,
  onShiftWeek,
}: {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onOpenDetail: () => void;
  onJumpToToday: () => void;
  onShiftWeek: (delta: number) => void;
}) {
  const weekDates = getWeekDates(selectedDate);
  return (
    <section className="view-panel active" data-panel="week">
      <div className="day-header">
        <div>
          <SectionLabel>Week view</SectionLabel>
          <h3>{formatWeekLabel(weekDates[0])} - {formatWeekLabel(weekDates[6])}</h3>
        </div>
        <div className="week-nav">
          <Button variant="ghost" size="icon" className="month-step week-step" onClick={() => onShiftWeek(-7)} aria-label="Previous week">
            <ArrowLeft size={16} />
          </Button>
          <Button variant="ghost" size="sm" className="toolbar-link week-reset" onClick={onJumpToToday}>
            <CalendarRange size={13} strokeWidth={1.9} />
            This week
          </Button>
          <Button variant="ghost" size="icon" className="month-step week-step" onClick={() => onShiftWeek(7)} aria-label="Next week">
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>

      <div className="week-board">
        <div className="week-grid-shell">
          <div className="week-grid-body">
            <TimeRail />
            <div className="week-columns">
              {weekDates.map((date) => {
                const events = getEventsForDate(formatDateKey(date));
                const active = formatDateKey(date) === formatDateKey(selectedDate);
                return (
                  <div className={classNames("week-column", active && "active", isWeekend(date) && "weekend")} key={formatDateKey(date)}>
                    <button type="button" className="week-column-head" onClick={() => onSelectDate(date)} aria-label={`Select ${weekdayLongLabels[date.getDay() === 0 ? 6 : date.getDay() - 1]} ${date.getDate()}`}>
                      <strong>{weekdayLongLabels[date.getDay() === 0 ? 6 : date.getDay() - 1]}</strong>
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

      <WeekMobileView weekDates={weekDates} selectedDate={selectedDate} onSelectDate={onSelectDate} onOpenDetail={onOpenDetail} />
    </section>
  );
}

function DayView({
  onAdd,
  data,
  onOpenDetail,
  onSelectDate,
  onJumpToToday,
}: {
  onAdd: () => void;
  data: ReturnType<typeof useMonthState>;
  onOpenDetail: () => void;
  onSelectDate: (date: Date) => void;
  onJumpToToday: () => void;
}) {
  const dateKey = data.selectedKey;
  const events = getEventsForDate(dateKey);
  const weekDates = getWeekDates(data.selectedDate);
  return (
    <section className="view-panel active" data-panel="day">
      <div className="day-header">
        <div>
          <SectionLabel>Day view</SectionLabel>
          <h3>{data.dayDetail.title}</h3>
        </div>
        <div className="day-nav">
          <Button variant="ghost" size="sm" className="toolbar-link day-reset" onClick={onJumpToToday}>
            <CalendarDays size={13} strokeWidth={1.9} />
            Today
          </Button>
          <button className="primary-button" type="button" onClick={onAdd}>
            + Add
          </button>
        </div>
      </div>

      <div className="day-date-strip" aria-label="Week dates">
        {weekDates.map((date) => {
          const active = formatDateKey(date) === dateKey;
          return (
            <button key={formatDateKey(date)} type="button" className={classNames("day-date-chip", active && "active")} onClick={() => onSelectDate(date)}>
              <strong>{weekdayLongLabels[date.getDay() === 0 ? 6 : date.getDay() - 1]}</strong>
              <span>{date.getDate()}</span>
            </button>
          );
        })}
      </div>

      <DayTimeline date={data.selectedDate} events={events} onOpenDetail={onOpenDetail} />

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
          data.dayDetail.items.map((item) => (
            <button className="agenda-row" type="button" key={`${item.time}-${item.title}`} onClick={onOpenDetail}>
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
            <strong>No classes today</strong>
            <p>Open another date or add a class from the floating button.</p>
          </div>
        )}
      </div>

      <div className="repeat-box">
        <SectionLabel>Repeat rule</SectionLabel>
        <strong>{data.dayDetail.repeatRule}</strong>
        <p>{data.dayDetail.dateLabel}</p>
      </div>
    </section>
  );
}

function ReconcilePage() {
  return (
    <section className="page-panel">
      <div className="section-head">
        <div>
          <SectionLabel>Reconcile</SectionLabel>
          <h3>Monthly fee review</h3>
        </div>
        <button className="text-button" type="button">Filters</button>
      </div>

      <div className="summary-strip">
        <div className="stat-card"><span>Total sessions</span><strong>25</strong></div>
        <div className="stat-card"><span>Receivable</span><strong>¥8,100</strong></div>
        <div className="stat-card"><span>Received</span><strong>¥5,700</strong></div>
        <div className="stat-card"><span>Unpaid</span><strong>¥2,400</strong></div>
        <div className="stat-card"><span>Overdue</span><strong>¥600</strong></div>
        <div className="stat-card"><span>Pay day</span><strong>29th</strong></div>
      </div>

      <div className="stack-section">
        {reconcileRows.map((row) => (
          <article className="reconcile-card" key={row.studio}>
            <div className="reconcile-top">
              <div>
                <strong>{row.studio}</strong>
                <p>{row.sessions} sessions · Pay day {row.payDay}</p>
              </div>
              <Badge variant={row.status === "Paid" ? "success" : row.status === "Overdue" ? "warning" : "secondary"}>{row.status}</Badge>
            </div>
            <dl className="metrics">
              <div><dt>Receivable</dt><dd>{row.receivable}</dd></div>
              <div><dt>Received</dt><dd>{row.received}</dd></div>
              <div><dt>Unpaid</dt><dd>{row.unpaid}</dd></div>
              <div><dt>Overdue</dt><dd>{row.overdue}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function StudioPage({
  studios,
  onAddStudio,
  onOpenStudio,
}: {
  studios: typeof initialStudioRows;
  onAddStudio: () => void;
  onOpenStudio: (studio: StudioRecord) => void;
}) {
  return (
    <section className="page-panel">
      <div className="section-head">
        <div>
          <SectionLabel>Studio</SectionLabel>
          <h3>Studio list</h3>
        </div>
        <button className="text-button" type="button" onClick={onAddStudio}>
          + New studio
        </button>
      </div>
      <div className="list-stack">
        {studios.map((studio) => (
          <button className="list-row studio-row" key={studio.id} type="button" onClick={() => onOpenStudio(studio)} aria-label={`Open studio ${studio.name}`}>
            <div>
              <strong>{studio.name}</strong>
              <p>{formatStudioDisplayTypes(studio.displayTypes)} · {studio.baseFee} · {studio.payDay}</p>
              <small>{studio.contact}</small>
            </div>
            <div className="studio-badge-stack">
              {studio.displayTypes.slice(0, 2).map((type) => (
                <Badge key={type} variant={getStudioTypeTone(type)}>{type}</Badge>
              ))}
              {studio.displayTypes.length > 2 ? <Badge variant="secondary">+{studio.displayTypes.length - 2}</Badge> : null}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function TemplatePage({
  templates,
  onUseTemplate,
  onAddTemplate,
}: {
  templates: TemplatePreset[];
  onUseTemplate: (template: TemplatePreset) => void;
  onAddTemplate: () => void;
}) {
  return (
    <section className="page-panel">
      <div className="section-head">
        <div>
          <SectionLabel>Templates</SectionLabel>
          <h3>Regular class templates</h3>
        </div>
        <button className="text-button" type="button" onClick={onAddTemplate}>
          + New template
        </button>
      </div>
      <div className="list-stack">
        {templates.map((template) => (
          <button className="list-row template-row" key={template.key} type="button" aria-label={`Use template ${template.title}`} onClick={() => onUseTemplate(template)}>
            <div>
              <strong>{template.title}</strong>
              <p>{template.detail}</p>
              <small>{template.extra}</small>
            </div>
            <Badge variant={template.status === "Live" ? "success" : template.status === "Draft" ? "secondary" : "warning"}>{template.status}</Badge>
          </button>
        ))}
      </div>
    </section>
  );
}

function SettingsPage({
  studios,
  templates,
  onAddStudio,
  onAddTemplate,
}: {
  studios: typeof initialStudioRows;
  templates: TemplatePreset[];
  onAddStudio: () => void;
  onAddTemplate: () => void;
}) {
  return (
    <section className="page-panel">
      <div className="section-head">
        <div>
          <SectionLabel>Settings</SectionLabel>
          <h3>Security, display, and management</h3>
        </div>
      </div>

      <div className="settings-grid">
        <article className="settings-card">
          <strong>Studio management</strong>
          <p>Keep studio records local, editable, and ready for fee reconciliation.</p>
          <small>{studios.length} studios · latest {studios.slice(0, 2).map((studio) => studio.name).join(" · ")}</small>
          <div className="settings-actions">
            <Button type="button" size="sm" onClick={onAddStudio}>
              + New studio
            </Button>
          </div>
        </article>
        <article className="settings-card">
          <strong>Template management</strong>
          <p>Maintain regular class templates from one place and reuse them for new classes.</p>
          <small>{templates.length} templates · latest {templates.slice(0, 2).map((template) => template.title).join(" · ")}</small>
          <div className="settings-actions">
            <Button type="button" size="sm" onClick={onAddTemplate}>
              + New template
            </Button>
          </div>
        </article>
        <article className="settings-card">
          <strong>Local lock</strong>
          <p>Enable PIN or biometric unlock for the app.</p>
        </article>
        <article className="settings-card">
          <strong>Default view</strong>
          <p>Open month view first on launch.</p>
        </article>
        <article className="settings-card">
          <strong>Display density</strong>
          <p>Keep compact rows for faster scanning.</p>
        </article>
        <article className="settings-card">
          <strong>Local data</strong>
          <p>All class, studio, and fee data stays on this device.</p>
        </article>
      </div>
    </section>
  );
}

function MorePage({
  section,
  setSection,
  studios,
  templates,
  onUseTemplate,
  onAddStudio,
  onAddTemplate,
  onOpenStudio,
}: {
  section: MoreSection;
  setSection: (section: MoreSection) => void;
  studios: typeof initialStudioRows;
  templates: TemplatePreset[];
  onUseTemplate: (template: TemplatePreset) => void;
  onAddStudio: () => void;
  onAddTemplate: () => void;
  onOpenStudio: (studio: StudioRecord) => void;
}) {
  return (
    <section className="page-panel">
      <div className="section-head">
        <div>
          <SectionLabel>Settings</SectionLabel>
          <h3>App settings and tools</h3>
        </div>
      </div>

      <div className="secondary-tabs">
        {[
          ["settings", "Settings"],
          ["studio", "Studio"],
          ["templates", "Templates"],
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
          <SettingsPage studios={studios} templates={templates} onAddStudio={onAddStudio} onAddTemplate={onAddTemplate} />
        ) : section === "studio" ? (
          <StudioPage studios={studios} onAddStudio={onAddStudio} onOpenStudio={onOpenStudio} />
        ) : (
          <TemplatePage templates={templates} onUseTemplate={onUseTemplate} onAddTemplate={onAddTemplate} />
        )}
      </div>
    </section>
  );
}

function StudioDialog({
  open,
  onClose,
  mode,
  studio,
  onCreate,
  onUpdate,
}: {
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
    feeUnit: "/ session",
    payDay: "28th",
    cancelCompensationRatio: "50%",
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
      setFeeUnit(source?.feeUnit ?? seed.feeUnit);
      setPayDay(source?.payDay ?? seed.payDay);
      setCancelCompensationRatio(source?.cancelCompensationRatio ?? seed.cancelCompensationRatio);
      setWeeklySessionCount(source?.weeklySessionCount ?? seed.weeklySessionCount);
      setDisplayTypes(source?.displayTypes?.length ? source.displayTypes : seed.displayTypes);
      setContactName(source?.contactName ?? seed.contactName);
      setContactMethod(source?.contactMethod ?? seed.contactMethod);
      setNote(source?.note ?? seed.note);
      setGroupTag(source?.groupTag ?? seed.groupTag);
    }
  }, [open, studio]);

  const handleSubmit = () => {
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
      feeUnit,
      cancelCompensationRatio: cancelCompensationRatio.trim(),
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
          <DialogTitle>{isEditMode ? "Studio details" : "New studio"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Review the full studio record and update only this studio."
              : "Capture the studio details used for scheduling and settlement."}
          </DialogDescription>
        </DialogHeader>

        <div className="editor-scroll">
          {isEditMode ? (
            <div className="editor-section">
              <div className="editor-section-head">
                <strong>Overview</strong>
                <span>Editable studio record</span>
              </div>
              <div className="detail-grid">
                <div><span>Studio</span><strong>{name || "Untitled studio"}</strong></div>
                <div>
                  <span>Display type</span>
                  <strong className="studio-type-summary">
                    {displayTypes.length > 0 ? displayTypes.map((type) => (
                      <Badge key={type} variant={getStudioTypeTone(type)}>{type}</Badge>
                    )) : "Not set"}
                  </strong>
                </div>
                <div><span>Weekly classes</span><strong>{weeklySessionCount || "1"} / week</strong></div>
                <div><span>Fee</span><strong>{`¥${baseFee || "0"} ${feeUnit}`}</strong></div>
                <div><span>Pay day</span><strong>{payDay}</strong></div>
                <div><span>Contact</span><strong>{[contactName, contactMethod].filter(Boolean).join(" · ") || "Not set"}</strong></div>
              </div>
            </div>
          ) : null}

          <div className="editor-section">
            <div className="editor-section-head">
              <strong>Studio details</strong>
              <span>Local management only</span>
            </div>
            <div className="form-grid">
              <label className="ui-field">
                <span>Studio name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Studio A" />
              </label>
              <label className="ui-field">
                <span>Group tag</span>
                <input value={groupTag} onChange={(event) => setGroupTag(event.target.value)} placeholder="Main room" />
              </label>
              <label className="wide ui-field">
                <span>Address</span>
                <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Studio address" />
              </label>
              <label className="ui-field">
                <span>Weekly classes</span>
                <input type="number" min="0" value={weeklySessionCount} onChange={(event) => setWeeklySessionCount(event.target.value)} inputMode="numeric" placeholder="2" />
                <small className="field-hint">按周填写排课节数，不与其他表关联。</small>
              </label>
            </div>
          </div>

          <div className="editor-section">
            <div className="editor-section-head">
              <strong>Fee and settlement</strong>
              <span>Base fee and pay day</span>
            </div>
            <div className="form-grid">
              <label className="ui-field">
                <span>Base fee</span>
                <input value={baseFee} onChange={(event) => setBaseFee(event.target.value)} placeholder="300" />
              </label>
              <label className="ui-field">
                <span>Fee unit</span>
                <select value={feeUnit} onChange={(event) => setFeeUnit(event.target.value)}>
                  {studioFeeUnitOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="ui-field">
                <span>Pay day</span>
                <input value={payDay} onChange={(event) => setPayDay(event.target.value)} placeholder="28th" />
              </label>
              <label className="ui-field">
                <span>Cancel ratio</span>
                <input value={cancelCompensationRatio} onChange={(event) => setCancelCompensationRatio(event.target.value)} placeholder="50%" />
              </label>
            </div>
          </div>

          <div className="editor-section">
            <div className="editor-section-head">
              <strong>Contact</strong>
              <span>Contact person and method</span>
            </div>
            <div className="form-grid">
              <label className="ui-field">
                <span>Contact name</span>
                <input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Miki" />
              </label>
              <label className="ui-field">
                <span>Contact method</span>
                <input value={contactMethod} onChange={(event) => setContactMethod(event.target.value)} placeholder="138-0000-0001" />
              </label>
              <label className="wide ui-field">
                <span>Notes</span>
                <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional notes" />
              </label>
            </div>
          </div>

          <div className="editor-section">
            <div className="editor-section-head">
              <strong>Display type</strong>
              <span>Multiple tags are allowed</span>
            </div>
            <div className="studio-type-picker" role="group" aria-label="Studio display type">
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
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>
            <small className="field-hint">Select one or more types that this studio can be used for.</small>
          </div>

          <div className="sheet-actions">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit}>
              {isEditMode ? "Update studio" : "Create studio"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateDialog({
  open,
  onClose,
  onCreate,
  studioNames,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (template: TemplatePreset) => void;
  studioNames: string[];
}) {
  const seed = {
    title: "",
    studio: studioNames[0] ?? "Studio A",
    weekday: "Tuesday",
    time: "18:00 - 19:30",
    detail: "Repeats every week",
    extra: "Repeat for 8 weeks",
    fee: "300",
  };

  const [title, setTitle] = useState(seed.title);
  const [studio, setStudio] = useState(seed.studio);
  const [weekday, setWeekday] = useState(seed.weekday);
  const [time, setTime] = useState(seed.time);
  const [detail, setDetail] = useState(seed.detail);
  const [extra, setExtra] = useState(seed.extra);
  const [fee, setFee] = useState(seed.fee);

  useEffect(() => {
    if (open) {
      setTitle(seed.title);
      setStudio(studioNames[0] ?? "Studio A");
      setWeekday(seed.weekday);
      setTime(seed.time);
      setDetail(seed.detail);
      setExtra(seed.extra);
      setFee(seed.fee);
    }
  }, [open, studioNames]);

  const handleSubmit = () => {
    const start = time.split("-")[0]?.trim() ?? "18:00";
    onCreate({
      key: `template-${Date.now()}`,
      title: title.trim() || `${weekday} ${start} · ${studio}`,
      detail: detail.trim() || "Repeats every week",
      extra: extra.trim() || "Repeat for 8 weeks",
      status: "Live",
      studio,
      type: "Regular",
      weekday,
      time,
      repeatUnit: "week",
      repeatEndMode: "count",
      repeatEndValue: "8 weeks",
      fee: fee.trim() || "300",
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="editor-dialog">
        <DialogHeader>
          <DialogTitle>New template</DialogTitle>
          <DialogDescription>Create a regular class template for repeat scheduling.</DialogDescription>
        </DialogHeader>

        <div className="editor-scroll">
          <div className="editor-section">
            <div className="editor-section-head">
              <strong>Template details</strong>
              <span>Regular class template</span>
            </div>
            <div className="form-grid">
              <label className="ui-field">
                <span>Title</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tuesday 18:00 · Studio A" />
              </label>
              <label className="ui-field">
                <span>Studio</span>
                <select value={studio} onChange={(event) => setStudio(event.target.value)}>
                  {studioNames.map((studioName) => (
                    <option key={studioName}>{studioName}</option>
                  ))}
                </select>
              </label>
              <label className="ui-field">
                <span>Weekday</span>
                <select value={weekday} onChange={(event) => setWeekday(event.target.value)}>
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                    <option key={day}>{day}</option>
                  ))}
                </select>
              </label>
              <label className="ui-field">
                <span>Time</span>
                <input value={time} onChange={(event) => setTime(event.target.value)} placeholder="18:00 - 19:30" />
              </label>
              <label className="wide ui-field">
                <span>Detail</span>
                <input value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Repeats every week" />
              </label>
              <label className="wide ui-field">
                <span>Extra</span>
                <input value={extra} onChange={(event) => setExtra(event.target.value)} placeholder="Repeat for 8 weeks" />
              </label>
              <label className="ui-field">
                <span>Default fee</span>
                <input value={fee} onChange={(event) => setFee(event.target.value)} placeholder="300" />
              </label>
            </div>
          </div>

          <div className="sheet-actions">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit}>
              Create template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailSheet({
  open,
  onClose,
  onEdit,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Class detail</DialogTitle>
          <DialogDescription>Review the current class record, repeat rule, and primary actions.</DialogDescription>
        </DialogHeader>

        <div className="sheet-card">
          <div className="detail-grid">
            <div><span>Date</span><strong>Jul 7, 2026</strong></div>
            <div><span>Time</span><strong>10:30 - 12:00</strong></div>
            <div><span>Status</span><strong>Open</strong></div>
            <div><span>Pay</span><strong>Paid</strong></div>
            <div><span>Fee</span><strong>¥300</strong></div>
            <div><span>Studio</span><strong>Studio A</strong></div>
          </div>

          <div className="repeat-box">
            <SectionLabel>Repeat rule</SectionLabel>
            <strong>Repeats every week</strong>
            <p>Tuesday · 10:30 - 12:00 · Repeat for 8 weeks or until Aug 2026</p>
          </div>

          <div className="sheet-actions">
            <Button variant="outline" size="sm" onClick={onEdit}>Edit</Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>Delete</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="confirm-dialog">
        <DialogHeader>
          <DialogTitle>Delete this class?</DialogTitle>
          <DialogDescription>This will remove the class record. You can cancel and keep it if you opened this by mistake.</DialogDescription>
        </DialogHeader>

        <div className="confirm-card">
          <strong>Jul 7, 2026 · 10:30 - 12:00</strong>
          <p>Studio A · Regular · Paid</p>
        </div>

        <div className="sheet-actions">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>Delete</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CopyMonthDialog({
  open,
  onClose,
  monthLabel,
  groups,
}: {
  open: boolean;
  onClose: () => void;
  monthLabel: string;
  groups: CopyPreviewGroup[];
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="copy-dialog">
        <DialogHeader>
          <DialogTitle>Preview last month</DialogTitle>
          <DialogDescription>Review the previous month by studio before copying it into the current month.</DialogDescription>
        </DialogHeader>

        <div className="copy-preview-shell">
          <div className="copy-preview-head">
            <div>
              <SectionLabel>Source month</SectionLabel>
              <h4>{monthLabel}</h4>
            </div>
            <span className="text-button-like">{groups.reduce((sum, group) => sum + group.items.length, 0)} blocks</span>
          </div>

          <div className="copy-preview-list">
            {groups.map((group) => (
              <article className="copy-group" key={group.studio}>
                <div className="copy-group-head">
                  <strong>{group.studio}</strong>
                  <span>{group.items.length} classes</span>
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

          <div className="sheet-actions">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={onClose}>Copy into this month</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditorSheet({
  open,
  onClose,
  template,
  mode,
  studios,
  templates,
}: {
  open: boolean;
  onClose: () => void;
  template: TemplatePreset | null;
  mode: EditorMode;
  studios: StudioRecord[];
  templates: TemplatePreset[];
}) {
  const editSeed = {
    courseType: "Regular" as const,
    studio: "Studio A",
    date: "2026-07-07",
    contentTag: "Core choreo",
    contentDescription: "Repeat weekly block with live practice.",
    fee: "300",
    paymentTime: "2026-07-07T13:00",
    classStatus: "Open",
    paymentStatus: "Paid",
    departureMinutes: "30",
    musicNote: "Use the July playlist.",
    attachments: "",
    note: "Keep the original repeat structure.",
    actualReceivableAmount: "300",
    actualReceivedAmount: "300",
  };

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(template?.key ?? "no-template");
  const [courseType, setCourseType] = useState<TemplatePreset["type"]>(template?.type ?? editSeed.courseType);
  const [studio, setStudio] = useState(template?.studio ?? editSeed.studio);
  const [dateValue, setDateValue] = useState(mode === "edit" ? editSeed.date : "2026-07-07");
  const [startHour, setStartHour] = useState("18");
  const [startMinute, setStartMinute] = useState("00");
  const [endHour, setEndHour] = useState("19");
  const [endMinute, setEndMinute] = useState("30");
  const [contentTag, setContentTag] = useState(mode === "edit" ? editSeed.contentTag : "");
  const [contentDescription, setContentDescription] = useState(mode === "edit" ? editSeed.contentDescription : "");
  const [fee, setFee] = useState(template?.fee ?? (mode === "edit" ? editSeed.fee : ""));
  const [paymentTime, setPaymentTime] = useState(mode === "edit" ? editSeed.paymentTime : "");
  const [classStatus, setClassStatus] = useState(editSeed.classStatus);
  const [paymentStatus, setPaymentStatus] = useState(editSeed.paymentStatus);
  const [departureMinutes, setDepartureMinutes] = useState(mode === "edit" ? editSeed.departureMinutes : "30");
  const [musicNote, setMusicNote] = useState(mode === "edit" ? editSeed.musicNote : "");
  const [attachments, setAttachments] = useState(mode === "edit" ? editSeed.attachments : "");
  const [note, setNote] = useState(mode === "edit" ? editSeed.note : "");
  const [actualReceivableAmount, setActualReceivableAmount] = useState(mode === "edit" ? editSeed.actualReceivableAmount : "");
  const [actualReceivedAmount, setActualReceivedAmount] = useState(mode === "edit" ? editSeed.actualReceivedAmount : "");
  const [repeatEnabled, setRepeatEnabled] = useState(Boolean(template));
  const [repeatIntervalValue, setRepeatIntervalValue] = useState(template?.repeatEndValue.match(/^\d+/)?.[0] ?? "1");
  const [repeatIntervalUnit, setRepeatIntervalUnit] = useState<TemplatePreset["repeatUnit"]>(template?.repeatUnit ?? "week");
  const [repeatWeekday, setRepeatWeekday] = useState(template?.weekday ?? "Tuesday");
  const [repeatEndMode, setRepeatEndMode] = useState<TemplatePreset["repeatEndMode"]>(template?.repeatEndMode ?? "count");
  const [repeatEndValue, setRepeatEndValue] = useState(template?.repeatEndValue ?? "");

  useEffect(() => {
    if (open) {
      setSelectedTemplateKey(template?.key ?? "no-template");
      setCourseType(template?.type ?? (mode === "edit" ? editSeed.courseType : "Regular"));
      setStudio(template?.studio ?? editSeed.studio);
      setDateValue(mode === "edit" ? editSeed.date : "2026-07-07");
      setContentTag(mode === "edit" ? editSeed.contentTag : template?.title ?? "");
      setContentDescription(mode === "edit" ? editSeed.contentDescription : template?.detail ?? "");
      setFee(template?.fee ?? (mode === "edit" ? editSeed.fee : ""));
      setPaymentTime(mode === "edit" ? editSeed.paymentTime : "");
      setClassStatus(editSeed.classStatus);
      setPaymentStatus(editSeed.paymentStatus);
      setDepartureMinutes(mode === "edit" ? editSeed.departureMinutes : "30");
      setMusicNote(mode === "edit" ? editSeed.musicNote : "");
      setAttachments(mode === "edit" ? editSeed.attachments : "");
      setNote(mode === "edit" ? editSeed.note : "");
      setActualReceivableAmount(mode === "edit" ? editSeed.actualReceivableAmount : "");
      setActualReceivedAmount(mode === "edit" ? editSeed.actualReceivedAmount : "");
      setRepeatEnabled(Boolean(template));
      setRepeatIntervalValue(template?.repeatEndValue.match(/^\d+/)?.[0] ?? "1");
      setRepeatIntervalUnit(template?.repeatUnit ?? "week");
      setRepeatWeekday(template?.weekday ?? "Tuesday");
      setRepeatEndMode(template?.repeatEndMode ?? "count");
      setRepeatEndValue(template?.repeatEndValue ?? "");
    }
  }, [open, template, mode]);

  useEffect(() => {
    const sourceTime = (templates.find((item) => item.key === selectedTemplateKey) ?? template)?.time;
    const range = parseTimeRange(sourceTime);
    setStartHour(range.startHour);
    setStartMinute(range.startMinute);
    setEndHour(range.endHour);
    setEndMinute(range.endMinute);
    if (selectedTemplateKey !== "no-template") {
      const selected = templates.find((item) => item.key === selectedTemplateKey);
      if (selected) {
        setCourseType(selected.type);
        setStudio(selected.studio);
        setContentTag(selected.title);
        setContentDescription(selected.detail);
        setFee(selected.fee);
        setRepeatIntervalUnit(selected.repeatUnit);
        setRepeatWeekday(selected.weekday);
        setRepeatEndMode(selected.repeatEndMode);
        setRepeatEndValue(selected.repeatEndValue);
      }
    }
  }, [selectedTemplateKey, template, templates]);

  const selectedTemplate = templates.find((item) => item.key === selectedTemplateKey) ?? null;
  const isEditMode = mode === "edit";
  const isTemplateCreate = mode === "create" && selectedTemplateKey !== "no-template";
  const supportsRepeatControls = isEditMode || isTemplateCreate || shouldShowRepeatControls(courseType);
  const isManualCreate = mode === "create" && selectedTemplateKey === "no-template";
  const isSimpleCreateFlow = mode === "create" && selectedTemplateKey === "no-template" && isManualCreateType(courseType);
  const timePreview = `${startHour}:${startMinute} - ${endHour}:${endMinute}`;
  const paymentPreview = paymentTime || "Not set";
  const createHint = isSimpleCreateFlow
    ? "Simple entry: basic info, content, fee, and payment time stay visible."
    : isManualCreate
      ? "Manual entry: regular and small group classes can expand repeat details."
      : "Template entry: fields follow the selected preset and still allow manual overrides.";
  const courseTypeHint = getCourseTypeHint(courseType);
  const repeatSectionVisible = !isEditMode && supportsRepeatControls;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="editor-dialog">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit class" : "Add class"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Review every field, update the class record, and keep the history explicit."
              : "Pick a template or choose a class type first, then fill the fields needed for this course."}
          </DialogDescription>
        </DialogHeader>

        <div className="editor-scroll">
          <div className="sheet-card editor-card">
              <div className="editor-banner">
                <div>
                  <SectionLabel>{isEditMode ? "Edit mode" : "Add mode"}</SectionLabel>
                  <strong>{isEditMode ? "Full record editing" : isSimpleCreateFlow ? "Simple class entry" : "Template-first class entry"}</strong>
                  <p>{isEditMode ? "All fields are visible so history stays explicit." : isSimpleCreateFlow ? "Substitute, private, and workshop classes stay compact by default." : "Regular and small group classes can still use repeat controls."}</p>
                </div>
                <Badge variant={isEditMode ? "warning" : "success"}>{isEditMode ? "Edit" : "Create"}</Badge>
              </div>

            <div className="editor-section">
              <div className="editor-section-head">
                <strong>Source</strong>
                <span>Template and type</span>
              </div>

              <div className="form-grid">
                <label className="wide ui-field">
                  <span>Template</span>
                  <Select value={selectedTemplateKey} onValueChange={(value) => setSelectedTemplateKey(value)}>
                    <SelectTrigger data-testid="edit-template">
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-template">No template</SelectItem>
                      {templates.map((item) => (
                        <SelectItem key={item.key} value={item.key}>
                          {item.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <Card className="wide template-summary">
                  <CardHeader>
                    <div>
                      <CardDescription>Current template</CardDescription>
                      <CardTitle>{selectedTemplate ? selectedTemplate.title : "No template selected"}</CardTitle>
                    </div>
                    <Badge variant={selectedTemplate ? "success" : "secondary"}>{selectedTemplate ? "Live" : "Manual"}</Badge>
                  </CardHeader>
                  <CardContent>
                      {selectedTemplate ? (
                        <p>
                          {selectedTemplate.studio} · {selectedTemplate.weekday} · {selectedTemplate.time} · Repeat {selectedTemplate.repeatUnit}
                        </p>
                      ) : (
                        <p>Templates are for regular-class patterns. Manual mode keeps the current course type explicit.</p>
                      )}
                  </CardContent>
                </Card>

                <label className="ui-field">
                  <span>Course type</span>
                  <select data-testid="edit-type" value={courseType} onChange={(event) => setCourseType(event.target.value as TemplatePreset["type"])}>
                    {courseTypeOptions.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                  {!isEditMode ? <small className="field-hint">{courseTypeHint}</small> : null}
                  {!isEditMode ? <small className="field-hint">{createHint}</small> : null}
                </label>

                {isEditMode && (
                  <label className="ui-field">
                    <span>Class status</span>
                    <select value={classStatus} onChange={(event) => setClassStatus(event.target.value)}>
                      <option>Open</option>
                      <option>Pending</option>
                      <option>Leave</option>
                      <option>Closed</option>
                    </select>
                  </label>
                )}

                {isEditMode && (
                  <label className="ui-field">
                    <span>Payment status</span>
                    <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
                      <option>Unpaid</option>
                      <option>Paid</option>
                      <option>Partially paid</option>
                      <option>Overdue unpaid</option>
                    </select>
                  </label>
                )}
              </div>
            </div>

            <div className="editor-section">
              <div className="editor-section-head">
                <strong>Basic info</strong>
                <span>Studio, date, and time</span>
              </div>

              <div className="form-grid">
                <label className="ui-field">
                  <span>Studio</span>
                  <select data-testid="edit-studio" value={studio} onChange={(event) => setStudio(event.target.value)}>
                    {studios.map((studioRecord) => (
                      <option key={studioRecord.name}>{studioRecord.name}</option>
                    ))}
                  </select>
                </label>
                <label className="ui-field">
                  <span>Date</span>
                  <input data-testid="edit-date" type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
                </label>
                <label className="wide ui-field">
                  <span>Time</span>
                  <div className="alarm-range" data-testid="edit-time">
                    <div className="alarm-block">
                      <span className="alarm-label">Start</span>
                      <div className="alarm-picker">
                        <Select value={startHour} onValueChange={setStartHour}>
                          <SelectTrigger className="alarm-select">
                            <SelectValue placeholder="HH" />
                          </SelectTrigger>
                          <SelectContent>
                            {clockHourOptions.map((hour) => (
                              <SelectItem key={hour} value={hour}>
                                {hour}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="alarm-divider">:</span>
                        <Select value={startMinute} onValueChange={setStartMinute}>
                          <SelectTrigger className="alarm-select">
                            <SelectValue placeholder="MM" />
                          </SelectTrigger>
                          <SelectContent>
                            {clockMinuteOptions.map((minute) => (
                              <SelectItem key={minute} value={minute}>
                                {minute}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="alarm-block">
                      <span className="alarm-label">End</span>
                      <div className="alarm-picker">
                        <Select value={endHour} onValueChange={setEndHour}>
                          <SelectTrigger className="alarm-select">
                            <SelectValue placeholder="HH" />
                          </SelectTrigger>
                          <SelectContent>
                            {clockHourOptions.map((hour) => (
                              <SelectItem key={hour} value={hour}>
                                {hour}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="alarm-divider">:</span>
                        <Select value={endMinute} onValueChange={setEndMinute}>
                          <SelectTrigger className="alarm-select">
                            <SelectValue placeholder="MM" />
                          </SelectTrigger>
                          <SelectContent>
                            {clockMinuteOptions.map((minute) => (
                              <SelectItem key={minute} value={minute}>
                                {minute}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="alarm-preview">Time range · {timePreview}</div>
                </label>
              </div>
            </div>

            <div className="editor-section">
              <div className="editor-section-head">
                <strong>Content</strong>
                <span>What this class is about</span>
              </div>

              <div className="form-grid">
                <label className="ui-field">
                  <span>Content tag</span>
                  <input value={contentTag} onChange={(event) => setContentTag(event.target.value)} placeholder="For example: core choreo" />
                </label>
                <label className="wide ui-field">
                  <span>Content description</span>
                  <textarea rows={3} value={contentDescription} onChange={(event) => setContentDescription(event.target.value)} placeholder="Describe the class content or reminder" />
                </label>
              </div>
            </div>

            <div className="editor-section">
              <div className="editor-section-head">
                <strong>Settlement</strong>
                <span>Payment time is always required</span>
              </div>

              <div className="form-grid">
                <label className="wide ui-field">
                  <span>Payment time</span>
                  <input type="datetime-local" required value={paymentTime} onChange={(event) => setPaymentTime(event.target.value)} />
                  <small className="field-hint">Shown for every new class, whether you use a template or not.</small>
                </label>
              </div>
            </div>

            <div className="editor-section">
              <div className="editor-section-head">
                <strong>Fee</strong>
                <span>Amount and settlement</span>
              </div>

              <div className="form-grid">
                <label className="ui-field">
                  <span>Fee</span>
                  <input data-testid="edit-fee" type="text" value={fee} onChange={(event) => setFee(event.target.value)} />
                </label>
                {isEditMode ? (
                  <>
                    <label className="ui-field">
                      <span>Expected receivable</span>
                      <input type="text" value={actualReceivableAmount} onChange={(event) => setActualReceivableAmount(event.target.value)} placeholder="Optional" />
                    </label>
                    <label className="ui-field">
                      <span>Received amount</span>
                      <input type="text" value={actualReceivedAmount} onChange={(event) => setActualReceivedAmount(event.target.value)} placeholder="Optional" />
                    </label>
                  </>
                ) : (
                  <div className="wide create-default-note">
                    <strong>Defaults on save</strong>
                    <p>Status becomes Open and payment becomes Unpaid unless you change them later in edit mode.</p>
                  </div>
                )}
              </div>
            </div>

            {!isEditMode && !isSimpleCreateFlow ? (
              <div className="editor-section">
                <div className="editor-section-head">
                  <strong>Note</strong>
                  <span>Extra context for repeat-capable classes</span>
                </div>
                <div className="form-grid">
                  <label className="wide ui-field">
                    <span>Note</span>
                    <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional notes" />
                  </label>
                </div>
              </div>
            ) : null}

            {isEditMode ? (
              <div className="editor-section">
                <div className="editor-section-head">
                  <strong>Advanced</strong>
                  <span>Editing keeps every field visible</span>
                </div>

                <div className="form-grid">
                  <label className="ui-field">
                    <span>Departure minutes</span>
                    <input type="number" min="0" value={departureMinutes} onChange={(event) => setDepartureMinutes(event.target.value)} />
                  </label>
                  <label className="ui-field">
                    <span>Music note</span>
                    <input type="text" value={musicNote} onChange={(event) => setMusicNote(event.target.value)} placeholder="Playback notes or music cues" />
                  </label>
                  <label className="wide ui-field">
                    <span>Attachments</span>
                    <input type="text" value={attachments} onChange={(event) => setAttachments(event.target.value)} placeholder="Local attachment references" />
                  </label>
                  <label className="wide ui-field">
                    <span>Note</span>
                    <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional notes" />
                  </label>
                </div>
              </div>
            ) : null}

            {repeatSectionVisible && (
              <div className="repeat-section">
                <div className="repeat-toggle">
                  <div>
                    <span>Repeat schedule</span>
                    <small>{repeatEnabled ? "Repeat details are shown below." : "Turn this on only when the class should repeat."}</small>
                  </div>
                  <label className="switch">
                    <input data-testid="repeat-enable" type="checkbox" checked={repeatEnabled} onChange={(event) => setRepeatEnabled(event.target.checked)} />
                    <span />
                  </label>
                </div>

                {repeatEnabled ? (
                  <>
                    <Card className="repeat-summary">
                      <CardContent>
                        <strong>{selectedTemplate ? `Using template: ${selectedTemplate.title}` : "Manual repeat setup"}</strong>
                        {selectedTemplate ? (
                          <p>
                            {selectedTemplate.weekday} · {selectedTemplate.time} · Repeat {selectedTemplate.repeatUnit} · End {selectedTemplate.repeatEndMode}
                          </p>
                        ) : (
                          <p>Template not selected. Repeat fields stay editable by hand.</p>
                        )}
                      </CardContent>
                    </Card>

                    <div className="repeat-fields">
                      <label className="ui-field">
                        <span>Repeat interval</span>
                        <div className="inline-field">
                          <input data-testid="repeat-interval-value" type="number" min="1" value={repeatIntervalValue} onChange={(event) => setRepeatIntervalValue(event.target.value)} />
                          <select data-testid="repeat-interval-unit" value={repeatIntervalUnit} onChange={(event) => setRepeatIntervalUnit(event.target.value as TemplatePreset["repeatUnit"])}>
                            <option value="week">week</option>
                            <option value="month">month</option>
                          </select>
                        </div>
                      </label>

                      <label className="ui-field">
                        <span>Repeat on</span>
                        <select data-testid="repeat-weekday" value={repeatWeekday} onChange={(event) => setRepeatWeekday(event.target.value)}>
                          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((weekday) => (
                            <option key={weekday}>{weekday}</option>
                          ))}
                        </select>
                      </label>

                      <label className="ui-field">
                        <span>Ends</span>
                        <div className="inline-field">
                          <select data-testid="repeat-end-mode" value={repeatEndMode} onChange={(event) => setRepeatEndMode(event.target.value as TemplatePreset["repeatEndMode"])}>
                            <option value="count">After</option>
                            <option value="date">Until</option>
                            <option value="month">At month end</option>
                          </select>
                          <input data-testid="repeat-end-value" type="text" value={repeatEndValue} onChange={(event) => setRepeatEndValue(event.target.value)} />
                        </div>
                      </label>
                    </div>

                    <div className="weekday-picker" aria-label="Repeat weekdays">
                      {weekdayLabels.map((label, index) => (
                        <Button key={`${label}-${index}`} variant={index === 1 ? "default" : "outline"} size="sm" className="weekday-chip" type="button">
                          {label}
                        </Button>
                      ))}
                    </div>

                    <div className="repeat-chip-row">
                      <Button variant="default" size="sm" type="button">
                        Repeat weekly
                      </Button>
                      <Button variant="outline" size="sm" type="button">
                        Repeat monthly
                      </Button>
                      <Button variant="outline" size="sm" type="button">
                        Repeat until month
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            )}

            <div className="editor-section footer-section">
              {mode === "create" && isSimpleCreateFlow ? (
                <div className="create-default-note">
                  <strong>Simple entry defaults</strong>
                  <p>Class status is Open and payment status is Unpaid. Add the rest later if the record becomes a regular class.</p>
                </div>
              ) : null}

              {mode === "edit" ? (
                <div className="create-default-note">
                  <strong>Current payment time</strong>
                  <p>{paymentPreview}</p>
                </div>
              ) : null}

              <div className="sheet-actions">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button size="sm" onClick={onClose}>
                  {isEditMode ? "Update" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HomePage({ activeView, setActiveView, data, setActiveMonthOffset, onSelectDate, onCopyLastMonth, onOpenDetail, onAdd, onToday, onJumpToToday, onShiftWeek }: {
  activeView: View;
  setActiveView: (view: View) => void;
  data: ReturnType<typeof useMonthState>;
  setActiveMonthOffset: (offset: number) => void;
  onSelectDate: (date: Date) => void;
  onCopyLastMonth: () => void;
  onOpenDetail: () => void;
  onAdd: () => void;
  onToday: () => void;
  onJumpToToday: () => void;
  onShiftWeek: (delta: number) => void;
}) {
  void setActiveMonthOffset;
  void onToday;
  return (
    <>
      {activeView === "month" && <MonthView data={data} onSelectDate={onSelectDate} onCopyLastMonth={onCopyLastMonth} onOpenDetail={onOpenDetail} />}
      {activeView === "week" && <WeekView selectedDate={data.selectedDate} onSelectDate={onSelectDate} onOpenDetail={onOpenDetail} onJumpToToday={onJumpToToday} onShiftWeek={onShiftWeek} />}
      {activeView === "day" && <DayView onAdd={onAdd} data={data} onOpenDetail={onOpenDetail} onSelectDate={onSelectDate} onJumpToToday={onJumpToToday} />}
    </>
  );
}

function ReconcileView() {
  return <ReconcilePage />;
}

export function App() {
  const [page, setPage] = useState<Page>("home");
  const [activeView, setActiveView] = useState<View>("month");
  const [activeMonthOffset, setActiveMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [moreSection, setMoreSection] = useState<MoreSection>("settings");
  const [studioRows, setStudioRows] = useState<StudioRecord[]>(initialStudioRows);
  const [templatePresets, setTemplatePresets] = useState<TemplatePreset[]>(initialTemplates);
  const [studioDialogOpen, setStudioDialogOpen] = useState(false);
  const [studioDialogMode, setStudioDialogMode] = useState<"create" | "edit">("create");
  const [studioDialogStudio, setStudioDialogStudio] = useState<StudioRecord | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [copyPreviewOpen, setCopyPreviewOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTemplate, setEditorTemplate] = useState<TemplatePreset | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");

  const data = useMonthState(activeMonthOffset, selectedDate);
  const monthTitle = `${monthNames[data.monthDate.getMonth()]} ${data.monthDate.getFullYear()}`;
  const copyPreviewMonthDate = monthFromOffset(activeMonthOffset - 1);
  const copyPreviewMonthLabel = `${monthNames[copyPreviewMonthDate.getMonth()]} ${copyPreviewMonthDate.getFullYear()}`;
  const copyPreviewGroups = useMemo(() => groupTemplatesByStudio(templatePresets), [templatePresets]);

  const handleToday = () => {
    setActiveMonthOffset(0);
    setSelectedDate(new Date(initialDate));
    setActiveView("month");
    setPage("home");
  };

  const handleJumpToToday = () => {
    setActiveMonthOffset(0);
    setSelectedDate(new Date(initialDate));
  };

  const handleShiftWeek = (delta: number) => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + delta);
    setSelectedDate(nextDate);
    setActiveMonthOffset(monthOffsetFromDate(nextDate));
  };

  const openEditor = (template: TemplatePreset | null = null, editorMode: EditorMode = "create") => {
    setEditorTemplate(template);
    setEditorMode(editorMode);
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

  const handleAddTemplate = () => {
    setTemplateDialogOpen(true);
    setMoreSection("templates");
    setPage("more");
  };

  const handleCreateStudio = (studio: StudioRecord) => {
    setStudioRows((current) => [...current, studio]);
  };

  const handleUpdateStudio = (studio: StudioRecord) => {
    setStudioRows((current) => current.map((row) => (row.id === studio.id ? studio : row)));
  };

  const handleCreateTemplate = (template: TemplatePreset) => {
    setTemplatePresets((current) => [...current, template]);
  };

  const handleUseTemplate = (template: TemplatePreset) => {
    setMoreSection("templates");
    openEditor(template, "create");
  };

  const openCopyPreview = () => {
    setCopyPreviewOpen(true);
  };

  return (
    <AppShell page={page} setPage={setPage}>
      <MobileFrame
        activeView={activeView}
        setActiveView={setActiveView}
        monthTitle={monthTitle}
        onPrevMonth={() => setActiveMonthOffset(monthOffsetFromDate(data.monthDate) - 1)}
        onNextMonth={() => setActiveMonthOffset(monthOffsetFromDate(data.monthDate) + 1)}
        onToday={handleToday}
        onAdd={() => openEditor(null, "create")}
        page={page}
        setPage={setPage}
      >
        {page === "home" ? (
          <HomePage
            activeView={activeView}
            setActiveView={setActiveView}
            data={data}
            setActiveMonthOffset={setActiveMonthOffset}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setActiveMonthOffset(monthOffsetFromDate(date));
            }}
            onCopyLastMonth={openCopyPreview}
            onOpenDetail={() => setDetailOpen(true)}
            onAdd={() => openEditor(null, "create")}
            onToday={handleToday}
            onJumpToToday={handleJumpToToday}
            onShiftWeek={handleShiftWeek}
          />
        ) : page === "reconcile" ? (
          <ReconcileView />
        ) : (
          <MorePage
            section={moreSection}
            setSection={setMoreSection}
            studios={studioRows}
            templates={templatePresets}
            onUseTemplate={handleUseTemplate}
            onAddStudio={handleAddStudio}
            onAddTemplate={handleAddTemplate}
            onOpenStudio={handleOpenStudio}
          />
        )}
        </MobileFrame>
      <DetailSheet
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onEdit={() => {
          setDetailOpen(false);
          openEditor(null, "edit");
        }}
        onDelete={() => {
          setDetailOpen(false);
          setDeleteConfirmOpen(true);
        }}
      />
      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          setDeleteConfirmOpen(false);
        }}
      />
      <CopyMonthDialog open={copyPreviewOpen} onClose={() => setCopyPreviewOpen(false)} monthLabel={copyPreviewMonthLabel} groups={copyPreviewGroups} />
      <StudioDialog
        open={studioDialogOpen}
        onClose={() => setStudioDialogOpen(false)}
        mode={studioDialogMode}
        studio={studioDialogStudio}
        onCreate={handleCreateStudio}
        onUpdate={handleUpdateStudio}
      />
      <TemplateDialog
        open={templateDialogOpen}
        onClose={() => setTemplateDialogOpen(false)}
        onCreate={handleCreateTemplate}
        studioNames={studioRows.map((studio) => studio.name)}
      />
      <EditorSheet
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditorTemplate(null);
          setEditorMode("create");
        }}
        template={editorTemplate}
        mode={editorMode}
        studios={studioRows}
        templates={templatePresets}
      />
    </AppShell>
  );
}
