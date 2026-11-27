import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Minus,
  PawPrint,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Table,
  Trash2,
} from 'lucide-react';
import type {
  AbilityKey,
  CharacterSheet,
  ClassDefinition,
  ClassFeatureCategory,
  CreatureStatBlock,
  CustomFeatEntry,
  CustomVariableModifier,
  CustomVariableTarget,
  FeatDefinition,
  SkillKey,
} from '../types/dnd';
import { CLASS_MAP } from '../data/classes';
import { ABILITIES, ABILITY_MAP, SKILL_MAP, SKILLS } from '../data/core';
import { BACKGROUNDS_LIST, SPECIES_LIST } from '../data/origins';
import { buildFeatRuleHelp } from '../data/rulesHelp';
import {
  formatSigned,
  getAbilityMod,
  getSkillSources,
  getSpeciesDarkvision,
} from '../rules/engine';
import { useSectionOpen } from '../hooks/useCollapsibleSections';
import { InfoTip } from './InfoTip';

interface FeaturesPanelProps {
  sheet: CharacterSheet;
  allClasses?: ClassDefinition[];
  allFeats: FeatDefinition[];
  allCreatures: CreatureStatBlock[];
  onUpdateSheet: (updater: (prev: CharacterSheet) => CharacterSheet) => void;
}

const CATEGORIES: ('Todas' | ClassFeatureCategory)[] = [
  'Todas',
  'Combate',
  'Conjuração',
  'Recurso',
  'Defesa',
  'Exploração',
  'Evolução',
];

