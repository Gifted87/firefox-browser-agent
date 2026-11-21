/**
 * Aetheria Firefox Agent - Background Service
 */

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

console.log('[Aetheria] Background script initialized.');

// Handle extension icon clicks if sidebar isn't automatically opened
if (browserAPI.action && browserAPI.action.onClicked) {
  browserAPI.action.onClicked.addListener(async (tab) => {
    if (browserAPI.sidebarAction && browserAPI.sidebarAction.open) {
      await browserAPI.sidebarAction.open();
    }
  });
}

// Background message broker for tab coordination
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AETHERIA_PING') {
    sendResponse({ status: 'alive', version: '1.0.0' });
    return true;
  }
  return false;
});
