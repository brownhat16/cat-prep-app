// ==========================================================
// CAT Master AI - Core Web Application Engine (SPA)
// ==========================================================

const CONFIG = window.APP_CONFIG || {
  backendBaseUrl: "https://cat-backend-bdyo.onrender.com",
};
const BACKEND_BASE_URL = String(CONFIG.backendBaseUrl || "").replace(/\/+$/, "");

// ----------------------------------------------------------
// 1. Initial State Seed & LocalStorage Management
// ----------------------------------------------------------
const DEFAULT_STATE = {
  streak: 5,
  focusTopic: "Algebra Mastery & Linear Sets",
  focusDesc: "Your accuracy in algebra is at 75%. Try resolving 3 more linear sets to unlock the next level.",
  arenaCorrect: 12,
  arenaTotal: 16,
  arenaSpeed: 42,
  flashcardsReviewed: 34,
  mocksTaken: 2,
  accuracies: {
    VARC: 80,
    DILR: 70,
    Quants: 75,
  },
  recentActivity: [
    { id: "act-1", type: "arena", title: "Algebra Arena Challenge", metric: "CORRECT", duration: "32s", date: "Today" },
    { id: "act-2", type: "flashcards", title: "Probability Concept Deck", metric: "6 CARDS", duration: "1m 12s", date: "Yesterday" },
    { id: "act-3", type: "mocks", title: "Sectional Quant Mock 1", metric: "83.3% ACCURACY", duration: "24m 15s", date: "3 days ago" },
    { id: "act-4", type: "arena", title: "VARC Analytical Inferences", metric: "INCORRECT", duration: "54s", date: "4 days ago" },
  ]
};

let state = {};

