(function () {
  const STORAGE_KEY = "financeBudData";
  const SETTINGS_KEY = "financeBudSettings";
  const PROFILE_KEY = "financeBudProfile";

  const conversionRatesToINR = {
    INR: 1,
    USD: 83,
    EUR: 90,
    GBP: 104,
    JPY: 0.56,
  };

  const categoryColors = {
    Food: "#FF7043",
    Travel: "#42A5F5",
    Bills: "#AB47BC",
    Shopping: "#EC407A",
    Health: "#26A69A",
    Entertainment: "#FFA726",
    Other: "#8D6E63",
  };

  const assistantKnowledgeBase = [
    {
      id: "food_control",
      check: (insight) => insight.foodPercent > 30,
      advice: "Your food spend is high. Set a weekly meal budget and batch-cook 2 days/week.",
      reason: (insight) =>
        `Food is ${insight.foodPercent.toFixed(1)}% of total spending, which is above 30%.`,
    },
    {
      id: "small_expense_control",
      check: (insight) => insight.smallExpenseCount >= 5,
      advice: "You have many small expenses. Use a daily micro-budget to prevent leakages.",
      reason: (insight) =>
        `${insight.smallExpenseCount} transactions are under ₹500, indicating frequent impulse spends.`,
    },
    {
      id: "trend_alert",
      check: (insight) => insight.trendSlope > 0,
      advice: "Your spending trend is rising. Add a weekly spending cap and review every Sunday.",
      reason: (insight) =>
        `Trend model slope is +${insight.trendSlope.toFixed(2)} (INR/day index), showing upward momentum.`,
    },
    {
      id: "trend_good",
      check: (insight) => insight.trendSlope < 0,
      advice: "Great job. Your spending trend is decreasing—keep this rhythm and automate savings.",
      reason: (insight) =>
        `Trend model slope is ${insight.trendSlope.toFixed(2)}, which indicates spending is cooling down.`,
    },
  ];

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

  function getProfile() {
    const fallback = {
      name: "Alex Budgeter",
      email: "alex@financebud.app",
      phone: "+91 99999 99999",
      photo: "",
    };
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return fallback;
      return { ...fallback, ...JSON.parse(raw) };
    } catch (error) {
      console.warn("Could not parse profile.", error);
      return fallback;
    }
  }

  function saveProfile(profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }

  function applyTheme(settings) {
    if (settings.darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }

    const navToggle = document.getElementById("nav-theme-toggle");
    if (navToggle) {
      navToggle.checked = Boolean(settings.darkMode);
    }
  }

  function setupNavThemeToggle() {
    const navToggle = document.getElementById("nav-theme-toggle");
    if (!navToggle) return;

    navToggle.addEventListener("change", () => {
      const settings = getSettings();
      const nextSettings = {
        ...settings,
        darkMode: navToggle.checked,
      };
      saveSettings(nextSettings);
      applyTheme(nextSettings);
    });
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

  function getCategoryColor(category) {
    return categoryColors[category] || "#9E9E9E";
  }

  function loadExpenses() {
    const expenseList = document.getElementById("expense-list");
    if (!expenseList) return;

    const filterEl = document.getElementById("category-filter");
    const filter = filterEl ? filterEl.value : "All";
    const expenses = getStoredData().expenses;
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
        <td><span class="category-pill" style="--cat-color:${getCategoryColor(expense.category)}">${expense.category}</span></td>
        <td>${expense.date}</td>
        <td>${expense.notes || "-"}</td>
        <td><button class="btn btn-danger small" data-index="${index}" type="button">Delete</button></td>
      `;
      expenseList.appendChild(row);
    });

    const totalLabel = document.getElementById("total-inr");
    if (totalLabel) {
      totalLabel.textContent = `₹${totalINR.toFixed(2)}`;
    }

    expenseList.querySelectorAll("button[data-index]").forEach((button) => {
      button.addEventListener("click", function () {
        const index = Number(this.dataset.index);
        deleteExpense(index);
        loadExpenses();
        updateCharts();
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
    if (typeof Chart === "undefined" || !document.getElementById("pie-chart")) return;

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
          backgroundColor: categoryLabels.map((category) => getCategoryColor(category)),
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

  function getExpenseInsights() {
    const expenses = getStoredData().expenses;
    const totalINR = expenses.reduce((sum, item) => sum + toINR(Number(item.amount), item.currency), 0);
    const foodINR = expenses
      .filter((item) => item.category === "Food")
      .reduce((sum, item) => sum + toINR(Number(item.amount), item.currency), 0);
    const smallExpenses = expenses.filter((item) => toINR(Number(item.amount), item.currency) < 500);

    const trendModel = runTrendModel(expenses);

    return {
      totalINR,
      foodPercent: totalINR ? (foodINR / totalINR) * 100 : 0,
      smallExpenseCount: smallExpenses.length,
      expenseCount: expenses.length,
      trendSlope: trendModel.slope,
      predictedNextDaily: trendModel.predictedNext,
      topCategory: getTopCategory(expenses),
    };
  }

  function getTopCategory(expenses) {
    const categoryTotals = getCategoryTotals(expenses);
    const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    return sorted.length ? { name: sorted[0][0], amount: sorted[0][1] } : null;
  }

  // Simple ML-style trend model: linear regression on daily spend sequence.
  function runTrendModel(expenses) {
    const byDay = new Map();
    expenses.forEach((expense) => {
      if (!expense.date) return;
      const key = expense.date;
      const value = toINR(Number(expense.amount), expense.currency);
      byDay.set(key, (byDay.get(key) || 0) + value);
    });

    const points = Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map((entry, index) => ({ x: index + 1, y: entry[1] }));

    if (points.length < 2) {
      return { slope: 0, predictedNext: points.length ? points[0].y : 0 };
    }

    const n = points.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    points.forEach((point) => {
      sumX += point.x;
      sumY += point.y;
      sumXY += point.x * point.y;
      sumXX += point.x * point.x;
    });

    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) {
      return { slope: 0, predictedNext: points[points.length - 1].y };
    }

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    const predictedNext = intercept + slope * (n + 1);
    return { slope, predictedNext: Math.max(0, predictedNext) };
  }

  function getAssistantReply(message) {
    const text = message.toLowerCase();
    const insight = getExpenseInsights();

    if (text.includes("analyze") || text.includes("insight") || text.includes("reason")) {
      const recommendations = getAssistantRecommendations(insight);
      if (!recommendations.length) {
        return "I analyzed your data. Spending pattern looks stable. Keep tracking and automate monthly savings.";
      }
      return recommendations
        .slice(0, 2)
        .map((item, index) => `${index + 1}) ${item.advice} Reason: ${item.reason}`)
        .join(" ");
    }

    if (text.includes("summary") || text.includes("total") || text.includes("spend")) {
      const topCategoryText = insight.topCategory
        ? ` Top category is ${insight.topCategory.name} (₹${insight.topCategory.amount.toFixed(2)}).`
        : "";
      return `You logged ${insight.expenseCount} expenses. Total spending is ₹${insight.totalINR.toFixed(2)}.${topCategoryText}`;
    }

    if (text.includes("food") || text.includes("eat")) {
      return insight.foodPercent > 30
        ? `Food spending is ${insight.foodPercent.toFixed(1)}% of your total, which is above 30%. Try setting a weekly food budget.`
        : `Food spending is ${insight.foodPercent.toFixed(1)}% of your total. Nice control so far.`;
    }

    if (text.includes("small") || text.includes("budget") || text.includes("save")) {
      return insight.smallExpenseCount >= 5
        ? `You have ${insight.smallExpenseCount} small expenses. Consider a daily pocket budget to reduce impulse buys.`
        : "Your small expenses are under control. You can still set a weekly budget for better savings.";
    }

    if (text.includes("invest") || text.includes("sip")) {
      return "Consider SIP investments for disciplined long-term growth. Start small and increase monthly.";
    }

    return "Ask me about spending summary, food control, budget tips, or type 'analyze insights' for model-based reasoning.";
  }

  function getAssistantRecommendations(insight) {
    const rules = assistantKnowledgeBase
      .filter((rule) => rule.check(insight))
      .map((rule) => ({
        advice: rule.advice,
        reason: rule.reason(insight),
      }));

    if (insight.predictedNextDaily > 0) {
      rules.push({
        advice: "Predicted next daily spend suggests setting auto-transfer to savings before daily spending begins.",
        reason: `Trend model predicts next daily spend around ₹${insight.predictedNextDaily.toFixed(2)}.`,
      });
    }

    return rules;
  }

  function addChatMessage(text, role) {
    const chat = document.getElementById("assistant-chat");
    if (!chat) return;

    const bubble = document.createElement("div");
    bubble.className = `chat-message ${role}`;
    bubble.textContent = text;
    chat.appendChild(bubble);
    chat.scrollTop = chat.scrollHeight;
  }

  function seedAssistantGreeting() {
    const chat = document.getElementById("assistant-chat");
    if (!chat || chat.childElementCount > 0) return;

    addChatMessage("Hi! I am your Finance Bud assistant. Ask me about your expenses.", "bot");
    const insight = getExpenseInsights();
    if (insight.foodPercent > 30) {
      addChatMessage("Food spending is above 30%. Meal planning can help reduce costs.", "bot");
    }
    if (insight.smallExpenseCount >= 5) {
      addChatMessage("I noticed several small spends. A mini daily limit could help.", "bot");
    }
  }

  function setupAssistantChat() {
    const form = document.getElementById("assistant-form");
    const input = document.getElementById("assistant-input");
    const analyzeBtn = document.getElementById("refresh-tips");

    if (!form || !input || !analyzeBtn) return;

    seedAssistantGreeting();

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const message = input.value.trim();
      if (!message) return;

      addChatMessage(message, "user");
      const reply = getAssistantReply(message);
      addChatMessage(reply, "bot");
      input.value = "";
    });

    analyzeBtn.addEventListener("click", () => {
      const insight = getExpenseInsights();
      const recommendations = getAssistantRecommendations(insight);
      const leadLine = `Auto-analysis (ML trend): total ₹${insight.totalINR.toFixed(2)}, food ${insight.foodPercent.toFixed(1)}%, small spends ${insight.smallExpenseCount}, slope ${insight.trendSlope.toFixed(2)}.`;
      addChatMessage(leadLine, "bot");
      if (!recommendations.length) {
        addChatMessage("No major risk pattern detected. Keep your current discipline and consider SIP automation.", "bot");
      } else {
        recommendations.slice(0, 2).forEach((item) => {
          addChatMessage(`${item.advice} Reason: ${item.reason}`, "bot");
        });
      }
    });
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
      addChatMessage("New expense added. Ask for a summary anytime.", "bot");
    });

    const filter = document.getElementById("category-filter");
    if (filter) {
      filter.addEventListener("change", loadExpenses);
    }

    loadExpenses();
    updateCharts();
    setupAssistantChat();
  }

  function renderProfileInfo() {
    const profile = getProfile();
    const nameEl = document.getElementById("profile-name");
    const emailEl = document.getElementById("profile-email");
    const phoneEl = document.getElementById("profile-phone");
    const avatarPreview = document.getElementById("avatar-preview");

    if (nameEl) nameEl.textContent = profile.name;
    if (emailEl) emailEl.textContent = profile.email;
    if (phoneEl) phoneEl.textContent = profile.phone;

    if (avatarPreview && profile.photo) {
      avatarPreview.innerHTML = `<img src="${profile.photo}" alt="Profile Photo" />`;
    }
  }

  function setupProfilePhotoUpload() {
    const avatar = document.getElementById("avatar-preview");
    const input = document.getElementById("profile-photo-input");

    if (!avatar || !input) return;

    function openPicker() {
      input.click();
    }

    avatar.addEventListener("click", openPicker);
    avatar.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPicker();
      }
    });

    input.addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const profile = getProfile();
        profile.photo = String(reader.result || "");
        saveProfile(profile);
        renderProfileInfo();
      };
      reader.readAsDataURL(file);
    });
  }

  function setupProfile() {
    const saveBtn = document.getElementById("save-settings");
    if (!saveBtn) return;

    const currencySelect = document.getElementById("preferred-currency");
    const logoutBtn = document.getElementById("logout-btn");

    const settings = getSettings();
    currencySelect.value = settings.preferredCurrency;

    saveBtn.addEventListener("click", () => {
      const nextSettings = {
        ...settings,
        preferredCurrency: currencySelect.value,
      };
      saveSettings(nextSettings);
      alert("Settings saved locally.");
    });

    logoutBtn.addEventListener("click", () => {
      localStorage.clear();
      window.location.href = "index.html";
    });

    renderProfileInfo();
    setupProfilePhotoUpload();
    updateProfileRewards();
  }

  function setupProfileCreationModal() {
    const openBtn = document.getElementById("open-profile-modal");
    const closeBtn = document.getElementById("close-profile-modal");
    const modal = document.getElementById("profile-modal");
    const form = document.getElementById("profile-create-form");

    if (!openBtn || !closeBtn || !modal || !form) return;

    function openModal() {
      modal.classList.remove("hidden");
    }

    function closeModal() {
      modal.classList.add("hidden");
    }

    openBtn.addEventListener("click", openModal);
    closeBtn.addEventListener("click", closeModal);

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const name = document.getElementById("create-name").value.trim();
      const email = document.getElementById("create-email").value.trim();
      const phone = document.getElementById("create-phone").value.trim();

      if (!name || !email || !phone) return;

      const current = getProfile();
      saveProfile({
        ...current,
        name,
        email,
        phone,
      });

      window.location.href = "profile.html";
    });
  }

  function init() {
    applyTheme(getSettings());
    setupNavThemeToggle();
    setupDashboard();
    setupProfile();
    setupProfileCreationModal();
  }

  document.addEventListener("DOMContentLoaded", init);

  window.financeBud = {
    addExpense,
    deleteExpense,
    loadExpenses,
    updateCharts,
  };
})();
