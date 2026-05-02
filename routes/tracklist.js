'use strict';

const express = require('express');
const router = express.Router();
const { fetchWithTimeout } = require('../lib/http');

const TL_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function stripTags(str) {
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

// Search MixesDB for DJ mix tracklists matching a query
router.get('/api/tracklist-search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q required' });
  const url = `https://www.mixesdb.com/w/index.php?title=Special%3ASearch&search=${encodeURIComponent(q)}&fulltext=1&limit=20`;
  try {
    const r = await fetchWithTimeout(url, { headers: { 'User-Agent': TL_UA } }, 15000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();

    const sectionMatch = html.match(/class="mw-search-results"[\s\S]*?<\/ul>/);
    const section = sectionMatch ? sectionMatch[0] : '';
    if (!section) { res.json({ results: [] }); return; }

    const results = [];
    const re = /mw-search-result-heading[\s\S]{1,400}?href="(\/w\/[^"?#:]+)"[^>]*title="([^"]+)"/g;
    let m;
    while ((m = re.exec(section)) !== null) {
      results.push({ title: m[2], url: 'https://www.mixesdb.com' + m[1] });
    }
    const seen = new Set();
    const deduped = results.filter((r) => { if (seen.has(r.url)) return false; seen.add(r.url); return true; });
    res.json({ results: deduped.slice(0, 20) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fetch and parse a MixesDB tracklist page
router.get('/api/tracklist-fetch', async (req, res) => {
  const url = (req.query.url || '').trim();
  if (!url.startsWith('https://www.mixesdb.com/w/')) {
    return res.status(400).json({ error: 'invalid url' });
  }
  try {
    const r = await fetchWithTimeout(url, { headers: { 'User-Agent': TL_UA } }, 15000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();

    const contentMatch = html.match(/id="mw-content-text"([\s\S]*?)(?:id="relatedPages"|id="comments"|<\/div>\s*<div id="bodyBottom)/);
    const content = contentMatch ? contentMatch[1] : html;

    const olMatch = content.match(/<ol>([\s\S]*?)<\/ol>/);
    const tracks = [];
    if (olMatch) {
      const liRe = /<li>([\s\S]*?)<\/li>/g;
      let m;
      while ((m = liRe.exec(olMatch[1])) !== null) {
        const text = stripTags(m[1]).trim();
        if (!text) continue;
        const timedMatch = text.match(/^\[(\d+)\]\s+(.+)$/);
        if (timedMatch) {
          const rest = timedMatch[2].trim();
          const dash = rest.indexOf(' - ');
          tracks.push({
            startSeconds: parseInt(timedMatch[1], 10) * 60,
            performer: dash > 0 ? rest.slice(0, dash).trim() : '',
            title: dash > 0 ? rest.slice(dash + 3).trim() : rest,
          });
        } else {
          const dash = text.indexOf(' - ');
          tracks.push({
            startSeconds: null,
            performer: dash > 0 ? text.slice(0, dash).trim() : '',
            title: dash > 0 ? text.slice(dash + 3).trim() : text,
          });
        }
      }
    }

    const titleM = html.match(/<h1[^>]*id="firstHeading"[^>]*>([\s\S]*?)<\/h1>/);
    const pageTitle = titleM ? stripTags(titleM[1]) : url.split('/w/')[1]?.replace(/_/g, ' ') || '';
    const hasTimes = tracks.some((t) => t.startSeconds !== null);
    res.json({ title: pageTitle, tracks, hasTimes, sourceUrl: url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
