import type {
  AbilityKey,
  ArmorDefinition,
  AttackEntry,
  CharacterSheet,
  ClassDefinition,
  ClassResourceState,
  CombinedDamagePartResult,
  CombinedDamageResult,
  ConditionId,
  CustomVariableModifier,
  CustomVariableTarget,
  ExtraDamageOption,
  InventoryItem,
  RollConditionHint,
  RollKind,
  RollMode,
  RollResult,
  SheetAutoGrants,
  SkillKey,
  SkillSourceKind,
  SpellDefinition,
  SpellSlotTracker,
  ToolProficiency,
  WeaponDefinition,
} from '../types/dnd';
import { CLASS_MAP } from '../data/classes';
import {
  ABILITY_MAP,
  FULL_CASTER_SLOTS,
  HALF_CASTER_SLOTS,
  PACT_MAGIC_TABLE,
  SKILL_MAP,
  SKILLS,
  THIRD_CASTER_SLOTS,
} from '../data/core';
import { ARMORS_LIST, TOOLS_CATALOG, WEAPONS_LIST } from '../data/equipment';
import { CONDITION_MAP } from '../data/glossary';
import { BACKGROUNDS_LIST, SPECIES_LIST } from '../data/origins';
import { FEATS_LIST } from '../data/feats';

export function getAbilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatSigned(val: number): string {
  return val >= 0 ? `+${val}` : `${val}`;
}

export function getProficiencyBonus(level: number): number {
  const clamped = Math.max(1, Math.min(20, Math.floor(level || 1)));
  return Math.ceil(clamped / 4) + 1;
}

export function getExhaustionD20Penalty(level: number): number {
  const clamped = Math.max(0, Math.min(6, Math.floor(level || 0)));
  return clamped * 2;
}

export function getArmorById(armorId: string): ArmorDefinition {
  return ARMORS_LIST.find((a) => a.id === armorId) ?? ARMORS_LIST[0];
}

export function hasFeat(sheet: CharacterSheet, featId: string): boolean {
  return sheet.talentosIds.includes(featId);
}

/**
 * Retorna variáveis customizadas ativas que incidem sobre um alvo específico.
 * Variáveis de 'all_tests' são incluídas automaticamente nos testes D20
 * (ataque, ataque mágico, salvaguarda, atributo, perícia e iniciativa).
 */
export function getCustomVariablesForTarget(
  sheet: CharacterSheet,
  target: CustomVariableTarget,
  subTarget?: AbilityKey | SkillKey
): CustomVariableModifier[] {
  const vars = sheet.customVariables ?? [];
  const isD20Test =
    target === 'attack' ||
    target === 'save' ||
    target === 'ability' ||
    target === 'skill' ||
    target === 'initiative' ||
    target === 'spell_attack';

  return vars.filter((cv) => {
    if (!cv.enabled) return false;
    if (cv.target === target) {
      if (!cv.subTarget || !subTarget) return !cv.subTarget || cv.subTarget === subTarget;
      return cv.subTarget === subTarget;
    }
    if (isD20Test && cv.target === 'all_tests') {
      return true;
    }
    return false;
  });
}

export function formatCustomVarLabel(cv: CustomVariableModifier): string {
  return cv.source?.trim() ? `[Custom · ${cv.source.trim()}] ${cv.name}` : `[Custom] ${cv.name}`;
}

export function getSpeciesDarkvision(especieId: string, especieOpcaoId?: string): number {
  const sp = SPECIES_LIST.find((s) => s.id === especieId);
  if (!sp) return 0;
  const sub = sp.subOptions?.find((o) => o.id === especieOpcaoId);
  return sub?.darkvisionOverride ?? sp.darkvision ?? 0;
}

export function getSpeciesInnateSpells(especieId: string, especieOpcaoId: string | undefined, level: number): string[] {
  const sp = SPECIES_LIST.find((s) => s.id === especieId);
  if (!sp) return [];
  const spells = new Set<string>(sp.innateSpells ?? []);
  const addFromTable = (table?: Record<number, string[]>) => {
    if (!table) return;
    for (const [reqLvlStr, ids] of Object.entries(table)) {
      if (level >= Number(reqLvlStr)) {
        ids.forEach((id) => spells.add(id));
      }
    }
  };
  addFromTable(sp.innateSpellsByLevel);
  const sub = sp.subOptions?.find((o) => o.id === especieOpcaoId) ?? sp.subOptions?.[0];
  addFromTable(sub?.innateSpellsByLevel);
  return Array.from(spells);
}

export function hasSpellcastingAccess(sheet: CharacterSheet): boolean {
  const cls = CLASS_MAP[sheet.classeId];
  const sub = cls?.subclasses.find((s) => s.id === sheet.subclasseId);
  if (cls && cls.spellcasting.progression !== 'none') return true;
  if (sub?.grantsSpellcasting && sheet.nivel >= 3) return true;
  if (getSpeciesInnateSpells(sheet.especieId, sheet.especieOpcaoId, sheet.nivel).length > 0) return true;
  const grantsFeat = sheet.talentosIds.some((id) => FEATS_LIST.find((f) => f.id === id)?.grantsSpellcasting);
  if (grantsFeat) return true;
  if (sheet.conjuracaoAtributo !== null) return true;
  return false;
}

export function isTrainedInArmor(sheet: CharacterSheet, armor: ArmorDefinition): boolean {
  if (armor.category === 'Nenhuma') return true;
  if (armor.category === 'Leve') return sheet.armadurasTreinamento.leve;
  if (armor.category === 'Média') return sheet.armadurasTreinamento.media;
  if (armor.category === 'Pesada') return sheet.armadurasTreinamento.pesada;
  return true;
}

export interface AcCalculationResult {
  total: number;
  formulaText: string;
  untrainedWarning: boolean;
  stealthDisadvantage: boolean;
  minStrengthWarning: boolean;
}

export function calculateAC(sheet: CharacterSheet): AcCalculationResult {
  const armor = getArmorById(sheet.armorId);
  const desMod = getAbilityMod(sheet.atributos.des);
  const conMod = getAbilityMod(sheet.atributos.con);
  const sabMod = getAbilityMod(sheet.atributos.sab);
  const carMod = getAbilityMod(sheet.atributos.car);
  const hasDefenseStyle = hasFeat(sheet, 'defesa');
  const hasMediumArmorMaster = hasFeat(sheet, 'mestre_armadura_media');

  let base = 10 + desMod;
  let formulaParts: string[] = [];

  if (armor.category === 'Nenhuma') {
    switch (sheet.unarmoredFormula) {
      case 'barbaro':
        base = 10 + desMod + conMod;
        formulaParts.push(`10 + DES (${formatSigned(desMod)}) + CON (${formatSigned(conMod)}) [Defesa Sem Armadura]`);
        break;
      case 'monge':
        base = 10 + desMod + sabMod;
        formulaParts.push(`10 + DES (${formatSigned(desMod)}) + SAB (${formatSigned(sabMod)}) [Defesa Sem Armadura]`);
        break;
      case 'draconico':
        base = 10 + desMod + carMod;
        formulaParts.push(`10 + DES (${formatSigned(desMod)}) + CAR (${formatSigned(carMod)}) [Resiliência Dracônica]`);
        break;
      case 'danca':
        base = 10 + desMod + carMod;
        formulaParts.push(`10 + DES (${formatSigned(desMod)}) + CAR (${formatSigned(carMod)}) [Ginga Fascinante]`);
        break;
      case 'armadura_arcana':
        base = 13 + desMod;
        formulaParts.push(`13 + DES (${formatSigned(desMod)}) [Armadura Arcana]`);
        break;
      case 'pele_arvore':
        base = Math.max(17, 10 + desMod);
        formulaParts.push(`17 [Pele de Árvore]`);
        break;
      default:
        base = 10 + desMod;
        formulaParts.push(`10 + DES (${formatSigned(desMod)})`);
        break;
    }
  } else {
    let appliedDex = 0;
    if (armor.dexCap === null) {
      appliedDex = desMod;
      formulaParts.push(`${armor.name} (${armor.baseAc}) + DES (${formatSigned(appliedDex)})`);
    } else if (armor.dexCap === 0) {
      appliedDex = 0;
      formulaParts.push(`${armor.name} (${armor.baseAc})`);
    } else {
      const cap = armor.category === 'Média' && hasMediumArmorMaster && sheet.atributos.des >= 16 ? 3 : armor.dexCap;
      appliedDex = Math.min(desMod, cap);
      formulaParts.push(`${armor.name} (${armor.baseAc}) + DES (${formatSigned(appliedDex)}, máx +${cap})`);
    }
    base = armor.baseAc + appliedDex;

    if (hasDefenseStyle) {
      base += 1;
      formulaParts.push('+1 [Estilo: Defesa]');
    }
  }

  let shieldBonus = 0;
  const shieldNotAllowedUnarmored =
    armor.category === 'Nenhuma' &&
    (sheet.unarmoredFormula === 'monge' || sheet.unarmoredFormula === 'danca');
  if (sheet.escudoEquipado && !shieldNotAllowedUnarmored) {
    shieldBonus = 2;
    formulaParts.push('+2 [Escudo]');
  }

  const manual = sheet.caBonusManual || 0;
  if (manual !== 0) {
    formulaParts.push(`${formatSigned(manual)} [Bônus/Magias]`);
  }

  let customAcTotal = 0;
  for (const cv of getCustomVariablesForTarget(sheet, 'ac')) {
    if (cv.flatBonus !== 0) {
      customAcTotal += cv.flatBonus;
      formulaParts.push(`${formatSigned(cv.flatBonus)} [${formatCustomVarLabel(cv)}]`);
    }
  }

  const untrainedArmor = !isTrainedInArmor(sheet, armor);
  const untrainedShield = sheet.escudoEquipado && !sheet.armadurasTreinamento.escudos;
  const minStrengthWarning =
    Boolean(armor.minStrength && sheet.atributos.for < armor.minStrength);

  return {
    total: base + shieldBonus + manual + customAcTotal,
    formulaText: formulaParts.join(' '),
    untrainedWarning: untrainedArmor || untrainedShield,
    stealthDisadvantage: armor.stealthDisadvantage,
    minStrengthWarning,
  };
}

export function calculateMaxHP(sheet: CharacterSheet): number {
  if (sheet.pvMaxManualOverride !== null && Number.isFinite(sheet.pvMaxManualOverride)) {
    return Math.max(0, Math.floor(sheet.pvMaxManualOverride));
  }
  const cls = CLASS_MAP[sheet.classeId];
  if (!cls) {
    return Math.max(0, sheet.pvMax || 0);
  }
  const hitDie = cls.hitDie;
  const avgPerLevel = hitDie / 2 + 1;
  const conMod = getAbilityMod(sheet.atributos.con);
  const level = Math.max(1, Math.min(20, sheet.nivel));

  let total = hitDie + conMod;
  if (sheet.hpMode === 'rolagem') {
    for (let lvl = 2; lvl <= level; lvl++) {
      const rolled = sheet.hpRolledPerLevel?.[lvl];
      const dieVal =
        typeof rolled === 'number' && Number.isFinite(rolled) && rolled >= 1
          ? Math.min(hitDie, Math.floor(rolled))
          : avgPerLevel;
      total += Math.max(1, dieVal + conMod);
    }
  } else {
    total += (level - 1) * (avgPerLevel + conMod);
  }

  // Espécie: Anão (Tenacidade Anã: +1 PV por nível)
  if (sheet.especieId === 'anao') {
    total += level;
  }
  // Talento: Vigoroso (+2 PV por nível)
  if (hasFeat(sheet, 'vigoroso')) {
    total += level * 2;
  }
  // Subclasse Feiticeiro: Feitiçaria Dracônica (+1 PV por nível)
  if (sheet.classeId === 'feiticeiro' && sheet.subclasseId === 'draconica' && level >= 3) {
    total += level;
  }
  // Dádiva Épica: Fortitude (+40 PV)
  if (hasFeat(sheet, 'dadiva_fortitude')) {
    total += 40;
  }

  // Variáveis customizadas de PV Máximo
  for (const cv of getCustomVariablesForTarget(sheet, 'hp')) {
    total += cv.flatBonus;
  }

  return Math.max(1, total);
}

export function getMaxAvailableSpellCircle(sheet: CharacterSheet): number {
  let highest = 0;
  for (let c = 1; c <= 9; c++) {
    if ((sheet.espacosMagia[c]?.total ?? 0) > 0) {
      highest = c;
    }
  }
  if (sheet.espacosPacto.total > 0 && sheet.espacosPacto.slotLevel > highest) {
    highest = sheet.espacosPacto.slotLevel;
  }
  return highest;
}

export function calculateInitiative(sheet: CharacterSheet): {
  total: number;
  breakdown: { label: string; value: number; isCustom?: boolean }[];
} {
  const desMod = getAbilityMod(sheet.atributos.des);
  const bp = getProficiencyBonus(sheet.nivel);
  const breakdown: { label: string; value: number; isCustom?: boolean }[] = [
    { label: 'Mod. Destreza', value: desMod },
  ];

  if (hasFeat(sheet, 'alerta')) {
    breakdown.push({ label: 'Talento: Alerta (BP)', value: bp });
  } else if (sheet.classeId === 'bardo' && sheet.nivel >= 2) {
    const halfBp = Math.floor(bp / 2);
    if (halfBp > 0) {
      breakdown.push({ label: 'Pau pra Toda Obra', value: halfBp });
    }
  }

  if (sheet.classeId === 'guardiao' && sheet.subclasseId === 'vigilante_sombras' && sheet.nivel >= 3) {
    const sabMod = getAbilityMod(sheet.atributos.sab);
    if (sabMod !== 0) {
      breakdown.push({ label: 'Emboscador Sombrio (SAB)', value: sabMod });
    }
  }

  if (sheet.iniciativaBonusManual) {
    breakdown.push({ label: 'Bônus Manual', value: sheet.iniciativaBonusManual });
  }

  for (const cv of getCustomVariablesForTarget(sheet, 'initiative')) {
    if (cv.flatBonus !== 0) {
      breakdown.push({ label: formatCustomVarLabel(cv), value: cv.flatBonus, isCustom: true });
    }
  }

  const total = breakdown.reduce((acc, item) => acc + item.value, 0);
  return { total, breakdown };
}

