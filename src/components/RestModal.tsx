import React, { useState } from 'react';
import { Flame, Moon, Sun, X } from 'lucide-react';
import type { CharacterSheet } from '../types/dnd';
import { CLASS_MAP } from '../data/classes';
import {
  applyLongRest,
  applyShortRest,
  calculateMaxHP,
  formatSigned,
  getAbilityMod,
  rollDie,
} from '../rules/engine';
import { MiniD20Button } from './MiniD20Button';

interface RestModalProps {
  mode: 'curto' | 'longo' | null;
  sheet: CharacterSheet;
  onClose: () => void;
  onApplyRest: (updated: CharacterSheet, message: string) => void;
}

export const RestModal: React.FC<RestModalProps> = ({
  mode,
  sheet,
  onClose,
  onApplyRest,
}) => {
  const [rollsLog, setRollsLog] = useState<{ die: number; total: number }[]>([]);

  if (!mode) return null;

  const cls = CLASS_MAP[sheet.classeId];
  const hitDieSize = cls?.hitDie ?? 8;
  const conMod = getAbilityMod(sheet.atributos.con);
  const maxHp = calculateMaxHP(sheet);
  const availableHitDice = Math.max(0, sheet.nivel - sheet.dvGasto - rollsLog.length);
  const totalRolledHealing = rollsLog.reduce((s, r) => s + r.total, 0);

  const handleRollHitDieForShortRest = () => {
    if (availableHitDice <= 0) return;
    const raw = rollDie(hitDieSize);
    const healed = Math.max(1, raw + conMod);
    setRollsLog((prev) => [...prev, { die: raw, total: healed }]);
  };

  const handleConfirmShortRest = () => {
    const next = applyShortRest(sheet, totalRolledHealing, rollsLog.length);
    setRollsLog([]);
    onApplyRest(
      next,
      `Descanso Curto concluído (+${totalRolledHealing} PV, ${rollsLog.length} DV gasto(s)).`
    );
    onClose();
  };

  const handleConfirmLongRest = () => {
    const next = applyLongRest(sheet);
    onApplyRest(
      next,
      'Descanso Longo (2024) concluído: PV cheio, todos os Dados de Vida e Espaços recuperados.'
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1A1816]/60 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rest-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-[#FDFCFA] border border-[#C8BFB0] rounded-t-xl sm:rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E3DDD2] bg-[#F7F4EC]">
          <div className="flex items-center gap-2">
            {mode === 'curto' ? (
              <Sun className="w-5 h-5 text-[#8A6518]" />
            ) : (
              <Moon className="w-5 h-5 text-[#1A1816]" />
            )}
            <h2 id="rest-modal-title" className="font-display text-lg font-bold text-[#1A1816]">
              {mode === 'curto' ? 'Descanso Curto (1 hora)' : 'Descanso Longo (8 horas)'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de descanso"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded text-[#6B6258] hover:bg-[#EAE4D7] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm text-[#3F3934]">
          {mode === 'curto' ? (
            <>
              <div className="p-3.5 rounded border border-[#E3DDD2] bg-[#FAF8F3] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[#1A1816]">Gastar Dados de Vida</p>
                    <p className="text-xs text-[#6B6258]">
                      Disponíveis: <strong className="font-mono">{availableHitDice}</strong> (1d{hitDieSize}{' '}
                      {formatSigned(conMod)} CON)
                    </p>
                  </div>
                  <MiniD20Button
                    size="md"
                    variant="brass"
                    label={`Rolar 1d${hitDieSize}`}
                    ariaLabel="Rolar 1 Dado de Vida no Descanso Curto"
                    onClick={handleRollHitDieForShortRest}
                  />
                </div>

                {rollsLog.length > 0 && (
                  <div className="pt-2 border-t border-[#E3DDD2] text-xs font-mono space-y-1">
                    {rollsLog.map((r, i) => (
                      <div key={i} className="flex justify-between">
                        <span>
                          DV #{i + 1}: d{hitDieSize} [{r.die}] {formatSigned(conMod)}
                        </span>
                        <span className="font-bold text-[#1F6B43]">+{r.total} PV</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold pt-1 border-t border-[#E3DDD2]">
                      <span>PV previsto:</span>
                      <span>
                        {Math.min(maxHp, sheet.pvAtual + totalRolledHealing)} / {maxHp}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1 text-xs text-[#574E46]">
                <p className="font-bold text-[#1A1816]">Recursos recuperados (Regras 2024):</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {sheet.espacosPacto.total > 0 && (
                    <li>Todos os Espaços de Magia de Pacto ({sheet.espacosPacto.total}).</li>
                  )}
                  {sheet.recursosClasse
                    .filter((r) => r.resetOn !== 'longo')
                    .map((r) => (
                      <li key={r.id}>
                        {r.name}:{' '}
                        {r.resetOn === 'curto' ? 'recupera todos os usos' : '+1 uso recuperado'}.
                      </li>
                    ))}
                  {(sheet.recursosEspecie ?? [])
                    .filter((r) => r.resetOn === 'curto')
                    .map((r) => (
                      <li key={r.id}>
                        {r.name} (Espécie): recupera todos os usos.
                      </li>
                    ))}
                  {sheet.espacosPacto.total === 0 &&
                    sheet.recursosClasse.filter((r) => r.resetOn !== 'longo').length === 0 &&
                    (sheet.recursosEspecie ?? []).filter((r) => r.resetOn === 'curto').length === 0 && (
                      <li>Recuperação de PV por Dados de Vida.</li>
                    )}
                </ul>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[42px] px-4 rounded border border-[#C8BFB0] text-xs font-semibold text-[#4D453E] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  data-testid="confirm-short-rest-btn"
                  onClick={handleConfirmShortRest}
                  className="min-h-[42px] px-4 rounded bg-[#8A6518] text-white text-xs font-semibold hover:bg-[#705010] cursor-pointer"
                >
                  Concluir Descanso Curto
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="p-3.5 rounded border border-[#E3DDD2] bg-[#FAF8F3] space-y-2 text-xs">
                <p className="font-bold text-[#1A1816] flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-[#9E1B1B]" />
                  Regras Oficiais de Descanso Longo (D&D 2024)
                </p>
                <ul className="list-disc list-inside space-y-1 text-[#4D453E]">
                  <li>
                    Pontos de Vida restaurados ao máximo (<strong>{maxHp} PV</strong>).
                  </li>
                  <li>
                    <strong>Todos</strong> os Dados de Vida gastos ({sheet.dvGasto}) são recuperados.
                  </li>
                  <li>Todos os Espaços de Magia, Recursos de Classe e Traços de Espécie são restaurados.</li>
                  {sheet.especieId === 'humano' && (
                    <li className="text-[#7A5610] font-semibold">
                      Humano (Inventivo): Inspiração Heroica restaurada.
                    </li>
                  )}
                  <li>PV Temporários expiram (zerados).</li>
                  {sheet.nivelExaustao > 0 && (
                    <li className="text-[#1F6B43] font-semibold">
                      Exaustão reduzida em 1 nível ({sheet.nivelExaustao} → {sheet.nivelExaustao - 1}).
                    </li>
                  )}
                </ul>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[42px] px-4 rounded border border-[#C8BFB0] text-xs font-semibold text-[#4D453E] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  data-testid="confirm-long-rest-btn"
                  onClick={handleConfirmLongRest}
                  className="min-h-[42px] px-4 rounded bg-[#1A1816] text-white text-xs font-semibold hover:bg-[#332E2A] cursor-pointer"
                >
                  Concluir Descanso Longo
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
