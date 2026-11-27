import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  adjustSpellDailyUse,
  applyDamage,
  applyHealing,
  applyLongRest,
  applyShortRest,
  applyTempHp,
  buildClassResourcesForLevel,
  calculateAC,
  calculateAbilityCheckBonus,
  calculateAttackStats,
  calculateInitiative,
  calculateMaxHP,
  calculateMaxStartingGold,
  calculatePassivePerception,
  calculateSaveBonus,
  calculateSkillBonus,
  calculateSpeed,
  calculateSpellStats,
  calculateTotalWeightKg,
  classifyCountableInventoryItem,
  consumeSpellCast,
  createAttackFromWeapon,
  deductCopperFromCoins,
  executeCombinedDamageRoll,
  executeD20Roll,
  formatCopperToCoinsLabel,
  getAbilityMod,
  getAvailableExtraDamageOptions,
  getCantripScaledDice,
  getClassSpellPrepLimits,
  getCountableEquipmentItems,
  getMaxAvailableSpellCircle,
  getProficiencyBonus,
  getSkillSources,
  getSpeciesDarkvision,
  getSpeciesInnateSpells,
  parseAndRollDiceFormula,
  parseCostToCopper,
  reconcileCharacterSheet,
  resolveConditionHintForRoll,
  spellRequiresTest,
  syncAutoLinkedSpellTests,
  validateCharacterImportJson,
} from './engine.ts';
import { WEAPONS_LIST } from '../data/equipment.ts';
import {
  applyInlineBackgroundChange,
  applyInlineClassChange,
  applyInlineLevelChange,
  applyInlineSpeciesChange,
  applyInlineSubclassChange,
  buildCharacterFromWizardConfig,
  createBlankCharacter,
  isSheetPristineBlank,
} from './defaultCharacter.ts';
import { ATTACHED_CLASS_BLOCK_URLS, CLASSES_LIST, CLASS_MAP } from '../data/classes.ts';
import { BACKGROUNDS_LIST, SPECIES_LIST } from '../data/origins.ts';
import {
  buildFeatRuleHelp,
  buildSpellRuleHelp,
  buildWeaponRuleHelp,
  getSearchableGlossary,
  searchGlossaryEntries,
  SKILL_RULE_HELP,
} from '../data/rulesHelp.ts';
import { getHydratedCompendiums, parseClassBlockTxt, parseCreaturesTxt, parseSpellsTxt } from './txtParser.ts';

function buildTestPaladin() {
  return buildCharacterFromWizardConfig({
    nome: 'Paladino Teste',
    classeId: 'paladino',
    subclasseId: 'devocao',
    nivel: 5,
    especieId: 'humano',
    tamanho: 'Médio',
    antecedenteId: 'soldado',
    alinhamento: 'Leal e Bom',
    atributos: { for: 18, des: 10, con: 14, int: 10, sab: 12, car: 16 },
    selectedSkills: ['persuasao', 'religiao', 'percepcao'],
    talentosIds: ['atacante_selvagem', 'alerta', 'defesa'],
    armorId: 'cota_talas',
    escudoEquipado: true,
    weaponIds: ['espada_longa', 'azagaia'],
    preparedSpellIds: ['bencao', 'curar_ferimentos', 'destruicao_divina'],
  });
}

function buildTestBarbarian() {
  return buildCharacterFromWizardConfig({
    nome: 'Bárbaro Teste',
    classeId: 'barbaro',
    subclasseId: 'berserker',
    nivel: 3,
    especieId: 'anao',
    tamanho: 'Médio',
    antecedenteId: 'fazendeiro',
    alinhamento: 'Caótico e Bom',
    atributos: { for: 17, des: 14, con: 16, int: 8, sab: 12, car: 10 },
    selectedSkills: ['atletismo', 'intimidacao', 'percepcao'],
    talentosIds: ['vigoroso'],
    armorId: 'nenhuma',
    escudoEquipado: false,
    weaponIds: ['machado_grande'],
    preparedSpellIds: [],
  });
}

function buildTestRogue() {
  return buildCharacterFromWizardConfig({
    nome: 'Ladina Teste',
    classeId: 'ladino',
    subclasseId: 'assassino',
    nivel: 4,
    especieId: 'pequenino',
    tamanho: 'Pequeno',
    antecedenteId: 'criminoso',
    alinhamento: 'Caótico e Neutro',
    atributos: { for: 8, des: 18, con: 14, int: 12, sab: 12, car: 12 },
    selectedSkills: ['acrobacia', 'enganacao', 'percepcao'],
    expertiseSkills: ['furtividade', 'prestidigitacao'],
    talentosIds: ['alerta'],
    armorId: 'couro_batido',
    escudoEquipado: false,
    weaponIds: ['espada_curta'],
    preparedSpellIds: [],
  });
}

test('blank character sheet starts 100% clean and supports inline class/species/background updates', () => {
  const blank = createBlankCharacter();
  assert.equal(blank.nome, '');
  assert.equal(blank.classeId, '');
  assert.equal(blank.especieId, '');
  assert.equal(blank.antecedenteId, '');
  assert.equal(blank.pvAtual, 0);
  assert.equal(calculateMaxHP(blank), 0);
  assert.equal(calculateSpeed(blank).totalMeters, 0);
  assert.equal(calculateAC(blank).total, 10);
  assert.equal(blank.retratoDataUrl, '');
  assert.deepEqual(blank.testesSelecionadosIds, []);
  assert.equal(isSheetPristineBlank(blank), true);
  assert.equal(validateCharacterImportJson(blank).ok, true);

  let edited = applyInlineClassChange(blank, 'guerreiro');
  assert.equal(edited.classeId, 'guerreiro');
  assert.equal(calculateMaxHP(edited), 10); // d10 + CON 0
  assert.equal(edited.pvAtual, 10);
  assert.equal(edited.salvaguardasProf.for, true);
  assert.equal(edited.salvaguardasProf.con, true);
  assert.equal(isSheetPristineBlank(edited), false);

  edited = applyInlineSpeciesChange(edited, 'anao');
  assert.equal(calculateSpeed(edited).totalMeters, 9);
  assert.equal(calculateMaxHP(edited), 11); // +1 Tenacidade Anã

  edited = applyInlineBackgroundChange(edited, 'soldado');
  assert.ok(edited.talentosIds.includes('atacante_selvagem'));
  assert.equal(edited.periciasProf.atletismo, 1);
  assert.equal(edited.periciasProf.intimidacao, 1);
});

test('ability modifiers and proficiency bonus follow D&D 2024 rules', () => {
  assert.equal(getAbilityMod(8), -1);
  assert.equal(getAbilityMod(10), 0);
  assert.equal(getAbilityMod(18), 4);
  assert.equal(getAbilityMod(20), 5);

  assert.equal(getProficiencyBonus(1), 2);
  assert.equal(getProficiencyBonus(4), 2);
  assert.equal(getProficiencyBonus(5), 3);
  assert.equal(getProficiencyBonus(9), 4);
  assert.equal(getProficiencyBonus(13), 5);
  assert.equal(getProficiencyBonus(17), 6);
});

