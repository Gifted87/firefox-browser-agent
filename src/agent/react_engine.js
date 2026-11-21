/**
 * Aetheria ReAct Execution Loop Engine
 * Orchestrates Thought -> Action -> Tool Execution -> Observation -> Step Iteration
 * with interactive Human-in-the-Loop pause/resume capabilities.
 */
import { PromptBuilder } from './prompt_builder.js';
import { BrowserTools } from '../tools/browser_tools.js';
import { contextManager } from '../context/doc_manager.js';
import { LLMClient } from './llm_client.js';
import { logger } from '../utils/logger.js';

export const AgentStatus = {
  IDLE: 'idle',
  RUNNING: 'running',
  WAITING_FOR_USER: 'waiting_for_user',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ERROR: 'error'
};

export class ReActEngine {
  constructor(llmConfig = {}) {
    this.llmClient = new LLMClient(llmConfig);
    this.status = AgentStatus.IDLE;
    this.maxSteps = 25;
    this.currentStep = 0;
    this.currentTask = '';
    this.activeTabId = null;
    this.systemPrompt = '';
    this.stepHistory = [];
    this.pendingUserQuestionPromise = null;
    this.abortController = null;

    // Event listeners
    this.listeners = {
      onStatusChange: [],
      onStep: [],
      onAskUser: [],
      onFinish: [],
      onError: []
    };
  }

