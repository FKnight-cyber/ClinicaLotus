type ButtonSpinnerProps = {
  label?: string;
};

export function ButtonSpinner({ label = "Carregando" }: ButtonSpinnerProps) {
  return <span aria-label={label} className="button-spinner" role="status" />;
}
