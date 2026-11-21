/**
 * Aetheria Content Script - Interactive DOM Engine & Element Injector
 */

(function () {
  if (window.__aetheriaContentScriptLoaded) return;
  window.__aetheriaContentScriptLoaded = true;

  let elementRegistry = new Map(); // id -> Element
  let overlayContainer = null;

  // --- Message Listener ---
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      switch (message.type) {
        case 'AETHERIA_GET_DOM_STATE': {
          const state = extractInteractiveDomState();
          sendResponse({ success: true, data: state });
          break;
        }

        case 'AETHERIA_CLICK_ELEMENT': {
          const result = executeClick(message.elementId);
          sendResponse(result);
          break;
        }

        case 'AETHERIA_FILL_ELEMENT': {
          const result = executeFill(message.elementId, message.text);
          sendResponse(result);
          break;
        }

        case 'AETHERIA_SELECT_OPTION': {
          const result = executeSelect(message.elementId, message.value);
          sendResponse(result);
          break;
        }

        case 'AETHERIA_UPLOAD_FILE': {
          const result = executeFileUpload(message.elementId, message.fileData);
          sendResponse(result);
          break;
        }

        case 'AETHERIA_SCROLL': {
          const result = executeScroll(message.direction, message.amount);
          sendResponse(result);
          break;
        }

        case 'AETHERIA_CLEAR_HIGHLIGHTS': {
          clearOverlays();
          sendResponse({ success: true });
          break;
        }

        case 'AETHERIA_EXTRACT_PAGE_TEXT': {
          const text = extractPageReadableText();
          sendResponse({ success: true, data: text });
          break;
        }

        default:
          sendResponse({ success: false, error: `Unknown action: ${message.type}` });
      }
    } catch (err) {
      console.error('Aetheria content script error:', err);
      sendResponse({ success: false, error: err.message });
    }
    return true; // Keep channel open for async response
  });

  // --- DOM Extraction & Element Labeling ---

  function ensureOverlayContainer() {
    if (!overlayContainer || !document.contains(overlayContainer)) {
      overlayContainer = document.createElement('div');
      overlayContainer.id = 'aetheria-overlay-root';
      overlayContainer.style.position = 'absolute';
      overlayContainer.style.top = '0';
      overlayContainer.style.left = '0';
      overlayContainer.style.width = '100%';
      overlayContainer.style.height = '100%';
      overlayContainer.style.pointerEvents = 'none';
      overlayContainer.style.zIndex = '2147483646';
      document.body.appendChild(overlayContainer);
    }
    return overlayContainer;
  }

  function clearOverlays() {
    if (overlayContainer) {
      overlayContainer.innerHTML = '';
    }
    document.querySelectorAll('.aetheria-target-active').forEach(el => {
      el.classList.remove('aetheria-target-active');
    });
    elementRegistry.clear();
  }

  function isElementVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    // Must be reasonably near viewport or within scrollable bounds
    return true;
  }

  function extractInteractiveDomState() {
    clearOverlays();
    const container = ensureOverlayContainer();

    const selector = [
      'a[href]',
      'button',
      'input',
      'textarea',
      'select',
      '[role="button"]',
      '[role="link"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="combobox"]',
      '[role="tab"]',
      '[contenteditable="true"]',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    const candidates = Array.from(document.querySelectorAll(selector));
    const items = [];
    let counter = 1;

    for (const el of candidates) {
      if (!isElementVisible(el)) continue;

      const rect = el.getBoundingClientRect();
      const id = counter++;
      el.setAttribute('data-aetheria-id', id);
      elementRegistry.set(id, el);

      // Extract descriptive text / metadata
      const tagName = el.tagName.toLowerCase();
      let role = el.getAttribute('role') || tagName;
      let label = (
        el.getAttribute('aria-label') ||
        el.getAttribute('placeholder') ||
        el.getAttribute('title') ||
        el.innerText ||
        el.value ||
        ''
      ).trim().replace(/\s+/g, ' ');

      const inputType = el.getAttribute('type') || '';
      const name = el.getAttribute('name') || '';

      // Build badge overlay
      const badge = document.createElement('div');
      badge.className = 'aetheria-highlight-badge';
      badge.textContent = id;
      badge.style.top = `${rect.top + window.scrollY}px`;
      badge.style.left = `${rect.left + window.scrollX}px`;
      container.appendChild(badge);

      items.push({
        id,
        tag: tagName,
        type: inputType,
        role,
        name,
        label,
        value: el.value || '',
        checked: el.checked || false,
        disabled: el.disabled || false,
        href: el.getAttribute('href') || ''
      });
    }

    // Capture full main page text without truncation
    const pageText = extractPageReadableText();

    return {
      title: document.title,
      url: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollY: window.scrollY,
        scrollHeight: document.body.scrollHeight
      },
      interactiveElementsCount: items.length,
      elements: items,
      readableTextSnippet: pageText
    };
  }

  function extractPageReadableText() {
    const main = document.querySelector('main, article, [role="main"], #content, .content') || document.body;
    if (!main) return '';

    // Clone to remove hidden elements
    const clone = main.cloneNode(true);
    clone.querySelectorAll('script, style, noscript, svg, nav, footer, #aetheria-overlay-root').forEach(e => e.remove());

    return (clone.innerText || clone.textContent || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // --- Browser Actions ---

  function showActionPing(el) {
    const rect = el.getBoundingClientRect();
    const ping = document.createElement('div');
    ping.className = 'aetheria-action-ping';
    ping.style.top = `${rect.top + window.scrollY + rect.height / 2}px`;
    ping.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
    document.body.appendChild(ping);
    setTimeout(() => ping.remove(), 700);

    el.classList.add('aetheria-target-active');
    setTimeout(() => el.classList.remove('aetheria-target-active'), 1200);
  }

  function executeClick(elementId) {
    const el = elementRegistry.get(Number(elementId));
    if (!el) {
      return { success: false, error: `Element #${elementId} not found or expired.` };
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showActionPing(el);

    // Focus & dispatch mouse events
    el.focus();
    const rect = el.getBoundingClientRect();
    const eventOptions = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    };

    el.dispatchEvent(new MouseEvent('mousedown', eventOptions));
    el.dispatchEvent(new MouseEvent('mouseup', eventOptions));
    el.click();

    return {
      success: true,
      action: 'click',
      elementId,
      tag: el.tagName.toLowerCase(),
      label: el.innerText || el.getAttribute('aria-label') || el.value || ''
    };
  }

  function executeFill(elementId, text) {
    const el = elementRegistry.get(Number(elementId));
    if (!el) {
      return { success: false, error: `Element #${elementId} not found or expired.` };
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showActionPing(el);
    el.focus();

    if ('value' in el) {
      // Use prototype setter for React/Vue synthetic event compatibility
      const prototype = Object.getPrototypeOf(el);
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value') ||
                         Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

      if (descriptor && descriptor.set) {
        descriptor.set.call(el, text);
      } else {
        el.value = text;
      }
    } else if (el.isContentEditable) {
      el.innerText = text;
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));

    return {
      success: true,
      action: 'fill',
      elementId,
      valueSet: text
    };
  }

  function executeSelect(elementId, value) {
    const el = elementRegistry.get(Number(elementId));
    if (!el || el.tagName.toLowerCase() !== 'select') {
      return { success: false, error: `Element #${elementId} is not a valid <select> tag.` };
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showActionPing(el);

    let matched = false;
    for (const opt of el.options) {
      if (opt.value.toLowerCase() === value.toLowerCase() || opt.text.toLowerCase().includes(value.toLowerCase())) {
        opt.selected = true;
        matched = true;
        break;
      }
    }

    if (!matched && el.options.length > 0) {
      el.selectedIndex = 0;
    }

    el.dispatchEvent(new Event('change', { bubbles: true }));

    return {
      success: true,
      action: 'select',
      elementId,
      selectedValue: el.value
    };
  }

  function executeFileUpload(elementId, fileData) {
    const el = elementRegistry.get(Number(elementId));
    if (!el) {
      return { success: false, error: `Element #${elementId} not found.` };
    }

    if (el.tagName.toLowerCase() !== 'input' || (el.getAttribute('type') || '').toLowerCase() !== 'file') {
      return { success: false, error: `Element #${elementId} is not a file input (<input type="file">).` };
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showActionPing(el);

    try {
      const fileName = fileData.name || 'resume.pdf';
      const fileType = fileData.type || 'application/pdf';
      
      let blob;
      if (fileData.base64) {
        const byteCharacters = atob(fileData.base64.split(',')[1] || fileData.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        blob = new Blob([new Uint8Array(byteNumbers)], { type: fileType });
      } else {
        blob = new Blob([fileData.text || 'Profile Resume Document Content'], { type: 'text/plain' });
      }

      const file = new File([blob], fileName, { type: fileType, lastModified: Date.now() });
      const dt = new DataTransfer();
      dt.items.add(file);
      el.files = dt.files;

      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));

      return {
        success: true,
        action: 'upload_file',
        elementId,
        fileName
      };
    } catch (err) {
      return { success: false, error: `File injection failed: ${err.message}` };
    }
  }

  function executeScroll(direction = 'down', amount = 450) {
    const yDelta = direction === 'up' ? -amount : amount;
    window.scrollBy({ top: yDelta, behavior: 'smooth' });
    return {
      success: true,
      action: 'scroll',
      direction,
      amount,
      currentScrollY: window.scrollY
    };
  }
})();
