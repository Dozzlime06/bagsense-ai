import { Sparkles, User, Star, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";

interface WatchlistToken {
  address: string;
  name: string;
  symbol: string;
  addedAt: number;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  onAddToWatchlist?: (token: WatchlistToken) => void;
  watchlist?: WatchlistToken[];
}

const SOLANA_ADDRESS_REGEX = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

export function ChatMessage({ role, content, isStreaming, onAddToWatchlist, watchlist = [] }: ChatMessageProps) {
  const isUser = role === "user";
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const tokenAddresses = useMemo(() => {
    if (isUser) return [];
    const matches = content.match(SOLANA_ADDRESS_REGEX) || [];
    const filtered = matches.filter(addr => addr.length >= 32 && addr.length <= 44);
    return Array.from(new Set(filtered));
  }, [content, isUser]);

  const copyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleAddToWatchlist = (address: string) => {
    if (onAddToWatchlist) {
      onAddToWatchlist({
        address,
        name: "Unknown Token",
        symbol: address.slice(0, 6).toUpperCase(),
        addedAt: Date.now(),
      });
    }
  };

  const isInWatchlist = (address: string) => {
    return watchlist.some(t => t.address === address);
  };

  return (
    <div 
      className={cn(
        "flex gap-3 animate-slide-up",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
      data-testid={`message-${role}`}
    >
      <div 
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          isUser 
            ? "bg-secondary" 
            : "bg-gradient-to-br from-primary to-accent"
        )}
      >
        {isUser ? (
          <User size={16} className="text-secondary-foreground" />
        ) : (
          <Sparkles size={16} className="text-white" />
        )}
      </div>
      
      <div 
        className={cn(
          "max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 sm:px-4 py-3 overflow-hidden",
          isUser 
            ? "bg-primary text-primary-foreground rounded-tr-md" 
            : "bg-card border border-card-border rounded-tl-md"
        )}
      >
        <div className={cn(
          "text-sm leading-relaxed prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 max-w-none break-words overflow-wrap-anywhere",
          isStreaming && !isUser && "typing-cursor"
        )}>
          {isUser ? (
            <span className="whitespace-pre-wrap">{content || "..."}</span>
          ) : (
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
                ul: ({ children }) => <ul className="list-disc pl-4 my-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 my-2">{children}</ol>,
                li: ({ children }) => <li className="my-0.5">{children}</li>,
                h3: ({ children }) => <h3 className="font-bold text-base mt-3 mb-1">{children}</h3>,
                h4: ({ children }) => <h4 className="font-semibold mt-2 mb-1">{children}</h4>,
                code: ({ children }) => (
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-accent break-all">{children}</code>
                ),
              }}
            >
              {content || (isStreaming ? "" : "...")}
            </ReactMarkdown>
          )}
        </div>

        {!isUser && !isStreaming && tokenAddresses.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
            <span className="text-xs text-muted-foreground">Quick Actions:</span>
            <div className="flex flex-wrap gap-2">
              {tokenAddresses.slice(0, 3).map((address) => (
                <div key={address} className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1"
                    onClick={() => copyAddress(address)}
                    data-testid={`button-copy-${address.slice(0, 8)}`}
                  >
                    {copiedAddress === address ? (
                      <Check className="h-3 w-3 text-primary" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {address.slice(0, 4)}...{address.slice(-4)}
                  </Button>
                  {onAddToWatchlist && (
                    <Button
                      size="sm"
                      variant={isInWatchlist(address) ? "default" : "ghost"}
                      className={cn(isInWatchlist(address) && "bg-accent text-accent-foreground")}
                      onClick={() => handleAddToWatchlist(address)}
                      disabled={isInWatchlist(address)}
                      data-testid={`button-watchlist-${address.slice(0, 8)}`}
                    >
                      <Star className={cn("h-3 w-3", isInWatchlist(address) && "fill-current")} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
