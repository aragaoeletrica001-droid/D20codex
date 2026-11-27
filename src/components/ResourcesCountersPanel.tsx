import React, { useMemo } from 'react';
import {
  Backpack,
  ChevronDown,
  ChevronRight,
  Flame,
  Minus,
  Plus,
  Skull,
  Sparkles,
} from 'lucide-react';
import type { CharacterSheet, ClassDefinition, SpellDefinition } from '../types/dnd';
import { buildSpellRuleHelp, CORE_RULE_HELP } from '../data/rulesHelp';
import {
  adjustSpellDailyUse,
  getClassSpellPrepLimits,
  getCountableEquipmentItems,
  hasSpellcastingAccess,
} from '../rules/engine';
import { useSectionOpen } from '../hooks/useCollapsibleSections';
import { InfoTip } from './InfoTip';

interface ResourcesCountersPanelProps {
  sheet: CharacterSheet;
  allClasses?: ClassDefinition[];
  allSpells?: SpellDefinition[];
  onUpdateSheet: (updater: (prev: CharacterSheet) => CharacterSheet) => void;
}

const CIRCLES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function resetLabel(resetOn: 'curto' | 'longo' | 'curto_1_longo_todos'): string {
  if (resetOn === 'curto') return 'Desc. Curto';
  if (resetOn === 'curto_1_longo_todos') return '+1 Curto / Todos Longo';
  return 'Desc. Longo';
}

