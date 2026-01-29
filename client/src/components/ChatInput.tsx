import { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [message]);

  const handleSubmit = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative" data-testid="chat-input-container">
      <div className="flex items-end gap-2 p-4 bg-card/50 backdrop-blur-sm border border-border rounded-2xl">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Ask me anything about bags.fm..."}
          disabled={disabled}
          className="flex-1 min-h-[44px] max-h-[150px] resize-none border-0 bg-transparent focus-visible:ring-0 text-sm"
          rows={1}
          data-testid="input-message"
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!message.trim() || disabled}
          className="flex-shrink-0 rounded-xl"
          data-testid="button-send"
        >
          {disabled ? (
            <Sparkles size={18} className="animate-pulse" />
          ) : (
            <Send size={18} />
          )}
        </Button>
      </div>
      <div className="flex justify-center mt-2">
        <span className="text-xs text-muted-foreground">
          BagSense AI can make mistakes. Verify important info.
        </span>
      </div>
    </div>
  );
}
