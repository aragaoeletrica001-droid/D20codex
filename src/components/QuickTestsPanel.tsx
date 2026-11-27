import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Dices,
  Flame,
  Search,
  Shield,
  Sparkles,
  Star,
  Swords,
  Wrench,
} from 'lucide-react';
import type { CharacterSheet, RollRequest, SpellDefinition } from '../types/dnd';
import { ABILITIES, ABILITY_MAP, SKILLS } from '../data/core';
import { CLASS_MAP } from '../data/classes';
import {
  ABILITY_RULE_HELP,
  buildSpellRuleHelp,
  buildWeaponRuleHelp,
  CORE_RULE_HELP,
  SKILL_RULE_HELP,
} from '../data/rulesHelp';
import {
  applyHealing,
  calculateAbilityCheckBonus,
  calculateAttackStats,
  calculateInitiative,
  calculateMaxHP,
  calculateSaveBonus,
  calculateSkillBonus,
  calculateSpellStats,
  consumeSpellCast,
  formatSigned,
  getAbilityMod,
  getCantripScaledDice,
  getCritThreshold,
  getProficiencyBonus,
  getSkillSources,
  hasSpellcastingAccess,
  spellRequiresTest,
} from '../rules/engine';
import { MiniD20Button } from './MiniD20Button';
import { InfoTip } from './InfoTip';
import { useSectionOpen } from '../hooks/useCollapsibleSections';

interface QuickTestsPanelProps {
  sheet: CharacterSheet;
  allSpells: SpellDefinition[];
  onUpdateSheet: (updater: (prev: CharacterSheet) => CharacterSheet) => void;
  onRequestRoll: (req: RollRequest) => void;
}

type TestFilterTab =
  | 'selecao'
  | 'pericias_ferramentas'
  | 'armas_combate'
  | 'salvaguarda'
  | 'atributos'
  | 'todos';

type ItemGroup = 'pericias_ferramentas' | 'armas_combate' | 'salvaguarda' | 'atributos';

interface QuickTestItem {
  id: string;
  group: ItemGroup;
  iconKind: 'weapon' | 'spell' | 'save' | 'combat' | 'tool' | 'skill' | 'ability';
  name: string;
  subLabel: string;
  badgeText: string;
  badgeTone: 'crimson' | 'gold' | 'ink' | 'muted';
  hasCustomBonus?: boolean;
  infoTitle: string;
  infoSubtitle?: string;
  infoBody: string;
  infoFormula?: string;
  infoTips?: string[];
  rollRequest: RollRequest;
  damageOnlyRequest?: RollRequest;
}

const FILTER_TABS: { id: TestFilterTab; label: string }[] = [
  { id: 'selecao', label: 'Seleção' },
  { id: 'pericias_ferramentas', label: 'Perícias e Ferramentas' },
  { id: 'armas_combate', label: 'Armas e Combate' },
  { id: 'salvaguarda', label: 'Salvaguarda' },
  { id: 'atributos', label: 'Atributos' },
  { id: 'todos', label: 'Todos' },
];

function formatBreakdownFormula(items: { label: string; value: number }[]): string {
  return items
    .map(
      (b, i) =>
        `${i === 0 ? formatSigned(b.value) : b.value >= 0 ? `+ ${b.value}` : `- ${Math.abs(b.value)}`} (${b.label})`
    )
    .join(' ');
}

