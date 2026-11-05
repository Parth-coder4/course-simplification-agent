/* ── Course Content Simplification Agent — Frontend JS ───────────────────── */
"use strict";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const contentInput   = document.getElementById("contentInput");
const subjectInput   = document.getElementById("subjectInput");
const charCount      = document.getElementById("charCount");
const simplifyBtn    = document.getElementById("simplifyBtn");
const analyzeBtn     = document.getElementById("analyzeBtn");
const clearBtn       = document.getElementById("clearBtn");
const outputSection  = document.getElementById("outputSection");
const outputContent  = document.getElementById("outputContent");
const outputStats    = document.getElementById("outputStats");
const outputModel    = document.getElementById("outputModel");
const outputLevelBadge = document.getElementById("outputLevelBadge");
const copyBtn        = document.getElementById("copyBtn");
const loadingOverlay = document.getElementById("loadingOverlay");
const healthBadge    = document.getElementById("healthBadge");
const analysisPanel  = document.getElementById("analysisPanel");
const analysisContent = document.getElementById("analysisContent");
const errorToast     = document.getElementById("errorToast");
const errorMessage   = document.getElementById("errorMessage");
const dismissError   = document.getElementById("dismissError");
const levelCards     = document.querySelectorAll(".level-card");

const MAX_CHARS = 8000;

// ── Helpers ───────────────────────────────────────────────────────────────────
function showError(msg) {
  errorMessage.textContent = msg;
  errorToast.classList.remove("hidden");
}

function hideError() {
  errorToast.classList.add("hidden");
}

function showLoading() {
  loadingOverlay.classList.remove("hidden");
  simplifyBtn.disabled = true;
}

function hideLoading() {
  loadingOverlay.classList.add("hidden");
  simplifyBtn.disabled = false;
}

function getSelectedLevel() {
  const radio = document.querySelector('input[name="level"]:checked');
  return radio ? radio.value : "beginner";
}

function updateCharCount() {
  const n = contentInput.value.length;
  charCount.textContent = `${n.toLocaleString()} / ${MAX_CHARS.toLocaleString()} characters`;
  charCount.style.color = n > MAX_CHARS ? "var(--ibm-red)" : "";
}

// ── Level card active state (CSS :has fallback for older browsers) ─────────────
levelCards.forEach(card => {
  card.addEventListener("click", () => {
    levelCards.forEach(c => c.classList.remove("level-card--active"));
    card.classList.add("level-card--active");
  });
});

// ── Character counter ─────────────────────────────────────────────────────────
contentInput.addEventListener("input", updateCharCount);

// ── Clear ─────────────────────────────────────────────────────────────────────
clearBtn.addEventListener("click", () => {
  contentInput.value = "";
  updateCharCount();
  outputSection.classList.add("hidden");
  analysisPanel.classList.add("hidden");
  hideError();
});

// ── Dismiss error ─────────────────────────────────────────────────────────────
dismissError.addEventListener("click", hideError);

// ── Health check on page load ─────────────────────────────────────────────────
(async function checkHealth() {
  try {
    const res  = await fetch("/api/health");
    const data = await res.json();
    if (data.status === "ok") {
      healthBadge.textContent = "● Connected";
      healthBadge.className = "badge badge--ok";
    } else {
      const missing = (data.missing_env || []).join(", ");
      healthBadge.textContent = `⚠ Misconfigured: ${missing}`;
      healthBadge.className = "badge badge--error";
    }
  } catch {
    healthBadge.textContent = "⚠ Offline";
    healthBadge.className = "badge badge--error";
  }
})();