test('AC calculation handles heavy armor, shield, Defense style, Medium Armor Master, and unarmored defense', () => {
  const paladin = buildTestPaladin(); // Cota de Talas (17) + Defesa (+1) + Escudo (+2) = 20
  const ac = calculateAC(paladin);
  assert.equal(ac.total, 20);
  assert.equal(ac.untrainedWarning, false);

  const noShield = { ...paladin, escudoEquipado: false };
  assert.equal(calculateAC(noShield).total, 18);

  // Bárbaro sem armadura: 10 + DES (+2) + CON (+3) = 15
  const barbarian = buildTestBarbarian();
  assert.equal(calculateAC(barbarian).total, 15);

  // Mestre em Armadura Média com DES 16 (+3) em Peitoral (14) => 17
  const medMaster = {
    ...barbarian,
    armorId: 'peitoral',
    atributos: { ...barbarian.atributos, des: 16 },
    talentosIds: [...barbarian.talentosIds, 'mestre_armadura_media'],
  };
  assert.equal(calculateAC(medMaster).total, 17);
});

test('HP calculation includes class hit die, Anão Tenacidade, and Vigoroso feat', () => {
  // Bárbaro Nv 3 (d12: 12 + 7 + 7 = 26) + CON +3×3 (+9) + Anão +1×3 (+3) + Vigoroso +2×3 (+6) = 44
  const barb = buildTestBarbarian();
  assert.equal(calculateMaxHP(barb), 44);
});

test('Initiative, Passive Perception, Skills, Saves (with Aura), and Spell Stats calculate properly', () => {
  const paladin = buildTestPaladin(); // Nv 5, BP +3, DES 10 (0), CAR 16 (+3), Alerta (+BP)
  assert.equal(calculateInitiative(paladin).total, 3);
  // Percepção: SAB +1 + BP +3 = +4 -> Passiva 14
  assert.equal(calculatePassivePerception(paladin), 14);

  const spellStats = calculateSpellStats(paladin);
  assert.equal(spellStats.ability, 'car');
  assert.equal(spellStats.spellSaveDc, 14); // 8 + 3 + 3
  assert.equal(spellStats.spellAttackBonus, 6); // 3 + 3

  // Paladino Nv 6 ativa Aura de Proteção (+CAR) em todas as salvaguardas
  const paladinLv6 = { ...paladin, nivel: 6 };
  const forSave = calculateSaveBonus(paladinLv6, 'for');
  // FOR +4 + Aura +3 = +7 (não proficiente em FOR)
  assert.equal(forSave.total, 7);

  // Ladino com Especialização em Furtividade: DES +4 + 2×BP (+4) = +8
  const rogue = buildTestRogue();
  assert.equal(calculateSkillBonus(rogue, 'furtividade').total, 8);
});

test('Conditions and Exhaustion 2024 automatically modify roll suggestions, totals, and speed', () => {
  let sheet = buildTestPaladin();
  sheet = {
    ...sheet,
    condicoesAtivas: ['envenenado'],
    nivelExaustao: 2,
  };

  const atkHint = resolveConditionHintForRoll(sheet, 'attack', 'for');
  assert.equal(atkHint.suggestedMode, 'desvantagem');
  assert.ok(atkHint.reasons[0].includes('Envenenado'));

  // Vantagem + Desvantagem se anulam -> Normal
  const cancelSheet = { ...sheet, condicoesAtivas: ['envenenado', 'invisivel'] as typeof sheet.condicoesAtivas };
  const cancelHint = resolveConditionHintForRoll(cancelSheet, 'attack', 'for');
  assert.equal(cancelHint.suggestedMode, 'normal');

  // Exaustão Nv 2 aplica -4 em testes D20 e -3m em deslocamento (9m -> 6m)
  assert.equal(calculateSpeed(sheet).totalMeters, 6);
  const fixedRng = () => 0.45; // rollDie(20) => 10
  const roll = executeD20Roll({
    title: 'Atletismo',
    kind: 'skill',
    mode: 'normal',
    modifierBreakdown: [{ label: 'Mod. FOR', value: 4 }],
    exhaustionLevel: 2,
    rng: fixedRng,
  });
  assert.equal(roll.keptRoll, 10);
  assert.equal(roll.total, 10); // 10 + 4 - 4
  assert.ok(roll.breakdownText.includes('-4 (Exaustão Nv 2)'));

  // Condição Agarrado reduz deslocamento a 0
  const grappled = { ...sheet, condicoesAtivas: ['agarrado'] as typeof sheet.condicoesAtivas };
  assert.equal(calculateSpeed(grappled).totalMeters, 0);
});

test('Damage absorbs Temp HP first, Healing caps at Max HP, Short/Long Rest follow 2024 rules', () => {
  let sheet = buildTestPaladin();
  const maxHp = sheet.pvMax;
  sheet = applyTempHp(sheet, 8);
  assert.equal(sheet.pvTemp, 8);
  // Temp HP não acumula; valor menor não sobrescreve
  sheet = applyTempHp(sheet, 4);
  assert.equal(sheet.pvTemp, 8);

  // Dano 12 -> absorve 8 Temp HP e reduz 4 do PV Atual
  sheet = applyDamage(sheet, 12);
  assert.equal(sheet.pvTemp, 0);
  assert.equal(sheet.pvAtual, maxHp - 4);

  // Cura acima do máximo é limitada a pvMax
  sheet = applyHealing(sheet, 100);
  assert.equal(sheet.pvAtual, maxHp);

  // Simular gasto de recursos, espaços, dados de vida e exaustão
  sheet = {
    ...sheet,
    pvAtual: 15,
    pvTemp: 6,
    dvGasto: 3,
    nivelExaustao: 2,
    espacosMagia: {
      ...sheet.espacosMagia,
      1: { total: 4, used: 3 },
    },
    recursosClasse: sheet.recursosClasse.map((r) => ({ ...r, current: 0 })),
  };

  // Descanso Curto: recupera 1 Canalizar Divindade (curto_1_longo_todos) e soma cura de DV
  const afterShort = applyShortRest(sheet, 10, 1);
  assert.equal(afterShort.pvAtual, 25);
  assert.equal(afterShort.dvGasto, 4);
  const cd = afterShort.recursosClasse.find((r) => r.id === 'canalizar_divindade_paladino');
  assert.equal(cd?.current, 1);

  // Descanso Longo 2024: PV cheio, todos os DVs recuperados (dvGasto = 0), Temp HP = 0, slots zerados, Exaustão -1
  const afterLong = applyLongRest(afterShort);
  assert.equal(afterLong.pvAtual, maxHp);
  assert.equal(afterLong.dvGasto, 0);
  assert.equal(afterLong.pvTemp, 0);
  assert.equal(afterLong.nivelExaustao, 1);
  assert.equal(afterLong.espacosMagia[1].used, 0);
  assert.ok(afterLong.recursosClasse.every((r) => r.current === r.max));
});

test('Cantrip scaling, dice formula parsing, and JSON import validation work', () => {
  assert.equal(getCantripScaledDice('1d10', 1), '1d10');
  assert.equal(getCantripScaledDice('1d10', 5), '2d10');
  assert.equal(getCantripScaledDice('1d10', 11), '3d10');
  assert.equal(getCantripScaledDice('1d10', 17), '4d10');

  const critDmg = parseAndRollDiceFormula('1d8', 4, true, () => 0.5); // 2d8 (each 5) + 4 = 14
  assert.equal(critDmg.rolls.length, 2);
  assert.equal(critDmg.total, 14);

  const valid = validateCharacterImportJson(buildTestPaladin());
  assert.equal(valid.ok, true);
  const invalid = validateCharacterImportJson({ nome: 'Teste' });
  assert.equal(invalid.ok, false);
});

