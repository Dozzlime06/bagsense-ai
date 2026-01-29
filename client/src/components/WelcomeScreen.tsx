import { BagSenseLogo } from "./BagSenseLogo";
import { TrendingUp, Shield, Zap, AlertTriangle, BarChart3, Search } from "lucide-react";

interface SuggestionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

function Suggestion({ icon, title, description, onClick }: SuggestionProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl bg-card/50 border border-card-border hover-elevate active-elevate-2 text-left transition-all group"
      data-testid={`suggestion-${title.toLowerCase().replace(/\s/g, "-")}`}
    >
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center flex-shrink-0 group-hover:from-primary/30 group-hover:to-accent/20 transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-xs sm:text-sm text-foreground">{title}</h3>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
      </div>
    </button>
  );
}

interface WelcomeScreenProps {
  onSuggestionClick: (message: string) => void;
}

export function WelcomeScreen({ onSuggestionClick }: WelcomeScreenProps) {
  const suggestions = [
    {
      icon: <TrendingUp size={18} className="text-primary" />,
      title: "What's Hot",
      description: "Show me trending tokens right now",
      message: "What's trending right now? Show me some tokens to look at.",
    },
    {
      icon: <Search size={18} className="text-accent" />,
      title: "Analyze Token",
      description: "Paste any token address for full breakdown",
      message: "I want to analyze a token. What should I paste?",
    },
    {
      icon: <AlertTriangle size={18} className="text-yellow-500" />,
      title: "Red Flags",
      description: "How to spot rugs before they happen",
      message: "What are the red flags to look for before buying a token?",
    },
    {
      icon: <BarChart3 size={18} className="text-primary" />,
      title: "Compare Tokens",
      description: "Compare multiple tokens side by side",
      message: "How do I compare multiple tokens? Can you help me evaluate them?",
    },
    {
      icon: <Zap size={18} className="text-accent" />,
      title: "Bonding Curve",
      description: "How token pricing works on bags.fm",
      message: "Explain how the bonding curve works on bags.fm",
    },
    {
      icon: <Shield size={18} className="text-primary" />,
      title: "Creator Check",
      description: "How to vet token creators",
      message: "How do I check if a token creator is legit?",
    },
  ];

  return (
    <div className="flex flex-col items-center px-4 py-6 pb-2" data-testid="welcome-screen">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <BagSenseLogo size="lg" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              Your Bags.fm Trading Assistant
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto text-xs sm:text-sm">
              Real-time token analysis, risk scoring, and market insights. 
              Paste any token address or ask me what's trending.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {suggestions.map((suggestion) => (
            <Suggestion
              key={suggestion.title}
              icon={suggestion.icon}
              title={suggestion.title}
              description={suggestion.description}
              onClick={() => onSuggestionClick(suggestion.message)}
            />
          ))}
        </div>

        <div className="text-center pb-2">
          <p className="text-xs text-muted-foreground">
            Pro tip: Paste a Solana token address for instant analysis
          </p>
        </div>
      </div>
    </div>
  );
}
