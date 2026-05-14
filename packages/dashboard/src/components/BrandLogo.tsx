/** Served from `public/assets/`. Replace the file or change `LOGO_SRC` if you rename. */
const LOGO_SRC = "/assets/burqanlogo.png";

type Props = {
  className?: string;
};

export default function BrandLogo({ className }: Props) {
  return (
    <img
      src={LOGO_SRC}
      width={160}
      height={48}
      alt=""
      className={className ? `brand-logo ${className}` : "brand-logo"}
      decoding="async"
    />
  );
}
