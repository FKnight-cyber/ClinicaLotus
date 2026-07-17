"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";

type FilterButtonProps = {
  activeCount?: number;
  onClick: () => void;
};

type ClearFiltersButtonProps = {
  disabled?: boolean;
  onClick: () => void;
};

export function FilterButton({ activeCount = 0, onClick }: FilterButtonProps) {
  return (
    <button className={`secondary-button filter-action-button ${activeCount > 0 ? "has-active-filters" : ""}`} onClick={onClick} type="button">
      <SlidersHorizontal aria-hidden="true" size={16} />
      Filtros
      {activeCount > 0 ? <span>{activeCount}</span> : null}
    </button>
  );
}

export function ClearFiltersButton({ disabled = false, onClick }: ClearFiltersButtonProps) {
  return (
    <button className="secondary-button filter-action-button" disabled={disabled} onClick={onClick} type="button">
      <RotateCcw aria-hidden="true" size={16} />
      Limpar filtros
    </button>
  );
}
