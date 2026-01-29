import logoImage from "@/assets/logo.png";

interface BagSenseLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function BagSenseLogo({ size = "md", showText = true }: BagSenseLogoProps) {
  const sizeClasses = {
    sm: "w-9 h-9",
    md: "w-11 h-11",
    lg: "w-16 h-16",
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
  };

  return (
    <div className="flex items-center gap-2.5" data-testid="bagsense-logo">
      <img 
        src={logoImage} 
        alt="BagSense Logo"
        className={`${sizeClasses[size]} rounded-xl shadow-lg shadow-primary/20 object-cover`}
      />
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className={`${textSizes[size]} font-bold tracking-tight`}>
            <span className="text-primary">Bag</span>
            <span className="text-foreground">Sense</span>
          </span>
          <span className="text-[10px] text-muted-foreground tracking-wide uppercase">
            AI Trading Assistant
          </span>
        </div>
      )}
    </div>
  );
}
