import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Minus, Plus, Trash2, Wrench } from 'lucide-react';
import type {
  AbilityKey,
  CharacterSheet,
  ProficiencyMultiplier,
  SkillKey,
  SkillSourceKind,
} from '../types/dnd';
import { ABILITIES, SKILL_MAP, SKILLS } from '../data/core';
import { TOOLS_CATALOG } from '../data/equipment';
import {
  calculateAbilityCheckBonus,
  calculateSaveBonus,
  calculateSkillBonus,
  formatSigned,
  getAbilityMod,
  getProficiencyBonus,
  getSkillSources,
} from '../rules/engine';
import { useSectionOpen } from '../hooks/useCollapsibleSections';
import { InfoTip } from './InfoTip';
import { ABILITY_RULE_HELP, SKILL_RULE_HELP } from '../data/rulesHelp';

interface AbilitiesSkillsPanelProps {
  sheet: CharacterSheet;
  onUpdateSheet: (updater: (prev: CharacterSheet) => CharacterSheet) => void;
}

const SOURCE_BADGE_STYLES: Record<SkillSourceKind, string> = {
  Antecedente: 'border-[#B08D3B] bg-[#FBF4DC] text-[#7A5610]',
  Classe: 'border-[#C98E8E] bg-[#FCEAEA] text-[#8B1717]',
  Espécie: 'border-[#8CB396] bg-[#EEF6F0] text-[#1F5432]',
  Subclasse: 'border-[#9B8CB8] bg-[#F4F0FA] text-[#4E3878]',
  Talento: 'border-[#8EA8BF] bg-[#EEF4FA] text-[#1F4B73]',
};

const ALL_CLOSED: Record<AbilityKey, boolean> = {
  for: false,
  des: false,
  con: false,
  int: false,
  sab: false,
  car: false,
};