export function calculateSpeed(sheet: CharacterSheet): {
  totalMeters: number;
  notes: string[];
} {
  const species = SPECIES_LIST.find((s) => s.id === sheet.especieId);
  const subOption = species?.subOptions?.find((o) => o.id === sheet.especieOpcaoId);
  let speed = subOption?.speedOverride ?? species?.speed ?? 0;
  const notes: string[] = [];
  if (subOption?.speedOverride) {
    notes.push(`${subOption.speedOverride} m (${subOption.name})`);
  }

  // Zero-speed conditions
  const hasZeroSpeedCond = sheet.condicoesAtivas.some((cid) => CONDITION_MAP[cid]?.zeroSpeed);
  if (hasZeroSpeedCond) {
    return {
      totalMeters: 0,
      notes: ['Deslocamento reduzido a 0 m por condição ativa.'],
    };
  }

  const armor = getArmorById(sheet.armorId);

  // Bárbaro Nv 5+: Movimento Rápido (+3m sem armadura pesada)
  if (sheet.classeId === 'barbaro' && sheet.nivel >= 5 && armor.category !== 'Pesada') {
    speed += 3;
    notes.push('+3 m (Movimento Rápido)');
  }

  // Monge Nv 2+: Movimento Sem Armadura (sem armadura e sem escudo)
  if (sheet.classeId === 'monge' && sheet.nivel >= 2 && armor.category === 'Nenhuma' && !sheet.escudoEquipado) {
    const monkBonus =
      sheet.nivel >= 18 ? 9 : sheet.nivel >= 14 ? 7.5 : sheet.nivel >= 10 ? 6 : sheet.nivel >= 6 ? 4.5 : 3;
    speed += monkBonus;
    notes.push(`+${monkBonus} m (Movimento Sem Armadura)`);
  }

  // Guardião Nv 6+: Errante (+3m sem armadura pesada)
  if (sheet.classeId === 'guardiao' && sheet.nivel >= 6 && armor.category !== 'Pesada') {
    speed += 3;
    notes.push('+3 m (Errante)');
  }

  // Talento Veloz (+3m)
  if (hasFeat(sheet, 'veloz')) {
    speed += 3;
    notes.push('+3 m (Veloz)');
  }

  // Dádiva da Velocidade (+9m)
  if (hasFeat(sheet, 'dadiva_velocidade')) {
    speed += 9;
    notes.push('+9 m (Dádiva da Velocidade)');
  }

  // Armadura Pesada sem Força mínima (-3m)
  if (armor.minStrength && sheet.atributos.for < armor.minStrength) {
    speed -= 3;
    notes.push(`-3 m (Força < ${armor.minStrength} para ${armor.name})`);
  }

  // Exaustão (-1,5m por nível)
  if (sheet.nivelExaustao > 0) {
    const pen = sheet.nivelExaustao * 1.5;
    speed -= pen;
    notes.push(`-${pen} m (Exaustão Nv ${sheet.nivelExaustao})`);
  }

  if (sheet.deslocamentoBonusManual) {
    speed += sheet.deslocamentoBonusManual;
    notes.push(`${formatSigned(sheet.deslocamentoBonusManual)} m (Manual)`);
  }

  for (const cv of getCustomVariablesForTarget(sheet, 'speed')) {
    if (cv.flatBonus !== 0) {
      speed += cv.flatBonus;
      notes.push(`${formatSigned(cv.flatBonus)} m (${formatCustomVarLabel(cv)})`);
    }
  }

  return {
    totalMeters: Math.max(0, Number(speed.toFixed(1))),
    notes,
  };
}

export function calculateAbilityCheckBonus(
  sheet: CharacterSheet,
  ability: AbilityKey
): { total: number; breakdown: { label: string; value: number; isCustom?: boolean }[] } {
  const mod = getAbilityMod(sheet.atributos[ability]);
  const bp = getProficiencyBonus(sheet.nivel);
  const breakdown: { label: string; value: number; isCustom?: boolean }[] = [
    { label: `Mod. ${ABILITY_MAP[ability].shortLabel}`, value: mod },
  ];

  // Bardo Nv 2+: Pau pra Toda Obra em testes de atributo sem proficiência
  if (sheet.classeId === 'bardo' && sheet.nivel >= 2) {
    const halfBp = Math.floor(bp / 2);
    if (halfBp > 0) {
      breakdown.push({ label: 'Pau pra Toda Obra (½ BP)', value: halfBp });
    }
  }

  for (const cv of getCustomVariablesForTarget(sheet, 'ability', ability)) {
    if (cv.flatBonus !== 0) {
      breakdown.push({ label: formatCustomVarLabel(cv), value: cv.flatBonus, isCustom: true });
    }
  }

  return {
    total: breakdown.reduce((sum, b) => sum + b.value, 0),
    breakdown,
  };
}

export function calculateSaveBonus(
  sheet: CharacterSheet,
  ability: AbilityKey
): { total: number; breakdown: { label: string; value: number; isCustom?: boolean }[] } {
  const mod = getAbilityMod(sheet.atributos[ability]);
  const bp = getProficiencyBonus(sheet.nivel);
  const breakdown: { label: string; value: number; isCustom?: boolean }[] = [
    { label: `Mod. ${ABILITY_MAP[ability].shortLabel}`, value: mod },
  ];

  if (sheet.salvaguardasProf[ability]) {
    breakdown.push({ label: 'Proficiência (BP)', value: bp });
  }

  // Paladino Nv 6+: Aura de Proteção (+Mod CAR, mín +1)
  if (sheet.classeId === 'paladino' && sheet.nivel >= 6) {
    const aura = Math.max(1, getAbilityMod(sheet.atributos.car));
    breakdown.push({ label: 'Aura de Proteção', value: aura });
  }

  // Monge Nv 14+: Sobrevivente Disciplinado (proficiência em todas as salvaguardas)
  if (sheet.classeId === 'monge' && sheet.nivel >= 14 && !sheet.salvaguardasProf[ability]) {
    breakdown.push({ label: 'Sobrevivente Disciplinado (BP)', value: bp });
  }

  for (const cv of getCustomVariablesForTarget(sheet, 'save', ability)) {
    if (cv.flatBonus !== 0) {
      breakdown.push({ label: formatCustomVarLabel(cv), value: cv.flatBonus, isCustom: true });
    }
  }

  return {
    total: breakdown.reduce((sum, b) => sum + b.value, 0),
    breakdown,
  };
}

export function calculateSkillBonus(
  sheet: CharacterSheet,
  skillKey: SkillKey
): { total: number; breakdown: { label: string; value: number; isCustom?: boolean }[] } {
  const def = SKILL_MAP[skillKey];
  const mod = getAbilityMod(sheet.atributos[def.ability]);
  const bp = getProficiencyBonus(sheet.nivel);
  const prof = sheet.periciasProf[skillKey] ?? 0;

  const breakdown: { label: string; value: number; isCustom?: boolean }[] = [
    { label: `Mod. ${ABILITY_MAP[def.ability].shortLabel}`, value: mod },
  ];

  if (prof === 1) {
    breakdown.push({ label: 'Proficiência (BP)', value: bp });
  } else if (prof === 2) {
    breakdown.push({ label: 'Especialização (2×BP)', value: bp * 2 });
  } else if (sheet.classeId === 'bardo' && sheet.nivel >= 2) {
    const halfBp = Math.floor(bp / 2);
    if (halfBp > 0) {
      breakdown.push({ label: 'Pau pra Toda Obra', value: halfBp });
    }
  }

  // Clérigo (Ordem Divina: Taumaturgo) ou Druida (Mago da Natureza) — bônus de Sabedoria em Arcanismo/Religião/Natureza se aplicável
  // Guardião (Andarilho Feérico Nv 3+): Encanto Sobrenatural (+SAB em testes de CAR)
  if (
    sheet.classeId === 'guardiao' &&
    sheet.subclasseId === 'andarilho_feerico' &&
    sheet.nivel >= 3 &&
    def.ability === 'car'
  ) {
    const sabBonus = Math.max(1, getAbilityMod(sheet.atributos.sab));
    breakdown.push({ label: 'Encanto Sobrenatural (SAB)', value: sabBonus });
  }

  // Variáveis customizadas para esta perícia ou globais
  for (const cv of getCustomVariablesForTarget(sheet, 'skill', skillKey)) {
    if (cv.flatBonus !== 0) {
      breakdown.push({ label: formatCustomVarLabel(cv), value: cv.flatBonus, isCustom: true });
    }
  }

  return {
    total: breakdown.reduce((sum, b) => sum + b.value, 0),
    breakdown,
  };
}

export function calculatePassivePerception(sheet: CharacterSheet): number {
  const perc = calculateSkillBonus(sheet, 'percepcao').total;
  const exPenalty = getExhaustionD20Penalty(sheet.nivelExaustao);
  return 10 + perc - exPenalty;
}

export function calculateSpellStats(sheet: CharacterSheet): {
  ability: AbilityKey | null;
  abilityMod: number;
  spellSaveDc: number;
  spellAttackBonus: number;
  attackBreakdown: { label: string; value: number; isCustom?: boolean }[];
  dcBreakdown: { label: string; value: number; isCustom?: boolean }[];
} {
  const cls = CLASS_MAP[sheet.classeId];
  const sub = cls?.subclasses.find((s) => s.id === sheet.subclasseId);
  const ability =
    sheet.conjuracaoAtributo ??
    cls?.spellcasting.ability ??
    sub?.grantsSpellcasting?.ability ??
    null;

  const bp = getProficiencyBonus(sheet.nivel);
  const abilityMod = ability ? getAbilityMod(sheet.atributos[ability]) : 0;

  const attackBreakdown: { label: string; value: number; isCustom?: boolean }[] = [
    { label: 'Proficiência (BP)', value: bp },
  ];
  const dcBreakdown: { label: string; value: number; isCustom?: boolean }[] = [
    { label: 'Base', value: 8 },
    { label: 'Proficiência (BP)', value: bp },
  ];

  if (ability) {
    attackBreakdown.push({ label: `Mod. ${ABILITY_MAP[ability].shortLabel}`, value: abilityMod });
    dcBreakdown.push({ label: `Mod. ${ABILITY_MAP[ability].shortLabel}`, value: abilityMod });
  }

  for (const cv of getCustomVariablesForTarget(sheet, 'spell_attack')) {
    if (cv.flatBonus !== 0) {
      attackBreakdown.push({ label: formatCustomVarLabel(cv), value: cv.flatBonus, isCustom: true });
    }
  }

  for (const cv of getCustomVariablesForTarget(sheet, 'spell_dc')) {
    if (cv.flatBonus !== 0) {
      dcBreakdown.push({ label: formatCustomVarLabel(cv), value: cv.flatBonus, isCustom: true });
    }
  }

  return {
    ability,
    abilityMod,
    spellSaveDc: dcBreakdown.reduce((s, b) => s + b.value, 0),
    spellAttackBonus: attackBreakdown.reduce((s, b) => s + b.value, 0),
    attackBreakdown,
    dcBreakdown,
  };
}

export function getCantripScaledDice(baseDice: string, level: number): string {
  const match = baseDice.trim().match(/^(\d+)d(\d+)$/i);
  if (!match) return baseDice;
  const baseCount = parseInt(match[1], 10);
  const dieSides = match[2];
  const tier = level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1;
  return `${baseCount * tier}d${dieSides}`;
}

export function calculateAttackStats(
  sheet: CharacterSheet,
  attack: AttackEntry
): {
  attackBonus: number;
  attackBreakdown: { label: string; value: number; isCustom?: boolean }[];
  damageDice: string;
  damageBonus: number;
  damageBreakdown: { label: string; value: number; isCustom?: boolean }[];
  damageLabel: string;
  saveDc?: number;
} {
  const bp = getProficiencyBonus(sheet.nivel);
  const spellStats = calculateSpellStats(sheet);

  let abilityMod = 0;
  let abilityLabel = 'Atributo';
  if (attack.ability === 'spell') {
    abilityMod = spellStats.abilityMod;
    abilityLabel = spellStats.ability ? `Mod. ${ABILITY_MAP[spellStats.ability].shortLabel}` : 'Mod. Conjuração';
  } else {
    abilityMod = getAbilityMod(sheet.atributos[attack.ability]);
    abilityLabel = `Mod. ${ABILITY_MAP[attack.ability].shortLabel}`;
  }

  const attackBreakdown: { label: string; value: number; isCustom?: boolean }[] = [
    { label: abilityLabel, value: abilityMod },
  ];
  if (attack.proficient) {
    attackBreakdown.push({ label: 'Proficiência (BP)', value: bp });
  }

  // Estilo de Luta: Arquearia (+2 ataque com armas à distância)
  const weapon = attack.weaponId ? WEAPONS_LIST.find((w) => w.id === attack.weaponId) : undefined;
  if (weapon?.isRanged && hasFeat(sheet, 'arquearia')) {
    attackBreakdown.push({ label: 'Estilo: Arquearia', value: 2 });
  }

  if (attack.customAttackBonus) {
    attackBreakdown.push({ label: 'Bônus Extra', value: attack.customAttackBonus });
  }

  const attackVarTarget: CustomVariableTarget =
    attack.kind === 'cantrip' || attack.kind === 'spell' ? 'spell_attack' : 'attack';
  for (const cv of getCustomVariablesForTarget(sheet, attackVarTarget)) {
    if (cv.flatBonus !== 0) {
      attackBreakdown.push({ label: formatCustomVarLabel(cv), value: cv.flatBonus, isCustom: true });
    }
  }

  const attackBonus = attackBreakdown.reduce((sum, b) => sum + b.value, 0);

  let damageDice = attack.damageDice;
  if (attack.kind === 'cantrip') {
    damageDice = getCantripScaledDice(attack.damageDice, sheet.nivel);
  }

  const damageBreakdown: { label: string; value: number; isCustom?: boolean }[] = [];
  if (attack.damageBonusOverride !== undefined && attack.damageBonusOverride !== null) {
    if (attack.damageBonusOverride !== 0) {
      damageBreakdown.push({ label: 'Bônus Fixo', value: attack.damageBonusOverride });
    }
  } else if (attack.kind === 'weapon' || attack.kind === 'unarmed') {
    if (abilityMod !== 0) {
      damageBreakdown.push({ label: abilityLabel, value: abilityMod });
    }
    // Estilo: Duelismo (+2 dano arma 1 mão corpo a corpo)
    if (
      weapon &&
      !weapon.isRanged &&
      !weapon.properties.includes('Duas Mãos') &&
      hasFeat(sheet, 'duelismo')
    ) {
      damageBreakdown.push({ label: 'Estilo: Duelismo', value: 2 });
    }
    // Estilo: Combate com Armas de Arremesso (+2 dano com armas de Arremesso)
    if (weapon?.isThrown && hasFeat(sheet, 'combate_arremesso')) {
      damageBreakdown.push({ label: 'Estilo: Arremesso', value: 2 });
    }
    // Talento: Mestre em Armas Grandes (+BP dano com armas Pesadas)
    if (weapon?.isHeavy && hasFeat(sheet, 'mestre_armas_grandes')) {
      damageBreakdown.push({ label: 'Mestre em Armas Grandes (BP)', value: bp });
    }
  }

  for (const cv of getCustomVariablesForTarget(sheet, 'damage')) {
    if (cv.flatBonus !== 0) {
      damageBreakdown.push({ label: formatCustomVarLabel(cv), value: cv.flatBonus, isCustom: true });
    }
  }

  const damageBonus = damageBreakdown.reduce((sum, b) => sum + b.value, 0);

  const damageLabel =
    damageBonus === 0
      ? `${damageDice}`
      : `${damageDice} ${damageBonus > 0 ? '+' : '-'} ${Math.abs(damageBonus)}`;

  const saveDc = attack.isSaveDc ? spellStats.spellSaveDc : undefined;

  return {
    attackBonus,
    attackBreakdown,
    damageDice,
    damageBonus,
    damageBreakdown,
    damageLabel,
    saveDc,
  };
}

