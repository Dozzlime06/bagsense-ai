const BAGS_API_BASE = "https://public-api-v2.bags.fm/api/v1";

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

export async function getTrendingBagsTokens(): Promise<TrendingToken[] | null> {
  // bags.fm doesn't have a public trending API
  // Return null to indicate we can't fetch trending tokens
  return null;
}

export async function getNewSolanaTokens(): Promise<TrendingToken[]> {
  try {
    // Get latest token profiles from DexScreener
    const response = await fetch("https://api.dexscreener.com/token-profiles/latest/v1");
    
    if (!response.ok) {
      console.error(`DexScreener profiles API error: ${response.status}`);
      return [];
    }

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
        } catch (e) {
          console.log("Error fetching token data:", e);
        }
      }
    }
    
    return solanaTokens;
  } catch (error) {
    console.error("Error fetching new tokens:", error);
    return [];
  }
}

export function formatTrendingTokens(tokens: TrendingToken[]): string {
  if (!tokens || tokens.length === 0) {
    return "No trending tokens found right now.";
  }

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

interface TokenCreator {
  username: string | null;
  pfp: string | null;
  royaltyBps: number;
  isCreator: boolean;
  wallet: string;
  provider: string | null;
  providerUsername: string | null;
}

interface TokenCreatorsResponse {
  success: boolean;
  response: TokenCreator[];
  error?: string;
}

interface TokenLifetimeFeesResponse {
  success: boolean;
  response: string;
  error?: string;
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

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  volume: { h24: number };
  liquidity: { usd: number };
  fdv: number;
  marketCap: number;
  info?: {
    imageUrl?: string;
  };
}

export async function getTokenMetadata(tokenMint: string): Promise<TokenMetadata | null> {
  try {
    // Use DexScreener API - free and provides comprehensive token data
    const response = await fetch(
      `https://api.dexscreener.com/tokens/v1/solana/${tokenMint}`
    );

    if (!response.ok) {
      console.error(`DexScreener API error: ${response.status}`);
      return null;
    }

    const pairs: DexScreenerPair[] = await response.json();
    
    if (!pairs || pairs.length === 0) {
      console.log("No pairs found on DexScreener for token:", tokenMint);
      return null;
    }

    // Get the pair with highest liquidity
    const bestPair = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    
    const price = bestPair.priceUsd ? parseFloat(bestPair.priceUsd) : null;

    return {
      name: bestPair.baseToken?.name || null,
      symbol: bestPair.baseToken?.symbol || null,
      logoURI: bestPair.info?.imageUrl || null,
      price,
      decimals: 9,
      marketCap: bestPair.marketCap || bestPair.fdv || null,
      volume24h: bestPair.volume?.h24 || null,
      liquidity: bestPair.liquidity?.usd || null,
    };
  } catch (error) {
    console.error("Error fetching token metadata:", error);
    return null;
  }
}

export async function getTokenCreators(tokenMint: string): Promise<TokenCreator[] | null> {
  try {
    const response = await fetch(
      `${BAGS_API_BASE}/token-launch/creator/v3?tokenMint=${tokenMint}`,
      {
        headers: {
          "x-api-key": process.env.BAGS_API_KEY || "",
        },
      }
    );

    if (!response.ok) {
      console.error(`Bags API error: ${response.status}`);
      return null;
    }

    const data: TokenCreatorsResponse = await response.json();
    
    if (!data.success) {
      console.error(`Bags API error: ${data.error}`);
      return null;
    }

    return data.response;
  } catch (error) {
    console.error("Error fetching token creators:", error);
    return null;
  }
}

export async function getTokenLifetimeFees(tokenMint: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${BAGS_API_BASE}/token-launch/lifetime-fees?tokenMint=${tokenMint}`,
      {
        headers: {
          "x-api-key": process.env.BAGS_API_KEY || "",
        },
      }
    );

    if (!response.ok) {
      console.error(`Bags API error: ${response.status}`);
      return null;
    }

    const data: TokenLifetimeFeesResponse = await response.json();
    
    if (!data.success) {
      console.error(`Bags API error: ${data.error}`);
      return null;
    }

    return data.response;
  } catch (error) {
    console.error("Error fetching token lifetime fees:", error);
    return null;
  }
}

export function extractTokenMint(text: string): string | null {
  // Solana addresses are base58 encoded, typically 32-44 characters
  // Common patterns: raw address, bags.fm URLs
  
  // Check for bags.fm token URLs
  const bagsUrlMatch = text.match(/bags\.fm\/token\/([A-Za-z0-9]{32,44})/i);
  if (bagsUrlMatch) {
    return bagsUrlMatch[1];
  }
  
  // Check for raw Solana address (base58, 32-44 chars)
  const addressMatch = text.match(/\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/);
  if (addressMatch) {
    return addressMatch[1];
  }
  
  return null;
}

export function formatTokenAnalysis(
  tokenMint: string,
  creators: TokenCreator[] | null,
  lifetimeFees: string | null,
  metadata: TokenMetadata | null
): string {
  if (!creators && !lifetimeFees && !metadata) {
    return `Couldn't find data for token ${tokenMint.slice(0, 8)}... - might be a new token or not on bags.fm yet.`;
  }

  let analysis = "";

  // Token header with name and symbol
  if (metadata?.name || metadata?.symbol) {
    analysis += `**${metadata.name || "Unknown Token"}** (${metadata.symbol || "???"})\n`;
    analysis += `Mint: ${tokenMint.slice(0, 8)}...${tokenMint.slice(-4)}\n\n`;
  } else {
    analysis += `**Token Analysis: ${tokenMint.slice(0, 8)}...${tokenMint.slice(-4)}**\n\n`;
  }

  // Price and market info
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
      // royaltyBps is in basis points: 100 bps = 1%, 50 bps = 0.5%
      const royaltyPercent = primaryCreator.royaltyBps / 100;
      
      analysis += `\n**Creator:** ${displayName}`;
      if (platform !== "unknown") {
        analysis += ` (@${primaryCreator.providerUsername} on ${platform})`;
      }
      analysis += `\n`;
      analysis += `**Wallet:** ${primaryCreator.wallet.slice(0, 6)}...${primaryCreator.wallet.slice(-4)}\n`;
      
      // Display royalty with context
      if (royaltyPercent === 1) {
        analysis += `**Royalty:** ${royaltyPercent}% (max - creator earns on every trade)\n`;
      } else if (royaltyPercent > 0) {
        analysis += `**Royalty:** ${royaltyPercent}% (creator earns on trades)\n`;
      } else {
        analysis += `**Royalty:** 0% (creator gets nothing from trades)\n`;
      }
      
      // Additional participants (fee sharing)
      const others = creators.filter(c => !c.isCreator);
      if (others.length > 0) {
        const totalSplit = others.reduce((sum, p) => sum + p.royaltyBps, 0) / 100;
        analysis += `\n**Fee Split:** Sharing ${totalSplit}% with ${others.length} wallet(s)\n`;
        others.forEach(p => {
          const name = p.providerUsername || p.username || p.wallet.slice(0, 6) + "...";
          analysis += `  - ${name}: ${p.royaltyBps / 100}%\n`;
        });
      }
    }
  }

  if (lifetimeFees) {
    const feesInSol = parseInt(lifetimeFees) / 1e9;
    analysis += `\n**Lifetime Fees:** ${feesInSol.toFixed(4)} SOL\n`;
  }

  // Add risk score
  const riskScore = calculateRiskScore(creators, lifetimeFees, metadata);
  analysis += `\n**Risk Score:** ${riskScore.score}/10 (${riskScore.label})\n`;
  analysis += `${riskScore.summary}\n`;

  return analysis;
}

