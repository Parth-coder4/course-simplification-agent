"""
Course Content Simplification Agent
Problem Statement #19 — IBM Granite (watsonx.ai) powered educational content reframer

Uses the watsonx.ai REST API directly (via `requests`) to avoid the pandas/DLL
dependency that the ibm-watsonx-ai SDK pulls in through its vector-index utilities.
"""

import os
import re
import json
import requests
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv

# ── Load environment ──────────────────────────────────────────────────────────
load_dotenv()

app = Flask(__name__)
CORS(app)

# ── IBM watsonx.ai Configuration ──────────────────────────────────────────────
WATSONX_API_KEY    = os.getenv("WATSONX_API_KEY", "")
WATSONX_URL        = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
WATSONX_PROJECT_ID = os.getenv("WATSONX_PROJECT_ID", "")
GRANITE_MODEL_ID   = os.getenv("GRANITE_MODEL_ID", "ibm/granite-4-h-small")

IAM_TOKEN_URL      = "https://iam.cloud.ibm.com/identity/token"
WATSONX_CHAT_URL   = "{base}/ml/v1/text/chat?version=2025-02-11"

# ── Token cache (in-process, refreshed on expiry) ─────────────────────────────
_token_cache: dict = {"token": None, "expires_at": 0}


def get_iam_token() -> str:
    """Exchange the IBM Cloud API key for a short-lived IAM bearer token."""
    import time
    if _token_cache["token"] and time.time() < _token_cache["expires_at"] - 60:
        return _token_cache["token"]

    resp = requests.post(
        IAM_TOKEN_URL,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data={
            "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
            "apikey": WATSONX_API_KEY,
        },
        timeout=15,
    )
    resp.raise_for_status()
    payload = resp.json()
    import time as _time
    _token_cache["token"] = payload["access_token"]
    _token_cache["expires_at"] = _time.time() + int(payload.get("expires_in", 3600))
    return _token_cache["token"]


def call_granite(system_msg: str, user_msg: str, max_new_tokens: int = 1024) -> str:
    """Call the watsonx.ai text/chat endpoint (granite-4-h-small is chat-tuned)."""
    token = get_iam_token()
    url   = WATSONX_CHAT_URL.format(base=WATSONX_URL)

    payload = {
        "model_id":   GRANITE_MODEL_ID,
        "project_id": WATSONX_PROJECT_ID,
        "messages": [
            {"role": "system", "content": system_msg},
            {"role": "user",   "content": user_msg},
        ],
        "parameters": {
            "max_new_tokens":    max_new_tokens,
            "temperature":       0.4,
            "top_p":             0.9,
            "repetition_penalty": 1.1,
        },
    }

    resp = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type":  "application/json",
            "Accept":        "application/json",
        },
        json=payload,
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"].strip()


def call_granite_with_history(messages: list, max_new_tokens: int = 800) -> str:
    """Call the chat API with a full multi-turn conversation history."""
    token = get_iam_token()
    url   = WATSONX_CHAT_URL.format(base=WATSONX_URL)

    payload = {
        "model_id":   GRANITE_MODEL_ID,
        "project_id": WATSONX_PROJECT_ID,
        "messages":   messages,
        "parameters": {
            "max_new_tokens":    max_new_tokens,
            "temperature":       0.5,
            "top_p":             0.9,
            "repetition_penalty": 1.05,
        },
    }

    resp = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type":  "application/json",
            "Accept":        "application/json",
        },
        json=payload,
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"].strip()


# ── Proficiency level definitions ─────────────────────────────────────────────
PROFICIENCY_LEVELS = {
    "beginner": {
        "label": "Beginner",
        "description": "No prior knowledge assumed. Use simple everyday language, real-world analogies, "
                       "avoid jargon, define every technical term, use short sentences.",
    },
    "intermediate": {
        "label": "Intermediate",
        "description": "Some foundational knowledge assumed. Introduce proper terminology with brief "
                       "definitions, build on basic concepts, use relatable examples.",
    },
    "advanced": {
        "label": "Advanced",
        "description": "Solid domain knowledge assumed. Use technical terminology freely, include nuance, "
                       "reference underlying mechanisms and edge cases.",
    },
    "expert": {
        "label": "Expert",
        "description": "Deep professional/research-level knowledge assumed. Use precise academic/industry "
                       "terminology, reference standards, theoretical foundations, and current debates.",
    },
}


