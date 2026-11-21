/**
 * Extension Storage Abstraction
 * Handles persistent storage via browser.storage.local with automatic fallbacks.
 */
export class StorageService {
  static isWebExtension() {
    return typeof browser !== 'undefined' && browser.storage && browser.storage.local;
  }

  static async get(key, defaultValue = null) {
    try {
      if (this.isWebExtension()) {
        const result = await browser.storage.local.get(key);
        return result[key] !== undefined ? result[key] : defaultValue;
      } else {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      }
    } catch (err) {
      console.error(`Storage get error for [${key}]:`, err);
      return defaultValue;
    }
  }

  static async set(key, value) {
    try {
      if (this.isWebExtension()) {
        await browser.storage.local.set({ [key]: value });
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
      return true;
    } catch (err) {
      console.error(`Storage set error for [${key}]:`, err);
      return false;
    }
  }

  static async remove(key) {
    try {
      if (this.isWebExtension()) {
        await browser.storage.local.remove(key);
      } else {
        localStorage.removeItem(key);
      }
      return true;
    } catch (err) {
      console.error(`Storage remove error for [${key}]:`, err);
      return false;
    }
  }
}
