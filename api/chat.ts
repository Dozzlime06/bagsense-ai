// Vercel Serverless Function

const BAGS_API_BASE = "https://public-api-v2.bags.fm/api/v1";

interface TokenCreator {
  username: string | null;
  pfp: string | null;
  royaltyBps: number;
  isCreator: boolean;
  wallet: string;
  provider: string | null;
  providerUsername: string | null;
}

interface TokenMetadata {
  name: string | null;
  symbol: string | null;
  logoURI: string | null;
  price: number | null;
  decimals: number;
  marketCap?: number | null;
  volume24h?: number | null;
  liquidity?: number | null;
}

interface TrendingToken {
  name: string;
  symbol: string;
  address: string;
  price: number | null;
  priceChange24h: number | null;
  volume24h: number | null;
  liquidity: number | null;
  marketCap: number | null;
}

async function getNewSolanaTokens(): Promise<TrendingToken[]> {
  try {
    const response = await fetch("https://api.dexscreener.com/token-profiles/latest/v1");
    if (!response.ok) return [];
    const tokens = await response.json();
    const solanaTokens: TrendingToken[] = [];
    
    for (const token of tokens) {
      if (token.chainId === "solana" && solanaTokens.length < 10) {
        try {
          const pairResponse = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${token.tokenAddress}`);
          if (pairResponse.ok) {
            const pairs = await pairResponse.json();
            if (pairs && pairs.length > 0) {
              const pair = pairs[0];
              solanaTokens.push({
                name: pair.baseToken?.name || token.description || "Unknown",
                symbol: pair.baseToken?.symbol || "???",
                address: token.tokenAddress,
                price: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
                priceChange24h: pair.priceChange?.h24 || null,
                volume24h: pair.volume?.h24 || null,
                liquidity: pair.liquidity?.usd || null,
                marketCap: pair.marketCap || pair.fdv || null,
              });
            }
          }
        } catch (e) {}
      }
    }
    return solanaTokens;
  } catch (error) {
    return [];
  }
}

function formatTrendingTokens(tokens: TrendingToken[]): string {
  if (!tokens || tokens.length === 0) return "No trending tokens found right now.";
  let result = "**Trending Solana Tokens:**\n\n";
  tokens.forEach((token, i) => {
    const priceStr = token.price 
      ? (token.price < 0.000001 ? `$${token.price.toExponential(2)}` : `$${token.price.toFixed(6)}`)
      : "N/A";
    const changeStr = token.priceChange24h !== null
      ? `${token.priceChange24h >= 0 ? "+" : ""}${token.priceChange24h.toFixed(1)}%`
      : "";
    const mcStr = token.marketCap 
      ? (token.marketCap >= 1000000 ? `$${(token.marketCap / 1000000).toFixed(1)}M` : `$${(token.marketCap / 1000).toFixed(0)}K`)
      : "N/A";
    const liqStr = token.liquidity
      ? (token.liquidity >= 1000 ? `$${(token.liquidity / 1000).toFixed(0)}K` : `$${token.liquidity.toFixed(0)}`)
      : "N/A";
    result += `${i + 1}. **${token.name}** (${token.symbol})\n`;
    result += `   Price: ${priceStr} ${changeStr}\n`;
    result += `   MC: ${mcStr} | Liq: ${liqStr}\n`;
    result += `   \`${token.address}\`\n\n`;
  });
  result += "_Paste any address above for full analysis_";
  return result;
}

async function getTokenMetadata(tokenMint: string): Promise<TokenMetadata | null> {
  try {
    const response = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${tokenMint}`);
    if (!response.ok) return null;
    const pairs = await response.json();
    if (!pairs || pairs.length === 0) return null;
    const bestPair = pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    return {
      name: bestPair.baseToken?.name || null,
      symbol: bestPair.baseToken?.symbol || null,
      logoURI: bestPair.info?.imageUrl || null,
      price: bestPair.priceUsd ? parseFloat(bestPair.priceUsd) : null,
      decimals: 9,
      marketCap: bestPair.marketCap || bestPair.fdv || null,
      volume24h: bestPair.volume?.h24 || null,
      liquidity: bestPair.liquidity?.usd || null,
    };
  } catch (error) {
    return null;
  }
}

async function getTokenCreators(tokenMint: string): Promise<TokenCreator[] | null> {
  try {
    const response = await fetch(
      `${BAGS_API_BASE}/token-launch/creator/v3?tokenMint=${tokenMint}`,
      { headers: { "x-api-key": process.env.BAGS_API_KEY || "" } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.success) return null;
    return data.response;
  } catch (error) {
    return null;
  }
}

async function getTokenLifetimeFees(tokenMint: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${BAGS_API_BASE}/token-launch/lifetime-fees?tokenMint=${tokenMint}`,
      { headers: { "x-api-key": process.env.BAGS_API_KEY || "" } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.success) return null;
    return data.response;
  } catch (error) {
    return null;
  }
}

function calculateRiskScore(creators: TokenCreator[] | null, lifetimeFees: string | null, metadata: TokenMetadata | null) {
  let score = 5;
  const factors: string[] = [];

  if (creators && creators.length > 0) {
    const primaryCreator = creators.find(c => c.isCreator);
    if (primaryCreator) {
      if (primaryCreator.providerUsername && primaryCreator.provider) {
        score -= 1;
        factors.push("Creator has verified social");
      } else {
        score += 1;
        factors.push("No verified social linked");
      }
      if (primaryCreator.royaltyBps === 0) {
        score += 2;
        factors.push("0% royalty - no creator incentive");
      } else if (primaryCreator.royaltyBps > 0 && primaryCreator.royaltyBps <= 100) {
        score -= 1;
        factors.push("Standard royalty structure");
      }
    }
    const others = creators.filter(c => !c.isCreator);
    if (others.length > 2) {
      score += 1;
      factors.push("Multiple fee recipients");
    }
  } else {
    score += 2;
    factors.push("No creator info available");
  }

  if (metadata?.liquidity !== null && metadata?.liquidity !== undefined) {
    if (metadata.liquidity < 1000) {
      score += 2;
      factors.push("Very low liquidity (<$1K)");
    } else if (metadata.liquidity < 10000) {
      score += 1;
      factors.push("Low liquidity (<$10K)");
    } else if (metadata.liquidity > 50000) {
      score -= 1;
      factors.push("Healthy liquidity (>$50K)");
    }
  }

  if (metadata?.volume24h !== null && metadata?.volume24h !== undefined) {
    if (metadata.volume24h < 100) {
      score += 1;
      factors.push("Very low trading volume");
    } else if (metadata.volume24h > 10000) {
      score -= 1;
      factors.push("Active trading volume");
    }
  }

  if (lifetimeFees) {
    const feesInSol = parseInt(lifetimeFees) / 1e9;
    if (feesInSol > 1) {
      score -= 1;
      factors.push("Significant fee generation");
    }
  }

  score = Math.max(1, Math.min(10, score));

  let label: string;
  let summary: string;
  if (score <= 3) {
    label = "Safe Play";
    summary = "Relatively lower risk based on available data";
  } else if (score <= 5) {
    label = "Moderate";
    summary = "Standard risk - DYOR recommended";
  } else if (score <= 7) {
    label = "Risky";
    summary = "Higher risk signals detected - be careful";
  } else {
    label = "Degen";
    summary = "High risk - only for true degens. NFA.";
  }

  return { score, label, summary, factors };
}

function formatTokenAnalysis(tokenMint: string, creators: TokenCreator[] | null, lifetimeFees: string | null, metadata: TokenMetadata | null): string {
  if (!creators && !lifetimeFees && !metadata) {
    return `Couldn't find data for token ${tokenMint.slice(0, 8)}...`;
  }

  let analysis = "";

  if (metadata?.name || metadata?.symbol) {
    analysis += `**${metadata.name || "Unknown Token"}** (${metadata.symbol || "???"})\n`;
    analysis += `Mint: ${tokenMint.slice(0, 8)}...${tokenMint.slice(-4)}\n\n`;
  } else {
    analysis += `**Token Analysis: ${tokenMint.slice(0, 8)}...${tokenMint.slice(-4)}**\n\n`;
  }

  if (metadata?.price !== null && metadata?.price !== undefined) {
    if (metadata.price < 0.000001) {
      analysis += `**Price:** $${metadata.price.toExponential(4)}\n`;
    } else if (metadata.price < 0.01) {
      analysis += `**Price:** $${metadata.price.toFixed(6)}\n`;
    } else {
      analysis += `**Price:** $${metadata.price.toFixed(4)}\n`;
    }
  }

  if (metadata?.marketCap) {
    const mcFormatted = metadata.marketCap >= 1000000 
      ? `$${(metadata.marketCap / 1000000).toFixed(2)}M`
      : metadata.marketCap >= 1000 
        ? `$${(metadata.marketCap / 1000).toFixed(1)}K`
        : `$${metadata.marketCap.toFixed(0)}`;
    analysis += `**Market Cap:** ${mcFormatted}\n`;
  }

  if (metadata?.liquidity) {
    const liqFormatted = metadata.liquidity >= 1000000 
      ? `$${(metadata.liquidity / 1000000).toFixed(2)}M`
      : metadata.liquidity >= 1000 
        ? `$${(metadata.liquidity / 1000).toFixed(1)}K`
        : `$${metadata.liquidity.toFixed(0)}`;
    analysis += `**Liquidity:** ${liqFormatted}\n`;
  }

  if (metadata?.volume24h) {
    const volFormatted = metadata.volume24h >= 1000000 
      ? `$${(metadata.volume24h / 1000000).toFixed(2)}M`
      : metadata.volume24h >= 1000 
        ? `$${(metadata.volume24h / 1000).toFixed(1)}K`
        : `$${metadata.volume24h.toFixed(0)}`;
    analysis += `**24h Volume:** ${volFormatted}\n`;
  }

  if (creators && creators.length > 0) {
    const primaryCreator = creators.find(c => c.isCreator);
    if (primaryCreator) {
      const displayName = primaryCreator.providerUsername || primaryCreator.username || "Unknown";
      const platform = primaryCreator.provider || "unknown";
      const royaltyPercent = primaryCreator.royaltyBps / 100;
      
      analysis += `\n**Creator:** ${displayName}`;
      if (platform !== "unknown") {
        analysis += ` (@${primaryCreator.providerUsername} on ${platform})`;
      }
      analysis += `\n`;
      analysis += `**Wallet:** ${primaryCreator.wallet.slice(0, 6)}...${primaryCreator.wallet.slice(-4)}\n`;
      
      if (royaltyPercent === 1) {
        analysis += `**Royalty:** ${royaltyPercent}% (max)\n`;
      } else if (royaltyPercent > 0) {
        analysis += `**Royalty:** ${royaltyPercent}%\n`;
      } else {
        analysis += `**Royalty:** 0%\n`;
      }
      
      const others = creators.filter(c => !c.isCreator);
      if (others.length > 0) {
        const totalSplit = others.reduce((sum, p) => sum + p.royaltyBps, 0) / 100;
        analysis += `\n**Fee Split:** ${totalSplit}% with ${others.length} wallet(s)\n`;
      }
    }
  }

  if (lifetimeFees) {
    const feesInSol = parseInt(lifetimeFees) / 1e9;
    analysis += `\n**Lifetime Fees:** ${feesInSol.toFixed(4)} SOL\n`;
  }

  const riskScore = calculateRiskScore(creators, lifetimeFees, metadata);
  analysis += `\n**Risk Score:** ${riskScore.score}/10 (${riskScore.label})\n`;
  analysis += `${riskScore.summary}\n`;

  return analysis;
}

const SYSTEM_PROMPT = `You are BagSense - a sharp, street-smart AI for bags.fm traders. You talk like a real trader with slang: "aping in", "diamond hands", "rug", "degen plays", "NFA", "DYOR".

WHAT YOU KNOW:
- bags.fm = Solana memecoin launchpad with bonding curves
- Creators get 1% max royalties forever on trades
- You can see: token price, MC, liquidity, volume, creator info, royalty %, lifetime fees

WHEN YOU GET TOKEN DATA, ALWAYS PROVIDE:
1. Risk Score (1-10) with explanation
2. Entry/Exit Strategy:
   - Entry Zone: good entry or wait for dip?
   - TP1: 2x target
   - TP2: 5x target  
   - TP3: Moon bag
   - Stop Loss: where to cut
   - Position Size: based on risk score

WHAT YOU CAN'T SEE: creator history, top holders, whale wallets, bonding curve status.

Keep responses punchy. Always end with NFA.`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, history = [] } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let tokenContext = "";
    const lowerMessage = message.toLowerCase();
    
    const wantsTrending = lowerMessage.includes("trending") || 
                         lowerMessage.includes("what to buy") || 
                         lowerMessage.includes("good to buy") ||
                         lowerMessage.includes("good token") ||
                         lowerMessage.includes("scan") && lowerMessage.includes("token") ||
                         lowerMessage.includes("what's hot") ||
                         lowerMessage.includes("top token") ||
                         lowerMessage.includes("best token") ||
                         (lowerMessage.includes("bags") && lowerMessage.includes("token"));

    if (wantsTrending) {
      const newTokens = await getNewSolanaTokens();
      if (newTokens && newTokens.length > 0) {
        tokenContext = `\n\n[NEW SOLANA TOKENS]\n${formatTrendingTokens(newTokens)}\n[END TOKENS]`;
      }
    }

    const allAddresses: string[] = message.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) || [];
    const filtered = allAddresses.filter((addr: string) => addr.length >= 32 && addr.length <= 44);
    const uniqueAddresses = Array.from(new Set(filtered));
    
    if (uniqueAddresses.length >= 1) {
      const tokenMint = uniqueAddresses[0];
      const [creators, lifetimeFees, metadata] = await Promise.all([
        getTokenCreators(tokenMint),
        getTokenLifetimeFees(tokenMint),
        getTokenMetadata(tokenMint),
      ]);
      
      if (creators || lifetimeFees || metadata) {
        tokenContext = `\n\n[TOKEN DATA]\n${formatTokenAnalysis(tokenMint, creators, lifetimeFees, metadata)}\n[END DATA]\n\nGive analysis with entry/exit strategy.`;
      }
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: message + tokenContext },
    ];

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('Groq API error:', errorText);
      throw new Error('Groq API error');
    }

    const data = await groqResponse.json();
    const content = data.choices?.[0]?.message?.content || "Sorry, couldn't process that.";

    return res.status(200).json({ content });
  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: 'Failed to process message' });
  }
}
