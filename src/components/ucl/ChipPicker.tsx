import { Zap, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  chips: string[];
  chip: string | null;
  onChipChange: (chip: string | null) => void;
  usedChips: string[];
  onUsedChipsChange: (chips: string[]) => void;
  compact?: boolean;
}

/**
 * Chips, in two questions.
 *
 * What is already spent is a fact about the season: a used chip leaves the
 * options and can no longer be recommended. What is being played this round is
 * a decision, and the analysis judges it rather than proposing an alternative.
 *
 * Shared by the import screen, the builder and the result, so a manager can set
 * it before the analysis runs or change it after seeing the score.
 */
const ChipPicker = ({
  chips,
  chip,
  onChipChange,
  usedChips,
  onUsedChipsChange,
  compact = false,
}: Props) => {
  const { t } = useLanguage();
  if (chips.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card/60 p-3 text-left">
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Zap className="h-3.5 w-3.5" />
          {t('ucl.playAChip')}
        </div>
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
          <button
            type="button"
            onClick={() => onChipChange(null)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs transition-colors ${
              !chip ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {t('ucl.noChip')}
          </button>
          {chips
            .filter((c) => !usedChips.includes(c))
            .map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChipChange(c)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs transition-colors ${
                  chip === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {c}
              </button>
            ))}
        </div>
      </div>

      {!compact && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t('ucl.chipsUsed')}
          </div>
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
            {chips.map((c) => {
              const on = usedChips.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    const next = on ? usedChips.filter((x) => x !== c) : [...usedChips, c];
                    onUsedChipsChange(next);
                    // A chip cannot be both spent and planned.
                    if (!on && chip === c) onChipChange(null);
                  }}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs transition-colors ${
                    on
                      ? 'bg-muted-foreground/30 text-foreground line-through'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChipPicker;
