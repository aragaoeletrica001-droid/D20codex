import type {
  AbilityKey,
  AttackEntry,
  CharacterSheet,
  CreatureSize,
  ProficiencyMultiplier,
  SkillKey,
  SpellSlotTracker,
  ToolProficiency,
} from '../types/dnd';
import { CLASS_MAP } from '../data/classes';
import { LEVEL_XP_TABLE, SKILLS } from '../data/core';
import { BACKGROUNDS_LIST, SPECIES_LIST } from '../data/origins';
import { TOOLS_CATALOG, WEAPONS_LIST } from '../data/equipment';
import {
  buildClassResourcesForLevel,
  buildSpeciesResourcesForLevel,
  buildSpellSlotsForClass,
  calculateMaxHP,
  calculateMaxStartingGold,
  createAttackFromWeapon,
  getSpeciesInnateSpells,
  hasSpellcastingAccess,
  reconcileCharacterSheet,
} from './engine';

export interface WizardBuildConfig {
  nome: string;
  classeId: string;
  subclasseId: string;
  nivel: number;
  especieId: string;
  especieOpcaoId?: string;
  tamanho?: CreatureSize;
  antecedenteId: string;
  antecedenteEquipOpcao?: 'A' | 'B';
  alinhamento?: string;
  atributos: Record<AbilityKey, number>;
  selectedSkills: SkillKey[];
  expertiseSkills?: SkillKey[];
  talentosIds: string[];
  armorId: string;
  escudoEquipado: boolean;
  weaponIds: string[];
  preparedSpellIds: string[];
  idiomas?: string[];
  aparencia?: string;
  historia?: string;
  customMoedas?: CharacterSheet['moedas'];
  extraEquipment?: CharacterSheet['equipamentos'];
}

export function createEmptySkillsRecord(): Record<SkillKey, ProficiencyMultiplier> {
  const rec = {} as Record<SkillKey, ProficiencyMultiplier>;
  for (const s of SKILLS) {
    rec[s.key] = 0;
  }
  return rec;
}

export function createEmptySpellSlots(): Record<number, SpellSlotTracker> {
  const slots: Record<number, SpellSlotTracker> = {};
  for (let c = 1; c <= 9; c++) {
    slots[c] = { total: 0, used: 0 };
  }
  return slots;
}

/**
 * Cria uma Ficha Oficial D&D 2024 100% EM BRANCO (limpa), sem nenhum personagem
 * pré-preenchido ou exemplo fictício, pronta para preenchimento direto ou via Assistente.
 */
export function createBlankCharacter(): CharacterSheet {
  const now = new Date().toISOString();
  const suffix = Math.random().toString(36).slice(2, 7);
  return {
    id: `char_${Date.now()}_${suffix}`,
    version: 2,
    updatedAt: now,

    nome: '',
    classeId: '',
    subclasseId: '',
    nivel: 1,
    xp: 0,
    especieId: '',
    especieOpcaoId: undefined,
    tamanho: 'Médio',
    antecedenteId: '',
    antecedenteEquipOpcao: 'A',
    alinhamento: '',
    idiomas: [],
    aparencia: '',
    historia: '',
    retratoDataUrl: '',
    testesSelecionadosIds: [],

    armorId: 'nenhuma',
    escudoEquipado: false,
    caBonusManual: 0,
    unarmoredFormula: 'padrao',
    iniciativaBonusManual: 0,
    deslocamentoBonusManual: 0,
    inspiracaoHeroica: false,
    hpMode: 'media',
    hpRolledPerLevel: {},
    pvAtual: 0,
    pvMax: 0,
    pvMaxManualOverride: null,
    pvTemp: 0,
    dvGasto: 0,
    morteSucessos: 0,
    morteFalhas: 0,

    condicoesAtivas: [],
    nivelExaustao: 0,
    concentrandoEm: '',

    atributos: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
    salvaguardasProf: {
      for: false,
      des: false,
      con: false,
      int: false,
      sab: false,
      car: false,
    },
    periciasProf: createEmptySkillsRecord(),

    armadurasTreinamento: {
      leve: false,
      media: false,
      pesada: false,
      escudos: false,
    },
    armasProficiencia: '',
    ferramentasProficiencia: [],

    ataques: [],
    recursosClasse: [],
    recursosEspecie: [],
    talentosIds: [],
    customFeats: [],
    customVariables: [],
    notasCaracteristicas: '',

    conjuracaoAtributo: null,
    espacosMagia: createEmptySpellSlots(),
    espacosPacto: { total: 0, used: 0, slotLevel: 1 },
    magiasPreparadasIds: [],
    magiasConhecidasIds: [],

    equipamentos: [],
    sintonizacao: [
      { id: 'att_1', name: '', active: false, notes: '' },
      { id: 'att_2', name: '', active: false, notes: '' },
      { id: 'att_3', name: '', active: false, notes: '' },
    ],
    companheiroId: null,
    companheiroPvAtual: 0,
    moedas: { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 },

    visibilidade: {
      conjuracao: false,
      recursos_classe: false,
      condicoes: false,
      companheiro: false,
      sintonizacao: false,
    },
  };
}

