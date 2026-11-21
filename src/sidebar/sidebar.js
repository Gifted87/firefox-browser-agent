/**
 * Aetheria Agent - Sidebar Controller
 */
import { ReActEngine, AgentStatus } from '../agent/react_engine.js';
import { BrowserTools } from '../tools/browser_tools.js';
import { contextManager } from '../context/doc_manager.js';
import { DocumentReader } from '../utils/pdf_reader.js';
import { StorageService } from '../context/storage.js';
import { logger } from '../utils/logger.js';

// DOM Elements Cache
const elements = {
  // Tabs
  navTabs: document.querySelectorAll('.nav-tab'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  contextCountBadge: document.getElementById('contextCountBadge'),

  // Header & Status
  agentRadar: document.getElementById('agentRadar'),
  agentStatusText: document.getElementById('agentStatusText'),
  currentTabTitle: document.getElementById('currentTabTitle'),
  btnRefreshTab: document.getElementById('btnRefreshTab'),

  // Agent Console
  taskInput: document.getElementById('taskInput'),
  btnStartTask: document.getElementById('btnStartTask'),
  btnStopTask: document.getElementById('btnStopTask'),
  executionFeed: document.getElementById('executionFeed'),
  feedEmptyState: document.getElementById('feedEmptyState'),
  activeResumeIndicator: document.getElementById('activeResumeIndicator'),
  contextIndicator: document.getElementById('contextIndicator'),
  promptChips: document.querySelectorAll('.prompt-chip'),

  // Ask User Card
  askUserCard: document.getElementById('askUserCard'),
  askUserQuestionText: document.getElementById('askUserQuestionText'),
  askUserOptionsContainer: document.getElementById('askUserOptionsContainer'),
  askUserCustomInput: document.getElementById('askUserCustomInput'),
  btnSubmitUserAnswer: document.getElementById('btnSubmitUserAnswer'),

  // Context Hub - Crawler
  portfolioUrlInput: document.getElementById('portfolioUrlInput'),
  btnStartCrawl: document.getElementById('btnStartCrawl'),
  crawlerStatusBar: document.getElementById('crawlerStatusBar'),
  crawlerProgressTitle: document.getElementById('crawlerProgressTitle'),
  crawlerProgressSub: document.getElementById('crawlerProgressSub'),
  crawledDomainsList: document.getElementById('crawledDomainsList'),

  // Context Hub - Documents
  uploadDropzone: document.getElementById('uploadDropzone'),
  fileInput: document.getElementById('fileInput'),
  documentList: document.getElementById('documentList'),

  // Context Hub - Profile
  profileForm: document.getElementById('profileForm'),
  profFullName: document.getElementById('profFullName'),
  profEmail: document.getElementById('profEmail'),
  profPhone: document.getElementById('profPhone'),
  profLocation: document.getElementById('profLocation'),
  profLinkedin: document.getElementById('profLinkedin'),
  profGithub: document.getElementById('profGithub'),
  profTitle: document.getElementById('profTitle'),
  profExperience: document.getElementById('profExperience'),
  profSkills: document.getElementById('profSkills'),
  profBio: document.getElementById('profBio'),

  // DOM Inspector
  btnScanDom: document.getElementById('btnScanDom'),
  btnClearDomBadges: document.getElementById('btnClearDomBadges'),
  statElementCount: document.getElementById('statElementCount'),
  statInputsCount: document.getElementById('statInputsCount'),
  statButtonsCount: document.getElementById('statButtonsCount'),
  elementsTreeView: document.getElementById('elementsTreeView'),

  // Settings
  settingsProvider: document.getElementById('settingsProvider'),
  settingsApiKey: document.getElementById('settingsApiKey'),
  btnToggleApiKey: document.getElementById('btnToggleApiKey'),
  settingsModel: document.getElementById('settingsModel'),
  settingsBaseUrl: document.getElementById('settingsBaseUrl'),
  baseUrlGroup: document.getElementById('baseUrlGroup'),
  settingsMaxSteps: document.getElementById('settingsMaxSteps'),
  btnSaveSettings: document.getElementById('btnSaveSettings'),
  modelPresets: document.querySelectorAll('.preset-pill'),

  // System Logs
  systemLogsContainer: document.getElementById('systemLogsContainer')
};

// State
let reactEngine = null;
let currentSettings = {
  provider: 'self_hosted',
  apiKey: '',
  model: 'Qwen/Qwen2.5-1.5B-Instruct',
  baseUrl: 'https://rippling-deck-emu.ngrok-free.dev',
  maxSteps: 25
};

// Initialize Controller
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  initTabs();
  initAgentEngine();
  await refreshActiveTabDisplay();
  await refreshContextDisplays();
  await loadProfile();
  bindEvents();
  initLogStream();
});