def build_prompt(content: str, level: str, subject: str) -> tuple[str, str]:
    """Return (system_message, user_message) for the chat API."""
    level_info  = PROFICIENCY_LEVELS[level]
    subject_ctx = f" The subject area is: {subject}." if subject.strip() else ""

    system_msg = (
        f"You are an expert educational content simplification agent. Your task is to rewrite "
        f"academic content so it is perfectly tailored to the learner's proficiency level.{subject_ctx}\n\n"
        f"Target proficiency level: {level_info['label']}\n"
        f"Adaptation guidelines: {level_info['description']}\n\n"
        f"Rules:\n"
        f"1. Preserve ALL key concepts and factual accuracy — do NOT omit important information.\n"
        f"2. Adjust vocabulary, sentence complexity, and explanation depth to match the target level.\n"
        f"3. At beginner/intermediate levels, use analogies and concrete examples.\n"
        f"4. At advanced/expert levels, retain technical precision and add depth.\n"
        f"5. Format the output with clear section headings where appropriate.\n"
        f"6. End with a 'Key Takeaways' bullet list (3-5 points) suited to the target level."
    )

    user_msg = (
        f"Rewrite the following academic content for a {level_info['label']} learner:\n\n"
        f"--- ORIGINAL CONTENT ---\n{content}\n--- END OF CONTENT ---\n\n"
        f"Provide the rewritten explanation now:"
    )

    return system_msg, user_msg


# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html", levels=PROFICIENCY_LEVELS)


@app.route("/api/simplify", methods=["POST"])
def simplify():
    data    = request.get_json(force=True)
    content = (data.get("content") or "").strip()
    level   = (data.get("level")   or "beginner").lower()
    subject = (data.get("subject") or "").strip()

    if not content:
        return jsonify({"error": "Content is required."}), 400
    if len(content) > 8000:
        return jsonify({"error": "Content exceeds the 8 000-character limit."}), 400
    if level not in PROFICIENCY_LEVELS:
        return jsonify({"error": f"Invalid level. Choose from: {list(PROFICIENCY_LEVELS.keys())}"}), 400

    try:
        system_msg, user_msg = build_prompt(content, level, subject)
        result = call_granite(system_msg, user_msg)
        return jsonify({
            "simplified_content": result,
            "level":              level,
            "level_label":        PROFICIENCY_LEVELS[level]["label"],
            "model_used":         GRANITE_MODEL_ID,
            "original_length":    len(content),
            "simplified_length":  len(result),
        })
    except requests.HTTPError as exc:
        app.logger.error("watsonx API HTTP error: %s — %s", exc, exc.response.text)
        return jsonify({"error": f"watsonx API error: {exc.response.status_code} — {exc.response.text}"}), 502
    except Exception as exc:
        app.logger.error("Granite error: %s", exc)
        return jsonify({"error": f"Model inference failed: {str(exc)}"}), 500


@app.route("/api/analyze", methods=["POST"])
def analyze():
    data    = request.get_json(force=True)
    content = (data.get("content") or "").strip()

    if not content:
        return jsonify({"error": "Content is required."}), 400

    system_msg = (
        "You are an academic content complexity analyser. "
        "Analyse the text and return ONLY a JSON object with these keys:\n"
        "  \"complexity_score\"   : integer 1-10 (1 = very simple, 10 = highly technical)\n"
        "  \"detected_level\"     : one of \"beginner\", \"intermediate\", \"advanced\", \"expert\"\n"
        "  \"jargon_terms\"       : array of up to 5 domain-specific terms found in the text\n"
        "  \"recommended_targets\": array of levels the content should be simplified to\n"
        "  \"brief_reason\"       : one sentence explaining the complexity rating\n"
        "Return ONLY valid JSON, no other text."
    )
    user_msg = f"Analyse this content:\n{content[:3000]}"

    try:
        result     = call_granite(system_msg, user_msg, max_new_tokens=256)
        json_match = re.search(r"\{.*\}", result, re.DOTALL)
        analysis   = json.loads(json_match.group()) if json_match else {"raw": result}
        return jsonify({"analysis": analysis})
    except requests.HTTPError as exc:
        return jsonify({"error": f"watsonx API error: {exc.response.status_code}"}), 502
    except Exception as exc:
        app.logger.error("Analysis error: %s", exc)
        return jsonify({"error": f"Analysis failed: {str(exc)}"}), 500


