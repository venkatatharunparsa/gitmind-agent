#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const repoFlag = args.indexOf('--repo');
const repo = repoFlag !== -1 ? args[repoFlag + 1] : null;
const question = args
  .filter((a, i) => a !== '--repo' && i !== repoFlag + 1)
  .join(' ');

if (!question) {
  console.error('Usage: node ask.js "your question" --repo owner/repo');
  process.exit(1);
}

const GEMINI_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GEMINI_KEY) {
  console.error('Error: Set GOOGLE_API_KEY environment variable');
  process.exit(1);
}

console.log('\n🧠 GitMind is thinking...\n');

function fetchURL(hostname, path, headers) {
  return new Promise((resolve) => {
    const options = { hostname, path, headers };
    let data = '';
    https.get(options, (res) => {
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', (e) => {
      console.error('Fetch error:', e.message);
      resolve('');
    });
  });
}

async function main() {
  let context = '';

  if (repo) {
    console.log(`📖 Reading from ${repo}...`);

    const headers = { 'User-Agent': 'GitMind/1.0' };
    if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;

    // Fetch MIND.md
    const mindRaw = await fetchURL(
      'raw.githubusercontent.com',
      `/${repo}/main/MIND.md`,
      headers
    );
    if (mindRaw && mindRaw.length > 100) {
      context += `\nMIND.md:\n${mindRaw.substring(0, 6000)}`;
    }

    // Fetch README
    const readmeRaw = await fetchURL(
      'raw.githubusercontent.com',
      `/${repo}/main/README.md`,
      headers
    );
    if (readmeRaw && readmeRaw.length > 100) {
      context += `\nREADME.md:\n${readmeRaw.substring(0, 2000)}`;
    }
  }

  // Check local MIND.md
  const localMind = path.join(process.cwd(), 'MIND.md');
  if (!context && fs.existsSync(localMind)) {
    console.log('📖 Reading local MIND.md...');
    context = fs.readFileSync(localMind, 'utf8');
  }

  const prompt = `You are GitMind — the living brain of a git repository.
You are a warm, senior engineer who has read every file and commit.
Always cite sources. Always give confidence levels.

${context ? `Repository Knowledge:\n${context}` : 'No context available.'}

Question: ${question}

Answer in this exact format:

**💬 Answer:**
[Clear plain English answer 2-5 sentences]

**📁 Source:**
[Exact file or section this came from]

**🎯 Confidence:** High / Medium / Low

**💡 Suggestion:**
[One helpful next step]`;

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
  });

  const encodedKey = encodeURIComponent(GEMINI_KEY);

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${encodedKey}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (!json.candidates || !json.candidates[0]) {
          console.error('API Error:', data.substring(0, 300));
          process.exit(1);
        }
        const answer = json.candidates[0].content.parts[0].text;
        console.log('─'.repeat(60));
        console.log(answer);
        console.log('─'.repeat(60));
        console.log('\n🧠 GitMind v0.1.0 | GitAgent standard\n');
      } catch (e) {
        console.error('Parse error:', e.message);
        console.error(data.substring(0, 300));
        process.exit(1);
      }
    });
  });

  req.on('error', (e) => {
    console.error('Request failed:', e.message);
    process.exit(1);
  });

  req.write(body);
  req.end();
}

main();
