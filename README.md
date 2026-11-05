# Course Content Simplification Agent

> **Problem Statement #19** — AI-powered educational content reframer  
> Built with **IBM Granite** (IBM watsonx.ai) on IBM Cloud Lite

---

## Overview

An intelligent agent that takes any academic content — lecture notes, textbook excerpts, research papers — and rewrites it perfectly tailored to a learner's proficiency level:

| Level | Description |
|-------|-------------|
| **Beginner** | Plain language, everyday analogies, zero jargon |
| **Intermediate** | Proper terminology introduced with brief definitions |
| **Advanced** | Technical vocabulary, deeper mechanisms, nuance |
| **Expert** | Research-grade precision, standards, theoretical depth |

---

## Features

- **Content Simplification** — Rewrites academic content at 4 proficiency levels using IBM Granite
- **Complexity Analyser** — Scans content and returns a complexity score (1–10), jargon terms, and recommended target levels
- **Subject Context** — Optional subject area for domain-aware rewrites
- **Character Guard** — Hard 8 000-character input limit with live counter
- **Health Check** — Real-time API connectivity status in the header
- **Copy to Clipboard** — One-click copy of simplified output

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI Model | IBM Granite `ibm/granite-3-3-8b-instruct` via **IBM watsonx.ai** |
| Backend | Python 3.9+ · Flask 3 |
| Frontend | Vanilla HTML5 · CSS3 · JavaScript (no framework) |
| IBM SDK | `ibm-watsonx-ai` Python library |
| Config | `python-dotenv` |

---

## Prerequisites

- Python **3.9** or higher
- An **IBM Cloud Lite** (free) account: [cloud.ibm.com](https://cloud.ibm.com)
- A **watsonx.ai** service instance (available on Lite tier)

---

## Quick Start

### 1 · Clone / open the project

```bash
cd course-simplification-agent
```

### 2 · Create a virtual environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 3 · Install dependencies

```bash
pip install -r requirements.txt
```

### 4 · Configure IBM Cloud credentials

Edit `.env` and fill in your values:

```env
WATSONX_API_KEY=<your IBM Cloud API key>
WATSONX_PROJECT_ID=<your watsonx.ai Project ID>
WATSONX_URL=https://us-south.ml.cloud.ibm.com   # change region if needed
GRANITE_MODEL_ID=ibm/granite-3-3-8b-instruct
```

**Where to get the values:**

| Value | Where to find it |
|-------|-----------------|
| `WATSONX_API_KEY` | IBM Cloud → Manage → Access (IAM) → API keys → **Create** |
| `WATSONX_PROJECT_ID` | watsonx.ai → your Project → **Manage** tab → Project ID |
| `WATSONX_URL` | Match to your watsonx.ai instance region (see `.env` comments) |

### 5 · Run the application

```bash
python app.py
```

Open your browser at **http://localhost:5000**

---

## API Reference

### `POST /api/simplify`

Rewrite content for a target proficiency level.

**Request body (JSON):**
```json
{
  "content":  "The mitochondria are double membrane-bound organelles…",
  "level":    "beginner",
  "subject":  "Biology"
}
```

**Response:**
```json
{
  "simplified_content": "Think of mitochondria as the batteries of the cell…",
  "level": "beginner",
  "level_label": "Beginner",
  "model_used": "ibm/granite-3-3-8b-instruct",
  "original_length": 240,
  "simplified_length": 312
}
```

---

### `POST /api/analyze`

Analyse the complexity of academic content.

**Request body:**
```json
{ "content": "…your academic text…" }
```

**Response:**
```json
{
  "analysis": {
    "complexity_score": 8,
    "detected_level": "expert",
    "jargon_terms": ["homeostasis", "ATP synthesis", "cristae"],
    "recommended_targets": ["beginner", "intermediate"],
    "brief_reason": "Dense technical vocabulary with multi-clause sentences."
  }
}
```

---

### `GET /api/health`

Returns service configuration status.

---

## Project Structure

```
course-simplification-agent/
├── app.py                  # Flask backend + IBM Granite integration
├── .env                    # IBM Cloud credentials (DO NOT COMMIT)
├── requirements.txt        # Python dependencies
├── README.md
├── templates/
│   └── index.html          # Main UI template
└── static/
    ├── css/
    │   └── style.css       # IBM Carbon-inspired styles
    └── js/
        └── app.js          # Frontend agent logic
```

---

## IBM Granite Model

This project uses **IBM Granite 3.3 8B Instruct** (`ibm/granite-3-3-8b-instruct`), IBM's enterprise-grade instruction-following language model, accessed via the `ibm-watsonx-ai` Python SDK.

The model is available on **IBM Cloud Lite (free tier)** through watsonx.ai.

---

## License

MIT — see [LICENSE](LICENSE)