@app.route("/api/chat", methods=["POST"])
def chat():
    """
    POST /api/chat
    Multi-turn student chatbot — student cross-questions the simplified topic.

    Body (JSON):
      {
        "topic_context": "<the simplified content shown to the student>",
        "subject":       "<optional subject label>",
        "level":         "beginner" | "intermediate" | "advanced" | "expert",
        "history":       [{"role": "user"|"assistant", "content": "..."}],
        "message":       "<the student's new question>"
      }
    """
    data          = request.get_json(force=True)
    topic_context = (data.get("topic_context") or "").strip()
    subject       = (data.get("subject")       or "").strip()
    level         = (data.get("level")         or "beginner").lower()
    history       = data.get("history")        or []
    message       = (data.get("message")       or "").strip()

    if not message:
        return jsonify({"error": "Message is required."}), 400
    if level not in PROFICIENCY_LEVELS:
        level = "beginner"

    level_label  = PROFICIENCY_LEVELS[level]["label"]
    subject_ctx  = f" The subject is: {subject}." if subject else ""
    context_hint = (
        f"\n\nThe student is currently studying this content:\n---\n{topic_context[:3000]}\n---"
        if topic_context else ""
    )

    system_msg = (
        f"You are a friendly, patient AI tutor helping a {level_label}-level student "
        f"understand their course material.{subject_ctx}{context_hint}\n\n"
        f"Guidelines:\n"
        f"- Answer only questions related to the topic or subject.\n"
        f"- Tailor your language to a {level_label} learner.\n"
        f"- Be encouraging and break down complex ideas into simple steps.\n"
        f"- If the student asks something off-topic, gently redirect them.\n"
        f"- Keep answers focused and concise (3-6 sentences unless a longer explanation is needed).\n"
        f"- Use examples and analogies appropriate for the proficiency level."
    )

    # Build the full message list: system + prior history + new user message
    # Cap history to the last 10 exchanges to stay within token limits
    capped_history = history[-20:]  # 20 messages = 10 exchanges
    messages = [{"role": "system", "content": system_msg}]
    messages += [{"role": m["role"], "content": m["content"]} for m in capped_history]
    messages.append({"role": "user", "content": message})

    try:
        reply = call_granite_with_history(messages)
        return jsonify({
            "reply":   reply,
            "role":    "assistant",
            "model":   GRANITE_MODEL_ID,
        })
    except requests.HTTPError as exc:
        app.logger.error("Chat API HTTP error: %s — %s", exc, exc.response.text)
        return jsonify({"error": f"watsonx API error: {exc.response.status_code}"}), 502
    except Exception as exc:
        app.logger.error("Chat error: %s", exc)
        return jsonify({"error": f"Chat failed: {str(exc)}"}), 500


@app.route("/api/levels", methods=["GET"])
def levels():
    return jsonify(PROFICIENCY_LEVELS)


@app.route("/api/health", methods=["GET"])
def health():
    missing = []
    if not WATSONX_API_KEY:
        missing.append("WATSONX_API_KEY")
    if not WATSONX_PROJECT_ID:
        missing.append("WATSONX_PROJECT_ID")

    return jsonify({
        "status":      "ok" if not missing else "misconfigured",
        "model":       GRANITE_MODEL_ID,
        "region":      WATSONX_URL,
        "missing_env": missing,
    }), 200 if not missing else 503


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port  = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
