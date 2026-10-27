/* 입력하는 동안 콤마가 붙는 숫자 입력칸. 값은 blur·엔터 때 onCommit으로 넘긴다. */
import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { formatInput, parseInput } from '../lib/format';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | null | '';
  onCommit: (v: number | null) => void;
  allowNegative?: boolean;
  /** 입력 중 값이 바뀔 때마다 (저장 전) */
  onDraft?: (v: number | null) => void;
};

const show = (v: number | null | '', neg: boolean) => (v === '' || v == null ? '' : formatInput(String(v), neg));

export function NumInput({ value, onCommit, onDraft, allowNegative = false, className = 'in', onBlur, onKeyDown, ...rest }: Props) {
  const [text, setText] = useState(() => show(value, allowNegative));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(show(value, allowNegative));
  }, [value, focused, allowNegative]);

  const commit = () => {
    const n = parseInput(text);
    const before = value === '' ? null : value;
    if (n !== before) onCommit(n);
  };

  return (
    <input
      {...rest}
      className={className}
      type="text"
      inputMode={allowNegative ? 'text' : 'numeric'}
      autoComplete="off"
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const t = formatInput(e.target.value, allowNegative);
        setText(t);
        onDraft?.(parseInput(t));
      }}
      onBlur={(e) => {
        setFocused(false);
        commit();
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        onKeyDown?.(e);
      }}
    />
  );
}