test('Bloco 7 spell .txt parser and Bloco 8.1 creature .txt parser extract structured entries', () => {
  const sampleSpellTxt = `
### BOLA DE FOGO
* **Círculo/Escola:** 3º Círculo - Evocação (Feiticeiro, Mago)
* **Conjuração:** 1 Ação | Alcance: 45 m | Comp.: V, S, M | Duração: Instantânea
* **Efeito:** Esfera de 6 m. SG Destreza ou 8d6 Ígneo (metade em sucesso).
* **Círculo Superior:** +1d6 por círculo acima do 3º.
`;
  const parsedSpells = parseSpellsTxt(sampleSpellTxt);
  assert.equal(parsedSpells.length, 1);
  assert.equal(parsedSpells[0].level, 3);
  assert.equal(parsedSpells[0].school, 'Evocação');
  assert.equal(parsedSpells[0].saveAbility, 'des');
  assert.equal(parsedSpells[0].damageFormula, '8d6');
  assert.ok(parsedSpells[0].classes.includes('mago'));

  const sampleCreatureTxt = `
### CORUJA
* **Tipo/Tamanho:** Besta Miúda | ND 0 (10 XP)
* **CA:** 11 | **PV:** 1 (1d4 - 1) | **Desl.:** 1,5 m, Voo 18 m
* **Atributos:** FOR 3 (-4), DES 13 (+1), CON 8 (-1), INT 2 (-4), SAB 12 (+1), CAR 7 (-2)
* **Sentidos:** Visão no Escuro 36 m, PP 15 | **Idiomas:** —
* **Traços:** Sobrevoo (não provoca Ataque de Oportunidade ao voar para fora do alcance).
* **Ações:** Garras: +3, 1 Cortante.
`;
  const parsedCreatures = parseCreaturesTxt(sampleCreatureTxt);
  assert.equal(parsedCreatures.length, 1);
  assert.equal(parsedCreatures[0].ac, 11);
  assert.equal(parsedCreatures[0].abilities.sab, 12);
});

test('Bloco 4 origins: 16 backgrounds, 10 species, lineages, darkvision, speed overrides, Option A/B gear, and species rest counters', () => {
  assert.equal(BACKGROUNDS_LIST.length, 16);
  assert.equal(SPECIES_LIST.length, 10);

  // Elfo da Floresta Nv 5 -> 10.5m speed, VE 18m, innate spells: arte_druidica, passos_largos, passo_sem_rastro
  const woodElf = buildCharacterFromWizardConfig({
    nome: 'Elfo Teste',
    classeId: 'guerreiro',
    subclasseId: 'campeao',
    nivel: 5,
    especieId: 'elfo',
    especieOpcaoId: 'elfo_floresta',
    antecedenteId: 'guia',
    antecedenteEquipOpcao: 'B',
    atributos: { for: 16, des: 14, con: 14, int: 10, sab: 12, car: 8 },
    selectedSkills: ['atletismo', 'percepcao'],
    talentosIds: [],
    armorId: 'couro_batido',
    escudoEquipado: false,
    weaponIds: ['arco_longo'],
    preparedSpellIds: [],
  });
  assert.equal(calculateSpeed(woodElf).totalMeters, 10.5);
  assert.equal(getSpeciesDarkvision('elfo', 'drow'), 36);
  assert.equal(getSpeciesDarkvision('elfo', 'elfo_floresta'), 18);
  assert.deepEqual(
    getSpeciesInnateSpells('elfo', 'elfo_floresta', 5).sort(),
    ['arte_druidica', 'passo_sem_rastro', 'passos_largos']
  );
  // Option B adds 50 PO instead of Guia's 3 PO + items
  assert.ok(woodElf.moedas.po >= 50);
  // Guia auto-adds originFeatId (iniciado_em_magia)
  assert.ok(woodElf.talentosIds.includes('iniciado_em_magia'));

  // Orc Nv 5 -> BP = 3 -> Pico de Adrenalina (3/3 curto) + Resistência Implacável (1/1 longo)
  const orc = buildCharacterFromWizardConfig({
    nome: 'Orc Teste',
    classeId: 'barbaro',
    subclasseId: 'berserker',
    nivel: 5,
    especieId: 'orc',
    antecedenteId: 'soldado',
    antecedenteEquipOpcao: 'A',
    atributos: { for: 18, des: 14, con: 16, int: 8, sab: 10, car: 10 },
    selectedSkills: ['atletismo'],
    talentosIds: [],
    armorId: 'nenhuma',
    escudoEquipado: false,
    weaponIds: ['machado_grande'],
    preparedSpellIds: [],
  });
  assert.equal(getSpeciesDarkvision('orc'), 36);
  const adrenaline = orc.recursosEspecie?.find((r) => r.id === 'pico_adrenalina');
  assert.equal(adrenaline?.max, 3);
  const spentOrc = {
    ...orc,
    recursosEspecie: orc.recursosEspecie?.map((r) => ({ ...r, current: 0 })),
  };
  const afterShort = applyShortRest(spentOrc);
  assert.equal(afterShort.recursosEspecie?.find((r) => r.id === 'pico_adrenalina')?.current, 3);
  assert.equal(afterShort.recursosEspecie?.find((r) => r.id === 'resistencia_implacavel')?.current, 0);
  const afterLong = applyLongRest(afterShort);
  assert.equal(afterLong.recursosEspecie?.find((r) => r.id === 'resistencia_implacavel')?.current, 1);

  // Humano (Inventivo): Long Rest restores Heroic Inspiration
  const humanUsed = { ...buildTestPaladin(), inspiracaoHeroica: false };
  assert.equal(applyLongRest(humanUsed).inspiracaoHeroica, true);
});