/**
 * Gera a lista de efeitos e danos extras (magias, características de classe,
 * talentos e variáveis customizadas) disponíveis para combinar no modal de rolagem.
 */
export function getAvailableExtraDamageOptions(sheet: CharacterSheet): ExtraDamageOption[] {
  const options: ExtraDamageOption[] = [];
  const lvl = Math.max(1, Math.min(20, sheet.nivel));
  const prepared = new Set([...sheet.magiasPreparadasIds, ...sheet.magiasConhecidasIds]);

  // 1. Características de Classe / Subclasse (auditadas rigorosamente contra D&D 2024)
  if (sheet.classeId === 'barbaro') {
    const rageBonus = lvl >= 16 ? 4 : lvl >= 9 ? 3 : 2;
    options.push({
      id: 'extra_furia',
      label: `Fúria (+${rageBonus})`,
      source: 'Bárbaro',
      flatBonus: rageBonus,
      damageType: 'Mesmo da arma',
      description: `Dano adicional de Fúria para ataques corpo a corpo com Força no nível ${lvl}.`,
    });

    if (sheet.subclasseId === 'berserker' && lvl >= 3) {
      options.push({
        id: 'extra_frenesi',
        label: `Frenesi (+${rageBonus}d6)`,
        source: 'Trilha do Berserker',
        diceFormula: `${rageBonus}d6`,
        damageType: 'Mesmo da arma',
        description: `Usando Ataque Imprudente em Fúria, o 1º alvo atingido no turno com ataque de Força sofre +${rageBonus}d6 de dano adicional.`,
      });
    }

    if (sheet.subclasseId === 'fanatico' && lvl >= 3) {
      const halfLvl = Math.floor(lvl / 2);
      options.push({
        id: 'extra_furia_divina',
        label: `Fúria Divina (+1d6+${halfLvl})`,
        source: 'Trilha do Fanático',
        diceFormula: '1d6',
        flatBonus: halfLvl,
        damageType: 'Radiante',
        description: `1×/turno em Fúria, causa +1d6 + ${halfLvl} (metade do nível de Bárbaro) de dano Radiante ou Necrótico.`,
      });
    }
  }

  if (sheet.classeId === 'guardiao') {
    // Andarilho Feérico: Golpes Terríveis — exatamente 1d4 no Nv 3–10 e 1d6 no Nv 11–20 (nunca 1d6 antes do Nv 11)
    if (sheet.subclasseId === 'andarilho_feerico' && lvl >= 3) {
      const die = lvl >= 11 ? '1d6' : '1d4';
      options.push({
        id: 'extra_golpes_terriveis',
        label: `Golpes Terríveis (+${die})`,
        source: `Andarilho Feérico (Nv ${lvl >= 11 ? '11+' : '3–10'})`,
        diceFormula: die,
        damageType: 'Psíquico',
        description:
          '1×/turno ao atingir uma criatura com uma arma, causa +1d4 de dano Psíquico adicional (aumenta para 1d6 no Nível 11).',
      });
    }

    // Caçador: Assassino de Colossos (+1d8 a partir do Nv 3)
    if (sheet.subclasseId === 'cacador' && lvl >= 3) {
      options.push({
        id: 'extra_assassino_colossos',
        label: 'Assassino de Colossos (+1d8)',
        source: 'Caçador (Nv 3+)',
        diceFormula: '1d8',
        damageType: 'Mesmo da arma',
        description: '1×/turno ao atingir com arma uma criatura com PV abaixo do máximo, causa +1d8 de dano adicional.',
      });
    }

    // Vigilante das Sombras: Golpe Terrível (+2d6 Nv 3–10, +2d8 Nv 11+)
    if (sheet.subclasseId === 'vigilante_sombras' && lvl >= 3) {
      const dice = lvl >= 11 ? '2d8' : '2d6';
      options.push({
        id: 'extra_golpe_terrivel_sombras',
        label: `Golpe Terrível (+${dice})`,
        source: `Vigilante das Sombras (Nv ${lvl >= 11 ? '11+' : '3–10'})`,
        diceFormula: dice,
        damageType: 'Psíquico',
        description:
          '1×/turno ao atingir criatura com arma, causa +2d6 de dano Psíquico adicional (sobe para 2d8 no Nível 11). Consome 1 uso (Mod. SAB/Descanso Longo).',
      });
    }
  }

  if (sheet.classeId === 'ladino') {
    const sneakDice = Math.ceil(lvl / 2);
    options.push({
      id: 'extra_ataque_furtivo',
      label: `Ataque Furtivo (+${sneakDice}d6)`,
      source: 'Ladino',
      diceFormula: `${sneakDice}d6`,
      damageType: 'Mesmo da arma',
      description: `1×/turno com Vantagem ou aliado a 1,5 m do alvo (arma com Acuidade ou à distância).`,
    });
  }

  if (sheet.classeId === 'paladino' || prepared.has('destruicao_divina')) {
    const maxCircle = Math.max(1, Math.min(5, getMaxAvailableSpellCircle(sheet) || 1));
    options.push({
      id: 'extra_destruicao_divina',
      label: 'Destruição Divina (+2d8+)',
      source: 'Paladino / Magia',
      diceFormula: '2d8',
      damageType: 'Radiante',
      description: 'Causa +2d8 Radiante (1º círculo) e +1d8 por círculo superior (+1d8 extra vs Corruptores/Mortos-Vivos).',
      scalableBySlot: {
        minCircle: 1,
        maxCircle,
        baseDiceCount: 2,
        dieSides: 8,
        extraDicePerCircle: 1,
      },
    });
  }

  if (sheet.classeId === 'paladino' && lvl >= 11) {
    options.push({
      id: 'extra_golpes_radiantes',
      label: 'Golpes Radiantes (+1d8)',
      source: 'Paladino Nv 11',
      diceFormula: '1d8',
      damageType: 'Radiante',
      description: 'Todo acerto com arma corpo a corpo ou ataque desarmado causa +1d8 Radiante.',
      defaultChecked: true,
    });
  }

  if (sheet.classeId === 'guerreiro' && sheet.subclasseId === 'mestre_batalha' && lvl >= 3) {
    const die = lvl >= 18 ? '1d12' : lvl >= 10 ? '1d10' : '1d8';
    options.push({
      id: 'extra_manobra',
      label: `Manobra de Superioridade (+${die})`,
      source: 'Mestre da Batalha',
      diceFormula: die,
      damageType: 'Mesmo da arma',
      description: 'Soma o Dado de Superioridade ao dano ao aplicar uma Manobra ofensiva.',
    });
  }

  if (sheet.classeId === 'guerreiro' && sheet.subclasseId === 'psionico' && lvl >= 3) {
    const die = lvl >= 17 ? '1d12' : lvl >= 11 ? '1d10' : lvl >= 5 ? '1d8' : '1d6';
    const intMod = getAbilityMod(sheet.atributos.int);
    options.push({
      id: 'extra_golpe_psionico',
      label: `Golpe Psiônico (+${die}${intMod !== 0 ? formatSigned(intMod) : ''})`,
      source: 'Guerreiro Psiônico',
      diceFormula: die,
      flatBonus: intMod,
      damageType: 'Psíquico',
      description: `1×/turno após atingir alvo a até 9m, gasta 1 Dado de Energia Psiônica para causar +${die} ${formatSigned(intMod)} (Mod. INT) de dano Psíquico.`,
    });
  }

  if (
    (sheet.classeId === 'clerigo' || sheet.classeId === 'druida') &&
    lvl >= 7
  ) {
    const dice = lvl >= 14 ? '2d8' : '1d8';
    options.push({
      id: 'extra_golpe_divino_elemental',
      label: sheet.classeId === 'clerigo' ? `Golpes Abençoados (+${dice})` : `Fúria Elemental (+${dice})`,
      source: sheet.classeId === 'clerigo' ? 'Clérigo' : 'Druida',
      diceFormula: dice,
      damageType: sheet.classeId === 'clerigo' ? 'Radiante' : 'Elemental',
      description: '1×/turno ao acertar com arma, causa dano elemental ou radiante adicional.',
    });
  }

  // 2. Magias de Dano Extra em Ataque (exibidas APENAS se pertencem à classe ou estão preparadas/conhecidas)
  const hasHuntersMark =
    sheet.classeId === 'guardiao' ||
    prepared.has('marca_do_predador') ||
    prepared.has('marca_cacador') ||
    prepared.has('marca_do_cacador');
  if (hasHuntersMark) {
    const markDie = sheet.classeId === 'guardiao' && lvl >= 20 ? '1d10' : '1d6';
    options.push({
      id: 'extra_marca_cacador',
      label: `Marca do Predador (+${markDie})`,
      source: sheet.classeId === 'guardiao' ? 'Guardião / Magia (Conc.)' : 'Magia (Concentração)',
      diceFormula: markDie,
      damageType: 'Energético',
      description:
        sheet.classeId === 'guardiao' && lvl >= 20
          ? 'Matador de Inimigos Favoritos (Nv 20): causa +1d10 de dano Energético em cada acerto contra o alvo marcado.'
          : 'Causa +1d6 de dano Energético sempre que acertar o alvo marcado com um ataque (1d10 no Guardião Nv 20).',
      defaultChecked: sheet.concentrandoEm.toLowerCase().includes('marca'),
    });
  }

  const hasHex =
    sheet.classeId === 'bruxo' ||
    prepared.has('bruxaria') ||
    prepared.has('maldicao') ||
    prepared.has('hex');
  if (hasHex) {
    options.push({
      id: 'extra_bruxaria',
      label: 'Bruxaria / Hex (+1d6)',
      source: sheet.classeId === 'bruxo' ? 'Bruxo / Magia (Conc.)' : 'Magia (Concentração)',
      diceFormula: '1d6',
      damageType: 'Necrótico',
      description: 'Causa +1d6 de dano Necrótico ao acertar o alvo amaldiçoado com uma jogada de ataque.',
      defaultChecked:
        sheet.concentrandoEm.toLowerCase().includes('hex') ||
        sheet.concentrandoEm.toLowerCase().includes('bruxaria'),
    });
  }

  if (sheet.classeId === 'paladino' || sheet.classeId === 'clerigo' || prepared.has('favor_divino')) {
    options.push({
      id: 'extra_favor_divino',
      label: 'Favor Divino (+1d4)',
      source: 'Magia',
      diceFormula: '1d4',
      damageType: 'Radiante',
      description: 'Ataques com arma causam +1d4 de dano Radiante enquanto a magia durar.',
    });
  }

  // 3. Variáveis Customizadas de Dano com dados extras (ex: arma flamejante, talento homebrew)
  for (const cv of getCustomVariablesForTarget(sheet, 'damage')) {
    if (cv.diceFormula && cv.diceFormula.trim()) {
      options.push({
        id: `extra_custom_${cv.id}`,
        label: `${formatCustomVarLabel(cv)} (+${cv.diceFormula.trim()})`,
        source: cv.source || 'Variável Customizada',
        diceFormula: cv.diceFormula.trim(),
        damageType: cv.damageType?.trim() || 'Extra',
        description: cv.description || 'Dado de dano adicional vindo de variável customizada.',
        defaultChecked: true,
        isCustom: true,
      });
    }
  }

  return options;
}

/**
 * Executa a rolagem combinada de dano (dano base + efeitos extras selecionados + dado avulso),
 * dobrando automaticamente os dados em caso de Crítico e retornando descrição detalhada.
 */
export function executeCombinedDamageRoll(params: {
  baseDamage?: {
    title: string;
    formula: string;
    bonus: number;
    damageType: string;
    breakdown?: { label: string; value: number; isCustom?: boolean }[];
  };
  includeBaseDamage: boolean;
  selectedExtras: {
    label: string;
    diceFormula?: string;
    flatBonus?: number;
    damageType: string;
    isCustom?: boolean;
  }[];
  adHocFormula?: string;
  isCrit: boolean;
  rng?: () => number;
}): CombinedDamageResult {
  const rng = params.rng ?? Math.random;
  const parts: CombinedDamagePartResult[] = [];
  const defaultType = params.baseDamage?.damageType || 'Dano';

  if (params.includeBaseDamage && params.baseDamage) {
    const rolled = parseAndRollDiceFormula(
      params.baseDamage.formula,
      params.baseDamage.bonus,
      params.isCrit,
      rng
    );
    const bonusDetail =
      params.baseDamage.breakdown && params.baseDamage.breakdown.length > 0
        ? params.baseDamage.breakdown
            .filter((b) => b.value !== 0)
            .map((b) => `${formatSigned(b.value)} ${b.label}`)
            .join(' ')
        : params.baseDamage.bonus !== 0
          ? formatSigned(params.baseDamage.bonus)
          : '';
    const diceOnly = `[${rolled.rolls.join(' + ')}]`;
    parts.push({
      label: params.baseDamage.title,
      damageType: defaultType,
      total: rolled.total,
      expression: `${params.isCrit ? 'Crít. ×2 ' : ''}${diceOnly}${bonusDetail ? ` ${bonusDetail}` : ''}`,
    });
  }

  for (const extra of params.selectedExtras) {
    const resolvedType = extra.damageType === 'Mesmo da arma' ? defaultType : extra.damageType;
    if (extra.diceFormula && /\dd\d/i.test(extra.diceFormula)) {
      const rolled = parseAndRollDiceFormula(
        extra.diceFormula,
        extra.flatBonus ?? 0,
        params.isCrit,
        rng
      );
      parts.push({
        label: extra.label,
        damageType: resolvedType,
        total: rolled.total,
        expression: `${params.isCrit ? 'Crít. ×2 ' : ''}${rolled.expression}`,
        isCustom: extra.isCustom,
      });
    } else if (extra.flatBonus && extra.flatBonus !== 0) {
      parts.push({
        label: extra.label,
        damageType: resolvedType,
        total: extra.flatBonus,
        expression: `${formatSigned(extra.flatBonus)}`,
        isCustom: extra.isCustom,
      });
    }
  }

  if (params.adHocFormula && params.adHocFormula.trim()) {
    const raw = params.adHocFormula.trim();
    if (/\dd\d/i.test(raw)) {
      const rolled = parseAndRollDiceFormula(raw, 0, params.isCrit, rng);
      parts.push({
        label: `Extra (${raw})`,
        damageType: defaultType,
        total: rolled.total,
        expression: `${params.isCrit ? 'Crít. ×2 ' : ''}${rolled.expression}`,
        isCustom: true,
      });
    } else {
      const flat = parseInt(raw.replace(',', '.'), 10);
      if (Number.isFinite(flat) && flat !== 0) {
        parts.push({
          label: 'Extra Manual',
          damageType: defaultType,
          total: flat,
          expression: formatSigned(flat),
          isCustom: true,
        });
      }
    }
  }

  const total = parts.reduce((sum, p) => sum + p.total, 0);
  const typeTotals = new Map<string, number>();
  for (const p of parts) {
    typeTotals.set(p.damageType, (typeTotals.get(p.damageType) ?? 0) + p.total);
  }
  const byType = Array.from(typeTotals.entries()).map(([damageType, val]) => ({
    damageType,
    total: val,
  }));

  const breakdownText = parts
    .map((p) => `${p.label}: ${p.expression} = ${p.total} (${p.damageType})`)
    .join(' | ');

  return {
    total,
    byType,
    parts,
    breakdownText,
    critDoubled: params.isCrit,
  };
}