export const QuickTestsPanel: React.FC<QuickTestsPanelProps> = ({
  sheet,
  allSpells,
  onUpdateSheet,
  onRequestRoll,
}) => {
  const [open, toggleOpen] = useSectionOpen('quick_tests_hub', true);
  const [activeFilter, setActiveFilter] = useState<TestFilterTab>('todos');
  const [search, setSearch] = useState('');

  const cls = CLASS_MAP[sheet.classeId];
  const bp = getProficiencyBonus(sheet.nivel);
  const critThreshold = getCritThreshold(sheet);
  const skillSources = useMemo(() => getSkillSources(sheet), [sheet]);
  const spellStats = useMemo(() => calculateSpellStats(sheet), [sheet]);
  const canCast = useMemo(() => hasSpellcastingAccess(sheet), [sheet]);
  const selectedIds = useMemo(
    () => new Set(sheet.testesSelecionadosIds ?? []),
    [sheet.testesSelecionadosIds]
  );

  const toggleTestSelection = (testId: string) => {
    onUpdateSheet((prev) => {
      const curr = prev.testesSelecionadosIds ?? [];
      const exists = curr.includes(testId);
      return {
        ...prev,
        testesSelecionadosIds: exists ? curr.filter((id) => id !== testId) : [...curr, testId],
      };
    });
  };

  const allTests = useMemo<QuickTestItem[]>(() => {
    const items: QuickTestItem[] = [];

    // 1. ARMAS & COMBATE (Ataques, Iniciativa, Dado de Vida, Ataques Mágicos)
    const init = calculateInitiative(sheet);
    items.push({
      id: 'test_initiative',
      group: 'armas_combate',
      iconKind: 'combat',
      name: 'Iniciativa',
      subLabel: 'Ordem de turno · DES',
      badgeText: formatSigned(init.total),
      badgeTone: 'crimson',
      hasCustomBonus: init.breakdown.some((b) => b.isCustom),
      infoTitle: CORE_RULE_HELP.iniciativa.title,
      infoSubtitle: CORE_RULE_HELP.iniciativa.subtitle,
      infoBody: CORE_RULE_HELP.iniciativa.body,
      infoFormula: formatBreakdownFormula(init.breakdown),
      rollRequest: {
        title: 'Iniciativa',
        subtitle: 'Ordem de combate (Destreza)',
        kind: 'initiative',
        ability: 'des',
        modifier: init.total,
        modifierBreakdown: init.breakdown,
      },
    });

    if (cls) {
      const conMod = getAbilityMod(sheet.atributos.con);
      items.push({
        id: 'test_hit_die',
        group: 'armas_combate',
        iconKind: 'combat',
        name: `Dado de Vida (1d${cls.hitDie})`,
        subLabel: `Descanso Curto · ${Math.max(0, sheet.nivel - sheet.dvGasto)}/${sheet.nivel} disp.`,
        badgeText: `1d${cls.hitDie}${conMod !== 0 ? formatSigned(conMod) : ''}`,
        badgeTone: 'gold',
        infoTitle: CORE_RULE_HELP.dados_vida.title,
        infoSubtitle: CORE_RULE_HELP.dados_vida.subtitle,
        infoBody: CORE_RULE_HELP.dados_vida.body,
        infoFormula: `1d${cls.hitDie} ${formatSigned(conMod)} (Mod. CON)`,
        rollRequest: {
          title: `Dado de Vida (1d${cls.hitDie})`,
          subtitle: 'Recuperação de PV em Descanso Curto',
          kind: 'hit_die',
          ability: 'con',
          modifier: conMod,
          modifierBreakdown: [{ label: 'Mod. CON', value: conMod }],
          diceFormula: `1d${cls.hitDie}`,
          damageType: 'Cura (PV)',
          onComplete: (res) => {
            onUpdateSheet((prev) => {
              const healed = applyHealing(prev, Math.max(1, res.total));
              return {
                ...healed,
                dvGasto: Math.min(prev.nivel, prev.dvGasto + 1),
              };
            });
          },
        },
      });
    }

    for (const atk of sheet.ataques) {
      const stats = calculateAttackStats(sheet, atk);
      const hasCustom =
        stats.attackBreakdown.some((b) => b.isCustom) ||
        stats.damageBreakdown.some((b) => b.isCustom);

      const damageOnly: RollRequest = {
        title: `Dano — ${atk.name}`,
        subtitle: `${stats.damageLabel} ${atk.damageType}`,
        kind: 'damage',
        ability: atk.ability === 'spell' ? undefined : atk.ability,
        modifier: stats.damageBonus,
        modifierBreakdown: stats.damageBreakdown,
        diceFormula: stats.damageDice,
        damageType: atk.damageType,
      };

      const mainReq: RollRequest = atk.isSaveDc
        ? damageOnly
        : {
            title: `Ataque — ${atk.name}`,
            subtitle: `${atk.range}${atk.mastery ? ` · Maestria: ${atk.mastery}` : ''}`,
            kind: atk.kind === 'spell' || atk.kind === 'cantrip' ? 'spell_attack' : 'attack',
            ability: atk.ability === 'spell' ? spellStats.ability ?? undefined : atk.ability,
            modifier: stats.attackBonus,
            modifierBreakdown: stats.attackBreakdown,
            critThreshold,
            followUpDamage: {
              title: `Dano — ${atk.name}`,
              formula: stats.damageDice,
              bonus: stats.damageBonus,
              damageType: atk.damageType,
              breakdown: stats.damageBreakdown,
            },
          };

      const weaponHelp = buildWeaponRuleHelp({
        name: atk.name,
        range: atk.range,
        damageLabel: stats.damageLabel,
        damageType: atk.damageType,
        properties: atk.properties,
        mastery: atk.mastery,
        notes: atk.notes,
      });

      items.push({
        id: `test_atk_${atk.id}`,
        group: 'armas_combate',
        iconKind: 'weapon',
        name: atk.name,
        subLabel: `${stats.damageLabel} ${atk.damageType}${atk.mastery ? ` · ${atk.mastery}` : ''}`,
        badgeText: atk.isSaveDc ? `CD ${stats.saveDc}` : formatSigned(stats.attackBonus),
        badgeTone: 'crimson',
        hasCustomBonus: hasCustom,
        infoTitle: atk.name,
        infoSubtitle: `${atk.range}${atk.properties.length > 0 ? ` · ${atk.properties.join(', ')}` : ''}`,
        infoBody: weaponHelp.body,
        infoTips: weaponHelp.tips.length > 0 ? weaponHelp.tips : undefined,
        infoFormula: atk.isSaveDc
          ? `CD ${stats.saveDc} · Dano: ${stats.damageLabel} ${atk.damageType}`
          : `Acerto: ${formatBreakdownFormula(stats.attackBreakdown)} | Dano: ${stats.damageDice}${stats.damageBreakdown.length ? ` ${formatBreakdownFormula(stats.damageBreakdown)}` : ''}`,
        rollRequest: mainReq,
        damageOnlyRequest: atk.isSaveDc ? undefined : damageOnly,
      });
    }

    if (canCast && spellStats.ability) {
      const abDef = ABILITY_MAP[spellStats.ability];
      items.push({
        id: 'test_spell_attack_generic',
        group: 'armas_combate',
        iconKind: 'spell',
        name: `Ataque Mágico (${abDef.shortLabel})`,
        subLabel: `CD de Magia ${spellStats.spellSaveDc}`,
        badgeText: formatSigned(spellStats.spellAttackBonus),
        badgeTone: 'gold',
        hasCustomBonus: spellStats.attackBreakdown.some((b) => b.isCustom),
        infoTitle: CORE_RULE_HELP.conjuracao.title,
        infoSubtitle: `Atributo: ${abDef.label}`,
        infoBody: CORE_RULE_HELP.conjuracao.body,
        infoFormula: `Ataque: ${formatBreakdownFormula(spellStats.attackBreakdown)} | CD: ${formatBreakdownFormula(spellStats.dcBreakdown)}`,
        rollRequest: {
          title: `Ataque Mágico (${abDef.shortLabel})`,
          subtitle: `CD de Resistência: ${spellStats.spellSaveDc}`,
          kind: 'spell_attack',
          ability: spellStats.ability,
          modifier: spellStats.spellAttackBonus,
          modifierBreakdown: spellStats.attackBreakdown,
          critThreshold,
        },
      });

      const spellAbCheck = calculateAbilityCheckBonus(sheet, spellStats.ability);
      items.push({
        id: 'test_spell_ability_generic',
        group: 'armas_combate',
        iconKind: 'spell',
        name: `Teste de Conjuração (${abDef.shortLabel})`,
        subLabel: 'Dissipar Magia, Contramágica e testes de atributo mágico',
        badgeText: formatSigned(spellAbCheck.total),
        badgeTone: 'gold',
        hasCustomBonus: spellAbCheck.breakdown.some((b) => b.isCustom),
        infoTitle: 'Modificador de Conjuração',
        infoSubtitle: `Atributo: ${abDef.label}`,
        infoBody:
          'Teste de atributo de conjuração usado quando uma magia ou efeito exige um teste com seu atributo mágico (como Dissipar Magia ou Contramágica).',
        infoFormula: formatBreakdownFormula(spellAbCheck.breakdown),
        rollRequest: {
          title: `Teste de Conjuração (${abDef.shortLabel})`,
          subtitle: `Atributo: ${abDef.label}`,
          kind: 'spell_ability',
          ability: spellStats.ability,
          modifier: spellAbCheck.total,
          modifierBreakdown: spellAbCheck.breakdown,
        },
      });
    }

    // Magias Preparadas que exigem teste (Ataque Mágico, Dano/Cura, Salvaguarda contra CD ou Teste de Conjuração)
    if (sheet.magiasPreparadasIds.length > 0) {
      const effectiveSpellAbility = spellStats.ability ?? 'int';
      const abDef = ABILITY_MAP[effectiveSpellAbility];
      const spellAbCheck = calculateAbilityCheckBonus(sheet, effectiveSpellAbility);
      const preparedSpells = sheet.magiasPreparadasIds
        .map((id) => allSpells.find((s) => s.id === id))
        .filter((s): s is SpellDefinition => Boolean(s));

      for (const sp of preparedSpells) {
        if (!spellRequiresTest(sp)) continue;

        const isAttack = sp.attackType === 'melee' || sp.attackType === 'ranged';
        const rawFormula = sp.damageFormula || sp.healingFormula;
        const scaledFormula =
          rawFormula && sp.level === 0 ? getCantripScaledDice(rawFormula, sheet.nivel) : rawFormula;
        const healBonus = sp.healingFormula ? spellStats.abilityMod : 0;
        const usesToday = sheet.magiasUsosHoje?.[sp.id] ?? 0;

        const onSpellRollComplete = () => {
          onUpdateSheet((prev) => consumeSpellCast(prev, sp));
        };

        const rollReq: RollRequest = isAttack
          ? {
              title: `Ataque Mágico — ${sp.name}`,
              subtitle: `${sp.level === 0 ? 'Truque' : `${sp.level}º Círculo`} · ${sp.range}`,
              kind: 'spell_attack',
              ability: effectiveSpellAbility,
              modifier: spellStats.spellAttackBonus,
              modifierBreakdown: spellStats.attackBreakdown,
              critThreshold,
              followUpDamage: scaledFormula
                ? {
                    title: `Dano — ${sp.name}`,
                    formula: scaledFormula,
                    bonus: 0,
                    damageType: sp.damageType ?? 'Mágico',
                  }
                : undefined,
              onComplete: onSpellRollComplete,
            }
          : scaledFormula
            ? {
                title: `${sp.healingFormula ? 'Cura' : 'Dano'} — ${sp.name}`,
                subtitle: `${sp.level === 0 ? 'Truque' : `${sp.level}º Círculo`}${sp.saveAbility ? ` · SG ${sp.saveAbility.toUpperCase()} CD ${spellStats.spellSaveDc}` : ''}`,
                kind: 'damage',
                modifier: healBonus,
                modifierBreakdown:
                  healBonus !== 0
                    ? [{ label: `Mod. ${abDef.shortLabel}`, value: healBonus }]
                    : [],
                diceFormula: scaledFormula,
                damageType: sp.healingFormula ? 'Cura (PV)' : sp.damageType ?? 'Mágico',
                onComplete: onSpellRollComplete,
              }
            : {
                title: `Magia — ${sp.name}`,
                subtitle: sp.saveAbility
                  ? `${sp.level === 0 ? 'Truque' : `${sp.level}º Círculo`} · Alvo faz SG ${sp.saveAbility.toUpperCase()} CD ${spellStats.spellSaveDc}`
                  : `${sp.level === 0 ? 'Truque' : `${sp.level}º Círculo`} · Teste de Conjuração (${abDef.shortLabel})`,
                kind: 'spell_ability',
                ability: effectiveSpellAbility,
                modifier: spellAbCheck.total,
                modifierBreakdown: spellAbCheck.breakdown,
                onComplete: onSpellRollComplete,
              };

        const spellHelp = buildSpellRuleHelp(sp);
        const saveTag = sp.saveAbility ? `SG ${sp.saveAbility.toUpperCase()} CD ${spellStats.spellSaveDc}` : '';
        const effectTag = scaledFormula
          ? `${scaledFormula}${sp.damageType ? ` ${sp.damageType}` : sp.healingFormula ? ' Cura' : ''}`
          : saveTag || `Teste ${abDef.shortLabel}`;

        items.push({
          id: `test_spell_${sp.id}`,
          group: 'armas_combate',
          iconKind: 'spell',
          name: sp.name,
          subLabel: `${sp.level === 0 ? 'Truque' : `${sp.level}º Círc.`} · ${effectTag}${usesToday > 0 ? ` · Usada ${usesToday}×` : ''}`,
          badgeText: isAttack
            ? formatSigned(spellStats.spellAttackBonus)
            : scaledFormula
              ? scaledFormula
              : sp.saveAbility
                ? `CD ${spellStats.spellSaveDc}`
                : formatSigned(spellAbCheck.total),
          badgeTone: 'gold',
          hasCustomBonus: isAttack && spellStats.attackBreakdown.some((b) => b.isCustom),
          infoTitle: spellHelp.title,
          infoSubtitle: spellHelp.subtitle,
          infoBody: spellHelp.body,
          infoTips: spellHelp.tips,
          infoFormula: isAttack
            ? `Ataque: ${formatBreakdownFormula(spellStats.attackBreakdown)}${scaledFormula ? ` | Dano: ${scaledFormula} ${sp.damageType ?? ''}` : ''}`
            : scaledFormula
              ? `Efeito: ${scaledFormula}${saveTag ? ` · ${saveTag}` : ''}`
              : saveTag || `Teste de Conjuração: ${formatBreakdownFormula(spellAbCheck.breakdown)}`,
          rollRequest: rollReq,
        });
      }
    }

    // 2. PERÍCIAS E FERRAMENTAS
    for (const sk of SKILLS) {
      const calc = calculateSkillBonus(sheet, sk.key);
      const prof = sheet.periciasProf[sk.key] ?? 0;
      const origins = skillSources[sk.key] ?? [];
      const help = SKILL_RULE_HELP[sk.key];

      items.push({
        id: `test_skill_${sk.key}`,
        group: 'pericias_ferramentas',
        iconKind: 'skill',
        name: sk.label,
        subLabel: `${ABILITY_MAP[sk.ability].shortLabel}${prof === 2 ? ' · Espec.' : prof === 1 ? ' · Prof.' : ''}${origins.length > 0 ? ` · ${origins.join('/')}` : ''}`,
        badgeText: formatSigned(calc.total),
        badgeTone: prof === 2 ? 'gold' : prof === 1 ? 'ink' : 'muted',
        hasCustomBonus: calc.breakdown.some((b) => b.isCustom),
        infoTitle: help.title,
        infoSubtitle: help.subtitle,
        infoBody: help.body,
        infoTips: help.tips,
        infoFormula: formatBreakdownFormula(calc.breakdown),
        rollRequest: {
          title: `Perícia: ${sk.label}`,
          subtitle: `Atributo: ${ABILITY_MAP[sk.ability].label}`,
          kind: 'skill',
          ability: sk.ability,
          skillKey: sk.key,
          modifier: calc.total,
          modifierBreakdown: calc.breakdown,
        },
      });
    }

    for (const tool of sheet.ferramentasProficiencia) {
      const abCalc = calculateAbilityCheckBonus(sheet, tool.defaultAbility);
      const breakdown = [...abCalc.breakdown, { label: 'Proficiência (BP)', value: bp }];
      const total = breakdown.reduce((s, b) => s + b.value, 0);
      items.push({
        id: `test_tool_${tool.id}`,
        group: 'pericias_ferramentas',
        iconKind: 'tool',
        name: tool.name,
        subLabel: `Ferramenta · ${ABILITY_MAP[tool.defaultAbility].shortLabel} + BP`,
        badgeText: formatSigned(total),
        badgeTone: 'ink',
        hasCustomBonus: breakdown.some((b) => b.isCustom),
        infoTitle: tool.name,
        infoSubtitle: CORE_RULE_HELP.proficiencias.subtitle,
        infoBody: CORE_RULE_HELP.proficiencias.body,
        infoFormula: formatBreakdownFormula(breakdown),
        rollRequest: {
          title: `Ferramenta: ${tool.name}`,
          subtitle: `Atributo padrão: ${ABILITY_MAP[tool.defaultAbility].label}`,
          kind: 'tool',
          ability: tool.defaultAbility,
          modifier: total,
          modifierBreakdown: breakdown,
        },
      });
    }

    // 3. SALVAGUARDAS (6 atributos + Salvaguarda contra Morte)
    for (const ab of ABILITIES) {
      const calc = calculateSaveBonus(sheet, ab.key);
      const prof = sheet.salvaguardasProf[ab.key];
      items.push({
        id: `test_save_${ab.key}`,
        group: 'salvaguarda',
        iconKind: 'save',
        name: `Salvaguarda de ${ab.label}`,
        subLabel: prof ? 'Proficiente' : 'Sem proficiência',
        badgeText: formatSigned(calc.total),
        badgeTone: prof ? 'crimson' : 'muted',
        hasCustomBonus: calc.breakdown.some((b) => b.isCustom),
        infoTitle: `Salvaguarda de ${ab.label}`,
        infoSubtitle: CORE_RULE_HELP.salvaguardas.subtitle,
        infoBody: `${CORE_RULE_HELP.salvaguardas.body}\n\n${ABILITY_RULE_HELP[ab.key].body}`,
        infoFormula: formatBreakdownFormula(calc.breakdown),
        rollRequest: {
          title: `Salvaguarda de ${ab.label}`,
          subtitle: prof ? 'Proficiente' : 'Sem proficiência',
          kind: 'save',
          ability: ab.key,
          modifier: calc.total,
          modifierBreakdown: calc.breakdown,
        },
      });
    }

    items.push({
      id: 'test_death_save',
      group: 'salvaguarda',
      iconKind: 'save',
      name: 'Salvaguarda contra Morte',
      subLabel: `CD 10 · 1d20 puro · Sucessos ${sheet.morteSucessos}/3 · Falhas ${sheet.morteFalhas}/3`,
      badgeText: '1d20',
      badgeTone: 'crimson',
      infoTitle: CORE_RULE_HELP.morte.title,
      infoSubtitle: CORE_RULE_HELP.morte.subtitle,
      infoBody: CORE_RULE_HELP.morte.body,
      infoTips: CORE_RULE_HELP.morte.tips,
      infoFormula: '1d20 (10+ sucesso, 9- falha, 20 recupera 1 PV, 1 = 2 falhas)',
      rollRequest: {
        title: 'Salvaguarda contra Morte',
        subtitle: '10+ Sucesso · 20 = 1 PV · 1 = 2 Falhas',
        kind: 'death_save',
        modifier: 0,
        modifierBreakdown: [],
        onComplete: (res) => {
          onUpdateSheet((prev) => {
            if (res.keptRoll === 20) {
              const currentMax = calculateMaxHP(prev);
              return currentMax > 0
                ? applyHealing(prev, 1)
                : { ...prev, pvAtual: 1, morteSucessos: 0, morteFalhas: 0 };
            }
            if (res.keptRoll === 1) {
              return { ...prev, morteFalhas: Math.min(3, prev.morteFalhas + 2) };
            }
            if (res.total >= 10) {
              return { ...prev, morteSucessos: Math.min(3, prev.morteSucessos + 1) };
            }
            return { ...prev, morteFalhas: Math.min(3, prev.morteFalhas + 1) };
          });
        },
      },
    });

    // 4. ATRIBUTOS (6 testes puros)
    for (const ab of ABILITIES) {
      const calc = calculateAbilityCheckBonus(sheet, ab.key);
      const help = ABILITY_RULE_HELP[ab.key];
      items.push({
        id: `test_ability_${ab.key}`,
        group: 'atributos',
        iconKind: 'ability',
        name: `Teste de ${ab.label}`,
        subLabel: `Valor ${sheet.atributos[ab.key]} (${ab.shortLabel})`,
        badgeText: formatSigned(calc.total),
        badgeTone: 'ink',
        hasCustomBonus: calc.breakdown.some((b) => b.isCustom),
        infoTitle: help.title,
        infoSubtitle: help.subtitle,
        infoBody: help.body,
        infoFormula: formatBreakdownFormula(calc.breakdown),
        rollRequest: {
          title: `Teste de ${ab.label}`,
          subtitle: `Valor ${sheet.atributos[ab.key]}`,
          kind: 'ability',
          ability: ab.key,
          modifier: calc.total,
          modifierBreakdown: calc.breakdown,
        },
      });
    }

    return items;
  }, [sheet, cls, bp, critThreshold, skillSources, spellStats, canCast, allSpells]);

  const selectedCount = useMemo(
    () => allTests.filter((item) => selectedIds.has(item.id)).length,
    [allTests, selectedIds]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTests.filter((item) => {
      if (activeFilter === 'selecao') {
        if (!selectedIds.has(item.id)) return false;
      } else if (activeFilter !== 'todos' && item.group !== activeFilter) {
        return false;
      }
      if (q) {
        const hay = `${item.name} ${item.subLabel} ${item.badgeText}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allTests, activeFilter, selectedIds, search]);

  const itemIcon = (kind: QuickTestItem['iconKind']) => {
    switch (kind) {
      case 'weapon':
        return <Swords className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />;
      case 'spell':
        return <Sparkles className="w-3.5 h-3.5 text-[#8A6518] shrink-0" />;
      case 'save':
        return <Shield className="w-3.5 h-3.5 text-[#7A1818] shrink-0" />;
      case 'combat':
        return <Flame className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />;
      case 'tool':
        return <Wrench className="w-3.5 h-3.5 text-[#5C534A] shrink-0" />;
      default:
        return <Dices className="w-3.5 h-3.5 text-[#5C534A] shrink-0" />;
    }
  };

  return (
    <section
      data-testid="quick-tests-panel"
      className="official-box overflow-hidden"
    >
      <button
        type="button"
        data-testid="section-toggle-quick-tests"
        aria-expanded={open}
        onClick={toggleOpen}
        className="w-full official-box-header min-h-[38px] py-1.5 px-2.5 text-left cursor-pointer hover:bg-[#EAE3D5] transition-colors"
      >
        <h2 className="official-box-title inline-flex items-center gap-1 min-w-0">
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#5C534A] shrink-0" />
          )}
          <Dices className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
          <span className="truncate">
            Testes ({filtered.length})
          </span>
        </h2>
        <span className="text-[10px] font-semibold text-[#6B6258] shrink-0">
          {selectedCount > 0 ? `★ ${selectedCount} na Seleção` : 'Marque p/ Seleção'}
        </span>
      </button>

      {open && (
        <div className="p-2 space-y-2">
          {/* Search + Exact 6 Internal Filter Tabs */}
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8C8175] absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                data-testid="quick-tests-search"
                placeholder="Buscar teste (arma, perícia, salvaguarda, atributo...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full min-h-[34px] pl-7 pr-2 rounded border border-[#CFC6B8] bg-[#FAF8F3] text-xs text-[#1A1816] focus:outline-none focus:border-[#9E1B1B]"
              />
            </div>

            <div
              role="tablist"
              aria-label="Filtros da lista de Testes"
              className="flex flex-wrap items-center gap-1"
            >
              {FILTER_TABS.map((tab) => {
                const isSelectedTab = tab.id === 'selecao';
                const isActive = activeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    data-testid={`quick-tests-filter-${tab.id}`}
                    onClick={() => setActiveFilter(tab.id)}
                    className={`d20-filter-tab px-2 py-1 rounded border text-[10px] font-bold whitespace-nowrap cursor-pointer transition-colors inline-flex items-center gap-1 ${
                      isActive
                        ? isSelectedTab
                          ? 'd20-filter-tab--selecao'
                          : 'd20-filter-tab--active'
                        : ''
                    }`}
                  >
                    {isSelectedTab && <Star className="w-3 h-3" />}
                    <span>
                      {tab.label}
                      {isSelectedTab ? ` (${selectedCount})` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Unified Compact Test List with Selection Checkboxes */}
          {filtered.length === 0 ? (
            <p className="text-[10.5px] text-[#7A6F64] text-center py-3">
              {activeFilter === 'selecao'
                ? 'Nenhum teste selecionado ainda. Marque a caixa de seleção ao lado dos testes nas outras abas para fixá-los aqui.'
                : 'Nenhum teste encontrado para este filtro.'}
            </p>
          ) : (
            <div className="divide-y divide-[#EAE4D7] border border-[#DDD5C7] rounded bg-white">
              {filtered.map((item) => {
                const isChecked = selectedIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    data-testid={`quick-test-row-${item.id}`}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-[#FAF8F3]"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <label
                        title={
                          isChecked
                            ? `Remover "${item.name}" da Seleção`
                            : `Adicionar "${item.name}" à Seleção`
                        }
                        className="flex items-center justify-center min-w-[24px] min-h-[24px] cursor-pointer shrink-0"
                      >
                        <input
                          type="checkbox"
                          data-testid={`test-select-cb-${item.id}`}
                          aria-label={`Selecionar ${item.name} na aba Seleção`}
                          checked={isChecked}
                          onChange={() => toggleTestSelection(item.id)}
                          className="w-3.5 h-3.5 accent-[#8A6518] cursor-pointer"
                        />
                      </label>
                      {itemIcon(item.iconKind)}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-[#1A1816] truncate">
                            {item.name}
                            <InfoTip
                              title={item.infoTitle}
                              subtitle={item.infoSubtitle}
                              body={item.infoBody}
                              formula={item.infoFormula}
                              tips={item.infoTips}
                            />
                          </span>
                          <span
                            data-testid={`quick-test-mod-${item.id}`}
                            className={`quick-test-mod quick-test-mod--${item.badgeTone} font-mono text-[11px] font-extrabold tabular-nums shrink-0`}
                          >
                            {item.badgeText}
                          </span>
                          {item.hasCustomBonus && (
                            <span className="px-1 py-0.2 rounded bg-[#F5ECFF] border border-[#C8A6EA] text-[#5B218A] text-[9px] font-extrabold uppercase shrink-0">
                              Custom
                            </span>
                          )}
                        </div>
                        <p className="text-[9.5px] text-[#6B6258] truncate">{item.subLabel}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <MiniD20Button
                        size="sm"
                        iconOnly
                        variant={
                          item.badgeTone === 'crimson'
                            ? 'crimson'
                            : item.badgeTone === 'gold'
                              ? 'brass'
                              : 'default'
                        }
                        testId={`quick-test-roll-${item.id}`}
                        ariaLabel={`Rolar ${item.name} (${item.badgeText})`}
                        title={`Rolar ${item.name} (${item.badgeText})`}
                        onClick={() => onRequestRoll(item.rollRequest)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
