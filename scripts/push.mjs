// Push to GitHub via API
import * as fs from 'fs';
import * as path from 'path';

const REPO_NAME = 'bagsense-ai';

const IGNORE = ['node_modules', '.git', 'dist', '.replit', 'replit.nix', '.cache', '.config', '.upm', 'package-lock.json', '.breakpoints'];

function getToken() {
  return process.env.GITHUB_TOKEN;
}

async function ghApi(endpoint, options = {}) {
  const token = await getToken();
  const res = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

function getAllFiles(dir, files = []) {
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (IGNORE.some(i => full.includes(i))) continue;
    if (fs.statSync(full).isDirectory()) {
      getAllFiles(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  console.log('Connecting to GitHub...');
  const user = await ghApi('/user');
  console.log(`Logged in as: ${user.login}`);
  
  // Create or get repo
  let repo;
  try {
    repo = await ghApi(`/repos/${user.login}/${REPO_NAME}`);
    console.log(`Found repo: ${repo.html_url}`);
  } catch (e) {
    console.log('Creating repo...');
    repo = await ghApi('/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name: REPO_NAME,
        description: 'BagSense AI - Smart Trading Assistant for bags.fm',
        private: false,
        auto_init: true
      })
    });
    console.log(`Created: ${repo.html_url}`);
    await new Promise(r => setTimeout(r, 2000));
  }
  
  const files = getAllFiles('.');
  console.log(`Uploading ${files.length} files...`);
  
  for (const filePath of files) {
    const relativePath = filePath.startsWith('./') ? filePath.slice(2) : filePath;
    const content = fs.readFileSync(filePath);
    const base64 = content.toString('base64');
    
    // Get existing file SHA if exists
    let sha;
    try {
      const existing = await ghApi(`/repos/${user.login}/${REPO_NAME}/contents/${relativePath}`);
      sha = existing.sha;
    } catch (e) {}
    
    try {
      await ghApi(`/repos/${user.login}/${REPO_NAME}/contents/${relativePath}`, {
        method: 'PUT',
        body: JSON.stringify({
          message: `Add ${relativePath}`,
          content: base64,
          sha
        })
      });
      console.log(`  ✓ ${relativePath}`);
    } catch (e) {
      console.log(`  ✗ ${relativePath}: ${e.message.slice(0, 50)}`);
    }
  }
  
  console.log(`\n✅ Done! Repo: https://github.com/${user.login}/${REPO_NAME}`);
  console.log('\nFor Vercel:');
  console.log('1. vercel.com/new → Import repo');
  console.log('2. Add env vars: GROQ_API_KEY, BAGS_API_KEY');
  console.log('3. Deploy!');
}

main().catch(console.error);
