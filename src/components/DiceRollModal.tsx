import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Dices, Flame, RotateCcw, Sparkles, Swords, X } from 'lucide-react';
import type {
  CharacterSheet,
  ExtraDamageOption,
  RollMode,
  RollRequest,
  RollResult,
} from '../types/dnd';
import {
  executeCombinedDamageRoll,
  executeD20Roll,
  formatSigned,
  getAvailableExtraDamageOptions,
  getExhaustionD20Penalty,
  parseAndRollDiceFormula,
  resolveConditionHintForRoll,
} from '../rules/engine';

interface DiceRollModalProps {
  request: RollRequest | null;
  sheet: CharacterSheet;
  onClose: () => void;
  onLogResult: (result: RollResult) => void;
  onConsumeHeroicInspiration?: () => void;
}

const SITUATIONAL_PRESETS = [
  { id: 'none', label: 'Nenhum', dice: '', flat: 0 },
  { id: 'bencao', label: 'Bênção (+1d4)', dice: '+1d4', flat: 0 },
  { id: 'orientacao', label: 'Orientação (+1d4)', dice: '+1d4', flat: 0 },
  { id: 'perdicao', label: 'Perdição (-1d4)', dice: '-1d4', flat: 0 },
  { id: 'insp_d6', label: 'Inspiração (+1d6)', dice: '+1d6', flat: 0 },
  { id: 'insp_d8', label: 'Inspiração (+1d8)', dice: '+1d8', flat: 0 },
  { id: 'meia_cobertura', label: '+2', dice: '', flat: 2 },
  { id: 'pen_2', label: '-2', dice: '', flat: -2 },
];