/**
 * Verifica se a ficha ainda está completamente vazia (sem edição do usuário).
 */
export function isSheetPristineBlank(sheet: CharacterSheet): boolean {
  const hasAnyAttrEdited = Object.values(sheet.atributos).some((v) => v !== 10);
  const hasAnySave = Object.values(sheet.salvaguardasProf).some(Boolean);
  const hasAnySkill = Object.values(sheet.periciasProf).some((v) => v > 0);
  const hasAnyCoin = Object.values(sheet.moedas).some((v) => v > 0);
  return (
    !sheet.nome.trim() &&
    !sheet.classeId &&
    !sheet.especieId &&
    !sheet.antecedenteId &&
    !sheet.alinhamento &&
    !sheet.aparencia.trim() &&
    !sheet.historia.trim() &&
    !sheet.retratoDataUrl &&
    (sheet.testesSelecionadosIds?.length ?? 0) === 0 &&
    !sheet.notasCaracteristicas.trim() &&
    sheet.nivel === 1 &&
    sheet.xp === 0 &&
    sheet.pvAtual === 0 &&
    sheet.pvMax === 0 &&
    sheet.pvMaxManualOverride === null &&
    sheet.ataques.length === 0 &&
    sheet.equipamentos.length === 0 &&
    sheet.talentosIds.length === 0 &&
    sheet.magiasPreparadasIds.length === 0 &&
    sheet.idiomas.length === 0 &&
    !hasAnyAttrEdited &&
    !hasAnySave &&
    !hasAnySkill &&
    !hasAnyCoin
  );
}

/**
 * Atualiza a ficha automaticamente quando o usuário escolhe ou troca a Classe
 * diretamente no cabeçalho da folha oficial.
 */
