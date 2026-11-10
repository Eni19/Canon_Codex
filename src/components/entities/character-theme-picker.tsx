'use client'

import { characterThemes, type CharacterTheme } from '@/domain/entities/characterTheme'

/** Compact swatch row; `onChange` lets the form re-tint itself live with the chosen color. */
export function CharacterThemePicker({
  value = 'amber',
  label = 'Cor do personagem',
  onChange,
}: {
  value?: CharacterTheme
  label?: string
  onChange?: (theme: CharacterTheme) => void
}) {
  const current = characterThemes.find((theme) => theme.id === value)
  return (
    <fieldset>
      <legend className="flex w-full items-baseline justify-between text-sm font-medium">
        {label}<span className="text-xs font-normal text-muted-foreground">{current?.label}</span>
      </legend>
      <div className="mt-2.5 flex gap-2.5">
        {characterThemes.map((theme) => (
          <label key={theme.id} data-character-theme={theme.id} className="cursor-pointer" title={theme.label}>
            <input type="radio" name="theme" value={theme.id} checked={value === theme.id} onChange={() => onChange?.(theme.id)} className="peer sr-only" aria-label={theme.label}/>
            <span
              aria-hidden
              className="block size-7 rounded-full bg-primary ring-offset-2 ring-offset-background transition-[transform,box-shadow] duration-150 ease-out hover:scale-110 active:scale-95 peer-checked:ring-2 peer-checked:ring-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
            />
          </label>
        ))}
      </div>
      <p className="mt-2.5 text-xs text-muted-foreground">Define a cor dos destaques e da iluminação da página.</p>
    </fieldset>
  )
}
