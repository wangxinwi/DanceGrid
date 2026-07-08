const viewButtons = document.querySelectorAll(".segment");
const panels = document.querySelectorAll(".view-panel");
const detailSheet = document.getElementById("detailSheet");
const editorSheet = document.getElementById("editorSheet");
const monthGrid = document.getElementById("monthGrid");
const monthStats = document.getElementById("monthStats");
const monthAgenda = document.getElementById("monthAgenda");
const monthTitle = document.getElementById("monthTitle");
const selectedDayLabel = document.getElementById("selectedDayLabel");
const openDetailButtons = document.querySelectorAll("[data-open-detail]");
const openEditorButtons = document.querySelectorAll("[data-open-editor]");

const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"];
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
let activeMonthOffset = 0;
let selectedDate = new Date(initialDate);

const scheduleData = {
  "2026-06": [
    { date: "2026-06-04", fee: 300, sessions: 1, hasClass: true },
    { date: "2026-06-11", fee: 300, sessions: 2, hasClass: true },
    { date: "2026-06-18", fee: 500, sessions: 1, hasClass: true },
    { date: "2026-06-25", fee: 300, sessions: 2, hasClass: true },
  ],
  "2026-07": [
    { date: "2026-07-02", fee: 300, sessions: 2, hasClass: true },
    { date: "2026-07-04", fee: 200, sessions: 1, hasClass: true },
    { date: "2026-07-07", fee: 800, sessions: 2, hasClass: true },
    { date: "2026-07-09", fee: 300, sessions: 3, hasClass: true },
    { date: "2026-07-11", fee: 300, sessions: 1, hasClass: true },
    { date: "2026-07-16", fee: 600, sessions: 2, hasClass: true },
    { date: "2026-07-19", fee: 300, sessions: 1, hasClass: true },
    { date: "2026-07-24", fee: 300, sessions: 2, hasClass: true },
    { date: "2026-07-29", fee: 300, sessions: 1, hasClass: true },
  ],
  "2026-08": [],
};