export const FeaturesPanel: React.FC<FeaturesPanelProps> = ({
  sheet,
  allClasses,
  allFeats,
  allCreatures,
  onUpdateSheet,
}) => {
  const [featToAdd, setFeatToAdd] = useState('');
  const [featureSearch, setFeatureSearch] = useState('');
  const [levelScope, setLevelScope] = useState<'unlocked' | 'all'>('unlocked');
  const [sourceFilter, setSourceFilter] = useState<'todas' | 'classe' | 'subclasse'>('todas');
  const [categoryFilter, setCategoryFilter] = useState<'Todas' | ClassFeatureCategory>('Todas');
  const [expandAllFeatures, setExpandAllFeatures] = useState(false);
  const [expandedFeatureKeys, setExpandedFeatureKeys] = useState<Record<string, boolean>>({});
  const [showProgressionTable, setShowProgressionTable] = useState(false);
  const [showExtraSectionIdx, setShowExtraSectionIdx] = useState<Record<string, boolean>>({});
  const [showClassDetails, toggleClassDetails] = useSectionOpen('class_details', true);
  const [showClassFeatures, toggleClassFeatures] = useSectionOpen('class_features', true);
  const [showSpeciesBox, toggleSpeciesBox] = useSectionOpen('species_traits', false);
  const [showFeatsBox, toggleFeatsBox] = useSectionOpen('feats_list', true);
  const [showCustomVarsBox, toggleCustomVarsBox] = useSectionOpen('custom_variables', true);
  const [showCompanionBox, toggleCompanionBox] = useSectionOpen('companion_section', true);

  // Manual / Homebrew Feat Form State
  const [showCustomFeatForm, setShowCustomFeatForm] = useState(false);
  const [customFeatForm, setCustomFeatForm] = useState<{
    name: string;
    category: CustomFeatEntry['category'];
    source: string;
    summary: string;
    benefitsText: string;
  }>({
    name: '',
    category: 'Homebrew / Cenário',
    source: '',
    summary: '',
    benefitsText: '',
  });

  // Custom Variable Modifier Form State
  const [showCustomVarForm, setShowCustomVarForm] = useState(false);
  const [customVarForm, setCustomVarForm] = useState<{
    name: string;
    source: string;
    target: CustomVariableTarget;
    subTarget: string;
    flatBonus: string;
    diceFormula: string;
    damageType: string;
    description: string;
  }>({
    name: '',
    source: 'Talento / Cenário',
    target: 'skill',
    subTarget: 'atletismo',
    flatBonus: '2',
    diceFormula: '',
    damageType: 'Energético',
    description: '',
  });

  const cls =
    allClasses?.find((c) => c.id === sheet.classeId) ?? CLASS_MAP[sheet.classeId] ?? undefined;
  const sub = cls?.subclasses.find((s) => s.id === sheet.subclasseId);
  const species = SPECIES_LIST.find((s) => s.id === sheet.especieId);
  const bg = BACKGROUNDS_LIST.find((b) => b.id === sheet.antecedenteId);
  const speciesSub = species?.subOptions?.find((o) => o.id === sheet.especieOpcaoId);
  const darkvision = getSpeciesDarkvision(sheet.especieId, sheet.especieOpcaoId);
  const skillSources = useMemo(() => getSkillSources(sheet), [sheet]);

  const allCombinedFeatures = useMemo(() => {
    const classList = (cls?.features ?? []).map((f) => ({
      ...f,
      source: 'classe' as const,
      originLabel: cls?.name ?? 'Classe',
    }));
    const subList = (sub?.features ?? []).map((f) => ({
      ...f,
      source: 'subclasse' as const,
      originLabel: sub?.name ?? 'Subclasse',
    }));
    return [...classList, ...subList].sort((a, b) => a.level - b.level);
  }, [cls, sub]);

  const filteredFeatures = useMemo(() => {
    const q = featureSearch.trim().toLowerCase();
    return allCombinedFeatures.filter((f) => {
      if (levelScope === 'unlocked' && f.level > sheet.nivel) return false;
      if (sourceFilter !== 'todas' && f.source !== sourceFilter) return false;
      if (categoryFilter !== 'Todas' && (f.category ?? 'Evolução') !== categoryFilter) return false;
      if (q) {
        const hay = [f.name, f.description, ...(f.details ?? []), f.originLabel]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allCombinedFeatures, featureSearch, levelScope, sheet.nivel, sourceFilter, categoryFilter]);

  const allExtraSections = useMemo(() => {
    const list: { key: string; title: string; items: string[] }[] = [];
    (cls?.extraSections ?? []).forEach((sec, idx) =>
      list.push({ key: `cls-${idx}`, title: sec.title, items: sec.items })
    );
    (sub?.extraSections ?? []).forEach((sec, idx) =>
      list.push({ key: `sub-${idx}`, title: `${sub?.name ?? 'Subclasse'}: ${sec.title}`, items: sec.items })
    );
    return list;
  }, [cls, sub]);

  const selectedFeats = sheet.talentosIds
    .map((id) => allFeats.find((f) => f.id === id))
    .filter((f): f is FeatDefinition => Boolean(f));

  const companion = sheet.companheiroId
    ? allCreatures.find((c) => c.id === sheet.companheiroId) ?? null
    : null;

  const classSkillOptions: SkillKey[] = cls
    ? cls.skillChoices === 'any'
      ? SKILLS.map((s) => s.key)
      : cls.skillChoices
    : [];

  const toggleClassSkillProf = (sk: SkillKey) => {
    onUpdateSheet((prev) => ({
      ...prev,
      periciasProf: {
        ...prev.periciasProf,
        [sk]: (prev.periciasProf[sk] ?? 0) > 0 ? 0 : 1,
      },
    }));
  };

  const customFeats = sheet.customFeats ?? [];
  const customVariables = sheet.customVariables ?? [];

  const handleAddFeat = () => {
    if (!featToAdd || sheet.talentosIds.includes(featToAdd)) return;
    onUpdateSheet((prev) => ({
      ...prev,
      talentosIds: [...prev.talentosIds, featToAdd],
    }));
    setFeatToAdd('');
  };

  const handleAddCustomFeat = (e: React.FormEvent) => {
    e.preventDefault();
    const name = customFeatForm.name.trim();
    if (!name) return;
    const entry: CustomFeatEntry = {
      id: `cfeat_${Date.now()}`,
      name,
      category: customFeatForm.category,
      source: customFeatForm.source.trim() || 'Homebrew',
      summary: customFeatForm.summary.trim() || 'Talento personalizado adicionado manualmente.',
      benefits: customFeatForm.benefitsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    };
    onUpdateSheet((prev) => ({
      ...prev,
      customFeats: [...(prev.customFeats ?? []), entry],
    }));
    setCustomFeatForm({
      name: '',
      category: 'Homebrew / Cenário',
      source: '',
      summary: '',
      benefitsText: '',
    });
    setShowCustomFeatForm(false);
  };

  const handleAddCustomVariable = (e: React.FormEvent) => {
    e.preventDefault();
    const name = customVarForm.name.trim();
    if (!name) return;
    const flatBonus = parseInt(customVarForm.flatBonus, 10) || 0;
    const diceFormula = customVarForm.diceFormula.trim();
    const needsSub =
      customVarForm.target === 'skill' ||
      customVarForm.target === 'save' ||
      customVarForm.target === 'ability';
    const entry: CustomVariableModifier = {
      id: `cvar_${Date.now()}`,
      name,
      source: customVarForm.source.trim() || 'Custom',
      target: customVarForm.target,
      subTarget:
        needsSub && customVarForm.subTarget && customVarForm.subTarget !== 'all'
          ? (customVarForm.subTarget as AbilityKey | SkillKey)
          : undefined,
      flatBonus,
      diceFormula: diceFormula || undefined,
      damageType: diceFormula ? customVarForm.damageType.trim() || 'Mágico' : undefined,
      description: customVarForm.description.trim(),
      enabled: true,
    };
    onUpdateSheet((prev) => ({
      ...prev,
      customVariables: [...(prev.customVariables ?? []), entry],
    }));
    setCustomVarForm({
      name: '',
      source: 'Talento / Cenário',
      target: 'skill',
      subTarget: 'atletismo',
      flatBonus: '2',
      diceFormula: '',
      damageType: 'Energético',
      description: '',
    });
    setShowCustomVarForm(false);
  };

  const formatCustomVarTarget = (v: CustomVariableModifier): string => {
    switch (v.target) {
      case 'all_tests':
        return 'Todos os Testes d20';
      case 'attack':
        return 'Ataque (Armas)';
      case 'damage':
        return 'Dano';
      case 'initiative':
        return 'Iniciativa';
      case 'spell_attack':
        return 'Ataque Mágico';
      case 'spell_dc':
        return 'CD de Magia';
      case 'ac':
        return 'CA';
      case 'speed':
        return 'Deslocamento (m)';
      case 'hp':
        return 'PV Máximos';
      case 'save':
        return v.subTarget && v.subTarget in ABILITY_MAP
          ? `Salvaguarda (${ABILITY_MAP[v.subTarget as AbilityKey].shortLabel})`
          : 'Todas as Salvaguardas';
      case 'ability':
        return v.subTarget && v.subTarget in ABILITY_MAP
          ? `Atributo (${ABILITY_MAP[v.subTarget as AbilityKey].shortLabel})`
          : 'Todos os Atributos';
      case 'skill':
        return v.subTarget && v.subTarget in SKILL_MAP
          ? `Perícia (${SKILL_MAP[v.subTarget as SkillKey].label})`
          : 'Todas as Perícias';
      default:
        return v.target;
    }
  };

  const currentMasteriesCount = (() => {
    if (!cls?.weaponMasteriesByLevel) return 0;
    let count = 0;
    for (const [lvl, val] of Object.entries(cls.weaponMasteriesByLevel)) {
      if (Number(lvl) <= sheet.nivel) count = val;
    }
    return count;
  })();

  const armorListText = cls
    ? (
        [
          ['leve', 'Leves'],
          ['media', 'Médias'],
          ['pesada', 'Pesadas'],
          ['escudos', 'Escudos'],
        ] as const
      )
        .filter(([k]) => cls.armorTraining[k])
        .map(([, label]) => label)
        .join(', ') || 'Nenhuma'
    : '—';

  return (
    <div className="space-y-2.5">
      {/* ================================================================
          DADOS COMPLETOS DA CLASSE & SUBCLASSE
          ================================================================ */}
      <section className="official-box overflow-hidden" data-testid="section-class-summary">
        <button
          type="button"
          data-testid="section-toggle-class-details"
          onClick={toggleClassDetails}
          aria-expanded={showClassDetails}
          className="w-full official-box-header min-h-[38px] py-1.5 px-2.5 text-left cursor-pointer hover:bg-[#EAE3D5] transition-colors"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {showClassDetails ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#5C534A] shrink-0" />
            )}
            <h2 className="official-box-title truncate inline-flex items-center">
              Dados da Classe {cls ? `· ${cls.name}` : ''}
            </h2>
          </div>
          {cls && (
            <span className="font-mono text-[10px] font-bold text-[#7A5610] shrink-0">
              1d{cls.hitDie} · Nv {sheet.nivel}
              {sub ? ` · ${sub.name}` : ''}
            </span>
          )}
        </button>

        {showClassDetails && (
          <div className="p-2.5 space-y-2.5 text-xs">
            {cls ? (
              <>
                {/* Core Class Traits Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <div className="p-1.5 rounded border border-[#DDD5C7] bg-[#FAF8F3]">
                    <span className="official-label block">Dado de Vida</span>
                    <span className="font-mono text-xs font-extrabold text-[#1A1816]">
                      1d{cls.hitDie} / nível
                    </span>
                  </div>
                  <div className="p-1.5 rounded border border-[#DDD5C7] bg-[#FAF8F3]">
                    <span className="official-label block">Atributo Primário</span>
                    <span className="font-bold text-[#1A1816]">
                      {cls.primaryAbilities.map((a) => ABILITY_MAP[a].label).join(' / ')}
                    </span>
                  </div>
                  <div className="p-1.5 rounded border border-[#DDD5C7] bg-[#FAF8F3]">
                    <span className="official-label block">Salvaguardas</span>
                    <span className="font-bold text-[#9E1B1B]">
                      {cls.savingThrows.map((a) => ABILITY_MAP[a].label).join(', ')}
                    </span>
                  </div>
                  <div className="p-1.5 rounded border border-[#DDD5C7] bg-[#FAF8F3]">
                    <span className="official-label block">Subclasse</span>
                    <span className="font-bold text-[#1A1816] block truncate">
                      {sub ? sub.name : sheet.nivel < 3 ? 'Desbloqueia Nv 3' : 'Não selecionada'}
                    </span>
                  </div>
                </div>

                {/* Proficiencies Breakdown (Armaduras, Armas, Ferramentas, Maestria) */}
                <div className="p-2 rounded border border-[#E5DFD3] bg-white space-y-1 text-[11px] leading-relaxed">
                  <p>
                    <strong className="text-[#1A1816]">Armaduras:</strong> {armorListText}
                  </p>
                  <p>
                    <strong className="text-[#1A1816]">Armas:</strong> {cls.weaponProficiencies}
                    {currentMasteriesCount > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#FBF4DC] border border-[#DFD1AE] text-[#7A5610] font-bold">
                        Maestria em Arma: {currentMasteriesCount}
                      </span>
                    )}
                  </p>
                  <p>
                    <strong className="text-[#1A1816]">Ferramentas:</strong>{' '}
                    {cls.toolProficiencies.length > 0 ? cls.toolProficiencies.join(', ') : 'Nenhuma'}
                  </p>
                  {cls.spellcasting.progression !== 'none' && cls.spellcasting.ability && (
                    <p>
                      <strong className="text-[#1A1816]">Conjuração:</strong>{' '}
                      {ABILITY_MAP[cls.spellcasting.ability].label}
                      {cls.spellcasting.focus ? ` · Foco: ${cls.spellcasting.focus}` : ''}
                      {cls.spellcasting.ritualCasting ? ' · Ritual' : ''}
                    </p>
                  )}
                  {(cls.startingEquipmentText || cls.startingEquipmentA.length > 0) && (
                    <p>
                      <strong className="text-[#1A1816]">Equipamento Inicial:</strong>{' '}
                      {cls.startingEquipmentText ??
                        `(A) ${cls.startingEquipmentA.join(', ')}${cls.startingGoldA ? ` + ${cls.startingGoldA} PO` : ''} · ou (B) ${cls.startingGoldB} PO`}
                    </p>
                  )}
                  {cls.multiclassGains && (
                    <p className="text-[#5C534A]">
                      <strong className="text-[#1A1816]">Multiclasse:</strong> {cls.multiclassGains}
                    </p>
                  )}
                  {sub && (
                    <p className="pt-1 border-t border-[#EAE4D7] text-[#4D453E]">
                      <strong className="text-[#7A5610]">{sub.name}:</strong> {sub.summary}
                    </p>
                  )}
                </div>

                {/* Perícias do Antecedente & Perícias Iniciais da Classe (mesmo destaque) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Antecedente Skills */}
                  <div
                    data-testid="class-panel-background-skills"
                    className="p-2 rounded border border-[#DFD1AE] bg-[#FBF7EC] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="official-label text-[#7A5610]">
                        Perícias do Antecedente {bg ? `· ${bg.name}` : ''}
                      </span>
                      <span className="text-[10px] font-bold text-[#7A5610]">+2 automáticas</span>
                    </div>
                    {bg ? (
                      <div className="flex flex-wrap gap-1">
                        {bg.skills.map((sk) => {
                          const active = (sheet.periciasProf[sk] ?? 0) > 0;
                          return (
                            <button
                              key={sk}
                              type="button"
                              onClick={() => toggleClassSkillProf(sk)}
                              className={`px-2 py-0.5 rounded border text-[11px] font-bold cursor-pointer transition-colors ${
                                active
                                  ? 'border-[#8A6518] bg-[#8A6518] text-white'
                                  : 'border-[#DFD1AE] bg-white text-[#7A5610] hover:border-[#8A6518]'
                              }`}
                            >
                              {active ? '● ' : '○ '}
                              {SKILL_MAP[sk].label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#7A6F64]">
                        Selecione um Antecedente na aba Ficha para aplicar as 2 perícias de origem.
                      </p>
                    )}
                  </div>

                  {/* Class Skills */}
                  <div
                    data-testid="class-panel-class-skills"
                    className="p-2 rounded border border-[#DDD5C7] bg-[#FAF8F3] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="official-label text-[#1A1816]">
                        Perícias da Classe (Escolha {cls.skillCount}{' '}
                        {cls.skillChoices === 'any' ? 'quaisquer' : 'da lista'})
                      </span>
                      <span className="text-[10px] text-[#6B6258]">Toque para marcar</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {classSkillOptions.map((sk) => {
                        const active = (sheet.periciasProf[sk] ?? 0) > 0;
                        const origins = skillSources[sk] ?? [];
                        const isFromBg = origins.includes('Antecedente');
                        return (
                          <button
                            key={sk}
                            type="button"
                            onClick={() => toggleClassSkillProf(sk)}
                            className={`px-2 py-0.5 rounded border text-[11px] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1 ${
                              active
                                ? isFromBg
                                  ? 'border-[#8A6518] bg-[#8A6518] text-white'
                                  : 'border-[#1A1816] bg-[#1A1816] text-white'
                                : 'border-[#CFC6B8] bg-white text-[#4D453E] hover:border-[#1A1816]'
                            }`}
                          >
                            <span>
                              {active ? '● ' : '○ '}
                              {SKILL_MAP[sk].label}
                            </span>
                            {isFromBg && (
                              <span className="text-[9px] font-extrabold uppercase px-1 rounded bg-white/20">
                                Antec.
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Collapsible Progression Table (Níveis 1–20 from Bloco 3) */}
                {cls.progressionTable && cls.progressionTable.rows.length > 0 && (
                  <div className="border border-[#CFC6B8] rounded overflow-hidden">
                    <button
                      type="button"
                      data-testid="toggle-progression-table-btn"
                      onClick={() => setShowProgressionTable((v) => !v)}
                      className="w-full px-2.5 py-1.5 bg-[#EFEAE0] flex items-center justify-between text-xs font-bold text-[#1A1816] cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Table className="w-3.5 h-3.5 text-[#8A6518]" />
                        Tabela de Progressão ({cls.name} · Nv 1–20)
                      </span>
                      {showProgressionTable ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {showProgressionTable && (
                      <div className="overflow-x-auto max-h-[280px] overflow-y-auto bg-white">
                        <table className="w-full text-[10px] border-collapse">
                          <thead className="sticky top-0 bg-[#F5F1E8] border-b border-[#CFC6B8]">
                            <tr>
                              {cls.progressionTable.headers.map((h, i) => (
                                <th
                                  key={i}
                                  className="px-1.5 py-1 text-left font-extrabold uppercase text-[#4D453E] whitespace-nowrap"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#EAE4D7]">
                            {cls.progressionTable.rows.map((row, rIdx) => {
                              const rowLevel = parseInt(row[0] ?? '0', 10);
                              const isCurrent = rowLevel === sheet.nivel;
                              return (
                                <tr
                                  key={rIdx}
                                  className={
                                    isCurrent
                                      ? 'bg-[#FBF4DC] font-bold text-[#1A1816]'
                                      : rowLevel <= sheet.nivel
                                        ? 'bg-white text-[#1A1816]'
                                        : 'bg-[#FAF8F3] text-[#7A6F64]'
                                  }
                                >
                                  {row.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className="px-1.5 py-1 align-top whitespace-nowrap first:font-mono"
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Class/Subclass Extra Options (Invocações, Metamagias, Manobras, Surto Selvagem) */}
                {allExtraSections.length > 0 && (
                  <div className="space-y-1.5">
                    {allExtraSections.map((sec) => {
                      const open = Boolean(showExtraSectionIdx[sec.key]);
                      return (
                        <div key={sec.key} className="border border-[#CFC6B8] rounded overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              setShowExtraSectionIdx((prev) => ({
                                ...prev,
                                [sec.key]: !prev[sec.key],
                              }))
                            }
                            className="w-full px-2.5 py-1.5 bg-[#F5F1E8] flex items-center justify-between gap-2 text-left text-[11px] font-bold text-[#1A1816] cursor-pointer"
                          >
                            <span className="inline-flex items-center gap-1.5 min-w-0">
                              <Sparkles className="w-3.5 h-3.5 text-[#8A6518] shrink-0" />
                              <span className="truncate">
                                {sec.title} ({sec.items.length})
                              </span>
                            </span>
                            {open ? (
                              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                            )}
                          </button>
                          {open && (
                            <ul className="p-2 bg-white space-y-1.5 text-[11px] text-[#3F3934] leading-relaxed max-h-[260px] overflow-y-auto divide-y divide-[#EFEAE0]">
                              {sec.items.map((item, i) => (
                                <li key={i} className="pt-1.5 first:pt-0">
                                  {item}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-[#7A6F64]">
                Selecione uma <strong>Classe</strong> na aba <strong>Ficha</strong> (ou no Assistente) para carregar Dado de Vida, Salvaguardas, Perícias iniciais, Tabela 1–20, Recursos e todas as Características sem omissões.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ================================================================
          3. CARACTERÍSTICAS DE CLASSE & SUBCLASSE (PESQUISÁVEL, FILTRÁVEL, SEM CORTES)
          ================================================================ */}
      <section className="official-box overflow-hidden" data-testid="section-class-features">
        <div className="official-box-header min-h-[38px] py-0 px-2.5 gap-2">
          <button
            type="button"
            data-testid="section-toggle-class-features"
            aria-expanded={showClassFeatures}
            onClick={toggleClassFeatures}
            className="flex-1 min-h-[38px] py-1.5 flex items-center gap-1.5 text-left cursor-pointer min-w-0"
          >
            {showClassFeatures ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#5C534A] shrink-0" />
            )}
            <BookOpen className="w-3.5 h-3.5 text-[#8A6518] shrink-0" />
            <h2 className="official-box-title truncate inline-flex items-center">
              Características ({filteredFeatures.length}/{allCombinedFeatures.length})
            </h2>
          </button>
          {showClassFeatures && (
            <button
              type="button"
              onClick={() => setExpandAllFeatures((v) => !v)}
              className="text-[11px] font-bold text-[#9E1B1B] hover:underline cursor-pointer shrink-0 py-1"
            >
              {expandAllFeatures ? 'Compactar' : 'Abrir tudo'}
            </button>
          )}
        </div>

        {showClassFeatures && (
        <div className="p-2 space-y-2">
          {/* Search + Compact Filters */}
          {allCombinedFeatures.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-3.5 h-3.5 text-[#8C8175] absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    data-testid="feature-search-input"
                    placeholder="Buscar característica ou mecânica..."
                    value={featureSearch}
                    onChange={(e) => setFeatureSearch(e.target.value)}
                    className="w-full min-h-[32px] pl-7 pr-2 rounded border border-[#CFC6B8] bg-[#FAF8F3] text-xs text-[#1A1816] focus:outline-none focus:border-[#9E1B1B]"
                  />
                </div>

                <select
                  aria-label="Filtrar por nível"
                  data-testid="feature-level-filter"
                  value={levelScope}
                  onChange={(e) => setLevelScope(e.target.value as 'unlocked' | 'all')}
                  className="min-h-[32px] px-1.5 rounded border border-[#CFC6B8] bg-[#FAF8F3] text-[11px] font-semibold text-[#1A1816]"
                >
                  <option value="unlocked">Até Nv {sheet.nivel}</option>
                  <option value="all">Nv 1–20</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {(['todas', 'classe', 'subclasse'] as const).map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setSourceFilter(src)}
                    className={`px-2 py-0.5 rounded border text-[10px] font-bold cursor-pointer ${
                      sourceFilter === src
                        ? 'border-[#1A1816] bg-[#1A1816] text-white'
                        : 'border-[#CFC6B8] bg-white text-[#5C534A]'
                    }`}
                  >
                    {src === 'todas' ? 'Tudo' : src === 'classe' ? 'Classe' : 'Subclasse'}
                  </button>
                ))}

                <select
                  aria-label="Filtrar por categoria"
                  data-testid="feature-category-filter"
                  value={categoryFilter}
                  onChange={(e) =>
                    setCategoryFilter(e.target.value as 'Todas' | ClassFeatureCategory)
                  }
                  className="ml-auto min-h-[24px] px-1.5 rounded border border-[#CFC6B8] bg-white text-[10px] font-bold text-[#4D453E]"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      Cat.: {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Unabridged Feature List */}
          {filteredFeatures.length > 0 ? (
            <div className="divide-y divide-[#E5DFD3] border border-[#DDD5C7] rounded bg-white">
              {filteredFeatures.map((feat, idx) => {
                const fKey = `${feat.source}-${feat.level}-${feat.name}-${idx}`;
                const isOpen =
                  expandAllFeatures ||
                  Boolean(expandedFeatureKeys[fKey]) ||
                  featureSearch.trim().length > 0;

                return (
                  <article key={fKey} className="bg-white">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedFeatureKeys((prev) => ({ ...prev, [fKey]: !isOpen }))
                      }
                      aria-expanded={isOpen}
                      className="w-full px-2.5 py-2 flex items-center justify-between gap-2 text-left hover:bg-[#FAF8F3] cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isOpen ? (
                          <ChevronDown className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-[#6B6258] shrink-0" />
                        )}
                        <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#EFEAE0] text-[#1A1816] shrink-0">
                          Nv {feat.level}
                        </span>
                        <span className="text-xs font-bold text-[#1A1816] truncate">
                          {feat.name}
                        </span>
                        <InfoTip
                          title={feat.name}
                          subtitle={`Nível ${feat.level} · ${feat.originLabel}${feat.category ? ` · ${feat.category}` : ''}`}
                          body={feat.description}
                          tips={feat.details}
                        />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {feat.source === 'subclasse' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FBF4DC] text-[#7A5610]">
                            Sub
                          </span>
                        )}
                        {feat.category && (
                          <span className="hidden sm:inline text-[9px] font-semibold px-1.5 py-0.5 rounded border border-[#DDD5C7] text-[#5C534A]">
                            {feat.category}
                          </span>
                        )}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-3 pb-2.5 pt-1 bg-[#FAF8F3] border-t border-[#EAE4D7] space-y-1.5 text-xs text-[#2E2A26] leading-relaxed">
                        {feat.description && <p>{feat.description}</p>}
                        {feat.details && feat.details.length > 0 && (
                          <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#3F3934]">
                            {feat.details.map((line, lIdx) => (
                              <li key={lIdx}>{line}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-[#7A6F64] py-2 text-center">
              {cls
                ? 'Nenhuma característica corresponde ao filtro selecionado.'
                : 'Selecione uma Classe na aba Ficha para listar todas as características oficiais.'}
            </p>
          )}

          {/* Custom Notes */}
          <div className="pt-1.5 border-t border-[#E5DFD3]">
            <label htmlFor="class-notes-textarea" className="official-label block mb-1">
              Anotações Adicionais de Características
            </label>
            <textarea
              id="class-notes-textarea"
              rows={2}
              placeholder="Escolhas de Invocações, Metamagias, Manobras ou lembretes..."
              value={sheet.notasCaracteristicas}
              onChange={(e) =>
                onUpdateSheet((prev) => ({ ...prev, notasCaracteristicas: e.target.value }))
              }
              className="w-full p-2 rounded border border-[#CFC6B8] bg-[#FAF8F3] text-xs text-[#1A1816] leading-relaxed focus:outline-none focus:border-[#9E1B1B]"
            />
          </div>
        </div>
        )}
      </section>

      {/* ================================================================
          4. TRAÇOS DE ESPÉCIE & TALENTOS (CADA LISTA E ITEM EM LINHA PRÓPRIA)
          ================================================================ */}
      <div className="space-y-2.5" data-testid="species-and-feats-vertical-stack">
        {/* TRAÇOS DE ESPÉCIE */}
        <section className="official-box overflow-hidden w-full" data-testid="section-species-traits">
          <button
            type="button"
            data-testid="section-toggle-species"
            onClick={toggleSpeciesBox}
            aria-expanded={showSpeciesBox}
            className="w-full official-box-header min-h-[38px] py-1.5 px-2.5 text-left cursor-pointer hover:bg-[#EAE3D5] transition-colors"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {showSpeciesBox ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#5C534A] shrink-0" />
              )}
              <h3 className="official-box-title truncate inline-flex items-center">
                Traços de Espécie
              </h3>
            </div>
            <span className="text-[10px] font-semibold text-[#5C534A] truncate">
              {species ? `${species.name}${darkvision > 0 ? ` · VE ${darkvision}m` : ''}` : 'Nenhuma'}
            </span>
          </button>

          {showSpeciesBox && (
            <div className="p-2.5 space-y-2">
              {speciesSub && (
                <div className="w-full p-2 rounded border border-[#DFD1AE] bg-[#FBF7EC] text-[11px]">
                  <p className="font-bold text-[#7A5610]">
                    {species?.subOptionLabel ?? 'Linhagem'}: {speciesSub.name}
                    {speciesSub.damageResistance ? ` · Resist.: ${speciesSub.damageResistance}` : ''}
                  </p>
                  <p className="text-[#4D453E] mt-0.5">{speciesSub.summary}</p>
                </div>
              )}

              {species && species.traits.length > 0 ? (
                <div className="flex flex-col divide-y divide-[#E5DFD3]">
                  {species.traits.map((tr) => (
                    <article key={tr.name} className="w-full py-1.5 first:pt-0 last:pb-0">
                      <h4 className="text-xs font-bold text-[#1A1816] inline-flex items-center">
                        {tr.name}
                        <InfoTip
                          title={tr.name}
                          subtitle={`Traço de Espécie · ${species.name}`}
                          body={tr.description}
                        />
                      </h4>
                      <p className="text-[11px] text-[#4D453E] mt-0.5 leading-relaxed">
                        {tr.description}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#7A6F64]">
                  Selecione uma Espécie na aba Ficha para carregar os traços oficiais da Espécie.
                </p>
              )}
            </div>
          )}
        </section>

        {/* TALENTOS (ORIGEM / ESPÉCIE + GERAIS / COMBATE / ÉPICOS / MANUAIS — EM LINHAS PRÓPRIAS) */}
        <section className="official-box overflow-hidden w-full" data-testid="section-feats">
          <button
            type="button"
            data-testid="section-toggle-feats"
            onClick={toggleFeatsBox}
            aria-expanded={showFeatsBox}
            className="w-full official-box-header min-h-[38px] py-1.5 px-2.5 text-left cursor-pointer hover:bg-[#EAE3D5] transition-colors"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {showFeatsBox ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#5C534A] shrink-0" />
              )}
              <h3 className="official-box-title truncate inline-flex items-center">
                Talentos (Origem/Espécie & Gerais)
              </h3>
            </div>
            <span className="text-[10px] font-semibold text-[#5C534A]">
              {selectedFeats.length + customFeats.length} ativo(s)
            </span>
          </button>

          {showFeatsBox && (() => {
            const originFeats = selectedFeats.filter(
              (f) => f.category === 'Origem' || f.id === sheet.autoGrants?.backgroundFeatId
            );
            const otherOfficialFeats = selectedFeats.filter(
              (f) => f.category !== 'Origem' && f.id !== sheet.autoGrants?.backgroundFeatId
            );

            return (
            <div className="p-2.5 space-y-2.5">
              {/* Sub-lista dedicada: Talentos de Origem / Espécie */}
              {originFeats.length > 0 && (
                <div
                  data-testid="origin-feats-list"
                  className="w-full rounded border border-[#DFD1AE] bg-[#FBF7EC] overflow-hidden"
                >
                  <div className="px-2.5 py-1 bg-[#F3E9CE] border-b border-[#DFD1AE] text-[10px] font-extrabold uppercase tracking-wider text-[#7A5610]">
                    Talentos de Origem / Espécie ({originFeats.length})
                  </div>
                  <div className="flex flex-col divide-y divide-[#E6DAB9] px-2.5">
                    {originFeats.map((feat) => {
                      const featHelp = buildFeatRuleHelp(feat);
                      return (
                        <article
                          key={feat.id}
                          data-testid={`feat-row-${feat.id}`}
                          className="w-full py-1.5 flex items-start justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1">
                              <h4 className="text-xs font-bold text-[#1A1816]">{feat.name}</h4>
                              <InfoTip
                                title={featHelp.title}
                                subtitle={featHelp.subtitle}
                                body={featHelp.body}
                                tips={featHelp.tips}
                              />
                              <span className="text-[10px] text-[#7A5610]">({feat.category})</span>
                            </div>
                            <p className="text-[10.5px] text-[#4D453E] mt-0.5 leading-snug">
                              {feat.summary}
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label={`Remover talento ${feat.name}`}
                            onClick={() =>
                              onUpdateSheet((prev) => ({
                                ...prev,
                                talentosIds: prev.talentosIds.filter((id) => id !== feat.id),
                              }))
                            }
                            className="p-1 text-[#8C8175] hover:text-[#9E1B1B] cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sub-lista dedicada: Talentos (Gerais, Estilo de Luta, Dádivas Épicas & Manuais) */}
              {(otherOfficialFeats.length > 0 || customFeats.length > 0) && (
                <div
                  data-testid="general-feats-list"
                  className="w-full rounded border border-[#DDD5C7] bg-white overflow-hidden"
                >
                  <div className="px-2.5 py-1 bg-[#F3EFE6] border-b border-[#DDD5C7] text-[10px] font-extrabold uppercase tracking-wider text-[#4D453E]">
                    Talentos ({otherOfficialFeats.length + customFeats.length})
                  </div>
                  <div className="flex flex-col divide-y divide-[#E5DFD3] px-2.5">
                    {otherOfficialFeats.map((feat) => {
                      const featHelp = buildFeatRuleHelp(feat);
                      return (
                        <article
                          key={feat.id}
                          data-testid={`feat-row-${feat.id}`}
                          className="w-full py-1.5 flex items-start justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1">
                              <h4 className="text-xs font-bold text-[#1A1816]">{feat.name}</h4>
                              <InfoTip
                                title={featHelp.title}
                                subtitle={featHelp.subtitle}
                                body={featHelp.body}
                                tips={featHelp.tips}
                              />
                              <span className="text-[10px] text-[#7A6F64]">({feat.category})</span>
                            </div>
                            <p className="text-[10.5px] text-[#4D453E] mt-0.5 leading-snug">
                              {feat.summary}
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label={`Remover talento ${feat.name}`}
                            onClick={() =>
                              onUpdateSheet((prev) => ({
                                ...prev,
                                talentosIds: prev.talentosIds.filter((id) => id !== feat.id),
                              }))
                            }
                            className="p-1 text-[#8C8175] hover:text-[#9E1B1B] cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </article>
                      );
                    })}

                    {customFeats.map((cfeat) => (
                      <article
                        key={cfeat.id}
                        data-testid={`custom-feat-item-${cfeat.id}`}
                        className="w-full py-1.5 flex items-start justify-between gap-2 bg-[#FAF7FD] -mx-1 px-1 rounded"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1">
                            <h4 className="text-xs font-bold text-[#3D1D5C]">{cfeat.name}</h4>
                            <InfoTip
                              title={cfeat.name}
                              subtitle={`${cfeat.category} · ${cfeat.source || 'Homebrew'}`}
                              body={cfeat.summary}
                              tips={cfeat.benefits}
                            />
                            <span className="text-[9px] font-extrabold uppercase px-1 py-0.2 rounded bg-[#EFE7FA] text-[#5B2D8B]">
                              {cfeat.source || 'Manual'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#4D453E] mt-0.5 leading-relaxed">
                            {cfeat.summary}
                          </p>
                          {cfeat.benefits && cfeat.benefits.length > 0 && (
                            <ul className="list-disc pl-4 mt-0.5 text-[10px] text-[#5C534A] space-y-0.5">
                              {cfeat.benefits.map((b, i) => (
                                <li key={i}>{b}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label={`Remover talento manual ${cfeat.name}`}
                          onClick={() =>
                            onUpdateSheet((prev) => ({
                              ...prev,
                              customFeats: (prev.customFeats ?? []).filter((f) => f.id !== cfeat.id),
                            }))
                          }
                          className="p-1 text-[#8C8175] hover:text-[#9E1B1B] cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {selectedFeats.length === 0 && customFeats.length === 0 && (
                <p className="text-xs text-[#7A6F64]">
                  Nenhum talento adicionado. Selecione no catálogo abaixo, escolha um Antecedente ou crie um talento manual.
                </p>
              )}

              {/* Catalog Feat Selector */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-[#E5DFD3]">
                <select
                  aria-label="Adicionar talento"
                  data-testid="add-feat-select"
                  value={featToAdd}
                  onChange={(e) => setFeatToAdd(e.target.value)}
                  className="flex-1 min-w-0 min-h-[32px] px-2 rounded border border-[#CFC6B8] bg-[#FAF8F3] text-xs text-[#1A1816]"
                >
                  <option value="">Adicionar Talento oficial...</option>
                  {allFeats.map((f) => (
                    <option key={f.id} value={f.id}>
                      [{f.category}] {f.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  data-testid="confirm-add-feat-btn"
                  onClick={handleAddFeat}
                  aria-label="Confirmar talento"
                  className="min-h-[32px] px-2.5 rounded bg-[#1A1816] text-white text-xs font-bold hover:bg-[#332E2A] cursor-pointer inline-flex items-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Manual / Homebrew Feat Toggle & Form */}
              <div className="pt-1">
                <button
                  type="button"
                  data-testid="toggle-custom-feat-form-btn"
                  onClick={() => setShowCustomFeatForm((v) => !v)}
                  className="text-[11px] font-bold text-[#5B2D8B] hover:underline cursor-pointer"
                >
                  {showCustomFeatForm ? '− Fechar talento manual' : '+ Talento Manual (Outro Livro / Cenário)'}
                </button>

                {showCustomFeatForm && (
                  <form
                    onSubmit={handleAddCustomFeat}
                    data-testid="custom-feat-form"
                    className="mt-1.5 p-2 rounded border border-[#C9B3E6] bg-[#FAF7FD] space-y-1.5"
                  >
                    <input
                      type="text"
                      required
                      data-testid="custom-feat-name-input"
                      placeholder="Nome do Talento (ex.: Marca do Dragão)"
                      value={customFeatForm.name}
                      onChange={(e) => setCustomFeatForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full min-h-[30px] px-2 rounded border border-[#C9B3E6] bg-white text-xs"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        aria-label="Categoria do talento manual"
                        value={customFeatForm.category}
                        onChange={(e) =>
                          setCustomFeatForm((f) => ({
                            ...f,
                            category: e.target.value as CustomFeatEntry['category'],
                          }))
                        }
                        className="min-h-[30px] px-2 rounded border border-[#C9B3E6] bg-white text-xs"
                      >
                        <option value="Homebrew / Cenário">Homebrew / Cenário</option>
                        <option value="Origem">Origem</option>
                        <option value="Geral">Geral</option>
                        <option value="Estilo de Luta">Estilo de Luta</option>
                        <option value="Dádiva Épica">Dádiva Épica</option>
                      </select>
                      <input
                        type="text"
                        data-testid="custom-feat-source-input"
                        placeholder="Fonte (ex.: Eberron, Mesa)"
                        value={customFeatForm.source}
                        onChange={(e) =>
                          setCustomFeatForm((f) => ({ ...f, source: e.target.value }))
                        }
                        className="min-h-[30px] px-2 rounded border border-[#C9B3E6] bg-white text-xs"
                      />
                    </div>
                    <textarea
                      rows={2}
                      data-testid="custom-feat-summary-input"
                      placeholder="Descrição / efeitos do talento..."
                      value={customFeatForm.summary}
                      onChange={(e) =>
                        setCustomFeatForm((f) => ({ ...f, summary: e.target.value }))
                      }
                      className="w-full p-1.5 rounded border border-[#C9B3E6] bg-white text-xs"
                    />
                    <textarea
                      rows={2}
                      placeholder="Benefícios em tópicos (opcional, 1 por linha)"
                      value={customFeatForm.benefitsText}
                      onChange={(e) =>
                        setCustomFeatForm((f) => ({ ...f, benefitsText: e.target.value }))
                      }
                      className="w-full p-1.5 rounded border border-[#C9B3E6] bg-white text-xs"
                    />
                    <button
                      type="submit"
                      data-testid="save-custom-feat-btn"
                      className="w-full min-h-[32px] rounded bg-[#5B2D8B] text-white text-xs font-bold hover:bg-[#46206E] cursor-pointer"
                    >
                      Salvar Talento Manual
                    </button>
                  </form>
                )}
              </div>
            </div>
            );
          })()}
        </section>
      </div>

      {/* ================================================================
          5. VARIÁVEIS CUSTOMIZADAS (HOMEBREW / CENÁRIOS / ITENS MÁGICOS)
          ================================================================ */}
      <section
        className="official-box border-[#B69AD8] overflow-hidden"
        data-testid="section-custom-variables"
      >
        <div className="official-box-header min-h-[38px] py-1 px-2.5 bg-[#F5F0FA] border-[#C9B3E6]">
          <button
            type="button"
            data-testid="section-toggle-custom-vars"
            aria-expanded={showCustomVarsBox}
            onClick={toggleCustomVarsBox}
            className="flex-1 min-w-0 min-h-[32px] flex items-center gap-1.5 text-left cursor-pointer"
          >
            {showCustomVarsBox ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#5B2D8B] shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#5C534A] shrink-0" />
            )}
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#5B2D8B] shrink-0" />
            <h3 className="official-box-title truncate text-[#3D1D5C] inline-flex items-center">
              Variáveis Customizadas
            </h3>
            <span className="text-[10px] font-bold text-[#5B2D8B] shrink-0">
              ({customVariables.filter((v) => v.enabled).length}/{customVariables.length})
            </span>
          </button>
          {showCustomVarsBox && (
            <button
              type="button"
              data-testid="toggle-custom-var-form-btn"
              onClick={() => setShowCustomVarForm((v) => !v)}
              className="text-[11px] font-bold text-[#5B2D8B] hover:underline cursor-pointer pl-2 shrink-0"
            >
              {showCustomVarForm ? 'Fechar' : '+ Nova Variável'}
            </button>
          )}
        </div>

        {showCustomVarsBox && (
          <div className="p-2.5 space-y-2">
            {customVariables.length > 0 ? (
              <div className="divide-y divide-[#E7DEF2] border border-[#DFD2EE] rounded bg-white">
                {customVariables.map((cv) => (
                  <div
                    key={cv.id}
                    data-testid={`custom-var-row-${cv.id}`}
                    className={`px-2 py-1.5 flex items-center justify-between gap-2 text-xs ${
                      cv.enabled ? 'bg-white' : 'bg-[#FAF8F3] opacity-60'
                    }`}
                  >
                    <label className="flex items-start gap-2 min-w-0 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cv.enabled}
                        aria-label={`Ativar variável ${cv.name}`}
                        onChange={(e) =>
                          onUpdateSheet((prev) => ({
                            ...prev,
                            customVariables: (prev.customVariables ?? []).map((item) =>
                              item.id === cv.id ? { ...item, enabled: e.target.checked } : item
                            ),
                          }))
                        }
                        className="mt-0.5 w-3.5 h-3.5 accent-[#5B2D8B] shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="font-bold text-[#1A1816]">{cv.name}</span>
                          <InfoTip
                            title={cv.name}
                            subtitle={`[Custom · ${cv.source || 'Homebrew'}] → ${formatCustomVarTarget(cv)}`}
                            body={
                              cv.description ||
                              `Aplica automaticamente ${cv.flatBonus ? formatSigned(cv.flatBonus) : ''}${cv.diceFormula ? ` ${cv.diceFormula} ${cv.damageType ?? ''}` : ''} em ${formatCustomVarTarget(cv)}.`
                            }
                          />
                          <span className="text-[9px] font-extrabold uppercase px-1 rounded bg-[#EFE7FA] text-[#5B2D8B]">
                            Custom
                          </span>
                          {cv.source && (
                            <span className="text-[10px] text-[#6B6258]">· {cv.source}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#5C534A]">
                          Alvo: <strong>{formatCustomVarTarget(cv)}</strong>
                          {cv.flatBonus !== 0 && (
                            <span className="ml-1.5 font-mono font-bold text-[#5B2D8B]">
                              {formatSigned(cv.flatBonus)}
                            </span>
                          )}
                          {cv.diceFormula && (
                            <span className="ml-1.5 font-mono font-bold text-[#9E1B1B]">
                              +{cv.diceFormula} {cv.damageType ?? ''}
                            </span>
                          )}
                        </p>
                      </div>
                    </label>
                    <button
                      type="button"
                      aria-label={`Remover variável ${cv.name}`}
                      onClick={() =>
                        onUpdateSheet((prev) => ({
                          ...prev,
                          customVariables: (prev.customVariables ?? []).filter(
                            (item) => item.id !== cv.id
                          ),
                        }))
                      }
                      className="p-1 text-[#8C8175] hover:text-[#9E1B1B] cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[#6B6258]">
                Crie bônus ou dados extras de talentos manuais, itens mágicos ou regras de cenário. Tudo entra automaticamente nas fórmulas e rolagens com identificação <strong>[Custom]</strong>.
              </p>
            )}

            {showCustomVarForm && (
              <form
                onSubmit={handleAddCustomVariable}
                data-testid="custom-var-form"
                className="p-2 rounded border border-[#C9B3E6] bg-[#FAF7FD] space-y-1.5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    required
                    data-testid="custom-var-name-input"
                    placeholder="Nome (ex.: Bênção da Forja)"
                    value={customVarForm.name}
                    onChange={(e) => setCustomVarForm((f) => ({ ...f, name: e.target.value }))}
                    className="min-h-[30px] px-2 rounded border border-[#C9B3E6] bg-white text-xs"
                  />
                  <input
                    type="text"
                    data-testid="custom-var-source-input"
                    placeholder="Origem (ex.: Item Mágico, Cenário)"
                    value={customVarForm.source}
                    onChange={(e) => setCustomVarForm((f) => ({ ...f, source: e.target.value }))}
                    className="min-h-[30px] px-2 rounded border border-[#C9B3E6] bg-white text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <select
                    aria-label="Alvo da variável customizada"
                    data-testid="custom-var-target-select"
                    value={customVarForm.target}
                    onChange={(e) => {
                      const nextTarget = e.target.value as CustomVariableTarget;
                      setCustomVarForm((f) => ({
                        ...f,
                        target: nextTarget,
                        subTarget:
                          nextTarget === 'skill'
                            ? 'atletismo'
                            : nextTarget === 'save' || nextTarget === 'ability'
                              ? 'for'
                              : 'all',
                      }));
                    }}
                    className="min-h-[30px] px-2 rounded border border-[#C9B3E6] bg-white text-xs"
                  >
                    <option value="skill">Perícia</option>
                    <option value="save">Salvaguarda</option>
                    <option value="ability">Teste de Atributo</option>
                    <option value="attack">Rolagem de Ataque (Armas)</option>
                    <option value="damage">Dano (Fixo e/ou Dados)</option>
                    <option value="initiative">Iniciativa</option>
                    <option value="spell_attack">Ataque Mágico</option>
                    <option value="spell_dc">CD de Magia</option>
                    <option value="ac">Classe de Armadura (CA)</option>
                    <option value="speed">Deslocamento (metros)</option>
                    <option value="hp">Pontos de Vida Máximos</option>
                    <option value="all_tests">Todos os Testes d20</option>
                  </select>

                  {customVarForm.target === 'skill' && (
                    <select
                      aria-label="Perícia alvo"
                      data-testid="custom-var-subtarget-select"
                      value={customVarForm.subTarget}
                      onChange={(e) =>
                        setCustomVarForm((f) => ({ ...f, subTarget: e.target.value }))
                      }
                      className="min-h-[30px] px-2 rounded border border-[#C9B3E6] bg-white text-xs"
                    >
                      <option value="all">Todas as Perícias</option>
                      {SKILLS.map((sk) => (
                        <option key={sk.key} value={sk.key}>
                          {sk.label} ({ABILITY_MAP[sk.ability].shortLabel})
                        </option>
                      ))}
                    </select>
                  )}

                  {(customVarForm.target === 'save' || customVarForm.target === 'ability') && (
                    <select
                      aria-label="Atributo alvo"
                      data-testid="custom-var-subtarget-select"
                      value={customVarForm.subTarget}
                      onChange={(e) =>
                        setCustomVarForm((f) => ({ ...f, subTarget: e.target.value }))
                      }
                      className="min-h-[30px] px-2 rounded border border-[#C9B3E6] bg-white text-xs"
                    >
                      <option value="all">Todos os Atributos</option>
                      {ABILITIES.map((ab) => (
                        <option key={ab.key} value={ab.key}>
                          {ab.label} ({ab.shortLabel})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <label className="official-label block text-[9px] mb-0.5">Bônus Fixo (±)</label>
                    <input
                      type="number"
                      data-testid="custom-var-flat-input"
                      value={customVarForm.flatBonus}
                      onChange={(e) =>
                        setCustomVarForm((f) => ({ ...f, flatBonus: e.target.value }))
                      }
                      className="w-full min-h-[30px] px-2 rounded border border-[#C9B3E6] bg-white font-mono text-xs text-center"
                    />
                  </div>
                  <div>
                    <label className="official-label block text-[9px] mb-0.5">
                      Dados Extras (opc.)
                    </label>
                    <input
                      type="text"
                      data-testid="custom-var-dice-input"
                      placeholder="ex.: 1d6"
                      value={customVarForm.diceFormula}
                      onChange={(e) =>
                        setCustomVarForm((f) => ({ ...f, diceFormula: e.target.value }))
                      }
                      className="w-full min-h-[30px] px-2 rounded border border-[#C9B3E6] bg-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="official-label block text-[9px] mb-0.5">Tipo de Dano</label>
                    <input
                      type="text"
                      data-testid="custom-var-dmgtype-input"
                      placeholder="Ígneo"
                      value={customVarForm.damageType}
                      onChange={(e) =>
                        setCustomVarForm((f) => ({ ...f, damageType: e.target.value }))
                      }
                      className="w-full min-h-[30px] px-2 rounded border border-[#C9B3E6] bg-white text-xs"
                    />
                  </div>
                </div>

                <input
                  type="text"
                  data-testid="custom-var-desc-input"
                  placeholder="Descrição / condição de uso (exibido no ícone i)..."
                  value={customVarForm.description}
                  onChange={(e) =>
                    setCustomVarForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="w-full min-h-[30px] px-2 rounded border border-[#C9B3E6] bg-white text-xs"
                />

                <button
                  type="submit"
                  data-testid="save-custom-var-btn"
                  className="w-full min-h-[32px] rounded bg-[#5B2D8B] text-white text-xs font-bold hover:bg-[#46206E] cursor-pointer"
                >
                  Adicionar Variável Customizada
                </button>
              </form>
            )}
          </div>
        )}
      </section>

      {/* CONDITIONAL COMPANION / FAMILIAR / WILD SHAPE SECTION */}
      {sheet.visibilidade.companheiro && (
        <section className="official-box border-[#7A947C] overflow-hidden">
          <button
            type="button"
            data-testid="section-toggle-companion"
            aria-expanded={showCompanionBox}
            onClick={toggleCompanionBox}
            className="w-full official-box-header min-h-[38px] py-1.5 px-2.5 bg-[#EEF4EE] border-[#7A947C] text-left cursor-pointer hover:bg-[#E2ECE2] transition-colors"
          >
            <h3 className="official-box-title inline-flex items-center gap-1.5 text-[#1F4226] min-w-0">
              {showCompanionBox ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#1F4226] shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#4D5A4F] shrink-0" />
              )}
              <PawPrint className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Companheiro / Familiar / Montaria</span>
            </h3>
            <span className="text-[10px] font-semibold text-[#2F5B39] shrink-0">
              {companion ? companion.name : 'Nenhum'}
            </span>
          </button>
          {showCompanionBox && (
          <div className="p-2.5 space-y-2 text-xs">
            <select
              aria-label="Selecionar criatura do bestiário"
              value={sheet.companheiroId ?? ''}
              onChange={(e) => {
                const cid = e.target.value || null;
                const creature = allCreatures.find((c) => c.id === cid);
                const parsedHp = creature ? parseInt(creature.hp, 10) || 10 : 0;
                onUpdateSheet((prev) => ({
                  ...prev,
                  companheiroId: cid,
                  companheiroPvAtual: parsedHp,
                }));
              }}
              className="w-full min-h-[34px] px-2 rounded border border-[#B9CBB9] bg-[#FAF8F3] text-xs text-[#1A1816]"
            >
              <option value="">Selecionar criatura...</option>
              {allCreatures.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (ND {c.cr} · CA {c.ac})
                </option>
              ))}
            </select>

            {companion && (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[#D5E1D5]">
                  <div>
                    <h4 className="font-display text-sm font-bold text-[#1A1816]">
                      {companion.name}
                    </h4>
                    <p className="text-[11px] text-[#4D5A4F]">
                      {companion.typeSize} · ND {companion.cr} · CA {companion.ac} · Desl. {companion.speed}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-[#2F5B39]">PV:</span>
                    <button
                      type="button"
                      aria-label="Reduzir PV do companheiro"
                      onClick={() =>
                        onUpdateSheet((prev) => ({
                          ...prev,
                          companheiroPvAtual: Math.max(0, prev.companheiroPvAtual - 1),
                        }))
                      }
                      className="w-6 h-6 flex items-center justify-center rounded border border-[#B9CBB9] bg-white cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono text-xs font-extrabold tabular-nums min-w-[26px] text-center">
                      {sheet.companheiroPvAtual}
                    </span>
                    <button
                      type="button"
                      aria-label="Aumentar PV do companheiro"
                      onClick={() =>
                        onUpdateSheet((prev) => ({
                          ...prev,
                          companheiroPvAtual: prev.companheiroPvAtual + 1,
                        }))
                      }
                      className="w-6 h-6 flex items-center justify-center rounded border border-[#B9CBB9] bg-white cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-1 text-center font-mono text-[10px]">
                  {(['for', 'des', 'con', 'int', 'sab', 'car'] as const).map((k) => (
                    <div key={k} className="p-1 rounded bg-[#FAF8F3] border border-[#D5E1D5]">
                      <span className="block text-[9px] text-[#576359] uppercase">{k}</span>
                      <span className="font-bold text-[#1A1816]">
                        {companion.abilities[k]} ({formatSigned(getAbilityMod(companion.abilities[k]))})
                      </span>
                    </div>
                  ))}
                </div>
                {companion.actions.length > 0 && (
                  <p className="text-[11px] text-[#373D38]">
                    <strong className="text-[#2F5B39]">Ações:</strong> {companion.actions.join(' · ')}
                  </p>
                )}
              </div>
            )}
          </div>
          )}
        </section>
      )}
    </div>
  );
};
