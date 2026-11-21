/**
 * In-Extension Domain Crawler & Text Extractor
 * Automatically traverses same-domain links for portfolio or profile sites,
 * extracting clean textual content into the agent's starting knowledge base.
 */
export class DomainCrawler {
  constructor(options = {}) {
    this.maxPages = options.maxPages || 15;
    this.maxDepth = options.maxDepth || 2;
    this.fetchTimeoutMs = options.fetchTimeoutMs || 8000;
    this.delayBetweenRequestsMs = options.delayBetweenRequestsMs || 150;
  }

  /**
   * Crawls a starting URL and all reachable same-domain pages.
   * @param {string} startUrl - Initial URL provided by user (e.g. portfolio)
   * @param {function} onProgress - Callback for real-time crawler updates (url, stats)
   * @returns {Promise<{ domain: string, totalPages: number, pages: Array, aggregatedText: string }>}
   */
  async crawlDomain(startUrl, onProgress = () => {}) {
    let rootUrl;
    try {
      if (!startUrl.startsWith('http://') && !startUrl.startsWith('https://')) {
        startUrl = 'https://' + startUrl;
      }
      rootUrl = new URL(startUrl);
    } catch {
      throw new Error(`Invalid URL: ${startUrl}`);
    }

    const domain = rootUrl.hostname;
    const visited = new Set();
    const queue = [{ url: rootUrl.href, depth: 0 }];
    const crawledPages = [];

    onProgress({
      status: 'started',
      domain,
      discoveredCount: 1,
      processedCount: 0,
      currentUrl: rootUrl.href
    });

    while (queue.length > 0 && crawledPages.length < this.maxPages) {
      const current = queue.shift();
      const normalizedUrl = this.normalizeUrl(current.url);

      if (visited.has(normalizedUrl)) continue;
      visited.add(normalizedUrl);

      onProgress({
        status: 'crawling',
        domain,
        discoveredCount: queue.length + crawledPages.length,
        processedCount: crawledPages.length + 1,
        currentUrl: normalizedUrl,
        depth: current.depth
      });

      try {
        const pageData = await this.fetchAndExtract(normalizedUrl);
        if (pageData && pageData.text && pageData.text.length > 30) {
          crawledPages.push(pageData);

          // If depth allows, discover new internal links
          if (current.depth < this.maxDepth) {
            for (const link of pageData.links) {
              const normLink = this.normalizeUrl(link);
              if (!visited.has(normLink) && this.isSameDomain(normLink, domain)) {
                // Check not already in queue
                if (!queue.some(item => this.normalizeUrl(item.url) === normLink)) {
                  queue.push({ url: normLink, depth: current.depth + 1 });
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Failed to crawl ${normalizedUrl}:`, err.message);
      }

      if (this.delayBetweenRequestsMs > 0 && queue.length > 0) {
        await new Promise(r => setTimeout(r, this.delayBetweenRequestsMs));
      }
    }

    // Build aggregated text
    let aggregatedText = `=== CRAWLED DOMAIN CONTEXT: ${domain} ===\n`;
    for (const page of crawledPages) {
      aggregatedText += `\n--- PAGE: ${page.title || 'Untitled'} (${page.url}) ---\n`;
      aggregatedText += page.text + '\n';
    }

    const result = {
      domain,
      startUrl: rootUrl.href,
      totalPages: crawledPages.length,
      crawledAt: new Date().toISOString(),
      pages: crawledPages.map(p => ({
        url: p.url,
        title: p.title,
        wordCount: p.text.split(/\s+/).length,
        summary: p.text
      })),
      aggregatedText
    };

    onProgress({
      status: 'completed',
      domain,
      totalPages: crawledPages.length,
      result
    });

    return result;
  }

  /**
   * Fetches an HTML page and extracts structured text and outgoing links
   */
  async fetchAndExtract(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.fetchTimeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('xhtml')) {
        return null; // Skip images, PDFs, binary files
      }

      const html = await response.text();
      return this.parseHtmlContent(html, url);
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  /**
   * Parses HTML string into clean textual representation and outgoing links
   */
  parseHtmlContent(html, baseUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove unwanted script, style, ad tags
    const junkSelectors = ['script', 'style', 'noscript', 'svg', 'canvas', 'iframe', 'head'];
    junkSelectors.forEach(sel => {
      doc.querySelectorAll(sel).forEach(el => el.remove());
    });

    const title = (doc.querySelector('title')?.textContent || '').trim();
    const metaDesc = (doc.querySelector('meta[name="description"]')?.getAttribute('content') || '').trim();

    // Extract links
    const links = [];
    doc.querySelectorAll('a[href]').forEach(a => {
      try {
        const href = a.getAttribute('href');
        if (href && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
          const resolved = new URL(href, baseUrl).href;
          links.push(resolved);
        }
      } catch {
        // Ignore invalid URLs
      }
    });

    // Extract readable text from main landmarks first
    const contentRoot = doc.querySelector('main, article, #content, .content, #main, .main') || doc.body;

    let cleanText = '';
    if (metaDesc) cleanText += `Description: ${metaDesc}\n\n`;

    if (contentRoot) {
      // Process headings and paragraphs
      const walker = doc.createTreeWalker(contentRoot, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const style = parent.getAttribute('style') || '';
          if (style.includes('display: none') || style.includes('visibility: hidden')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      const textPieces = [];
      let currentNode;
      while ((currentNode = walker.nextNode())) {
        const str = currentNode.textContent.trim();
        if (str.length > 0) {
          const parentTag = currentNode.parentElement?.tagName.toLowerCase();
          if (['h1', 'h2', 'h3'].includes(parentTag)) {
            textPieces.push(`\n## ${str}\n`);
          } else if (['h4', 'h5', 'h6'].includes(parentTag)) {
            textPieces.push(`\n### ${str}\n`);
          } else if (parentTag === 'li') {
            textPieces.push(`• ${str}`);
          } else {
            textPieces.push(str);
          }
        }
      }

      cleanText += textPieces.join(' ').replace(/\n\s+\n/g, '\n\n').replace(/[ \t]{2,}/g, ' ');
    }

    return {
      url: baseUrl,
      title,
      text: cleanText.trim(),
      links
    };
  }

  normalizeUrl(urlStr) {
    try {
      const u = new URL(urlStr);
      u.hash = ''; // Remove fragments
      // Normalize trailing slash
      let path = u.pathname;
      if (path.endsWith('/') && path.length > 1) {
        path = path.slice(0, -1);
      }
      u.pathname = path;
      return u.href;
    } catch {
      return urlStr;
    }
  }

  isSameDomain(targetUrl, rootDomain) {
    try {
      const u = new URL(targetUrl);
      const targetHost = u.hostname;
      return targetHost === rootDomain || targetHost.endsWith('.' + rootDomain);
    } catch {
      return false;
    }
  }
}