export const ResourcesCountersPanel: React.FC<ResourcesCountersPanelProps> = ({
  sheet,
  allClasses,
  allSpells = [],
  onUpdateSheet,
}) => {
  const [showResources, toggleResources] = useSectionOpen('class_resources', true);

  const speciesResources = sheet.recursosEspecie ?? [];
  const canCast = useMemo(
    () => hasSpellcastingAccess(sheet) || sheet.magiasPreparadasIds.length > 0,
    [sheet]
  );

  const activeSlotCircles = useMemo(
    () => CIRCLES.filter((c) => (sheet.espacosMagia[c]?.total ?? 0) > 0),
    [sheet.espacosMagia]
  );

  const spellById = useMemo(() => {
    const map = new Map<string, SpellDefinition>();
    for (const sp of allSpells) map.set(sp.id, sp);
    return map;
  }, [allSpells]);

  const prepSummary = useMemo(() => {
    let cantrips = 0;
    let leveled = 0;
    for (const id of sheet.magiasPreparadasIds) {
      const sp = spellById.get(id);
      if (sp && sp.level === 0) cantrips++;
      else leveled++;
    }
    const limits = getClassSpellPrepLimits(sheet, allClasses);
    return { cantrips, leveled, total: sheet.magiasPreparadasIds.length, ...limits };
  }, [sheet, allClasses, spellById]);

  const trackedSpellUses = useMemo(() => {
    const uses = sheet.magiasUsosHoje ?? {};
    const list: { spell: SpellDefinition; count: number }[] = [];
    for (const [id, count] of Object.entries(uses)) {
      if (!count || count <= 0) continue;
      const sp = spellById.get(id);
      if (sp) list.push({ spell: sp, count });
    }
    return list.sort((a, b) => a.spell.level - b.spell.level || a.spell.name.localeCompare(b.spell.name, 'pt-BR'));
  }, [sheet.magiasUsosHoje, spellById]);

  const countableItems = useMemo(() => getCountableEquipmentItems(sheet), [sheet]);

  const totalCount =
    sheet.recursosClasse.length +
    speciesResources.length +
    activeSlotCircles.length +
    (sheet.espacosPacto.total > 0 ? 1 : 0) +
    (canCast ? 1 : 0) +
    trackedSpellUses.length +
    countableItems.length;

  const adjustRegularSlotRemaining = (circle: number, deltaRemaining: number) => {
    onUpdateSheet((prev) => {
      const tr = prev.espacosMagia[circle] ?? { total: 0, used: 0 };
      const nextUsed = Math.max(0, Math.min(tr.total, tr.used - deltaRemaining));
      return {
        ...prev,
        espacosMagia: {
          ...prev.espacosMagia,
          [circle]: { ...tr, used: nextUsed },
        },
      };
    });
  };

  const toggleRegularSlotPip = (circle: number, slotIndex: number) => {
    onUpdateSheet((prev) => {
      const tr = prev.espacosMagia[circle] ?? { total: 0, used: 0 };
      const isSpent = slotIndex < tr.used;
      const nextUsed = isSpent ? slotIndex : slotIndex + 1;
      return {
        ...prev,
        espacosMagia: {
          ...prev.espacosMagia,
          [circle]: { ...tr, used: Math.max(0, Math.min(tr.total, nextUsed)) },
        },
      };
    });
  };

  const adjustPactRemaining = (deltaRemaining: number) => {
    onUpdateSheet((prev) => ({
      ...prev,
      espacosPacto: {
        ...prev.espacosPacto,
        used: Math.max(0, Math.min(prev.espacosPacto.total, prev.espacosPacto.used - deltaRemaining)),
      },
    }));
  };

  const togglePactPip = (slotIndex: number) => {
    onUpdateSheet((prev) => {
      const isSpent = slotIndex < prev.espacosPacto.used;
      const nextUsed = isSpent ? slotIndex : slotIndex + 1;
      return {
        ...prev,
        espacosPacto: {
          ...prev.espacosPacto,
          used: Math.max(0, Math.min(prev.espacosPacto.total, nextUsed)),
        },
      };
    });
  };

  const adjustInventoryQuantity = (itemId: string, delta: number) => {
    onUpdateSheet((prev) => ({
      ...prev,
      equipamentos: prev.equipamentos.map((eq) =>
        eq.id === itemId ? { ...eq, quantity: Math.max(0, (eq.quantity || 0) + delta) } : eq
      ),
    }));
  };

  return (
    <section
      data-testid="class-resources-panel"
      className="official-box overflow-hidden"
    >
      <button
        type="button"
        data-testid="section-toggle-resources"
        aria-expanded={showResources}
        onClick={toggleResources}
        className="w-full official-box-header min-h-[36px] py-1 px-2.5 text-left cursor-pointer hover:bg-[#EAE3D5] transition-colors"
      >
        <h2 className="official-box-title inline-flex items-center gap-1.5 min-w-0">
          {showResources ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#5C534A] shrink-0" />
          )}
          <Flame className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
          <span className="truncate">
            Contagem ({totalCount})
          </span>
        </h2>
        <span className="text-[9.5px] text-[#6B6258] shrink-0">Magias, Recursos & Itens</span>
      </button>

      {showResources && (
        <div
          data-testid="counters-single-column-list"
          className="p-2 flex flex-col gap-1.5"
        >
          {/* 1. CONTAGEM DE MORTE (Linha única dedicada) */}
          <div
            data-testid="ficha-row-morte"
            className="w-full rounded border border-[#CFC6B8] bg-[#FAF8F3] px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2"
          >
            <span className="official-box-title text-[10px] inline-flex items-center gap-1 shrink-0">
              <Skull className="w-3.5 h-3.5 text-[#9E1B1B]" />
              Morte
              <InfoTip {...CORE_RULE_HELP.morte} />
            </span>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[9.5px] font-bold uppercase text-[#1F6B43]">Sucessos</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      data-testid={`death-success-${n}`}
                      aria-label={`Marcar ${n} sucesso(s) contra morte`}
                      onClick={() =>
                        onUpdateSheet((prev) => ({
                          ...prev,
                          morteSucessos: prev.morteSucessos === n ? n - 1 : n,
                        }))
                      }
                      className={`w-4 h-4 rounded-full border-2 cursor-pointer ${
                        sheet.morteSucessos >= n
                          ? 'bg-[#1F6B43] border-[#1F6B43]'
                          : 'border-[#8F8578] bg-white'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[9.5px] font-bold uppercase text-[#9E1B1B]">Falhas</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      data-testid={`death-failure-${n}`}
                      aria-label={`Marcar ${n} falha(s) contra morte`}
                      onClick={() =>
                        onUpdateSheet((prev) => ({
                          ...prev,
                          morteFalhas: prev.morteFalhas === n ? n - 1 : n,
                        }))
                      }
                      className={`w-4 h-4 rounded-full border-2 cursor-pointer ${
                        sheet.morteFalhas >= n
                          ? 'bg-[#9E1B1B] border-[#9E1B1B]'
                          : 'border-[#8F8578] bg-white'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 2. MAGIAS PREPARADAS (Linha única dedicada quando conjurador ou houver magias preparadas) */}
          {canCast && (
            <div
              data-testid="counter-row-prepared-spells"
              className="w-full px-2.5 py-1.5 rounded border border-[#DFD1AE] bg-[#FBF7EC] flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <Sparkles className="w-3.5 h-3.5 text-[#8A6518] shrink-0" />
                  <span className="text-xs font-bold text-[#1A1816] truncate">
                    Magias Preparadas
                    <InfoTip
                      title={CORE_RULE_HELP.espacos_magia.title}
                      subtitle="Preparação & Usos por Dia (D&D 2024)"
                      body={CORE_RULE_HELP.espacos_magia.body}
                    />
                  </span>
                </div>
                <span className="text-[9.5px] font-semibold text-[#7A5610] block truncate">
                  {prepSummary.cantripsMax !== null
                    ? `Truques ${prepSummary.cantrips}/${prepSummary.cantripsMax}`
                    : `Truques ${prepSummary.cantrips}`}
                  {' · '}
                  {prepSummary.preparedMax !== null
                    ? `Círculos ${prepSummary.leveled}/${prepSummary.preparedMax}`
                    : `Círculos ${prepSummary.leveled}`}
                </span>
              </div>
              <span
                data-testid="counter-prepared-spells-value"
                className="font-mono text-xs font-extrabold text-[#7A5610] tabular-nums shrink-0"
              >
                {prepSummary.preparedMax !== null
                  ? `${prepSummary.leveled}/${prepSummary.preparedMax}`
                  : `${prepSummary.total}`}
              </span>
            </div>
          )}

          {/* 3. ESPAÇOS DE MAGIA POR CÍRCULO (1 linha dedicada por círculo ativo) */}
          {activeSlotCircles.map((circle) => {
            const tr = sheet.espacosMagia[circle];
            const remaining = Math.max(0, tr.total - tr.used);
            return (
              <div
                key={`slot_${circle}`}
                data-testid={`counter-row-spell-slot-${circle}`}
                className="w-full px-2.5 py-1.5 rounded border border-[#DFD1AE] bg-[#FAF8F3] flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-[#1A1816]">
                      Magias — {circle}º Círculo
                    </span>
                    <span className="text-[9.5px] font-semibold text-[#7A5610]">
                      Desc. Longo
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    {Array.from({ length: tr.total }).map((_, idx) => {
                      const spent = idx < tr.used;
                      return (
                        <button
                          key={idx}
                          type="button"
                          aria-label={`${spent ? 'Recuperar' : 'Gastar'} espaço de ${circle}º círculo (${idx + 1}/${tr.total})`}
                          onClick={() => toggleRegularSlotPip(circle, idx)}
                          className={`w-4 h-4 rounded-sm border cursor-pointer transition-colors ${
                            spent
                              ? 'bg-[#E5DFD3] border-[#9C9285]'
                              : 'bg-[#8A6518] border-[#6E4F10]'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label={`Gastar 1 espaço de ${circle}º círculo`}
                    onClick={() => adjustRegularSlotRemaining(circle, -1)}
                    className="w-7 h-7 flex items-center justify-center rounded border border-[#B8AEA0] bg-white hover:border-[#9E1B1B] cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span
                    data-testid={`counter-slot-value-${circle}`}
                    className="font-mono text-xs font-extrabold tabular-nums min-w-[34px] text-center"
                  >
                    {remaining}/{tr.total}
                  </span>
                  <button
                    type="button"
                    aria-label={`Recuperar 1 espaço de ${circle}º círculo`}
                    onClick={() => adjustRegularSlotRemaining(circle, 1)}
                    className="w-7 h-7 flex items-center justify-center rounded border border-[#B8AEA0] bg-white hover:border-[#1F6B43] cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* 4. ESPAÇOS DE PACTO (Bruxo — linha única dedicada) */}
          {sheet.espacosPacto.total > 0 && (() => {
            const pactRem = Math.max(0, sheet.espacosPacto.total - sheet.espacosPacto.used);
            return (
              <div
                data-testid="counter-row-pact-slots"
                className="w-full px-2.5 py-1.5 rounded border border-[#C6B5D9] bg-[#F8F5FC] flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-[#1A1816]">
                      Magia de Pacto ({sheet.espacosPacto.slotLevel}º Círculo)
                    </span>
                    <span className="text-[9.5px] font-semibold text-[#5D4970]">
                      Desc. Curto
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    {Array.from({ length: sheet.espacosPacto.total }).map((_, idx) => {
                      const spent = idx < sheet.espacosPacto.used;
                      return (
                        <button
                          key={idx}
                          type="button"
                          aria-label={`${spent ? 'Recuperar' : 'Gastar'} espaço de pacto (${idx + 1}/${sheet.espacosPacto.total})`}
                          onClick={() => togglePactPip(idx)}
                          className={`w-4 h-4 rounded-sm border cursor-pointer ${
                            spent
                              ? 'bg-[#E5DFD3] border-[#9C9285]'
                              : 'bg-[#5D4970] border-[#433252]'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label="Gastar 1 espaço de pacto"
                    onClick={() => adjustPactRemaining(-1)}
                    className="w-7 h-7 flex items-center justify-center rounded border border-[#B8AEA0] bg-white hover:border-[#9E1B1B] cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span
                    data-testid="counter-pact-value"
                    className="font-mono text-xs font-extrabold tabular-nums min-w-[34px] text-center"
                  >
                    {pactRem}/{sheet.espacosPacto.total}
                  </span>
                  <button
                    type="button"
                    aria-label="Recuperar 1 espaço de pacto"
                    onClick={() => adjustPactRemaining(1)}
                    className="w-7 h-7 flex items-center justify-center rounded border border-[#B8AEA0] bg-white hover:border-[#1F6B43] cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* 5. MAGIAS ACIONADAS / USOS DIÁRIOS (1 linha dedicada por magia usada hoje) */}
          {trackedSpellUses.map(({ spell, count }) => (
            <div
              key={`spell_use_${spell.id}`}
              data-testid={`counter-row-spell-use-${spell.id}`}
              className="w-full px-2.5 py-1.5 rounded border border-[#DFD1AE] bg-[#FBF7EC] flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 min-w-0">
                  <Sparkles className="w-3 h-3 text-[#8A6518] shrink-0" />
                  <span className="text-xs font-bold text-[#1A1816] truncate">
                    {spell.name}
                    <InfoTip {...buildSpellRuleHelp(spell)} />
                  </span>
                </div>
                <span className="text-[9.5px] font-semibold text-[#7A5610]">
                  Magia ({spell.level === 0 ? 'Truque' : `${spell.level}º Círc.`}) · Usos hoje
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  aria-label={`Desmarcar 1 uso de ${spell.name}`}
                  onClick={() => onUpdateSheet((prev) => adjustSpellDailyUse(prev, spell, -1))}
                  className="w-7 h-7 flex items-center justify-center rounded border border-[#B8AEA0] bg-white hover:border-[#9E1B1B] cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span
                  data-testid={`counter-spell-use-value-${spell.id}`}
                  className="font-mono text-xs font-extrabold tabular-nums min-w-[34px] text-center"
                >
                  {count}×
                </span>
                <button
                  type="button"
                  aria-label={`Registrar +1 uso de ${spell.name}`}
                  onClick={() => onUpdateSheet((prev) => adjustSpellDailyUse(prev, spell, 1))}
                  className="w-7 h-7 flex items-center justify-center rounded border border-[#B8AEA0] bg-white hover:border-[#1F6B43] cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}

          {/* 6. RECURSOS DE CLASSE, SUBCLASSE E TALENTOS (1 linha dedicada por recurso) */}
          {sheet.recursosClasse.map((res) => (
            <div
              key={res.id}
              data-testid={`class-resource-${res.id}`}
              className="w-full px-2.5 py-1.5 rounded border border-[#CFC6B8] bg-[#FAF8F3] flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-xs font-bold text-[#1A1816]">
                    {res.name}
                    <InfoTip
                      title={res.name}
                      subtitle={`Recurso · ${resetLabel(res.resetOn)}${res.die ? ` · Dado ${res.die}` : ''}`}
                      body={res.description}
                    />
                  </span>
                  {res.die && (
                    <span className="px-1.5 py-0.2 rounded bg-[#9E1B1B] text-white font-mono text-[9.5px] font-bold">
                      {res.die}
                    </span>
                  )}
                </div>
                <span className="text-[9.5px] font-semibold text-[#7A5610] block truncate">
                  {resetLabel(res.resetOn)} · {res.description}
                </span>
              </div>

              {res.max > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label={`Gastar 1 uso de ${res.name}`}
                    onClick={() =>
                      onUpdateSheet((prev) => ({
                        ...prev,
                        recursosClasse: prev.recursosClasse.map((r) =>
                          r.id === res.id ? { ...r, current: Math.max(0, r.current - 1) } : r
                        ),
                      }))
                    }
                    className="w-7 h-7 flex items-center justify-center rounded border border-[#B8AEA0] bg-white hover:border-[#9E1B1B] cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-mono text-xs font-extrabold tabular-nums min-w-[34px] text-center">
                    {res.current}/{res.max}
                  </span>
                  <button
                    type="button"
                    aria-label={`Recuperar 1 uso de ${res.name}`}
                    onClick={() =>
                      onUpdateSheet((prev) => ({
                        ...prev,
                        recursosClasse: prev.recursosClasse.map((r) =>
                          r.id === res.id ? { ...r, current: Math.min(r.max, r.current + 1) } : r
                        ),
                      }))
                    }
                    className="w-7 h-7 flex items-center justify-center rounded border border-[#B8AEA0] bg-white hover:border-[#1F6B43] cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* 7. RECURSOS DE ESPÉCIE (1 linha dedicada por recurso) */}
          {speciesResources.map((res) => (
            <div
              key={res.id}
              data-testid={`species-resource-${res.id}`}
              className="w-full px-2.5 py-1.5 rounded border border-[#D4C39A] bg-[#FBF7EC] flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-[#1A1816] block truncate">
                  {res.name}
                  <InfoTip
                    title={res.name}
                    subtitle={`Espécie · ${resetLabel(res.resetOn)}`}
                    body={res.description}
                  />
                </span>
                <span className="text-[9.5px] font-semibold text-[#7A5610] block truncate">
                  Espécie · {resetLabel(res.resetOn)} · {res.description}
                </span>
              </div>

              {res.max > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label={`Gastar 1 uso de ${res.name}`}
                    onClick={() =>
                      onUpdateSheet((prev) => ({
                        ...prev,
                        recursosEspecie: (prev.recursosEspecie ?? []).map((r) =>
                          r.id === res.id ? { ...r, current: Math.max(0, r.current - 1) } : r
                        ),
                      }))
                    }
                    className="w-7 h-7 flex items-center justify-center rounded border border-[#D4C39A] bg-white cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-mono text-xs font-extrabold tabular-nums min-w-[34px] text-center">
                    {res.current}/{res.max}
                  </span>
                  <button
                    type="button"
                    aria-label={`Recuperar 1 uso de ${res.name}`}
                    onClick={() =>
                      onUpdateSheet((prev) => ({
                        ...prev,
                        recursosEspecie: (prev.recursosEspecie ?? []).map((r) =>
                          r.id === res.id ? { ...r, current: Math.min(r.max, r.current + 1) } : r
                        ),
                      }))
                    }
                    className="w-7 h-7 flex items-center justify-center rounded border border-[#D4C39A] bg-white cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* 8. ITENS CONTÁVEIS DE EQUIPAMENTOS (Munição, Rações, Tochas, Consumíveis — 1 linha cada, sincronizados) */}
          {countableItems.map(({ item, categoryLabel }) => (
            <div
              key={`inv_counter_${item.id}`}
              data-testid={`counter-row-item-${item.id}`}
              className="w-full px-2.5 py-1.5 rounded border border-[#C6D2C9] bg-[#F4F8F5] flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 min-w-0">
                  <Backpack className="w-3 h-3 text-[#1F6B43] shrink-0" />
                  <span className="text-xs font-bold text-[#1A1816] truncate">
                    {item.name}
                    {(item.description || item.properties || item.notes) && (
                      <InfoTip
                        title={item.name}
                        subtitle={`${categoryLabel} · Sincronizado com Equipamentos`}
                        body={item.description || item.notes || item.properties || ''}
                        tips={item.properties ? [`Propriedades: ${item.properties}`] : undefined}
                      />
                    )}
                  </span>
                </div>
                <span className="text-[9.5px] font-semibold text-[#1F6B43] block truncate">
                  {categoryLabel} · Equipamentos
                  {item.properties || item.notes ? ` · ${item.properties || item.notes}` : ''}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  data-testid={`counter-item-dec-${item.id}`}
                  aria-label={`Gastar 1 unidade de ${item.name}`}
                  onClick={() => adjustInventoryQuantity(item.id, -1)}
                  className="w-7 h-7 flex items-center justify-center rounded border border-[#B8AEA0] bg-white hover:border-[#9E1B1B] cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span
                  data-testid={`counter-item-qty-${item.id}`}
                  className={`font-mono text-xs font-extrabold tabular-nums min-w-[34px] text-center ${
                    item.quantity === 0 ? 'text-[#9E1B1B]' : 'text-[#1A1816]'
                  }`}
                >
                  {item.quantity}
                </span>
                <button
                  type="button"
                  data-testid={`counter-item-inc-${item.id}`}
                  aria-label={`Repor 1 unidade de ${item.name}`}
                  onClick={() => adjustInventoryQuantity(item.id, 1)}
                  className="w-7 h-7 flex items-center justify-center rounded border border-[#B8AEA0] bg-white hover:border-[#1F6B43] cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}

          {totalCount === 0 && (
            <p className="text-[10px] text-[#6B6258] text-center py-1">
              Selecione Classe, Espécie, Talentos, Magias ou adicione munições/consumíveis em Equipamentos para acompanhar as contagens aqui.
            </p>
          )}
        </div>
      )}
    </section>
  );
};