export function applyInlineClassChange(sheet: CharacterSheet, newClassId: string): CharacterSheet {
  const cls = CLASS_MAP[newClassId];
  const prevCls = CLASS_MAP[sheet.classeId];
  if (!cls) {
    return {
      ...sheet,
      classeId: '',
      subclasseId: '',
      recursosClasse: [],
      espacosMagia: createEmptySpellSlots(),
      espacosPacto: { total: 0, used: 0, slotLevel: 1 },
      updatedAt: new Date().toISOString(),
    };
  }

  const prevWasBlank = !sheet.classeId;
  const salvaguardasProf: Record<AbilityKey, boolean> = {
    for: cls.savingThrows.includes('for'),
    des: cls.savingThrows.includes('des'),
    con: cls.savingThrows.includes('con'),
    int: cls.savingThrows.includes('int'),
    sab: cls.savingThrows.includes('sab'),
    car: cls.savingThrows.includes('car'),
  };

  const nextSubId = sheet.nivel >= 3 ? cls.subclasses[0]?.id ?? '' : '';
  const sub = cls.subclasses.find((s) => s.id === nextSubId);
  const { espacosMagia, espacosPacto } = buildSpellSlotsForClass(cls.id, nextSubId, sheet.nivel);
  const recursosClasse = buildClassResourcesForLevel(cls.id, sheet.nivel, sheet.atributos, undefined, nextSubId);
  const unarmoredFormula: CharacterSheet['unarmoredFormula'] =
    cls.id === 'barbaro'
      ? 'barbaro'
      : cls.id === 'monge'
        ? 'monge'
        : sheet.unarmoredFormula;

  // Sync class tool proficiencies without losing background/manual tools
  const prevClassToolNames = new Set((prevCls?.toolProficiencies ?? []).map((t) => t.toLowerCase()));
  const retainedTools = sheet.ferramentasProficiencia.filter(
    (t) => !t.id.startsWith('tool_cls_') && !prevClassToolNames.has(t.name.toLowerCase())
  );
  const newClassTools: ToolProficiency[] = cls.toolProficiencies
    .filter((t) => t && !retainedTools.some((rt) => rt.name.toLowerCase() === t.toLowerCase()))
    .map((tName, idx) => {
      const match = TOOLS_CATALOG.find((c) => tName.toLowerCase().includes(c.name.toLowerCase().split(' ')[0]));
      return {
        id: `tool_cls_${cls.id}_${idx}`,
        name: tName,
        defaultAbility: match?.ability ?? 'des',
        synergySkill: match?.synergySkill,
      };
    });

  // Sync always-prepared spells from class & subclass
  const autoPrepared = new Set(sheet.magiasPreparadasIds);
  const collectAutoSpells = (table?: Record<number, string[]>) => {
    if (!table) return;
    for (const [reqLvlStr, spellIds] of Object.entries(table)) {
      if (sheet.nivel >= Number(reqLvlStr)) {
        spellIds.forEach((id) => autoPrepared.add(id));
      }
    }
  };
  collectAutoSpells(cls.alwaysPreparedSpells);
  collectAutoSpells(sub?.alwaysPreparedSpells);

  const totalExistingCoins =
    sheet.moedas.pc + sheet.moedas.pp + sheet.moedas.pe + sheet.moedas.po + sheet.moedas.pl;
  const shouldSeedMaxGold = prevWasBlank && totalExistingCoins === 0;
  const nextMoedas = shouldSeedMaxGold
    ? { ...sheet.moedas, po: calculateMaxStartingGold(cls.id, sheet.antecedenteId) }
    : sheet.moedas;

  const updated: CharacterSheet = {
    ...sheet,
    classeId: cls.id,
    subclasseId: nextSubId,
    salvaguardasProf,
    armadurasTreinamento: { ...cls.armorTraining },
    armasProficiencia: cls.weaponProficiencies,
    ferramentasProficiencia: [...retainedTools, ...newClassTools],
    unarmoredFormula,
    conjuracaoAtributo: cls.spellcasting.ability ?? sub?.grantsSpellcasting?.ability ?? sheet.conjuracaoAtributo,
    espacosMagia,
    espacosPacto,
    recursosClasse,
    magiasPreparadasIds: Array.from(autoPrepared),
    magiasConhecidasIds: Array.from(new Set([...sheet.magiasConhecidasIds, ...autoPrepared])),
    moedas: nextMoedas,
    visibilidade: {
      ...sheet.visibilidade,
      conjuracao: cls.spellcasting.progression !== 'none' || sheet.visibilidade.conjuracao,
      recursos_classe: recursosClasse.length > 0 || (sheet.recursosEspecie?.length ?? 0) > 0,
    },
    updatedAt: new Date().toISOString(),
  };

  return reconcileCharacterSheet(sheet, updated);
}

/**
 * Atualiza a ficha quando o usuário troca a Subclasse diretamente no cabeçalho.
 */
export function applyInlineSubclassChange(sheet: CharacterSheet, newSubId: string): CharacterSheet {
  const updated: CharacterSheet = {
    ...sheet,
    subclasseId: newSubId,
    updatedAt: new Date().toISOString(),
  };
  return reconcileCharacterSheet(sheet, updated);
}

/**
 * Atualiza Nível (1–20) diretamente no cabeçalho, recalculando PV Máx, espaços de magia e recursos.
 */
export function applyInlineLevelChange(sheet: CharacterSheet, rawLevel: number): CharacterSheet {
  const nivel = Math.max(1, Math.min(20, Math.floor(rawLevel) || 1));
  const cls = CLASS_MAP[sheet.classeId];
  const subclasseId = nivel >= 3 ? sheet.subclasseId || cls?.subclasses[0]?.id || '' : '';

  const updated: CharacterSheet = {
    ...sheet,
    nivel,
    subclasseId,
    updatedAt: new Date().toISOString(),
  };
  return reconcileCharacterSheet(sheet, updated);
}

/**
 * Atualiza Espécie / Linhagem diretamente no cabeçalho da folha oficial.
 */