function loadState() {
  try {
    const raw = localStorage.getItem("cat:app:state:v1");
    state = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_STATE));
  } catch (err) {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function saveState() {
  try {
    localStorage.setItem("cat:app:state:v1", JSON.stringify(state));
  } catch (err) {
    console.error("Failed to write to localStorage:", err);
  }
  updateUI();
}

// ----------------------------------------------------------
// 2. Puter AI Google Auth & Setup
// ----------------------------------------------------------
let puterUser = null;

async function checkPuterStatus() {
  const pill = document.getElementById("puter-pill");
  const label = document.getElementById("puter-status-label");
  const connectionPanel = document.getElementById("puter-connection-panel");

  if (puter.auth.isSignedIn()) {
    try {
      puterUser = await puter.auth.getUser();
      pill.classList.add("connected");
      label.textContent = "Puter Connected";
      
      if (connectionPanel) {
        connectionPanel.innerHTML = `
          <div class="puter-connected-info">
            <span style="font-weight:700;color:var(--green);">🟢 Puter AI Connected</span>
            <button class="btn btn-outline" onclick="handlePuterLogout()" style="padding: 6px 12px; font-size:12px;">Disconnect</button>
          </div>
        `;
      }
    } catch (err) {
      console.error("Failed to fetch Puter user:", err);
    }
  } else {
    puterUser = null;
    pill.classList.remove("connected");
    label.textContent = "Puter Disconnected";
    
    if (connectionPanel) {
      connectionPanel.innerHTML = `
        <button class="btn btn-secondary w-full" onclick="handlePuterLogin()">
          <span>Connect Puter AI Account</span>
        </button>
      `;
    }
  }
}

function handlePuterLogin() {
  puter.auth.signIn().then(() => {
    checkPuterStatus();
  }).catch(err => {
    console.error("Puter sign in error:", err);
  });
}

function handlePuterLogout() {
  puter.auth.signOut();
  puterUser = null;
  checkPuterStatus();
}

// ----------------------------------------------------------
// 3. Tab Switching Layout Controller
// ----------------------------------------------------------
function switchTab(tabId) {
  // Update sidebar buttons
  document.querySelectorAll(".nav-item").forEach(item => {
    if (item.getAttribute("data-tab") === tabId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Update tab panel visibility
  document.querySelectorAll(".tab-content").forEach(panel => {
    if (panel.id === `tab-${tabId}`) {
      panel.classList.add("active");
    } else {
      panel.classList.remove("active");
    }
  });

  // Update header text
  const titleMap = {
    dashboard: "Dashboard",
    arena: "Quick Solve Arena",
    flashcards: "Smart Study Flashcards",
    mocks: "CAT Mock Simulator",
    analytics: "Performance Analytics",
  };
  document.getElementById("page-title").textContent = titleMap[tabId] || "Dashboard";

  // Trigger focus initializers
  if (tabId === "arena" && !arenaActiveQuestion) {
    loadNextArenaQuestion();
  }
  if (tabId === "flashcards" && flashcards.length === 0) {
    loadFlashcardDeck("Algebra");
  }
}

// ----------------------------------------------------------
// 4. UI Synchronization View Handler
// ----------------------------------------------------------
function updateUI() {
  // Sync streak
  document.getElementById("sidebar-streak").textContent = String(state.streak);
  
  // Sync dashboard details
  document.getElementById("dashboard-focus-title").textContent = state.focusTopic;
  document.getElementById("dashboard-focus-desc").textContent = state.focusDesc;
  
  // Dashboard stats
  document.getElementById("stat-mocks-taken").textContent = String(state.mocksTaken);
  document.getElementById("stat-arena-attempts").textContent = String(state.arenaTotal);
  document.getElementById("stat-flashcards-reviewed").textContent = String(state.flashcardsReviewed);
  
  const total = state.arenaTotal || 1;
  const accuracy = Math.round((state.arenaCorrect / total) * 100);
  document.getElementById("stat-global-accuracy").textContent = `${accuracy}%`;

  // Render recent activity
  const activityList = document.getElementById("dashboard-activity-list");
  if (activityList) {
    if (!state.recentActivity.length) {
      activityList.innerHTML = '<div class="empty-state">No practice sessions completed yet.</div>';
    } else {
      activityList.innerHTML = state.recentActivity.map(act => {
        let typeEmoji = "⚔️";
        let typeLabel = "ARENA SOLVE";
        let metricClass = "success";
        
        if (act.type === "flashcards") {
          typeEmoji = "📚";
          typeLabel = "CONCEPT DECK";
          metricClass = "success";
        } else if (act.type === "mocks") {
          typeEmoji = "📝";
          typeLabel = "SECTIONAL MOCK";
          metricClass = act.metric.includes("F") ? "warn" : "success";
        }
        
        if (act.metric === "INCORRECT") {
          metricClass = "warn";
        }

        return `
          <div class="activity-tile">
            <div class="act-info">
              <span class="act-type">${typeEmoji} ${typeLabel}</span>
              <span class="act-title">${act.title}</span>
            </div>
            <div class="act-meta">
              <span class="act-metric ${metricClass}">${act.metric}</span>
              <span class="act-duration">⏱️ ${act.duration}</span>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  // Analytics tab metrics
  const accuracyCircle = document.getElementById("analytics-accuracy-circle");
  const accuracyVal = document.getElementById("analytics-accuracy-value");
  if (accuracyCircle && accuracyVal) {
    accuracyVal.textContent = `${accuracy}%`;
    const offset = 263.89 - (263.89 * accuracy) / 100;
    accuracyCircle.style.strokeDashoffset = String(offset);
  }

  const subLabel = document.getElementById("analytics-accuracy-subtitle");
  if (subLabel) {
    if (accuracy >= 80) subLabel.textContent = "Superb! Highly calibrated for 99+ percentile";
    else if (accuracy >= 65) subLabel.textContent = "Strong calibration. Polish target topics";
    else subLabel.textContent = "Study active recommendations to boost accuracy";
  }

  // Analytics Mastery Bar Chart
  const vBar = document.getElementById("bar-varc");
  const dBar = document.getElementById("bar-dilr");
  const qBar = document.getElementById("bar-quant");
  if (vBar && dBar && qBar) {
    vBar.style.width = `${state.accuracies.VARC}%`;
    dBar.style.width = `${state.accuracies.DILR}%`;
    qBar.style.width = `${state.accuracies.Quants}%`;

    document.getElementById("val-varc").textContent = `${state.accuracies.VARC}%`;
    document.getElementById("val-dilr").textContent = `${state.accuracies.DILR}%`;
    document.getElementById("val-quant").textContent = `${state.accuracies.Quants}%`;
  }

  // Analytics History list
  const historyList = document.getElementById("analytics-history-list");
  if (historyList) {
    if (!state.recentActivity.length) {
      historyList.innerHTML = '<div class="empty-state">No historical entries available yet.</div>';
    } else {
      historyList.innerHTML = state.recentActivity.map(act => {
        let isCorrect = act.metric === "CORRECT" || act.metric.includes("%") || act.type === "flashcards";
        return `
          <div class="history-item">
            <div class="hist-left">
              <span class="hist-title">${act.title}</span>
              <span class="hist-date">${act.date} · Speed: ${act.duration}</span>
            </div>
            <span class="hist-right ${isCorrect ? 'success' : 'warn'}">${act.metric}</span>
          </div>
        `;
      }).join("");
    }
  }
}

// Add logs helper
function logActivity(type, title, metric, duration) {
  const item = {
    id: `act-${Date.now()}`,
    type,
    title,
    metric,
    duration,
    date: "Just now"
  };
  state.recentActivity.unshift(item);
  if (state.recentActivity.length > 8) {
    state.recentActivity.pop();
  }
}

// ----------------------------------------------------------
// 5. Arena Section Controller
// ----------------------------------------------------------
const LOCAL_ARENA_QUESTIONS = [
  {
    text: "Five people (A, B, C, D, E) stand in a line. B is not at either end. C is immediately between A and E. D is immediately between B and C. If A is at the first position, what is the order?",
    hint: "If A is 1st, C must be 2nd, and E must be 3rd to keep C between A and E. That places D 4th and B 5th.",
    options: ["A, C, E, D, B", "A, E, C, B, D", "A, C, D, B, E", "A, B, C, D, E"],
    answer: "A, C, E, D, B"
  },
  {
    text: "Six analysts sit around a circular table. Maya sits opposite Kabir. Nia sits immediately to the left of Maya. Rohan is not adjacent to Kabir. Which arrangement is possible?",
    hint: "Position Maya and Kabir opposite to each other. Nia sits to Maya's left. Confirm where Rohan can sit without touching Kabir.",
    options: ["Maya, Nia, Rohan, Kabir, Tara, Om", "Maya, Tara, Nia, Kabir, Om, Rohan", "Maya, Nia, Tara, Kabir, Rohan, Om", "Maya, Om, Nia, Kabir, Tara, Rohan"],
    answer: "Maya, Nia, Tara, Kabir, Rohan, Om"
  },
  {
    text: "A shopkeeper mixes two varieties of rice costing Rs. 40/kg and Rs. 55/kg in the ratio 3:2. At what price per kg should the mixture be sold to earn a profit of 20%?",
    hint: "Find the cost price per kg of the mixture first: [(3*40 + 2*55) / 5] = 46. Then apply 20% profit: 46 * 1.20 = 55.2.",
    options: ["Rs. 54.80", "Rs. 55.20", "Rs. 56.40", "Rs. 58.00"],
    answer: "Rs. 55.20"
  },
  {
    text: "The average of 8 numbers is 24. If one number is excluded, the average becomes 22. What is the excluded number?",
    hint: "Total of 8 numbers is 8 * 24 = 192. Total of 7 numbers is 7 * 22 = 154. The excluded number is the difference: 192 - 154 = 38.",
    options: ["30", "34", "38", "42"],
    answer: "38"
  }
];

let arenaActiveQuestion = null;
let arenaTimerInterval = null;
let arenaElapsedSeconds = 0;
let arenaSelectedOption = null;
let arenaSubmitted = false;
let arenaLocalIndex = 0;

function formatSeconds(total) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function loadNextArenaQuestion() {
  const textEl = document.getElementById("arena-question-text");
  const optionsContainer = document.getElementById("arena-options-container");
  const sourceLabel = document.getElementById("arena-source-label");
  const hintText = document.getElementById("arena-hint-text");
  const btnSubmit = document.getElementById("btn-submit-answer");
  const btnClear = document.getElementById("btn-clear-selection");
  const btnNext = document.getElementById("btn-next-arena");

  // Prevent duplicate concurrent requests by disabling next button
  if (btnNext) btnNext.disabled = true;

  // Reset states
  clearInterval(arenaTimerInterval);
  arenaElapsedSeconds = 0;
  document.getElementById("arena-timer").textContent = "00:00";
  arenaSelectedOption = null;
  arenaSubmitted = false;
  
  btnSubmit.disabled = true;
  btnClear.disabled = true;
  document.getElementById("arena-hint-drawer").classList.remove("open");

  // UI status
  textEl.innerHTML = `
    <div style="text-align:center;padding:40px;">
      <span class="loading-spinner"></span>
      <p style="margin-top:12px;color:var(--text-muted);font-size:14px;">Generating next AI challenge...</p>
    </div>
  `;
  optionsContainer.innerHTML = "";

  let question = null;
  let source = "Gemini AI";

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/generate-clone/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "Algebra", difficulty: "Medium" })
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.clone && data.clone.question_text) {
        question = {
          text: data.clone.question_text,
          options: data.clone.options,
          hint: data.clone.concept_hint,
          answer: data.clone.answer
        };
        source = "Gemini AI";
      }
    }
  } catch (err) {
    console.warn("Backend generate-clone failed. Attempting Puter AI or Local fallback...", err);
  }

  // Puter AI Fallback
  if (!question && puter.auth.isSignedIn()) {
    try {
      source = "Puter AI";
      const systemPrompt = `You are a high-caliber CAT exam coach. Generate a challenging Algebra Multiple-Choice Question (Medium difficulty) suitable for CAT preparation. Returns JSON ONLY in this format:
      {"question_text": "...", "options": ["Option A", "Option B", "Option C", "Option D"], "concept_hint": "...", "answer": "Exactly match one option text"}`;
      
      const response = await puter.ai.chat(systemPrompt + "\nGenerate now.");
      const cleanJson = response.toString().replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      
      if (parsed.question_text && parsed.options.length === 4) {
        question = {
          text: parsed.question_text,
          options: parsed.options,
          hint: parsed.concept_hint,
          answer: parsed.answer
        };
      }
    } catch (err) {
      console.warn("Puter AI generation failed. Falling back to local decks...", err);
    }
  }

  // Final Local Fallback
  if (!question) {
    question = LOCAL_ARENA_QUESTIONS[arenaLocalIndex % LOCAL_ARENA_QUESTIONS.length];
    arenaLocalIndex++;
    source = "Local Study Deck";
  }

  arenaActiveQuestion = question;
  sourceLabel.textContent = source;

  // Display details
  textEl.textContent = question.text;
  hintText.textContent = question.hint;

  optionsContainer.innerHTML = question.options.map((opt, index) => {
    const letters = ["A", "B", "C", "D"];
    return `
      <button class="option-btn" onclick="selectArenaOption(${index})">
        <span class="option-badge">${letters[index]}</span>
        <span class="option-text">${esc(opt)}</span>
      </button>
    `;
  }).join("");

  // Re-enable next button
  if (btnNext) btnNext.disabled = false;

  // Start timer fresh, ensuring any previous interval is cleared again in case of async overlap
  clearInterval(arenaTimerInterval);
  arenaTimerInterval = setInterval(() => {
    arenaElapsedSeconds++;
    document.getElementById("arena-timer").textContent = formatSeconds(arenaElapsedSeconds);
  }, 1000);
}

function selectArenaOption(index) {
  if (arenaSubmitted) return;
  arenaSelectedOption = index;
  
  document.querySelectorAll("#arena-options-container .option-btn").forEach((btn, idx) => {
    if (idx === index) {
      btn.classList.add("selected");
    } else {
      btn.classList.remove("selected");
    }
  });

  document.getElementById("btn-submit-answer").disabled = false;
  document.getElementById("btn-clear-selection").disabled = false;
}

function clearArenaSelection() {
  if (arenaSubmitted) return;
  arenaSelectedOption = null;
  document.querySelectorAll("#arena-options-container .option-btn").forEach(btn => {
    btn.classList.remove("selected");
  });
  document.getElementById("btn-submit-answer").disabled = true;
  document.getElementById("btn-clear-selection").disabled = true;
}

function submitArenaAnswer() {
  if (arenaSelectedOption === null || arenaSubmitted) return;
  
  clearInterval(arenaTimerInterval);
  arenaSubmitted = true;
  
  const selectedText = arenaActiveQuestion.options[arenaSelectedOption];
  const isCorrect = selectedText === arenaActiveQuestion.answer;

  // Mark styles
  document.querySelectorAll("#arena-options-container .option-btn").forEach((btn, idx) => {
    btn.classList.add("submitted");
    const optText = arenaActiveQuestion.options[idx];
    if (optText === arenaActiveQuestion.answer) {
      btn.classList.add("correct");
    } else if (idx === arenaSelectedOption) {
      btn.classList.add("wrong");
    }
  });

  document.getElementById("btn-submit-answer").disabled = true;
  document.getElementById("btn-clear-selection").disabled = true;

  // Save states
  state.arenaTotal++;
  if (isCorrect) {
    state.arenaCorrect++;
    state.streak++;
    // Boost math accuracy
    state.accuracies.Quants = Math.min(100, state.accuracies.Quants + 2);
  } else {
    state.accuracies.Quants = Math.max(0, state.accuracies.Quants - 1);
  }

  // Update speed average
  state.arenaSpeed = Math.round((state.arenaSpeed * 4 + arenaElapsedSeconds) / 5);

  // Log activity
  logActivity(
    "arena",
    arenaActiveQuestion.text.slice(0, 32) + "...",
    isCorrect ? "CORRECT" : "INCORRECT",
    `${arenaElapsedSeconds}s`
  );

  saveState();

  // Sync solver panels
  document.getElementById("arena-score").textContent = `${state.arenaCorrect} / ${state.arenaTotal}`;
  document.getElementById("arena-avg-speed").textContent = `${state.arenaSpeed}s`;
}

// ----------------------------------------------------------
// 6. Flashcards Study Section Controller
// ----------------------------------------------------------
const LOCAL_FLASHCARDS = {
  Algebra: [
    { 
      front: "Algebra: Quadratic Roots & Coefficients", 
      back: "For ax² + bx + c = 0, sum of roots is -b/a, and product is c/a.", 
      explanation: "Useful in simplifying linear and circular root sets.",
      practice_question: {
        question_text: "If the roots of the equation x² - px + q = 0 are consecutive integers, then what is p² - 4q?",
        options: ["A) 1", "B) 2", "C) 3", "D) 4"],
        answer: "A) 1",
        solution: "Let roots be n and n+1. Sum = n + n + 1 = 2n + 1 = p. Product = n(n+1) = q. Therefore, p² - 4q = (2n + 1)² - 4n(n+1) = 4n² + 4n + 1 - 4n² - 4n = 1. The correct option is A."
      }
    },
    { 
      front: "Algebra: Difference of Squares & Sums", 
      back: "(a - b)(a + b) = a² - b², and (a + b + c)² = a² + b² + c² + 2(ab + bc + ca).", 
      explanation: "Used to simplify quadratic equations and find constraints in variable systems.",
      practice_question: {
        question_text: "If a + b + c = 6 and ab + bc + ca = 11, what is the value of a² + b² + c²?",
        options: ["A) 14", "B) 16", "C) 18", "D) 20"],
        answer: "A) 14",
        solution: "Using the identity: (a+b+c)² = a² + b² + c² + 2(ab+bc+ca) => 6² = a² + b² + c² + 2(11) => 36 = a² + b² + c² + 22 => a² + b² + c² = 14. Correct option is A."
      }
    },
  ],
  Geometry: [
    { 
      front: "Geometry: Apollonius' Theorem", 
      back: "AB² + AC² = 2 * (AD² + BD²) where AD is the median to side BC.", 
      explanation: "Use it to solve right angle setups instantly without equations.",
      practice_question: {
        question_text: "In a triangle ABC, AB = 6, AC = 8, and BC = 10. Find the length of the median AD to the side BC.",
        options: ["A) 4", "B) 5", "C) 6", "D) 7"],
        answer: "B) 5",
        solution: "Since 6² + 8² = 10², triangle ABC is right-angled at A. In any right-angled triangle, the length of the median to the hypotenuse is exactly half the length of the hypotenuse. Thus, AD = BC / 2 = 10 / 2 = 5. Correct option is B."
      }
    },
  ],
  Probability: [
    { 
      front: "Probability: Complementary Counting", 
      back: "P(At least one) = 1 - P(None)", 
      explanation: "Standard formula for conditional and complementary probability.",
      practice_question: {
        question_text: "A coin is tossed 5 times. What is the probability of getting at least one head?",
        options: ["A) 1/32", "B) 31/32", "C) 15/16", "D) 7/8"],
        answer: "B) 31/32",
        solution: "P(At least one head) = 1 - P(No heads). The only way to get no heads is to get all tails (T-T-T-T-T), which has a probability of (1/2)⁵ = 1/32. Thus, 1 - 1/32 = 31/32. Correct option is B."
      }
    }
  ]
};

let flashcards = [];
let currentCardIndex = 0;

async function loadFlashcardDeck(topic) {
  // Render active tab state
  const topicsContainer = document.getElementById("flashcard-topics");
  const topicsList = ['Algebra', 'Probability', 'Geometry', 'Number Systems', 'Permutations', 'Time & Work'];
  
  topicsContainer.innerHTML = topicsList.map(t => `
    <button class="topic-tab ${t === topic ? 'active' : ''}" onclick="loadFlashcardDeck('${t}')">${t}</button>
  `).join("");

  // UI state spinner
  const frontEl = document.getElementById("card-front");
  const backEl = document.getElementById("card-back");
  const explainEl = document.getElementById("card-explanation");
  const topicTag = document.getElementById("card-topic");
  
  topicTag.textContent = topic;
  frontEl.innerHTML = `<span class="loading-spinner"></span><p style="font-size:14px;color:var(--text-muted);margin-left:10px;">Generating deck...</p>`;
  backEl.textContent = "...";
  explainEl.textContent = "...";

  let deck = [];

  // Attempt backend deck gen
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/generate-flashcards/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, count: 5 })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.flashcards && data.flashcards.length > 0) {
        deck = data.flashcards;
      }
    }
  } catch (err) {
    console.warn("Backend flashcard generation failed. Trying Puter AI or Local fallback...", err);
  }

  // Puter AI Fallback
  if (deck.length === 0 && puter.auth.isSignedIn()) {
    try {
      const systemPrompt = `You are a high-caliber CAT trainer. Build a list of 5 high-speed memory flashcards for the topic: ${topic}. Each card should have a short 'front' prompt, a concise conceptual 'back' formula/strategy, a short 'explanation', and a 'practice_question' object containing:
      - 'question_text': a challenging, high-level CAT exam style multiple choice question testing this concept
      - 'options': an array of 4 choices
      - 'answer': correct option matching one in options exactly
      - 'solution': step-by-step breakdown using the formula.
      Returns JSON ONLY in this format:
      {"flashcards": [{"front": "...", "back": "...", "explanation": "...", "practice_question": {"question_text": "...", "options": ["...", "...", "...", "..."], "answer": "...", "solution": "..."}}]}
      `;
      
      const response = await puter.ai.chat(systemPrompt + "\nGenerate now.");
      const cleanJson = response.toString().replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.flashcards && parsed.flashcards.length > 0) {
        deck = parsed.flashcards;
      }
    } catch (err) {
      console.warn("Puter AI flashcard deck gen failed. Falling back...", err);
    }
  }

  // Local Deck Fallback
  if (deck.length === 0) {
    deck = LOCAL_FLASHCARDS[topic] || [
      { front: `${topic}: Core Principle`, back: "Active recall strategy. Name the primary constraint of this topic.", explanation: "Review the basics of this module to solidify your memory." }
    ];
  }

  flashcards = deck;
  currentCardIndex = 0;
  showCard(0);
}

function showCard(idx) {
  if (flashcards.length === 0) return;
  
  const card = document.getElementById("flashcard-card");
  card.classList.remove("flipped");

  // Wait a fraction of flip transition to inject text
  setTimeout(() => {
    document.getElementById("card-front").textContent = flashcards[idx].front;
    document.getElementById("card-back").textContent = flashcards[idx].back;
    document.getElementById("card-explanation").textContent = flashcards[idx].explanation || "No advanced details.";
    
    // Reset Practice Question Box
    const practiceContainer = document.getElementById("card-practice-container");
    const practiceBox = document.getElementById("card-practice-box");
    const btnTogglePractice = document.getElementById("btn-toggle-practice");
    const btnPracticeSolution = document.getElementById("btn-practice-solution");
    const solutionBox = document.getElementById("practice-solution-box");
    const practiceFeedback = document.getElementById("practice-feedback");

    if (practiceContainer) {
      const q = flashcards[idx].practice_question;
      if (q && q.question_text) {
        practiceContainer.style.display = "block";
        practiceBox.style.display = "none";
        btnTogglePractice.textContent = "🎯 Solve High CAT Level Question";
        btnTogglePractice.style.borderColor = "rgba(88, 166, 255, 0.4)";
        btnTogglePractice.style.background = "rgba(88, 166, 255, 0.05)";
        btnTogglePractice.style.color = "#58a6ff";

        solutionBox.style.display = "none";
        btnPracticeSolution.textContent = "Show Step-by-Step Solution";
        practiceFeedback.style.display = "none";
        practiceFeedback.textContent = "";

        document.getElementById("practice-question-text").textContent = q.question_text;
        document.getElementById("practice-solution-text").textContent = q.solution || "No detailed solution steps provided.";

        // Render option buttons
        const optsContainer = document.getElementById("practice-options");
        optsContainer.innerHTML = (q.options || []).map((opt) => {
          return `<button class="practice-opt-btn" data-option="${esc(opt)}" style="width: 100%; text-align: left; padding: 10px 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-family: inherit; font-size: 12.5px; font-weight: 500; cursor: pointer; transition: all 0.2s; outline: none; margin-bottom: 2px;">${esc(opt)}</button>`;
        }).join("");

        // Add options click handlers
        const optButtons = optsContainer.querySelectorAll(".practice-opt-btn");
        optButtons.forEach(btn => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const selectedOpt = btn.getAttribute("data-option");
            const isCorrect = selectedOpt === q.answer;

            // Disable all option buttons
            optButtons.forEach(b => {
              b.disabled = true;
              b.style.cursor = "default";
              
              // Highlight correct answer green
              const bOpt = b.getAttribute("data-option");
              if (bOpt === q.answer) {
                b.style.background = "rgba(63, 185, 80, 0.15)";
                b.style.borderColor = "#3fb950";
                b.style.color = "#8ce99a";
              }
            });

            // If selected is incorrect, highlight it red
            if (!isCorrect) {
              btn.style.background = "rgba(248, 81, 73, 0.15)";
              btn.style.borderColor = "#f85149";
              btn.style.color = "#ffb4ab";

              practiceFeedback.style.display = "block";
              practiceFeedback.style.background = "rgba(248, 81, 73, 0.1)";
              practiceFeedback.style.color = "#ffb4ab";
              practiceFeedback.style.border = "1px solid rgba(248, 81, 73, 0.2)";
              practiceFeedback.textContent = "❌ Incorrect. Check the step-by-step solution below to see why!";
            } else {
              practiceFeedback.style.display = "block";
              practiceFeedback.style.background = "rgba(63, 185, 80, 0.1)";
              practiceFeedback.style.color = "#8ce99a";
              practiceFeedback.style.border = "1px solid rgba(63, 185, 80, 0.2)";
              practiceFeedback.textContent = "🎉 Correct! You mastered this concept application.";
            }

            // Reveal solution
            solutionBox.style.display = "block";
            btnPracticeSolution.textContent = "Hide Step-by-Step Solution";
          });
        });

      } else {
        practiceContainer.style.display = "none";
      }
    }

    // Progress
    document.getElementById("card-index-label").textContent = `Card ${idx + 1} of ${flashcards.length}`;
    const pct = ((idx + 1) / flashcards.length) * 100;
    document.getElementById("card-progress-bar").style.width = `${pct}%`;
  }, 150);

  // Disable/enable buttons
  document.getElementById("btn-prev-card").disabled = idx === 0;
  document.getElementById("btn-next-card").disabled = idx === flashcards.length - 1;
  
  // Rating panel is inactive until flipped
  document.getElementById("flashcard-rating-panel").classList.remove("active");
}

function flipFlashcard() {
  const card = document.getElementById("flashcard-card");
  card.classList.toggle("flipped");

  if (card.classList.contains("flipped")) {
    document.getElementById("flashcard-rating-panel").classList.add("active");
  } else {
    document.getElementById("flashcard-rating-panel").classList.remove("active");
  }
}

// ----------------------------------------------------------
// 7. Mock Exam Section Simulator Controller
// ----------------------------------------------------------
const MOCK_QUESTIONS = [
  {
    id: "m-1",
    section: "VARC",
    difficulty: "High",
    passage: "The advent of artificial intelligence in educational assessment paradigms presents both unprecedented opportunities and profound epistemological challenges. While algorithmic evaluation promises scalability and supposedly objective metrics, it fundamentally relies on historical datasets that are inherently imbued with human biases. Consequently, the notion of 'fairness' in AI-driven testing is not merely a technical hurdle but a deeply philosophical one. Furthermore, the opaque nature of complex neural networks means that the rationale behind specific evaluations often remains inaccessible to both educators and examinees.",
    prompt: "Based on the passage, the author's primary concern regarding the use of complex neural networks in assessment is that they:",
    options: [
      "perpetuate historical biases present in their training datasets.",
      "obscure the evaluative process, thereby hindering educational feedback.",
      "transform assessments entirely into technical hurdles rather than philosophical ones.",
      "fail to provide scalable metrics compared to traditional evaluation methods."
    ],
    answer: "obscure the evaluative process, thereby hindering educational feedback."
  },
  {
    id: "m-2",
    section: "DILR",
    difficulty: "Medium",
    prompt: "Five project teams P, Q, R, S, and T present on different days from Monday to Friday. Q is after P, T is before S, and R is not on Monday or Friday. If P is on Monday, which one of the following must be true?",
    options: [
      "Q is on Tuesday",
      "R is on Wednesday or Thursday",
      "T is on Tuesday",
      "S is on Friday"
    ],
    answer: "R is on Wednesday or Thursday"
  },
  {
    id: "m-3",
    section: "Quants",
    difficulty: "Medium",
    prompt: "A shopkeeper mixes two varieties of rice costing Rs. 40/kg and Rs. 55/kg in the ratio 3:2. At what price per kg should the mixture be sold to earn a profit of 20%?",
    options: [
      "Rs. 57.60",
      "Rs. 58.80",
      "Rs. 60.00",
      "Rs. 61.20"
    ],
    answer: "Rs. 58.80"
  },
  {
    id: "m-4",
    section: "VARC",
    difficulty: "Medium",
    prompt: "Choose the option that best captures the meaning of the sentence: \"The committee’s objections were not so much principled as procedural.\"",
    options: [
      "The committee opposed the proposal because it violated ethical values.",
      "The committee objected mainly to how the proposal was handled.",
      "The committee did not object to the proposal at all.",
      "The committee objected because the proposal lacked ambition."
    ],
    answer: "The committee objected mainly to how the proposal was handled."
  },
  {
    id: "m-5",
    section: "DILR",
    difficulty: "High",
    prompt: "Three statements are given: (1) Exactly one of A or B is true. (2) If C is true, B is false. (3) A and C cannot both be false. If B is false, which statement must be true?",
    options: [
      "A is false",
      "C is false",
      "A is true",
      "Both A and C are true"
    ],
    answer: "A is true"
  },
  {
    id: "m-6",
    section: "Quants",
    difficulty: "High",
    prompt: "The average of 8 numbers is 24. If one number is excluded, the average becomes 22. What is the excluded number?",
    options: [
      "30",
      "34",
      "38",
      "40"
    ],
    answer: "40"
  }
];

let mockActive = false;
let mockTimerInterval = null;
let mockTimeLeft = 40 * 60; // 40 minutes
let mockAnswers = {}; // questionId -> optionText
let mockReviewList = []; // list of marked index (1-based)
let mockVisitedList = {}; // questionId -> bool
let mockCurrentIndex = 0;

function startMockSimulation() {
  // Clear any existing active timer to prevent duplicate intervals running concurrently
  clearInterval(mockTimerInterval);

  mockActive = true;
  mockTimeLeft = 40 * 60;
  mockAnswers = {};
  mockReviewList = [];
  mockVisitedList = {};
  mockCurrentIndex = 0;

  // Mark first question visited
  mockVisitedList[MOCK_QUESTIONS[0].id] = true;

  document.getElementById("mock-intro-screen").style.display = "none";
  document.getElementById("mock-console-screen").style.display = "block";

  // Render first question
  showMockQuestion(0);

  // Start timer
  mockTimerInterval = setInterval(() => {
    mockTimeLeft--;
    if (mockTimeLeft <= 0) {
      clearInterval(mockTimerInterval);
      submitMockExam();
    }
    
    // Format minutes/seconds
    const m = Math.floor(mockTimeLeft / 60);
    const s = mockTimeLeft % 60;
    document.getElementById("mock-timer-display").textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, 1000);
}

function showMockQuestion(idx) {
  mockCurrentIndex = idx;
  const q = MOCK_QUESTIONS[idx];
  mockVisitedList[q.id] = true;

  // Header meta
  document.getElementById("mock-question-section").textContent = q.section;
  document.getElementById("mock-question-index").textContent = `Question ${idx + 1} of ${MOCK_QUESTIONS.length}`;
  document.getElementById("mock-question-diff").textContent = `${q.difficulty} Difficulty`;

  // Render Passage if available
  const passageBox = document.getElementById("mock-passage-box");
  if (q.passage) {
    passageBox.style.display = "block";
    document.getElementById("mock-passage-text").textContent = q.passage;
  } else {
    passageBox.style.display = "none";
  }

  // Render Prompt
  document.getElementById("mock-question-prompt").textContent = q.prompt;

  // Render Options
  const container = document.getElementById("mock-options-container");
  container.innerHTML = q.options.map((opt, oIdx) => {
    const letters = ["A", "B", "C", "D"];
    const isSelected = mockAnswers[q.id] === opt;
    return `
      <button class="option-btn ${isSelected ? 'selected' : ''}" onclick="selectMockOption('${q.id}', ${oIdx})">
        <span class="option-badge">${letters[oIdx]}</span>
        <span class="option-text">${esc(opt)}</span>
      </button>
    `;
  }).join("");

  // Review button text
  const reviewBtn = document.getElementById("btn-mock-review");
  if (mockReviewList.includes(idx + 1)) {
    reviewBtn.classList.add("btn-easy");
    reviewBtn.textContent = "🔖 Marked";
  } else {
    reviewBtn.classList.remove("btn-easy");
    reviewBtn.textContent = "🔖 Mark for Review";
  }

  renderMockPalette();
}

function selectMockOption(qId, oIdx) {
  const q = MOCK_QUESTIONS[mockCurrentIndex];
  mockAnswers[qId] = q.options[oIdx];
  
  // Re-draw options
  showMockQuestion(mockCurrentIndex);
}

function clearMockSelection() {
  const q = MOCK_QUESTIONS[mockCurrentIndex];
  delete mockAnswers[q.id];
  showMockQuestion(mockCurrentIndex);
}

function toggleMockReview() {
  const num = mockCurrentIndex + 1;
  if (mockReviewList.includes(num)) {
    mockReviewList = mockReviewList.filter(n => n !== num);
  } else {
    mockReviewList.push(num);
  }
  showMockQuestion(mockCurrentIndex);
}

function saveAndNextMock() {
  if (mockCurrentIndex < MOCK_QUESTIONS.length - 1) {
    showMockQuestion(mockCurrentIndex + 1);
  }
}

function renderMockPalette() {
  const container = document.getElementById("mock-palette-grid");
  
  container.innerHTML = MOCK_QUESTIONS.map((q, idx) => {
    const num = idx + 1;
    const answered = mockAnswers[q.id] !== undefined;
    const marked = mockReviewList.includes(num);
    const visited = mockVisitedList[q.id] === true;
    const isActive = idx === mockCurrentIndex;
    
    let stateClass = "";
    if (answered) stateClass = "answered";
    else if (marked) stateClass = "review";
    else if (visited) stateClass = "visited";
    
    if (isActive) stateClass += " active";

    return `
      <div class="palette-item ${stateClass}" onclick="showMockQuestion(${idx})">
        ${num}
      </div>
    `;
  }).join("");
}

async function submitMockExam() {
  clearInterval(mockTimerInterval);
  mockActive = false;

  // Score calculations
  let correct = 0;
  let attempted = 0;
  
  MOCK_QUESTIONS.forEach(q => {
    if (mockAnswers[q.id] !== undefined) {
      attempted++;
      if (mockAnswers[q.id] === q.answer) {
        correct++;
      }
    }
  });

  const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;
  const timeSeconds = (40 * 60) - mockTimeLeft;
  const timeLabel = formatSeconds(timeSeconds);

  // Sync to backend if database active
  try {
    await fetch(`${BACKEND_BASE_URL}/mock-exam/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: mockAnswers, timeTaken: timeLabel })
    });
  } catch (err) {
    console.warn("Prisma mock record failed.", err);
  }

  // Update State Analytics
  state.mocksTaken++;
  logActivity("mocks", "Sectional Quant Mock Complete", `${accuracy}% ACCURACY`, timeLabel);
  
  // Calculate calibrated section accuracies
  state.accuracies.Quants = Math.min(100, Math.round((state.accuracies.Quants * 2 + accuracy) / 3));
  state.accuracies.VARC = Math.min(100, state.accuracies.VARC + (accuracy > 70 ? 2 : -1));
  state.accuracies.DILR = Math.min(100, state.accuracies.DILR + (accuracy > 60 ? 3 : -1));

  saveState();

  // Alert & Switch to Analytics
  alert(`Sectional Mock Submitted!\nAttempted: ${attempted} / 6\nAccuracy: ${accuracy}%\nTime Taken: ${timeLabel}`);

  document.getElementById("mock-intro-screen").style.display = "block";
  document.getElementById("mock-console-screen").style.display = "none";
  switchTab("analytics");
}

// ----------------------------------------------------------
// 8. System Startup & Event Wireframes
// ----------------------------------------------------------
function esc(value) {
  return String(value ?? "").replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[c]));
}

document.addEventListener("DOMContentLoaded", () => {
  loadState();

  // Check Puter auth
  checkPuterStatus();

  // Tab Menu Bindings
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      switchTab(item.getAttribute("data-tab"));
    });
  });

  // Puter login binding
  const btnPuterConnect = document.getElementById("btn-puter-connect");
  if (btnPuterConnect) {
    btnPuterConnect.addEventListener("click", handlePuterLogin);
  }

  // Arena bindings
  document.getElementById("btn-submit-answer").addEventListener("click", submitArenaAnswer);
  document.getElementById("btn-clear-selection").addEventListener("click", clearArenaSelection);
  document.getElementById("btn-next-arena").addEventListener("click", loadNextArenaQuestion);
  document.getElementById("btn-show-hint").addEventListener("click", () => {
    document.getElementById("arena-hint-drawer").classList.add("open");
  });
  document.getElementById("btn-close-hint").addEventListener("click", () => {
    document.getElementById("arena-hint-drawer").classList.remove("open");
  });

  // Flashcards bindings
  const fcCard = document.getElementById("flashcard-scene");
  if (fcCard) {
    fcCard.addEventListener("click", flipFlashcard);
  } else {
    document.getElementById("flashcard-card").addEventListener("click", flipFlashcard);
  }

  const fcBack = document.querySelector(".flashcard-back");
  if (fcBack) {
    fcBack.addEventListener("click", (e) => {
      // Allow card to flip back only if clicked background or the bottom text hint
      if (e.target.classList.contains("card-tip") || e.target.classList.contains("flashcard-back") || e.target.classList.contains("card-inner-wrapper")) {
        return; // propagates to card click to flip back
      }
      e.stopPropagation();
    });
  }

  const btnTogglePractice = document.getElementById("btn-toggle-practice");
  const practiceBox = document.getElementById("card-practice-box");
  if (btnTogglePractice && practiceBox) {
    btnTogglePractice.addEventListener("click", (e) => {
      e.stopPropagation();
      if (practiceBox.style.display === "none") {
        practiceBox.style.display = "block";
        btnTogglePractice.textContent = "🙈 Hide Practice Question";
        btnTogglePractice.style.borderColor = "var(--border)";
        btnTogglePractice.style.background = "rgba(255, 255, 255, 0.02)";
        btnTogglePractice.style.color = "var(--muted)";
      } else {
        practiceBox.style.display = "none";
        btnTogglePractice.textContent = "🎯 Solve High CAT Level Question";
        btnTogglePractice.style.borderColor = "rgba(88, 166, 255, 0.4)";
        btnTogglePractice.style.background = "rgba(88, 166, 255, 0.05)";
        btnTogglePractice.style.color = "#58a6ff";
      }
    });
  }

  const btnPracticeSolution = document.getElementById("btn-practice-solution");
  const solutionBox = document.getElementById("practice-solution-box");
  if (btnPracticeSolution && solutionBox) {
    btnPracticeSolution.addEventListener("click", (e) => {
      e.stopPropagation();
      if (solutionBox.style.display === "none") {
        solutionBox.style.display = "block";
        btnPracticeSolution.textContent = "Hide Step-by-Step Solution";
      } else {
        solutionBox.style.display = "none";
        btnPracticeSolution.textContent = "Show Step-by-Step Solution";
      }
    });
  }

  document.getElementById("btn-prev-card").addEventListener("click", () => {
    if (currentCardIndex > 0) {
      currentCardIndex--;
      showCard(currentCardIndex);
    }
  });

  document.getElementById("btn-next-card").addEventListener("click", () => {
    if (currentCardIndex < flashcards.length - 1) {
      currentCardIndex++;
      showCard(currentCardIndex);
    }
  });

  // Flashcards ratings panel
  document.querySelectorAll("#flashcard-rating-panel button").forEach(btn => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const confidence = btn.getAttribute("data-confidence");
      
      // Update statistics
      state.flashcardsReviewed++;
      logActivity("flashcards", `Reviewed Card in ${flashcards[currentCardIndex].topic}`, confidence.toUpperCase(), "8s");
      saveState();

      // Go to next card
      if (currentCardIndex < flashcards.length - 1) {
        currentCardIndex++;
        showCard(currentCardIndex);
      } else {
        alert("Deck complete! Solid work reviewing CAT key concepts.");
      }
    });
  });

  // Mock exam start bindings
  document.getElementById("btn-start-mock").addEventListener("click", startMockSimulation);
  document.getElementById("btn-mock-clear").addEventListener("click", clearMockSelection);
  document.getElementById("btn-mock-review").addEventListener("click", toggleMockReview);
  document.getElementById("btn-mock-save-next").addEventListener("click", () => {
    saveAndNextMock();
  });
  document.getElementById("btn-submit-mock").addEventListener("click", submitMockExam);

  // Initialize
  updateUI();
});
