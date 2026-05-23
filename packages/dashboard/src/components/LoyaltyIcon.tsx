type Kind = "balance" | "earn" | "star" | "plus";

type Props = {
  kind: Kind;
  size?: number;
  className?: string;
  title?: string;
};

export default function LoyaltyIcon({ kind, size = 22, className = "", title }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className: `loyalty-icon ${className}`.trim(),
    "aria-hidden": title ? undefined : true,
    role: title ? "img" : undefined,
  };

  if (kind === "balance") {
    return (
      <svg {...common}>
        {title ? <title>{title}</title> : null}
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
        <path
          d="M8 12h8M12 8v8"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      </svg>
    );
  }

  if (kind === "earn") {
    return (
      <svg {...common}>
        {title ? <title>{title}</title> : null}
        <path
          d="M12 3l1.4 4.3H18l-3.6 2.6 1.4 4.3L12 11.6 8.2 14.2l1.4-4.3L6 7.3h4.6L12 3z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (kind === "plus") {
    return (
      <svg {...common}>
        {title ? <title>{title}</title> : null}
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
        <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      {title ? <title>{title}</title> : null}
      <path
        d="M12 2l2.35 4.76 5.25.77-3.8 3.7.9 5.23L12 14.77l-4.7 2.47.9-5.23-3.8-3.7 5.25-.77L12 2z"
        fill="currentColor"
      />
    </svg>
  );
}
