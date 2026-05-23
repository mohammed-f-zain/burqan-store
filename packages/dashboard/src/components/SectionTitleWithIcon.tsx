import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function SectionTitleWithIcon({ icon, children, className = "" }: Props) {
  return (
    <h2 className={`section-title-icon ${className}`.trim()}>
      <span className="section-title-icon__glyph" aria-hidden>
        {icon}
      </span>
      <span>{children}</span>
    </h2>
  );
}