function initLogStream() {
  logger.addListener((logEvent) => {
    const el = document.createElement('div');
    el.className = `log-entry log-${logEvent.level}`;
    
    let argsStr = '';
    if (logEvent.args && logEvent.args.length > 0) {
      argsStr = ' ' + logEvent.args.map(a => {
        if (a instanceof Error) return a.message + (a.stack ? '\\n' + a.stack : '');
        return typeof a === 'object' ? JSON.stringify(a) : String(a);
      }).join(' ');
    }
    
    el.innerHTML = `
      <span class="log-time">[${logEvent.timestamp}]</span>
      <span class="log-level">[${logEvent.level.toUpperCase()}]</span>
      <span class="log-msg">${escapeHtml(logEvent.message)}${escapeHtml(argsStr)}</span>
    `;
    
    elements.systemLogsContainer.appendChild(el);
    elements.systemLogsContainer.scrollTop = elements.systemLogsContainer.scrollHeight;
  });
}

// --- Tab Navigation ---
function initTabs() {
  elements.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;

      elements.navTabs.forEach(t => t.classList.remove('active'));
      elements.tabPanes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });
}

// --- Active Tab Polling ---
async function refreshActiveTabDisplay() {
  try {
    const tab = await BrowserTools.getActiveTab();
    if (tab) {
      elements.currentTabTitle.textContent = tab.title || tab.url || 'Active Tab';
      elements.currentTabTitle.title = tab.url || '';
    } else {
      elements.currentTabTitle.textContent = 'No tab detected';
    }
  } catch {
    elements.currentTabTitle.textContent = 'Ready';
  }
}

// --- Settings Management ---
async function loadSettings() {
  const saved = await StorageService.get('aetheria_settings');
  if (saved) {
    currentSettings = { ...currentSettings, ...saved };
  }

  elements.settingsProvider.value = currentSettings.provider;
  elements.settingsApiKey.value = currentSettings.apiKey;
  elements.settingsModel.value = currentSettings.model;
  elements.settingsBaseUrl.value = currentSettings.baseUrl || '';
  elements.settingsMaxSteps.value = currentSettings.maxSteps || 25;

  toggleBaseUrlVisibility();
}

async function saveSettings() {
  currentSettings = {
    provider: elements.settingsProvider.value,
    apiKey: elements.settingsApiKey.value.trim(),
    model: elements.settingsModel.value.trim(),
    baseUrl: elements.settingsBaseUrl.value.trim(),
    maxSteps: Number(elements.settingsMaxSteps.value) || 25
  };

  await StorageService.set('aetheria_settings', currentSettings);
  if (reactEngine) {
    reactEngine.updateLLMConfig(currentSettings);
    reactEngine.maxSteps = currentSettings.maxSteps;
  }

  alert('Settings saved successfully!');
}

function toggleBaseUrlVisibility() {
  const isOllama = elements.settingsProvider.value === 'ollama';
  elements.baseUrlGroup.style.display = isOllama ? 'flex' : 'none';
}

// --- ReAct Engine Integration ---
function initAgentEngine() {
  reactEngine = new ReActEngine(currentSettings);
  reactEngine.maxSteps = currentSettings.maxSteps;

  reactEngine.on('onStatusChange', ({ status, step }) => {
    updateRadar(status);
  });

  reactEngine.on('onStep', (data) => {
    renderStepCard(data);
  });

  reactEngine.on('onAskUser', ({ question, options }) => {
    showAskUserCard(question, options);
  });

  reactEngine.on('onFinish', ({ summary, totalSteps }) => {
    renderFinishCard(summary, totalSteps);
    setTaskRunningUI(false);
  });

  reactEngine.on('onError', ({ error }) => {
    renderErrorCard(error);
    setTaskRunningUI(false);
  });
}