  updateLLMConfig(config) {
    this.llmClient = new LLMClient(config);
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try { cb(data); } catch (e) { console.error('Listener error:', e); }
      });
    }
  }

  setStatus(newStatus) {
    this.status = newStatus;
    this.emit('onStatusChange', { status: newStatus, step: this.currentStep });
  }

  /**
   * Starts an autonomous ReAct task
   */
  async startTask(taskGoal) {
    if (this.status === AgentStatus.RUNNING) {
      throw new Error('An agent task is already running.');
    }

    this.currentTask = taskGoal;
    this.currentStep = 0;
    this.setStatus(AgentStatus.RUNNING);
    this.abortController = new AbortController();

    try {
      // 1. Identify active tab
      const activeTab = await BrowserTools.getActiveTab();
      if (!activeTab || !activeTab.id) {
        throw new Error('No active browser tab found to inspect.');
      }
      this.activeTabId = activeTab.id;

      // 2. Compile starting knowledge base context (documents + crawled portfolio domains)
      const userMasterContext = await contextManager.getCompiledStartingContext();

      // 3. Initialize system prompt and clear history
      this.systemPrompt = PromptBuilder.buildSystemPrompt(userMasterContext);
      this.stepHistory = [];

      logger.info(`Starting task: "${taskGoal}" on tab [${activeTab.id}]`);

      // 4. Run the ReAct Loop
      await this.runLoop();

    } catch (err) {
      logger.error('ReAct Engine encountered an error:', err);
      this.setStatus(AgentStatus.ERROR);
      this.emit('onError', { error: err.message });
      if (this.activeTabId) {
        await BrowserTools.clearHighlights(this.activeTabId);
      }
    }
  }

  /**
   * Main ReAct Loop
   */
  async runLoop() {
    while (this.currentStep < this.maxSteps && this.status === AgentStatus.RUNNING) {
      this.currentStep++;
      logger.info(`--- Step ${this.currentStep} of ${this.maxSteps} ---`);

      // A. Extract current DOM state from active tab
      let domState;
      try {
        domState = await BrowserTools.getDomState(this.activeTabId);
      } catch (domErr) {
        logger.warn('Could not extract active DOM state:', domErr.message);
        domState = { title: 'Unknown', url: 'unknown', elements: [], readableTextSnippet: '' };
      }

      // B. Build user message for this step
      const stepPrompt = PromptBuilder.buildStepUserMessage(this.currentTask, domState, this.currentStep);
      
      // Token budget: use 3 chars/token (conservative). Context limit = 16384.
      const CONTEXT_LIMIT = 32768;
      const OUTPUT_RESERVE = 1500; // reserve for model response
      const BUDGET = CONTEXT_LIMIT - OUTPUT_RESERVE; // ~14884 tokens to fill
      const cpt = 3; // chars per token

      const estimateTokens = (str) => Math.ceil((str || '').length / cpt);

      // 1. Always send full system prompt + current DOM. Measure their real cost.
      const systemTokens = estimateTokens(this.systemPrompt);
      const stepTokens = estimateTokens(stepPrompt);
      const baseTokens = systemTokens + stepTokens;

      // 2. Fill remaining budget greedily with history (newest first)
      let historyBudget = BUDGET - baseTokens;
      const recentHistory = [];

      for (let i = this.stepHistory.length - 1; i >= 0; i--) {
        const h = this.stepHistory[i];
        const cost = estimateTokens(h.rawResponse) + estimateTokens(h.observation) + 60;
        if (cost <= historyBudget) {
          recentHistory.unshift(h);
          historyBudget -= cost;
        } else {
          break; // no more room for older history
        }
      }

      const usedTokens = BUDGET - historyBudget;
      logger.info(`Context: ~${usedTokens} tokens used (system=${systemTokens}, dom=${stepTokens}, ${recentHistory.length} history steps, ${this.stepHistory.length - recentHistory.length} dropped)`);

      // 3. Build llmMessages — system prompt + interleaved history + current step
      const llmMessages = [
        { role: 'system', content: this.systemPrompt }
      ];

      for (let i = 0; i < recentHistory.length; i++) {
        const h = recentHistory[i];
        const userContent = i === 0
          ? `[Step ${h.step} DOM omitted from history]`
          : `Observation from step ${recentHistory[i-1].step}: ${recentHistory[i-1].observation}`;
        llmMessages.push({ role: 'user', content: userContent });
        llmMessages.push({ role: 'assistant', content: h.rawResponse });
      }

      let currentUserContent = '';
      if (recentHistory.length > 0) {
        const lastH = recentHistory[recentHistory.length - 1];
        currentUserContent = `Observation from step ${lastH.step}: ${lastH.observation}\n\n`;
      }
      currentUserContent += stepPrompt;
      llmMessages.push({ role: 'user', content: currentUserContent });

      // C. Query LLM
      let responseText = '';
      try {
        const response = await this.llmClient.chat(llmMessages);
        responseText = response.content;
      } catch (llmErr) {
        throw new Error(`LLM call failed: ${llmErr.message}`);
      }

      // D. Parse Thought and Action
      const parsed = PromptBuilder.parseReActResponse(responseText);
      logger.info('Agent Thought:', parsed.thought);
      logger.info(`Agent Action: ${parsed.action}`, parsed.actionInput);

      // Notify UI
      this.emit('onStep', {
        step: this.currentStep,
        thought: parsed.thought,
        action: parsed.action,
        actionInput: parsed.actionInput,
        raw: responseText
      });

      // E. Check for Task Completion
      if (parsed.action === 'finish_task') {
        const summary = parsed.actionInput?.summary || parsed.thought || 'Task finished successfully.';
        this.setStatus(AgentStatus.COMPLETED);
        this.emit('onFinish', { summary, totalSteps: this.currentStep });
        await BrowserTools.clearHighlights(this.activeTabId);
        return;
      }

      // F. Check for Human Interaction (ask_user)
      if (parsed.action === 'ask_user') {
        const question = parsed.actionInput?.question || 'The agent needs your input to continue.';
        const options = parsed.actionInput?.options || [];

        this.setStatus(AgentStatus.WAITING_FOR_USER);
        this.emit('onAskUser', { question, options, step: this.currentStep });

        // Wait for human response
        const userAnswer = await new Promise((resolve) => {
          this.pendingUserQuestionPromise = resolve;
        });

        this.setStatus(AgentStatus.RUNNING);

        const observation = `User Answer: "${userAnswer}"`;
        this.stepHistory.push({
          step: this.currentStep,
          rawResponse: responseText,
          observation: observation
        });

        this.emit('onStep', {
          step: this.currentStep,
          observation
        });

        continue;
      }

      // G. Execute Browser Tool
      let observation = '';
      try {
        observation = await this.executeTool(parsed.action, parsed.actionInput);
      } catch (toolErr) {
        observation = `Tool Execution Error: ${toolErr.message}. Adjust your plan or choose an alternative action.`;
        logger.warn(observation);
      }

      logger.info('Tool Observation:', observation);

      // Record this step into history
      this.stepHistory.push({
        step: this.currentStep,
        rawResponse: responseText,
        observation: observation
      });

      this.emit('onStep', {
        step: this.currentStep,
        observation
      });

      // Short breathing pause for visual feedback
      await new Promise(r => setTimeout(r, 600));
    }

    if (this.currentStep >= this.maxSteps && this.status === AgentStatus.RUNNING) {
      const summary = `Task paused: reached maximum step limit of ${this.maxSteps}. You can ask the agent to continue or refine your instruction.`;
      this.setStatus(AgentStatus.COMPLETED);
      this.emit('onFinish', { summary, totalSteps: this.currentStep });
      await BrowserTools.clearHighlights(this.activeTabId);
    }
  }

  /**
   * Tool execution dispatcher
   */
  async executeTool(actionName, input) {
    const tabId = this.activeTabId;

    switch (actionName) {
      case 'click_element': {
        const id = input.element_id ?? input.id ?? input.elementId;
        return await BrowserTools.clickElement(tabId, id);
      }

      case 'fill_form_field': {
        const id = input.element_id ?? input.id ?? input.elementId;
        const val = input.value ?? input.text ?? '';
        return await BrowserTools.fillFormField(tabId, id, val);
      }

      case 'select_dropdown_option': {
        const id = input.element_id ?? input.id;
        const opt = input.option_value ?? input.value ?? '';
        return await BrowserTools.selectDropdownOption(tabId, id, opt);
      }

      case 'upload_resume_file': {
        const id = input.element_id ?? input.id;
        return await BrowserTools.uploadResumeFile(tabId, id);
      }

      case 'scroll_page': {
        const dir = input.direction || 'down';
        const amt = input.amount || 450;
        return await BrowserTools.scrollPage(tabId, dir, amt);
      }

      case 'navigate_to_url': {
        return await BrowserTools.navigateToUrl(tabId, input.url);
      }

      case 'fetch_link_content': {
        return await BrowserTools.fetchLinkContent(input.url);
      }

      case 'wait_seconds': {
        return await BrowserTools.waitSeconds(input.seconds || 2);
      }

      default:
        return `Unknown tool "${actionName}". Available tools: click_element, fill_form_field, select_dropdown_option, upload_resume_file, scroll_page, navigate_to_url, fetch_link_content, wait_seconds, ask_user, finish_task.`;
    }
  }

  /**
   * Resolves the pending user question when user answers via UI
   */
  submitUserAnswer(answer) {
    if (this.pendingUserQuestionPromise) {
      const resolver = this.pendingUserQuestionPromise;
      this.pendingUserQuestionPromise = null;
      resolver(answer);
    }
  }

  /**
   * Stop task immediately
   */
  async stopTask() {
    this.setStatus(AgentStatus.IDLE);
    if (this.pendingUserQuestionPromise) {
      this.pendingUserQuestionPromise('Task stopped by user.');
      this.pendingUserQuestionPromise = null;
    }
    if (this.activeTabId) {
      await BrowserTools.clearHighlights(this.activeTabId);
    }
    logger.info('Agent task stopped.');
  }
}
