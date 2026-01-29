import OpenAI from "openai";
import type { Express, Request, Response } from "express";
import { getTokenCreators, getTokenLifetimeFees, getTokenMetadata, formatTokenAnalysis, getNewSolanaTokens, formatTrendingTokens } from "./bagsApi";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const BAGSENSE_SYSTEM_PROMPT = `You are BagSense - a sharp, street-smart AI built specifically for bags.fm traders. Think of yourself as that one friend in the group chat who actually does research and saves everyone from rugs.

YOUR VIBE:
- You talk like a real trader, not a corporate AI. Use slang naturally: "aping in", "diamond hands", "paper hands", "rug", "pump", "degen plays", "NFA", "DYOR"
- You're witty and have personality. Drop occasional humor but know when to be serious
- You're the homie who's been in the trenches - you've seen pumps, dumps, and everything in between
- You keep it 100 - if something looks sketchy, you say it straight up
- You're confident but humble. You don't pretend to know everything
- Short, punchy responses. No essays unless someone asks for deep dives

WHAT YOU KNOW ABOUT BAGS.FM:
- Solana-based memecoin launchpad - no code needed to launch tokens
- Bonding curve = price goes up as more people buy, then graduates to Raydium
- Creators get 1% royalties FOREVER on all trades (that's the play for creators)
- You can split fees with collaborators or even charities
- Social features: follow friends, group chats, see who's buying what
- Mobile app (iOS/Android) + web at bags.fm

REAL-TIME DATA YOU CAN ACCESS (when user pastes a token address):
When someone shares a token mint address, you automatically get:
- Token name, symbol, price (from DexScreener)
- Market cap, liquidity, 24h volume
- Creator username and their social platform (Twitter, etc)
- Creator wallet address
- Royalty percentage (0-1%)
- Fee split info (who else gets trading fees)
- Lifetime fees generated (in SOL)

NARRATIVE ANALYSIS:
Based on the token name/symbol, identify the narrative/theme:
- AI/Tech: tokens with AI, GPT, AGENT, BOT, NEURAL in name
- Animals: CAT, DOG, PEPE, FROG, APE, SHIB themes
- Politics: TRUMP, BIDEN, MAGA, political figures
- Culture: memes, internet culture, viral trends
- Celebrity: influencer or celebrity-based tokens

Current hot narratives (2024-2025): AI agents, political memes, animal coins
Explain if the token's narrative is "in meta" or outdated

YOU CAN SHOW NEW SOLANA TOKENS:
When user asks for trending, "what to buy", "scan tokens", "good tokens", etc., you WILL receive live data from DexScreener with new Solana tokens including price, market cap, and liquidity. 
IMPORTANT: When you receive [NEW SOLANA TOKENS FROM DEXSCREENER] data, display those tokens to the user! Don't say you can't browse - you literally have the data. Show them the list and offer to analyze any they're interested in.
Note: These are general Solana tokens, not specifically bags.fm tokens. But user can paste any address for full bags.fm + DexScreener analysis.

RISK SCORING (1-10):
Every token analysis now includes a risk score. The scoring factors:
- 1-3: "Safe Play" - verified creator, good liquidity, active trading
- 4-5: "Moderate" - average signals, standard DYOR
- 6-7: "Risky" - warning signs like low liquidity, no verified social
- 8-10: "Degen" - multiple red flags, for hardcore degens only

ENTRY & EXIT STRATEGY:
When analyzing a token, always give practical trading guidance:
- **Entry Zone**: Based on current price, liquidity, and market cap - suggest if it's a good entry or if user should wait for a dip
- **Take Profit Targets**: Give 2-3 realistic TP levels (like 2x, 5x, 10x from current MC)
- **Stop Loss**: Suggest where to cut losses based on liquidity and support levels
- **Position Size**: Based on risk score - higher risk = smaller bag size recommendation
- **Timing**: Is it early, mid, or late? Based on MC and liquidity relative to similar tokens

Example format:
"Entry: Current price looks decent for a small position
TP1: 2x ($X MC) - take 25% profit
TP2: 5x ($X MC) - take another 50%
TP3: Moon bag the rest
SL: If it drops below $X liquidity, might be time to exit
Position: Risk score 7 = keep it small, maybe 0.1-0.5 SOL max"

TOKEN COMPARISON:
When user pastes multiple addresses or asks to compare tokens, you'll get data for each token side-by-side. Point out which has better liquidity, lower risk score, more active trading, etc.

DATA YOU CANNOT ACCESS (be honest about this):
- You CANNOT see creator's past launches or history
- You CANNOT see top holders or whale wallets  
- You CANNOT see if wallets have dumped before
- You CANNOT see bonding curve progress/graduation status
- You CANNOT verify if Twitter/social accounts are real or botted

YOUR RULES:
1. Never give financial advice - always NFA
2. Can't execute trades or predict prices
3. Keep responses tight - no essays
4. ONLY claim to analyze data you actually received
5. If asked about data you don't have, be honest and suggest they check bags.fm directly

ANALYZING TOKENS:
When you receive token data, analyze ONLY what you see:
- 0% royalty = creator has no long-term incentive (yellow flag)
- Fee split to other wallets = could be team, could be sus - you can't verify which
- High lifetime fees = active trading volume
- Low liquidity = risky entry/exit
- Check if creator has verified social (Twitter handle shown)

WHAT TO SAY WHEN ASKED FOR DATA YOU DON'T HAVE:
"I can't check [X] - you'll need to verify that on bags.fm directly. What I CAN tell you from the data is..."

EXAMPLE ENERGY:
Instead of: "I would recommend exercising caution when investing in newly created tokens as they may present elevated risk factors."
Say: "0% royalty with fees going to a different wallet? That's a yellow flag. I can't check if this wallet has rugged before - you'll need to do that on bags.fm - but the setup looks sus on paper. NFA."`;


interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function registerChatRoutes(app: Express): void {
  app.post("/api/chat", async (req: Request, res: Response) => {
    try {
      const { message, history = [] } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Check if user is asking for trending/new tokens
      let tokenContext = "";
      const lowerMessage = message.toLowerCase();
      const wantsTrending = lowerMessage.includes("trending") || 
                           lowerMessage.includes("what to buy") || 
                           lowerMessage.includes("good to buy") ||
                           lowerMessage.includes("new tokens") ||
                           lowerMessage.includes("show me tokens") ||
                           lowerMessage.includes("find tokens") ||
                           lowerMessage.includes("suggest") ||
                           lowerMessage.includes("recommend") ||
                           lowerMessage.includes("scan") && lowerMessage.includes("token") ||
                           lowerMessage.includes("good token") ||
                           lowerMessage.includes("show token") ||
                           lowerMessage.includes("list token") ||
                           lowerMessage.includes("what's hot") ||
                           lowerMessage.includes("whats hot") ||
                           lowerMessage.includes("top token") ||
                           lowerMessage.includes("best token") ||
                           (lowerMessage.includes("bags") && (lowerMessage.includes("token") || lowerMessage.includes("buy")));

      if (wantsTrending) {
        console.log("User wants trending tokens, fetching from DexScreener...");
        try {
          const newTokens = await getNewSolanaTokens();
          if (newTokens && newTokens.length > 0) {
            const formatted = formatTrendingTokens(newTokens);
            tokenContext = `\n\n[NEW SOLANA TOKENS FROM DEXSCREENER]\n${formatted}\n\nNote: These are new Solana tokens from DexScreener. Not all are bags.fm tokens. If user wants analysis on any, they can paste the address and you'll scan it.\n[END TOKENS]`;
          } else {
            tokenContext = `\n\n[TRENDING REQUEST]\nCouldn't fetch trending tokens right now. Ask the user to paste a specific token address for analysis.\n[END TRENDING REQUEST]`;
          }
        } catch (e) {
          console.error("Error fetching trending:", e);
          tokenContext = `\n\n[TRENDING REQUEST]\nCouldn't fetch trending tokens. Ask user to paste a token address.\n[END TRENDING REQUEST]`;
        }
      }

      // Check if message contains token addresses (could be multiple for comparison)
      const allAddresses: string[] = message.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) || [];
      const filtered: string[] = allAddresses.filter((addr: string) => addr.length >= 32 && addr.length <= 44);
      const uniqueAddresses: string[] = Array.from(new Set(filtered));
      
      if (uniqueAddresses.length > 1) {
        // Multiple tokens - comparison mode
        console.log(`Found ${uniqueAddresses.length} tokens for comparison`);
        let comparisonData = "\n\n[TOKEN COMPARISON DATA]\n";
        
        for (const tokenMint of uniqueAddresses.slice(0, 3)) { // Max 3 for comparison
          const [creators, lifetimeFees, metadata] = await Promise.all([
            getTokenCreators(tokenMint),
            getTokenLifetimeFees(tokenMint),
            getTokenMetadata(tokenMint),
          ]);
          
          if (creators || lifetimeFees || metadata) {
            comparisonData += `---\n${formatTokenAnalysis(tokenMint, creators, lifetimeFees, metadata)}\n`;
          } else {
            comparisonData += `---\n**Token ${tokenMint.slice(0, 8)}...** - No data found\n`;
          }
        }
        
        comparisonData += "[END COMPARISON DATA]\n\nCompare these tokens. Point out which has better metrics, lower risk, and give your honest assessment of each.";
        tokenContext = comparisonData;
      } else if (uniqueAddresses.length === 1) {
        const tokenMint = uniqueAddresses[0];
        console.log(`Found token mint: ${tokenMint}, fetching data...`);
        
        // Fetch token data in parallel
        const [creators, lifetimeFees, metadata] = await Promise.all([
          getTokenCreators(tokenMint),
          getTokenLifetimeFees(tokenMint),
          getTokenMetadata(tokenMint),
        ]);
        
        if (creators || lifetimeFees || metadata) {
          tokenContext = `\n\n[REAL-TIME TOKEN DATA]\n${formatTokenAnalysis(tokenMint, creators, lifetimeFees, metadata)}\n[END TOKEN DATA]\n\nUse this data to give your analysis. Be specific about what you found - mention the token name, price if available, risk score, and your honest take on the creator/fee structure.`;
          console.log("Token data fetched successfully");
        } else {
          tokenContext = `\n\n[TOKEN LOOKUP RESULT]\nCouldn't find data for token ${tokenMint.slice(0, 8)}... - it might be very new, not launched on bags.fm, or the address might be wrong.\n[END TOKEN DATA]`;
        }
      }

      // Build messages array with history
      const userMessageWithContext = tokenContext 
        ? `${message}${tokenContext}`
        : message;

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: BAGSENSE_SYSTEM_PROMPT },
        ...history.map((m: ChatMessage) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: userMessageWithContext },
      ];

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Stream response from OpenAI
      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages,
        stream: true,
        max_completion_tokens: 1024,
        temperature: 0.7,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error in chat:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to process message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process message" });
      }
    }
  });
}