test('Bloco 3 class parser loads full progression table, unabridged features, extra options, and subclass resources across all 12 classes', () => {
  for (const baseCls of CLASSES_LIST) {
    const url = ATTACHED_CLASS_BLOCK_URLS[baseCls.id];
    assert.ok(url, `URL missing for ${baseCls.id}`);
    const filePath = path.resolve(process.cwd(), 'public', url.replace(/^\//, ''));
    const txt = fs.readFileSync(filePath, 'utf8');
    const { enrichedClass } = parseClassBlockTxt(txt, baseCls);

    assert.equal(
      enrichedClass.progressionTable?.rows.length,
      20,
      `Expected 20 progression rows for ${baseCls.id}`
    );
    assert.ok(
      enrichedClass.features.length >= 9,
      `Expected >=9 features for ${baseCls.id}, got ${enrichedClass.features.length}`
    );
    assert.ok(
      enrichedClass.startingEquipmentText && enrichedClass.startingEquipmentText.length > 10,
      `Missing startingEquipmentText for ${baseCls.id}`
    );
    assert.ok(
      enrichedClass.subclasses.length === 4,
      `Expected 4 subclasses for ${baseCls.id}`
    );
  }

  // Verify specific extra sections parsed cleanly (Guerreiro Mestre da Batalha Manobras & Bruxo Invocações)
  const guerreiroTxt = fs.readFileSync(
    path.resolve(process.cwd(), 'public', ATTACHED_CLASS_BLOCK_URLS.guerreiro.replace(/^\//, '')),
    'utf8'
  );
  const { enrichedClass: parsedGuerreiro } = parseClassBlockTxt(guerreiroTxt, CLASS_MAP.guerreiro);
  const mestreBatalha = parsedGuerreiro.subclasses.find((s) => s.id === 'mestre_batalha');
  assert.ok(mestreBatalha);
  assert.ok((mestreBatalha.extraSections?.length ?? 0) >= 1);

  const bruxoTxt = fs.readFileSync(
    path.resolve(process.cwd(), 'public', ATTACHED_CLASS_BLOCK_URLS.bruxo.replace(/^\//, '')),
    'utf8'
  );
  const { enrichedClass: parsedBruxo, classSpellIds: bruxoSpells } = parseClassBlockTxt(
    bruxoTxt,
    CLASS_MAP.bruxo
  );
  assert.ok((parsedBruxo.extraSections?.length ?? 0) >= 1);
  assert.ok(bruxoSpells.length >= 30);

  // Subclass resource generation: Mestre da Batalha Nv 3 -> Dados de Superioridade (4, d8, curto)
  const bmResources = buildClassResourcesForLevel(
    'guerreiro',
    3,
    { for: 16, des: 12, con: 14, int: 10, sab: 10, car: 10 },
    [],
    'mestre_batalha'
  );
  const supDice = bmResources.find((r) => r.id === 'dados_superioridade');
  assert.ok(supDice);
  assert.equal(supDice.max, 4);
  assert.equal(supDice.die, 'd8');
  assert.equal(supDice.resetOn, 'curto');

  // Bardo Nv 5: Inspiração de Bardo resets on curto (Fonte de Inspiração)
  const bardLv5 = buildClassResourcesForLevel(
    'bardo',
    5,
    { for: 8, des: 14, con: 12, int: 10, sab: 10, car: 18 }
  );
  const bardInsp = bardLv5.find((r) => r.id === 'inspiracao_bardo');
  assert.equal(bardInsp?.max, 4);
  assert.equal(bardInsp?.die, '1d8');
  assert.equal(bardInsp?.resetOn, 'curto');
});

test('Level pick list changes immediately recalculate BP, Hit Dice, Max HP (fixed & rolled), spell slots, resources, and spell circles', () => {
  let mage = applyInlineClassChange(createBlankCharacter(), 'mago');
  mage = { ...mage, atributos: { ...mage.atributos, con: 14, int: 16 } };
  mage = reconcileCharacterSheet(mage, mage);
  assert.equal(getProficiencyBonus(mage.nivel), 2);
  assert.equal(calculateMaxHP(mage), 8); // d6 (6) + CON (+2)
  assert.equal(getMaxAvailableSpellCircle(mage), 1);
  assert.equal(mage.espacosMagia[1]?.total, 2);
  assert.equal(mage.espacosMagia[3]?.total, 0);

  // Jump to Level 5 via level selector helper
  mage = applyInlineLevelChange(mage, 5);
  assert.equal(mage.nivel, 5);
  assert.equal(getProficiencyBonus(mage.nivel), 3);
  // Nv 5 Mago (d6: 6 + 4*4 = 22) + CON (+2 * 5 = 10) = 32
  assert.equal(calculateMaxHP(mage), 32);
  assert.equal(mage.pvMax, 32);
  assert.equal(getMaxAvailableSpellCircle(mage), 3);
  assert.equal(mage.espacosMagia[1]?.total, 4);
  assert.equal(mage.espacosMagia[2]?.total, 3);
  assert.equal(mage.espacosMagia[3]?.total, 2);

  // Switch to rolled HP mode with custom rolls per level (Nv 2..5 rolled [6, 5, 6, 5])
  const rolledMage = reconcileCharacterSheet(mage, {
    ...mage,
    hpMode: 'rolagem',
    hpRolledPerLevel: { 2: 6, 3: 5, 4: 6, 5: 5 },
  });
  // Nv 1 = 6 + 2 = 8; Nv 2..5 = (6+2)+(5+2)+(6+2)+(5+2) = 8+7+8+7 = 30 => 38
  assert.equal(calculateMaxHP(rolledMage), 38);
  assert.equal(rolledMage.pvMax, 38);

  // Drop back to Level 2 -> circles & slots retract cleanly
  const lv2 = applyInlineLevelChange(rolledMage, 2);
  assert.equal(getMaxAvailableSpellCircle(lv2), 1);
  assert.equal(lv2.espacosMagia[2]?.total, 0);
  assert.equal(lv2.espacosMagia[3]?.total, 0);
  assert.equal(lv2.nivel, 2);
});

test('Reactive subclass switching applies and cleanly revokes spellcasting, armor/weapons, tools, skills, unarmored AC, and resources', () => {
  // Guerreiro Nv 5: Cavaleiro Místico <-> Mestre da Batalha
  let fighter = applyInlineClassChange(createBlankCharacter(), 'guerreiro');
  fighter = applyInlineLevelChange(fighter, 5);
  fighter = applyInlineSubclassChange(fighter, 'cavaleiro_mistico');

  assert.equal(fighter.conjuracaoAtributo, 'int');
  assert.equal(fighter.visibilidade.conjuracao, true);
  assert.equal(fighter.espacosMagia[1]?.total, 3);
  assert.equal(getMaxAvailableSpellCircle(fighter), 1);

  // Swap to Mestre da Batalha -> spellcasting & slots revoked, Dados de Superioridade + Ferramentas de Ferreiro granted
  fighter = applyInlineSubclassChange(fighter, 'mestre_batalha');
  assert.equal(fighter.espacosMagia[1]?.total, 0);
  assert.equal(fighter.visibilidade.conjuracao, false);
  assert.ok(fighter.recursosClasse.some((r) => r.id === 'dados_superioridade'));
  assert.ok(fighter.ferramentasProficiencia.some((t) => t.name === 'Ferramentas de Ferreiro'));

  // Swap to Campeão -> Mestre da Batalha tool & superiority dice cleanly removed
  fighter = applyInlineSubclassChange(fighter, 'campeao');
  assert.equal(fighter.recursosClasse.some((r) => r.id === 'dados_superioridade'), false);
  assert.equal(fighter.ferramentasProficiencia.some((t) => t.name === 'Ferramentas de Ferreiro'), false);

  // Feiticeiro Nv 5: Feitiçaria Dracônica -> +1 PV/nível and unarmored AC 10 + DES + CAR
  let sorc = applyInlineClassChange(createBlankCharacter(), 'feiticeiro');
  sorc = { ...sorc, atributos: { ...sorc.atributos, des: 14, con: 12, car: 18 }, armorId: 'nenhuma' };
  sorc = applyInlineLevelChange(sorc, 5);
  sorc = applyInlineSubclassChange(sorc, 'draconica');
  assert.equal(calculateAC(sorc).total, 16); // 10 + DES(+2) + CAR(+4)
  const draconicHp = calculateMaxHP(sorc);
  // Swap to Magia Selvagem -> reverts unarmored AC & +5 HP
  sorc = applyInlineSubclassChange(sorc, 'selvagem');
  assert.equal(calculateAC(sorc).total, 12); // 10 + DES(+2)
  assert.equal(calculateMaxHP(sorc), draconicHp - 5);

  // Bardo Nv 5: Colégio da Bravura -> Colégio da Dança -> Colégio do Conhecimento
  let bard = applyInlineClassChange(createBlankCharacter(), 'bardo');
  bard = { ...bard, atributos: { ...bard.atributos, des: 14, car: 18 }, armorId: 'nenhuma' };
  bard = applyInlineLevelChange(bard, 5);
  bard = applyInlineSubclassChange(bard, 'bravura');
  assert.equal(bard.armadurasTreinamento.media, true);
  assert.equal(bard.armadurasTreinamento.escudos, true);

  bard = applyInlineSubclassChange(bard, 'danca');
  assert.equal(bard.armadurasTreinamento.media, false);
  assert.equal(bard.armadurasTreinamento.escudos, false);
  assert.equal(bard.unarmoredFormula, 'danca');
  assert.equal(calculateAC(bard).total, 16); // 10 + DES(+2) + CAR(+4)

  bard = applyInlineSubclassChange(bard, 'conhecimento');
  assert.equal(bard.unarmoredFormula, 'padrao');
  assert.ok((bard.autoGrants?.subclassSkills.length ?? 0) === 3);
  for (const sk of bard.autoGrants?.subclassSkills ?? []) {
    assert.ok((bard.periciasProf[sk] ?? 0) >= 1);
  }
});

test('Reactive feat add & remove propagates attributes, HP, resources, skills, expertise, saves, spells, and speed without orphans or double-application', () => {
  let hero = applyInlineClassChange(createBlankCharacter(), 'guerreiro');
  hero = { ...hero, atributos: { for: 15, des: 14, con: 14, int: 10, sab: 12, car: 10 } };
  hero = applyInlineLevelChange(hero, 5);
  const baseHp = calculateMaxHP(hero);
  const baseSpeed = calculateSpeed(hero).totalMeters;

  // Add Vigoroso (+2 PV/nível), Sortudo (Pontos de Sorte = BP = 3), Veloz (+3m & +1 DES), Observador (+1 SAB + Percepção prof), Tocado pelas Fadas (+1 SAB + passo_nebuloso)
  const withFeats = reconcileCharacterSheet(hero, {
    ...hero,
    talentosIds: ['vigoroso', 'sortudo', 'veloz', 'observador', 'tocado_fadas'],
  });
  assert.equal(calculateMaxHP(withFeats), baseHp + 10);
  assert.equal(calculateSpeed(withFeats).totalMeters, baseSpeed + 3);
  assert.equal(withFeats.atributos.des, 15); // +1 from Veloz
  assert.equal(withFeats.atributos.sab, 14); // +1 Observador +1 Tocado pelas Fadas (highest qualifying mental stat)
  assert.equal(withFeats.recursosClasse.find((r) => r.id === 'feat_pontos_de_sorte')?.max, 3);
  assert.ok(withFeats.magiasPreparadasIds.includes('passo_nebuloso'));
  assert.ok((withFeats.periciasProf.percepcao ?? 0) >= 1);

  // Idempotency: reconciling a second time must NOT double-add +1 attributes!
  const reconciledTwice = reconcileCharacterSheet(withFeats, withFeats);
  assert.equal(reconciledTwice.atributos.des, 15);
  assert.equal(reconciledTwice.atributos.sab, 14);

  // Remove all those feats -> every single bonus cleanly revoked
  const cleared = reconcileCharacterSheet(reconciledTwice, {
    ...reconciledTwice,
    talentosIds: [],
  });
  assert.equal(calculateMaxHP(cleared), baseHp);
  assert.equal(calculateSpeed(cleared).totalMeters, baseSpeed);
  assert.equal(cleared.atributos.des, 14);
  assert.equal(cleared.atributos.sab, 12);
  assert.equal(cleared.recursosClasse.some((r) => r.id === 'feat_pontos_de_sorte'), false);
  assert.equal(cleared.magiasPreparadasIds.includes('passo_nebuloso'), false);
  assert.equal(cleared.periciasProf.percepcao, 0);
});

test('getSkillSources clearly attributes Antecedente, Classe, Espécie, Subclasse, and Talento skills', () => {
  let hero = applyInlineClassChange(createBlankCharacter(), 'guerreiro');
  hero = applyInlineBackgroundChange(hero, 'soldado'); // atletismo, intimidacao
  hero = applyInlineSpeciesChange(hero, 'elfo'); // percepcao
  hero = reconcileCharacterSheet(hero, {
    ...hero,
    periciasProf: { ...hero.periciasProf, sobrevivencia: 1 },
    talentosIds: [...hero.talentosIds, 'habilidoso'],
  });

  const sources = getSkillSources(hero);
  assert.ok(sources.atletismo.includes('Antecedente'));
  assert.ok(sources.intimidacao.includes('Antecedente'));
  assert.ok(sources.percepcao.includes('Espécie'));
  assert.ok(sources.sobrevivencia.includes('Classe'));
  assert.ok((hero.autoGrants?.featSkills.length ?? 0) > 0);
  for (const sk of hero.autoGrants?.featSkills ?? []) {
    assert.ok(sources[sk].includes('Talento'));
  }
});

test('Custom variables propagate across all targets with [Custom] attribution and respect enabled flag', () => {
  let hero = applyInlineClassChange(createBlankCharacter(), 'paladino');
  hero = applyInlineLevelChange(hero, 5);
  hero = {
    ...hero,
    atributos: { for: 16, des: 12, con: 14, int: 10, sab: 10, car: 16 },
    armorId: 'cota_malha',
  };
  const longsword = WEAPONS_LIST.find((w) => w.id === 'espada_longa')!;
  const atk = createAttackFromWeapon(longsword, hero);

  const baseAc = calculateAC(hero).total;
  const baseHp = calculateMaxHP(hero);
  const baseSpeed = calculateSpeed(hero).totalMeters;
  const baseInit = calculateInitiative(hero).total;
  const baseAth = calculateSkillBonus(hero, 'atletismo').total;
  const baseForSave = calculateSaveBonus(hero, 'for').total;
  const baseForCheck = calculateAbilityCheckBonus(hero, 'for').total;
  const baseAtk = calculateAttackStats(hero, atk);
  const baseSpell = calculateSpellStats(hero);

  const withCustom = {
    ...hero,
    customVariables: [
      {
        id: 'cv1',
        name: 'Bênção Global',
        source: 'Cenário',
        target: 'all_tests' as const,
        flatBonus: 1,
        description: '',
        enabled: true,
      },
      {
        id: 'cv2',
        name: 'Braçadeira Atlética',
        source: 'Item Mágico',
        target: 'skill' as const,
        subTarget: 'atletismo' as const,
        flatBonus: 3,
        description: '',
        enabled: true,
      },
      {
        id: 'cv3',
        name: 'Manto de Proteção',
        source: 'Item',
        target: 'ac' as const,
        flatBonus: 2,
        description: '',
        enabled: true,
      },
      {
        id: 'cv4',
        name: 'Botas Aladas',
        source: 'Item',
        target: 'speed' as const,
        flatBonus: 3,
        description: '',
        enabled: true,
      },
      {
        id: 'cv5',
        name: 'Amuleto Vital',
        source: 'Homebrew',
        target: 'hp' as const,
        flatBonus: 12,
        description: '',
        enabled: true,
      },
      {
        id: 'cv6',
        name: 'Lâmina Flamejante',
        source: 'Item Mágico',
        target: 'damage' as const,
        flatBonus: 2,
        diceFormula: '1d6',
        damageType: 'Ígneo',
        description: '',
        enabled: true,
      },
      {
        id: 'cv7',
        name: 'Foco Arcano +1',
        source: 'Item',
        target: 'spell_dc' as const,
        flatBonus: 1,
        description: '',
        enabled: true,
      },
      {
        id: 'cv8',
        name: 'Desativado',
        source: 'Teste',
        target: 'skill' as const,
        subTarget: 'atletismo' as const,
        flatBonus: 99,
        description: '',
        enabled: false,
      },
    ],
  };

  assert.equal(calculateAC(withCustom).total, baseAc + 2);
  assert.equal(calculateMaxHP(withCustom), baseHp + 12);
  assert.equal(calculateSpeed(withCustom).totalMeters, baseSpeed + 3);
  assert.equal(calculateInitiative(withCustom).total, baseInit + 1); // all_tests

  const athRes = calculateSkillBonus(withCustom, 'atletismo');
  assert.equal(athRes.total, baseAth + 1 + 3); // all_tests + atletismo (disabled ignored)
  assert.ok(athRes.breakdown.some((b) => b.isCustom && b.label.includes('[Custom')));

  assert.equal(calculateSaveBonus(withCustom, 'for').total, baseForSave + 1);
  assert.equal(calculateAbilityCheckBonus(withCustom, 'for').total, baseForCheck + 1);

  const atkRes = calculateAttackStats(withCustom, atk);
  assert.equal(atkRes.attackBonus, baseAtk.attackBonus + 1);
  assert.equal(atkRes.damageBonus, baseAtk.damageBonus + 2);
  assert.ok(atkRes.damageBreakdown.some((b) => b.isCustom));

  const spellRes = calculateSpellStats(withCustom);
  assert.equal(spellRes.spellAttackBonus, baseSpell.spellAttackBonus + 1);
  assert.equal(spellRes.spellSaveDc, baseSpell.spellSaveDc + 1);
});

test('Combined damage engine lists class/spell/custom extras and doubles dice on critical hit', () => {
  let paladin = applyInlineClassChange(createBlankCharacter(), 'paladino');
  paladin = applyInlineLevelChange(paladin, 5);
  paladin = {
    ...paladin,
    customVariables: [
      {
        id: 'cv_fire',
        name: 'Runa Ígnea',
        source: 'Cenário',
        target: 'damage',
        flatBonus: 0,
        diceFormula: '1d6',
        damageType: 'Ígneo',
        description: '',
        enabled: true,
      },
    ],
  };

  const options = getAvailableExtraDamageOptions(paladin);
  assert.ok(options.some((o) => o.id === 'extra_destruicao_divina'));
  // Paladino sem Marca do Predador preparada não deve ver Marca do Predador nem Bruxaria
  assert.equal(options.some((o) => o.id === 'extra_marca_cacador'), false);
  assert.equal(options.some((o) => o.id === 'extra_bruxaria'), false);
  assert.ok(options.some((o) => o.id === 'extra_custom_cv_fire' && o.isCustom));

  const smite = options.find((o) => o.id === 'extra_destruicao_divina')!;
  const rune = options.find((o) => o.id === 'extra_custom_cv_fire')!;

  // Deterministic rng returning 0.5 -> d8 rolls 5, d6 rolls 4
  const fixedRng = () => 0.5;
  const normalRoll = executeCombinedDamageRoll({
    baseDamage: {
      title: 'Espada Longa',
      formula: '1d8',
      bonus: 3,
      damageType: 'Cortante',
      breakdown: [{ label: 'Mod. FOR', value: 3 }],
    },
    includeBaseDamage: true,
    selectedExtras: [smite, rune],
    isCrit: false,
    rng: fixedRng,
  });
  assert.equal(normalRoll.critDoubled, false);
  assert.equal(normalRoll.parts.length, 3);
  assert.equal(normalRoll.parts[0].total, 8); // 5 + 3
  assert.equal(normalRoll.parts[1].total, 10); // 2d8 (5+5)
  assert.equal(normalRoll.parts[2].total, 4); // 1d6 (4)
  assert.equal(normalRoll.total, 22);

  const critRoll = executeCombinedDamageRoll({
    baseDamage: {
      title: 'Espada Longa',
      formula: '1d8',
      bonus: 3,
      damageType: 'Cortante',
      breakdown: [{ label: 'Mod. FOR', value: 3 }],
    },
    includeBaseDamage: true,
    selectedExtras: [smite, rune],
    isCrit: true,
    rng: fixedRng,
  });
  assert.equal(critRoll.critDoubled, true);
  assert.equal(critRoll.parts[0].total, 13); // 2d8 (10) + 3
  assert.equal(critRoll.parts[1].total, 20); // 4d8 (20)
  assert.equal(critRoll.parts[2].total, 8); // 2d6 (8)
  assert.equal(critRoll.total, 41);
});

test('Max starting gold, cost parsing, and coin deduction with price multipliers work accurately', () => {
  // Guerreiro (155 PO) + Soldado (50 PO) = 205 PO
  assert.equal(calculateMaxStartingGold('guerreiro', 'soldado'), 205);
  assert.equal(parseCostToCopper('15 PO'), 1500);
  assert.equal(parseCostToCopper('5 PP'), 50);
  assert.equal(parseCostToCopper('2 PC'), 2);
  assert.equal(parseCostToCopper('1 PL'), 1000);
  assert.equal(formatCopperToCoinsLabel(750), '7 PO 5 PP');
  assert.equal(formatCopperToCoinsLabel(155), '1 PO 5 PP 5 PC');

  // 15 PO item at 0.5x discount = 7.5 PO = 750 PC deducted from 205 PO -> 197 PO, 5 PP
  const bag = { pc: 0, pp: 0, pe: 0, po: 205, pl: 0 };
  const discountCost = Math.round(parseCostToCopper('15 PO') * 0.5);
  const resHalf = deductCopperFromCoins(bag, discountCost);
  assert.equal(resHalf.insufficient, false);
  assert.equal(resHalf.moedas.po, 197);
  assert.equal(resHalf.moedas.pp, 5);
  assert.equal(resHalf.moedas.pc, 0);

  // 10 PO item at 1.5x markup = 15 PO deducted from 197 PO, 5 PP -> 182 PO, 5 PP
  const markupCost = Math.round(parseCostToCopper('10 PO') * 1.5);
  const resMarkup = deductCopperFromCoins(resHalf.moedas, markupCost);
  assert.equal(resMarkup.insufficient, false);
  assert.equal(resMarkup.moedas.po, 182);
  assert.equal(resMarkup.moedas.pp, 5);

  // Insufficient funds -> zeros out coins cleanly and reports deficit
  const poorBag = { pc: 0, pp: 0, pe: 0, po: 5, pl: 0 };
  const resPoor = deductCopperFromCoins(poorBag, 1200);
  assert.equal(resPoor.insufficient, true);
  assert.equal(resPoor.moedas.po, 0);
  assert.equal(resPoor.missingCp, 700);
});

test('Fey Wanderer (Andarilho Feérico) Golpes Terríveis uses +1d4 Psíquico (Nv 3-10) and +1d6 Psíquico (Nv 11-20) without Hex cross-contamination', () => {
  let ranger = applyInlineClassChange(createBlankCharacter(), 'guardiao');
  ranger = applyInlineLevelChange(ranger, 3);
  ranger = applyInlineSubclassChange(ranger, 'andarilho_feerico');

  const optsLv3 = getAvailableExtraDamageOptions(ranger);
  const dreadfulLv3 = optsLv3.find((o) => o.id === 'extra_golpes_terriveis');
  assert.ok(dreadfulLv3, 'Expected Golpes Terríveis at level 3');
  assert.equal(dreadfulLv3.diceFormula, '1d4');
  assert.equal(dreadfulLv3.damageType, 'Psíquico');
  assert.equal(optsLv3.some((o) => o.id === 'extra_bruxaria'), false, 'Guardião must not receive Bruxaria/Hex unless prepared');

  const huntersMarkLv3 = optsLv3.find((o) => o.id === 'extra_marca_cacador');
  assert.ok(huntersMarkLv3);
  assert.equal(huntersMarkLv3.diceFormula, '1d6');

  // Nv 10 still +1d4 Psíquico
  const rangerLv10 = applyInlineLevelChange(ranger, 10);
  const dreadfulLv10 = getAvailableExtraDamageOptions(rangerLv10).find((o) => o.id === 'extra_golpes_terriveis');
  assert.equal(dreadfulLv10?.diceFormula, '1d4');

  // Nv 11 upgrades to +1d6 Psíquico
  const rangerLv11 = applyInlineLevelChange(ranger, 11);
  const dreadfulLv11 = getAvailableExtraDamageOptions(rangerLv11).find((o) => o.id === 'extra_golpes_terriveis');
  assert.equal(dreadfulLv11?.diceFormula, '1d6');
  assert.equal(dreadfulLv11?.damageType, 'Psíquico');

  // Nv 20 upgrades Marca do Predador to 1d10 while Golpes Terríveis stays 1d6
  const rangerLv20 = applyInlineLevelChange(ranger, 20);
  const optsLv20 = getAvailableExtraDamageOptions(rangerLv20);
  assert.equal(optsLv20.find((o) => o.id === 'extra_golpes_terriveis')?.diceFormula, '1d6');
  assert.equal(optsLv20.find((o) => o.id === 'extra_marca_cacador')?.diceFormula, '1d10');

  // Bruxo receives Bruxaria (+1d6 Necrótico), not Golpes Terríveis
  const warlock = applyInlineLevelChange(applyInlineClassChange(createBlankCharacter(), 'bruxo'), 3);
  const warlockOpts = getAvailableExtraDamageOptions(warlock);
  assert.ok(warlockOpts.some((o) => o.id === 'extra_bruxaria' && o.diceFormula === '1d6'));
  assert.equal(warlockOpts.some((o) => o.id === 'extra_golpes_terriveis'), false);
});

test('Synchronous getHydratedCompendiums embeds all 12 classes, >300 spells, and creatures without "bloco" UI text', () => {
  const comp = getHydratedCompendiums();
  assert.equal(comp.classes.length, 12);
  assert.ok(comp.spells.length >= 300, `Expected >=300 embedded spells, got ${comp.spells.length}`);
  assert.ok(comp.creatures.length >= 20, `Expected >=20 embedded creatures, got ${comp.creatures.length}`);

  for (const cls of comp.classes) {
    assert.equal(cls.progressionTable?.rows.length, 20, `${cls.id} must have 20 progression rows`);
    for (const sec of cls.extraSections ?? []) {
      assert.equal(/\bbloco(s)?\b/i.test(sec.title), false, `Forbidden word "bloco" in ${cls.id} section title: ${sec.title}`);
    }
    for (const sub of cls.subclasses) {
      for (const sec of sub.extraSections ?? []) {
        assert.equal(/\bbloco(s)?\b/i.test(sec.title), false, `Forbidden word "bloco" in ${sub.id} section title: ${sec.title}`);
      }
    }
  }
});

test('buildWeaponRuleHelp and live glossary search expand Recarga, Adaptável/Versátil, Leve, Acuidade, Maestria, and core combat rules cleanly', () => {
  const longswordHelp = buildWeaponRuleHelp({
    name: 'Espada Longa',
    range: 'Corpo a corpo (1,5 m)',
    damageLabel: '1d8 + 3',
    damageType: 'Cortante',
    properties: ['Versátil (1d10)'],
    mastery: 'Derrubar',
  });
  assert.ok(/Maestria — Derrubar/i.test(longswordHelp.body));
  assert.ok(longswordHelp.tips.some((t) => /Versátil/i.test(t) && /duas mãos/i.test(t)));

  const crossbowHelp = buildWeaponRuleHelp({
    name: 'Besta Leve',
    range: '24/96 m',
    damageLabel: '1d8 + 2',
    damageType: 'Perfurante',
    properties: ['Munição (24/96 m)', 'Recarga', 'Duas Mãos'],
    mastery: 'Lentidão',
  });
  assert.ok(/Maestria — Lentidão/i.test(crossbowHelp.body));
  assert.ok(crossbowHelp.tips.some((t) => /Recarga:/i.test(t) && /1 munição/i.test(t)));
  assert.ok(crossbowHelp.tips.some((t) => /Munição/i.test(t)));
  assert.ok(crossbowHelp.tips.some((t) => /Duas Mãos:/i.test(t)));

  const allEntries = getSearchableGlossary();
  assert.ok(allEntries.length >= 60, `Expected rich glossary (>=60 entries), got ${allEntries.length}`);
  for (const e of allEntries) {
    assert.equal(/\bbloco(s)?\b/i.test(`${e.title} ${e.body}`), false, `Forbidden word "bloco" in glossary entry ${e.id}`);
  }

  // Accent-insensitive live search
  const recargaHits = searchGlossaryEntries('recarga');
  assert.ok(recargaHits.some((e) => e.id === 'wp_recarga'));

  const adaptavelHits = searchGlossaryEntries('adaptavel');
  assert.ok(adaptavelHits.some((e) => e.id === 'wp_adaptavel'));

  const acaoBonusHits = searchGlossaryEntries('acao bonus');
  assert.ok(acaoBonusHits.some((e) => /Ação Bônus/i.test(e.title)));

  const maestriaHits = searchGlossaryEntries('derrubar');
  assert.ok(maestriaHits.some((e) => e.id.startsWith('wm_')));
});

test('Full unabridged descriptions for spells (multi-line & Material components), all 74 feats, and all 18 skills', () => {
  const comp = getHydratedCompendiums();

  // 1. Multi-line spells preserve ALL bullet options AND real Material components
  const alarme = comp.spells.find((s) => s.id === 'alarme');
  assert.ok(alarme, 'Expected spell alarme');
  assert.ok(/sino/i.test(alarme.components), `Expected Material component in alarme, got: ${alarme.components}`);
  assert.ok(/Audível:/i.test(alarme.description), 'Expected Audível bullet preserved');
  assert.ok(/Mental:/i.test(alarme.description), 'Expected Mental bullet preserved');

  const alterarSe = comp.spells.find((s) => s.id === 'alterar_se');
  assert.ok(alterarSe, 'Expected spell alterar_se');
  assert.ok(/Adaptação Aquática/i.test(alterarSe.description));
  assert.ok(/Mudar Aparência/i.test(alterarSe.description));
  assert.ok(/Armas Naturais/i.test(alterarSe.description));

  const spellHelp = buildSpellRuleHelp(alarme);
  assert.ok(/Tempo de Conjuração:/i.test(spellHelp.body));
  assert.ok(/Componentes:.*sino/i.test(spellHelp.body));
  assert.ok(/Audível:/i.test(spellHelp.body));
  assert.ok(/Mental:/i.test(spellHelp.body));
  assert.equal(/\bbloco(s)?\b/i.test(`${spellHelp.body} ${spellHelp.tips.join(' ')}`), false);

  // 2. All 74 official feats hydrated with full unabridged text
  assert.ok(comp.feats.length >= 74, `Expected >=74 hydrated feats, got ${comp.feats.length}`);
  const artifista = comp.feats.find((f) => f.id === 'artifista');
  assert.ok(artifista, 'Expected feat artifista');
  const artifistaHelp = buildFeatRuleHelp(artifista);
  assert.ok(/Desconto/i.test(artifistaHelp.body));
  assert.ok(/Fabricação Rápida/i.test(artifistaHelp.body));
  assert.ok(/Ferramentas de Carpinteiro|Ferramentas de Ferreiro/i.test(artifistaHelp.body));

  const alerta = comp.feats.find((f) => f.id === 'alerta');
  assert.ok(alerta, 'Expected feat alerta');
  const alertaHelp = buildFeatRuleHelp(alerta);
  assert.ok(/Troca de Iniciativa/i.test(alertaHelp.body));
  assert.equal(/\bbloco(s)?\b/i.test(`${artifistaHelp.body} ${alertaHelp.body}`), false);

  // 3. All 18 skills have detailed practical D&D 2024 rules and tips
  const skillKeys = Object.keys(SKILL_RULE_HELP) as (keyof typeof SKILL_RULE_HELP)[];
  assert.equal(skillKeys.length, 18);
  for (const k of skillKeys) {
    const entry = SKILL_RULE_HELP[k];
    assert.ok(entry.body.length >= 90, `Skill ${k} description too brief: ${entry.body}`);
    assert.ok((entry.tips?.length ?? 0) >= 1, `Skill ${k} missing practical tips`);
    assert.equal(/\bbloco(s)?\b/i.test(`${entry.body} ${(entry.tips ?? []).join(' ')}`), false);
  }
  assert.ok(/CD 15/i.test(SKILL_RULE_HELP.furtividade.tips?.join(' ') ?? ''));
});

test('Spell test detection, auto-linking into Testes, spell slot/daily-use sync, and class prep caps work cohesively', () => {
  const comp = getHydratedCompendiums();
  const findSpell = (id: string) => {
    const sp = comp.spells.find((s) => s.id === id);
    assert.ok(sp, `Expected spell ${id} in compendium`);
    return sp;
  };

  const fireBolt = findSpell('raio_de_fogo'); // Cantrip attack + damage
  const fireball = findSpell('bola_de_fogo'); // 3rd-circle save + damage
  const calmEmotions = findSpell('acalmar_emocoes'); // 2nd-circle save-only + concentration
  const alarm = findSpell('alarme'); // Utility (no test)

  assert.equal(spellRequiresTest(fireBolt), true);
  assert.equal(spellRequiresTest(fireball), true);
  assert.equal(spellRequiresTest(calmEmotions), true);
  assert.equal(spellRequiresTest(alarm), false);

  // Auto-linking into testesSelecionadosIds on prepare/unprepare
  let selected: string[] = [];
  selected = syncAutoLinkedSpellTests(selected, fireBolt, true);
  selected = syncAutoLinkedSpellTests(selected, calmEmotions, true);
  selected = syncAutoLinkedSpellTests(selected, alarm, true);
  assert.ok(selected.includes(`test_spell_${fireBolt.id}`));
  assert.ok(selected.includes(`test_spell_${calmEmotions.id}`));
  assert.equal(selected.includes(`test_spell_${alarm.id}`), false);

  selected = syncAutoLinkedSpellTests(selected, calmEmotions, false);
  assert.equal(selected.includes(`test_spell_${calmEmotions.id}`), false);

  // Class spell preparation limits from official progression table
  let mage = applyInlineLevelChange(applyInlineClassChange(createBlankCharacter(), 'mago'), 5);
  const mageLimits = getClassSpellPrepLimits(mage, comp.classes);
  assert.equal(mageLimits.cantripsMax, 4);
  assert.equal(mageLimits.preparedMax, 9);

  const ranger = applyInlineLevelChange(applyInlineClassChange(createBlankCharacter(), 'guardiao'), 5);
  const rangerLimits = getClassSpellPrepLimits(ranger, comp.classes);
  assert.equal(rangerLimits.preparedMax, 6);

  // Consuming a leveled spell cast consumes 1 slot, increments magiasUsosHoje, and activates concentration if applicable
  assert.equal(mage.espacosMagia[2]?.used, 0);
  mage = consumeSpellCast(mage, calmEmotions);
  assert.equal(mage.espacosMagia[2]?.used, 1);
  assert.equal(mage.magiasUsosHoje?.[calmEmotions.id], 1);
  assert.equal(mage.concentrandoEm, calmEmotions.name);

  // Manual +1 / -1 adjustment syncs both magiasUsosHoje and spell slots
  mage = adjustSpellDailyUse(mage, fireball, 1);
  assert.equal(mage.espacosMagia[3]?.used, 1);
  assert.equal(mage.magiasUsosHoje?.[fireball.id], 1);

  mage = adjustSpellDailyUse(mage, fireball, -1);
  assert.equal(mage.espacosMagia[3]?.used, 0);
  assert.equal(mage.magiasUsosHoje?.[fireball.id], undefined);

  // Cantrip cast increments daily uses without touching leveled spell slots
  const slotsBeforeCantrip = mage.espacosMagia[1]?.used;
  mage = consumeSpellCast(mage, fireBolt);
  assert.equal(mage.magiasUsosHoje?.[fireBolt.id], 1);
  assert.equal(mage.espacosMagia[1]?.used, slotsBeforeCantrip);

  // Long Rest resets magiasUsosHoje and all spell slots
  const rested = applyLongRest(mage);
  assert.deepEqual(rested.magiasUsosHoje, {});
  assert.equal(rested.espacosMagia[2]?.used, 0);
});

test('Countable equipment detection automatically surfaces ammo, rations, torches, and consumables while ignoring non-consumable gear and starter kits', () => {
  const sheet = {
    ...createBlankCharacter(),
    equipamentos: [
      { id: 'eq_1', name: 'Balas de Fogo', quantity: 10, weightKg: 0.1 },
      { id: 'eq_2', name: 'Flechas (20)', quantity: 20, weightKg: 0.025 },
      { id: 'eq_3', name: 'Ração (1 dia)', quantity: 5, weightKg: 1 },
      { id: 'eq_4', name: 'Tocha', quantity: 4, weightKg: 0.5 },
      { id: 'eq_5', name: 'Poção de Cura', quantity: 2, weightKg: 0.25 },
      { id: 'eq_6', name: 'Kit de Curandeiro', quantity: 10, weightKg: 0.15 },
      { id: 'eq_7', name: 'Dardo', quantity: 6, weightKg: 0.12 },
      { id: 'eq_8', name: 'Kit de Aventureiro', quantity: 1, weightKg: 18 },
      { id: 'eq_9', name: 'Corda (15 m)', quantity: 1, weightKg: 2.5 },
      { id: 'eq_10', name: 'Espada Longa', quantity: 1, weightKg: 1.5 },
      { id: 'eq_11', name: 'Virotes de Besta', quantity: 0, weightKg: 0.03 },
    ],
  };

  assert.equal(classifyCountableInventoryItem(sheet.equipamentos[0]).categoryLabel, 'Munição');
  assert.equal(classifyCountableInventoryItem(sheet.equipamentos[2]).categoryLabel, 'Suprimento');
  assert.equal(classifyCountableInventoryItem(sheet.equipamentos[4]).categoryLabel, 'Consumível');
  assert.equal(classifyCountableInventoryItem(sheet.equipamentos[6]).categoryLabel, 'Arremesso');
  assert.equal(classifyCountableInventoryItem(sheet.equipamentos[7]).isCountable, false);
  assert.equal(classifyCountableInventoryItem(sheet.equipamentos[8]).isCountable, false);
  assert.equal(classifyCountableInventoryItem(sheet.equipamentos[9]).isCountable, false);

  const countable = getCountableEquipmentItems(sheet);
  const countableIds = countable.map((c) => c.item.id);
  assert.deepEqual(countableIds, ['eq_1', 'eq_2', 'eq_3', 'eq_4', 'eq_5', 'eq_6', 'eq_7', 'eq_11']);

  // Zero-quantity countable item weighs 0 kg (not 1x)
  const zeroWeightOnly = {
    ...createBlankCharacter(),
    equipamentos: [{ id: 'z1', name: 'Balas de Fogo', quantity: 0, weightKg: 2 }],
  };
  assert.equal(calculateTotalWeightKg(zeroWeightOnly), 0);
});

