import { characterThemes, type CharacterTheme } from '@/domain/entities/characterTheme'

export function CharacterThemePicker({ value = 'amber', label = 'Cor do personagem' }: { value?: CharacterTheme; label?: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {characterThemes.map((theme) => (
          <label key={theme.id} data-character-theme={theme.id} className="cursor-pointer">
            <input type="radio" name="theme" value={theme.id} defaultChecked={value === theme.id} className="peer sr-only" />
            <span className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
              <span aria-hidden="true" className="size-4 rounded-full bg-primary" />
              {theme.label}
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Define a cor dos destaques e da iluminação da página.</p>
    </fieldset>
  )
}