export function applyInlineSpeciesChange(
  sheet: CharacterSheet,
  newSpeciesId: string,
  newSubOptionId?: string
): CharacterSheet {
  const sp = SPECIES_LIST.find((s) => s.id === newSpeciesId);
  if (!sp) {
    return reconcileCharacterSheet(sheet, {
      ...sheet,
      especieId: '',
      especieOpcaoId: undefined,
      recursosEspecie: [],
      updatedAt: new Date().toISOString(),
    });
  }

  const resolvedSub = newSubOptionId ?? sp.subOptions?.[0]?.id;
  const updated: CharacterSheet = {
    ...sheet,
    especieId: sp.id,
    especieOpcaoId: resolvedSub,
    tamanho: sp.sizes.includes(sheet.tamanho) ? sheet.tamanho : sp.sizes[0] ?? 'Médio',
    updatedAt: new Date().toISOString(),
  };

  return reconcileCharacterSheet(sheet, updated);
}

/**
 * Atualiza Antecedente diretamente no cabeçalho da folha oficial, sincronizando
 * o Talento de Origem, as 2 perícias proficientes e a ferramenta do Bloco 4.
 */
export function applyInlineBackgroundChange(sheet: CharacterSheet, newBgId: string): CharacterSheet {
  const prevBg = BACKGROUNDS_LIST.find((b) => b.id === sheet.antecedenteId);
  const nextBg = BACKGROUNDS_LIST.find((b) => b.id === newBgId);
  if (!nextBg) {
    return {
      ...sheet,
      antecedenteId: '',
      updatedAt: new Date().toISOString(),
    };
  }

  const periciasProf = { ...sheet.periciasProf };
  if (prevBg) {
    prevBg.skills.forEach((sk) => {
      if (periciasProf[sk] === 1) periciasProf[sk] = 0;
    });
  }
  nextBg.skills.forEach((sk) => {
    if (periciasProf[sk] === 0) periciasProf[sk] = 1;
  });

  const filteredFeats = prevBg
    ? sheet.talentosIds.filter((fid) => fid !== prevBg.originFeatId)
    : sheet.talentosIds;
  const talentosIds = Array.from(new Set([nextBg.originFeatId, ...filteredFeats]));

  const existingTools = prevBg
    ? sheet.ferramentasProficiencia.filter((t) => t.name !== prevBg.tool)
    : sheet.ferramentasProficiencia;
  const hasNewTool = existingTools.some(
    (t) => t.name.toLowerCase() === nextBg.tool.toLowerCase()
  );
  const ferramentasProficiencia: ToolProficiency[] =
    !hasNewTool && nextBg.tool && !nextBg.tool.toLowerCase().includes('escolha')
      ? [
          ...existingTools,
          {
            id: `tool_bg_${nextBg.id}`,
            name: nextBg.tool,
            defaultAbility:
              TOOLS_CATALOG.find((c) =>
                nextBg.tool.toLowerCase().includes(c.name.toLowerCase().split(' ')[0])
              )?.ability ?? 'des',
            synergySkill: TOOLS_CATALOG.find((c) =>
              nextBg.tool.toLowerCase().includes(c.name.toLowerCase().split(' ')[0])
            )?.synergySkill,
          },
        ]
      : existingTools;

  const prevMaxClassOnly = calculateMaxStartingGold(sheet.classeId, sheet.antecedenteId);
  const totalExistingCoins =
    sheet.moedas.pc + sheet.moedas.pp + sheet.moedas.pe + sheet.moedas.po + sheet.moedas.pl;
  const shouldUpdateMaxGold =
    !prevBg && (totalExistingCoins === 0 || (sheet.moedas.po === prevMaxClassOnly && sheet.equipamentos.length === 0));
  const nextMoedas = shouldUpdateMaxGold
    ? { ...sheet.moedas, po: calculateMaxStartingGold(sheet.classeId, nextBg.id) }
    : sheet.moedas;

  return reconcileCharacterSheet(sheet, {
    ...sheet,
    antecedenteId: nextBg.id,
    periciasProf,
    talentosIds,
    ferramentasProficiencia,
    moedas: nextMoedas,
    updatedAt: new Date().toISOString(),
  });
}