export const AbilitiesSkillsPanel: React.FC<AbilitiesSkillsPanelProps> = ({
  sheet,
  onUpdateSheet,
}) => {
  // All 6 attributes start collapsed by default to eliminate portrait scrolling
  const [expanded, setExpanded] = useState<Record<AbilityKey, boolean>>(ALL_CLOSED);
  const [abilitiesPanelOpen, toggleAbilitiesPanel] = useSectionOpen('abilities_skills', true);
  const [trainingOpen, toggleTrainingOpen] = useSectionOpen('training_proficiencies', false);
  const [newToolName, setNewToolName] = useState('');
  const [newToolAbility, setNewToolAbility] = useState<AbilityKey>('des');

  const bp = getProficiencyBonus(sheet.nivel);
  const anyExpanded = ABILITIES.some((a) => expanded[a.key]);
  const skillSources = getSkillSources(sheet);
  const proficientSkills = SKILLS.filter((sk) => (sheet.periciasProf[sk.key] ?? 0) > 0);
  const bgSkillKeys = proficientSkills.filter((sk) =>
    skillSources[sk.key]?.includes('Antecedente')
  );
  const classAndOtherSkills = proficientSkills.filter(
    (sk) => !skillSources[sk.key]?.includes('Antecedente')
  );

  const toggleAbility = (ab: AbilityKey) => {
    setExpanded((prev) => ({ ...prev, [ab]: !prev[ab] }));
  };

  const toggleAllAbilities = () => {
    const nextVal = !anyExpanded;
    setExpanded({
      for: nextVal,
      des: nextVal,
      con: nextVal,
      int: nextVal,
      sab: nextVal,
      car: nextVal,
    });
  };

  const cycleSkillProf = (key: SkillKey) => {
    onUpdateSheet((prev) => {
      const current = prev.periciasProf[key] ?? 0;
      const next: ProficiencyMultiplier = current === 0 ? 1 : current === 1 ? 2 : 0;
      return {
        ...prev,
        periciasProf: { ...prev.periciasProf, [key]: next },
      };
    });
  };

  const toggleSaveProf = (ab: AbilityKey) => {
    onUpdateSheet((prev) => ({
      ...prev,
      salvaguardasProf: {
        ...prev.salvaguardasProf,
        [ab]: !prev.salvaguardasProf[ab],
      },
    }));
  };

  const handleScoreChange = (ab: AbilityKey, value: number) => {
    const clamped = Math.max(1, Math.min(30, value));
    onUpdateSheet((prev) => ({
      ...prev,
      atributos: { ...prev.atributos, [ab]: clamped },
    }));
  };

  const handleAddTool = () => {
    const trimmed = newToolName.trim();
    if (!trimmed) return;
    const match = TOOLS_CATALOG.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    onUpdateSheet((prev) => ({
      ...prev,
      ferramentasProficiencia: [
        ...prev.ferramentasProficiencia,
        {
          id: `tool_${Date.now()}`,
          name: trimmed,
          defaultAbility: match?.ability ?? newToolAbility,
          synergySkill: match?.synergySkill,
        },
      ],
    }));
    setNewToolName('');
  };

  const armorSummary = (
    [
      ['leve', 'Leve'],
      ['media', 'Média'],
      ['pesada', 'Pesada'],
      ['escudos', 'Escudos'],
    ] as const
  )
    .filter(([k]) => sheet.armadurasTreinamento[k])
    .map(([, label]) => label)
    .join(', ');

  return (
    <div className="space-y-2.5" data-testid="section-abilities-skills">
      {/* RETRACTABLE ATTRIBUTES PANEL */}
      <section className="official-box overflow-hidden">
        <div className="official-box-header py-1 px-2.5 min-h-[38px]">
          <button
            type="button"
            data-testid="section-toggle-abilities"
            aria-expanded={abilitiesPanelOpen}
            onClick={toggleAbilitiesPanel}
            className="flex-1 min-w-0 min-h-[32px] flex items-center gap-1.5 text-left cursor-pointer"
          >
            {abilitiesPanelOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#5C534A] shrink-0" />
            )}
            <h2 className="official-box-title truncate">
              Atributos & Perícias
            </h2>
            <span className="text-[10px] font-semibold text-[#5C534A] shrink-0">
              ({proficientSkills.length} prof.)
            </span>
          </button>
          {abilitiesPanelOpen && (
            <button
              type="button"
              data-testid="toggle-all-abilities-btn"
              onClick={toggleAllAbilities}
              className="text-[11px] font-bold text-[#9E1B1B] hover:underline whitespace-nowrap cursor-pointer pl-2 shrink-0"
            >
              {anyExpanded ? 'Recolher todos' : 'Expandir todos'}
            </button>
          )}
        </div>

        {abilitiesPanelOpen && (
          <>
            {/* Prominent Summary Strip: Perícias do Antecedente vs Classe/Outras (Equal Visual Prominence) */}
            {proficientSkills.length > 0 && (
              <div
                data-testid="skills-origin-summary"
                className="px-2.5 py-1.5 bg-[#FAF8F3] border-b border-[#DDD5C7] flex flex-wrap items-center gap-1.5 text-[10px]"
              >
                {bgSkillKeys.length > 0 && (
                  <div className="inline-flex flex-wrap items-center gap-1">
                    <span className="font-extrabold uppercase tracking-wider text-[#7A5610]">
                      Antecedente:
                    </span>
                    {bgSkillKeys.map((sk) => {
                      const calc = calculateSkillBonus(sheet, sk.key);
                      return (
                        <button
                          key={sk.key}
                          type="button"
                          onClick={() =>
                            setExpanded((prev) => ({ ...prev, [sk.ability]: true }))
                          }
                          className="px-1.5 py-0.5 rounded border border-[#B08D3B] bg-[#FBF4DC] text-[#7A5610] font-bold hover:bg-[#F3E5B8] cursor-pointer"
                        >
                          {sk.label} {formatSigned(calc.total)}
                        </button>
                      );
                    })}
                  </div>
                )}
                {classAndOtherSkills.length > 0 && (
                  <div className="inline-flex flex-wrap items-center gap-1">
                    <span className="font-extrabold uppercase tracking-wider text-[#8B1717]">
                      Classe/Outras:
                    </span>
                    {classAndOtherSkills.map((sk) => {
                      const calc = calculateSkillBonus(sheet, sk.key);
                      const primarySrc = skillSources[sk.key]?.[0] ?? 'Classe';
                      return (
                        <button
                          key={sk.key}
                          type="button"
                          onClick={() =>
                            setExpanded((prev) => ({ ...prev, [sk.ability]: true }))
                          }
                          className={`px-1.5 py-0.5 rounded border font-bold cursor-pointer ${SOURCE_BADGE_STYLES[primarySrc]}`}
                        >
                          {sk.label} {formatSigned(calc.total)}
                          {primarySrc !== 'Classe' ? ` · ${primarySrc}` : ''}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Column Legend (dense) */}
            <div className="px-2.5 py-1 bg-[#F7F3EA] border-b border-[#DDD5C7] flex items-center justify-between text-[9px] font-extrabold uppercase tracking-wider text-[#6B6258]">
              <span>Atributo (toque p/ configurar)</span>
              <div className="flex items-center gap-2 pr-0.5">
                <span className="w-[40px] text-center">Mod</span>
                <span className="w-[62px] text-center">SG</span>
              </div>
            </div>

            {/* 6 Compact Retractable Attribute Rows (1-col portrait, 2-col desktop) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:gap-px lg:bg-[#DDD5C7]">
          {ABILITIES.map((ab) => {
            const isOpen = expanded[ab.key];
            const score = sheet.atributos[ab.key];
            const mod = getAbilityMod(score);
            const abilityCheck = calculateAbilityCheckBonus(sheet, ab.key);
            const save = calculateSaveBonus(sheet, ab.key);
            const saveProf = sheet.salvaguardasProf[ab.key];
            const profSkillCount = ab.skills.filter((sk) => (sheet.periciasProf[sk] ?? 0) > 0).length;
            const abHelp = ABILITY_RULE_HELP[ab.key];

            return (
              <div
                key={ab.key}
                data-testid={`ability-box-${ab.key}`}
                className="bg-white"
              >
                {/* Compact Always-Visible Summary Row */}
                <div
                  className={`px-2 py-1.5 flex items-center justify-between gap-1.5 transition-colors ${
                    isOpen ? 'bg-[#F8F4EB] border-b border-[#E5DFD3]' : 'hover:bg-[#FAF8F3]'
                  }`}
                >
                  {/* Tap Target to Expand/Collapse */}
                  <button
                    type="button"
                    data-testid={`ability-toggle-${ab.key}`}
                    aria-expanded={isOpen}
                    aria-controls={`ability-drawer-${ab.key}`}
                    onClick={() => toggleAbility(ab.key)}
                    className="flex-1 min-w-0 min-h-[34px] flex items-center gap-1.5 text-left cursor-pointer"
                  >
                    <span className="text-[#6B6258] shrink-0">
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-[#9E1B1B]" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </span>
                    <span className="font-display text-xs font-extrabold text-[#1A1816] w-8 shrink-0">
                      {ab.shortLabel}
                    </span>
                    <span className="text-xs text-[#4D453E] truncate">
                      {ab.label}
                      <InfoTip
                        {...abHelp}
                        formula={`Valor ${score} · Teste: ${abilityCheck.breakdown.map((b) => `${formatSigned(b.value)} (${b.label})`).join(' ')} = ${formatSigned(abilityCheck.total)} | SG: ${save.breakdown.map((b) => `${formatSigned(b.value)} (${b.label})`).join(' ')} = ${formatSigned(save.total)}`}
                      />
                    </span>
                    <span
                      className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EFEAE0] text-[#4D453E] tabular-nums shrink-0"
                      title={`Valor base: ${score}`}
                    >
                      {score}
                    </span>
                    {ab.skills.length > 0 && (
                      <span
                        className={`text-[10px] font-bold shrink-0 ${
                          profSkillCount > 0 ? 'text-[#8A6518]' : 'text-[#8C8175]'
                        }`}
                        title={`${ab.skills.length} perícias (${profSkillCount} proficiente)`}
                      >
                        {profSkillCount > 0 ? `●${profSkillCount}` : `(${ab.skills.length})`}
                      </span>
                    )}
                  </button>

                  {/* Right Readouts: Mod + Save proficiency toggle & readout (rolagens em Testes) */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      data-testid={`ability-mod-readout-${ab.key}`}
                      className="quick-test-mod quick-test-mod--ink font-mono text-[11px] font-extrabold tabular-nums min-w-[36px] justify-center"
                    >
                      {formatSigned(abilityCheck.total)}
                    </span>

                    <div className="flex items-center gap-1.5 pl-1.5 border-l border-[#E5DFD3]">
                      <button
                        type="button"
                        onClick={() => toggleSaveProf(ab.key)}
                        aria-pressed={saveProf}
                        aria-label={`Alternar proficiência em Salvaguarda de ${ab.label}`}
                        title="Proficiência na salvaguarda"
                        className={`w-4 h-4 rounded-full border-2 shrink-0 cursor-pointer transition-colors ${
                          saveProf
                            ? 'bg-[#9E1B1B] border-[#9E1B1B]'
                            : 'bg-white border-[#8F8578] hover:border-[#9E1B1B]'
                        }`}
                      />
                      <span
                        data-testid={`save-mod-readout-${ab.key}`}
                        className={`quick-test-mod ${saveProf ? 'quick-test-mod--crimson' : 'quick-test-mod--muted'} font-mono text-[11px] font-extrabold tabular-nums min-w-[36px] justify-center`}
                      >
                        {formatSigned(save.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Drawer: Score Editor + Formula Breakdown + Linked Skills */}
                {isOpen && (
                  <div
                    id={`ability-drawer-${ab.key}`}
                    data-testid={`ability-drawer-${ab.key}`}
                    className="px-2.5 py-2 bg-[#FAF8F3] space-y-2 border-b border-[#DDD5C7]"
                  >
                    {/* Value Editor & Breakdown */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[#E5DFD3]">
                      <div className="flex items-center gap-1">
                        <span className="official-label text-[#1A1816] mr-1">Valor:</span>
                        <button
                          type="button"
                          aria-label={`Diminuir ${ab.label}`}
                          onClick={() => handleScoreChange(ab.key, score - 1)}
                          className="w-6 h-6 flex items-center justify-center rounded border border-[#B8AEA0] bg-white hover:border-[#9E1B1B] cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          id={`attr-${ab.key}`}
                          data-testid={`attr-input-${ab.key}`}
                          type="number"
                          min={1}
                          max={30}
                          value={score}
                          onChange={(e) =>
                            handleScoreChange(ab.key, parseInt(e.target.value, 10) || 10)
                          }
                          className="w-11 h-6 text-center font-mono text-xs font-extrabold text-[#1A1816] bg-white border border-[#8F8578] rounded tabular-nums focus:outline-none focus:border-[#9E1B1B]"
                        />
                        <button
                          type="button"
                          aria-label={`Aumentar ${ab.label}`}
                          onClick={() => handleScoreChange(ab.key, score + 1)}
                          className="w-6 h-6 flex items-center justify-center rounded border border-[#B8AEA0] bg-white hover:border-[#1F6B43] cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-[10px] text-[#5C534A] font-mono">
                        Mod {formatSigned(mod)} · SG {formatSigned(save.total)}
                        {save.breakdown.length > 1
                          ? ` (${save.breakdown.map((b) => `${b.label} ${formatSigned(b.value)}`).join(' ')})`
                          : ''}
                      </div>
                    </div>

                    {/* Linked Skills */}
                    {ab.skills.length > 0 ? (
                      <ul className="space-y-1">
                        {ab.skills.map((skillKey) => {
                          const skDef = SKILL_MAP[skillKey];
                          const prof = sheet.periciasProf[skillKey] ?? 0;
                          const calc = calculateSkillBonus(sheet, skillKey);

                          return (
                            <li
                              key={skillKey}
                              data-testid={`skill-row-${skillKey}`}
                              className="flex items-center justify-between gap-2 py-0.5 px-1.5 rounded bg-white border border-[#EAE4D7]"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <button
                                  type="button"
                                  data-testid={`skill-prof-${skillKey}`}
                                  onClick={() => cycleSkillProf(skillKey)}
                                  aria-label={`Ciclar proficiência de ${skDef.label} (atual: ${
                                    prof === 2
                                      ? 'Especialização'
                                      : prof === 1
                                        ? 'Proficiente'
                                        : 'Sem proficiência'
                                  })`}
                                  title="Toque para alternar: Sem → Proficiente (●) → Especialização (2×)"
                                  className={`w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-extrabold border-2 shrink-0 cursor-pointer transition-colors ${
                                    prof === 2
                                      ? 'bg-[#8A6518] border-[#8A6518] text-white'
                                      : prof === 1
                                        ? 'bg-[#1A1816] border-[#1A1816] text-white'
                                        : 'bg-white border-[#8F8578] text-transparent hover:border-[#1A1816]'
                                  }`}
                                >
                                  {prof === 2 ? '2' : prof === 1 ? '●' : ''}
                                </button>
                                <span
                                  className={`text-xs truncate ${
                                    prof > 0 ? 'font-bold text-[#1A1816]' : 'text-[#4D453E]'
                                  }`}
                                >
                                  {skDef.label}
                                  <InfoTip
                                    {...SKILL_RULE_HELP[skillKey]}
                                    formula={`${calc.breakdown.map((b) => `${formatSigned(b.value)} (${b.label})`).join(' ')} = ${formatSigned(calc.total)}`}
                                  />
                                </span>
                                {prof > 0 && (
                                  <span className="text-[9px] font-bold uppercase text-[#7A5610] shrink-0">
                                    {prof === 2 ? '2×BP' : '+BP'}
                                  </span>
                                )}
                                {calc.breakdown.some((b) => b.isCustom) && (
                                  <span className="px-1 py-0.2 rounded bg-[#F5ECFF] border border-[#C8A6EA] text-[#5B218A] text-[9px] font-extrabold uppercase shrink-0">
                                    Custom
                                  </span>
                                )}
                                {(skillSources[skillKey] ?? []).map((src) => (
                                  <span
                                    key={src}
                                    data-testid={`skill-source-${skillKey}-${src.toLowerCase()}`}
                                    className={`px-1.5 py-0.2 rounded border text-[9px] font-bold shrink-0 ${SOURCE_BADGE_STYLES[src]}`}
                                  >
                                    {src}
                                  </span>
                                ))}
                              </div>

                              <span
                                data-testid={`skill-mod-readout-${skillKey}`}
                                className={`quick-test-mod ${
                                  prof === 2
                                    ? 'quick-test-mod--gold'
                                    : prof === 1
                                      ? 'quick-test-mod--ink'
                                      : 'quick-test-mod--muted'
                                } font-mono text-[11px] font-extrabold tabular-nums min-w-[34px] justify-center shrink-0`}
                              >
                                {formatSigned(calc.total)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-[10px] text-[#6B6258] leading-snug">
                        Constituição não possui perícias vinculadas (afeta Pontos de Vida e testes de Concentração).
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
          </>
        )}
      </section>

      {/* COMPACT COLLAPSIBLE TRAINING & PROFICIENCIES */}
      <section
        className="official-box overflow-hidden"
        data-testid="section-training-proficiencies"
      >
        <button
          type="button"
          data-testid="section-toggle-training"
          onClick={toggleTrainingOpen}
          aria-expanded={trainingOpen}
          className="w-full official-box-header py-1.5 px-2.5 min-h-[38px] text-left cursor-pointer"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {trainingOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#5C534A] shrink-0" />
            )}
            <h3 className="official-box-title truncate">
              Treinamento & Proficiências
            </h3>
          </div>
          <span className="text-[10px] font-semibold text-[#5C534A] truncate max-w-[50%] text-right">
            {armorSummary || 'Sem armaduras'} · {sheet.ferramentasProficiencia.length} ferram.
          </span>
        </button>

        {trainingOpen && (
          <div className="p-2.5 space-y-2 text-xs">
            {/* Armaduras Checkboxes */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2 border-b border-[#DDD5C7]">
              <span className="official-label text-[#1A1816]">Armaduras:</span>
              {(
                [
                  ['leve', 'Leve'],
                  ['media', 'Média'],
                  ['pesada', 'Pesada'],
                  ['escudos', 'Escudos'],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#1A1816] cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={sheet.armadurasTreinamento[key]}
                    onChange={(e) =>
                      onUpdateSheet((prev) => ({
                        ...prev,
                        armadurasTreinamento: {
                          ...prev.armadurasTreinamento,
                          [key]: e.target.checked,
                        },
                      }))
                    }
                    className="w-3.5 h-3.5 accent-[#9E1B1B] rounded"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            {/* Armas */}
            <div className="flex items-center gap-2 pb-2 border-b border-[#DDD5C7]">
              <label htmlFor="weapon-prof-input" className="official-label text-[#1A1816] shrink-0">
                Armas:
              </label>
              <input
                id="weapon-prof-input"
                type="text"
                placeholder="Ex.: Armas Simples, Armas Marciais..."
                value={sheet.armasProficiencia}
                onChange={(e) =>
                  onUpdateSheet((prev) => ({
                    ...prev,
                    armasProficiencia: e.target.value,
                  }))
                }
                className="official-underline-input text-xs text-[#1A1816] placeholder:text-[#9C9285]"
              />
            </div>

            {/* Ferramentas */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-[#5C534A]" />
                <span className="official-label text-[#1A1816]">Ferramentas</span>
              </div>

              {sheet.ferramentasProficiencia.length > 0 && (
                <div className="space-y-1">
                  {sheet.ferramentasProficiencia.map((tool) => {
                    const mod = getAbilityMod(sheet.atributos[tool.defaultAbility]);
                    const total = mod + bp;
                    const hasSynergy =
                      tool.synergySkill && (sheet.periciasProf[tool.synergySkill] ?? 0) > 0;
                    return (
                      <div
                        key={tool.id}
                        className="flex items-center justify-between gap-2 px-2 py-1 rounded border border-[#DDD5C7] bg-[#FAF8F3]"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#1A1816] truncate">{tool.name}</p>
                          <p className="text-[10px] text-[#6B6258]">
                            {tool.defaultAbility.toUpperCase()} + BP
                            {hasSynergy && tool.synergySkill
                              ? ` · Sinergia (${SKILL_MAP[tool.synergySkill].label})`
                              : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="quick-test-mod quick-test-mod--ink font-mono text-[11px] font-extrabold tabular-nums">
                            {formatSigned(total)}
                          </span>
                          <button
                            type="button"
                            aria-label={`Remover ferramenta ${tool.name}`}
                            onClick={() =>
                              onUpdateSheet((prev) => ({
                                ...prev,
                                ferramentasProficiencia: prev.ferramentasProficiencia.filter(
                                  (t) => t.id !== tool.id
                                ),
                              }))
                            }
                            className="p-1 text-[#8C8175] hover:text-[#9E1B1B] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-1">
                <input
                  type="text"
                  list="tools-catalog-datalist"
                  placeholder="Adicionar ferramenta..."
                  value={newToolName}
                  onChange={(e) => setNewToolName(e.target.value)}
                  className="flex-1 min-w-0 min-h-[32px] px-2 rounded border border-[#CFC6B8] bg-[#FAF8F3] text-xs text-[#1A1816] focus:outline-none focus:border-[#9E1B1B]"
                />
                <datalist id="tools-catalog-datalist">
                  {TOOLS_CATALOG.map((t) => (
                    <option key={t.name} value={t.name} />
                  ))}
                </datalist>
                <select
                  aria-label="Atributo da ferramenta"
                  value={newToolAbility}
                  onChange={(e) => setNewToolAbility(e.target.value as AbilityKey)}
                  className="min-h-[32px] px-1.5 rounded border border-[#CFC6B8] bg-[#FAF8F3] text-xs text-[#1A1816]"
                >
                  {ABILITIES.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.shortLabel}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddTool}
                  aria-label="Adicionar ferramenta"
                  className="min-h-[32px] px-2 rounded bg-[#1A1816] text-white text-xs font-bold hover:bg-[#332E2A] cursor-pointer inline-flex items-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
