import { useState } from "react";
import type { ContractSummary } from "@/lib/types";
import { isValidContractId } from "@/lib/compare";

interface ContractSelectorProps {
  selected: string[];
  onSelect: (ids: string[]) => void;
  contracts: ContractSummary[];
  max?: number;
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

export function ContractSelector({
  selected,
  onSelect,
  contracts,
  max = 4,
}: ContractSelectorProps) {
  const [manualInput, setManualInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  const byId = new Map(contracts.map((c) => [c.id, c]));
  const slots = Array.from({ length: max }, (_, i) => selected[i] ?? null);

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onSelect(selected.filter((s) => s !== id));
    } else if (selected.length < max) {
      onSelect([...selected, id]);
    }
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualInput.trim().toUpperCase();
    if (!trimmed) return;
    if (!isValidContractId(trimmed, contracts)) {
      setInputError(
        "Contract ID must start with 'C' and be 56 uppercase alphanumeric characters."
      );
      return;
    }
    if (selected.includes(trimmed)) {
      setInputError("Contract ID is already in comparison.");
      return;
    }
    if (selected.length >= max) {
      setInputError(`Maximum of ${max} contracts can be compared.`);
      return;
    }
    setInputError(null);
    setManualInput("");
    onSelect([...selected, trimmed]);
  };

  const clear = () => {
    setInputError(null);
    onSelect([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Contract slots
        </h2>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {slots.map((id, i) => {
          const contract = id ? byId.get(id) : undefined;
          const isInvalid = id ? !isValidContractId(id, contracts) : false;
          return (
            <div
              key={id ?? `empty-slot-${i}`}
              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                id
                  ? isInvalid
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-300"
                    : "border-[var(--color-accent)] bg-[var(--color-bg-card)]"
                  : "border-dashed border-[var(--color-border)]"
              }`}
              data-testid={id ? "compare-slot-filled" : "compare-slot-empty"}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="min-w-0 truncate text-[var(--color-text-secondary)]"
                  title={id ?? undefined}
                >
                  {id ? (contract?.label ?? shortId(id)) : `Slot ${i + 1}`}
                </span>
                {id && isInvalid && (
                  <span
                    data-testid="invalid-slot-badge"
                    className="shrink-0 rounded bg-amber-500/20 px-1 py-0.5 text-[10px] text-amber-300 font-medium"
                  >
                    Invalid
                  </span>
                )}
              </div>
              {id && (
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  aria-label={`Remove ${id}`}
                  className="shrink-0 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      <form
        onSubmit={handleAddManual}
        className="flex flex-col gap-1 sm:flex-row sm:items-center"
      >
        <div className="flex flex-1 gap-2">
          <input
            type="text"
            placeholder="Add contract by ID (e.g. C...)"
            value={manualInput}
            onChange={(e) => {
              setManualInput(e.target.value);
              if (inputError) setInputError(null);
            }}
            data-testid="manual-contract-input"
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs font-mono text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!manualInput.trim() || selected.length >= max}
            data-testid="add-contract-btn"
            className="rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add to compare
          </button>
        </div>
        {inputError && (
          <span
            className="text-xs text-amber-400"
            role="alert"
            data-testid="manual-input-error"
          >
            {inputError}
          </span>
        )}
      </form>

      <p className="text-sm text-[var(--color-text-secondary)]">
        Select 2–{max} contracts to compare
      </p>

      <div className="flex flex-wrap gap-2">
        {contracts.map((c) => {
          const isSelected = selected.includes(c.id);
          const isDisabled = !isSelected && selected.length >= max;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              disabled={isDisabled}
              title={c.id}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                isSelected
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg-page)]"
                  : isDisabled
                    ? "cursor-not-allowed border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] opacity-50"
                    : "border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)]"
              }`}
            >
              {c.label ?? c.id}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <span>
            {selected.length}/{max} selected
          </span>
          <span className="text-[var(--color-text-secondary)]">
            {selected.length >= 2
              ? "Ready to compare"
              : "Select at least 2 contracts"}
          </span>
        </div>
      )}
    </div>
  );
}
