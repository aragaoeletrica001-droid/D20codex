import React, { useMemo, useState } from 'react';
import { AlertCircle, BookOpen, Minus, Plus, Search, ShieldAlert, X } from 'lucide-react';
import type { CharacterSheet, ConditionId, CreatureStatBlock } from '../types/dnd';
import {
  CONDITIONS_LIST,
  STANDARD_ACTIONS_GLOSSARY,
} from '../data/glossary';
import { normalizeSearchText, searchGlossaryEntries } from '../data/rulesHelp';

interface ConditionsGlossaryModalProps {
  open: boolean;
  sheet: CharacterSheet;
  allCreatures: CreatureStatBlock[];
  onClose: () => void;
  onUpdateSheet: (updater: (prev: CharacterSheet) => CharacterSheet) => void;
}

export const ConditionsGlossaryModal: React.FC<ConditionsGlossaryModalProps> = ({
  open,
  sheet,
  allCreatures,
  onClose,
  onUpdateSheet,
}) => {
  const [tab, setTab] = useState<'condicoes' | 'glossario' | 'acoes' | 'criaturas'>('condicoes');
  const [search, setSearch] = useState('');

  const glossaryResults = useMemo(
    () => searchGlossaryEntries(search, 80),
    [search]
  );

  if (!open) return null;

  const toggleCondition = (cid: ConditionId) => {
    onUpdateSheet((prev) => {
      const exists = prev.condicoesAtivas.includes(cid);
      return {
        ...prev,
        condicoesAtivas: exists
          ? prev.condicoesAtivas.filter((c) => c !== cid)
          : [...prev.condicoesAtivas, cid],
      };
    });
  };

  const setExhaustion = (lvl: number) => {
    const clamped = Math.max(0, Math.min(6, lvl));
    onUpdateSheet((prev) => ({ ...prev, nivelExaustao: clamped }));
  };

  const normQ = normalizeSearchText(search.trim());

  const filteredConditions = CONDITIONS_LIST.filter(
    (c) =>
      !normQ ||
      normalizeSearchText(`${c.name} ${c.shortEffect} ${c.rules.join(' ')}`).includes(normQ)
  );

  const filteredActions = STANDARD_ACTIONS_GLOSSARY.filter(
    (a) => !normQ || normalizeSearchText(`${a.name} ${a.desc}`).includes(normQ)
  );

  const filteredCreatures = allCreatures.filter(
    (c) =>
      !normQ ||
      normalizeSearchText(`${c.name} ${c.typeSize}`).includes(normQ)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1A1816]/60 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conditions-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl bg-[#FDFCFA] border border-[#C8BFB0] rounded-t-xl sm:rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E3DDD2] bg-[#F7F4EC]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#9E1B1B]" />
            <h2 id="conditions-modal-title" className="font-display text-base font-bold text-[#1A1816]">
              Condições, Exaustão & Glossário
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar glossário e condições"
            className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded text-[#6B6258] hover:bg-[#EAE4D7] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Strip + Unified Search Bar */}
        <div className="px-4 py-2.5 border-b border-[#E3DDD2] bg-[#FAF8F3] space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['condicoes', 'Condições & Exaustão'],
                ['glossario', 'Glossário Completo'],
                ['acoes', 'Ações de Combate'],
                ['criaturas', `Criaturas (${allCreatures.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                data-testid={`glossary-modal-tab-${id}`}
                onClick={() => setTab(id)}
                className={`min-h-[30px] px-2.5 rounded border text-[11px] font-semibold cursor-pointer ${
                  tab === id
                    ? 'border-[#1A1816] bg-[#1A1816] text-white'
                    : 'border-[#D4CCC0] bg-white text-[#4D453E] hover:bg-[#EFECE4]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8C8175] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              data-testid="glossary-modal-search"
              placeholder="Buscar termo, propriedade de arma (Recarga, Adaptável, Leve...), condição, ação ou criatura..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full min-h-[32px] pl-8 pr-7 rounded border border-[#CFC6B8] bg-white text-[11px] text-[#1A1816] placeholder:text-[#8C8175] focus:outline-none focus:border-[#9E1B1B]"
            />
            {search && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-[#8C8175] hover:text-[#1A1816] cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {tab === 'condicoes' && (
            <>
              {/* Exaustão 2024 */}
              <div className="p-3 rounded border border-[#DFB2B2] bg-[#FDF5F5] flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  <p className="text-xs font-bold text-[#8B1717] flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    Exaustão (Regra 2024: Níveis 0 a 6)
                  </p>
                  <p className="text-[10.5px] text-[#6B3B3B] mt-0.5 leading-snug">
                    Cada nível aplica <strong>-2 em todos os testes D20</strong> e{' '}
                    <strong>-1,5 m de Deslocamento</strong>. Nível 6 = Morte.
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="exhaustion-minus-btn"
                    aria-label="Reduzir nível de exaustão"
                    onClick={() => setExhaustion(sheet.nivelExaustao - 1)}
                    className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded border border-[#C98E8E] bg-white text-[#8B1717] cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span
                    data-testid="exhaustion-level-value"
                    className="font-mono text-lg font-extrabold text-[#8B1717] min-w-[28px] text-center tabular-nums"
                  >
                    {sheet.nivelExaustao}
                  </span>
                  <button
                    type="button"
                    data-testid="exhaustion-plus-btn"
                    aria-label="Aumentar nível de exaustão"
                    onClick={() => setExhaustion(sheet.nivelExaustao + 1)}
                    className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded border border-[#C98E8E] bg-white text-[#8B1717] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 14 Conditions Toggle Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredConditions.map((cond) => {
                  const active = sheet.condicoesAtivas.includes(cond.id);
                  return (
                    <button
                      key={cond.id}
                      type="button"
                      data-testid={`condition-toggle-${cond.id}`}
                      onClick={() => toggleCondition(cond.id)}
                      aria-pressed={active}
                      className={`text-left p-2.5 rounded border transition-colors cursor-pointer ${
                        active
                          ? 'border-[#9E1B1B] bg-[#FCEAEA]'
                          : 'border-[#D4CCC0] bg-[#FAF8F3] hover:border-[#9E1B1B]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-bold ${
                            active ? 'text-[#8B1717]' : 'text-[#1A1816]'
                          }`}
                        >
                          {cond.name}
                        </span>
                        <span
                          className={`text-[10px] font-semibold ${
                            active ? 'text-[#9E1B1B]' : 'text-[#8C8175]'
                          }`}
                        >
                          {active ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-[#574E46] mt-0.5 leading-snug">
                        {cond.shortEffect}
                      </p>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'glossario' && (
            <div className="space-y-2" data-testid="glossary-modal-results">
              {glossaryResults.length === 0 ? (
                <p className="text-[11px] text-[#6B6258] text-center py-4">
                  Nenhum termo encontrado para &ldquo;{search}&rdquo;.
                </p>
              ) : (
                glossaryResults.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-2.5 rounded border border-[#E3DDD2] bg-[#FAF8F3] space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold text-[#1A1816]">{entry.title}</h3>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border border-[#DFD1AE] bg-[#FBF7EC] text-[#7A5610] shrink-0">
                        {entry.category}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-[#4D453E] whitespace-pre-line leading-snug">
                      {entry.body}
                    </p>
                    {entry.tips && entry.tips.length > 0 && (
                      <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-[#5C534A] pt-1 border-t border-[#EAE4D7]">
                        {entry.tips.map((t, idx) => (
                          <li key={idx} className="leading-snug">
                            {t}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'acoes' && (
            <div className="divide-y divide-[#E5DFD3]">
              {filteredActions.map((act) => (
                <div key={act.name} className="py-2 first:pt-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-xs font-bold text-[#1A1816]">{act.name}</h3>
                    <span className="font-mono text-[10px] text-[#8A6518] font-semibold">
                      1 Ação
                    </span>
                  </div>
                  <p className="text-[10.5px] text-[#4D453E] mt-0.5 leading-snug">{act.desc}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'criaturas' && (
            <div className="space-y-2">
              {filteredCreatures.slice(0, 40).map((c) => (
                <div
                  key={c.id}
                  className="p-2.5 rounded border border-[#E3DDD2] bg-[#FAF8F3] text-[10.5px] space-y-1"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-xs font-bold text-[#1A1816]">
                      {c.name}
                    </span>
                    <span className="font-mono text-[10px] text-[#7A6F64]">
                      ND {c.cr} · CA {c.ac} · PV {c.hp}
                    </span>
                  </div>
                  <p className="text-[#574E46]">
                    {c.typeSize} · Desl. {c.speed}
                  </p>
                  {c.actions.length > 0 && (
                    <p className="text-[#3F3934] leading-snug">
                      <strong>Ações:</strong> {c.actions.join('; ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[#E3DDD2] bg-[#F7F4EC] flex items-center justify-between">
          <span className="text-[10.5px] text-[#6B6258] flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Penalidades são aplicadas automaticamente ao rolar o d20.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[34px] px-3.5 rounded bg-[#1A1816] text-white text-xs font-semibold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
