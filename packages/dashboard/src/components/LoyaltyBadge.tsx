import LoyaltyIcon from "./LoyaltyIcon";

type Variant = "balance" | "earn" | "inline" | "pill";

type Props = {
  text: string;
  variant?: Variant;
  icon?: "balance" | "earn" | "star" | "plus";
};

export default function LoyaltyBadge({ text, variant = "pill", icon = "star" }: Props) {
  return (
    <span className={`loyalty-badge loyalty-badge--${variant}`}>
      <LoyaltyIcon kind={icon} size={variant === "balance" ? 26 : variant === "earn" ? 22 : 18} />
      <span className="loyalty-badge__text">{text}</span>
    </span>
  );
}
