import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Home,
  ListFilter,
  Search,
  Plus,
  Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type View = "month" | "week" | "day";
type Page = "home" | "reconcile" | "more";
type MoreSection = "settings" | "studio" | "templates";
type MonthKey = "2026-06" | "2026-07" | "2026-08";

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
  type: "Regular" | "Private" | "Workshop" | "Substitute";
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
  type: "Regular" | "Private" | "Workshop" | "Substitute";
  weekday: string;
  time: string;
  repeatUnit: "week" | "month";
  repeatEndMode: "count" | "date" | "month";
  repeatEndValue: string;
  fee: string;
};

const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"];
const weekdayLongLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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
      { time: "20:30", title: "Studio B", meta: "Private · Pending · Unpaid", fee: "¥500" },
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

const studioRows = [
  {
    name: "Studio A",
    type: "Regular",
    baseFee: "¥300 / session",
    payDay: "28th",
    contact: "Miki · 138-0000-0001",
    note: "Repeat weekly Tue 18:00",
  },
  {
    name: "Studio B",
    type: "Private",
    baseFee: "¥500 / session",
    payDay: "30th",
    contact: "Ken · 138-0000-0002",
    note: "Weekend sessions included",
  },
  {
    name: "Studio C",
    type: "Workshop",
    baseFee: "¥800 / session",
    payDay: "31st",
    contact: "Aya · 138-0000-0003",
    note: "One-off events and special slots",
  },
];

const templates: TemplatePreset[] = [
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
    detail: "Repeats every month",
    extra: "Repeat until Aug 2026",
    status: "Draft",
    studio: "Studio B",
    type: "Private",
    weekday: "Friday",
    time: "20:30 - 22:00",
    repeatUnit: "month",
    repeatEndMode: "date",
    repeatEndValue: "Aug 2026",
    fee: "500",
  },
  {
    key: "studio-c-sat",
    title: "Saturday 14:00 · Studio C",
    detail: "Regular class template",
    extra: "Repeat for 4 months",
    status: "Hold",
    studio: "Studio C",
    type: "Workshop",
    weekday: "Saturday",
    time: "14:00 - 16:00",
    repeatUnit: "month",
    repeatEndMode: "count",
    repeatEndValue: "4 months",
    fee: "800",
  },
];

