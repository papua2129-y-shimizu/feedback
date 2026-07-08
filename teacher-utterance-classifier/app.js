const STORAGE_KEY = "teacher-utterance-records:v1";

const categories = [
  {
    id: "self_deepen",
    axis: "自己の高まり",
    name: "深める問い・言葉がけ",
    shortName: "自己 × 深める",
    example: "その動きは何が高まっているのだろう？",
    color: "#2364a5",
    bg: "#eef6ff",
  },
  {
    id: "self_expand",
    axis: "自己の高まり",
    name: "広げる問い・言葉がけ",
    shortName: "自己 × 広げる",
    example: "基になる動きは何だったかな？",
    color: "#66751f",
    bg: "#f5f8df",
  },
  {
    id: "self_simple",
    axis: "自己の高まり",
    name: "簡単な問い・言葉がけ",
    shortName: "自己 × 簡単",
    example: "次は何をしようかな？",
    color: "#a6532b",
    bg: "#fff1e9",
  },
  {
    id: "peer_deepen",
    axis: "仲間との関わり",
    name: "深める問い・言葉がけ",
    shortName: "仲間 × 深める",
    example: "友達にアドバイスしてみよう",
    color: "#8a4a9b",
    bg: "#f8effb",
  },
  {
    id: "peer_expand",
    axis: "仲間との関わり",
    name: "広げる問い・言葉がけ",
    shortName: "仲間 × 広げる",
    example: "友達の工夫をまねしてみよう",
    color: "#0f7c7a",
    bg: "#e9f8f7",
  },
  {
    id: "peer_simple",
    axis: "仲間との関わり",
    name: "簡単な問い・言葉がけ",
    shortName: "仲間 × 簡単",
    example: "友達は何をしているのか見てみよう",
    color: "#b13f63",
    bg: "#fff0f5",
  },
];

const categoryById = new Map(categories.map((category) => [category.id, category]));

const rules = {
  axes: {
    self: [
      ["高まって", 3],
      ["高まり", 3],
      ["できた", 2],
      ["できる", 1],
      ["安定して", 2],
      ["次は", 2],
      ["どうしてできた", 4],
      ["自分", 2],
      ["動き", 1],
    ],
    peer: [
      ["友達", 4],
      ["仲間", 4],
      ["見せて", 3],
      ["見てみよう", 2],
      ["アドバイス", 4],
      ["工夫をまね", 4],
      ["まねして", 3],
      ["関わり", 2],
      ["一緒", 2],
    ],
  },
  intents: {
    deepen: [
      ["なぜ", 3],
      ["どうして", 3],
      ["何が高まって", 4],
      ["何が", 2],
      ["だろう", 2],
      ["考えて", 1],
      ["理由", 2],
    ],
    expand: [
      ["基になる動き", 4],
      ["基になる", 3],
      ["姿勢", 3],
      ["人数", 3],
      ["速さ", 3],
      ["回数", 3],
      ["工夫", 2],
      ["広げ", 2],
      ["まね", 2],
    ],
    simple: [
      ["次は何", 4],
      ["何をしている", 4],
      ["安定してできるかな", 4],
      ["できるかな", 3],
      ["見てみよう", 2],
      ["しようかな", 3],
      ["次は", 2],
    ],
  },
};

let records = loadRecords();
let selectedCategoryId = null;
let lastClassification = null;
let editingRecordId = null;

const utteranceInput = document.querySelector("#utterance");
const inputError = document.querySelector("#input-error");
const classifyButton = document.querySelector("#classify-button");
const clearInputButton = document.querySelector("#clear-input-button");
const resultPanel = document.querySelector("#result-panel");
const resultTitle = document.querySelector("#result-title");
const resultReason = document.querySelector("#result-reason");
const confidenceBadge = document.querySelector("#confidence-badge");
const categoryGrid = document.querySelector("#category-grid");
const saveButton = document.querySelector("#save-button");
const summaryGrid = document.querySelector("#summary-grid");
const recordsList = document.querySelector("#records-list");
const recordCount = document.querySelector("#record-count");
const clearRecordsButton = document.querySelector("#clear-records-button");
const recordTemplate = document.querySelector("#record-template");

function loadRecords() {
  try {
    const rawRecords = localStorage.getItem(STORAGE_KEY);
    if (!rawRecords) return [];
    const parsed = JSON.parse(rawRecords);
    return Array.isArray(parsed) ? parsed.filter(isValidRecord) : [];
  } catch {
    return [];
  }
}