function updateRadar(status) {
  elements.agentRadar.className = 'agent-radar';

  switch (status) {
    case AgentStatus.RUNNING:
      elements.agentRadar.classList.add('running');
      elements.agentStatusText.textContent = `Reasoning (${reactEngine.currentStep})...`;
      break;
    case AgentStatus.WAITING_FOR_USER:
      elements.agentRadar.classList.add('waiting');
      elements.agentStatusText.textContent = 'Waiting for User';
      break;
    case AgentStatus.COMPLETED:
      elements.agentRadar.classList.add('completed');
      elements.agentStatusText.textContent = 'Task Finished';
      break;
    case AgentStatus.ERROR:
      elements.agentStatusText.textContent = 'Agent Error';
      break;
    default:
      elements.agentStatusText.textContent = 'Idle';
  }
}

function setTaskRunningUI(isRunning) {
  elements.btnStartTask.style.display = isRunning ? 'none' : 'inline-flex';
  elements.btnStopTask.style.display = isRunning ? 'inline-flex' : 'none';
  elements.taskInput.disabled = isRunning;
}

// --- ReAct Stream UI Rendering ---
function renderStepCard(data) {
  if (elements.feedEmptyState) {
    elements.feedEmptyState.style.display = 'none';
  }

  // If observation update to existing step
  let existingCard = document.getElementById(`step-card-${data.step}`);
  if (!existingCard) {
    existingCard = document.createElement('div');
    existingCard.id = `step-card-${data.step}`;
    existingCard.className = 'step-card';

    const header = document.createElement('div');
    header.className = 'step-card-header';
    header.innerHTML = `
      <span class="step-badge">STEP ${data.step}</span>
      <span class="action-pill">${escapeHtml(data.action || 'processing')}</span>
    `;
    existingCard.appendChild(header);

    if (data.thought) {
      const thoughtBox = document.createElement('div');
      thoughtBox.className = 'thought-box';
      thoughtBox.textContent = data.thought;
      existingCard.appendChild(thoughtBox);
    }

    elements.executionFeed.appendChild(existingCard);
  }

  if (data.observation) {
    let obsBox = existingCard.querySelector('.observation-box');
    if (!obsBox) {
      obsBox = document.createElement('div');
      obsBox.className = 'observation-box';
      existingCard.appendChild(obsBox);
    }
    obsBox.textContent = data.observation;
  }

  elements.executionFeed.scrollTop = elements.executionFeed.scrollHeight;
}

function renderFinishCard(summary, totalSteps) {
  const card = document.createElement('div');
  card.className = 'finish-card';
  card.innerHTML = `
    <h4>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      Task Accomplished (${totalSteps} steps)
    </h4>
    <p>${escapeHtml(summary)}</p>
  `;
  elements.executionFeed.appendChild(card);
  elements.executionFeed.scrollTop = elements.executionFeed.scrollHeight;
}

function renderErrorCard(errorMsg) {
  const card = document.createElement('div');
  card.className = 'finish-card';
  card.style.borderColor = 'rgba(244, 63, 94, 0.5)';
  card.style.background = 'linear-gradient(135deg, rgba(244, 63, 94, 0.15), rgba(17, 24, 39, 0.9))';
  card.innerHTML = `
    <h4 style="color: #f43f5e;">Task Interrupted</h4>
    <p>${escapeHtml(errorMsg)}</p>
  `;
  elements.executionFeed.appendChild(card);
  elements.executionFeed.scrollTop = elements.executionFeed.scrollHeight;
}

// --- Human In The Loop (Ask User) UI ---
function showAskUserCard(question, options = []) {
  elements.askUserQuestionText.textContent = question;
  elements.askUserOptionsContainer.innerHTML = '';
  elements.askUserCustomInput.value = '';

  if (options && options.length > 0) {
    options.forEach(opt => {
      const chip = document.createElement('button');
      chip.className = 'option-chip';
      chip.textContent = opt;
      chip.addEventListener('click', () => {
        submitUserAnswer(opt);
      });
      elements.askUserOptionsContainer.appendChild(chip);
    });
  }

  elements.askUserCard.style.display = 'block';
  elements.askUserCustomInput.focus();
}

