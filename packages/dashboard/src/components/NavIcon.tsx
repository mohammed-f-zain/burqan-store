export type NavIconName =
  | "overview"
  | "account"
  | "roles"
  | "admins"
  | "areas"
  | "routeZones"
  | "products"
  | "redeem"
  | "representatives"
  | "fillCar"
  | "stores"
  | "loyaltyStores"
  | "possibleClients"
  | "visits"
  | "orders"
  | "qrPool";

type Props = {
  name: NavIconName;
  size?: number;
  className?: string;
};

export default function NavIcon({ name, size = 20, className = "" }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className: `nav-icon ${className}`.trim(),
    "aria-hidden": true as const,
  };

  switch (name) {
    case "overview":
      return (
        <svg {...common}>
          <path d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-8.5z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        </svg>
      );
    case "account":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.75" />
          <path d="M5 19c0-3.3 3.1-5 7-5s7 1.7 7 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "roles":
      return (
        <svg {...common}>
          <path d="M12 3l7 4v5c0 4.2-3 7.5-7 9-4-1.5-7-4.8-7-9V7l7-4z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "admins":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.75" />
          <path d="M3 19c0-2.8 2.7-4 6-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M16 11h5M18.5 8.5v5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="17" cy="17" r="2.5" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      );
    case "areas":
      return (
        <svg {...common}>
          <path d="M12 21s7-4.5 7-11a7 7 0 10-14 0c0 6.5 7 11 7 11z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      );
    case "routeZones":
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h10M4 18h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="18" cy="12" r="2" fill="currentColor" />
          <circle cx="8" cy="18" r="2" fill="currentColor" />
        </svg>
      );
    case "products":
      return (
        <svg {...common}>
          <path d="M4 7l8-4 8 4v10l-8 4-8-4V7z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M12 11v10M4 7l8 4 8-4" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        </svg>
      );
    case "redeem":
      return (
        <svg {...common}>
          <rect x="4" y="8" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
          <path d="M12 8v12M4 12h16" stroke="currentColor" strokeWidth="1.75" />
          <path d="M12 8c0-2 1.5-4 4-4M12 8c0-2-1.5-4-4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "representatives":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.75" />
          <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.75" />
          <path d="M3 19c0-2.5 2.7-4 6-4M14 19c0-1.8 1.8-3 4-3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "fillCar":
      return (
        <svg {...common}>
          <path d="M3 13h1l2-5h12l2 5h1v4h-2M6 17h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="7.5" cy="17" r="1.5" fill="currentColor" />
          <circle cx="16.5" cy="17" r="1.5" fill="currentColor" />
          <path d="M5 10h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "stores":
      return (
        <svg {...common}>
          <path d="M4 10l8-6 8 6v9H4v-9z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M9 19v-6h6v6" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        </svg>
      );
    case "loyaltyStores":
      return (
        <svg {...common}>
          <path d="M12 3l2.2 4.5 5 .7-3.6 3.5.85 5L12 14.8 7.55 16.7l.85-5L4.8 8.2l5-.7L12 3z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        </svg>
      );
    case "possibleClients":
      return (
        <svg {...common}>
          <circle cx="10" cy="9" r="3" stroke="currentColor" strokeWidth="1.75" />
          <path d="M4 19c0-2.5 2.7-4 6-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M19 8v6M16 11h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "visits":
      return (
        <svg {...common}>
          <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
          <path d="M9 9h6M9 13h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M15 15l3 3M18 15l-3 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "orders":
      return (
        <svg {...common}>
          <path d="M7 4h10l3 5v11H4V9l3-5z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M7 4v5h13M9 14h6M9 17h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "qrPool":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75" />
          <rect x="13" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75" />
          <rect x="4" y="13" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75" />
          <path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h1v1h-1z" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}
