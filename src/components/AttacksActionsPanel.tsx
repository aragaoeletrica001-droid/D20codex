import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Plus, Swords, Trash2 } from 'lucide-react';
import type { AbilityKey, AttackEntry, CharacterSheet } from '../types/dnd';
import { WEAPON_MASTERIES, WEAPONS_LIST } from '../data/equipment';
import {
  calculateAttackStats,
  createAttackFromWeapon,
  formatSigned,
} from '../rules/engine';
import { useSectionOpen } from '../hooks/useCollapsibleSections';
import { buildWeaponRuleHelp } from '../data/rulesHelp';
import { InfoTip } from './InfoTip';

interface AttacksActionsPanelProps {
  sheet: CharacterSheet;
  onUpdateSheet: (updater: (prev: CharacterSheet) => CharacterSheet) => void;
}

export const AttacksActionsPanel: React.FC<AttacksActionsPanelProps> = ({
  sheet,
  onUpdateSheet,
}) => {
  const [sectionOpen, toggleSectionOpen] = useSectionOpen('attacks_actions', true);
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>('espada_longa');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [expandedMasteryId, setExpandedMasteryId] = useState<string | null>(null);
  const [customForm, setCustomForm] = useState({
    name: '',
    ability: 'for' as AbilityKey | 'spell',
    damageDice: '1d8',
    damageType: 'Cortante',
    range: '1,5m',
    notes: '',
  });

  const handleAddWeaponFromCatalog = () => {
    const weapon = WEAPONS_LIST.find((w) => w.id === selectedWeaponId);
    if (!weapon) return;
    const entry = createAttackFromWeapon(weapon, sheet);
    onUpdateSheet((prev) => ({
      ...prev,
      ataques: [...prev.ataques, entry],
    }));
  };

  const handleAddCustomAttack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customForm.name.trim()) return;
    const newEntry: AttackEntry = {
      id: `atk_custom_${Date.now()}`,
      name: customForm.name.trim(),
      kind: customForm.ability === 'spell' ? 'cantrip' : 'custom',
      ability: customForm.ability,
      proficient: true,
      customAttackBonus: 0,
      damageDice: customForm.damageDice.trim() || '1d6',
      damageType: customForm.damageType.trim() || 'Contundente',
      range: customForm.range.trim() || '1,5m',
      properties: [],
      notes: customForm.notes.trim(),
    };
    onUpdateSheet((prev) => ({
      ...prev,
      ataques: [...prev.ataques, newEntry],
    }));
    setCustomForm({
      name: '',
      ability: 'for',
      damageDice: '1d8',
      damageType: 'Cortante',
      range: '1,5m',
      notes: '',
    });
    setShowCustomForm(false);
  };

  const handleRemoveAttack = (id: string) => {
    onUpdateSheet((prev) => ({
      ...prev,
      ataques: prev.ataques.filter((a) => a.id !== id),
    }));
  };

  return (
    <section className="official-box overflow-hidden" data-testid="section-attacks">
      <div className="official-box-header py-1 px-2.5 min-h-[36px]">
        <button
          type="button"
          data-testid="section-toggle-attacks"
          aria-expanded={sectionOpen}
          onClick={toggleSectionOpen}
          className="flex-1 min-w-0 min-h-[30px] flex items-center gap-1.5 text-left cursor-pointer"
        >
          {sectionOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#5C534A] shrink-0" />
          )}
          <Swords className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
          <h2 className="official-box-title truncate">
            Armas e Truques de Dano
          </h2>
          <span className="text-[10px] font-semibold text-[#5C534A] shrink-0">
            ({sheet.ataques.length})
          </span>
        </button>
        {sectionOpen && (
          <button
            type="button"
            onClick={() => setShowCustomForm((v) => !v)}
            className="text-[10.5px] font-bold text-[#9E1B1B] hover:underline cursor-pointer pl-2 shrink-0"
          >
            {showCustomForm ? 'Fechar' : '+ Manual'}
          </button>
        )}
      </div>

      {sectionOpen && (
        <div className="p-2 space-y-2">
          {sheet.ataques.length > 0 ? (
            <div className="divide-y divide-[#DDD5C7] border-b border-[#DDD5C7]">
              {sheet.ataques.map((atk) => {
                const stats = calculateAttackStats(sheet, atk);
                const masteryDesc = atk.mastery ? WEAPON_MASTERIES[atk.mastery] : undefined;
                const isExpanded = expandedMasteryId === atk.id;
                const hasCustom =
                  stats.attackBreakdown.some((b) => b.isCustom) ||
                  stats.damageBreakdown.some((b) => b.isCustom);
                const weaponHelp = buildWeaponRuleHelp({
                  name: atk.name,
                  range: atk.range,
                  damageLabel: stats.damageLabel,
                  damageType: atk.damageType,
                  properties: atk.properties,
                  mastery: atk.mastery,
                  notes: atk.notes,
                });

                return (
                  <div key={atk.id} className="py-1.5 space-y-1">
                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5">
                      {/* Name + Range + Properties + Mastery */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="font-bold text-xs text-[#1A1816] truncate">
                            {atk.name}
                            <InfoTip
                              title={atk.name}
                              subtitle={`${atk.range} · Dano ${stats.damageLabel} (${atk.damageType})`}
                              body={weaponHelp.body}
                              formula={
                                stats.saveDc
                                  ? `CD ${stats.saveDc} ${atk.saveAbility?.toUpperCase()} | Dano: ${stats.damageLabel}`
                                  : `Acerto: ${stats.attackBreakdown.map((b) => `${b.label} (${formatSigned(b.value)})`).join(' + ')} = ${formatSigned(stats.attackBonus)} | Dano: ${stats.damageDice}${stats.damageBreakdown.length > 0 ? ' + ' + stats.damageBreakdown.map((b) => `${b.label} (${formatSigned(b.value)})`).join(' + ') : ''} = ${stats.damageLabel}`
                              }
                              tips={weaponHelp.tips.length > 0 ? weaponHelp.tips : undefined}
                            />
                          </span>
                          {hasCustom && (
                            <span className="text-[9px] font-extrabold uppercase px-1 rounded bg-[#F1EAF9] text-[#5B2D8B] shrink-0">
                              Custom
                            </span>
                          )}
                          <span className="text-[9.5px] text-[#6B6258] shrink-0">{atk.range}</span>
                        </div>
                        <p className="text-[9.5px] text-[#5C534A] truncate">
                          {atk.damageType}
                          {atk.mastery ? ` · Maestria: ${atk.mastery}` : ''}
                          {atk.properties.length > 0 ? ` · ${atk.properties.join(', ')}` : ''}
                        </p>
                      </div>

                      {/* Read-Only Summary Badges + Expand/Delete (rolagens centralizadas em Testes) */}
                      <div className="flex items-center gap-1 shrink-0">
                        {stats.saveDc ? (
                          <span className="quick-test-mod quick-test-mod--gold font-mono text-[10.5px] font-bold tabular-nums">
                            CD {stats.saveDc} {atk.saveAbility?.toUpperCase()}
                          </span>
                        ) : (
                          <span className="quick-test-mod quick-test-mod--crimson font-mono text-[10.5px] font-extrabold tabular-nums">
                            {formatSigned(stats.attackBonus)}
                          </span>
                        )}

                        <span className="quick-test-mod quick-test-mod--ink font-mono text-[10.5px] font-bold tabular-nums">
                          {stats.damageLabel}
                        </span>

                        {masteryDesc && (
                          <button
                            type="button"
                            onClick={() => setExpandedMasteryId(isExpanded ? null : atk.id)}
                            aria-label={`Ver detalhes da maestria ${atk.mastery}`}
                            className="p-1 text-[#5C534A] hover:text-[#1A1816] cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveAttack(atk.id)}
                          aria-label={`Remover ${atk.name}`}
                          className="p-1 text-[#8C8175] hover:text-[#9E1B1B] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && masteryDesc && (
                      <div className="px-2 py-1.5 rounded bg-[#FBF7EC] border border-[#DFD1AE] text-[10px] text-[#4D453E] leading-snug">
                        <strong className="text-[#7A5610]">Maestria ({atk.mastery}):</strong>{' '}
                        {masteryDesc}
                        {atk.properties.length > 0 && (
                          <span className="block text-[#6B6258] mt-0.5">
                            Propriedades: {atk.properties.join(' · ')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-2 text-center text-[10.5px] text-[#7A6F64] border-b border-dashed border-[#CFC6B8]">
              Nenhuma arma ou truque registrado. Adicione pelo catálogo de Equipamentos abaixo.
            </p>
          )}

          {/* Quick Add Weapon from Equipment Catalog */}
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Selecionar arma do catálogo de Equipamentos"
              value={selectedWeaponId}
              onChange={(e) => setSelectedWeaponId(e.target.value)}
              className="flex-1 min-w-0 min-h-[32px] px-2 rounded border border-[#CFC6B8] bg-[#FAF8F3] text-xs text-[#1A1816]"
            >
              {WEAPONS_LIST.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} — {w.damageDice} {w.damageType} ({w.mastery})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddWeaponFromCatalog}
              className="min-h-[32px] inline-flex items-center gap-1 px-2.5 rounded bg-[#1A1816] text-white text-xs font-semibold hover:bg-[#332E2A] cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Arma
            </button>
          </div>

          {/* Custom Attack / Cantrip Form */}
          {showCustomForm && (
            <form
              onSubmit={handleAddCustomAttack}
              className="p-2 rounded border border-[#CFC6B8] bg-[#FAF8F3] grid grid-cols-2 gap-1.5"
            >
              <input
                type="text"
                required
                placeholder="Nome (ex.: Raio de Fogo)"
                value={customForm.name}
                onChange={(e) => setCustomForm((f) => ({ ...f, name: e.target.value }))}
                className="col-span-2 min-h-[32px] px-2 rounded border border-[#CFC6B8] bg-white text-xs"
              />
              <select
                value={customForm.ability}
                onChange={(e) =>
                  setCustomForm((f) => ({ ...f, ability: e.target.value as AbilityKey | 'spell' }))
                }
                className="min-h-[32px] px-2 rounded border border-[#CFC6B8] bg-white text-xs"
              >
                <option value="for">Força</option>
                <option value="des">Destreza</option>
                <option value="spell">Conjuração</option>
              </select>
              <input
                type="text"
                placeholder="Dados (1d10)"
                value={customForm.damageDice}
                onChange={(e) => setCustomForm((f) => ({ ...f, damageDice: e.target.value }))}
                className="min-h-[32px] px-2 rounded border border-[#CFC6B8] bg-white text-xs font-mono"
              />
              <input
                type="text"
                placeholder="Tipo (Ígneo)"
                value={customForm.damageType}
                onChange={(e) => setCustomForm((f) => ({ ...f, damageType: e.target.value }))}
                className="min-h-[32px] px-2 rounded border border-[#CFC6B8] bg-white text-xs"
              />
              <input
                type="text"
                placeholder="Alcance (36m)"
                value={customForm.range}
                onChange={(e) => setCustomForm((f) => ({ ...f, range: e.target.value }))}
                className="min-h-[32px] px-2 rounded border border-[#CFC6B8] bg-white text-xs"
              />
              <button
                type="submit"
                className="col-span-2 min-h-[32px] px-3 rounded bg-[#9E1B1B] text-white text-xs font-bold hover:bg-[#7D1414] cursor-pointer"
              >
                Salvar Ataque
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
};