function submitUserAnswer(answer) {
  if (!answer || !answer.trim()) return;
  elements.askUserCard.style.display = 'none';
  if (reactEngine) {
    reactEngine.submitUserAnswer(answer.trim());
  }
}

// --- Context Hub: Crawled Portfolio Ingestion ---
async function startPortfolioCrawl() {
  const url = elements.portfolioUrlInput.value.trim();
  if (!url) {
    alert('Please enter a valid website or portfolio URL.');
    return;
  }

  elements.btnStartCrawl.disabled = true;
  elements.crawlerStatusBar.style.display = 'flex';
  elements.crawlerProgressTitle.textContent = 'Initializing domain crawler...';
  elements.crawlerProgressSub.textContent = 'Connecting to ' + url;

  try {
    await contextManager.crawlAndAddPortfolio(url, (progress) => {
      if (progress.status === 'crawling') {
        elements.crawlerProgressTitle.textContent = `Crawling ${progress.domain} (Page ${progress.processedCount})`;
        elements.crawlerProgressSub.textContent = progress.currentUrl;
      } else if (progress.status === 'completed') {
        elements.crawlerProgressTitle.textContent = `Done! Crawled ${progress.totalPages} pages.`;
        elements.crawlerProgressSub.textContent = 'Extracted text saved to agent context.';
      }
    });

    elements.portfolioUrlInput.value = '';
    setTimeout(() => {
      elements.crawlerStatusBar.style.display = 'none';
      elements.btnStartCrawl.disabled = false;
    }, 2500);

    await refreshContextDisplays();
  } catch (err) {
    alert(`Crawl failed: ${err.message}`);
    elements.crawlerStatusBar.style.display = 'none';
    elements.btnStartCrawl.disabled = false;
  }
}

async function renderCrawledDomainsList() {
  const domains = await contextManager.getCrawledDomains();
  elements.crawledDomainsList.innerHTML = '';

  if (domains.length === 0) {
    elements.crawledDomainsList.innerHTML = `
      <div style="font-size: 11.5px; color: var(--text-dim); text-align: center; padding: 6px 0;">
        No portfolio domains crawled yet. Add a URL above to index your project site!
      </div>
    `;
    return;
  }

  domains.forEach(dom => {
    const item = document.createElement('div');
    item.className = 'crawled-domain-item';
    item.innerHTML = `
      <div class="crawled-domain-info">
        <span class="domain-host">🌐 ${escapeHtml(dom.domain)}</span>
        <span class="domain-meta">${dom.totalPages} pages indexed • ${new Date(dom.crawledAt).toLocaleDateString()}</span>
      </div>
      <button class="btn-icon btn-delete-domain" title="Remove Crawled Domain" data-id="${dom.id}">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    `;

    item.querySelector('.btn-delete-domain').addEventListener('click', async () => {
      await contextManager.removeCrawledDomain(dom.id);
      await refreshContextDisplays();
    });

    elements.crawledDomainsList.appendChild(item);
  });
}

// --- Context Hub: Document & Resume Management ---
async function handleFilesUpload(files) {
  if (!files || files.length === 0) return;

  for (const file of files) {
    try {
      const docData = await DocumentReader.readFile(file);
      await contextManager.addDocument(docData);
    } catch (err) {
      alert(`Error reading ${file.name}: ${err.message}`);
    }
  }

  await refreshContextDisplays();
}