interface RiskScoreResult {
  score: number;
  label: string;
  summary: string;
  factors: string[];
}

export function calculateRiskScore(
  creators: TokenCreator[] | null,
  lifetimeFees: string | null,
  metadata: TokenMetadata | null
): RiskScoreResult {
  let score = 5; // Start neutral
  const factors: string[] = [];

  // Creator analysis
  if (creators && creators.length > 0) {
    const primaryCreator = creators.find(c => c.isCreator);
    
    if (primaryCreator) {
      // Verified social is good
      if (primaryCreator.providerUsername && primaryCreator.provider) {
        score -= 1;
        factors.push("Creator has verified social");
      } else {
        score += 1;
        factors.push("No verified social linked");
      }

      // 0% royalty is suspicious
      if (primaryCreator.royaltyBps === 0) {
        score += 2;
        factors.push("0% royalty - no creator incentive");
      } else if (primaryCreator.royaltyBps > 0 && primaryCreator.royaltyBps <= 100) {
        score -= 1;
        factors.push("Standard royalty structure");
      }
    }

    // Fee splits to multiple wallets could be good or bad
    const others = creators.filter(c => !c.isCreator);
    if (others.length > 2) {
      score += 1;
      factors.push("Multiple fee recipients - verify legitimacy");
    }
  } else {
    score += 2;
    factors.push("No creator info available");
  }

  // Liquidity analysis
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

  // Trading volume analysis
  if (metadata?.volume24h !== null && metadata?.volume24h !== undefined) {
    if (metadata.volume24h < 100) {
      score += 1;
      factors.push("Very low trading volume");
    } else if (metadata.volume24h > 10000) {
      score -= 1;
      factors.push("Active trading volume");
    }
  }

  // Lifetime fees (activity indicator)
  if (lifetimeFees) {
    const feesInSol = parseInt(lifetimeFees) / 1e9;
    if (feesInSol > 1) {
      score -= 1;
      factors.push("Significant fee generation");
    }
  }

  // Clamp score between 1-10
  score = Math.max(1, Math.min(10, score));

  // Label based on score
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
