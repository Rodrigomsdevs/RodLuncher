import { UserRound } from 'lucide-react';

interface NicknameInputProps {
  value: string;
  isValid: boolean;
  onChange: (value: string) => void;
}

export default function NicknameInput({ value, isValid, onChange }: NicknameInputProps) {
  const showError = value.length > 0 && !isValid;

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
        Nickname
      </label>
      <div
        className={`flex items-center gap-3 rounded-xl border bg-white/[0.03] px-3.5 py-3 transition-colors focus-within:bg-white/[0.05] ${
          showError
            ? 'border-ember/50 focus-within:border-ember/70'
            : isValid && value.length > 0
              ? 'border-moss/40 focus-within:border-moss/60'
              : 'border-white/[0.07] focus-within:border-white/20'
        }`}
      >
        <UserRound className="h-4 w-4 shrink-0 text-white/25" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Seu nick"
          spellCheck={false}
          maxLength={16}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/20"
        />
        {value.length > 0 && (
          <span
            className={`shrink-0 text-xs font-bold tabular-nums ${isValid ? 'text-moss/70' : 'text-ember/70'}`}
          >
            {value.length}/16
          </span>
        )}
      </div>
      {showError && (
        <p className="mt-1.5 text-[11px] text-ember/80">
          3–16 caracteres: letras, números e underline.
        </p>
      )}
    </div>
  );
}