async function renderDocumentList() {
  const docs = await contextManager.getDocuments();
  const activeResume = await contextManager.getActiveResume();
  elements.documentList.innerHTML = '';

  if (docs.length === 0) {
    elements.documentList.innerHTML = `
      <div style="font-size: 11.5px; color: var(--text-dim); text-align: center; padding: 6px 0;">
        No documents uploaded yet. Upload your resume for auto-applying!
      </div>
    `;
    elements.activeResumeIndicator.textContent = 'No resume attached';
    elements.contextIndicator.classList.remove('active');
    return;
  }

  if (activeResume) {
    elements.activeResumeIndicator.textContent = `Active: ${activeResume.name}`;
    elements.contextIndicator.classList.add('active');
  }

  docs.forEach(doc => {
    const isActive = activeResume && activeResume.id === doc.id;
    const item = document.createElement('div');
    item.className = `doc-item ${isActive ? 'active-resume' : ''}`;

    item.innerHTML = `
      <div class="doc-info">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <span class="doc-name" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</span>
        ${isActive ? '<span class="active-resume-badge">DEFAULT</span>' : ''}
      </div>
      <div class="btn-group">
        ${!isActive ? `<button class="btn-icon btn-set-active" title="Set as Active Resume" data-id="${doc.id}">⭐</button>` : ''}
        <button class="btn-icon btn-delete-doc" title="Delete Document" data-id="${doc.id}">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    `;

    const btnActive = item.querySelector('.btn-set-active');
    if (btnActive) {
      btnActive.addEventListener('click', async () => {
        await contextManager.setActiveResume(doc.id);
        await refreshContextDisplays();
      });
    }

    item.querySelector('.btn-delete-doc').addEventListener('click', async () => {
      await contextManager.removeDocument(doc.id);
      await refreshContextDisplays();
    });

    elements.documentList.appendChild(item);
  });
}

async function refreshContextDisplays() {
  const docs = await contextManager.getDocuments();
  const domains = await contextManager.getCrawledDomains();
  elements.contextCountBadge.textContent = docs.length + domains.length;

  await renderDocumentList();
  await renderCrawledDomainsList();
}

// --- Candidate Profile ---
async function loadProfile() {
  const prof = await contextManager.getProfile();
  elements.profFullName.value = prof.fullName || '';
  elements.profEmail.value = prof.email || '';
  elements.profPhone.value = prof.phone || '';
  elements.profLocation.value = prof.location || '';
  elements.profLinkedin.value = prof.linkedinUrl || '';
  elements.profGithub.value = prof.githubUrl || '';
  elements.profTitle.value = prof.currentTitle || '';
  elements.profExperience.value = prof.yearsOfExperience || '';
  elements.profSkills.value = prof.skills || '';
  elements.profBio.value = prof.bioSummary || '';
}

async function saveProfile(e) {
  e.preventDefault();
  const updated = {
    fullName: elements.profFullName.value.trim(),
    email: elements.profEmail.value.trim(),
    phone: elements.profPhone.value.trim(),
    location: elements.profLocation.value.trim(),
    linkedinUrl: elements.profLinkedin.value.trim(),
    githubUrl: elements.profGithub.value.trim(),
    currentTitle: elements.profTitle.value.trim(),
    yearsOfExperience: elements.profExperience.value.trim(),
    skills: elements.profSkills.value.trim(),
    bioSummary: elements.profBio.value.trim()
  };

  await contextManager.updateProfile(updated);
  alert('Candidate profile updated! The agent will use this information to autofill forms.');
}

// --- DOM Inspector Tab ---
async function scanPageDom() {
  try {
    const tab = await BrowserTools.getActiveTab();
    if (!tab) {
      alert('No active browser tab found.');
      return;
    }

    const state = await BrowserTools.getDomState(tab.id);
    elements.statElementCount.textContent = state.elements.length;

    const inputs = state.elements.filter(e => ['input', 'textarea', 'select'].includes(e.tag));
    const buttons = state.elements.filter(e => e.tag === 'button' || e.role === 'button');

    elements.statInputsCount.textContent = inputs.length;
    elements.statButtonsCount.textContent = buttons.length;

    elements.elementsTreeView.innerHTML = '';
    state.elements.forEach(el => {
      const row = document.createElement('div');
      row.className = 'tree-element-row';
      row.innerHTML = `
        <span class="tree-badge">#${el.id}</span>
        <span class="tree-tag">&lt;${el.tag}&gt;</span>
        <span class="tree-label">${escapeHtml(el.label || el.value || el.name || '')}</span>
      `;
      elements.elementsTreeView.appendChild(row);
    });
  } catch (err) {
    alert(`DOM scan failed: ${err.message}`);
  }
}