export function resolveConditionHintForRoll(
  sheet: CharacterSheet,
  kind: RollKind,
  ability?: AbilityKey,
  skillKey?: SkillKey
): RollConditionHint {
  const advReasons: string[] = [];
  const disadvReasons: string[] = [];
  let autoFail = false;
  let autoFailReason: string | undefined;

  for (const cid of sheet.condicoesAtivas) {
    const cond = CONDITION_MAP[cid];
    if (!cond) continue;

    if (kind === 'attack' || kind === 'spell_attack') {
      if (cond.imposesDisadvantageOnAttacks) disadvReasons.push(cond.name);
      if (cond.imposesAdvantageOnAttacks) advReasons.push(cond.name);
    }

    if (kind === 'ability' || kind === 'skill' || kind === 'tool' || kind === 'spell_ability') {
      if (cond.imposesDisadvantageOnAbilityChecks) disadvReasons.push(cond.name);
    }

    if (kind === 'initiative') {
      if (cond.imposesDisadvantageOnInitiative) disadvReasons.push(cond.name);
      if (cond.imposesAdvantageOnInitiative) advReasons.push(cond.name);
    }

    if (kind === 'save') {
      if (cond.imposesDisadvantageOnDexSaves && ability === 'des') {
        disadvReasons.push(cond.name);
      }
      if (cond.autoFailsStrDexSaves && (ability === 'for' || ability === 'des')) {
        autoFail = true;
        autoFailReason = `${cond.name} causa falha automática em salvaguardas de Força e Destreza.`;
      }
    }
  }

  // Armadura sem treinamento impõe Desvantagem em testes/SG/ataques de FOR ou DES
  const ac = calculateAC(sheet);
  if (ac.untrainedWarning && (ability === 'for' || ability === 'des')) {
    disadvReasons.push('Sem treinamento na Armadura/Escudo');
  }

  // Furtividade com armadura pesada/ruidosa
  if (kind === 'skill' && skillKey === 'furtividade' && ac.stealthDisadvantage) {
    disadvReasons.push(`Armadura (${getArmorById(sheet.armorId).name})`);
  }

  // Cancelamento 5e 2024: Vantagem + Desvantagem = Normal
  let suggestedMode: RollMode = 'normal';
  const reasons: string[] = [];
  if (advReasons.length > 0 && disadvReasons.length > 0) {
    suggestedMode = 'normal';
    reasons.push(`Vantagem (${advReasons.join(', ')}) e Desvantagem (${disadvReasons.join(', ')}) se anulam → Normal.`);
  } else if (advReasons.length > 0) {
    suggestedMode = 'vantagem';
    reasons.push(`Vantagem ativa por: ${advReasons.join(', ')}.`);
  } else if (disadvReasons.length > 0) {
    suggestedMode = 'desvantagem';
    reasons.push(`Desvantagem ativa por: ${disadvReasons.join(', ')}.`);
  }

  return {
    suggestedMode,
    reasons,
    autoFail,
    autoFailReason,
  };
}

export function rollDie(sides: number, rng: () => number = Math.random): number {
  return Math.floor(rng() * sides) + 1;
}

export function parseAndRollDiceFormula(
  formula: string,
  extraBonus = 0,
  doubleDice = false,
  rng: () => number = Math.random
): { rolls: number[]; total: number; expression: string } {
  const cleaned = formula.replace(/\s+/g, '').toLowerCase();
  const diceRegex = /([+-]?)(\d*)d(\d+)/g;
  const rolls: number[] = [];
  let sum = 0;
  let matchedAnything = false;

  let remaining = cleaned;
  let match: RegExpExecArray | null;
  while ((match = diceRegex.exec(cleaned)) !== null) {
    matchedAnything = true;
    const sign = match[1] === '-' ? -1 : 1;
    const rawCount = match[2] ? parseInt(match[2], 10) : 1;
    const count = doubleDice ? rawCount * 2 : rawCount;
    const sides = parseInt(match[3], 10);
    for (let i = 0; i < count; i++) {
      const r = rollDie(sides, rng);
      rolls.push(sign * r);
      sum += sign * r;
    }
    remaining = remaining.replace(match[0], '');
  }

  // Parse trailing flat modifiers like +3 or -1
  const flatMatches = remaining.match(/[+-]?\d+/g);
  let flatBonus = extraBonus;
  if (flatMatches) {
    for (const token of flatMatches) {
      flatBonus += parseInt(token, 10);
    }
  }

  if (!matchedAnything && rolls.length === 0) {
    const fallback = rollDie(6, rng);
    rolls.push(fallback);
    sum = fallback;
  }

  const total = Math.max(1, sum + flatBonus);
  const diceText = `[${rolls.join(' + ')}]`;
  const flatText = flatBonus !== 0 ? ` ${flatBonus > 0 ? '+' : '-'} ${Math.abs(flatBonus)}` : '';
  return {
    rolls,
    total,
    expression: `${diceText}${flatText}`,
  };
}

export function executeD20Roll(params: {
  title: string;
  kind: RollKind;
  mode: RollMode;
  modifierBreakdown: { label: string; value: number }[];
  exhaustionLevel: number;
  situationalLabel?: string;
  situationalDice?: string; // e.g. '+1d4', '-1d4'
  situationalFlat?: number;
  critThreshold?: number;
  rng?: () => number;
}): RollResult {
  const rng = params.rng ?? Math.random;
  const r1 = rollDie(20, rng);
  const r2 = params.mode === 'normal' ? null : rollDie(20, rng);
  const rolls = r2 === null ? [r1] : [r1, r2];
  const keptRoll =
    r2 === null ? r1 : params.mode === 'vantagem' ? Math.max(r1, r2) : Math.min(r1, r2);

  const baseMod = params.modifierBreakdown.reduce((acc, item) => acc + item.value, 0);
  const exPenalty = getExhaustionD20Penalty(params.exhaustionLevel);

  let sitBonus = params.situationalFlat ?? 0;
  let sitDetail = '';
  if (params.situationalDice) {
    const sign = params.situationalDice.startsWith('-') ? -1 : 1;
    const stripped = params.situationalDice.replace(/^[+-]/, '');
    const m = stripped.match(/^(\d*)d(\d+)$/i);
    if (m) {
      const count = m[1] ? parseInt(m[1], 10) : 1;
      const sides = parseInt(m[2], 10);
      let s = 0;
      for (let i = 0; i < count; i++) s += rollDie(sides, rng);
      sitBonus += sign * s;
      sitDetail = `${params.situationalLabel ?? 'Situacional'} (${formatSigned(sign * s)})`;
    }
  } else if (sitBonus !== 0) {
    sitDetail = `${params.situationalLabel ?? 'Bônus'} (${formatSigned(sitBonus)})`;
  }

  const total = keptRoll + baseMod - exPenalty + sitBonus;
  const critThreshold = params.critThreshold ?? 20;
  const isCrit = keptRoll >= critThreshold;
  const isFumble = keptRoll === 1;

  const parts: string[] = [];
  if (rolls.length === 2) {
    parts.push(`d20 [${rolls[0]}, ${rolls[1]} → ${keptRoll}]`);
  } else {
    parts.push(`d20 [${keptRoll}]`);
  }

  for (const item of params.modifierBreakdown) {
    if (item.value !== 0) {
      parts.push(`${formatSigned(item.value)} (${item.label})`);
    }
  }

  if (exPenalty > 0) {
    parts.push(`-${exPenalty} (Exaustão Nv ${params.exhaustionLevel})`);
  }

  if (sitDetail) {
    parts.push(sitDetail);
  }

  return {
    id: `roll_${Date.now()}_${Math.floor(rng() * 10000)}`,
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    title: params.title,
    kind: params.kind,
    mode: params.mode,
    rolls,
    keptRoll,
    total,
    isCrit,
    isFumble,
    breakdownText: parts.join(' '),
    situationalLabel: params.situationalLabel,
    situationalBonus: sitBonus,
  };
}

export function applyDamage(sheet: CharacterSheet, amount: number): CharacterSheet {
  const dmg = Math.max(0, Math.floor(amount));
  if (dmg === 0) return sheet;

  const absorbed = Math.min(sheet.pvTemp, dmg);
  const newTemp = sheet.pvTemp - absorbed;
  const remaining = dmg - absorbed;
  const newCurrent = Math.max(0, sheet.pvAtual - remaining);

  return {
    ...sheet,
    pvTemp: newTemp,
    pvAtual: newCurrent,
    updatedAt: new Date().toISOString(),
  };
}

export function applyHealing(sheet: CharacterSheet, amount: number): CharacterSheet {
  const heal = Math.max(0, Math.floor(amount));
  if (heal === 0) return sheet;

  const maxHp = calculateMaxHP(sheet);
  const newCurrent = Math.min(maxHp, sheet.pvAtual + heal);
  return {
    ...sheet,
    pvAtual: newCurrent,
    morteSucessos: newCurrent > 0 ? 0 : sheet.morteSucessos,
    morteFalhas: newCurrent > 0 ? 0 : sheet.morteFalhas,
    updatedAt: new Date().toISOString(),
  };
}

export function applyTempHp(sheet: CharacterSheet, amount: number): CharacterSheet {
  const incoming = Math.max(0, Math.floor(amount));
  // Regra 2024: PV Temporários não acumulam; escolhe-se o maior valor
  return {
    ...sheet,
    pvTemp: Math.max(sheet.pvTemp, incoming),
    updatedAt: new Date().toISOString(),
  };
}

function resolveThresholdValue<T>(table: Record<number, T> | undefined, level: number): T | undefined {
  if (!table) return undefined;
  const keys = Object.keys(table)
    .map(Number)
    .filter((k) => k <= level)
    .sort((a, b) => b - a);
  return keys.length > 0 ? table[keys[0]] : undefined;
}

export function buildClassResourcesForLevel(
  classeId: string,
  level: number,
  atributos: Record<AbilityKey, number>,
  existing?: ClassResourceState[],
  subclasseId?: string
): ClassResourceState[] {
  const cls = CLASS_MAP[classeId];
  if (!cls) return [];

  const sub = subclasseId ? cls.subclasses.find((s) => s.id === subclasseId) : undefined;
  const templates = [
    ...cls.resources,
    ...(sub?.resources ?? []),
  ];

  const bp = getProficiencyBonus(level);
  const result: ClassResourceState[] = [];
  for (const tmpl of templates) {
    if (tmpl.minLevel && level < tmpl.minLevel) continue;

    let max = 0;
    if (tmpl.formula === 'table' && tmpl.byLevel) {
      max = resolveThresholdValue(tmpl.byLevel, level) ?? 0;
    } else if (tmpl.formula === 'mod_car') {
      max = Math.max(1, getAbilityMod(atributos.car));
    } else if (tmpl.formula === 'mod_sab') {
      max = Math.max(1, getAbilityMod(atributos.sab));
    } else if (tmpl.formula === 'mod_int') {
      max = Math.max(1, getAbilityMod(atributos.int));
    } else if (tmpl.formula === 'bp') {
      max = bp;
    } else if (tmpl.formula === 'level') {
      max = level;
    } else if (tmpl.formula === 'level_plus_1') {
      max = level + 1;
    } else if (tmpl.formula === 'level_x5') {
      max = level * 5;
    } else if (tmpl.formula === 'fixed') {
      max = tmpl.fixedMax ?? 1;
    }

    const effectiveReset =
      resolveThresholdValue(tmpl.resetOnByLevel, level) ?? tmpl.resetOn;

    const prev = existing?.find((r) => r.id === tmpl.id);
    result.push({
      id: tmpl.id,
      name: tmpl.name,
      current: prev ? Math.min(prev.current, max) : max,
      max,
      die: resolveThresholdValue(tmpl.dieByLevel, level),
      resetOn: effectiveReset,
      description: tmpl.description,
    });
  }

  return result;
}

export function buildSpeciesResourcesForLevel(
  especieId: string,
  especieOpcaoId: string | undefined,
  level: number,
  existing?: ClassResourceState[]
): ClassResourceState[] {
  const sp = SPECIES_LIST.find((s) => s.id === especieId);
  if (!sp?.speciesResources) return [];
  const bp = getProficiencyBonus(level);
  const activeSubId = especieOpcaoId ?? sp.subOptions?.[0]?.id;

  const result: ClassResourceState[] = [];
  for (const tmpl of sp.speciesResources) {
    if (tmpl.minLevel && level < tmpl.minLevel) continue;
    if (tmpl.onlyForSubOptionId && tmpl.onlyForSubOptionId !== activeSubId) continue;
    const max = tmpl.formula === 'bp' ? bp : tmpl.fixedMax ?? 1;
    const prev = existing?.find((r) => r.id === tmpl.id);
    result.push({
      id: tmpl.id,
      name: tmpl.name,
      current: prev ? Math.min(prev.current, max) : max,
      max,
      resetOn: tmpl.resetOn,
      description: tmpl.description,
    });
  }
  return result;
}

