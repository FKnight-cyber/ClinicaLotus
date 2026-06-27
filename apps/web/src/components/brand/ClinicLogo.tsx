import { clinicLogoSvg } from "./clinicLogoSvg";

type ClinicLogoProps = {
  className?: string;
  title?: string;
};

export function ClinicLogo({ className, title = "Flor de Lótus" }: ClinicLogoProps) {
  return (
    <span className={className} role="img" aria-label={title} dangerouslySetInnerHTML={{ __html: clinicLogoSvg }} />
  );
}