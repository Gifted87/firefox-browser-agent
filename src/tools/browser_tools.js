/**
 * Aetheria Browser Tools Executor
 * Executes browser commands against active Firefox tabs and handles background fetches.
 */
import { contextManager } from '../context/doc_manager.js';

export class BrowserTools {
  static getAPI() {
    return typeof browser !== 'undefined' ? browser : chrome;
  }

  static async getActiveTab() {
    const api = this.getAPI();
    if (!api || !api.tabs) return null;

    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    return tabs[0] || null;
  }

  static async sendTabMessage(tabId, message) {
    const api = this.getAPI();
    try {
      return await api.tabs.sendMessage(tabId, message);
    } catch (err) {
      // If content script was not yet injected (e.g. newly loaded tab), inject it
      if (api.scripting && api.scripting.executeScript) {
        await api.scripting.executeScript({
          target: { tabId },
          files: ['src/content/content_script.js']
        });
        await api.scripting.insertCSS({
          target: { tabId },
          files: ['src/content/overlay.css']
        });
        // Retry message
        return await api.tabs.sendMessage(tabId, message);
      }
      throw err;
    }
  }

  static async getDomState(tabId) {
    const resp = await this.sendTabMessage(tabId, { type: 'AETHERIA_GET_DOM_STATE' });
    if (!resp || !resp.success) {
      throw new Error(resp?.error || 'Failed to capture DOM state from active tab');
    }
    return resp.data;
  }

  static async clickElement(tabId, elementId) {
    const resp = await this.sendTabMessage(tabId, {
      type: 'AETHERIA_CLICK_ELEMENT',
      elementId: Number(elementId)
    });
    if (!resp || !resp.success) {
      throw new Error(resp?.error || `Failed to click element #${elementId}`);
    }
    return `Clicked element #${elementId} (${resp.tag}: "${resp.label}") successfully.`;
  }

  static async fillFormField(tabId, elementId, value) {
    const resp = await this.sendTabMessage(tabId, {
      type: 'AETHERIA_FILL_ELEMENT',
      elementId: Number(elementId),
      text: value
    });
    if (!resp || !resp.success) {
      throw new Error(resp?.error || `Failed to fill field #${elementId}`);
    }
    return `Filled field #${elementId} with value: "${value}".`;
  }

  static async selectDropdownOption(tabId, elementId, optionValue) {
    const resp = await this.sendTabMessage(tabId, {
      type: 'AETHERIA_SELECT_OPTION',
      elementId: Number(elementId),
      value: optionValue
    });
    if (!resp || !resp.success) {
      throw new Error(resp?.error || `Failed to select option for element #${elementId}`);
    }
    return `Selected option "${optionValue}" in dropdown #${elementId}.`;
  }

  static async uploadResumeFile(tabId, elementId) {
    const activeResume = await contextManager.getActiveResume();
    if (!activeResume) {
      throw new Error('No active resume document found in context store. Please upload a resume first.');
    }

    const resp = await this.sendTabMessage(tabId, {
      type: 'AETHERIA_UPLOAD_FILE',
      elementId: Number(elementId),
      fileData: {
        name: activeResume.name,
        type: activeResume.type,
        base64: activeResume.base64,
        text: activeResume.text
      }
    });

    if (!resp || !resp.success) {
      throw new Error(resp?.error || `Failed to upload resume to element #${elementId}`);
    }

    return `Uploaded resume file "${activeResume.name}" to element #${elementId} successfully.`;
  }

  static async scrollPage(tabId, direction = 'down', amount = 450) {
    const resp = await this.sendTabMessage(tabId, {
      type: 'AETHERIA_SCROLL',
      direction,
      amount: Number(amount)
    });
    if (!resp || !resp.success) {
      throw new Error(resp?.error || 'Failed to scroll page');
    }
    return `Scrolled ${direction} by ${amount}px. Current Y position: ${resp.currentScrollY}px.`;
  }

  static async navigateToUrl(tabId, url) {
    let validUrl = url.trim();
    if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
      validUrl = 'https://' + validUrl;
    }

    const api = this.getAPI();
    await api.tabs.update(tabId, { url: validUrl });
    // Wait for navigation load
    await new Promise(r => setTimeout(r, 2000));
    return `Navigated to ${validUrl}. Waiting for page elements to settle.`;
  }

  static async fetchLinkContent(url) {
    try {
      let target = url.trim();
      if (!target.startsWith('http://') && !target.startsWith('https://')) {
        target = 'https://' + target;
      }

      const res = await fetch(target);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Strip non-content
      doc.querySelectorAll('script, style, noscript, svg, nav, footer').forEach(e => e.remove());
      const main = doc.querySelector('main, article, #content, .content') || doc.body;
      const text = (main.innerText || main.textContent || '').replace(/\s+/g, ' ');

      return `Extracted content from ${url} (Title: "${doc.title || 'Untitled'}"):\n\n${text}`;
    } catch (err) {
      return `Failed to fetch background link ${url}: ${err.message}`;
    }
  }

  static async waitSeconds(seconds = 2) {
    const clamped = Math.min(Math.max(Number(seconds) || 2, 1), 10);
    await new Promise(r => setTimeout(r, clamped * 1000));
    return `Waited ${clamped} seconds for page to update.`;
  }

  static async clearHighlights(tabId) {
    try {
      await this.sendTabMessage(tabId, { type: 'AETHERIA_CLEAR_HIGHLIGHTS' });
    } catch {
      // Non-critical
    }
  }
}
