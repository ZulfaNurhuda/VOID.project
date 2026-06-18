import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyButtonProps {
  value: string;
  className?: string;
}

export function CopyButton({ value, className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1 rounded text-void-muted hover:text-void-text transition-colors duration-150 ${className}`}
      title="Copy to clipboard"
    >
      {copied
        ? <Check size={14} className="text-void-success" />
        : <Copy size={14} />
      }
    </button>
  );
}
