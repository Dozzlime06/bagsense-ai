import { useState, useRef, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { BagSenseLogo } from "@/components/BagSenseLogo";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Trash2, Star, TrendingUp, LogOut, Loader2, Mail } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface WatchlistToken {
  address: string;
  name: string;
  symbol: string;
  addedAt: number;
}

const STORAGE_KEY = "bagsense_messages";
const WATCHLIST_KEY = "bagsense_watchlist";

export default function Chat() {
  const { ready, authenticated, login, logout } = usePrivy();
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [watchlist, setWatchlist] = useState<WatchlistToken[]>(() => {
    const saved = localStorage.getItem(WATCHLIST_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleSend = async (content: string) => {
    if (!authenticated) {
      login();
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: content,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const contentType = response.headers.get("content-type") || "";
      
      // Handle JSON response (Vercel serverless)
      if (contentType.includes("application/json")) {
        const data = await response.json();
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.content || "No response",
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setIsStreaming(false);
        return;
      }

      // Handle streaming response (Replit)
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullContent += data.content;
                setStreamingContent(fullContent);
              }
              if (data.done) {
                const assistantMessage: Message = {
                  id: `assistant-${Date.now()}`,
                  role: "assistant",
                  content: fullContent,
                };
                setMessages((prev) => [...prev, assistantMessage]);
                setStreamingContent("");
                setIsStreaming(false);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  const hasMessages = messages.length > 0 || isStreaming;

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-xl" data-testid="header">
        <BagSenseLogo size="sm" />
        <div className="flex items-center gap-2">
          {authenticated && watchlist.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-accent"
              onClick={() => handleSend(`Check my watchlist: ${watchlist.map(t => t.address).join(", ")}`)}
              data-testid="button-watchlist"
            >
              <Star className="h-4 w-4" />
              <span className="hidden sm:inline">{watchlist.length} Watching</span>
            </Button>
          )}
          {authenticated && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={() => handleSend("What's trending right now?")}
              data-testid="button-trending"
            >
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Trending</span>
            </Button>
          )}
          {authenticated && messages.length > 0 && (
            <Button
              size="icon"
              variant="ghost"
              onClick={clearChat}
              data-testid="button-clear-chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {authenticated ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={logout}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="default"
              className="gap-1.5"
              onClick={login}
              data-testid="button-login"
            >
              <Mail className="h-4 w-4" />
              <span>Sign In</span>
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">
        {hasMessages ? (
          <ScrollArea className="h-full px-4" ref={scrollRef}>
            <div className="max-w-3xl mx-auto py-6 space-y-6 pb-4">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  onAddToWatchlist={(token) => {
                    if (!watchlist.find(t => t.address === token.address)) {
                      setWatchlist(prev => [...prev, { ...token, addedAt: Date.now() }]);
                    }
                  }}
                  watchlist={watchlist}
                />
              ))}
              {isStreaming && streamingContent && (
                <ChatMessage
                  role="assistant"
                  content={streamingContent}
                  isStreaming
                  watchlist={watchlist}
                />
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="h-full overflow-y-auto">
            <WelcomeScreen onSuggestionClick={handleSend} />
          </div>
        )}
      </div>

      <div className="flex-shrink-0 px-4 pb-6 pt-3 bg-background border-t border-border safe-area-bottom">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            onSend={handleSend}
            disabled={isStreaming}
            placeholder={authenticated ? "Paste a token address or ask about trends..." : "Sign in to start chatting..."}
          />
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            BagSense AI can make mistakes. Verify important info.
          </p>
        </div>
      </div>
    </div>
  );
}
