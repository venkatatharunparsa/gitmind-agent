#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Get args
const args = process.argv.slice(2);
const repoFlag = args.indexOf('--repo');
const repo = repoFlag !== -1 ? args[repoFlag + 1] : null;
const question = args.filter((a, i) => 
  a !== '--repo' && i !== repoFlag + 1
).join(' ');

if (!question) {
  console.error('Usage: node ask.js "your question" --repo owner/repo');
  process.exit(1);
}

const GEMINI_KEY = process.env.GOOGLE_API_KEY || 
                   process.env.GEMINI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GEMINI_KEY) {
  console.error('Error: Set GOOGLE_API_KEY environment variable');
  process.exit(1);
}

console.log('\n🧠 GitMind is thinking...\n');

// Fetch file from GitHub API
function fetchGitHub(path) {
  return new Promise((resolve) => {
    const headers = {
      'User-Agent': 'GitMind-Agent',
      'Accept': 'application/vnd.github.v3.raw'
    };
    if (GITHUB_TOKEN) {
      headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    }

    const options = {
      hostname: 'api.github.com',
      path: path,
      headers
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

async function main() {
  let context = '';

  // Fetch MIND.md if repo provided
  if (repo) {
    console.log(`📖 Reading MIND.md from ${repo}...`);
    const mindmd = await fetchGitHub(
      `/repos/${repo}/contents/MIND.md`
    );
    if (mindmd && !mindmd.includes('"message"')) {
      context += `\n\nMIND.md (GitMind's knowledge base):\n${mindmd}`;
    }

    // Fetch README
    const readme = await fetchGitHub(
      `/repos/${repo}/contents/README.md`
    );
    if (readme && !readme.includes('"message"')) {
      context += `\n\nREADME.md:\n${readme.substring(0, 2000)}`;
    }
  }

  // Check local MIND.md
  const localMind = path.join(process.cwd(), 'MIND.md');
  if (!context && fs.existsSync(localMind)) {
    console.log('📖 Reading local MIND.md...');
    context = fs.readFileSync(localMind, 'utf8');
  }

  // Build prompt
  const prompt = `You are GitMind — the living brain of a git repository.
You are a warm, senior engineer who has read every file and commit.
Always cite sources. Always give confidence levels.

${context ? `Repository Knowledge:\n${context}` : ''}

Question: ${question}

Answer in this format:
**💬 Answer:**
[Clear plain English answer]

**📁 Source:**
[Exact file or section this came from]

**🎯 Confidence:** High / Medium / Low

**💡 Suggestion (optional):**
[Helpful next step]`;

  // Call Gemini
  const data = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048
    }
  });

  const encodedKey = encodeURIComponent(GEMINI_KEY);
  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${encodedKey}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(body);
        if (!json.candidates || !json.candidates[0]) {
          console.error('API Error:', body.substring(0, 300));
          process.exit(1);
        }
        const answer = json.candidates[0].content.parts[0].text;
        console.log('─'.repeat(50));
        console.log(answer);
        console.log('─'.repeat(50));
        console.log('\n🧠 GitMind v0.1.0 | GitAgent standard\n');
      } catch(e) {
        console.error('Error:', e.message);
        process.exit(1);
      }
    });
  });

  req.on('error', e => {
    console.error('Request error:', e.message);
    process.exit(1);
  });

  req.write(data);
  req.end();
}

main();