const scheduleEvents: ScheduleEvent[] = [
  { date: "2026-07-07", time: "08:00", end: "09:00", title: "Warm-up", studio: "Studio A", type: "Regular", status: "Open", pay: "Paid", note: "Daily practice", weekend: false },
  { date: "2026-07-07", time: "10:30", end: "12:00", title: "Core Choreo", studio: "Studio A", type: "Regular", status: "Open", pay: "Paid", note: "Repeat weekly" },
  { date: "2026-07-07", time: "18:00", end: "19:30", title: "Private Coaching", studio: "Studio B", type: "Private", status: "Pending", pay: "Overdue", note: "Manual confirm" },
  { date: "2026-07-08", time: "09:30", end: "11:00", title: "Technique Lab", studio: "Studio A", type: "Regular", status: "Open", pay: "Paid", note: "Weekday flow" },
  { date: "2026-07-08", time: "18:00", end: "19:00", title: "Studio Check-in", studio: "Studio C", type: "Substitute", status: "Leave", pay: "Pending", note: "Adjusted this week", weekend: false },
  { date: "2026-07-09", time: "15:00", end: "16:30", title: "Youth Session", studio: "Studio C", type: "Workshop", status: "Leave", pay: "Pending", note: "Weekend included", weekend: true },
  { date: "2026-07-10", time: "19:00", end: "20:30", title: "Night Drill", studio: "Studio B", type: "Private", status: "Closed", pay: "Paid", note: "One-off slot" },
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
      { time: "20:30", title: "Studio B", meta: "Private · Pending · Unpaid", fee: "¥500" },
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

function getTemplateByTitle(title: string) {
  return templates.find((template) => template.title === title);
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
      fee: event.type === "Workshop" ? "¥500" : event.type === "Private" ? "¥300" : "¥300",
    }));
    const dayDetail = dayDetailByKey[selectedKey] ?? {
      title: formatWeekLabel(selectedDate),
      dateLabel: selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      summary: [
        { label: "Classes", value: String(selectedItems.length) },
        { label: "Status", value: selectedItems.length > 0 ? "Open" : "Empty" },
        { label: "Fee", value: selectedItems.length > 0 ? `¥${selectedEvents.reduce((sum, item) => sum + (item.type === "Workshop" ? 500 : item.type === "Private" ? 300 : 300), 0)}` : "¥0" },
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
            ["more", "More"],
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

function MobileFrame({ activeView, setActiveView, monthTitle, onPrevMonth, onNextMonth, onToday, onSearch, onAdd, page, setPage, children }: {
  activeView: View;
  setActiveView: (view: View) => void;
  monthTitle: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onSearch: () => void;
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
                  <Button variant="ghost" size="icon" className="toolbar-link icon-link" onClick={onSearch} aria-label="Search">
                    <Search size={16} />
                  </Button>
                </div>
              </div>

              <Tabs value={activeView} onValueChange={(value) => setActiveView(value as View)}>
                <TabsList className="segmented view-tabs" aria-label="Views">
                  <TabsTrigger value="day">Day</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                </TabsList>
              </Tabs>
            </>
          ) : (
            <div className="page-topbar">
              <div>
                <SectionLabel>{page === "reconcile" ? "Reconcile" : "More"}</SectionLabel>
                <h2>{page === "reconcile" ? "Monthly fee review" : "Secondary tools"}</h2>
              </div>
              <div className="topbar-actions">
                <Button variant="ghost" size="icon" className="toolbar-link icon-link" onClick={onSearch} aria-label="Search">
                  <Search size={16} />
                </Button>
              </div>
            </div>
          )}
        </div>

        <main className="screen-main">{children}</main>

        <div className="mobile-bottom-nav" role="tablist" aria-label="Primary">
          {[
            ["home", "Home", Home],
            ["reconcile", "Reconcile", ListFilter],
            ["more", "More", Settings2],
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
          <Button className="fab" data-testid="add-class" onClick={onAdd} aria-label="Add class">
            <Plus size={18} />
          </Button>
        )}
      </div>
    </>
  );
}

