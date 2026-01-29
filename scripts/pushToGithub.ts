// Push BagSense AI to GitHub via Octokit
import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const replIdentity = process.env.REPL_IDENTITY;
  
  if (!hostname || !replIdentity) {
    throw new Error('Missing Replit environment variables');
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=github`,
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': `repl ${replIdentity}`
      }
    }
  );
  
  const data = await response.json();
  connectionSettings = data.items?.[0];

  const accessToken = connectionSettings?.settings?.access_token || 
                      connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!accessToken) {
    throw new Error('GitHub not connected - no access token found');
  }
  
  console.log('Got access token:', accessToken.slice(0, 10) + '...');
  return accessToken;
}

async function getGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

const REPO_NAME = 'bagsense-ai';
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  '.replit',
  'replit.nix',
  '.cache',
  '.config',
  '.upm',
  'generated-icon.png',
  '.breakpoints',
  'package-lock.json'
];

function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (shouldIgnore(fullPath)) continue;
    
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  }
  
  return arrayOfFiles;
}

async function main() {
  console.log('Connecting to GitHub...');
  const octokit = await getGitHubClient();
  
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`Logged in as: ${user.login}`);
  
  let repo;
  try {
    const { data } = await octokit.repos.get({
      owner: user.login,
      repo: REPO_NAME,
    });
    repo = data;
    console.log(`Found existing repo: ${repo.html_url}`);
  } catch (e) {
    console.log('Creating new repository...');
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name: REPO_NAME,
      description: 'BagSense AI - Smart Trading Assistant for bags.fm',
      private: false,
    });
    repo = data;
    console.log(`Created repo: ${repo.html_url}`);
  }
  
  console.log('Getting all files...');
  const files = getAllFiles('.');
  console.log(`Found ${files.length} files to upload`);
  
  let defaultBranch = repo.default_branch || 'main';
  let baseTreeSha: string | undefined;
  
  try {
    const { data: ref } = await octokit.git.getRef({
      owner: user.login,
      repo: REPO_NAME,
      ref: `heads/${defaultBranch}`,
    });
    const { data: commit } = await octokit.git.getCommit({
      owner: user.login,
      repo: REPO_NAME,
      commit_sha: ref.object.sha,
    });
    baseTreeSha = commit.tree.sha;
  } catch (e) {
    console.log('No existing commits, creating initial commit...');
  }
  
  console.log('Creating blobs for each file...');
  const treeItems: any[] = [];
  
  for (const filePath of files) {
    const relativePath = filePath.startsWith('./') ? filePath.slice(2) : filePath;
    const content = fs.readFileSync(filePath);
    const base64Content = content.toString('base64');
    
    try {
      const { data: blob } = await octokit.git.createBlob({
        owner: user.login,
        repo: REPO_NAME,
        content: base64Content,
        encoding: 'base64',
      });
      
      treeItems.push({
        path: relativePath,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      });
      
      console.log(`  Uploaded: ${relativePath}`);
    } catch (e: any) {
      console.log(`  Failed: ${relativePath} - ${e.message}`);
    }
  }
  
  console.log('Creating tree...');
  const { data: tree } = await octokit.git.createTree({
    owner: user.login,
    repo: REPO_NAME,
    tree: treeItems,
    base_tree: baseTreeSha,
  });
  
  console.log('Creating commit...');
  const { data: newCommit } = await octokit.git.createCommit({
    owner: user.login,
    repo: REPO_NAME,
    message: 'Deploy BagSense AI - Smart Trading Assistant',
    tree: tree.sha,
    parents: baseTreeSha ? [(await octokit.git.getRef({
      owner: user.login,
      repo: REPO_NAME,
      ref: `heads/${defaultBranch}`,
    })).data.object.sha] : [],
  });
  
  console.log('Updating branch reference...');
  try {
    await octokit.git.updateRef({
      owner: user.login,
      repo: REPO_NAME,
      ref: `heads/${defaultBranch}`,
      sha: newCommit.sha,
    });
  } catch (e) {
    await octokit.git.createRef({
      owner: user.login,
      repo: REPO_NAME,
      ref: `refs/heads/${defaultBranch}`,
      sha: newCommit.sha,
    });
  }
  
  console.log('\n✅ Successfully pushed to GitHub!');
  console.log(`📁 Repository: ${repo.html_url}`);
  console.log('\nNext steps for Vercel:');
  console.log('1. Go to vercel.com/new');
  console.log('2. Import this repository');
  console.log('3. Add environment variables: GROQ_API_KEY, BAGS_API_KEY');
  console.log('4. Deploy!');
}

main().catch(console.error);
