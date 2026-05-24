import { BadgeCheck, UserRound, XCircle } from 'lucide-react';

interface NicknameInputProps {
  value: string;
  isValid: boolean;
  onChange: (value: string) => void;
}

export default function NicknameInput({ value, isValid, onChange }: NicknameInputProps) {
  const showValidation = value.length > 0;

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-zinc-200">Nickname</span>
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 shadow-inner shadow-black/20 transition focus-within:border-moss/60 focus-within:bg-black/30">
        <UserRound className="h-5 w-5 shrink-0 text-moss" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Seu nick"
          spellCheck={false}
          maxLength={16}
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-white outline-none placeholder:text-zinc-500"
        />
        {showValidation ? (
          isValid ? (
            <BadgeCheck className="h-5 w-5 shrink-0 text-moss" />
          ) : (
            <XCircle className="h-5 w-5 shrink-0 text-ember" />
          )
        ) : null}
      </div>
      <div className="mt-2 h-4 text-xs text-zinc-500">
        {showValidation && !isValid ? '3-16 caracteres: letras, numeros e underline.' : null}
      </div>
    </label>
  );
}