function MonthView({ data, onSelectDate, onCopyLastMonth, onOpenDetail }: { data: ReturnType<typeof useMonthState>; onSelectDate: (date: Date) => void; onCopyLastMonth: () => void; onOpenDetail: () => void }) {
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
            const matches = data.schedule.filter((item) => item.date === dateKey);
            const isSelected = data.selectedKey === dateKey;
            const isToday = dateKey === formatDateKey(initialDate);
            return (
              <button
                key={dateKey}
                type="button"
                className={classNames("day-cell", !inMonth && "muted", isWeekend(date) && "weekend", isSelected && "selected", isToday && "today")}
                onClick={() => onSelectDate(date)}
              >
                <span className="date-number">{date.getDate()}</span>
                {matches.length > 0 ? <span className="day-cell-dot" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="summary-panel">
        <div className="section-head">
          <div>
            <SectionLabel>Selected day</SectionLabel>
            <h3>{data.selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</h3>
          </div>
          <span className="text-button-like">{data.selectedItems.length} classes</span>
        </div>

        <div className="month-stats">
          {data.monthMeta.summary.length > 0 ? (
            <>
              {data.monthMeta.summary.map((item) => (
                <div key={item.label} className="stat-card">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              {data.monthKey === "2026-06" && (
                <div className="stat-card">
                  <span>Historical fee total</span>
                  <strong>¥{data.totalFee}</strong>
                </div>
              )}
              {data.monthKey === "2026-07" && (
                <div className="stat-card">
                  <span>Received</span>
                  <strong>¥{data.totalReceived}</strong>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <strong>No schedule yet</strong>
              <p>{data.monthMeta.note}</p>
            </div>
          )}
        </div>

        <div className="agenda-list">
          {data.monthKey === "2026-08" ? (
            <div className="empty-state">
              <strong>August 2026</strong>
              <p>{data.monthMeta.note}</p>
            </div>
          ) : data.selectedItems.length > 0 ? (
            data.selectedItems.map((item) => (
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
            <div className="empty-state tight">
              <strong>No classes on this day</strong>
              <p>Open a date in Month view or add a class with the floating button.</p>
            </div>
          )}
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

function EventBadge({ label, tone }: { label: string; tone: "success" | "warning" | "danger" | "neutral" }) {
  const variant = tone === "neutral" ? "secondary" : tone === "danger" ? "destructive" : tone;
  return <Badge variant={variant as "secondary" | "success" | "warning" | "destructive"}>{label}</Badge>;
}

function EventCard({ event, style, onOpenDetail }: { event: ScheduleEvent; style: CSSProperties; onOpenDetail: () => void }) {
  return (
    <button className={classNames("schedule-event", event.weekend && "weekend")} type="button" style={style} onClick={onOpenDetail} aria-label={`Open ${event.title}`}>
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
        <EventBadge label={event.type} tone={event.type === "Regular" ? "success" : event.type === "Private" ? "warning" : event.type === "Workshop" ? "neutral" : "danger"} />
        <EventBadge label={event.pay} tone={event.pay === "Paid" ? "success" : event.pay === "Pending" ? "warning" : "danger"} />
      </span>
      <span className="event-handle event-handle-top" aria-hidden="true" />
      <span className="event-handle event-handle-bottom" aria-hidden="true" />
    </button>
  );
}

function WeekAgendaCard({ event, onOpenDetail, style }: { event: ScheduleEvent; onOpenDetail: () => void; style?: CSSProperties }) {
  return (
    <button className={classNames("week-mobile-event", event.weekend && "weekend")} type="button" style={style} onClick={onOpenDetail} aria-label={`Open ${event.title}`}>
      <div className="week-mobile-event-time">
        {event.time}
        <small>{event.end}</small>
      </div>
      <div className="week-mobile-event-main">
        <strong>{event.title}</strong>
        <p>{event.studio}</p>
      </div>
      <div className="week-mobile-event-meta">
        <EventBadge label={event.type} tone={event.type === "Regular" ? "success" : event.type === "Private" ? "warning" : event.type === "Workshop" ? "neutral" : "danger"} />
        <EventBadge label={event.pay} tone={event.pay === "Paid" ? "success" : event.pay === "Pending" ? "warning" : "danger"} />
      </div>
    </button>
  );
}

function WeekMobileView({
  weekDates,
  selectedDate,
  onOpenDetail,
}: {
  weekDates: Date[];
  selectedDate: Date;
  onOpenDetail: () => void;
}) {
  const mobileWeekWidthRem = 50.5;
  return (
    <section className="week-mobile-board" aria-label="Week schedule">
      <div className="week-mobile-header">
        <span className="week-time-slot" />
        <div className="week-mobile-days">
          {weekDates.map((date) => {
            const dateKey = formatDateKey(date);
            const active = dateKey === formatDateKey(selectedDate);
            return (
              <button key={dateKey} type="button" className={classNames("week-mobile-day-head", active && "active")}>
                <strong>{weekdayLongLabels[date.getDay() === 0 ? 6 : date.getDay() - 1]}</strong>
                <span>{date.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="week-mobile-scroll">
        <div className="week-mobile-scroll-body">
          <div className="week-mobile-timeline">
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

            <div className="week-mobile-grid" style={{ "--week-mobile-columns": 7, "--week-mobile-width": `${mobileWeekWidthRem}rem` } as CSSProperties}>
              {Array.from({ length: 16 }, (_, index) => (
                <div className="week-mobile-hour-line" key={index} />
              ))}
              {weekDates.flatMap((date) => {
                const dateKey = formatDateKey(date);
                const events = getEventsForDate(dateKey);
                const dayIndex = weekDates.findIndex((candidate) => formatDateKey(candidate) === dateKey);
                return events.map((event) => {
                  const top = ((toTimeMinutes(event.time) - 7 * 60) / 60) * 4.2;
                  const height = Math.max(((toTimeMinutes(event.end) - toTimeMinutes(event.time)) / 60) * 4.2, 2.25);
                  const dayWidth = 7.1;
                  const left = `calc(${dayIndex * dayWidth}rem + 0.22rem)`;
                  const width = `calc(${dayWidth}rem - 0.44rem)`;
                  return (
                    <WeekAgendaCard
                      key={`${event.date}-${event.time}-${event.title}`}
                      event={event}
                      onOpenDetail={onOpenDetail}
                      style={{
                        top: `${top}rem`,
                        height: `${height}rem`,
                        left,
                        width,
                      }}
                    />
                  );
                });
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

function WeekView({ selectedDate, onSelectDate, onOpenDetail }: { selectedDate: Date; onSelectDate: (date: Date) => void; onOpenDetail: () => void }) {
  const weekDates = getWeekDates(selectedDate);
  return (
    <section className="view-panel active" data-panel="week">
      <div className="day-header">
        <div>
          <SectionLabel>Week view</SectionLabel>
          <h3>{formatWeekLabel(weekDates[0])} - {formatWeekLabel(weekDates[6])}</h3>
        </div>
        <span className="text-button-like">Sunday included</span>
      </div>

      <div className="week-board">
        <div className="week-grid-shell">
          <div className="week-grid-head">
            <span className="week-time-slot" />
            {weekDates.map((date) => (
              <button key={formatDateKey(date)} type="button" className={classNames("week-day-head", formatDateKey(date) === formatDateKey(selectedDate) && "active")} onClick={() => onSelectDate(date)}>
                <strong>{weekdayLongLabels[date.getDay() === 0 ? 6 : date.getDay() - 1]}</strong>
                <span>{date.getDate()}</span>
              </button>
            ))}
          </div>
          <div className="week-grid-body">
            <TimeRail />
            <div className="week-columns">
              {weekDates.map((date) => {
                const events = getEventsForDate(formatDateKey(date));
                return (
                  <div className={classNames("week-column", isWeekend(date) && "weekend")} key={formatDateKey(date)}>
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

      <WeekMobileView weekDates={weekDates} selectedDate={selectedDate} onOpenDetail={onOpenDetail} />
    </section>
  );
}

function DayView({ onAdd, data, onOpenDetail }: { onAdd: () => void; data: ReturnType<typeof useMonthState>; onOpenDetail: () => void }) {
  const dateKey = data.selectedKey;
  const events = getEventsForDate(dateKey);
  return (
    <section className="view-panel active" data-panel="day">
      <div className="day-header">
        <div>
          <SectionLabel>Day view</SectionLabel>
          <h3>{data.dayDetail.title}</h3>
        </div>
        <button className="primary-button" type="button" onClick={onAdd}>
          + Add
        </button>
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

function StudioPage() {
  return (
    <section className="page-panel">
      <div className="section-head">
        <div>
          <SectionLabel>Studio</SectionLabel>
          <h3>Studio list</h3>
        </div>
        <button className="text-button" type="button">+ New studio</button>
      </div>
      <div className="list-stack">
        {studioRows.map((studio) => (
          <article className="list-row" key={studio.name}>
            <div>
              <strong>{studio.name}</strong>
              <p>{studio.type} · {studio.baseFee} · {studio.payDay}</p>
              <small>{studio.contact}</small>
            </div>
            <Badge variant={studio.type === "Regular" ? "success" : studio.type === "Private" ? "warning" : "secondary"}>{studio.type}</Badge>
          </article>
        ))}
      </div>
    </section>
  );
}

function TemplatePage({ onUseTemplate }: { onUseTemplate: (template: TemplatePreset) => void }) {
  return (
    <section className="page-panel">
      <div className="section-head">
        <div>
          <SectionLabel>Templates</SectionLabel>
          <h3>Regular class templates</h3>
        </div>
        <button className="text-button" type="button">+ New template</button>
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

function SettingsPage() {
  return (
    <section className="page-panel">
      <div className="section-head">
        <div>
          <SectionLabel>Settings</SectionLabel>
          <h3>Security and display</h3>
        </div>
      </div>
      <div className="settings-grid">
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
  onUseTemplate,
}: {
  section: MoreSection;
  setSection: (section: MoreSection) => void;
  onUseTemplate: (template: TemplatePreset) => void;
}) {
  return (
    <section className="page-panel">
      <div className="section-head">
        <div>
          <SectionLabel>More</SectionLabel>
          <h3>Secondary tools</h3>
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
          <SettingsPage />
        ) : section === "studio" ? (
          <StudioPage />
        ) : (
          <TemplatePage onUseTemplate={onUseTemplate} />
        )}
      </div>
    </section>
  );
}

function DetailSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
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
            <Button variant="outline" size="sm" onClick={onClose}>Copy</Button>
            <Button variant="outline" size="sm" onClick={onClose}>Edit</Button>
            <Button variant="destructive" size="sm" onClick={onClose}>Delete</Button>
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
}: {
  open: boolean;
  onClose: () => void;
  template: TemplatePreset | null;
}) {
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(template?.key ?? "no-template");

  useEffect(() => {
    if (open) {
      setSelectedTemplateKey(template?.key ?? "no-template");
    }
  }, [open, template]);

  const selectedTemplate = templates.find((item) => item.key === selectedTemplateKey) ?? null;
  const fieldTemplate = selectedTemplate ?? template ?? templates[0];
  const templateOptions = ["No template", ...templates.map((item) => item.title)];

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="editor-dialog">
        <DialogHeader>
          <DialogTitle>Add / edit class</DialogTitle>
          <DialogDescription>Pick a template first, then adjust the repeat rule or override fields manually.</DialogDescription>
        </DialogHeader>

        <div className="sheet-card editor-card">
          <div className="form-grid">
            <label className="wide ui-field">
              <span>Template</span>
              <Select
                value={selectedTemplate?.title ?? "No template"}
                onValueChange={(value) => {
                  if (value === "No template") {
                    setSelectedTemplateKey("no-template");
                    return;
                  }
                  const matched = templates.find((item) => item.title === value);
                  if (matched) {
                    setSelectedTemplateKey(matched.key);
                  }
                }}
              >
                <SelectTrigger data-testid="edit-template">
                  <SelectValue placeholder="No template" />
                </SelectTrigger>
                <SelectContent>
                  {templateOptions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
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
                  <p>No template attached. Fill the class manually or choose a preset to auto-fill repeat fields.</p>
                )}
              </CardContent>
            </Card>

            <label className="ui-field">
              <span>Type</span>
              <select data-testid="edit-type" defaultValue={fieldTemplate.type}>
                <option>Regular</option>
                <option>Private</option>
                <option>Workshop</option>
                <option>Substitute</option>
              </select>
            </label>
            <label className="ui-field">
              <span>Studio</span>
              <select data-testid="edit-studio" defaultValue={fieldTemplate.studio}>
                {Array.from(new Set(templates.map((template) => template.studio))).map((studio) => (
                  <option key={studio}>{studio}</option>
                ))}
              </select>
            </label>
            <label className="ui-field">
              <span>Date</span>
              <input data-testid="edit-date" type="date" defaultValue="2026-07-07" />
            </label>
            <label className="ui-field">
              <span>Time</span>
              <input data-testid="edit-time" type="text" defaultValue={fieldTemplate.time} />
            </label>
            <label className="wide ui-field">
              <span>Fee</span>
              <input data-testid="edit-fee" type="text" defaultValue={fieldTemplate.fee} />
            </label>

            <div className="wide repeat-section">
              <div className="repeat-toggle">
                <span>Regular class repeat</span>
                <label className="switch">
                  <input data-testid="repeat-enable" type="checkbox" defaultChecked />
                  <span />
                </label>
              </div>

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
                    <input data-testid="repeat-interval-value" type="number" min="1" defaultValue={fieldTemplate.repeatEndValue.match(/^\d+/)?.[0] ?? "1"} />
                    <select data-testid="repeat-interval-unit" defaultValue={fieldTemplate.repeatUnit}>
                      <option value="week">week</option>
                      <option value="month">month</option>
                    </select>
                  </div>
                </label>

                <label className="ui-field">
                  <span>Repeat on</span>
                  <select data-testid="repeat-weekday" defaultValue={fieldTemplate.weekday}>
                    {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((weekday) => (
                      <option key={weekday}>{weekday}</option>
                    ))}
                  </select>
                </label>

                <label className="ui-field">
                  <span>Ends</span>
                  <div className="inline-field">
                    <select data-testid="repeat-end-mode" defaultValue={fieldTemplate.repeatEndMode}>
                      <option value="count">After</option>
                      <option value="date">Until</option>
                      <option value="month">At month end</option>
                    </select>
                    <input data-testid="repeat-end-value" type="text" defaultValue={fieldTemplate.repeatEndValue} />
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
                <Button variant="default" size="sm">Repeat weekly</Button>
                <Button variant="outline" size="sm">Repeat monthly</Button>
                <Button variant="outline" size="sm">Repeat until month</Button>
              </div>
            </div>

            <label className="wide ui-field">
              <span>Note</span>
              <textarea rows={3} placeholder="Optional notes" />
            </label>
          </div>

          <div className="sheet-actions">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={onClose}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HomePage({ activeView, setActiveView, data, setActiveMonthOffset, onSelectDate, onCopyLastMonth, onOpenDetail, onAdd, onSearch, onToday }: {
  activeView: View;
  setActiveView: (view: View) => void;
  data: ReturnType<typeof useMonthState>;
  setActiveMonthOffset: (offset: number) => void;
  onSelectDate: (date: Date) => void;
  onCopyLastMonth: () => void;
  onOpenDetail: () => void;
  onAdd: () => void;
  onSearch: () => void;
  onToday: () => void;
}) {
  void setActiveMonthOffset;
  void onSearch;
  void onToday;
  return (
    <>
      {activeView === "month" && <MonthView data={data} onSelectDate={onSelectDate} onCopyLastMonth={onCopyLastMonth} onOpenDetail={onOpenDetail} />}
      {activeView === "week" && <WeekView selectedDate={data.selectedDate} onSelectDate={onSelectDate} onOpenDetail={onOpenDetail} />}
      {activeView === "day" && <DayView onAdd={onAdd} data={data} onOpenDetail={onOpenDetail} />}
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
  const [detailOpen, setDetailOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTemplate, setEditorTemplate] = useState<TemplatePreset | null>(null);

  const data = useMonthState(activeMonthOffset, selectedDate);
  const monthTitle = `${monthNames[data.monthDate.getMonth()]} ${data.monthDate.getFullYear()}`;

  const handleToday = () => {
    setActiveMonthOffset(0);
    setSelectedDate(new Date(initialDate));
    setActiveView("month");
    setPage("home");
  };

  const handleSearch = () => {
    setMoreSection("settings");
    setPage("more");
  };

  const openEditor = (template: TemplatePreset | null = null) => {
    setEditorTemplate(template);
    setEditorOpen(true);
  };

  const handleUseTemplate = (template: TemplatePreset) => {
    setPage("home");
    setMoreSection("templates");
    setEditorTemplate(template);
    setEditorOpen(true);
    setActiveView("day");
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
        onSearch={handleSearch}
        onAdd={() => openEditor(null)}
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
              setActiveView("day");
            }}
            onCopyLastMonth={() => setActiveMonthOffset(-1)}
            onOpenDetail={() => setDetailOpen(true)}
            onAdd={() => openEditor(null)}
            onSearch={handleSearch}
            onToday={handleToday}
          />
        ) : page === "reconcile" ? (
          <ReconcileView />
        ) : (
          <MorePage section={moreSection} setSection={setMoreSection} onUseTemplate={handleUseTemplate} />
        )}
      </MobileFrame>
      <DetailSheet open={detailOpen} onClose={() => setDetailOpen(false)} />
      <EditorSheet
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditorTemplate(null);
        }}
        template={editorTemplate}
      />
    </AppShell>
  );
}