const monthAgendaData = {
  "2026-06": {
    title: "June 2026",
    summary: [
      { label: "Sessions", value: "16" },
      { label: "Receivable", value: "¥4,800" },
      { label: "Received", value: "¥3,900" },
    ],
    list: [
      {
        time: "19:00",
        title: "Studio A",
        meta: "Regular · Open · Paid",
        fee: "¥300",
      },
      {
        time: "21:00",
        title: "Studio C",
        meta: "Workshop · Closed · Pending",
        fee: "¥500",
      },
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
      {
        time: "18:00",
        title: "Studio A",
        meta: "Regular · Open · Paid",
        fee: "¥300",
      },
      {
        time: "20:30",
        title: "Studio B",
        meta: "Private · Pending · Unpaid",
        fee: "¥500",
      },
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

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatMonthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthDateFromOffset(offset) {
  return new Date(initialDate.getFullYear(), initialDate.getMonth() + offset, 1);
}

function isWeekend(date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

function getMonthGridDates(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);
  const gridStart = new Date(startOfMonth);
  const offset = (startOfMonth.getDay() + 6) % 7;
  gridStart.setDate(startOfMonth.getDate() - offset);
  const totalCells = 42;
  const dates = [];

  for (let index = 0; index < totalCells; index += 1) {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + index);
    dates.push(current);
  }

  return { dates, startOfMonth, endOfMonth };
}

function renderMonth() {
  const monthDate = monthDateFromOffset(activeMonthOffset);
  const monthKey = formatMonthKey(monthDate);
  const monthLabel = `${monthNames[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
  const data = scheduleData[monthKey] || [];
  const monthMeta = monthAgendaData[monthKey] || monthAgendaData["2026-08"];
  const { dates, startOfMonth, endOfMonth } = getMonthGridDates(monthDate);

  monthTitle.textContent = monthLabel;

  monthGrid.innerHTML = "";

  dates.forEach((date) => {
    const dateKey = formatDateKey(date);
    const inMonth = date.getMonth() === monthDate.getMonth();
    const counts = data.filter((entry) => entry.date === dateKey);
    const isSelected = formatDateKey(selectedDate) === dateKey;
    const isToday = dateKey === formatDateKey(initialDate);

    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "day-cell",
      !inMonth ? "muted" : "",
      isWeekend(date) ? "weekend" : "",
      isSelected ? "selected" : "",
    ]
      .filter(Boolean)
      .join(" ");
    button.dataset.date = dateKey;

    const dayLabel = document.createElement("span");
    dayLabel.textContent = date.getDate();
    button.appendChild(dayLabel);

    if (isToday && inMonth) {
      const todayTag = document.createElement("strong");
      todayTag.textContent = "Today";
      button.appendChild(todayTag);
    } else if (counts.length > 0) {
      const badge = document.createElement("em");
      badge.textContent = counts.reduce((sum, item) => sum + item.sessions, 0);
      button.appendChild(badge);
    } else if (!inMonth) {
      const emptyHint = document.createElement("em");
      emptyHint.textContent = " ";
      emptyHint.style.visibility = "hidden";
      button.appendChild(emptyHint);
    }

    button.addEventListener("click", () => {
      selectedDate = new Date(date);
      activeMonthOffset = selectedDate.getMonth() - initialDate.getMonth() + (selectedDate.getFullYear() - initialDate.getFullYear()) * 12;
      renderMonth();
      renderSelectedDay();
      setView("day");
    });

    monthGrid.appendChild(button);
  });

  renderMonthStats(monthMeta, monthKey, monthDate);
  renderMonthAgenda(monthMeta);
}

function renderMonthStats(monthMeta, monthKey, monthDate) {
  const monthData = scheduleData[monthKey] || [];
  const totalSessions = monthData.reduce((sum, item) => sum + item.sessions, 0);
  const totalFee = monthData.reduce((sum, item) => sum + item.fee, 0);
  const totalReceived = monthKey === "2026-06" ? 3900 : monthKey === "2026-07" ? 4700 : 0;

  const stats = monthMeta.summary.length
    ? monthMeta.summary
    : [
        { label: "Sessions", value: "0" },
        { label: "Receivable", value: "¥0" },
        { label: "Received", value: "¥0" },
      ];

  monthStats.innerHTML = "";

  if (monthKey === "2026-08") {
    monthStats.insertAdjacentHTML(
      "beforeend",
      `<div class="empty-state">No schedule yet for ${monthMeta.title}. Use Add class or copy last month to fill this month.</div>`,
    );
    return;
  }

  stats.forEach((item) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `<span>${item.label}</span><strong>${item.value}</strong>`;
    monthStats.appendChild(card);
  });

  if (monthKey === "2026-06") {
    const extra = document.createElement("div");
    extra.className = "stat-card";
    extra.innerHTML = `<span>Historical fee total</span><strong>¥${totalFee}</strong>`;
    monthStats.appendChild(extra);
  }

  if (monthKey === "2026-07") {
    const extra = document.createElement("div");
    extra.className = "stat-card";
    extra.innerHTML = `<span>Received</span><strong>¥${totalReceived}</strong>`;
    monthStats.appendChild(extra);
  }
}

function renderMonthAgenda(monthMeta) {
  monthAgenda.innerHTML = "";

  if (!monthMeta.list.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<strong>${monthMeta.title}</strong><p>${monthMeta.note}</p>`;
    monthAgenda.appendChild(empty);
    return;
  }

  monthMeta.list.forEach((item) => {
    const row = document.createElement("button");
    row.className = "agenda-row";
    row.type = "button";
    row.dataset.openDetail = "true";
    row.innerHTML = `
      <span class="agenda-time">${item.time}</span>
      <span class="agenda-main">
        <strong>${item.title}</strong>
        <small>${item.meta}</small>
      </span>
      <span class="agenda-meta">${item.fee}</span>
    `;
    row.addEventListener("click", () => detailSheet.showModal());
    monthAgenda.appendChild(row);
  });
}

function renderSelectedDay() {
  const key = formatDateKey(selectedDate);
  const monthKey = formatMonthKey(selectedDate);
  const monthMeta = monthAgendaData[monthKey] || monthAgendaData["2026-08"];
  const dayName = selectedDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  selectedDayLabel.textContent = dayName;

  if (monthKey === "2026-08") {
    monthAgenda.innerHTML = `<div class="empty-state"><strong>${dayName}</strong><p>No classes have been added for this month yet.</p></div>`;
    return;
  }

  if (key === "2026-07-07") {
    monthAgenda.innerHTML = `
      <button class="agenda-row" type="button" data-open-detail>
        <span class="agenda-time">18:00</span>
        <span class="agenda-main">
          <strong>Studio A</strong>
          <small>Regular · Open · Paid</small>
        </span>
        <span class="agenda-meta">¥300</span>
      </button>
      <button class="agenda-row" type="button" data-open-detail>
        <span class="agenda-time">20:30</span>
        <span class="agenda-main">
          <strong>Studio B</strong>
          <small>Private · Pending · Unpaid</small>
        </span>
        <span class="agenda-meta">¥500</span>
      </button>
    `;
    return;
  }

  const dayCount = (scheduleData[monthKey] || []).filter((item) => item.date === key).length;
  if (!dayCount) {
    monthAgenda.innerHTML = `<div class="empty-state"><strong>${dayName}</strong><p>No class scheduled on this date.</p></div>`;
    return;
  }

  monthAgenda.innerHTML = `<div class="empty-state"><strong>${dayName}</strong><p>${dayCount} class(es) scheduled for this day.</p></div>`;
}

function setView(view) {
  viewButtons.forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  panels.forEach((panel) => {
    const active = panel.dataset.panel === view;
    panel.classList.toggle("active", active);
    panel.setAttribute("aria-hidden", String(!active));
  });
}

viewButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

openDetailButtons.forEach((button) => {
  button.addEventListener("click", () => detailSheet.showModal());
});

openEditorButtons.forEach((button) => {
  button.addEventListener("click", () => editorSheet.showModal());
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;

    if (action === "reconcile") {
      setView("month");
      document.querySelector(".reconcile-panel").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (action === "today") {
      activeMonthOffset = 0;
      selectedDate = new Date(initialDate);
      renderMonth();
      renderSelectedDay();
      setView("month");
      return;
    }

    if (action === "prev-month") {
      activeMonthOffset -= 1;
      renderMonth();
      return;
    }

    if (action === "next-month") {
      activeMonthOffset += 1;
      renderMonth();
      return;
    }
  });
});

renderMonth();
renderSelectedDay();