// ── Complexity Analyser ───────────────────────────────────────────────────────
analyzeBtn.addEventListener("click", async () => {
  const content = contentInput.value.trim();
  if (!content) { showError("Please paste some content first."); return; }

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing…";
  analysisPanel.classList.add("hidden");
  hideError();

  try {
    const res  = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();

    if (!res.ok) { showError(data.error || "Analysis failed."); return; }

    const a = data.analysis;
    renderAnalysis(a);
    analysisPanel.classList.remove("hidden");
  } catch (err) {
    showError("Network error: " + err.message);
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> Analyze Complexity`;
  }
});

function renderAnalysis(a) {
  if (a.raw) {
    analysisContent.innerHTML = `<pre style="white-space:pre-wrap;font-size:.85rem">${escapeHtml(a.raw)}</pre>`;
    return;
  }

  const score    = a.complexity_score || 0;
  const pct      = Math.min(score * 10, 100);
  const barColor = score <= 3 ? "var(--ibm-green)"
                 : score <= 6 ? "var(--ibm-yellow)"
                 : "var(--ibm-red)";

  const jargonHtml = (a.jargon_terms || []).map(t =>
    `<span class="jargon-tag">${escapeHtml(t)}</span>`
  ).join("");

  const targetsHtml = (a.recommended_targets || []).map(t =>
    `<span class="badge badge--${t}">${t}</span>`
  ).join(" ");

  analysisContent.innerHTML = `
    <p><strong>Detected level:</strong> <span class="badge badge--${a.detected_level}">${a.detected_level || "–"}</span></p>
    <div class="complexity-bar-wrap">
      <strong>Complexity score: ${score}/10</strong>
      <div class="complexity-bar-bg" style="margin-top:.35rem">
        <div class="complexity-bar-fill" style="width:${pct}%;background:${barColor}"></div>
      </div>
      <p class="complexity-label">${a.brief_reason || ""}</p>
    </div>
    ${jargonHtml ? `<p><strong>Jargon terms found:</strong></p><div class="jargon-tags">${jargonHtml}</div>` : ""}
    ${targetsHtml ? `<p><strong>Recommended simplification targets:</strong> ${targetsHtml}</p>` : ""}
  `;
}

// ── Simplify ──────────────────────────────────────────────────────────────────
simplifyBtn.addEventListener("click", async () => {
  const content = contentInput.value.trim();
  const level   = getSelectedLevel();
  const subject = subjectInput.value.trim();

  if (!content) { showError("Please paste some academic content to simplify."); return; }
  if (content.length > MAX_CHARS) { showError(`Content exceeds ${MAX_CHARS.toLocaleString()} characters.`); return; }

  hideError();
  outputSection.classList.add("hidden");
  showLoading();

  try {
    const res  = await fetch("/api/simplify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, level, subject }),
    });
    const data = await res.json();

    if (!res.ok) { showError(data.error || "Simplification failed."); return; }

    // ── Render output ────────────────────────────────────────────────────────
    outputContent.textContent = data.simplified_content;

    outputLevelBadge.textContent = data.level_label;
    outputLevelBadge.className   = `badge badge--${data.level}`;

    const ratio = data.original_length
      ? Math.round((data.simplified_length / data.original_length) * 100)
      : 100;
    outputStats.textContent = `Original: ${data.original_length.toLocaleString()} chars  →  Simplified: ${data.simplified_length.toLocaleString()} chars (${ratio}%)`;
    outputModel.textContent = `Model: ${data.model_used}`;

    outputSection.classList.remove("hidden");
    outputSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    showError("Network error: " + err.message);
  } finally {
    hideLoading();
  }
});

// ── Copy to clipboard ─────────────────────────────────────────────────────────
copyBtn.addEventListener("click", async () => {
  const text = outputContent.textContent;
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "✓ Copied!";
    setTimeout(() => {
      copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
    }, 2000);
  } catch {
    showError("Clipboard access denied. Please copy manually.");
  }
});

// ── Utility ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── Chat Feature ────────────────────────────────────────────────────────── */

const chatSection       = document.getElementById("chatSection");
const chatMessages      = document.getElementById("chatMessages");
const chatInput         = document.getElementById("chatInput");
const chatSendBtn       = document.getElementById("chatSendBtn");
const clearChatBtn      = document.getElementById("clearChatBtn");
const chatContextBadge  = document.getElementById("chatContextBadge");
const suggestedQuestions = document.getElementById("suggestedQuestions");
const suggestedList     = document.getElementById("suggestedList");

// State: persisted across messages within the same session
const chatState = {
  history:      [],   // [{role, content}]
  topicContext: "",   // the simplified content text
  subject:      "",
  level:        "beginner",
};

// Suggested follow-up questions per level
const SUGGESTED = {
  beginner: [
    "Can you give me a simpler example?",
    "What does this mean in everyday life?",
    "Why is this important?",
    "Can you explain it like I'm 10?",
  ],
  intermediate: [
    "How does this work in practice?",
    "What are some real-world applications?",
    "Can you explain the key terms?",
    "What should I study next?",
  ],
  advanced: [
    "What are the edge cases here?",
    "How does this compare to related concepts?",
    "What are the common misconceptions?",
    "What deeper mechanisms are involved?",
  ],
  expert: [
    "What does the current research say?",
    "What are the theoretical limitations?",
    "How is this applied in industry?",
    "What open problems exist in this area?",
  ],
};

// ── Show chat panel when simplification completes ─────────────────────────────
function openChatForTopic(simplifiedText, level, subject) {
  chatState.history      = [];
  chatState.topicContext = simplifiedText;
  chatState.level        = level;
  chatState.subject      = subject;

  // Reset message feed to welcome message only
  chatMessages.innerHTML = `
    <div class="chat-welcome">
      <p>👋 Hi! I'm your AI tutor powered by <strong>IBM Granite</strong>.</p>
      <p>Ask me anything about the topic — I'll answer at your <strong>${capitalise(level)}</strong> level.</p>
    </div>`;

  // Context badge
  chatContextBadge.textContent = subject
    ? `📚 ${subject} · ${capitalise(level)}`
    : `📚 ${capitalise(level)}`;

  // Suggested questions
  renderSuggested(level);

  chatSection.classList.remove("hidden");
  chatSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderSuggested(level) {
  const questions = SUGGESTED[level] || SUGGESTED.beginner;
  suggestedList.innerHTML = questions.map(q =>
    `<button class="suggested-btn" data-q="${escapeAttr(q)}">${escapeHtml(q)}</button>`
  ).join("");
  suggestedQuestions.classList.remove("hidden");
}

suggestedList.addEventListener("click", (e) => {
  const btn = e.target.closest(".suggested-btn");
  if (!btn) return;
  chatInput.value = btn.dataset.q;
  chatInput.focus();
  sendChatMessage();
});

// ── Hook into the existing simplify flow ─────────────────────────────────────
// We monkey-patch by listening for the outputSection becoming visible.
// The simplifyBtn click handler already sets outputContent.textContent, so
// we override it after the fact via a MutationObserver on outputSection.
const _outputObserver = new MutationObserver(() => {
  if (!outputSection.classList.contains("hidden")) {
    const level   = getSelectedLevel();
    const subject = subjectInput.value.trim();
    openChatForTopic(outputContent.textContent, level, subject);
  }
});
_outputObserver.observe(outputSection, { attributes: true, attributeFilter: ["class"] });

// ── Send a chat message ───────────────────────────────────────────────────────
async function sendChatMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = "";
  autoResizeChatInput();
  suggestedQuestions.classList.add("hidden");

  // Append the user bubble immediately
  appendMessage("user", text);
  chatState.history.push({ role: "user", content: text });

  // Show typing indicator
  const typingEl = showTyping();
  chatSendBtn.disabled = true;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic_context: chatState.topicContext,
        subject:       chatState.subject,
        level:         chatState.level,
        history:       chatState.history.slice(0, -1), // exclude the message we just pushed
        message:       text,
      }),
    });
    const data = await res.json();

    removeTyping(typingEl);

    if (!res.ok) {
      appendMessage("ai", `⚠️ Error: ${data.error || "Something went wrong."}`);
      return;
    }

    appendMessage("ai", data.reply);
    chatState.history.push({ role: "assistant", content: data.reply });

    // Show suggested questions again after AI reply
    renderSuggested(chatState.level);

  } catch (err) {
    removeTyping(typingEl);
    appendMessage("ai", `⚠️ Network error: ${err.message}`);
  } finally {
    chatSendBtn.disabled = false;
    chatInput.focus();
  }
}

// ── Send on button click ──────────────────────────────────────────────────────
chatSendBtn.addEventListener("click", sendChatMessage);

// ── Send on Enter (Shift+Enter = newline) ─────────────────────────────────────
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

// ── Auto-resize textarea ──────────────────────────────────────────────────────
chatInput.addEventListener("input", autoResizeChatInput);
function autoResizeChatInput() {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
}

// ── Clear chat ────────────────────────────────────────────────────────────────
clearChatBtn.addEventListener("click", () => {
  chatState.history = [];
  chatMessages.innerHTML = `
    <div class="chat-welcome">
      <p>👋 Chat cleared. Ask me anything about the topic!</p>
    </div>`;
  renderSuggested(chatState.level);
});

// ── DOM helpers ───────────────────────────────────────────────────────────────
function appendMessage(role, text) {
  // Remove welcome message on first real message
  const welcome = chatMessages.querySelector(".chat-welcome");
  if (welcome) welcome.remove();

  const time  = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const label = role === "user" ? "You" : "IBM Granite";

  const div = document.createElement("div");
  div.className = `chat-msg chat-msg--${role === "user" ? "user" : "ai"}`;
  div.innerHTML = `
    <div class="chat-msg__bubble">${escapeHtml(text)}</div>
    <span class="chat-msg__meta">${label} · ${time}</span>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTyping() {
  const div = document.createElement("div");
  div.className = "chat-msg chat-typing";
  div.innerHTML = `
    <div class="chat-typing__bubble">
      <div class="chat-typing__dot"></div>
      <div class="chat-typing__dot"></div>
      <div class="chat-typing__dot"></div>
    </div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function removeTyping(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function capitalise(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
