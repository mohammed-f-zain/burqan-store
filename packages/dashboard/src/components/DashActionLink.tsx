import { Link } from "react-router-dom";

type Props = {
  to: string;
  children: React.ReactNode;
  variant?: "default" | "accent" | "ghost";
};

export default function DashActionLink({ to, children, variant = "default" }: Props) {
  return (
    <Link to={to} className={`dash-action-link dash-action-link--${variant}`}>
      <span>{children}</span>
      <span className="dash-action-link-arrow" aria-hidden>
        ←
      </span>
    </Link>
  );
}