export const DiceRollModal: React.FC<DiceRollModalProps> = ({
  request,
  sheet,
  onClose,
  onLogResult,
  onConsumeHeroicInspiration,
}) => {
  const [phase, setPhase] = useState<'choose' | 'result'>('choose');
  const [situationalId, setSituationalId] = useState<string>('none');
  const [customFlat, setCustomFlat] = useState<string>('');
  const [result, setResult] = useState<RollResult | null>(null);
  const [isCritDamage, setIsCritDamage] = useState<boolean>(false);

  // Combined damage selection (for attack & spell_attack rolls)
  const [includeBaseDamage, setIncludeBaseDamage] = useState<boolean>(true);
  const [selectedExtraIds, setSelectedExtraIds] = useState<Record<string, boolean>>({});
  const [slotCircles, setSlotCircles] = useState<Record<string, number>>({});
  const [adHocDamage, setAdHocDamage] = useState<string>('');

  const extraDamageOptions = useMemo<ExtraDamageOption[]>(
    () => getAvailableExtraDamageOptions(sheet),
    [sheet]
  );

  const isDirectDiceRoll = request?.kind === 'damage' || request?.kind === 'hit_die';
  const supportsCombinedDamage = Boolean(
    request &&
      (request.kind === 'attack' ||
        request.kind === 'spell_attack' ||
        request.followUpDamage)
  );

  const conditionHint = useMemo(() => {
    if (!request || isDirectDiceRoll) return null;
    return resolveConditionHintForRoll(sheet, request.kind, request.ability, request.skillKey);
  }, [request, sheet, isDirectDiceRoll]);

  useEffect(() => {
    if (!request) return;
    setPhase('choose');
    setResult(null);
    setSituationalId('none');
    setCustomFlat('');
    setIsCritDamage(false);
    setIncludeBaseDamage(Boolean(request.followUpDamage));
    setAdHocDamage('');

    const initExtras: Record<string, boolean> = {};
    const initCircles: Record<string, number> = {};
    for (const opt of extraDamageOptions) {
      initExtras[opt.id] = Boolean(opt.defaultChecked);
      if (opt.scalableBySlot) {
        initCircles[opt.id] = opt.scalableBySlot.minCircle;
      }
    }
    setSelectedExtraIds(initExtras);
    setSlotCircles(initCircles);
  }, [request, extraDamageOptions]);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request, onClose]);

  if (!request) return null;

  const exhaustionPen = getExhaustionD20Penalty(sheet.nivelExaustao);

  const toggleExtraOption = (id: string) => {
    setSelectedExtraIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const buildSelectedExtrasPayload = () => {
    return extraDamageOptions
      .filter((opt) => selectedExtraIds[opt.id])
      .map((opt) => {
        if (opt.scalableBySlot) {
          const circle = slotCircles[opt.id] ?? opt.scalableBySlot.minCircle;
          const diceCount =
            opt.scalableBySlot.baseDiceCount +
            (circle - opt.scalableBySlot.minCircle) * opt.scalableBySlot.extraDicePerCircle;
          return {
            label: `${opt.label.split('(')[0].trim()} (${circle}º círc. +${diceCount}d${opt.scalableBySlot.dieSides})`,
            diceFormula: `${diceCount}d${opt.scalableBySlot.dieSides}`,
            flatBonus: opt.flatBonus,
            damageType: opt.damageType,
            isCustom: opt.isCustom,
          };
        }
        return {
          label: opt.label,
          diceFormula: opt.diceFormula,
          flatBonus: opt.flatBonus,
          damageType: opt.damageType,
          isCustom: opt.isCustom,
        };
      });
  };

  const commitInstantD20Roll = (mode: RollMode) => {
    const preset = SITUATIONAL_PRESETS.find((p) => p.id === situationalId);
    const parsedFlat = parseInt(customFlat, 10);
    const flatVal = Number.isFinite(parsedFlat) ? parsedFlat : preset?.flat ?? 0;
    const sitLabel = Number.isFinite(parsedFlat)
      ? `Manual (${formatSigned(parsedFlat)})`
      : preset && preset.id !== 'none'
        ? preset.label
        : undefined;

    const computed = executeD20Roll({
      title: request.title,
      kind: request.kind,
      mode,
      modifierBreakdown: request.modifierBreakdown,
      exhaustionLevel: sheet.nivelExaustao,
      situationalLabel: sitLabel,
      situationalDice: Number.isFinite(parsedFlat) ? undefined : preset?.dice || undefined,
      situationalFlat: flatVal,
      critThreshold: request.critThreshold,
    });

    if (supportsCombinedDamage) {
      const selectedExtras = buildSelectedExtrasPayload();
      const shouldRollDamage =
        (includeBaseDamage && Boolean(request.followUpDamage)) ||
        selectedExtras.length > 0 ||
        adHocDamage.trim().length > 0;

      if (shouldRollDamage) {
        computed.combinedDamage = executeCombinedDamageRoll({
          baseDamage: request.followUpDamage,
          includeBaseDamage,
          selectedExtras,
          adHocFormula: adHocDamage,
          isCrit: computed.isCrit,
        });
      }
    }

    setResult(computed);
    setPhase('result');
    onLogResult(computed);
    request.onComplete?.(computed);
  };

  const commitInstantDiceRoll = (crit: boolean) => {
    const formula = request.diceFormula ?? '1d6';
    const selectedExtras = buildSelectedExtrasPayload();
    const hasExtras = selectedExtras.length > 0 || adHocDamage.trim().length > 0;

    if (request.kind === 'damage' && hasExtras) {
      const combined = executeCombinedDamageRoll({
        baseDamage: {
          title: request.title,
          formula,
          bonus: request.modifier,
          damageType: request.damageType ?? 'Dano',
          breakdown: request.modifierBreakdown,
        },
        includeBaseDamage: true,
        selectedExtras,
        adHocFormula: adHocDamage,
        isCrit: crit,
      });

      const computed: RollResult = {
        id: `dmg_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        title: crit ? `${request.title} (CRÍTICO ×2)` : request.title,
        kind: request.kind,
        mode: 'normal',
        rolls: [],
        keptRoll: combined.total,
        total: combined.total,
        isCrit: crit,
        isFumble: false,
        breakdownText: combined.breakdownText,
        damageType: request.damageType,
        combinedDamage: combined,
      };
      setResult(computed);
      setPhase('result');
      onLogResult(computed);
      request.onComplete?.(computed);
      return;
    }

    const rolled = parseAndRollDiceFormula(formula, request.modifier, crit);
    const bonusDetail =
      request.modifierBreakdown.length > 0
        ? request.modifierBreakdown
            .filter((b) => b.value !== 0)
            .map((b) => `${formatSigned(b.value)} (${b.label})`)
            .join(' ')
        : request.modifier !== 0
          ? formatSigned(request.modifier)
          : '';
    const diceOnly = `[${rolled.rolls.join(' + ')}]`;

    const computed: RollResult = {
      id: `dmg_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      title: crit ? `${request.title} (CRÍTICO ×2)` : request.title,
      kind: request.kind,
      mode: 'normal',
      rolls: rolled.rolls,
      keptRoll: rolled.total,
      total: rolled.total,
      isCrit: crit,
      isFumble: false,
      breakdownText: `${crit ? 'Crít. ×2 ' : ''}${formula} ${diceOnly}${bonusDetail ? ` ${bonusDetail}` : ''}${request.damageType ? ` (${request.damageType})` : ''}`,
      damageType: request.damageType,
    };

    setResult(computed);
    setPhase('result');
    onLogResult(computed);
    request.onComplete?.(computed);
  };

  const handleHeroicReroll = () => {
    if (!result || isDirectDiceRoll) return;
    onConsumeHeroicInspiration?.();
    commitInstantD20Roll(result.mode);
  };

  const hasSplitAttackAndDamage = Boolean(
    result && !isDirectDiceRoll && result.combinedDamage && result.combinedDamage.parts.length > 0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1A1816]/65 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dice-modal-title"
      data-testid="dice-roll-modal"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-[#FDFCFA] border border-[#C8BFB0] rounded-t-xl sm:rounded-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[#E3DDD2] bg-[#F7F4EC]">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A6518]">
              {isDirectDiceRoll ? 'Rolagem de Dados' : 'Teste de D20 · Resultado Imediato'}
            </p>
            <h2
              id="dice-modal-title"
              className="font-display text-base sm:text-lg font-bold text-[#1A1816] truncate"
            >
              {request.title}
            </h2>
            {request.subtitle && (
              <p className="text-[11px] text-[#6B6258] truncate">{request.subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de rolagem"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded text-[#6B6258] hover:bg-[#EAE4D7] hover:text-[#1A1816] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 overflow-y-auto">
          {phase === 'choose' && (
            <>
              {/* Modifier Breakdown */}
              <div className="p-2.5 rounded border border-[#E3DDD2] bg-[#FBF9F5] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#6B6258]">
                    {isDirectDiceRoll ? 'Fórmula Base' : 'Modificador Total'}
                  </span>
                  <span className="font-mono font-extrabold text-sm text-[#1A1816] tabular-nums">
                    {isDirectDiceRoll
                      ? `${request.diceFormula}${request.modifier !== 0 ? ` ${formatSigned(request.modifier)}` : ''}`
                      : formatSigned(request.modifier - exhaustionPen)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {request.modifierBreakdown.map((b, idx) => (
                    <span
                      key={idx}
                      className={`px-1.5 py-0.5 text-[10px] font-mono rounded border ${
                        b.isCustom
                          ? 'bg-[#F5ECFF] border-[#C8A6EA] text-[#5B218A] font-bold'
                          : 'bg-white border-[#DDD5C7] text-[#4D453E]'
                      }`}
                    >
                      {b.label} {formatSigned(b.value)}
                    </span>
                  ))}
                  {!isDirectDiceRoll && exhaustionPen > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[#FCEAEA] border border-[#E6B8B8] rounded text-[#9E1B1B] font-bold">
                      Exaustão Nv {sheet.nivelExaustao}: -{exhaustionPen}
                    </span>
                  )}
                </div>
              </div>

              {/* Condition Auto-Suggestion Banner */}
              {conditionHint && (conditionHint.reasons.length > 0 || conditionHint.autoFail) && (
                <div
                  className={`p-2.5 rounded border text-xs flex items-start gap-2 ${
                    conditionHint.autoFail
                      ? 'bg-[#FCEAEA] border-[#9E1B1B] text-[#7A1313]'
                      : conditionHint.suggestedMode === 'desvantagem'
                        ? 'bg-[#FDF1EB] border-[#D9826C] text-[#7D2E1D]'
                        : 'bg-[#EEF5F0] border-[#82B495] text-[#1E5233]'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    {conditionHint.autoFail ? (
                      <p className="font-bold">{conditionHint.autoFailReason}</p>
                    ) : (
                      conditionHint.reasons.map((r, idx) => (
                        <p key={idx} className="font-medium">
                          {r}
                        </p>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Combined Damage & Extra Effects Selector */}
              {(supportsCombinedDamage || request.kind === 'damage') && (
                <div
                  data-testid="combined-damage-section"
                  className="p-2.5 rounded border border-[#DFD1AE] bg-[#FBF7EC] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#7A5610] inline-flex items-center gap-1">
                      <Swords className="w-3.5 h-3.5 text-[#9E1B1B]" />
                      Dano & Efeitos Combinados (rolam junto)
                    </span>
                    <span className="text-[10px] text-[#6B6258]">Crítico dobra dados</span>
                  </div>

                  {/* Base Weapon/Spell Damage toggle (for attacks) */}
                  {!isDirectDiceRoll && request.followUpDamage && (
                    <label className="flex items-center justify-between gap-2 p-1.5 rounded bg-white border border-[#DFD1AE] cursor-pointer">
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          data-testid="combine-base-damage-checkbox"
                          checked={includeBaseDamage}
                          onChange={(e) => setIncludeBaseDamage(e.target.checked)}
                          className="w-4 h-4 accent-[#9E1B1B] cursor-pointer"
                        />
                        <span className="text-xs font-bold text-[#1A1816] truncate">
                          {request.followUpDamage.title}
                        </span>
                      </span>
                      <span className="font-mono text-[11px] font-bold text-[#9E1B1B] shrink-0">
                        {request.followUpDamage.formula}
                        {request.followUpDamage.bonus !== 0
                          ? ` ${formatSigned(request.followUpDamage.bonus)}`
                          : ''}{' '}
                        {request.followUpDamage.damageType}
                      </span>
                    </label>
                  )}

                  {/* Extra Spells, Class Features & Custom Damage Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-0.5">
                    {extraDamageOptions.map((opt) => {
                      const checked = Boolean(selectedExtraIds[opt.id]);
                      const currentCircle = slotCircles[opt.id] ?? opt.scalableBySlot?.minCircle ?? 1;
                      return (
                        <div
                          key={opt.id}
                          className={`p-1.5 rounded border text-xs transition-colors ${
                            checked
                              ? opt.isCustom
                                ? 'border-[#7E3AF2] bg-[#F5ECFF]'
                                : 'border-[#9E1B1B] bg-white'
                              : 'border-[#E5DAC0] bg-[#FAF7EE]'
                          }`}
                        >
                          <label className="flex items-start gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              data-testid={`extra-damage-${opt.id}`}
                              checked={checked}
                              onChange={() => toggleExtraOption(opt.id)}
                              className="w-3.5 h-3.5 mt-0.5 accent-[#9E1B1B] cursor-pointer shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-[11px] text-[#1A1816] block leading-tight">
                                {opt.label}
                              </span>
                              <span className="text-[10px] text-[#6B6258] block truncate">
                                {opt.source} · {opt.damageType}
                              </span>
                            </div>
                          </label>

                          {checked && opt.scalableBySlot && (
                            <div className="mt-1 pl-5 flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold text-[#7A5610]">Círculo:</span>
                              <select
                                aria-label={`Círculo de ${opt.label}`}
                                value={currentCircle}
                                onChange={(e) =>
                                  setSlotCircles((prev) => ({
                                    ...prev,
                                    [opt.id]: parseInt(e.target.value, 10) || 1,
                                  }))
                                }
                                className="px-1.5 py-0.5 rounded border border-[#D4C39A] bg-white font-mono text-[10px] font-bold"
                              >
                                {Array.from(
                                  { length: Math.max(1, opt.scalableBySlot.maxCircle) },
                                  (_, i) => i + 1
                                ).map((c) => {
                                  const count =
                                    opt.scalableBySlot!.baseDiceCount +
                                    (c - opt.scalableBySlot!.minCircle) *
                                      opt.scalableBySlot!.extraDicePerCircle;
                                  return (
                                    <option key={c} value={c}>
                                      {c}º (+{count}d{opt.scalableBySlot!.dieSides})
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Quick Ad-Hoc Extra Damage Formula */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-[#E6DAB9]">
                    <label
                      htmlFor="adhoc-extra-dmg"
                      className="text-[10px] font-bold uppercase text-[#7A5610] whitespace-nowrap"
                    >
                      Dado/Bônus Extra:
                    </label>
                    <input
                      id="adhoc-extra-dmg"
                      data-testid="adhoc-damage-input"
                      type="text"
                      placeholder="Ex: 1d6, 2d4 ou +3"
                      value={adHocDamage}
                      onChange={(e) => setAdHocDamage(e.target.value)}
                      className="flex-1 min-h-[28px] px-2 rounded border border-[#D4C39A] bg-white font-mono text-xs text-[#1A1816]"
                    />
                  </div>
                </div>
              )}

              {/* Situational Bonus Selector (D20 only) */}
              {!isDirectDiceRoll && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6B6258]">
                      Bônus Situacional no D20
                    </label>
                    <input
                      type="number"
                      aria-label="Bônus manual rápido"
                      placeholder="Manual (±)"
                      value={customFlat}
                      onChange={(e) => setCustomFlat(e.target.value)}
                      className="w-24 px-2 py-1 text-xs font-mono border border-[#D4CCC0] rounded bg-white text-right"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {SITUATIONAL_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSituationalId(p.id);
                          setCustomFlat('');
                        }}
                        className={`px-2 py-1 text-[11px] rounded border transition-colors cursor-pointer ${
                          situationalId === p.id && !customFlat
                            ? 'bg-[#1A1816] text-white border-[#1A1816] font-semibold'
                            : 'bg-white text-[#4D453E] border-[#D4CCC0] hover:border-[#1A1816]'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Main Instant Action Buttons */}
              {!isDirectDiceRoll ? (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    data-testid="roll-mode-normal"
                    onClick={() => commitInstantD20Roll('normal')}
                    className={`min-h-[54px] flex flex-col items-center justify-center gap-0.5 rounded border-2 font-bold text-xs transition-all cursor-pointer ${
                      conditionHint?.suggestedMode === 'normal'
                        ? 'border-[#1A1816] bg-[#1A1816] text-white'
                        : 'border-[#C8BFB0] bg-white text-[#1A1816] hover:border-[#1A1816]'
                    }`}
                  >
                    <span>Normal</span>
                    <span className="font-mono text-[10px] opacity-80">1d20</span>
                  </button>

                  <button
                    type="button"
                    data-testid="roll-mode-vantagem"
                    onClick={() => commitInstantD20Roll('vantagem')}
                    className={`min-h-[54px] flex flex-col items-center justify-center gap-0.5 rounded border-2 font-bold text-xs transition-all cursor-pointer ${
                      conditionHint?.suggestedMode === 'vantagem'
                        ? 'border-[#1F6B43] bg-[#1F6B43] text-white'
                        : 'border-[#9CC3AC] bg-[#F2F9F5] text-[#1A5A38] hover:border-[#1F6B43]'
                    }`}
                  >
                    <span>Vantagem</span>
                    <span className="font-mono text-[10px] opacity-80">2d20 · maior</span>
                  </button>

                  <button
                    type="button"
                    data-testid="roll-mode-desvantagem"
                    onClick={() => commitInstantD20Roll('desvantagem')}
                    className={`min-h-[54px] flex flex-col items-center justify-center gap-0.5 rounded border-2 font-bold text-xs transition-all cursor-pointer ${
                      conditionHint?.suggestedMode === 'desvantagem'
                        ? 'border-[#9E1B1B] bg-[#9E1B1B] text-white'
                        : 'border-[#DFB4B4] bg-[#FDF4F4] text-[#8B1717] hover:border-[#9E1B1B]'
                    }`}
                  >
                    <span>Desvantagem</span>
                    <span className="font-mono text-[10px] opacity-80">2d20 · menor</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 pt-1">
                  {request.kind === 'damage' && (
                    <label className="flex items-center gap-2 text-xs text-[#1A1816] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isCritDamage}
                        onChange={(e) => setIsCritDamage(e.target.checked)}
                        className="w-4 h-4 accent-[#9E1B1B]"
                      />
                      <span className="font-semibold">Acerto Crítico (dobrar dados de dano)</span>
                    </label>
                  )}
                  <button
                    type="button"
                    data-testid="roll-dice-confirm"
                    onClick={() => commitInstantDiceRoll(isCritDamage)}
                    className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded bg-[#9E1B1B] text-white font-bold text-sm hover:bg-[#7D1414] cursor-pointer"
                  >
                    <Dices className="w-4 h-4" />
                    Rolar {request.diceFormula}
                    {request.modifier !== 0 ? ` ${formatSigned(request.modifier)}` : ''}
                  </button>
                </div>
              )}
            </>
          )}

          {/* INSTANT LARGE RESULT VIEW (ZERO ANIMATION DELAY) */}
          {phase === 'result' && result && (
            <div data-testid="roll-result-panel" className="space-y-3">
              {/* Crit / Fumble Banner */}
              {result.isCrit && !isDirectDiceRoll && (
                <div className="px-3 py-1.5 rounded bg-[#E7F5EC] border border-[#1F6B43] text-center text-xs font-extrabold uppercase tracking-wider text-[#1F6B43]">
                  Acerto Crítico (Natural {result.keptRoll}){result.combinedDamage ? ' · Dados de Dano Dobrados (×2)!' : '!'}
                </div>
              )}
              {result.isFumble && !isDirectDiceRoll && (
                <div className="px-3 py-1.5 rounded bg-[#FCEAEA] border border-[#9E1B1B] text-center text-xs font-extrabold uppercase tracking-wider text-[#9E1B1B]">
                  Falha Crítica (Natural 1)
                </div>
              )}

              {/* Split Prominent ACERTO & DANO cards when combined */}
              {hasSplitAttackAndDamage && result.combinedDamage ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {/* ACERTO */}
                  <div
                    data-testid="roll-result-hit-box"
                    className={`p-3 rounded-lg border-2 text-center flex flex-col justify-between ${
                      result.isCrit
                        ? 'border-[#1F6B43] bg-[#F2FBF5]'
                        : result.isFumble
                          ? 'border-[#9E1B1B] bg-[#FDF2F2]'
                          : 'border-[#1A1816] bg-[#F7F4EC]'
                    }`}
                  >
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#5C534A]">
                      Acerto ({result.mode})
                    </span>
                    <div
                      data-testid="roll-result-total"
                      className="font-mono text-5xl font-black text-[#1A1816] tabular-nums leading-none my-1.5"
                    >
                      {result.total}
                    </div>
                    {result.rolls.length === 2 ? (
                      <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono">
                        {result.rolls.map((r, i) => {
                          const isKept =
                            r === result.keptRoll &&
                            (i === 0 || result.rolls[0] !== result.keptRoll);
                          return (
                            <span
                              key={i}
                              className={`px-1.5 py-0.5 rounded border ${
                                isKept
                                  ? 'bg-[#1A1816] text-white border-[#1A1816] font-bold'
                                  : 'bg-white text-[#8C8175] border-[#D4CCC0] line-through'
                              }`}
                            >
                              {r}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="font-mono text-[11px] text-[#6B6258]">
                        d20 natural: <strong>{result.keptRoll}</strong>
                      </span>
                    )}
                  </div>

                  {/* DANO */}
                  <div
                    data-testid="roll-result-damage-box"
                    className="p-3 rounded-lg border-2 border-[#9E1B1B] bg-[#FDF5F5] text-center flex flex-col justify-between"
                  >
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9E1B1B] inline-flex items-center justify-center gap-1">
                      <Flame className="w-3 h-3" />
                      Dano Total
                    </span>
                    <div
                      data-testid="roll-result-damage-total"
                      className="font-mono text-5xl font-black text-[#9E1B1B] tabular-nums leading-none my-1.5"
                    >
                      {result.combinedDamage.total}
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {result.combinedDamage.byType.map((bt) => (
                        <span
                          key={bt.damageType}
                          className="px-1.5 py-0.5 rounded bg-white border border-[#E6B8B8] text-[10px] font-bold text-[#7A1818]"
                        >
                          {bt.total} {bt.damageType}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Single Giant Result Card */
                <div
                  className={`p-4 rounded-lg border-2 text-center space-y-1.5 ${
                    result.isCrit
                      ? 'border-[#1F6B43] bg-[#F2FBF5]'
                      : result.isFumble
                        ? 'border-[#9E1B1B] bg-[#FDF2F2]'
                        : isDirectDiceRoll
                          ? 'border-[#9E1B1B] bg-[#FDF5F5]'
                          : 'border-[#1A1816] bg-[#F7F4EC]'
                  }`}
                >
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#5C534A]">
                    {isDirectDiceRoll ? request.damageType || 'Resultado' : `Resultado · ${result.mode}`}
                  </p>
                  <div
                    data-testid="roll-result-total"
                    className={`font-mono text-6xl font-black tabular-nums leading-none ${
                      isDirectDiceRoll ? 'text-[#9E1B1B]' : 'text-[#1A1816]'
                    }`}
                  >
                    {result.total}
                  </div>
                  {result.rolls.length === 2 && (
                    <div className="flex items-center justify-center gap-2 pt-1 text-xs font-mono">
                      {result.rolls.map((r, i) => {
                        const isKept =
                          r === result.keptRoll &&
                          (i === 0 || result.rolls[0] !== result.keptRoll);
                        return (
                          <span
                            key={i}
                            className={`px-2 py-0.5 rounded border ${
                              isKept
                                ? 'bg-[#1A1816] text-white border-[#1A1816] font-bold'
                                : 'bg-white text-[#8C8175] border-[#D4CCC0] line-through'
                            }`}
                          >
                            d20: {r}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Concise Descriptive Calculation Breakdown */}
              <div className="space-y-1.5 text-xs">
                <div
                  data-testid="roll-result-breakdown"
                  className="p-2.5 rounded border border-[#E3DDD2] bg-[#FAF8F3] space-y-1"
                >
                  <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#5C534A]">
                    {hasSplitAttackAndDamage ? 'Cálculo do Acerto' : 'Descrição do Cálculo'}
                  </span>
                  <p className="font-mono text-[11px] text-[#2B2622] leading-relaxed">
                    {result.breakdownText} = <strong>{result.total}</strong>
                  </p>
                </div>

                {result.combinedDamage && result.combinedDamage.parts.length > 0 && (
                  <div
                    data-testid="roll-result-damage-breakdown"
                    className="p-2.5 rounded border border-[#E6CACA] bg-[#FDF8F8] space-y-1"
                  >
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#8B1717]">
                      Cálculo do Dano ({result.combinedDamage.total} total)
                    </span>
                    <ul className="space-y-0.5 font-mono text-[11px] text-[#2B2622]">
                      {result.combinedDamage.parts.map((part, idx) => (
                        <li key={idx} className="flex items-baseline justify-between gap-2">
                          <span className={part.isCustom ? 'text-[#5B218A] font-semibold' : ''}>
                            • {part.label}: {part.expression}
                          </span>
                          <span className="font-bold text-[#9E1B1B] shrink-0">
                            {part.total} ({part.damageType})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!isDirectDiceRoll && sheet.inspiracaoHeroica && onConsumeHeroicInspiration && (
                  <button
                    type="button"
                    onClick={handleHeroicReroll}
                    className="flex-1 min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 rounded border border-[#B08D3B] bg-[#FBF4DC] text-[#7A5610] text-xs font-bold hover:bg-[#F4E7BC] cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Rolar Novamente (Inspiração)
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setPhase('choose')}
                  className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 rounded border border-[#C8BFB0] bg-white text-[#1A1816] text-xs font-bold hover:border-[#1A1816] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Rolar de Novo
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 min-h-[42px] px-4 rounded bg-[#1A1816] text-white text-xs font-bold hover:bg-[#332E2A] cursor-pointer"
                >
                  Concluir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
