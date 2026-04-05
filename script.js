(function () {
  const STORAGE_KEY = "financeBudData";
  const SETTINGS_KEY = "financeBudSettings";

  const conversionRatesToINR = {
    INR: 1,
    USD: 83,
    EUR: 90,
    GBP: 104,
    JPY: 0.56,
  };

  let pieChart;
  let barChart;
  let lineChart;

  function getStoredData() {
    const fallback = { expenses: [] };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return {
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      };
    } catch (error) {
      console.warn("Could not parse saved data.", error);
      return fallback;
    }
  }

  function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function addExpense(expense) {
    const data = getStoredData();
    data.expenses.push(expense);
    saveData(data);
  }

  function deleteExpense(index) {
    const data = getStoredData();
    data.expenses.splice(index, 1);
    saveData(data);
  }

  function toINR(amount, currency) {
    const rate = conversionRatesToINR[currency] || 1;
    return amount * rate;
  }

  function formatAmount(amount, currency) {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }

  function loadExpenses() {
    const expenseList = document.getElementById("expense-list");
    if (!expenseList) return;

    const filter = document.getElementById("category-filter").value;
    const data = getStoredData();
    const expenses = data.expenses;
    expenseList.innerHTML = "";

    let totalINR = 0;

    expenses.forEach((expense, index) => {
      totalINR += toINR(Number(expense.amount), expense.currency);

      if (filter !== "All" && expense.category !== filter) {
        return;
      }

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${formatAmount(expense.amount, expense.currency)}</td>
        <td>${expense.category}</td>
        <td>${expense.date}</td>
        <td>${expense.notes || "-"}</td>
        <td><button class="btn btn-danger small" data-index="${index}">Delete</button></td>
      `;
      expenseList.appendChild(row);
    });

    const totalLabel = document.getElementById("total-inr");
    totalLabel.textContent = `₹${totalINR.toFixed(2)}`;

    expenseList.querySelectorAll("button[data-index]").forEach((button) => {
      button.addEventListener("click", function () {
        const index = Number(this.dataset.index);
        deleteExpense(index);
        loadExpenses();
        updateCharts();
        renderAssistantTips();
      });
    });
  }

  function getCategoryTotals(expenses) {
    return expenses.reduce((acc, expense) => {
      const amountINR = toINR(Number(expense.amount), expense.currency);
      acc[expense.category] = (acc[expense.category] || 0) + amountINR;
      return acc;
    }, {});
  }

  function getMonthlyTotals(expenses) {
    return expenses.reduce((acc, expense) => {
      const date = new Date(expense.date);
      if (Number.isNaN(date.getTime())) return acc;
      const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      acc[label] = (acc[label] || 0) + toINR(Number(expense.amount), expense.currency);
      return acc;
    }, {});
  }

  function updateCharts() {
    const hasChart = typeof Chart !== "undefined";
    if (!hasChart || !document.getElementById("pie-chart")) return;

    const expenses = getStoredData().expenses;
    const categoryTotals = getCategoryTotals(expenses);
    const monthlyTotals = getMonthlyTotals(expenses);
    const categoryLabels = Object.keys(categoryTotals);
    const categoryData = Object.values(categoryTotals);
    const monthLabels = Object.keys(monthlyTotals).sort();
    const monthData = monthLabels.map((label) => monthlyTotals[label]);

    if (pieChart) pieChart.destroy();
    if (barChart) barChart.destroy();
    if (lineChart) lineChart.destroy();

    pieChart = new Chart(document.getElementById("pie-chart"), {
      type: "pie",
      data: {
        labels: categoryLabels,
        datasets: [{
          label: "Category Spend (INR)",
          data: categoryData,
          backgroundColor: ["#4CAF50", "#81C784", "#A5D6A7", "#C8E6C9", "#66BB6A", "#2E7D32", "#AED581"],
        }],
      },
      options: { plugins: { legend: { position: "bottom" } }, maintainAspectRatio: false },
    });

    barChart = new Chart(document.getElementById("bar-chart"), {
      type: "bar",
      data: {
        labels: monthLabels,
        datasets: [{
          label: "Monthly Spending (INR)",
          data: monthData,
          backgroundColor: "#81C784",
          borderRadius: 8,
        }],
      },
      options: { maintainAspectRatio: false },
    });

    lineChart = new Chart(document.getElementById("line-chart"), {
      type: "line",
      data: {
        labels: monthLabels,
        datasets: [{
          label: "Trend (INR)",
          data: monthData,
          borderColor: "#388E3C",
          backgroundColor: "rgba(76, 175, 80, 0.12)",
          fill: true,
          tension: 0.25,
        }],
      },
      options: { maintainAspectRatio: false },
    });
  }

  function renderAssistantTips() {
    const list = document.getElementById("assistant-messages");
    if (!list) return;

    const expenses = getStoredData().expenses;
    const totalINR = expenses.reduce(
      (sum, expense) => sum + toINR(Number(expense.amount), expense.currency),
      0
    );

    const foodINR = expenses
      .filter((expense) => expense.category === "Food")
      .reduce((sum, expense) => sum + toINR(Number(expense.amount), expense.currency), 0);

    const smallExpenses = expenses.filter((expense) => toINR(Number(expense.amount), expense.currency) < 500);

    const tips = [];

    if (totalINR > 0 && foodINR / totalINR > 0.3) {
      tips.push("Food spending is over 30%. Try meal planning to cut costs.");
    }

    if (smallExpenses.length >= 5) {
      tips.push("You have many small expenses. Set a mini daily spending cap.");
    }

    tips.push("Consider SIP investments to grow long-term wealth.");
    tips.push("Track subscriptions monthly and cancel unused ones.");

    list.innerHTML = "";
    tips.forEach((tip) => {
      const item = document.createElement("li");
      item.textContent = tip;
      list.appendChild(item);
    });
  }

  function getSettings() {
    const fallback = { preferredCurrency: "INR", darkMode: false };
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return fallback;
      return { ...fallback, ...JSON.parse(raw) };
    } catch (error) {
      console.warn("Could not parse settings.", error);
      return fallback;
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function applyTheme(settings) {
    if (settings.darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }

  function updateProfileRewards() {
    const pointsLabel = document.getElementById("reward-points");
    const badgeList = document.getElementById("badge-list");
    if (!pointsLabel || !badgeList) return;

    const expensesCount = getStoredData().expenses.length;
    const points = expensesCount * 10;
    pointsLabel.textContent = String(points);

    const badges = [];
    if (points >= 50) badges.push("Saver");
    if (points >= 150) badges.push("Budget Master");
    if (points >= 300) badges.push("Finance Ninja");

    badgeList.innerHTML = badges.length
      ? badges.map((badge) => `<span class="badge">${badge}</span>`).join("")
      : "<span>No badges yet. Keep tracking!</span>";
  }

  function setupDashboard() {
    const form = document.getElementById("expense-form");
    if (!form) return;

    const dateInput = document.getElementById("date");
    if (dateInput) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const amount = Number(document.getElementById("amount").value);
      const currency = document.getElementById("currency").value;
      const category = document.getElementById("category").value;
      const date = document.getElementById("date").value;
      const notes = document.getElementById("notes").value.trim();

      if (!amount || amount <= 0 || !currency || !category || !date) {
        return;
      }

      addExpense({ amount, currency, category, date, notes });
      form.reset();
      if (dateInput) {
        dateInput.value = new Date().toISOString().slice(0, 10);
      }

      loadExpenses();
      updateCharts();
      renderAssistantTips();
    });

    document.getElementById("category-filter").addEventListener("change", () => {
      loadExpenses();
    });

    const refreshTipsBtn = document.getElementById("refresh-tips");
    refreshTipsBtn.addEventListener("click", renderAssistantTips);

    loadExpenses();
    updateCharts();
    renderAssistantTips();
  }

  function setupProfile() {
    const saveBtn = document.getElementById("save-settings");
    if (!saveBtn) return;

    const currencySelect = document.getElementById("preferred-currency");
    const themeToggle = document.getElementById("theme-toggle");
    const logoutBtn = document.getElementById("logout-btn");

    const settings = getSettings();
    currencySelect.value = settings.preferredCurrency;
    themeToggle.checked = Boolean(settings.darkMode);
    applyTheme(settings);

    saveBtn.addEventListener("click", () => {
      const nextSettings = {
        preferredCurrency: currencySelect.value,
        darkMode: themeToggle.checked,
      };
      saveSettings(nextSettings);
      applyTheme(nextSettings);
      alert("Settings saved locally.");
    });

    logoutBtn.addEventListener("click", () => {
      localStorage.clear();
      window.location.href = "index.html";
    });

    updateProfileRewards();
  }

  function initGlobalTheme() {
    applyTheme(getSettings());
  }

  function init() {
    initGlobalTheme();
    setupDashboard();
    setupProfile();
  }

  document.addEventListener("DOMContentLoaded", init);

  window.financeBud = {
    addExpense,
    deleteExpense,
    loadExpenses,
    updateCharts,
  };
})();