function isValidRecord(record) {
  return (
    record &&
    typeof record.id === "string" &&
    typeof record.text === "string" &&
    categoryById.has(record.category) &&
    typeof record.createdAt === "string"
  );
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function normalizeText(text) {
  return text.replace(/\s+/g, "").toLowerCase();
}

function scorePatterns(text, patternList) {
  const matched = [];
  const total = patternList.reduce((score, [pattern, points]) => {
    if (text.includes(pattern.toLowerCase())) {
      matched.push(pattern);
      return score + points;
    }
    return score;
  }, 0);
  return { total, matched };
}

function getBestScore(scores) {
  return Object.entries(scores).sort((a, b) => b[1].total - a[1].total);
}

function classifyUtterance(text) {
  const normalized = normalizeText(text);
  const axisScores = {
    self: scorePatterns(normalized, rules.axes.self),
    peer: scorePatterns(normalized, rules.axes.peer),
  };
  const intentScores = {
    deepen: scorePatterns(normalized, rules.intents.deepen),
    expand: scorePatterns(normalized, rules.intents.expand),
    simple: scorePatterns(normalized, rules.intents.simple),
  };

  const sortedAxes = getBestScore(axisScores);
  const sortedIntents = getBestScore(intentScores);
  let axis = sortedAxes[0][0];
  let intent = sortedIntents[0][0];

  if (sortedAxes[0][1].total === 0 && sortedIntents[0][1].total === 0) {
    return {
      category: null,
      confidence: "low",
      reason: "判定に迷っています。分類を選んで保存してください。",
    };
  }

  if (axisScores.self.total === axisScores.peer.total) {
    axis = intent === "simple" ? "self" : "peer";
  }

  if (
    intentScores.deepen.total === intentScores.expand.total &&
    intentScores.expand.total === intentScores.simple.total
  ) {
    intent = axis === "peer" ? "deepen" : "simple";
  }

  const categoryId = `${axis}_${intent}`;
  const topAxisScore = sortedAxes[0][1].total;
  const secondAxisScore = sortedAxes[1][1].total;
  const topIntentScore = sortedIntents[0][1].total;
  const secondIntentScore = sortedIntents[1][1].total;
  const isTie = topAxisScore === secondAxisScore || topIntentScore === secondIntentScore;
  const totalScore = topAxisScore + topIntentScore;
  const confidence = isTie || totalScore < 4 ? "low" : totalScore >= 8 ? "high" : "medium";
  const matchedWords = [
    ...axisScores[axis].matched.slice(0, 2),
    ...intentScores[intent].matched.slice(0, 2),
  ];

  return {
    category: categoryId,
    confidence,
    reason: buildReason(categoryId, matchedWords, confidence),
  };
}

function buildReason(categoryId, matchedWords, confidence) {
  const category = categoryById.get(categoryId);
  if (confidence === "low") {
    return "判定に迷っています。候補を確認し、必要なら分類を選び直してください。";
  }
  if (matchedWords.length === 0) {
    return `${category.shortName}に近い表現として判定しました。`;
  }
  const quotedWords = matchedWords.map((word) => `「${word}」`).join("、");
  return `${quotedWords}が含まれるため、${category.shortName}の言葉がけと判定しました。`;
}

function setSelectedCategory(categoryId) {
  selectedCategoryId = categoryId;
  document.querySelectorAll(".category-button").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.categoryId === categoryId);
    button.setAttribute("aria-pressed", String(button.dataset.categoryId === categoryId));
  });
  saveButton.disabled = !selectedCategoryId || utteranceInput.value.trim().length === 0;
}

function showClassification(classification) {
  lastClassification = classification;
  resultPanel.classList.remove("is-hidden");
  confidenceBadge.textContent = getConfidenceLabel(classification.confidence);
  confidenceBadge.dataset.confidence = classification.confidence;

  if (!classification.category) {
    resultTitle.textContent = "判定に迷っています";
    resultReason.textContent = classification.reason;
    setSelectedCategory(null);
    return;
  }

  const category = categoryById.get(classification.category);
  resultTitle.textContent = `${category.axis} × ${category.name}`;
  resultReason.textContent = classification.reason;
  setSelectedCategory(classification.category);
}

function getConfidenceLabel(confidence) {
  if (confidence === "high") return "信頼度 高";
  if (confidence === "medium") return "信頼度 中";
  return "信頼度 低";
}

function validateInput(requireCategory = false) {
  const text = utteranceInput.value.trim();
  if (!text) {
    inputError.textContent = "発話を入力してください。";
    saveButton.disabled = true;
    return null;
  }
  if (requireCategory && !selectedCategoryId) {
    inputError.textContent = "分類を選んでください。";
    return null;
  }
  inputError.textContent = "";
  return text;
}