export function buildSpellSlotsForClass(
  classeId: string,
  subclasseId: string,
  level: number,
  existingSlots?: Record<number, SpellSlotTracker>,
  existingPact?: { total: number; used: number; slotLevel: number }
): {
  espacosMagia: Record<number, SpellSlotTracker>;
  espacosPacto: { total: number; used: number; slotLevel: number };
} {
  const cls = CLASS_MAP[classeId];
  const sub = cls?.subclasses.find((s) => s.id === subclasseId);
  const clamped = Math.max(1, Math.min(20, level));

  const espacosMagia: Record<number, SpellSlotTracker> = {};
  for (let c = 1; c <= 9; c++) {
    espacosMagia[c] = { total: 0, used: 0 };
  }
  let espacosPacto = { total: 0, used: 0, slotLevel: 1 };

  const progression =
    cls && cls.spellcasting.progression !== 'none'
      ? cls.spellcasting.progression
      : sub?.grantsSpellcasting && clamped >= 3
        ? sub.grantsSpellcasting.progression
        : 'none';

  if (progression === 'pact') {
    const row = PACT_MAGIC_TABLE[clamped] ?? { slots: 1, slotLevel: 1 };
    espacosPacto = {
      total: row.slots,
      used: Math.min(existingPact?.used ?? 0, row.slots),
      slotLevel: row.slotLevel,
    };
  } else {
    const table =
      progression === 'full'
        ? FULL_CASTER_SLOTS
        : progression === 'half'
          ? HALF_CASTER_SLOTS
          : progression === 'third'
            ? THIRD_CASTER_SLOTS
            : null;
    if (table && table[clamped]) {
      const counts = table[clamped];
      for (let i = 0; i < counts.length; i++) {
        const circle = i + 1;
        const total = counts[i];
        espacosMagia[circle] = {
          total,
          used: Math.min(existingSlots?.[circle]?.used ?? 0, total),
        };
      }
    }
  }

  return { espacosMagia, espacosPacto };
}

export function applyShortRest(sheet: CharacterSheet, hitDiceHealing = 0, hitDiceSpentNow = 0): CharacterSheet {
  const maxHp = calculateMaxHP(sheet);
  const nextPv = Math.min(maxHp, sheet.pvAtual + Math.max(0, hitDiceHealing));
  const nextDvGasto = Math.min(sheet.nivel, sheet.dvGasto + Math.max(0, hitDiceSpentNow));

  const updatedResources = sheet.recursosClasse.map((res) => {
    if (res.resetOn === 'curto') {
      return { ...res, current: res.max };
    }
    if (res.resetOn === 'curto_1_longo_todos') {
      return { ...res, current: Math.min(res.max, res.current + 1) };
    }
    return res;
  });

  const updatedSpeciesResources = (sheet.recursosEspecie ?? []).map((res) =>
    res.resetOn === 'curto' ? { ...res, current: res.max } : res
  );

  // Bruxo recupera todos os Espaços de Pacto em Descanso Curto
  const nextPact = { ...sheet.espacosPacto, used: 0 };

  return {
    ...sheet,
    pvAtual: nextPv,
    dvGasto: nextDvGasto,
    recursosClasse: updatedResources,
    recursosEspecie: updatedSpeciesResources,
    espacosPacto: nextPact,
    updatedAt: new Date().toISOString(),
  };
}

export function applyLongRest(sheet: CharacterSheet): CharacterSheet {
  const maxHp = calculateMaxHP(sheet);
  const resetSlots: Record<number, SpellSlotTracker> = {};
  for (let c = 1; c <= 9; c++) {
    resetSlots[c] = {
      total: sheet.espacosMagia[c]?.total ?? 0,
      used: 0,
    };
  }

  const updatedResources = sheet.recursosClasse.map((res) => ({
    ...res,
    current: res.max,
  }));

  const updatedSpeciesResources = (sheet.recursosEspecie ?? []).map((res) => ({
    ...res,
    current: res.max,
  }));

  // Humano (Inventivo): ganha Inspiração Heroica sempre que completa um Descanso Longo
  const nextHeroicInspiration =
    sheet.especieId === 'humano' ? true : sheet.inspiracaoHeroica;

  return {
    ...sheet,
    pvAtual: maxHp,
    pvMax: maxHp,
    pvTemp: 0, // Regra 2024: PV Temporários expiram no Descanso Longo
    dvGasto: 0, // Regra 2024: recupera TODOS os Dados de Vida gastos
    morteSucessos: 0,
    morteFalhas: 0,
    inspiracaoHeroica: nextHeroicInspiration,
    nivelExaustao: Math.max(0, sheet.nivelExaustao - 1), // Reduz 1 nível de Exaustão
    concentrandoEm: '',
    espacosMagia: resetSlots,
    espacosPacto: { ...sheet.espacosPacto, used: 0 },
    magiasUsosHoje: {},
    recursosClasse: updatedResources,
    recursosEspecie: updatedSpeciesResources,
    updatedAt: new Date().toISOString(),
  };
}

export function calculateCarryCapacityKg(sheet: CharacterSheet): number {
  // 7,5 kg por ponto de Força (equivalente métrico de 15 lb × FOR; Pequeno/Médio = 1x, Grande = 2x)
  const sizeMultiplier =
    sheet.tamanho === 'Grande' ? 2 : sheet.tamanho === 'Enorme' ? 4 : sheet.tamanho === 'Miúdo' ? 0.5 : 1;
  const goliathBonus = sheet.especieId === 'golias' ? 2 : 1;
  return Number((sheet.atributos.for * 7.5 * Math.max(sizeMultiplier, goliathBonus)).toFixed(1));
}

export function calculateTotalWeightKg(sheet: CharacterSheet): number {
  const armor = getArmorById(sheet.armorId);
  let total = armor.weightKg + (sheet.escudoEquipado ? 3 : 0);

  for (const item of sheet.equipamentos) {
    total += (item.weightKg || 0) * Math.max(0, item.quantity ?? 0);
  }
  const totalCoins =
    (sheet.moedas.pc || 0) +
    (sheet.moedas.pp || 0) +
    (sheet.moedas.pe || 0) +
    (sheet.moedas.po || 0) +
    (sheet.moedas.pl || 0);
  // 100 moedas ≈ 1 kg
  total += totalCoins / 100;

  return Number(total.toFixed(1));
}

export function calculateTotalGoldValue(moedas: CharacterSheet['moedas']): number {
  const po =
    (moedas.pc || 0) / 100 +
    (moedas.pp || 0) / 10 +
    (moedas.pe || 0) / 2 +
    (moedas.po || 0) +
    (moedas.pl || 0) * 10;
  return Number(po.toFixed(2));
}

/**
 * Calcula o ouro inicial MÁXIMO (Opção B de Classe + Opção B de Antecedente)
 * conforme D&D 2024, para que o personagem já comece com o orçamento completo.
 */
export function calculateMaxStartingGold(classeId: string, antecedenteId: string): number {
  const cls = CLASS_MAP[classeId];
  const bg = BACKGROUNDS_LIST.find((b) => b.id === antecedenteId);
  const classMax = cls ? Math.max(cls.startingGoldA || 0, cls.startingGoldB || 0) : 0;
  const bgMax = bg ? Math.max(bg.startingGold || 0, bg.optionBGold || 50) : 0;
  return classMax + bgMax;
}

/**
 * Converte uma string de custo (ex: "15 PO", "5 PP", "2,5 PO", "10 PC", "1 PL")
 * em Peças de Cobre (PC), onde 1 PL = 1000 PC, 1 PO = 100 PC, 1 PE = 50 PC, 1 PP = 10 PC.
 */
export function parseCostToCopper(costStr?: string): number {
  if (!costStr || !costStr.trim()) return 0;
  const normalized = costStr.trim().replace(',', '.').toUpperCase();
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(PL|PO|PE|PP|PC)?/);
  if (!match) return 0;
  const amount = parseFloat(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const unit = match[2] ?? 'PO';
  const mult =
    unit === 'PL' ? 1000 : unit === 'PO' ? 100 : unit === 'PE' ? 50 : unit === 'PP' ? 10 : 1;
  return Math.round(amount * mult);
}

/**
 * Formata um valor em Peças de Cobre (PC) para exibição legível (ex: "12 PO 5 PP").
 */
export function formatCopperToCoinsLabel(totalCp: number): string {
  const cp = Math.max(0, Math.round(totalCp));
  if (cp === 0) return '0 PO';
  const po = Math.floor(cp / 100);
  const remAfterPo = cp % 100;
  const pp = Math.floor(remAfterPo / 10);
  const pc = remAfterPo % 10;
  const parts: string[] = [];
  if (po > 0) parts.push(`${po} PO`);
  if (pp > 0) parts.push(`${pp} PP`);
  if (pc > 0) parts.push(`${pc} PC`);
  return parts.join(' ');
}

/**
 * Deduz um custo em PC da bolsa de moedas do personagem, fazendo troco automático
 * entre PL, PO, PE, PP e PC quando necessário.
 */
export function deductCopperFromCoins(
  moedas: CharacterSheet['moedas'],
  costCp: number
): {
  moedas: CharacterSheet['moedas'];
  deductedCp: number;
  insufficient: boolean;
  missingCp: number;
} {
  const toDeduct = Math.max(0, Math.round(costCp));
  if (toDeduct === 0) {
    return { moedas: { ...moedas }, deductedCp: 0, insufficient: false, missingCp: 0 };
  }

  const totalAvailableCp =
    (moedas.pl || 0) * 1000 +
    (moedas.po || 0) * 100 +
    (moedas.pe || 0) * 50 +
    (moedas.pp || 0) * 10 +
    (moedas.pc || 0);

  if (totalAvailableCp < toDeduct) {
    return {
      moedas: { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 },
      deductedCp: totalAvailableCp,
      insufficient: true,
      missingCp: toDeduct - totalAvailableCp,
    };
  }

  const remainingCp = totalAvailableCp - toDeduct;
  // Mantém a platina se houver e converte o restante de forma limpa em PO/PP/PC
  const keptPl = Math.min(moedas.pl || 0, Math.floor(remainingCp / 1000));
  let rem = remainingCp - keptPl * 1000;
  const po = Math.floor(rem / 100);
  rem -= po * 100;
  const pp = Math.floor(rem / 10);
  const pc = rem - pp * 10;

  return {
    moedas: { pl: keptPl, po, pe: 0, pp, pc },
    deductedCp: toDeduct,
    insufficient: false,
    missingCp: 0,
  };
}

export function createAttackFromWeapon(weapon: WeaponDefinition, sheet: CharacterSheet): AttackEntry {
  const forMod = getAbilityMod(sheet.atributos.for);
  const desMod = getAbilityMod(sheet.atributos.des);

  let ability: AbilityKey = 'for';
  if (weapon.isRanged) {
    ability = 'des';
  } else if (weapon.isFinesse) {
    ability = desMod >= forMod ? 'des' : 'for';
  } else if (sheet.classeId === 'monge' && (weapon.category === 'Simples Corpo a Corpo' || weapon.isLight)) {
    ability = desMod >= forMod ? 'des' : 'for';
  }

  return {
    id: `atk_${weapon.id}_${Date.now()}`,
    weaponId: weapon.id,
    name: weapon.name,
    kind: 'weapon',
    ability,
    proficient: true,
    customAttackBonus: 0,
    damageDice: weapon.damageDice,
    damageType: weapon.damageType,
    range: weapon.range ?? '1,5m',
    properties: weapon.properties,
    mastery: weapon.mastery,
    masteryActive: Boolean(CLASS_MAP[sheet.classeId]?.weaponMasteriesByLevel),
    notes: weapon.versatileDice ? `Versátil (${weapon.versatileDice})` : '',
  };
}

export function validateCharacterImportJson(raw: unknown): { ok: true; sheet: CharacterSheet } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Arquivo JSON inválido: esperado um objeto de ficha.' };
  }
  const obj = raw as Partial<CharacterSheet>;
  if (typeof obj.nome !== 'string' || !obj.atributos || typeof obj.atributos !== 'object') {
    return { ok: false, error: 'Ficha incompleta: campos "nome" e "atributos" são obrigatórios.' };
  }
  const keys: AbilityKey[] = ['for', 'des', 'con', 'int', 'sab', 'car'];
  for (const k of keys) {
    if (typeof obj.atributos[k] !== 'number' || Number.isNaN(obj.atributos[k])) {
      return { ok: false, error: `Atributo "${k.toUpperCase()}" inválido na ficha importada.` };
    }
  }
  if (typeof obj.nivel !== 'number' || obj.nivel < 1 || obj.nivel > 20) {
    return { ok: false, error: 'O campo "nivel" deve estar entre 1 e 20.' };
  }
  return { ok: true, sheet: obj as CharacterSheet };
}

export function getCritThreshold(sheet: CharacterSheet): number {
  if (sheet.classeId === 'guerreiro' && sheet.subclasseId === 'campeao') {
    if (sheet.nivel >= 15) return 18;
    if (sheet.nivel >= 3) return 19;
  }
  return 20;
}

export function isConditionActive(sheet: CharacterSheet, id: ConditionId): boolean {
  return sheet.condicoesAtivas.includes(id);
}

// ============================================================================
// MOTOR REATIVO DE PROPAGAÇÃO DE ESCOLHAS (CLASSE, SUBCLASSE, TALENTOS, ORIGENS)
// ============================================================================

export function createEmptyAutoGrants(): SheetAutoGrants {
  return {
    subclassSkills: [],
    subclassTools: [],
    subclassLanguages: [],
    subclassArmor: {},
    subclassWeaponText: undefined,
    subclassSpells: [],
    subclassUnarmored: undefined,
    subclassSpellAbility: undefined,

    featSkills: [],
    featExpertise: [],
    featTools: [],
    featLanguages: [],
    featSaves: [],
    featSpells: [],
    featAttributeBonuses: {},
    featAttributeChoices: {},
    featSpellAbility: undefined,
    featResources: [],

    speciesSpells: [],
    speciesSkills: [],
    speciesLanguages: [],

    classSpells: [],
    classTools: [],

    backgroundSkills: [],
    backgroundFeatId: undefined,
    backgroundToolId: undefined,
  };
}