async function clearDomBadges() {
  try {
    const tab = await BrowserTools.getActiveTab();
    if (tab) {
      await BrowserTools.clearHighlights(tab.id);
      elements.elementsTreeView.innerHTML = '<div class="tree-empty-hint">Badges cleared from page.</div>';
      elements.statElementCount.textContent = '0';
      elements.statInputsCount.textContent = '0';
      elements.statButtonsCount.textContent = '0';
    }
  } catch (err) {
    console.warn(err);
  }
}

// --- Event Listeners ---
function bindEvents() {
  // Start Task
  elements.btnStartTask.addEventListener('click', async () => {
    const task = elements.taskInput.value.trim();
    if (!task) {
      alert('Please enter a task instruction.');
      return;
    }

    setTaskRunningUI(true);
    try {
      await reactEngine.startTask(task);
    } catch (err) {
      alert(`Could not start task: ${err.message}`);
      setTaskRunningUI(false);
    }
  });

  // Stop Task
  elements.btnStopTask.addEventListener('click', async () => {
    await reactEngine.stopTask();
    setTaskRunningUI(false);
  });

  // Quick Prompt Chips
  elements.promptChips.forEach(chip => {
    chip.addEventListener('click', () => {
      elements.taskInput.value = chip.dataset.prompt;
      elements.taskInput.focus();
    });
  });

  // Ask User Submit
  elements.btnSubmitUserAnswer.addEventListener('click', () => {
    submitUserAnswer(elements.askUserCustomInput.value);
  });

  elements.askUserCustomInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      submitUserAnswer(elements.askUserCustomInput.value);
    }
  });

  // Refresh tab
  elements.btnRefreshTab.addEventListener('click', refreshActiveTabDisplay);

  // Crawler
  elements.btnStartCrawl.addEventListener('click', startPortfolioCrawl);
  elements.portfolioUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startPortfolioCrawl();
  });

  // File Upload
  elements.uploadDropzone.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', (e) => handleFilesUpload(e.target.files));

  elements.uploadDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.uploadDropzone.classList.add('dragover');
  });

  elements.uploadDropzone.addEventListener('dragleave', () => {
    elements.uploadDropzone.classList.remove('dragover');
  });

  elements.uploadDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.uploadDropzone.classList.remove('dragover');
    handleFilesUpload(e.dataTransfer.files);
  });

  // Profile
  elements.profileForm.addEventListener('submit', saveProfile);

  // DOM Inspector
  elements.btnScanDom.addEventListener('click', scanPageDom);
  elements.btnClearDomBadges.addEventListener('click', clearDomBadges);

  // Settings
  elements.btnSaveSettings.addEventListener('click', saveSettings);
  elements.settingsProvider.addEventListener('change', () => {
    toggleBaseUrlVisibility();
    const prov = elements.settingsProvider.value;
    if (prov === 'self_hosted') {
      elements.settingsModel.value = 'Qwen/Qwen2.5-1.5B-Instruct';
      elements.settingsBaseUrl.value = 'https://rippling-deck-emu.ngrok-free.dev';
    } else if (prov === 'openrouter') {
      elements.settingsModel.value = 'nex-agi/nex-n2.5-mini:free';
      elements.settingsBaseUrl.value = 'https://openrouter.ai/api/v1/chat/completions';
    } else if (prov === 'gemini') {
      elements.settingsModel.value = 'gemini-1.5-flash';
    } else if (prov === 'openai') {
      elements.settingsModel.value = 'gpt-4o-mini';
    } else if (prov === 'anthropic') {
      elements.settingsModel.value = 'claude-3-5-sonnet-latest';
    } else if (prov === 'ollama') {
      elements.settingsModel.value = 'llama3';
    }
  });

  elements.btnToggleApiKey.addEventListener('click', () => {
    const type = elements.settingsApiKey.type === 'password' ? 'text' : 'password';
    elements.settingsApiKey.type = type;
  });

  elements.modelPresets.forEach(preset => {
    preset.addEventListener('click', () => {
      elements.settingsModel.value = preset.dataset.model;
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