function renderCategories() {
  categoryGrid.innerHTML = "";
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-button";
    button.dataset.categoryId = category.id;
    button.style.setProperty("--category-color", category.color);
    button.style.setProperty("--category-bg", category.bg);
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `
      <span class="category-axis">${category.axis}</span>
      <span class="category-name">${category.name}</span>
      <span class="category-example">${category.example}</span>
    `;
    button.addEventListener("click", () => {
      setSelectedCategory(category.id);
      if (!lastClassification) {
        resultPanel.classList.remove("is-hidden");
        resultTitle.textContent = `${category.axis} × ${category.name}`;
        resultReason.textContent = "手動で分類を選択しました。";
        confidenceBadge.textContent = "手動選択";
      }
    });
    categoryGrid.append(button);
  });
}

function renderSummary() {
  summaryGrid.innerHTML = "";
  categories.forEach((category) => {
    const total = records.filter((record) => record.category === category.id).length;
    const card = document.createElement("article");
    card.className = "summary-card";
    card.style.setProperty("--category-color", category.color);
    card.style.setProperty("--category-bg", category.bg);
    card.innerHTML = `
      <span class="summary-axis">${category.axis}</span>
      <span class="summary-name">${category.name}</span>
      <span class="summary-total">${total}</span>
    `;
    summaryGrid.append(card);
  });
  recordCount.textContent = `${records.length}件`;
}

function renderRecords() {
  recordsList.innerHTML = "";
  if (records.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "まだ記録はありません。発話を入力して自動分類してみましょう。";
    recordsList.append(empty);
    return;
  }

  records
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((record) => {
      const category = categoryById.get(record.category);
      const node = recordTemplate.content.firstElementChild.cloneNode(true);
      node.style.setProperty("--category-color", category.color);
      node.style.setProperty("--category-bg", category.bg);
      node.querySelector(".record-category").textContent = category.shortName;
      node.querySelector(".record-text").textContent = record.text;
      node.querySelector(".record-time").textContent = formatDate(record.createdAt);
      node.querySelector(".record-time").dateTime = record.createdAt;
      node.querySelector(".edit-record").addEventListener("click", () => editRecord(record.id));
      node.querySelector(".delete-record").addEventListener("click", () => deleteRecord(record.id));
      recordsList.append(node);
    });
}

function renderAll() {
  renderSummary();
  renderRecords();
  setSelectedCategory(selectedCategoryId);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function resetForm() {
  utteranceInput.value = "";
  inputError.textContent = "";
  selectedCategoryId = null;
  lastClassification = null;
  editingRecordId = null;
  resultPanel.classList.add("is-hidden");
  saveButton.textContent = "確認して保存";
  saveButton.disabled = true;
  setSelectedCategory(null);
}

function editRecord(recordId) {
  const record = records.find((item) => item.id === recordId);
  if (!record) return;
  editingRecordId = record.id;
  utteranceInput.value = record.text;
  resultPanel.classList.remove("is-hidden");
  const category = categoryById.get(record.category);
  resultTitle.textContent = `${category.axis} × ${category.name}`;
  resultReason.textContent = "保存済みの記録を編集しています。";
  confidenceBadge.textContent = getConfidenceLabel(record.confidence || "medium");
  saveButton.textContent = "編集を保存";
  setSelectedCategory(record.category);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteRecord(recordId) {
  const record = records.find((item) => item.id === recordId);
  if (!record) return;
  const confirmed = window.confirm("この記録を削除しますか？");
  if (!confirmed) return;
  records = records.filter((item) => item.id !== recordId);
  saveRecords();
  renderAll();
}

classifyButton.addEventListener("click", () => {
  const text = validateInput(false);
  if (!text) return;
  showClassification(classifyUtterance(text));
});

clearInputButton.addEventListener("click", resetForm);

utteranceInput.addEventListener("input", () => {
  if (utteranceInput.value.trim()) {
    inputError.textContent = "";
  }
  saveButton.disabled = !selectedCategoryId || utteranceInput.value.trim().length === 0;
});

saveButton.addEventListener("click", () => {
  const text = validateInput(true);
  if (!text) return;
  const now = new Date().toISOString();
  const confidence = lastClassification?.confidence || "medium";

  if (editingRecordId) {
    records = records.map((record) =>
      record.id === editingRecordId
        ? { ...record, text, category: selectedCategoryId, confidence, classifier: "rule" }
        : record,
    );
  } else {
    records = [
      ...records,
      {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        text,
        category: selectedCategoryId,
        createdAt: now,
        classifier: "rule",
        confidence,
      },
    ];
  }

  saveRecords();
  resetForm();
  renderAll();
});

clearRecordsButton.addEventListener("click", () => {
  if (records.length === 0) return;
  const confirmed = window.confirm("すべての記録を削除しますか？");
  if (!confirmed) return;
  records = [];
  saveRecords();
  resetForm();
  renderAll();
});

renderCategories();
renderAll();