export function buildCharacterFromWizardConfig(
  cfg: WizardBuildConfig,
  existing?: Partial<CharacterSheet>
): CharacterSheet {
  const cls = CLASS_MAP[cfg.classeId] ?? CLASS_MAP.guerreiro;
  const sub = cls.subclasses.find((s) => s.id === cfg.subclasseId);
  const species = SPECIES_LIST.find((s) => s.id === cfg.especieId) ?? SPECIES_LIST[0];
  const bg = BACKGROUNDS_LIST.find((b) => b.id === cfg.antecedenteId) ?? BACKGROUNDS_LIST[0];

  const salvaguardasProf: Record<AbilityKey, boolean> = {
    for: cls.savingThrows.includes('for'),
    des: cls.savingThrows.includes('des'),
    con: cls.savingThrows.includes('con'),
    int: cls.savingThrows.includes('int'),
    sab: cls.savingThrows.includes('sab'),
    car: cls.savingThrows.includes('car'),
  };

  const periciasProf = createEmptySkillsRecord();
  const combinedSkills = new Set<SkillKey>([...bg.skills, ...cfg.selectedSkills]);
  for (const sk of combinedSkills) {
    periciasProf[sk] = 1;
  }
  for (const ex of cfg.expertiseSkills ?? []) {
    periciasProf[ex] = 2;
  }

  const unarmoredFormula: CharacterSheet['unarmoredFormula'] =
    cls.id === 'barbaro'
      ? 'barbaro'
      : cls.id === 'monge'
        ? 'monge'
        : cls.id === 'feiticeiro' && cfg.subclasseId === 'draconica'
          ? 'draconico'
          : 'padrao';

  const resolvedSubOptionId = cfg.especieOpcaoId ?? species.subOptions?.[0]?.id;
  const speciesInnate = getSpeciesInnateSpells(species.id, resolvedSubOptionId, cfg.nivel);

  const conjuracaoAtributo: AbilityKey | null =
    cls.spellcasting.ability ??
    sub?.grantsSpellcasting?.ability ??
    (speciesInnate.length > 0
      ? species.id === 'aasimar' || species.id === 'tiefling'
        ? 'car'
        : 'int'
      : null);

  const { espacosMagia, espacosPacto } = buildSpellSlotsForClass(
    cls.id,
    cfg.subclasseId,
    cfg.nivel
  );

  const recursosClasse = buildClassResourcesForLevel(
    cls.id,
    cfg.nivel,
    cfg.atributos,
    undefined,
    cfg.nivel >= 3 ? cfg.subclasseId : ''
  );
  const recursosEspecie = buildSpeciesResourcesForLevel(species.id, resolvedSubOptionId, cfg.nivel);

  // Build tools from class & background
  const toolNames = Array.from(new Set([...cls.toolProficiencies, bg.tool])).filter(
    (t) => t && !t.toLowerCase().includes('escolha')
  );
  const ferramentasProficiencia: ToolProficiency[] = toolNames.map((tName, idx) => {
    const match = TOOLS_CATALOG.find((c) => tName.toLowerCase().includes(c.name.toLowerCase().split(' ')[0]));
    return {
      id: `tool_${idx}_${tName.slice(0, 8)}`,
      name: tName,
      defaultAbility: match?.ability ?? 'des',
      synergySkill: match?.synergySkill,
    };
  });

  // Always prepared spells from class, subclass & species innate spells (by level)
  const autoPrepared = new Set<string>(cfg.preparedSpellIds);
  if (cls.alwaysPreparedSpells) {
    for (const [reqLvlStr, spellIds] of Object.entries(cls.alwaysPreparedSpells)) {
      if (cfg.nivel >= Number(reqLvlStr)) {
        spellIds.forEach((id) => autoPrepared.add(id));
      }
    }
  }
  if (sub?.alwaysPreparedSpells) {
    for (const [reqLvlStr, spellIds] of Object.entries(sub.alwaysPreparedSpells)) {
      if (cfg.nivel >= Number(reqLvlStr)) {
        spellIds.forEach((id) => autoPrepared.add(id));
      }
    }
  }
  speciesInnate.forEach((id) => autoPrepared.add(id));

  const bgEquipOption = cfg.antecedenteEquipOpcao ?? 'A';

  const draft: CharacterSheet = {
    id: existing?.id ?? `char_${Date.now()}`,
    version: 2,
    updatedAt: new Date().toISOString(),
    nome: cfg.nome.trim() || 'Personagem Sem Nome',
    classeId: cls.id,
    subclasseId: cfg.nivel >= 3 ? cfg.subclasseId : '',
    nivel: cfg.nivel,
    xp: LEVEL_XP_TABLE[cfg.nivel] ?? 0,
    especieId: species.id,
    especieOpcaoId: resolvedSubOptionId,
    tamanho: cfg.tamanho ?? species.sizes[0] ?? 'Médio',
    antecedenteId: bg.id,
    antecedenteEquipOpcao: bgEquipOption,
    alinhamento: cfg.alinhamento || 'Neutro',
    idiomas: cfg.idiomas && cfg.idiomas.length > 0 ? cfg.idiomas : ['Comum'],
    aparencia: cfg.aparencia ?? '',
    historia: cfg.historia ?? '',

    armorId: cfg.armorId,
    escudoEquipado: cfg.escudoEquipado,
    caBonusManual: 0,
    unarmoredFormula,
    iniciativaBonusManual: 0,
    deslocamentoBonusManual: 0,
    inspiracaoHeroica: species.id === 'humano',
    pvAtual: 10,
    pvMax: 10,
    pvMaxManualOverride: null,
    pvTemp: 0,
    dvGasto: 0,
    morteSucessos: 0,
    morteFalhas: 0,

    condicoesAtivas: [],
    nivelExaustao: 0,
    concentrandoEm: '',

    atributos: { ...cfg.atributos },
    salvaguardasProf,
    periciasProf,

    armadurasTreinamento: { ...cls.armorTraining },
    armasProficiencia: cls.weaponProficiencies,
    ferramentasProficiencia,

    ataques: [],
    recursosClasse,
    recursosEspecie,
    talentosIds: Array.from(new Set([bg.originFeatId, ...cfg.talentosIds])),
    customFeats: existing?.customFeats ?? [],
    customVariables: existing?.customVariables ?? [],
    notasCaracteristicas: existing?.notasCaracteristicas ?? '',

    conjuracaoAtributo,
    espacosMagia,
    espacosPacto,
    magiasPreparadasIds: Array.from(autoPrepared),
    magiasConhecidasIds: Array.from(autoPrepared),

    equipamentos: [
      ...cls.startingEquipmentA.map((name, i) => ({
        id: `eq_cls_${i}`,
        name,
        quantity: 1,
        weightKg: 1.5,
      })),
      ...(bgEquipOption === 'A'
        ? bg.startingEquipment.map((name, i) => ({
            id: `eq_bg_${i}`,
            name,
            quantity: 1,
            weightKg: 0.5,
          }))
        : []),
      ...(cfg.extraEquipment ?? []),
    ],
    sintonizacao: existing?.sintonizacao ?? [
      { id: 'att_1', name: '', active: false, notes: '' },
      { id: 'att_2', name: '', active: false, notes: '' },
      { id: 'att_3', name: '', active: false, notes: '' },
    ],
    companheiroId: existing?.companheiroId ?? null,
    companheiroPvAtual: existing?.companheiroPvAtual ?? 0,
    moedas: cfg.customMoedas
      ? { ...cfg.customMoedas }
      : {
          pc: 0,
          pp: 0,
          pe: 0,
          po: calculateMaxStartingGold(cls.id, bg.id),
          pl: 0,
        },
    visibilidade: {
      conjuracao: false,
      recursos_classe: recursosClasse.length > 0 || recursosEspecie.length > 0,
      condicoes: false,
      companheiro: existing?.visibilidade?.companheiro ?? false,
      sintonizacao: existing?.visibilidade?.sintonizacao ?? false,
    },
  };

  // Reconcile all reactive grants from class, subclass, species, background, and feats
  const blankRef = createBlankCharacter();
  draft.hpMode = existing?.hpMode ?? 'media';
  draft.hpRolledPerLevel = existing?.hpRolledPerLevel ?? {};
  const reconciled = reconcileCharacterSheet(blankRef, draft);

  const maxHp = calculateMaxHP(reconciled);
  reconciled.pvMax = maxHp;
  reconciled.pvAtual = maxHp;

  const attacks: AttackEntry[] = [];
  for (const wid of cfg.weaponIds) {
    const w = WEAPONS_LIST.find((item) => item.id === wid);
    if (w) attacks.push(createAttackFromWeapon(w, reconciled));
  }
  reconciled.ataques = attacks;
  reconciled.visibilidade.conjuracao = hasSpellcastingAccess(reconciled);

  return reconciled;
}