interface SubclassMechanicalRule {
  armor?: Partial<Record<'leve' | 'media' | 'pesada' | 'escudos', boolean>>;
  weaponText?: string;
  unarmoredFormula?: CharacterSheet['unarmoredFormula'];
  fixedSkills?: SkillKey[];
  pickSkillsCount?: number;
  pickSkillsPool?: SkillKey[];
  tools?: string[];
  languages?: string[];
}

const SUBCLASS_MECHANICAL_RULES: Record<string, SubclassMechanicalRule> = {
  'bardo:bravura': {
    armor: { media: true, escudos: true },
    weaponText: 'Armas Marciais',
  },
  'bardo:danca': {
    unarmoredFormula: 'danca',
  },
  'bardo:conhecimento': {
    pickSkillsCount: 3,
    pickSkillsPool: ['arcanismo', 'historia', 'investigacao', 'natureza', 'religiao', 'persuasao', 'atuacao', 'intuicao'],
  },
  'feiticeiro:draconica': {
    unarmoredFormula: 'draconico',
  },
  'guerreiro:mestre_batalha': {
    tools: ['Ferramentas de Ferreiro'],
  },
  'ladino:assassino': {
    tools: ['Kit de Disfarce', 'Kit de Venenos'],
  },
  'monge:misericordia': {
    fixedSkills: ['intuicao', 'medicina'],
    tools: ['Kit de Herbalismo'],
  },
  'guardiao:andarilho_feerico': {
    pickSkillsCount: 1,
    pickSkillsPool: ['persuasao', 'enganacao', 'atuacao'],
  },
};

interface FeatMechanicalRule {
  attributeOptions?: AbilityKey[];
  maxAttrCap?: number;
  tools?: string[];
  pickSkillsCount?: number;
  pickSkillsPool?: SkillKey[];
  upgradeOrGrantSkillPool?: SkillKey[];
  grantsExpertise?: boolean;
  grantsSaveFromAttr?: boolean;
  spells?: string[];
  grantsSpellAbility?: boolean;
  resource?: {
    id: string;
    name: string;
    resetOn: 'curto' | 'longo';
    formula: 'bp';
    description: string;
  };
}

const FEAT_MECHANICAL_RULES: Record<string, FeatMechanicalRule> = {
  artifista: {
    tools: ['Ferramentas de Ferreiro', 'Ferramentas de Carpinteiro', 'Ferramentas de Funileiro'],
  },
  musico: {
    tools: ['Alaúde', 'Flauta', 'Tambor'],
  },
  habilidoso: {
    pickSkillsCount: 3,
    pickSkillsPool: ['percepcao', 'investigacao', 'persuasao', 'atletismo', 'furtividade', 'intuicao', 'arcanismo', 'sobrevivencia'],
  },
  sortudo: {
    resource: {
      id: 'feat_pontos_de_sorte',
      name: 'Pontos de Sorte (Sortudo)',
      resetOn: 'longo',
      formula: 'bp',
      description: 'Gaste 1 ponto para ganhar Vantagem em um Teste de D20 ou impor Desvantagem em um ataque contra você (max = BP).',
    },
  },
  iniciado_em_magia: {
    grantsSpellAbility: true,
  },
  adepto_elemental: { attributeOptions: ['int', 'sab', 'car'] },
  agarrador: { attributeOptions: ['for', 'des'] },
  atacante_investida: { attributeOptions: ['for', 'des'] },
  atirador_agucado: { attributeOptions: ['des'] },
  atirador_magias: { attributeOptions: ['int', 'sab', 'car'] },
  atleta: { attributeOptions: ['for', 'des'] },
  conjurador_belico: { attributeOptions: ['int', 'sab', 'car'] },
  conjurador_rituais: { attributeOptions: ['int', 'sab', 'car'], grantsSpellAbility: true },
  cortador: { attributeOptions: ['for', 'des'] },
  destruidor: { attributeOptions: ['for', 'con'] },
  duelista_defensivo: { attributeOptions: ['des'] },
  duravel: { attributeOptions: ['con'] },
  especialista_haste: { attributeOptions: ['for', 'des'] },
  especialista_besta: { attributeOptions: ['des'] },
  especialista_pericia: {
    attributeOptions: ['for', 'des', 'con', 'int', 'sab', 'car'],
    pickSkillsCount: 1,
    pickSkillsPool: ['percepcao', 'investigacao', 'persuasao', 'furtividade', 'atletismo', 'intuicao', 'arcanismo'],
    grantsExpertise: true,
  },
  lider_inspirador: { attributeOptions: ['sab', 'car'] },
  matador_conjuradores: { attributeOptions: ['for', 'des'] },
  mestre_armadura_media: { attributeOptions: ['for', 'des'] },
  mestre_armadura_pesada: { attributeOptions: ['for', 'con'] },
  mestre_armas_grandes: { attributeOptions: ['for'] },
  mestre_escudos: { attributeOptions: ['for'] },
  observador: {
    attributeOptions: ['int', 'sab'],
    upgradeOrGrantSkillPool: ['percepcao', 'investigacao', 'intuicao'],
  },
  perfurador: { attributeOptions: ['for', 'des'] },
  resiliente: {
    attributeOptions: ['con', 'sab', 'des', 'for', 'int', 'car'],
    grantsSaveFromAttr: true,
  },
  sentinela: { attributeOptions: ['for', 'des'] },
  tocado_fadas: {
    attributeOptions: ['int', 'sab', 'car'],
    spells: ['passo_nebuloso'],
    grantsSpellAbility: true,
  },
  tocado_sombras: {
    attributeOptions: ['int', 'sab', 'car'],
    spells: ['invisibilidade'],
    grantsSpellAbility: true,
  },
  veloz: { attributeOptions: ['des', 'con'] },
  dadiva_destreza_combate: { attributeOptions: ['for', 'des', 'con', 'int', 'sab', 'car'], maxAttrCap: 30 },
  dadiva_fortitude: { attributeOptions: ['con', 'for', 'des', 'int', 'sab', 'car'], maxAttrCap: 30 },
  dadiva_velocidade: { attributeOptions: ['des', 'for', 'con', 'int', 'sab', 'car'], maxAttrCap: 30 },
  dadiva_destino: { attributeOptions: ['for', 'des', 'con', 'int', 'sab', 'car'], maxAttrCap: 30 },
  dadiva_recordacao_magica: { attributeOptions: ['int', 'sab', 'car'], maxAttrCap: 30 },
};

function makeToolEntry(id: string, name: string): ToolProficiency {
  const firstWord = name.toLowerCase().split(' ')[0];
  const match = TOOLS_CATALOG.find(
    (c) => c.name.toLowerCase() === name.toLowerCase() || c.name.toLowerCase().includes(firstWord)
  );
  return {
    id,
    name,
    defaultAbility: match?.ability ?? 'des',
    synergySkill: match?.synergySkill,
  };
}

function pickBestAbilityOption(
  options: AbilityKey[],
  atributos: Record<AbilityKey, number>,
  preferred?: AbilityKey | null,
  maxCap = 20,
  excludeProficientSaves?: Record<AbilityKey, boolean>
): AbilityKey {
  let pool = options;
  if (excludeProficientSaves) {
    const nonProf = options.filter((ab) => !excludeProficientSaves[ab]);
    if (nonProf.length > 0) pool = nonProf;
  }
  const underCap = pool.filter((ab) => atributos[ab] < maxCap);
  const candidates = underCap.length > 0 ? underCap : pool;
  if (preferred && candidates.includes(preferred)) return preferred;
  return [...candidates].sort((a, b) => atributos[b] - atributos[a])[0] ?? options[0];
}

function collectSpellsByLevel(table: Record<number, string[]> | undefined, level: number): string[] {
  if (!table) return [];
  const list: string[] = [];
  for (const [reqLvlStr, spellIds] of Object.entries(table)) {
    if (level >= Number(reqLvlStr)) {
      list.push(...spellIds);
    }
  }
  return list;
}

/**
 * Motor reativo determinístico: reconcilia qualquer alteração em Classe, Subclasse,
 * Nível, Espécie, Antecedente, Talentos, Atributos ou modo de PV, aplicando e
 * removendo efeitos automaticamente sem deixar bônus órfãos ou duplicados.
 */
