import { StorageService } from './storage.js';
import { DomainCrawler } from '../utils/crawler.js';

const STORAGE_KEYS = {
  DOCUMENTS: 'aetheria_user_documents',
  CRAWLED_DOMAINS: 'aetheria_crawled_domains',
  USER_PROFILE: 'aetheria_user_profile',
  ACTIVE_RESUME_ID: 'aetheria_active_resume_id'
};

export class ContextManager {
  constructor() {
    this.crawler = new DomainCrawler();
  }

  // --- Documents & Resumes ---

  async getDocuments() {
    return (await StorageService.get(STORAGE_KEYS.DOCUMENTS, [])) || [];
  }

  async addDocument(docData) {
    const docs = await this.getDocuments();
    const newDoc = {
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: docData.name,
      type: docData.type,
      size: docData.size,
      text: docData.text,
      preview: docData.preview,
      isResume: docData.isResume || false,
      uploadedAt: new Date().toISOString(),
      // Base64 representation if provided for file input injection
      base64: docData.base64 || null
    };

    docs.unshift(newDoc);
    await StorageService.set(STORAGE_KEYS.DOCUMENTS, docs);

    // If marked as resume or first doc, set as active resume
    if (newDoc.isResume || docs.length === 1) {
      await this.setActiveResume(newDoc.id);
    }

    return newDoc;
  }

  async removeDocument(docId) {
    let docs = await this.getDocuments();
    docs = docs.filter(d => d.id !== docId);
    await StorageService.set(STORAGE_KEYS.DOCUMENTS, docs);
  }

  async getActiveResume() {
    const docs = await this.getDocuments();
    const activeId = await StorageService.get(STORAGE_KEYS.ACTIVE_RESUME_ID);
    if (activeId) {
      const found = docs.find(d => d.id === activeId);
      if (found) return found;
    }
    return docs.find(d => d.isResume) || docs[0] || null;
  }

  async setActiveResume(docId) {
    await StorageService.set(STORAGE_KEYS.ACTIVE_RESUME_ID, docId);
  }

  // --- Crawled Domains & Portfolio Context ---

  async getCrawledDomains() {
    return (await StorageService.get(STORAGE_KEYS.CRAWLED_DOMAINS, [])) || [];
  }

  /**
   * Crawls a user-supplied portfolio URL, extracts all same-domain pages, and stores them in context.
   * @param {string} url 
   * @param {function} onProgress 
   */
  async crawlAndAddPortfolio(url, onProgress = () => {}) {
    const crawlResult = await this.crawler.crawlDomain(url, onProgress);
    const existing = await this.getCrawledDomains();

    const newEntry = {
      id: 'domain_' + Date.now(),
      domain: crawlResult.domain,
      startUrl: crawlResult.startUrl,
      totalPages: crawlResult.totalPages,
      pages: crawlResult.pages,
      aggregatedText: crawlResult.aggregatedText,
      crawledAt: crawlResult.crawledAt
    };

    // Filter out previous crawl of the same domain if exists
    const updated = existing.filter(d => d.domain !== newEntry.domain);
    updated.unshift(newEntry);

    await StorageService.set(STORAGE_KEYS.CRAWLED_DOMAINS, updated);
    return newEntry;
  }

  async removeCrawledDomain(domainId) {
    let domains = await this.getCrawledDomains();
    domains = domains.filter(d => d.id !== domainId);
    await StorageService.set(STORAGE_KEYS.CRAWLED_DOMAINS, domains);
  }

  // --- Master User Profile ---

  async getProfile() {
    return (await StorageService.get(STORAGE_KEYS.USER_PROFILE, {
      fullName: '',
      email: '',
      phone: '',
      location: '',
      linkedinUrl: '',
      githubUrl: '',
      portfolioUrl: '',
      currentTitle: '',
      yearsOfExperience: '',
      skills: '',
      bioSummary: '',
      salaryExpectation: '',
      workAuthorization: 'Authorized to work in country of application'
    })) || {};
  }

  async updateProfile(profileData) {
    const current = await this.getProfile();
    const updated = { ...current, ...profileData };
    await StorageService.set(STORAGE_KEYS.USER_PROFILE, updated);
    return updated;
  }

  // --- Context Compiler for Agent ---

  /**
   * Compiles all documents, crawled domains, and master profile into a comprehensive starting context for the ReAct agent.
   */
  async getCompiledStartingContext() {
    const profile = await this.getProfile();
    const activeResume = await this.getActiveResume();
    const allDocs = await this.getDocuments();
    const domains = await this.getCrawledDomains();

    let context = '=== USER MASTER CONTEXT & KNOWLEDGE BASE ===\n\n';

    // 1. Structured Profile
    context += '--- CANDIDATE MASTER PROFILE ---\n';
    if (profile.fullName) context += `Full Name: ${profile.fullName}\n`;
    if (profile.email) context += `Email: ${profile.email}\n`;
    if (profile.phone) context += `Phone: ${profile.phone}\n`;
    if (profile.location) context += `Location: ${profile.location}\n`;
    if (profile.linkedinUrl) context += `LinkedIn: ${profile.linkedinUrl}\n`;
    if (profile.githubUrl) context += `GitHub: ${profile.githubUrl}\n`;
    if (profile.portfolioUrl) context += `Portfolio URL: ${profile.portfolioUrl}\n`;
    if (profile.currentTitle) context += `Current / Desired Title: ${profile.currentTitle}\n`;
    if (profile.yearsOfExperience) context += `Experience: ${profile.yearsOfExperience} years\n`;
    if (profile.skills) context += `Core Skills: ${profile.skills}\n`;
    if (profile.workAuthorization) context += `Work Authorization: ${profile.workAuthorization}\n`;
    if (profile.salaryExpectation) context += `Salary Expectation: ${profile.salaryExpectation}\n`;
    if (profile.bioSummary) context += `Executive Bio: ${profile.bioSummary}\n`;
    context += '\n';

    // 2. Active Resume Text
    if (activeResume && activeResume.text) {
      context += `--- ACTIVE RESUME (${activeResume.name}) ---\n`;
      context += activeResume.text + '\n\n';
    }

    // 3. Additional Documents
    const otherDocs = allDocs.filter(d => !activeResume || d.id !== activeResume.id);
    if (otherDocs.length > 0) {
      context += '--- ADDITIONAL UPLOADED DOCUMENTS ---\n';
      for (const d of otherDocs) {
        context += `Document [${d.name}]:\n${d.text}\n\n`;
      }
    }

    // 4. Crawled Portfolio Sites & Pages (Full, Untruncated Context)
    if (domains.length > 0) {
      context += '--- USER PORTFOLIO & CRAWLED DOMAINS CONTEXT ---\n';
      for (const dom of domains) {
        context += `Domain: ${dom.domain} (Total Pages: ${dom.totalPages})\n`;
        context += dom.aggregatedText + '\n\n';
      }
    }

    context += '=== END USER MASTER CONTEXT ===\n';
    return context;
  }
}

export const contextManager = new ContextManager();
