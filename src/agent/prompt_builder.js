/**
 * Aetheria Prompt Builder & ReAct Parser
 * Formulates system prompts and parses Thought/Action outputs from LLMs.
 */
import { TOOL_DEFINITIONS } from '../tools/tool_registry.js';

export class PromptBuilder {
  /**
   * Constructs the master system prompt with user context and tools
   */
  static buildSystemPrompt(userMasterContext) {
    const toolsText = TOOL_DEFINITIONS.map(t => {
      return `- **${t.name}**: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters.properties)}`;
    }).join('\n\n');

    return `You are Aetheria, an elite autonomous web automation agent running inside a Firefox browser extension.
Your objective is to accomplish user web tasks such as searching for jobs, reading requirements, filling forms, applying to positions, and extracting data.

${userMasterContext}

## YOUR TOOLSET
You have access to the following tools:
${toolsText}

## HOW TO ACT - THE ReAct PROTOCOL
You must think step-by-step and strictly output your response using the following format:

Thought: [Explain your reasoning about the current page state, what you observe, and what exact step you must take next. If applying to a job, reference the user's master context/resume to choose appropriate values.]
Action: [The exact tool name from the toolset]
Action Input: [A valid, single-line or multi-line JSON object corresponding to the chosen tool's parameters]

## CRITICAL OPERATIONAL RULES:
1. Every interactive element on the page is marked with a numbered badge ID (e.g. #1, #2, #3). Always use these numeric IDs for click_element, fill_form_field, select_dropdown_option, and upload_resume_file.
2. When filling form fields (Name, Email, Phone, Experience, Skills, Cover Letter questions), ALWAYS check the USER MASTER CONTEXT above. Adapt the answers faithfully.
3. If an <input type="file"> appears for resume upload, use the "upload_resume_file" tool with the input's element ID.
4. If you encounter any critical blocker, ambiguity, missing information not in the resume, CAPTCHA, or need user confirmation before submitting, call the "ask_user" tool with a clear question and options. You will receive their answer in the next Observation.
5. Once your task is completely finished, you MUST call "finish_task" with a comprehensive summary.
6. Never output conversational chit-chat outside the Thought/Action/Action Input format during execution.`;
  }

  /**
   * Constructs the step prompt containing the current page DOM state and history
   */
  static buildStepUserMessage(taskGoal, domState, stepIndex) {
    let elementsList = 'No interactive elements detected.';
    if (domState && domState.elements && domState.elements.length > 0) {
      elementsList = domState.elements.map(el => {
        let desc = `#${el.id} <${el.tag}${el.type ? ' type="' + el.type + '"' : ''}>`;
        if (el.label) desc += ` label="${el.label}"`;
        if (el.value) desc += ` value="${el.value}"`;
        if (el.href) desc += ` href="${el.href}"`;
        if (el.disabled) desc += ` [DISABLED]`;
        return desc;
      }).join('\n');
    }

    return `CURRENT TASK GOAL: "${taskGoal}"
STEP NUMBER: ${stepIndex}

--- CURRENT BROWSER TAB STATE ---
Page Title: "${domState.title || 'Untitled'}"
Current URL: ${domState.url || 'Unknown'}
Scroll Position: Y=${domState.viewport?.scrollY || 0} / ${domState.viewport?.scrollHeight || 0}

--- PAGE READABLE TEXT SUMMARY ---
${domState.readableTextSnippet || 'None'}

--- DETECTED INTERACTIVE ELEMENTS (#ID) ---
${elementsList}

Based on the page state above, execute your next step.`;
  }

  /**
   * Parses LLM text response into Thought, Action, and Action Input
   */
  static parseReActResponse(responseText) {
    let thought = '';
    let action = '';
    let actionInput = null;

    // Extract Thought
    const thoughtMatch = responseText.match(/Thought:\s*([\s\S]*?)(?=Action:|$)/i);
    if (thoughtMatch) {
      thought = thoughtMatch[1].trim();
    }

    // Extract Action
    const actionMatch = responseText.match(/Action:\s*([a-zA-Z0-9_]+)/i);
    if (actionMatch) {
      action = actionMatch[1].trim();
    }

    // Extract Action Input
    const inputMatch = responseText.match(/Action Input:\s*([\s\S]*)$/i);
    if (inputMatch) {
      const rawInput = inputMatch[1].trim();
      
      // Attempt JSON parse directly
      try {
        actionInput = JSON.parse(rawInput);
      } catch {
        // Look for JSON object enclosed in backticks or curly braces
        const jsonBlock = rawInput.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || rawInput.match(/(\{[\s\S]*?\})/);
        if (jsonBlock) {
          try {
            actionInput = JSON.parse(jsonBlock[1]);
          } catch {
            actionInput = { raw: rawInput };
          }
        } else {
          actionInput = { raw: rawInput };
        }
      }
    }

    // Fallback if structured format wasn't strictly followed but tool name is present
    if (!action) {
      for (const def of TOOL_DEFINITIONS) {
        if (responseText.toLowerCase().includes(def.name.toLowerCase())) {
          action = def.name;
          break;
        }
      }
    }

    return {
      thought: thought || responseText,
      action: action || 'wait_seconds',
      actionInput: actionInput || {}
    };
  }
}