export function reconcileCharacterSheet(
  prev: CharacterSheet,
  rawNext: CharacterSheet
): CharacterSheet {
  // Se a ficha continua completamente sem escolhas mecânicas, preserva estado em branco
  const hasAnyMechanicalSource = Boolean(
    rawNext.classeId ||
      rawNext.subclasseId ||
      rawNext.especieId ||
      rawNext.antecedenteId ||
      rawNext.talentosIds.length > 0 ||
      prev.autoGrants
  );
  if (!hasAnyMechanicalSource) {
    return rawNext;
  }

  const prevGrants: SheetAutoGrants = prev.autoGrants ?? createEmptyAutoGrants();
  const level = Math.max(1, Math.min(20, Math.floor(rawNext.nivel || 1)));
  const cls = CLASS_MAP[rawNext.classeId];
  const effectiveSubId = cls && level >= 3 ? rawNext.subclasseId : '';
  const sub = cls?.subclasses.find((s) => s.id === effectiveSubId);
  const species = SPECIES_LIST.find((s) => s.id === rawNext.especieId);
  const bg = BACKGROUNDS_LIST.find((b) => b.id === rawNext.antecedenteId);

  const classChanged = prev.classeId !== rawNext.classeId;
  const subChanged = prev.subclasseId !== effectiveSubId || classChanged;
  const levelChanged = prev.nivel !== level;
  const speciesChanged =
    prev.especieId !== rawNext.especieId || prev.especieOpcaoId !== rawNext.especieOpcaoId;
  const bgChanged = prev.antecedenteId !== rawNext.antecedenteId;
  const featsChanged =
    prev.talentosIds.length !== rawNext.talentosIds.length ||
    prev.talentosIds.some((id, i) => rawNext.talentosIds[i] !== id);
  const attrsChanged = (['for', 'des', 'con', 'int', 'sab', 'car'] as AbilityKey[]).some(
    (k) => prev.atributos[k] !== rawNext.atributos[k]
  );
  const hpConfigChanged =
    prev.hpMode !== rawNext.hpMode ||
    prev.hpRolledPerLevel !== rawNext.hpRolledPerLevel ||
    prev.pvMaxManualOverride !== rawNext.pvMaxManualOverride;
  const needsInitialBootstrap = !prev.autoGrants;

  // Se nada mecânico mudou (ex.: editou nome, história, moedas, usou 1 espaço de magia), retorna imediatamente
  if (
    !classChanged &&
    !subChanged &&
    !levelChanged &&
    !speciesChanged &&
    !bgChanged &&
    !featsChanged &&
    !attrsChanged &&
    !hpConfigChanged &&
    !needsInitialBootstrap
  ) {
    return rawNext;
  }

  const nextGrants: SheetAutoGrants = createEmptyAutoGrants();
  const atributos: Record<AbilityKey, number> = { ...rawNext.atributos };
  const salvaguardasProf: Record<AbilityKey, boolean> = { ...rawNext.salvaguardasProf };
  const periciasProf = { ...rawNext.periciasProf };
  const armadurasTreinamento = { ...rawNext.armadurasTreinamento };
  let armasProficiencia = rawNext.armasProficiencia;
  let ferramentasProficiencia = [...rawNext.ferramentasProficiencia];
  let idiomas = [...rawNext.idiomas];
  let unarmoredFormula = rawNext.unarmoredFormula;
  let conjuracaoAtributo = rawNext.conjuracaoAtributo;
  const activeFeatIds = Array.from(new Set(rawNext.talentosIds));

  // --------------------------------------------------------------------------
  // 1. ATRIBUTOS: revogar bônus de talentos removidos e aplicar talentos novos
  // --------------------------------------------------------------------------
  const prevFeatChoices = prevGrants.featAttributeChoices ?? {};
  const rawAlreadyReconciledChoices = rawNext.autoGrants?.featAttributeChoices;
  // Só subtrai bônus antigos se a lista de talentos mudou (idempotente se inline helper já reconciliou)
  if (featsChanged || needsInitialBootstrap) {
    for (const [fid, ab] of Object.entries(prevFeatChoices)) {
      if (!activeFeatIds.includes(fid)) {
        const stillPendingRemoval =
          !rawAlreadyReconciledChoices || fid in rawAlreadyReconciledChoices;
        if (stillPendingRemoval) {
          atributos[ab] = Math.max(1, atributos[ab] - 1);
        }
      } else {
        nextGrants.featAttributeChoices[fid] = ab;
        nextGrants.featAttributeBonuses[ab] = (nextGrants.featAttributeBonuses[ab] ?? 0) + 1;
      }
    }

    for (const fid of activeFeatIds) {
      const rule = FEAT_MECHANICAL_RULES[fid];
      if (!rule?.attributeOptions || rule.attributeOptions.length === 0) continue;
      if (nextGrants.featAttributeChoices[fid]) continue;

      const cap = rule.maxAttrCap ?? 20;
      const alreadyAppliedChoice = rawAlreadyReconciledChoices?.[fid];
      if (alreadyAppliedChoice && !prevFeatChoices[fid]) {
        nextGrants.featAttributeChoices[fid] = alreadyAppliedChoice;
        nextGrants.featAttributeBonuses[alreadyAppliedChoice] =
          (nextGrants.featAttributeBonuses[alreadyAppliedChoice] ?? 0) + 1;
        continue;
      }

      const preferred =
        cls?.spellcasting.ability ??
        sub?.grantsSpellcasting?.ability ??
        cls?.primaryAbilities[0] ??
        null;
      const chosen = pickBestAbilityOption(
        rule.attributeOptions,
        atributos,
        preferred,
        cap,
        rule.grantsSaveFromAttr ? salvaguardasProf : undefined
      );
      nextGrants.featAttributeChoices[fid] = chosen;
      nextGrants.featAttributeBonuses[chosen] = (nextGrants.featAttributeBonuses[chosen] ?? 0) + 1;
      // Só soma +1 quando o talento foi efetivamente adicionado (e ainda não foi aplicado)
      if (!prev.talentosIds.includes(fid) && atributos[chosen] < cap) {
        atributos[chosen] = Math.min(cap, atributos[chosen] + 1);
      }
    }
  } else {
    nextGrants.featAttributeChoices = { ...prevFeatChoices };
    nextGrants.featAttributeBonuses = { ...prevGrants.featAttributeBonuses };
  }

  // --------------------------------------------------------------------------
  // 2. SALVAGUARDAS: revogar Resiliente removido e aplicar Resiliente ativo
  // --------------------------------------------------------------------------
  for (const ab of prevGrants.featSaves) {
    const stillGrantedByClass = Boolean(cls?.savingThrows.includes(ab));
    if (!stillGrantedByClass) {
      salvaguardasProf[ab] = false;
    }
  }
  if (activeFeatIds.includes('resiliente')) {
    const resAb = nextGrants.featAttributeChoices.resiliente ?? 'con';
    nextGrants.featSaves.push(resAb);
    salvaguardasProf[resAb] = true;
  }

  // --------------------------------------------------------------------------
  // 3. SUBCLASSE: armaduras, armas, Defesa sem Armadura
  // --------------------------------------------------------------------------
  const subKey = cls && sub ? `${cls.id}:${sub.id}` : '';
  const subRule = subKey ? SUBCLASS_MECHANICAL_RULES[subKey] : undefined;

  // Revogar armadura concedida apenas pela subclasse anterior
  for (const key of ['leve', 'media', 'pesada', 'escudos'] as const) {
    if (prevGrants.subclassArmor[key] && !(cls?.armorTraining[key])) {
      armadurasTreinamento[key] = false;
    }
  }
  if (subRule?.armor) {
    for (const [key, val] of Object.entries(subRule.armor) as Array<
      ['leve' | 'media' | 'pesada' | 'escudos', boolean]
    >) {
      if (val && !armadurasTreinamento[key]) {
        armadurasTreinamento[key] = true;
        nextGrants.subclassArmor[key] = true;
      } else if (val && prevGrants.subclassArmor[key]) {
        armadurasTreinamento[key] = true;
        nextGrants.subclassArmor[key] = true;
      }
    }
  }

  // Revogar texto de proficiência em armas da subclasse anterior e aplicar nova
  if (prevGrants.subclassWeaponText) {
    const suffix = `, ${prevGrants.subclassWeaponText}`;
    if (armasProficiencia.endsWith(suffix)) {
      armasProficiencia = armasProficiencia.slice(0, -suffix.length);
    } else if (armasProficiencia === prevGrants.subclassWeaponText) {
      armasProficiencia = cls?.weaponProficiencies ?? '';
    }
  }
  if (subRule?.weaponText) {
    if (!armasProficiencia.toLowerCase().includes(subRule.weaponText.toLowerCase())) {
      armasProficiencia = armasProficiencia
        ? `${armasProficiencia}, ${subRule.weaponText}`
        : subRule.weaponText;
      nextGrants.subclassWeaponText = subRule.weaponText;
    }
  }

  // Unarmored formula (ex.: Feiticeiro Dracônica, Bardo Dança)
  const classDefaultUnarmored: CharacterSheet['unarmoredFormula'] =
    cls?.id === 'barbaro' ? 'barbaro' : cls?.id === 'monge' ? 'monge' : 'padrao';
  if (prevGrants.subclassUnarmored && unarmoredFormula === prevGrants.subclassUnarmored) {
    unarmoredFormula = classDefaultUnarmored;
  }
  if (subRule?.unarmoredFormula) {
    unarmoredFormula = subRule.unarmoredFormula;
    nextGrants.subclassUnarmored = subRule.unarmoredFormula;
  } else if (classChanged && (unarmoredFormula === 'barbaro' || unarmoredFormula === 'monge')) {
    unarmoredFormula = classDefaultUnarmored;
  }

  // --------------------------------------------------------------------------
  // 4. PERÍCIAS & ESPECIALIZAÇÕES (Antecedente, Espécie, Subclasse, Talentos)
  // --------------------------------------------------------------------------
  // 4a. Revogar perícias/especializações apenas das fontes que mudaram
  if (bgChanged) {
    for (const sk of prevGrants.backgroundSkills) {
      if (periciasProf[sk] === 1) periciasProf[sk] = 0;
    }
  }
  if (speciesChanged) {
    for (const sk of prevGrants.speciesSkills) {
      if (periciasProf[sk] === 1) periciasProf[sk] = 0;
    }
  }
  if (subChanged) {
    for (const sk of prevGrants.subclassSkills) {
      if (periciasProf[sk] === 1) periciasProf[sk] = 0;
    }
  }
  if (featsChanged) {
    for (const sk of prevGrants.featExpertise) {
      if (periciasProf[sk] === 2) periciasProf[sk] = 1;
    }
    for (const sk of prevGrants.featSkills) {
      if (periciasProf[sk] === 1) periciasProf[sk] = 0;
    }
  }

  // 4b. Aplicar Antecedente
  if (bg) {
    nextGrants.backgroundSkills = [...bg.skills];
    for (const sk of bg.skills) {
      if ((periciasProf[sk] ?? 0) === 0) {
        periciasProf[sk] = 1;
      }
    }
  }

  // 4c. Aplicar Espécie (ex.: Elfo -> Sentidos Aguçados: Percepção)
  if (species?.id === 'elfo') {
    const elfSkill: SkillKey = 'percepcao';
    if (speciesChanged || prevGrants.speciesSkills.includes(elfSkill) || needsInitialBootstrap) {
      if ((periciasProf[elfSkill] ?? 0) === 0 || prevGrants.speciesSkills.includes(elfSkill)) {
        periciasProf[elfSkill] = Math.max(1, periciasProf[elfSkill] ?? 0) as 0 | 1 | 2;
        nextGrants.speciesSkills.push(elfSkill);
      }
    } else if (prevGrants.speciesSkills.length > 0) {
      nextGrants.speciesSkills = [...prevGrants.speciesSkills];
    }
  }

  // 4d. Aplicar Subclasse (skills fixas ou pool)
  if (subRule) {
    if (!subChanged && !needsInitialBootstrap) {
      nextGrants.subclassSkills = [...prevGrants.subclassSkills];
    } else {
      for (const sk of subRule.fixedSkills ?? []) {
        if ((periciasProf[sk] ?? 0) === 0) {
          periciasProf[sk] = 1;
          nextGrants.subclassSkills.push(sk);
        }
      }
      if (subRule.pickSkillsCount && subRule.pickSkillsPool) {
        let picked = 0;
        for (const sk of subRule.pickSkillsPool) {
          if (picked >= subRule.pickSkillsCount) break;
          if ((periciasProf[sk] ?? 0) === 0) {
            periciasProf[sk] = 1;
            nextGrants.subclassSkills.push(sk);
            picked++;
          }
        }
      }
    }
  }

  // 4e. Aplicar Talentos (skills & especializações)
  if (!featsChanged && !needsInitialBootstrap) {
    nextGrants.featSkills = [...prevGrants.featSkills];
    nextGrants.featExpertise = [...prevGrants.featExpertise];
  } else {
    for (const fid of activeFeatIds) {
      const rule = FEAT_MECHANICAL_RULES[fid];
      if (!rule) continue;

      if (rule.pickSkillsCount && rule.pickSkillsPool) {
        let picked = 0;
        for (const sk of rule.pickSkillsPool) {
          if (picked >= rule.pickSkillsCount) break;
          if ((periciasProf[sk] ?? 0) === 0) {
            periciasProf[sk] = 1;
            nextGrants.featSkills.push(sk);
            picked++;
          }
        }
      }

      if (rule.upgradeOrGrantSkillPool) {
        // Ex.: Observador -> se já proficiente em Percepção/Investigação/Intuição, promove a Especialização; senão dá proficiência
        const alreadyProf = rule.upgradeOrGrantSkillPool.find((sk) => periciasProf[sk] === 1);
        const notProf = rule.upgradeOrGrantSkillPool.find((sk) => (periciasProf[sk] ?? 0) === 0);
        if (alreadyProf) {
          periciasProf[alreadyProf] = 2;
          nextGrants.featExpertise.push(alreadyProf);
        } else if (notProf) {
          periciasProf[notProf] = 1;
          nextGrants.featSkills.push(notProf);
        }
      }

      if (rule.grantsExpertise) {
        const candidate = (Object.keys(periciasProf) as SkillKey[]).find(
          (sk) => periciasProf[sk] === 1 && !nextGrants.featExpertise.includes(sk)
        );
        if (candidate) {
          periciasProf[candidate] = 2;
          nextGrants.featExpertise.push(candidate);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. FERRAMENTAS (Subclasse e Talentos — revoga antigas e aplica novas)
  // --------------------------------------------------------------------------
  const staleToolIds = new Set<string>([
    ...(subChanged ? prevGrants.subclassTools : []),
    ...(featsChanged ? prevGrants.featTools : []),
  ]);
  if (staleToolIds.size > 0) {
    ferramentasProficiencia = ferramentasProficiencia.filter((t) => !staleToolIds.has(t.id));
  }

  if (subRule?.tools) {
    for (let i = 0; i < subRule.tools.length; i++) {
      const tName = subRule.tools[i];
      const tid = `tool_sub_${sub?.id}_${i}`;
      const exists = ferramentasProficiencia.some(
        (t) => t.id === tid || t.name.toLowerCase() === tName.toLowerCase()
      );
      if (!exists) {
        ferramentasProficiencia.push(makeToolEntry(tid, tName));
        nextGrants.subclassTools.push(tid);
      } else if (ferramentasProficiencia.some((t) => t.id === tid)) {
        nextGrants.subclassTools.push(tid);
      }
    }
  }

  for (const fid of activeFeatIds) {
    const rule = FEAT_MECHANICAL_RULES[fid];
    if (!rule?.tools) continue;
    for (let i = 0; i < rule.tools.length; i++) {
      const tName = rule.tools[i];
      const tid = `tool_feat_${fid}_${i}`;
      const exists = ferramentasProficiencia.some(
        (t) => t.id === tid || t.name.toLowerCase() === tName.toLowerCase()
      );
      if (!exists) {
        ferramentasProficiencia.push(makeToolEntry(tid, tName));
        nextGrants.featTools.push(tid);
      } else if (ferramentasProficiencia.some((t) => t.id === tid)) {
        nextGrants.featTools.push(tid);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 6. IDIOMAS (ex.: Druídico para Druida, Gíria de Ladrão para Ladino, Comum para Espécie)
  // --------------------------------------------------------------------------
  const prevAutoLangs = new Set<string>([
    ...prevGrants.subclassLanguages,
    ...prevGrants.speciesLanguages,
    ...prevGrants.featLanguages,
  ]);
  if (classChanged || speciesChanged) {
    if (prev.classeId === 'druida' && rawNext.classeId !== 'druida') {
      idiomas = idiomas.filter((l) => l !== 'Druídico');
    }
    if (prev.classeId === 'ladino' && rawNext.classeId !== 'ladino') {
      idiomas = idiomas.filter((l) => l !== 'Gíria de Ladrão');
    }
  }
  if (cls?.id === 'druida' && !idiomas.includes('Druídico')) {
    idiomas.push('Druídico');
  }
  if (cls?.id === 'ladino' && !idiomas.includes('Gíria de Ladrão')) {
    idiomas.push('Gíria de Ladrão');
  }
  if (species && idiomas.length === 0) {
    idiomas.push('Comum');
    nextGrants.speciesLanguages.push('Comum');
  } else if (prevAutoLangs.has('Comum') && idiomas.includes('Comum')) {
    nextGrants.speciesLanguages.push('Comum');
  }

  // --------------------------------------------------------------------------
  // 7. MAGIAS PREPARADAS AUTOMATICAMENTE, ESPAÇOS E ATRIBUTO DE CONJURAÇÃO
  // --------------------------------------------------------------------------
  nextGrants.classSpells = collectSpellsByLevel(cls?.alwaysPreparedSpells, level);
  nextGrants.subclassSpells = collectSpellsByLevel(sub?.alwaysPreparedSpells, level);
  nextGrants.speciesSpells = getSpeciesInnateSpells(rawNext.especieId, rawNext.especieOpcaoId, level);
  nextGrants.featSpells = activeFeatIds.flatMap((fid) => FEAT_MECHANICAL_RULES[fid]?.spells ?? []);

  const prevAutoSpells = new Set<string>([
    ...prevGrants.classSpells,
    ...prevGrants.subclassSpells,
    ...prevGrants.speciesSpells,
    ...prevGrants.featSpells,
  ]);
  const nextAutoSpells = new Set<string>([
    ...nextGrants.classSpells,
    ...nextGrants.subclassSpells,
    ...nextGrants.speciesSpells,
    ...nextGrants.featSpells,
  ]);

  // Remove ONLY spells that were auto-granted previously and are no longer granted
  const reconciledPrepared = rawNext.magiasPreparadasIds.filter(
    (id) => !prevAutoSpells.has(id) || nextAutoSpells.has(id)
  );
  for (const spId of nextAutoSpells) {
    if (!reconciledPrepared.includes(spId)) {
      reconciledPrepared.push(spId);
    }
  }
  const reconciledKnown = Array.from(
    new Set([
      ...rawNext.magiasConhecidasIds.filter((id) => !prevAutoSpells.has(id) || nextAutoSpells.has(id)),
      ...reconciledPrepared,
    ])
  );

  // Spell slots recomputed whenever class, subclass, or level changed
  let espacosMagia = rawNext.espacosMagia;
  let espacosPacto = rawNext.espacosPacto;
  if (classChanged || subChanged || levelChanged) {
    const builtSlots = buildSpellSlotsForClass(
      rawNext.classeId,
      effectiveSubId,
      level,
      classChanged ? undefined : rawNext.espacosMagia,
      classChanged ? undefined : rawNext.espacosPacto
    );
    espacosMagia = builtSlots.espacosMagia;
    espacosPacto = builtSlots.espacosPacto;
  }

  // Spellcasting ability reconciliation (revokes subclass/feat spell ability when removed)
  const featGrantsSpell = activeFeatIds.some(
    (fid) => FEAT_MECHANICAL_RULES[fid]?.grantsSpellAbility
  );
  if (cls?.spellcasting.ability) {
    conjuracaoAtributo = cls.spellcasting.ability;
  } else if (sub?.grantsSpellcasting && level >= 3) {
    conjuracaoAtributo = sub.grantsSpellcasting.ability;
    nextGrants.subclassSpellAbility = sub.grantsSpellcasting.ability;
  } else {
    // If previous spellcasting ability came purely from a removed subclass or removed feat, clear it
    if (
      (prevGrants.subclassSpellAbility && conjuracaoAtributo === prevGrants.subclassSpellAbility && subChanged) ||
      (prevGrants.featSpellAbility && conjuracaoAtributo === prevGrants.featSpellAbility && !featGrantsSpell)
    ) {
      conjuracaoAtributo = null;
    }
    if (!conjuracaoAtributo && featGrantsSpell) {
      const bestMental = pickBestAbilityOption(['int', 'sab', 'car'], atributos);
      conjuracaoAtributo = bestMental;
      nextGrants.featSpellAbility = bestMental;
    } else if (!conjuracaoAtributo && nextGrants.speciesSpells.length > 0) {
      conjuracaoAtributo =
        species?.id === 'aasimar' || species?.id === 'tiefling' ? 'car' : 'int';
    }
  }

  // --------------------------------------------------------------------------
  // 8. RECURSOS & CONTADORES (CLASSE + SUBCLASSE + TALENTOS + ESPÉCIE)
  // --------------------------------------------------------------------------
  const baseClassResources = buildClassResourcesForLevel(
    rawNext.classeId,
    level,
    atributos,
    rawNext.recursosClasse,
    effectiveSubId
  ).map((res) => {
    const oldRes = prev.recursosClasse.find((r) => r.id === res.id);
    if (oldRes && res.max > oldRes.max && oldRes.current === oldRes.max) {
      return { ...res, current: res.max };
    }
    return res;
  });

  // Feat resources (ex.: Sortudo -> Pontos de Sorte = BP)
  const bp = getProficiencyBonus(level);
  const featResources: ClassResourceState[] = [];
  for (const fid of activeFeatIds) {
    const resSpec = FEAT_MECHANICAL_RULES[fid]?.resource;
    if (!resSpec) continue;
    const max = resSpec.formula === 'bp' ? bp : 1;
    const oldRes = prev.recursosClasse.find((r) => r.id === resSpec.id);
    const current = oldRes
      ? oldRes.current === oldRes.max
        ? max
        : Math.min(oldRes.current, max)
      : max;
    featResources.push({
      id: resSpec.id,
      name: resSpec.name,
      current,
      max,
      resetOn: resSpec.resetOn,
      description: resSpec.description,
    });
    nextGrants.featResources.push(resSpec.id);
  }

  const recursosClasse = [...baseClassResources, ...featResources];
  const recursosEspecie = buildSpeciesResourcesForLevel(
    rawNext.especieId,
    rawNext.especieOpcaoId,
    level,
    rawNext.recursosEspecie
  ).map((res) => {
    const oldRes = (prev.recursosEspecie ?? []).find((r) => r.id === res.id);
    if (oldRes && res.max > oldRes.max && oldRes.current === oldRes.max) {
      return { ...res, current: res.max };
    }
    return res;
  });

  // --------------------------------------------------------------------------
  // 9. MONTAGEM FINAL + RECÁLCULO REATIVO DE PV MÁX / ATUAL / DV
  // --------------------------------------------------------------------------
  const assembled: CharacterSheet = {
    ...rawNext,
    nivel: level,
    subclasseId: effectiveSubId,
    atributos,
    salvaguardasProf,
    periciasProf,
    armadurasTreinamento,
    armasProficiencia,
    ferramentasProficiencia,
    idiomas,
    unarmoredFormula,
    conjuracaoAtributo,
    espacosMagia,
    espacosPacto,
    magiasPreparadasIds: reconciledPrepared,
    magiasConhecidasIds: reconciledKnown,
    recursosClasse,
    recursosEspecie,
    dvGasto: Math.min(level, rawNext.dvGasto),
    autoGrants: nextGrants,
  };

  assembled.visibilidade = {
    ...assembled.visibilidade,
    conjuracao: hasSpellcastingAccess(assembled),
    recursos_classe: recursosClasse.length > 0 || recursosEspecie.length > 0,
  };

  const prevMaxHp = calculateMaxHP(prev);
  const nextMaxHp = calculateMaxHP(assembled);
  assembled.pvMax = nextMaxHp;

  if (nextMaxHp !== prevMaxHp && nextMaxHp > 0) {
    if (prevMaxHp === 0 || prev.pvAtual === prevMaxHp) {
      assembled.pvAtual = nextMaxHp;
    } else if (nextMaxHp > prevMaxHp) {
      assembled.pvAtual = Math.min(nextMaxHp, rawNext.pvAtual + (nextMaxHp - prevMaxHp));
    } else {
      assembled.pvAtual = Math.min(rawNext.pvAtual, nextMaxHp);
    }
  } else if (nextMaxHp > 0 && rawNext.pvAtual === 0 && prevMaxHp === 0) {
    assembled.pvAtual = nextMaxHp;
  }

  return assembled;
}

/**
 * Identifica a(s) origem(ns) exata(s) de cada perícia (Antecedente, Classe,
 * Espécie, Subclasse, Talento) para exibição com destaque equivalente na ficha.
 */
export function getSkillSources(sheet: CharacterSheet): Record<SkillKey, SkillSourceKind[]> {
  const result = {} as Record<SkillKey, SkillSourceKind[]>;
  const bg = BACKGROUNDS_LIST.find((b) => b.id === sheet.antecedenteId);
  const cls = CLASS_MAP[sheet.classeId];
  const grants = sheet.autoGrants;

  for (const skDef of SKILLS) {
    const sk = skDef.key;
    const sources: SkillSourceKind[] = [];
    const prof = sheet.periciasProf[sk] ?? 0;

    if (bg?.skills.includes(sk)) {
      sources.push('Antecedente');
    }
    if (
      grants?.speciesSkills.includes(sk) ||
      (sheet.especieId === 'elfo' && sk === 'percepcao' && prof > 0 && !bg?.skills.includes(sk))
    ) {
      sources.push('Espécie');
    }
    if (grants?.subclassSkills.includes(sk)) {
      sources.push('Subclasse');
    }
    if (grants?.featSkills.includes(sk) || grants?.featExpertise.includes(sk)) {
      sources.push('Talento');
    }

    if (
      prof > 0 &&
      cls &&
      sources.length === 0 &&
      (cls.skillChoices === 'any' || cls.skillChoices.includes(sk))
    ) {
      sources.push('Classe');
    }

    result[sk] = sources;
  }

  return result;
}

// ============================================================================
// SINCRONIA MAGIAS <-> TESTES <-> CONTAGEM & ITENS CONTÁVEIS DE EQUIPAMENTO
// ============================================================================

function normalizeMatchText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Retorna true se a magia exige qualquer tipo de teste/rolagem operacional
 * (ataque mágico, salvaguarda contra CD, rolagem de dano/cura ou teste de atributo/conjuração).
 */
export function spellRequiresTest(sp: SpellDefinition): boolean {
  if (sp.attackType === 'melee' || sp.attackType === 'ranged' || sp.attackType === 'save') {
    return true;
  }
  if (sp.saveAbility || sp.damageFormula || sp.healingFormula) {
    return true;
  }
  const desc = normalizeMatchText(sp.description || '');
  return /\b(jogada de ataque|ataque magico|salvaguarda|teste de conjuracao|teste de atributo|teste de resistencia|dissipar magia|contramagica)\b/.test(
    desc
  );
}

/**
 * Registra o uso/conjuração de uma magia (via lista Testes ou Lista de Magias):
 * consome 1 espaço de magia (ou de Pacto) se for de 1º+ círculo, incrementa o
 * contador diário da magia e ativa Concentração quando aplicável.
 */
export function consumeSpellCast(sheet: CharacterSheet, sp: SpellDefinition): CharacterSheet {
  let nextSlots = sheet.espacosMagia;
  let nextPact = sheet.espacosPacto;

  if (sp.level > 0) {
    const regular = sheet.espacosMagia[sp.level];
    if (regular && regular.used < regular.total) {
      nextSlots = {
        ...sheet.espacosMagia,
        [sp.level]: { ...regular, used: regular.used + 1 },
      };
    } else if (
      sheet.espacosPacto.total > 0 &&
      sheet.espacosPacto.slotLevel >= sp.level &&
      sheet.espacosPacto.used < sheet.espacosPacto.total
    ) {
      nextPact = { ...sheet.espacosPacto, used: sheet.espacosPacto.used + 1 };
    }
  }

  const prevUses = sheet.magiasUsosHoje ?? {};
  const nextCount = (prevUses[sp.id] ?? 0) + 1;

  return {
    ...sheet,
    espacosMagia: nextSlots,
    espacosPacto: nextPact,
    magiasUsosHoje: { ...prevUses, [sp.id]: nextCount },
    concentrandoEm: sp.concentration ? sp.name : sheet.concentrandoEm,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Ajusta manualmente (+1 ou -1) o uso diário de uma magia, sincronizando
 * consumo/recuperação de 1 espaço de magia quando for de 1º+ círculo.
 */
export function adjustSpellDailyUse(
  sheet: CharacterSheet,
  sp: SpellDefinition,
  delta: number
): CharacterSheet {
  if (delta > 0) {
    return consumeSpellCast(sheet, sp);
  }
  if (delta < 0) {
    const prevUses = sheet.magiasUsosHoje ?? {};
    const curr = prevUses[sp.id] ?? 0;
    const nextUses = { ...prevUses };
    if (curr <= 1) {
      delete nextUses[sp.id];
    } else {
      nextUses[sp.id] = curr - 1;
    }

    let nextSlots = sheet.espacosMagia;
    let nextPact = sheet.espacosPacto;
    if (sp.level > 0 && curr > 0) {
      const regular = sheet.espacosMagia[sp.level];
      if (regular && regular.used > 0) {
        nextSlots = {
          ...sheet.espacosMagia,
          [sp.level]: { ...regular, used: regular.used - 1 },
        };
      } else if (
        sheet.espacosPacto.total > 0 &&
        sheet.espacosPacto.slotLevel >= sp.level &&
        sheet.espacosPacto.used > 0
      ) {
        nextPact = { ...sheet.espacosPacto, used: sheet.espacosPacto.used - 1 };
      }
    }

    return {
      ...sheet,
      espacosMagia: nextSlots,
      espacosPacto: nextPact,
      magiasUsosHoje: nextUses,
      updatedAt: new Date().toISOString(),
    };
  }
  return sheet;
}

/**
 * Mantém a lista de Seleção de Testes sincronizada com magias que exigem teste:
 * ao preparar uma magia com teste, vincula automaticamente `test_spell_${id}`;
 * ao despreparar, remove o vínculo correspondente.
 */
export function syncAutoLinkedSpellTests(
  currentSelectedIds: string[] | undefined,
  sp: SpellDefinition,
  isNowPrepared: boolean
): string[] {
  const testId = `test_spell_${sp.id}`;
  const base = currentSelectedIds ?? [];
  if (isNowPrepared) {
    if (spellRequiresTest(sp) && !base.includes(testId)) {
      return [...base, testId];
    }
    return base;
  }
  return base.filter((id) => id !== testId);
}

/**
 * Lê da tabela oficial de progressão da classe o limite de Truques e Magias Preparadas
 * para o nível atual do personagem (quando aplicável).
 */
export function getClassSpellPrepLimits(
  sheet: CharacterSheet,
  allClasses?: ClassDefinition[]
): { cantripsMax: number | null; preparedMax: number | null } {
  const cls =
    allClasses?.find((c) => c.id === sheet.classeId) ?? CLASS_MAP[sheet.classeId] ?? undefined;
  const table = cls?.progressionTable;
  if (!table || !table.rows || table.rows.length === 0) {
    return { cantripsMax: null, preparedMax: null };
  }
  const row = table.rows[Math.max(0, Math.min(table.rows.length - 1, sheet.nivel - 1))];
  if (!row) return { cantripsMax: null, preparedMax: null };

  let cantripsMax: number | null = null;
  let preparedMax: number | null = null;

  table.headers.forEach((header, idx) => {
    const norm = normalizeMatchText(header);
    const val = parseInt(String(row[idx] ?? '').replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(val)) return;
    if (norm.includes('truque')) {
      cantripsMax = val;
    } else if (norm.includes('prep')) {
      preparedMax = val;
    }
  });

  return { cantripsMax, preparedMax };
}

export type CountableItemCategory = 'Munição' | 'Suprimento' | 'Consumível' | 'Arremesso';

const AMMO_PATTERN =
  /\b(flecha|flechas|virote|virotes|bala|balas|municao|agulha|agulhas|aljava|polvora|cartucho|cartuchos|pedra de funda|chumbo)\b/;
const SUPPLY_PATTERN =
  /\b(racao|racoes|tocha|tochas|oleo|vela|velas|cantil|agua potavel|suprimento|giz|piton|pitons)\b/;
const CONSUMABLE_PATTERN =
  /\b(pocao|pocoes|elixir|antidoto|veneno|agua benta|acido|fogo alquimico|pergaminho|pergaminhos|curandeiro|estrepe|estrepes|esferas de metal|bomba|granada|frasco|frascos|carga|cargas|usos|consumivel)\b/;
const THROWN_COUNTABLE_PATTERN = /\b(dardo|dardos|azagaia|azagaias)\b/;

/**
 * Classifica automaticamente se um item de equipamento é naturalmente contado em
 * quantidade/uso (munição, rações diárias, tochas, poções, consumíveis ou arremessáveis).
 */
export function classifyCountableInventoryItem(item: InventoryItem): {
  isCountable: boolean;
  categoryLabel: CountableItemCategory;
} {
  const hay = normalizeMatchText(
    [item.name, item.properties ?? '', item.description ?? '', item.notes ?? ''].join(' ')
  );

  // Evita classificar kits completos multi-item como munição única, exceto Kit de Curandeiro
  if (/\bkit de (aventureiro|explorador|sacerdote|erudito|artista|assaltante|diplomata)\b/.test(hay)) {
    return { isCountable: Boolean(item.countable), categoryLabel: 'Suprimento' };
  }

  if (AMMO_PATTERN.test(hay)) {
    return { isCountable: true, categoryLabel: 'Munição' };
  }
  if (SUPPLY_PATTERN.test(hay)) {
    return { isCountable: true, categoryLabel: 'Suprimento' };
  }
  if (CONSUMABLE_PATTERN.test(hay)) {
    return { isCountable: true, categoryLabel: 'Consumível' };
  }
  if (THROWN_COUNTABLE_PATTERN.test(hay)) {
    return { isCountable: true, categoryLabel: 'Arremesso' };
  }
  if (item.countable) {
    return { isCountable: true, categoryLabel: 'Consumível' };
  }
  return { isCountable: false, categoryLabel: 'Consumível' };
}

export function getCountableEquipmentItems(
  sheet: CharacterSheet
): { item: InventoryItem; categoryLabel: CountableItemCategory }[] {
  const out: { item: InventoryItem; categoryLabel: CountableItemCategory }[] = [];
  for (const item of sheet.equipamentos) {
    const res = classifyCountableInventoryItem(item);
    if (res.isCountable) {
      out.push({ item, categoryLabel: res.categoryLabel });
    }
  }
  return out;
}

