export const clinicLogoSvg = `<svg viewBox="0 0 112 92" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="27" cy="16" r="5" stroke="#209FDD" stroke-width="6" />
  <circle cx="56" cy="8" r="5" stroke="#209FDD" stroke-width="6" />
  <circle cx="85" cy="16" r="5" stroke="#209FDD" stroke-width="6" />
  <path d="M56 78C37 59 35 31 56 15C77 31 75 59 56 78Z" stroke="#209FDD" stroke-width="6" stroke-linejoin="round" />
  <path d="M35 78C13 71 7 44 23 27C47 34 52 58 35 78Z" stroke="#209FDD" stroke-width="6" stroke-linejoin="round" />
  <path d="M77 78C99 71 105 44 89 27C65 34 60 58 77 78Z" stroke="#209FDD" stroke-width="6" stroke-linejoin="round" />
  <path d="M18 84C35 90 77 90 94 84" stroke="#209FDD" stroke-width="6" stroke-linecap="round" />
</svg>`;

export function getClinicLogoDataUrl() {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clinicLogoSvg)}`;
}