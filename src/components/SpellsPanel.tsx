import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Minus,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import type {
  AbilityKey,
  CharacterSheet,
  ClassDefinition,
  SpellDefinition,
} from '../types/dnd';
import { ABILITIES } from '../data/core';
import { CLASS_MAP } from '../data/classes';
import {
  adjustSpellDailyUse,
  calculateSpellStats,
  formatSigned,
  getCantripScaledDice,
  getMaxAvailableSpellCircle,
  spellRequiresTest,
  syncAutoLinkedSpellTests,
} from '../rules/engine';
import { useSectionOpen } from '../hooks/useCollapsibleSections';
import { buildSpellRuleHelp } from '../data/rulesHelp';
import { InfoTip } from './InfoTip';

interface SpellsPanelProps {
  sheet: CharacterSheet;
  allClasses?: ClassDefinition[];
  allSpells: SpellDefinition[];
  onUpdateSheet: (updater: (prev: CharacterSheet) => CharacterSheet) => void;
}

const CIRCLES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const SpellsPanel: React.FC<SpellsPanelProps> = ({
  sheet,
  allClasses,
  allSpells,
  onUpdateSheet,
}) => {
  const [statsOpen, toggleStatsOpen] = useSectionOpen('spells_stats_slots', true);
  const [spellListOpen, toggleSpellListOpen] = useSectionOpen('spells_list', true);
  const [viewMode, setViewMode] = useState<'preparadas' | 'selecionar'>(() =>
    sheet.magiasPreparadasIds.length > 0 ? 'preparadas' : 'selecionar'
  );
  const [filterCircle, setFilterCircle] = useState<number | 'all'>('all');
  const [filterClassOnly, setFilterClassOnly] = useState<boolean>(true);
  const [filterConcOnly, setFilterConcOnly] = useState(false);
  const [filterRitualOnly, setFilterRitualOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSpellId, setExpandedSpellId] = useState<string | null>(null);
  const [editSlotsOpen, setEditSlotsOpen] = useState(false);

  const spellStats = calculateSpellStats(sheet);
  const maxAvailableCircle = getMaxAvailableSpellCircle(sheet);
  const cls =
    allClasses?.find((c) => c.id === sheet.classeId) ?? CLASS_MAP[sheet.classeId] ?? undefined;
  const sub = cls?.subclasses.find((s) => s.id === sheet.subclasseId);

  // Resolve effective spell list class ID (supports full/half/pact casters AND 1/3 caster subclasses)
  const effectiveSpellClassId: string | null = useMemo(() => {
    if (cls && cls.spellcasting.progression !== 'none') return cls.id;
    if (sub?.grantsSpellcasting?.spellListClassId) return sub.grantsSpellcasting.spellListClassId;
    return null;
  }, [cls, sub]);

  const effectiveSpellClassName = useMemo(() => {
    if (!effectiveSpellClassId) return null;
    const found =
      allClasses?.find((c) => c.id === effectiveSpellClassId) ?? CLASS_MAP[effectiveSpellClassId];
    return found?.name ?? effectiveSpellClassId;
  }, [allClasses, effectiveSpellClassId]);

  useEffect(() => {
    setFilterClassOnly(Boolean(effectiveSpellClassId));
  }, [effectiveSpellClassId]);

  const preparedSet = useMemo(() => new Set(sheet.magiasPreparadasIds), [sheet.magiasPreparadasIds]);

  const activeSlotCircles = useMemo(
    () => CIRCLES.filter((c) => (sheet.espacosMagia[c]?.total ?? 0) > 0),
    [sheet.espacosMagia]
  );

  // Count spells per circle for current filter scope (for intuitive badges)
  const scopedSpellsBeforeCircle = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allSpells.filter((sp) => {
      if (viewMode === 'preparadas' && !preparedSet.has(sp.id)) return false;
      if (filterClassOnly && effectiveSpellClassId) {
        if (!sp.classes.includes(effectiveSpellClassId)) return false;
      }
      if (filterConcOnly && !sp.concentration) return false;
      if (filterRitualOnly && !sp.ritual) return false;
      if (
        q &&
        !sp.name.toLowerCase().includes(q) &&
        !sp.school.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [
    allSpells,
    viewMode,
    preparedSet,
    filterClassOnly,
    effectiveSpellClassId,
    filterConcOnly,
    filterRitualOnly,
    searchQuery,
  ]);

  const displayedSpells = useMemo(() => {
    return scopedSpellsBeforeCircle
      .filter((sp) => (filterCircle === 'all' ? true : sp.level === filterCircle))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'pt-BR'));
  }, [scopedSpellsBeforeCircle, filterCircle]);

  // If searching in "Preparadas" yields 0 matches, surface instant catalog matches for 1-tap preparation
  const catalogFallbackMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (viewMode !== 'preparadas' || displayedSpells.length > 0 || !q) return [];
    return allSpells
      .filter((sp) => {
        if (filterClassOnly && effectiveSpellClassId && !sp.classes.includes(effectiveSpellClassId)) {
          return false;
        }
        if (filterCircle !== 'all' && sp.level !== filterCircle) return false;
        if (filterConcOnly && !sp.concentration) return false;
        if (filterRitualOnly && !sp.ritual) return false;
        return sp.name.toLowerCase().includes(q) || sp.school.toLowerCase().includes(q);
      })
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, 20);
  }, [
    allSpells,
    viewMode,
    displayedSpells.length,
    searchQuery,
    filterClassOnly,
    effectiveSpellClassId,
    filterCircle,
    filterConcOnly,
    filterRitualOnly,
  ]);

  const togglePrepared = (sp: SpellDefinition) => {
    onUpdateSheet((prev) => {
      const exists = prev.magiasPreparadasIds.includes(sp.id);
      const isNowPrepared = !exists;
      const next = exists
        ? prev.magiasPreparadasIds.filter((id) => id !== sp.id)
        : [...prev.magiasPreparadasIds, sp.id];
      const nextUses = { ...(prev.magiasUsosHoje ?? {}) };
      if (!isNowPrepared) {
        delete nextUses[sp.id];
      }
      return {
        ...prev,
        magiasPreparadasIds: next,
        magiasConhecidasIds: Array.from(new Set([...prev.magiasConhecidasIds, sp.id])),
        magiasUsosHoje: nextUses,
        testesSelecionadosIds: syncAutoLinkedSpellTests(
          prev.testesSelecionadosIds,
          sp,
          isNowPrepared
        ),
      };
    });
  };

  const setSlotTotal = (circle: number, total: number) => {
    const clamped = Math.max(0, Math.min(9, Math.floor(total) || 0));
    onUpdateSheet((prev) => {
      const current = prev.espacosMagia[circle] ?? { total: 0, used: 0 };
      return {
        ...prev,
        espacosMagia: {
          ...prev.espacosMagia,
          [circle]: {
            total: clamped,
            used: Math.min(current.used, clamped),
          },
        },
      };
    });
  };

  const toggleSlotUsed = (circle: number, slotIndex: number) => {
    onUpdateSheet((prev) => {
      const tracker = prev.espacosMagia[circle] ?? { total: 0, used: 0 };
      const isCurrentlyUsed = slotIndex < tracker.used;
      const nextUsed = isCurrentlyUsed ? slotIndex : slotIndex + 1;
      return {
        ...prev,
        espacosMagia: {
          ...prev.espacosMagia,
          [circle]: { ...tracker, used: Math.max(0, Math.min(tracker.total, nextUsed)) },
        },
      };
    });
  };

  const togglePactSlotUsed = (slotIndex: number) => {
    onUpdateSheet((prev) => {
      const isCurrentlyUsed = slotIndex < prev.espacosPacto.used;
      const nextUsed = isCurrentlyUsed ? slotIndex : slotIndex + 1;
      return {
        ...prev,
        espacosPacto: {
          ...prev.espacosPacto,
          used: Math.max(0, Math.min(prev.espacosPacto.total, nextUsed)),
        },
      };
    });
  };

  const handleAdjustSpellUse = (sp: SpellDefinition, delta: number) => {
    onUpdateSheet((prev) => adjustSpellDailyUse(prev, sp, delta));
  };

  return (
    <div className="space-y-2.5" data-testid="spells-panel">
      {/* ================================================================
          1. COMPACT CONJURAÇÃO STATS + ACTIVE SLOTS BAR
          ================================================================ */}
      <section className="official-box overflow-hidden">
        <div className="official-box-header py-1 px-2.5 min-h-[38px]">
          <button
            type="button"
            data-testid="section-toggle-spell-stats"
            aria-expanded={statsOpen}
            onClick={toggleStatsOpen}
            className="flex-1 min-w-0 min-h-[32px] flex items-center gap-1.5 text-left cursor-pointer"
          >
            {statsOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#5C534A] shrink-0" />
            )}
            <h2 className="official-box-title truncate">
              Conjuração & Espaços
            </h2>
            <span
              data-testid="max-spell-circle-badge"
              className="text-[10px] font-semibold text-[#7A5610] shrink-0"
            >
              {maxAvailableCircle > 0 ? `Até ${maxAvailableCircle}º círc.` : 'Truques'}
            </span>
          </button>
          {statsOpen && (
            <button
              type="button"
              onClick={() => setEditSlotsOpen((v) => !v)}
              className="text-[10px] font-bold text-[#9E1B1B] inline-flex items-center gap-1 hover:underline cursor-pointer pl-2 shrink-0"
            >
              <SlidersHorizontal className="w-3 h-3" />
              {editSlotsOpen ? 'Fechar 1º–9º' : 'Editar 1º–9º'}
            </button>
          )}
        </div>

        {statsOpen && (
        <div className="p-2 space-y-2">
          {/* 4-Chip Compact Spell Stats Strip */}
          <div className="grid grid-cols-4 gap-1.5 items-center text-center">
            <div className="p-1 rounded border border-[#DDD5C7] bg-[#FAF8F3]">
              <label htmlFor="spell-ability-select" className="official-label block">
                Atrib.
              </label>
              <select
                id="spell-ability-select"
                value={spellStats.ability ?? ''}
                onChange={(e) =>
                  onUpdateSheet((prev) => ({
                    ...prev,
                    conjuracaoAtributo: (e.target.value || null) as AbilityKey | null,
                    visibilidade: {
                      ...prev.visibilidade,
                      conjuracao: Boolean(e.target.value) || prev.visibilidade.conjuracao,
                    },
                  }))
                }
                className="w-full text-center font-bold text-xs text-[#1A1816] bg-transparent cursor-pointer focus:outline-none mt-0.5"
              >
                <option value="">—</option>
                {ABILITIES.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.shortLabel}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-1 rounded border border-[#DDD5C7] bg-[#FAF8F3] flex flex-col items-center justify-center">
              <span className="official-label inline-flex items-center">
                Mod
                <InfoTip
                  title="Modificador de Conjuração"
                  body="Modificador do atributo usado para conjurar magias, aplicado em testes de atributo de conjuração (como Dissipar Magia ou Contramágica). Para rolar, use a lista Testes na aba Ficha."
                />
              </span>
              <span
                data-testid="spell-mod-value"
                className="font-mono text-base font-extrabold text-[#1A1816] tabular-nums leading-tight mt-0.5"
              >
                {spellStats.ability ? formatSigned(spellStats.abilityMod) : '—'}
              </span>
            </div>

            <div className="p-1 rounded border border-[#DFD1AE] bg-[#FBF7EC] flex flex-col items-center justify-center">
              <span className="official-label text-[#7A5610] inline-flex items-center">
                CD Magia
                <InfoTip
                  title="CD de Resistência de Magia"
                  subtitle="Dificuldade para Alvos Resistirem"
                  body="Valor que os alvos das suas magias precisam igualar ou superar em salvaguardas. Calculada como 8 + Bônus de Proficiência + modificador do atributo de conjuração (+ bônus customizados)."
                  formula={
                    spellStats.ability
                      ? `${spellStats.dcBreakdown.map((b) => `${b.label} (${b.value})`).join(' + ')} = CD ${spellStats.spellSaveDc}`
                      : undefined
                  }
                />
              </span>
              <span
                data-testid="spell-dc-value"
                className="font-mono text-base font-extrabold text-[#1A1816] tabular-nums leading-tight mt-0.5"
              >
                {spellStats.ability ? spellStats.spellSaveDc : '—'}
              </span>
            </div>

            <div className="p-1 rounded border border-[#DDD5C7] bg-[#FAF8F3] flex flex-col items-center justify-center">
              <span className="official-label inline-flex items-center">
                Atq Mág.
                <InfoTip
                  title="Bônus de Ataque Mágico"
                  subtitle="Jogadas de Ataque com Magias"
                  body="Somado ao d20 quando uma magia exige jogada de ataque corpo a corpo ou à distância. Calculado como modificador de conjuração + Bônus de Proficiência (+ bônus customizados). Para rolar, use a lista Testes na aba Ficha."
                  formula={
                    spellStats.ability
                      ? `${spellStats.attackBreakdown.map((b) => `${b.label} (${formatSigned(b.value)})`).join(' + ')} = ${formatSigned(spellStats.spellAttackBonus)}`
                      : undefined
                  }
                />
              </span>
              <span
                data-testid="spell-atk-value"
                className="font-mono text-base font-extrabold text-[#9E1B1B] tabular-nums leading-tight mt-0.5"
              >
                {spellStats.ability ? formatSigned(spellStats.spellAttackBonus) : '—'}
              </span>
            </div>
          </div>

          {/* Active Spell Slots Compact Pips Row */}
          {(activeSlotCircles.length > 0 || sheet.espacosPacto.total > 0) && !editSlotsOpen && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#EAE4D7]">
              {activeSlotCircles.map((circle) => {
                const tr = sheet.espacosMagia[circle];
                return (
                  <div
                    key={circle}
                    className="inline-flex items-center gap-1 px-1.5 py-1 rounded border border-[#CFC6B8] bg-[#FAF8F3]"
                  >
                    <span className="font-mono text-[10px] font-extrabold text-[#1A1816]">
                      {circle}º:
                    </span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: tr.total }).map((_, idx) => {
                        const spent = idx < tr.used;
                        return (
                          <button
                            key={idx}
                            type="button"
                            aria-label={`${spent ? 'Recuperar' : 'Gastar'} espaço de ${circle}º círculo (${idx + 1}/${tr.total})`}
                            onClick={() => toggleSlotUsed(circle, idx)}
                            className={`w-4 h-4 rounded-sm border cursor-pointer ${
                              spent
                                ? 'bg-[#E5DFD3] border-[#9C9285]'
                                : 'bg-[#8A6518] border-[#6E4F10]'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {sheet.espacosPacto.total > 0 && (
                <div className="inline-flex items-center gap-1 px-1.5 py-1 rounded border border-[#8A6518] bg-[#FBF7EC]">
                  <span className="font-mono text-[10px] font-extrabold text-[#7A5610]">
                    Pacto {sheet.espacosPacto.slotLevel}º:
                  </span>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: sheet.espacosPacto.total }).map((_, idx) => {
                      const spent = idx < sheet.espacosPacto.used;
                      return (
                        <button
                          key={idx}
                          type="button"
                          aria-label={`${spent ? 'Recuperar' : 'Gastar'} espaço de pacto`}
                          onClick={() => togglePactSlotUsed(idx)}
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
              )}
            </div>
          )}

          {/* Full 1º–9º Editable Grid (opened on demand) */}
          {editSlotsOpen && (
            <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-[#EAE4D7]">
              {CIRCLES.map((circle) => {
                const tr = sheet.espacosMagia[circle] ?? { total: 0, used: 0 };
                return (
                  <div
                    key={circle}
                    className={`p-1.5 rounded border text-xs ${
                      tr.total > 0
                        ? 'border-[#8F8578] bg-[#FAF8F3]'
                        : 'border-[#DDD5C7] bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-mono text-[10px] font-extrabold text-[#1A1816]">
                        {circle}º CÍRC.
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={9}
                        aria-label={`Total de espaços de ${circle}º círculo`}
                        value={tr.total}
                        onChange={(e) => setSlotTotal(circle, parseInt(e.target.value, 10) || 0)}
                        className="w-7 h-5 text-center font-mono text-[11px] font-bold bg-white border border-[#B8AEA0] rounded tabular-nums"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-0.5 min-h-[16px]">
                      {tr.total > 0 ? (
                        Array.from({ length: tr.total }).map((_, idx) => {
                          const spent = idx < tr.used;
                          return (
                            <button
                              key={idx}
                              type="button"
                              aria-label={`${spent ? 'Recuperar' : 'Gastar'} espaço de ${circle}º círculo`}
                              onClick={() => toggleSlotUsed(circle, idx)}
                              className={`w-3.5 h-3.5 rounded-sm border cursor-pointer ${
                                spent
                                  ? 'bg-[#E5DFD3] border-[#9C9285]'
                                  : 'bg-[#8A6518] border-[#6E4F10]'
                              }`}
                            />
                          );
                        })
                      ) : (
                        <span className="text-[10px] text-[#B5ABA0]">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}
      </section>

      {/* ================================================================
          2. SELETOR DIRETO DE MAGIAS (CLASSE AUTO + CÍRCULO + BUSCA + 1-TAP)
          ================================================================ */}
      <section className="official-box overflow-hidden">
        {/* Clickable Title Header for Lista de Magias */}
        <div className="official-box-header py-1 px-2.5 min-h-[38px]">
          <button
            type="button"
            data-testid="section-toggle-spells-list"
            aria-expanded={spellListOpen}
            onClick={toggleSpellListOpen}
            className="flex-1 min-w-0 min-h-[32px] flex items-center gap-1.5 text-left cursor-pointer"
          >
            {spellListOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#5C534A] shrink-0" />
            )}
            <h2 className="official-box-title truncate">
              Lista de Magias
            </h2>
            <span className="text-[10px] font-semibold text-[#5C534A] shrink-0">
              ({sheet.magiasPreparadasIds.length} prep.)
            </span>
          </button>

          {spellListOpen && effectiveSpellClassName && (
            <button
              type="button"
              data-testid="spell-class-filter-btn"
              onClick={() => setFilterClassOnly((v) => !v)}
              className={`min-h-[26px] px-2 rounded border text-[10px] font-bold cursor-pointer shrink-0 ${
                filterClassOnly
                  ? 'border-[#1A1816] bg-[#1A1816] text-white'
                  : 'border-[#B8AEA0] bg-white text-[#5C534A]'
              }`}
            >
              {filterClassOnly ? `Classe: ${effectiveSpellClassName}` : 'Todas Classes'}
            </button>
          )}
        </div>

        {spellListOpen && (
        <div className="p-2 space-y-2">
          {/* Mode Toggle Bar */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="inline-flex rounded border border-[#8F8578] bg-white p-0.5">
              <button
                type="button"
                data-testid="spells-mode-preparadas"
                onClick={() => setViewMode('preparadas')}
                className={`min-h-[26px] px-2.5 rounded-sm text-[11px] font-bold cursor-pointer ${
                  viewMode === 'preparadas'
                    ? 'bg-[#1A1816] text-white'
                    : 'text-[#4D453E] hover:bg-[#F3EFE6]'
                }`}
              >
                Preparadas ({sheet.magiasPreparadasIds.length})
              </button>
              <button
                type="button"
                data-testid="spells-mode-selecionar"
                onClick={() => setViewMode('selecionar')}
                className={`min-h-[26px] px-2.5 rounded-sm text-[11px] font-bold cursor-pointer ${
                  viewMode === 'selecionar'
                    ? 'bg-[#8A6518] text-white'
                    : 'text-[#4D453E] hover:bg-[#F3EFE6]'
                }`}
              >
                Selecionar ({allSpells.length})
              </button>
            </div>
            {maxAvailableCircle > 0 && (
              <span className="text-[10px] font-semibold text-[#7A5610]">
                Círculos liberados (Nv {sheet.nivel}): Truques até {maxAvailableCircle}º
              </span>
            )}
          </div>

          {/* Quick Circle Filter Strip */}
          <div
            className="flex items-center gap-1 overflow-x-auto pb-0.5"
            role="group"
            aria-label="Filtrar por círculo de magia"
          >
            <button
              type="button"
              data-testid="spell-circle-all"
              onClick={() => setFilterCircle('all')}
              className={`min-h-[26px] px-2 rounded border text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                filterCircle === 'all'
                  ? 'border-[#9E1B1B] bg-[#9E1B1B] text-white'
                  : 'border-[#CFC6B8] bg-[#FAF8F3] text-[#4D453E]'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              data-testid="spell-circle-0"
              onClick={() => setFilterCircle(0)}
              className={`min-h-[26px] px-2 rounded border text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                filterCircle === 0
                  ? 'border-[#9E1B1B] bg-[#9E1B1B] text-white'
                  : 'border-[#CFC6B8] bg-[#FAF8F3] text-[#4D453E]'
              }`}
            >
              Truques
            </button>
            {CIRCLES.map((c) => {
              const unlocked = maxAvailableCircle > 0 && c <= maxAvailableCircle;
              return (
                <button
                  key={c}
                  type="button"
                  data-testid={`spell-circle-${c}`}
                  data-unlocked={unlocked ? 'true' : 'false'}
                  onClick={() => setFilterCircle(c)}
                  className={`min-h-[26px] px-2 rounded border font-mono text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                    filterCircle === c
                      ? 'border-[#9E1B1B] bg-[#9E1B1B] text-white'
                      : unlocked
                        ? 'border-[#B08D3B] bg-[#FBF4DC] text-[#7A5610]'
                        : 'border-[#CFC6B8] bg-[#FAF8F3] text-[#8C8175] opacity-75'
                  }`}
                >
                  {c}º
                </button>
              );
            })}
          </div>

          {/* Search Input + C / R Toggles */}
          <div className="flex items-center gap-1">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-[#8C8175] absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                data-testid="spell-search-input"
                placeholder="Buscar magia por nome ou escola..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-[32px] pl-7 pr-2 rounded border border-[#CFC6B8] bg-[#FAF8F3] text-xs text-[#1A1816] focus:outline-none focus:border-[#8A6518]"
              />
            </div>

            <button
              type="button"
              title="Filtrar Concentração"
              onClick={() => setFilterConcOnly((v) => !v)}
              className={`min-h-[32px] w-8 rounded border text-[11px] font-bold cursor-pointer ${
                filterConcOnly
                  ? 'border-[#8A6518] bg-[#FBF4DC] text-[#7A5610]'
                  : 'border-[#CFC6B8] bg-white text-[#5C534A]'
              }`}
            >
              C
            </button>
            <button
              type="button"
              title="Filtrar Ritual"
              onClick={() => setFilterRitualOnly((v) => !v)}
              className={`min-h-[32px] w-8 rounded border text-[11px] font-bold cursor-pointer ${
                filterRitualOnly
                  ? 'border-[#1F6B43] bg-[#EEF6F0] text-[#1B5737]'
                  : 'border-[#CFC6B8] bg-white text-[#5C534A]'
              }`}
            >
              R
            </button>
          </div>

          {/* Compact Spell Rows */}
          <div className="border border-[#CFC6B8] rounded overflow-hidden bg-white">
            {displayedSpells.length === 0 && catalogFallbackMatches.length > 0 && (
              <div className="px-2.5 py-1 bg-[#FBF4DC] border-b border-[#DFD1AE] text-[10px] font-bold text-[#7A5610]">
                Não preparada ainda — toque em ✓ para adicionar às Preparadas:
              </div>
            )}
            {(displayedSpells.length > 0 || catalogFallbackMatches.length > 0) ? (
              <div className="divide-y divide-[#E5DFD3] max-h-[460px] overflow-y-auto">
                {(displayedSpells.length > 0 ? displayedSpells : catalogFallbackMatches).slice(0, 120).map((sp) => {
                  const isPrep = preparedSet.has(sp.id);
                  const isOpen = expandedSpellId === sp.id;
                  const hasMaterial = /\bM\b/i.test(sp.components);
                  const needsTest = spellRequiresTest(sp);
                  const usesToday = sheet.magiasUsosHoje?.[sp.id] ?? 0;
                  const hasRollableAction =
                    sp.attackType === 'melee' ||
                    sp.attackType === 'ranged' ||
                    Boolean(sp.damageFormula) ||
                    Boolean(sp.healingFormula);

                  return (
                    <div
                      key={sp.id}
                      data-testid={`spell-row-${sp.id}`}
                      className={isPrep && viewMode === 'selecionar' ? 'bg-[#F8FBF8]' : 'bg-white'}
                    >
                      <div className="px-2 py-1.5 flex items-center gap-1.5">
                        {/* 1-Tap Preparada Toggle directly on every row */}
                        <button
                          type="button"
                          data-testid={`spell-toggle-prep-${sp.id}`}
                          onClick={() => togglePrepared(sp)}
                          aria-pressed={isPrep}
                          aria-label={isPrep ? `Despreparar ${sp.name}` : `Preparar ${sp.name}`}
                          title={isPrep ? 'Preparada (toque p/ remover)' : 'Toque para preparar'}
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                            isPrep
                              ? 'border-[#1F6B43] bg-[#1F6B43] text-white'
                              : 'border-[#B8AEA0] bg-white text-transparent hover:border-[#1A1816]'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>

                        {/* Spell Summary (Tap to Expand Description) */}
                        <button
                          type="button"
                          onClick={() => setExpandedSpellId(isOpen ? null : sp.id)}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-1 min-w-0 flex-wrap">
                            <span className="font-mono text-[10px] font-extrabold text-[#7A5610] shrink-0">
                              {sp.level === 0 ? 'TRQ' : `${sp.level}º`}
                            </span>
                            <span className="text-xs font-bold text-[#1A1816] truncate">
                              {sp.name}
                            </span>
                            <InfoTip {...buildSpellRuleHelp(sp)} />
                            {isPrep && needsTest && (
                              <span
                                data-testid={`spell-in-tests-badge-${sp.id}`}
                                className="text-[8.5px] font-extrabold px-1 rounded bg-[#FCEAEA] text-[#8B1717] shrink-0"
                                title="Vinculada automaticamente à lista Testes"
                              >
                                Testes
                              </span>
                            )}
                            {sp.concentration && (
                              <span className="text-[9px] font-extrabold px-1 rounded bg-[#FBF4DC] text-[#7A5610] shrink-0">
                                C
                              </span>
                            )}
                            {sp.ritual && (
                              <span className="text-[9px] font-extrabold px-1 rounded bg-[#EEF6F0] text-[#1B5737] shrink-0">
                                R
                              </span>
                            )}
                            {hasMaterial && (
                              <span className="text-[9px] font-bold text-[#6B6258] shrink-0">
                                M
                              </span>
                            )}
                          </div>
                          <p className="text-[9.5px] text-[#6B6258] truncate">
                            {sp.castingTime} · {sp.range}
                            {sp.saveAbility ? ` · SG ${sp.saveAbility.toUpperCase()}` : ''}
                          </p>
                        </button>

                        {/* Read-only Effect Summary + Manual Usage Marking (synced with Contagem & Slots) */}
                        <div className="flex items-center gap-1 shrink-0">
                          {hasRollableAction && (
                            <span
                              className={`quick-test-mod font-mono text-[10px] font-extrabold tabular-nums ${
                                sp.attackType === 'melee' || sp.attackType === 'ranged'
                                  ? 'quick-test-mod--crimson'
                                  : 'quick-test-mod--gold'
                              }`}
                            >
                              {sp.attackType === 'melee' || sp.attackType === 'ranged'
                                ? `Atq ${formatSigned(spellStats.spellAttackBonus)}`
                                : sp.damageFormula
                                  ? sp.level === 0
                                    ? getCantripScaledDice(sp.damageFormula, sheet.nivel)
                                    : sp.damageFormula
                                  : 'Cura'}
                            </span>
                          )}

                          {isPrep && (
                            usesToday > 0 ? (
                              <div className="inline-flex items-center gap-0.5 rounded border border-[#B08D3B] bg-[#FBF6E6] px-1 py-0.5">
                                <button
                                  type="button"
                                  data-testid={`spell-use-dec-${sp.id}`}
                                  aria-label={`Desmarcar 1 uso de ${sp.name}`}
                                  onClick={() => handleAdjustSpellUse(sp, -1)}
                                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#EFE2B9] text-[#7A5610] cursor-pointer"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <span
                                  data-testid={`spell-use-count-${sp.id}`}
                                  className="font-mono text-[10px] font-extrabold text-[#7A5610] min-w-[18px] text-center tabular-nums"
                                >
                                  {usesToday}×
                                </span>
                                <button
                                  type="button"
                                  data-testid={`spell-use-inc-${sp.id}`}
                                  aria-label={`Marcar +1 uso de ${sp.name}`}
                                  onClick={() => handleAdjustSpellUse(sp, 1)}
                                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#EFE2B9] text-[#7A5610] cursor-pointer"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                data-testid={`spell-use-btn-${sp.id}`}
                                onClick={() => handleAdjustSpellUse(sp, 1)}
                                title={
                                  sp.level > 0
                                    ? 'Marcar uso (gasta 1 espaço, registra na Contagem e marca Concentração se aplicável)'
                                    : 'Marcar uso manual na Contagem'
                                }
                                className="min-h-[26px] px-1.5 rounded border border-[#B08D3B] bg-[#FBF6E6] text-[#7A5610] text-[10px] font-bold hover:bg-[#8A6518] hover:text-white inline-flex items-center gap-0.5 cursor-pointer"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>Usar</span>
                              </button>
                            )
                          )}

                          <button
                            type="button"
                            onClick={() => setExpandedSpellId(isOpen ? null : sp.id)}
                            aria-label={`Expandir detalhes de ${sp.name}`}
                            className="w-6 h-6 flex items-center justify-center rounded text-[#6B6258] hover:bg-[#EFEAE0] cursor-pointer"
                          >
                            {isOpen ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="px-3 py-2 bg-[#FAF8F3] border-t border-[#E5DFD3] text-[10.5px] space-y-1 text-[#2E2A26]">
                          <p className="text-[9.5px] text-[#5C534A]">
                            <strong>Escola:</strong> {sp.school} · <strong>Comp.:</strong> {sp.components} ·{' '}
                            <strong>Duração:</strong> {sp.duration}
                          </p>
                          <p className="leading-relaxed text-[10.5px] whitespace-pre-line">
                            {sp.description}
                          </p>
                          {sp.higherLevels && (
                            <p className="text-[10px] text-[#7A5610] whitespace-pre-line">
                              <strong>
                                {sp.level === 0 ? 'Aprimoramento de Truque:' : 'Em Círculos Superiores:'}
                              </strong>{' '}
                              {sp.higherLevels}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {displayedSpells.length > 120 && (
                  <p className="px-3 py-2 text-center text-[10px] text-[#6B6258] bg-[#FAF8F3]">
                    Mostrando 120 de {displayedSpells.length} magias — use a busca ou o filtro de círculo acima para refinar.
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 text-center space-y-2">
                <p className="text-xs text-[#6B6258]">
                  {viewMode === 'preparadas'
                    ? 'Nenhuma magia preparada para este filtro.'
                    : 'Nenhuma magia encontrada para o filtro selecionado.'}
                </p>
                {viewMode === 'preparadas' && (
                  <button
                    type="button"
                    onClick={() => setViewMode('selecionar')}
                    className="min-h-[32px] px-3 rounded border border-[#8A6518] bg-[#FBF4DC] text-[#7A5610] text-xs font-bold hover:bg-[#8A6518] hover:text-white cursor-pointer"
                  >
                    Selecionar Magias da Classe
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        )}
      </section>
    </div>
  );
};
