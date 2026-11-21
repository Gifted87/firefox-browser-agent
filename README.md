# 🦊 Aetheria — Firefox Autonomous ReAct Browser Agent

[![Firefox Extension](https://img.shields.io/badge/Firefox-Extension%20MV3-FF7139?logo=firefox-browser&logoColor=white)](https://addons.mozilla.org/)
[![WebExtensions API](https://img.shields.io/badge/WebExtensions-Gecko%20109%2B-0A84FF?logo=mozilla&logoColor=white)](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2022%2B-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![ReAct Engine](https://img.shields.io/badge/Agent%20Architecture-ReAct%20Loop-7928CA?logo=openai&logoColor=white)](https://arxiv.org/abs/2210.03629)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> **Aetheria** is an autonomous, production-grade browser agent extension built natively for **Mozilla Firefox (Manifest V3)**. Harnessing the **ReAct (Reasoning + Acting)** execution pattern, Aetheria perceives live web pages through numbered DOM element overlays, formulates sequential reasoning traces, invokes structured browser automation tools, ingests portfolio and resume contexts, and maintains an interactive **Human-in-the-Loop** control model.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture & Component Breakdown](#-architecture--component-breakdown)
  - [Directory Structure](#directory-structure)
  - [Core Subsystems](#core-subsystems)
- [Tool Registry & Agent Capabilities](#-tool-registry--agent-capabilities)
- [Supported LLM Providers](#-supported-llm-providers)
- [Installation & Firefox Setup](#-installation--firefox-setup)
- [Quick Start & Usage Guide](#-quick-start--usage-guide)
- [Testing & Validation](#-testing--validation)
- [Permissions Reference](#-permissions-reference)
- [Security & Privacy Guardrails](#-security--privacy-guardrails)
- [Development Workflows](#-development-workflows)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🔭 Overview

Modern web automation requires more than brittle CSS/XPath selectors. **Aetheria** transforms Mozilla Firefox into an intelligent, autonomous browser assistant:

1. **Perception**: Evaluates the interactive DOM tree, annotating interactive targets with glowing, high-contrast numeric badges (`#1`, `#2`, `#3`, etc.).
2. **Reasoning**: Evaluates the current page state, goal objectives, and ingested personal documents through a structured `Thought -> Action -> Observation` cycle.
3. **Execution**: Synthesizes human-like keyboard input, button clicks, select dropdown choices, scrolling, and file attachments directly in the page sandbox.
4. **Collaboration**: Yields control back to the human user whenever ambiguity, CAPTCHAs, or subjective decisions arise via an interactive sidebar card before resuming execution.

```
+------------------------------------------------------------------------+
|                            Firefox Window                              |
|  +----------------------------------+  +----------------------------+  |
|  |           Web Page Tab           |  |      Aetheria Sidebar      |  |
|  |                                  |  |   (Cyber-Glass Console)    |  |
|  |   [#1 Search Input]              |  |                            |  |
|  |   [#2 Submit Button]             |  |  [Status: Running / Step 3]|  |
|  |   [#3 Upload Resume]             |  |                            |  |
|  |                                  |  |  Thought: Need candidate   |  |
|  |   (Content Script: Overlay Badges|  |  email for field #1...     |  |
|  |    + Synthetic Event Dispatch)   |  |  Action: fill_form_field   |  |
|  +----------------------------------+  +----------------------------+  |
|                   ^                                  ^                 |
|                   |         runtime.sendMessage      |                 |
|                   +----------------------------------+                 |
|                                    |                                   |
|                      +---------------------------+                     |
|                      |   Background Coordinator  |                     |
|                      | (State Broker & Registry) |                     |
|                      +---------------------------+                     |
+------------------------------------------------------------------------+
```

---

## 🌟 Key Features

### 1. 🔄 Autonomous ReAct Reasoning Engine
- Implements the canonical **ReAct (Reasoning + Acting)** execution pattern (`Thought`, `Action`, `Observation`).
- Parses structured tool invocations from standard LLM completions, enforcing schema validity and parameter typing.
- Includes loop limits, pause/resume mechanisms, and step telemetry to avoid infinite cycles.

### 2. 🎯 Visual Element Badging & Dynamic DOM Indexing
- Scans visible, interactive DOM nodes (inputs, buttons, anchors, select boxes, textareas, file inputs).
- Overlays non-intrusive floating badges with integer IDs (`#1`, `#2`, ...) aligned via `getBoundingClientRect()`.
- Generates a compact, token-efficient DOM representation for LLM context injection without sending mega-byte raw HTML.

### 3. 🤝 Interactive Human-in-the-Loop (`ask_user`)
- When faced with ambiguous questions, unfamiliar fields, multi-factor authentication, or CAPTCHA challenges, the agent invokes `ask_user`.
- The execution loop yields asynchronously, surfacing a glowing interactive card in the Firefox sidebar with custom responses and quick-reply choices.
- Execution seamlessly resumes the moment the user responds.

### 4. 📄 In-Browser Resume & Document Manager
- Supports local parsing of PDF, TXT, Markdown, and JSON documents directly inside Firefox via bundled **PDF.js**.
- Emulates genuine browser file selection using synthetic `DataTransfer` and `File` object dispatching on `<input type="file">` elements.
- Designate active resumes, portfolio descriptions, and candidate profile keys (Full Name, Phone, LinkedIn, GitHub, Location).

### 5. 🌐 BFS Domain & Portfolio Link Crawler
- Ingests personal websites, portfolio pages, and documentation trees via an in-extension Breadth-First Search (BFS) crawler.
- Filters cross-origin links, strips scripts, CSS, and boilerplate tags, extracting clean markdown text.
- Automatically compiles crawled domain content into the agent's baseline knowledge repository.

### 6. 🎨 Cyber-Glass Dashboard UI
- Engineered specifically for Firefox's native `sidebar_action` pane (default shortcut: `Ctrl + B`).
- Deep obsidian palette (`#090d16`) with cyan/violet ambient gradients, glassmorphism cards, and pulsing radar indicators.
- Live DOM Inspector tab, step-by-step collapsible thought logs, and full configuration manager.

---

## 🏗️ Architecture & Component Breakdown

### Directory Structure

```
firefox-browser-agent/
├── manifest.json              # WebExtension Manifest V3 (Gecko-optimized)
├── .gitignore                 # Version control ignores (node_modules, caches, logs)
├── generate_icons.mjs         # Dependency-free PNG icon generator (zlib/crc32)
├── README.md                  # Comprehensive technical documentation
├── icons/                     # Extension branding icons
│   ├── icon.svg               # Vector brand master
│   ├── icon-48.png            # 48x48 Firefox toolbar icon
│   └── icon-128.png           # 128x128 Add-on manager display icon
├── src/
│   ├── background/
│   │   └── background.js      # Background service & cross-tab message broker
│   ├── agent/
│   │   ├── react_engine.js    # ReAct execution loop orchestrator & state machine
│   │   ├── prompt_builder.js  # Dynamic prompt engineering & response parsing
│   │   └── llm_client.js      # Multi-provider unified LLM connector
│   ├── content/
│   │   ├── content_script.js  # DOM inspector, badge renderer & synthetic event engine
│   │   └── overlay.css        # Badge numbering and interaction overlay styles
│   ├── context/
│   │   ├── doc_manager.js     # Unified context store (Resumes, Profile, Ingested URLs)
│   │   └── storage.js         # browser.storage.local abstraction layer
│   ├── sidebar/
│   │   ├── sidebar.html       # Sidebar console HTML structure
│   │   ├── sidebar.css        # Cyber-Glass dark UI styling
│   │   └── sidebar.js         # Reactive sidebar view controller & UI binder
│   ├── tools/
│   │   ├── tool_registry.js   # JSON Schema definitions for all agent tools
│   │   └── browser_tools.js   # Client bridge forwarding tool actions to content scripts
│   └── utils/
│       ├── crawler.js         # In-extension BFS domain & link crawler
│       ├── pdf_reader.js      # PDF.js client for binary resume text extraction
│       ├── logger.js          # Unified agent logging bus
│       └── pdfjs/             # Bundled standalone PDF.js engine
│           ├── pdf.min.js
│           └── pdf.worker.min.js
└── test/
    ├── test_agent_core.mjs        # Node.js validation test for core agent logic
    ├── test_openrouter.mjs        # OpenRouter endpoint integration test
    ├── test_qwen_react.mjs        # Qwen ReAct cycle verification test
    ├── test_self_hosted_llm.mjs   # Self-hosted OpenAI-compatible endpoint test
    ├── test_vllm_endpoint.mjs     # vLLM server endpoint validation test
    └── job_application_demo.html  # Interactive mock job application for manual testing
```

### Core Subsystems

#### 1. Manifest V3 Configuration (`manifest.json`)
Configured to adhere strictly to Mozilla Firefox's Manifest V3 specifications:
- `browser_specific_settings.gecko.id`: Unique extension identifier (`aetheria-browser-agent@antigravity.internal`) with minimum Gecko version `109.0`.
- `sidebar_action`: Embeds the agent console directly into Firefox's persistent left sidebar.
- `web_accessible_resources`: Safely exposes badge overlay assets and local `pdfjs` worker scripts to web contexts.

#### 2. ReAct Execution Engine (`src/agent/react_engine.js`)
Maintains an internal finite state machine:
`IDLE` ➔ `RUNNING` ⇄ `WAITING_FOR_USER` / `PAUSED` ➔ `COMPLETED` / `ERROR`.
Each iteration executes:
1. Fetch latest DOM state from the active tab.
2. Build contextual prompt (incorporating system prompt, user profile, resume context, and history).
3. Request completion from LLM client.
4. Parse `Thought`, `Action`, and `Action Input`.
5. Execute matched tool via `browser_tools.js`.
6. Record observation and proceed to next step.

#### 3. Interactive Content Script (`src/content/content_script.js`)
Injected at `document_idle` on `<all_urls>`:
- Performs visibility checks (`display !== 'none'`, `visibility !== 'hidden'`, `opacity > 0`, non-zero bounding box).
- Assigns deterministic sequential integers to interactive targets.
- Dispatches synthetic mouse and keyboard events (`pointerdown`, `mousedown`, `input`, `change`, `keydown`, `keyup`, `submit`).
- Synthesizes `DataTransfer` file payload attachments to emulate native OS file pickers.

#### 4. Document & Context Manager (`src/context/doc_manager.js`)
Persists candidate profile data, resume plaintext, and crawled site knowledge in `browser.storage.local`. Automatically formats this structured information into concise prompt headers so the agent can accurately fill forms and address job application questions.

---

## 🛠️ Tool Registry & Agent Capabilities

Aetheria exposes 10 structured tools defined in `src/tools/tool_registry.js`:

| Tool Name | Parameters | Description |
| :--- | :--- | :--- |
| `click_element` | `element_id` *(number)* | Clicks an interactive element using its numeric badge ID. |
| `fill_form_field` | `element_id` *(number)*, `value` *(string)* | Types text into input fields, search boxes, or textareas. |
| `select_dropdown_option` | `element_id` *(number)*, `option_value` *(string)* | Selects an option inside a `<select>` dropdown element. |
| `upload_resume_file` | `element_id` *(number)* | Attaches the active resume file into an `<input type="file">`. |
| `scroll_page` | `direction` *('up' \| 'down')*, `amount` *(number)* | Scrolls the active tab view to reveal hidden content. |
| `navigate_to_url` | `url` *(string)* | Navigates the current tab to a specified destination URL. |
| `fetch_link_content` | `url` *(string)* | Fetches and cleans webpage text in background without leaving tab. |
| `wait_seconds` | `seconds` *(number)* | Pauses execution (1-10s) to allow AJAX/SPA rendering to settle. |
| `ask_user` | `question` *(string)*, `options` *(string[])* | Pauses the loop and presents an interactive clarification card. |
| `finish_task` | `summary` *(string)* | Terminates the loop with an executive summary of accomplishments. |

---

## 🧠 Supported LLM Providers

Aetheria features a pluggable, multi-provider LLM client (`src/agent/llm_client.js`) supporting both cloud APIs and local/self-hosted backends:

| Provider | Supported Models | Authentication | Notes |
| :--- | :--- | :--- | :--- |
| **Self-Hosted / vLLM** | `Qwen/Qwen2.5-1.5B-Instruct`, `Qwen/Qwen2.5-7B-Instruct` | Optional / Keyless | Compatible with ngrok tunnels & vLLM OpenAI-compatible endpoints |
| **OpenRouter** | `nex-agi/nex-n2.5-mini:free`, `meta-llama/llama-3.3-70b-instruct` | API Key (`sk-or-...`) | Access 200+ models via unified endpoint |
| **Google Gemini** | `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash` | API Key | Low-latency inference and high context capacity |
| **OpenAI** | `gpt-4o`, `gpt-4o-mini`, `o3-mini` | API Key (`sk-...`) | Industry-standard instruction following |
| **Anthropic** | `claude-3-5-sonnet-latest`, `claude-3-5-haiku-latest` | API Key (`sk-ant-...`) | Native support for detailed reasoning |
| **Local Ollama** | `qwen2.5:latest`, `llama3.2:latest`, `mistral` | None (`localhost:11434`) | 100% private, offline execution |

---

## 🚀 Installation & Firefox Setup

### 1. Load the Temporary Add-on

1. Launch **Mozilla Firefox** (or Firefox Developer Edition / Nightly).
2. Type the following URL into your address bar and press Enter:
   ```text
   about:debugging#/runtime/this-firefox
   ```
3. Locate the **Temporary Extensions** section at the top of the page.
4. Click the **Load Temporary Add-on...** button.
5. In the file picker dialog, navigate to the extension directory and select `manifest.json`:
   ```text
   C:\Users\hp\Documents\Web-Projects\firefox-browser-agent\manifest.json
   ```
6. Click **Open**. Firefox will load **Aetheria - Firefox ReAct Browser Agent** immediately.

### 2. Access the Aetheria Sidebar Console

- **Keyboard Shortcut**: Press `Ctrl + B` (Windows/Linux) or `Cmd + B` (macOS) to open the Firefox Sidebar, then choose **Aetheria Agent Console** from the dropdown menu.
- **Toolbar Action**: Click the glowing Aetheria icon in the Firefox browser navigation bar.

---

## 💡 Quick Start & Usage Guide

### Step 1: Configure Your Provider
1. Open the **Aetheria Sidebar**.
2. Click the **Settings** (gear icon) tab.
3. Select your desired AI provider (e.g., *Self-Hosted vLLM*, *Google Gemini*, or *OpenRouter*).
4. Enter your API key (if required by the selected provider) and custom endpoint URL.
5. Click **Save Configuration**.

### Step 2: Set Up Candidate Context (Optional but Recommended)
1. Navigate to the **Context Hub** tab in the sidebar.
2. Fill in your candidate details (Full Name, Email, Phone, LinkedIn, GitHub).
3. Upload your resume file (PDF, TXT, DOCX, or Markdown).
4. Enter your portfolio URL (e.g., `https://yourportfolio.dev`) and click **Crawl Site** to automatically index your projects.

### Step 3: Run an Autonomous Task
1. Navigate to any webpage (e.g., a job application, a research article, or a data form).
2. Open the **Agent Console** tab.
3. Enter your task description or click one of the suggested quick chips:
   > *"Fill out this application form using my uploaded resume, and ask me if any question is unclear."*
4. Click **Start Task**.
5. Observe the agent as it attaches numbered badges to the page, reasons through each step, and carries out form inputs and uploads.

---

## 🧪 Testing & Validation

### Automated Unit Validation
The repository includes a standalone test suite verifying core component contracts without requiring browser mocks:

```bash
# Run core agent unit tests
node test/test_agent_core.mjs
```

Expected output:
```text
--- Running Aetheria Agent Core Validation ---
Verifying Tool Definitions (10 tools)...
✓ Tool Registry validated successfully.
Verifying ReAct Response Parser...
✓ ReAct Response Parser verified successfully.
Verifying Crawler URL domain checks...
✓ Domain Crawler URL resolution verified successfully.

✅ All core agent unit checks passed!
```

### End-to-End Interactive Testing
To test the complete visual execution loop locally:
1. Open the bundled test form in Firefox:
   ```text
   file:///C:/Users/hp/Documents/Web-Projects/firefox-browser-agent/test/job_application_demo.html
   ```
2. Open the Aetheria Sidebar (`Ctrl + B`).
3. Click the prompt chip: *"Analyze this job posting, check if my profile matches, and fill out the application form with my resume."*
4. Click **Start Task** and verify badge numbering, input typing, select dropdown handling, and resume attachment.

### Icon Generation Script
To re-generate crisp, high-resolution PNG icons directly from mathematical buffers without external graphics tools:
```bash
node generate_icons.mjs
```

---

## 🔐 Permissions Reference

Aetheria requests only the minimum necessary permissions required for autonomous browser interaction:

| Permission | Purpose |
| :--- | :--- |
| `activeTab` | Grants temporary execution access to the foreground tab upon user interaction. |
| `tabs` | Allows querying the active tab status, URL, and window dimensions. |
| `scripting` | Enables programmatic content script injection when dynamic pages mount. |
| `storage` | Stores user settings, LLM provider configurations, and parsed documents locally. |
| `unlimitedStorage` | Accommodates large parsed PDF documents and crawled website indexes. |
| `webNavigation` | Detects page route transitions and SPA navigation events. |
| `<all_urls>` *(Host)* | Allows the content script and crawler to inspect requested user target domains. |

---

## 🛡️ Security & Privacy Guardrails

- **Client-Side Privacy**: All candidate profiles, resumes, and crawled website context reside strictly inside your local browser via `browser.storage.local`. No data is uploaded to third-party telemetry servers.
- **Human-in-the-Loop Safe Mode**: Critical decisions, payment forms, terms agreements, and ambiguous form fields are gated behind explicit `ask_user` tool invocations.
- **No Remote Code Execution**: Content scripts run within standard browser security boundaries and communicate via strongly-typed WebExtension message channels.

---

## 💻 Development Workflows

### Prerequisites
- Node.js (v18.0.0 or higher recommended)
- Mozilla Firefox (v109.0 or higher)

### Hot Reloading during Development
When editing files in `src/`:
- **Content Scripts & Sidebar**: Simply close and re-open the sidebar or reload the active tab (`Ctrl + R`).
- **Manifest or Background Scripts**: Navigate to `about:debugging#/runtime/this-firefox` and click the **Reload** button next to Aetheria.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository: `https://github.com/Gifted87/firefox-browser-agent`.
2. Create a feature branch: `git checkout -b feat/my-new-feature`.
3. Commit your changes: `git commit -m "feat: implement enhanced selector engine"`.
4. Ensure all tests pass: `node test/test_agent_core.mjs`.
5. Push to your branch: `git push origin feat/my-new-feature`.
6. Open a Pull Request.

---

## 📜 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for full details.

---

<p align="center">
  Built with precision for the open web and the Mozilla Firefox ecosystem.
</p>
