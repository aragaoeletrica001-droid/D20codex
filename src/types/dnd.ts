export type AbilityKey = 'for' | 'des' | 'con' | 'int' | 'sab' | 'car';

export type SkillKey =
  | 'acrobacia'
  | 'arcanismo'
  | 'atletismo'
  | 'atuacao'
  | 'enganacao'
  | 'furtividade'
  | 'historia'
  | 'intimidacao'
  | 'intuicao'
  | 'investigacao'
  | 'lidar_com_animais'
  | 'medicina'
  | 'natureza'
  | 'percepcao'
  | 'persuasao'
  | 'prestidigitacao'
  | 'religiao'
  | 'sobrevivencia';

export type ProficiencyMultiplier = 0 | 1 | 2;

export type CreatureSize = 'Miúdo' | 'Pequeno' | 'Médio' | 'Grande' | 'Enorme' | 'Colossal';

export type ConditionId =
  | 'agarrado'
  | 'amedrontado'
  | 'atordoado'
  | 'caido'
  | 'cego'
  | 'contido'
  | 'enfeiticado'
  | 'envenenado'
  | 'incapacitado'
  | 'inconsciente'
  | 'invisivel'
  | 'paralisado'
  | 'petrificado'
  | 'surdo';

export type ArmorCategory = 'Nenhuma' | 'Leve' | 'Média' | 'Pesada';

export type SpellcastingProgression = 'full' | 'half' | 'third' | 'pact' | 'none';

export type RollMode = 'normal' | 'vantagem' | 'desvantagem';

export type RollKind =
  | 'ability'
  | 'save'
  | 'skill'
  | 'initiative'
  | 'attack'
  | 'damage'
  | 'hit_die'
  | 'death_save'
  | 'tool'
  | 'spell_ability'
  | 'spell_attack'
  | 'custom';

export interface SkillDefinition {
  key: SkillKey;
  label: string;
  ability: AbilityKey;
}

export interface AbilityDefinition {
  key: AbilityKey;
  label: string;
  shortLabel: string;
  skills: SkillKey[];
}

export type ClassFeatureCategory =
  | 'Combate'
  | 'Conjuração'
  | 'Recurso'
  | 'Defesa'
  | 'Exploração'
  | 'Evolução';

export interface ClassFeature {
  level: number;
  name: string;
  description: string;
  details?: string[];
  category?: ClassFeatureCategory;
  source?: 'classe' | 'subclasse';
}

export interface ClassExtraSection {
  title: string;
  items: string[];
}

export interface ClassResourceTemplate {
  id: string;
  name: string;
  resetOn: 'curto' | 'longo' | 'curto_1_longo_todos';
  resetOnByLevel?: Record<number, 'curto' | 'longo' | 'curto_1_longo_todos'>;
  formula: 'table' | 'mod_car' | 'mod_sab' | 'mod_int' | 'bp' | 'level' | 'level_plus_1' | 'level_x5' | 'fixed';
  fixedMax?: number;
  byLevel?: Record<number, number>;
  minLevel?: number;
  dieByLevel?: Record<number, string>;
  description: string;
}

export interface SubclassDefinition {
  id: string;
  name: string;
  summary: string;
  grantsSpellcasting?: {
    progression: SpellcastingProgression;
    ability: AbilityKey;
    spellListClassId: string;
    cantripsByLevel?: Record<number, number>;
  };
  alwaysPreparedSpells?: Record<number, string[]>;
  resources?: ClassResourceTemplate[];
  extraSections?: ClassExtraSection[];
  features: ClassFeature[];
}

export interface ClassDefinition {
  id: string;
  name: string;
  hitDie: 6 | 8 | 10 | 12;
  primaryAbilities: AbilityKey[];
  suggestedStandardArray: Record<AbilityKey, number>;
  savingThrows: AbilityKey[];
  skillCount: number;
  skillChoices: SkillKey[] | 'any';
  armorTraining: {
    leve: boolean;
    media: boolean;
    pesada: boolean;
    escudos: boolean;
  };
  weaponProficiencies: string;
  toolProficiencies: string[];
  startingEquipmentA: string[];
  startingGoldA: number;
  startingGoldB: number;
  startingEquipmentText?: string;
  multiclassGains?: string;
  alwaysPreparedSpells?: Record<number, string[]>;
  spellcasting: {
    progression: SpellcastingProgression;
    ability: AbilityKey | null;
    focus?: string;
    cantripsByLevel?: Record<number, number>;
    preparedByLevel?: Record<number, number>;
    ritualCasting?: boolean;
  };
  weaponMasteriesByLevel?: Record<number, number>;
  progressionTable?: {
    headers: string[];
    rows: string[][];
  };
  extraSections?: ClassExtraSection[];
  resources: ClassResourceTemplate[];
  features: ClassFeature[];
  subclasses: SubclassDefinition[];
}

export interface SpeciesResourceTemplate {
  id: string;
  name: string;
  resetOn: 'curto' | 'longo';
  formula: 'bp' | 'fixed';
  fixedMax?: number;
  minLevel?: number;
  onlyForSubOptionId?: string;
  description: string;
}

export interface SpeciesSubOption {
  id: string;
  name: string;
  summary: string;
  speedOverride?: number;
  darkvisionOverride?: number;
  damageResistance?: string;
  innateSpellsByLevel?: Record<number, string[]>;
}

export interface SpeciesDefinition {
  id: string;
  name: string;
  creatureType: string;
  sizes: CreatureSize[];
  sizeNote?: string;
  speed: number;
  darkvision?: number;
  innateSpells?: string[];
  innateSpellsByLevel?: Record<number, string[]>;
  subOptionLabel?: string;
  subOptions?: SpeciesSubOption[];
  speciesResources?: SpeciesResourceTemplate[];
  traits: { name: string; description: string }[];
}

export interface BackgroundDefinition {
  id: string;
  name: string;
  abilityOptions: AbilityKey[];
  originFeatId: string;
  originFeatLabel: string;
  skills: SkillKey[];
  tool: string;
  startingEquipment: string[];
  startingGold: number;
  optionBGold: number;
  description: string;
}

export interface FeatDefinition {
  id: string;
  name: string;
  category: 'Origem' | 'Geral' | 'Estilo de Luta' | 'Dádiva Épica';
  prerequisite?: string;
  repeatable?: boolean;
  summary: string;
  benefits: string[];
  grantsSpellcasting?: boolean;
}

export interface WeaponDefinition {
  id: string;
  name: string;
  category: 'Simples Corpo a Corpo' | 'Simples à Distância' | 'Marcial Corpo a Corpo' | 'Marcial à Distância';
  damageDice: string;
  damageType: string;
  versatileDice?: string;
  properties: string[];
  mastery: string;
  weightKg: number;
  cost: string;
  isRanged: boolean;
  isFinesse: boolean;
  isHeavy: boolean;
  isLight: boolean;
  isThrown: boolean;
  range?: string;
}

export interface ArmorDefinition {
  id: string;
  name: string;
  category: ArmorCategory;
  baseAc: number;
  dexCap: number | null; // null = unlimited, 0 = none, 2 = max +2
  minStrength?: number;
  stealthDisadvantage: boolean;
  weightKg: number;
  cost: string;
}

export interface SpellDefinition {
  id: string;
  name: string;
  level: number; // 0 = Truque, 1..9
  school: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  materialSpecific: boolean;
  classes: string[];
  description: string;
  higherLevels?: string;
  attackType?: 'melee' | 'ranged' | 'save' | 'auto' | 'none';
  saveAbility?: AbilityKey;
  damageFormula?: string;
  damageType?: string;
  healingFormula?: string;
}

export interface CreatureStatBlock {
  id: string;
  name: string;
  typeSize: string;
  cr: string;
  ac: number;
  hp: string;
  speed: string;
  abilities: Record<AbilityKey, number>;
  skills?: string;
  senses: string;
  languages: string;
  traits: string[];
  actions: string[];
}

export interface ConditionDefinition {
  id: ConditionId;
  name: string;
  shortEffect: string;
  rules: string[];
  imposesDisadvantageOnAttacks?: boolean;
  imposesAdvantageOnAttacks?: boolean;
  imposesDisadvantageOnAbilityChecks?: boolean;
  imposesDisadvantageOnDexSaves?: boolean;
  autoFailsStrDexSaves?: boolean;
  imposesDisadvantageOnInitiative?: boolean;
  imposesAdvantageOnInitiative?: boolean;
  zeroSpeed?: boolean;
  incapacitated?: boolean;
}

export interface AttackEntry {
  id: string;
  weaponId?: string;
  spellId?: string;
  name: string;
  kind: 'weapon' | 'cantrip' | 'spell' | 'unarmed' | 'custom';
  ability: AbilityKey | 'spell';
  proficient: boolean;
  customAttackBonus: number;
  isSaveDc?: boolean;
  saveAbility?: AbilityKey;
  damageDice: string;
  damageBonusOverride?: number | null;
  damageType: string;
  range: string;
  properties: string[];
  mastery?: string;
  masteryActive?: boolean;
  notes: string;
}

export interface ClassResourceState {
  id: string;
  name: string;
  current: number;
  max: number;
  die?: string;
  resetOn: 'curto' | 'longo' | 'curto_1_longo_todos';
  description: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  weightKg: number;
  cost?: string;
  properties?: string;
  description?: string;
  notes?: string;
  equipped?: boolean;
  purchased?: boolean;
  priceMultiplier?: number;
  paidCopper?: number;
  countable?: boolean;
}

export interface CustomFeatEntry {
  id: string;
  name: string;
  category: 'Origem' | 'Geral' | 'Estilo de Luta' | 'Dádiva Épica' | 'Homebrew / Cenário';
  source: string;
  prerequisite?: string;
  summary: string;
  benefits: string[];
}

export type CustomVariableTarget =
  | 'all_tests'
  | 'attack'
  | 'damage'
  | 'save'
  | 'ability'
  | 'skill'
  | 'initiative'
  | 'spell_attack'
  | 'spell_dc'
  | 'ac'
  | 'speed'
  | 'hp';

export interface CustomVariableModifier {
  id: string;
  name: string;
  source: string;
  target: CustomVariableTarget;
  subTarget?: AbilityKey | SkillKey;
  flatBonus: number;
  diceFormula?: string;
  damageType?: string;
  description: string;
  enabled: boolean;
}

export interface ExtraDamageOption {
  id: string;
  label: string;
  source: string;
  diceFormula?: string;
  flatBonus?: number;
  damageType: string;
  description: string;
  defaultChecked?: boolean;
  isCustom?: boolean;
  scalableBySlot?: {
    minCircle: number;
    maxCircle: number;
    baseDiceCount: number;
    dieSides: number;
    extraDicePerCircle: number;
  };
}

export interface AttunedItemSlot {
  id: string;
  name: string;
  active: boolean;
  notes: string;
}

export interface SpellSlotTracker {
  total: number;
  used: number;
}

export interface ToolProficiency {
  id: string;
  name: string;
  defaultAbility: AbilityKey;
  synergySkill?: SkillKey;
}

export interface SubBlockVisibility {
  conjuracao: boolean;
  recursos_classe: boolean;
  condicoes: boolean;
  companheiro: boolean;
  sintonizacao: boolean;
}

export type SkillSourceKind = 'Antecedente' | 'Classe' | 'Espécie' | 'Subclasse' | 'Talento';

export interface SheetAutoGrants {
  subclassSkills: SkillKey[];
  subclassTools: string[];
  subclassLanguages: string[];
  subclassArmor: Partial<Record<'leve' | 'media' | 'pesada' | 'escudos', boolean>>;
  subclassWeaponText?: string;
  subclassSpells: string[];
  subclassUnarmored?: CharacterSheet['unarmoredFormula'];
  subclassSpellAbility?: AbilityKey;

  featSkills: SkillKey[];
  featExpertise: SkillKey[];
  featTools: string[];
  featLanguages: string[];
  featSaves: AbilityKey[];
  featSpells: string[];
  featAttributeBonuses: Partial<Record<AbilityKey, number>>;
  featAttributeChoices: Record<string, AbilityKey>;
  featSpellAbility?: AbilityKey;
  featResources: string[];

  speciesSpells: string[];
  speciesSkills: SkillKey[];
  speciesLanguages: string[];

  classSpells: string[];
  classTools: string[];

  backgroundSkills: SkillKey[];
  backgroundFeatId?: string;
  backgroundToolId?: string;
}

export interface CharacterSheet {
  id: string;
  version: number;
  updatedAt: string;

  // Cabeçalho e Identidade
  nome: string;
  classeId: string;
  subclasseId: string;
  nivel: number;
  xp: number;
  especieId: string;
  especieOpcaoId?: string;
  tamanho: CreatureSize;
  antecedenteId: string;
  antecedenteEquipOpcao?: 'A' | 'B';
  alinhamento: string;
  idiomas: string[];
  aparencia: string;
  historia: string;
  retratoDataUrl?: string;
  testesSelecionadosIds?: string[];

  // Combate e Status
  armorId: string;
  escudoEquipado: boolean;
  caBonusManual: number;
  unarmoredFormula: 'padrao' | 'barbaro' | 'monge' | 'draconico' | 'danca' | 'armadura_arcana' | 'pele_arvore';
  iniciativaBonusManual: number;
  deslocamentoBonusManual: number;
  inspiracaoHeroica: boolean;
  hpMode?: 'media' | 'rolagem';
  hpRolledPerLevel?: Record<number, number>;
  pvAtual: number;
  pvMax: number;
  pvMaxManualOverride: number | null;
  pvTemp: number;
  dvGasto: number;
  morteSucessos: number;
  morteFalhas: number;

  // Condições & Exaustão
  condicoesAtivas: ConditionId[];
  nivelExaustao: number; // 0..6
  concentrandoEm: string;

  // Atributos, Salvaguardas e Perícias
  atributos: Record<AbilityKey, number>;
  salvaguardasProf: Record<AbilityKey, boolean>;
  periciasProf: Record<SkillKey, ProficiencyMultiplier>;

  // Treinamentos e Proficiências
  armadurasTreinamento: {
    leve: boolean;
    media: boolean;
    pesada: boolean;
    escudos: boolean;
  };
  armasProficiencia: string;
  ferramentasProficiencia: ToolProficiency[];

  // Armas e Truques de Dano
  ataques: AttackEntry[];

  // Recursos, Talentos, Variáveis Customizadas e Notas de Características
  recursosClasse: ClassResourceState[];
  recursosEspecie?: ClassResourceState[];
  talentosIds: string[];
  customFeats?: CustomFeatEntry[];
  customVariables?: CustomVariableModifier[];
  notasCaracteristicas: string;

  // Conjuração
  conjuracaoAtributo: AbilityKey | null;
  espacosMagia: Record<number, SpellSlotTracker>; // 1..9
  espacosPacto: { total: number; used: number; slotLevel: number };
  magiasPreparadasIds: string[];
  magiasConhecidasIds: string[];
  magiasUsosHoje?: Record<string, number>;

  // Equipamento, Sintonização, Companheiro & Moedas
  equipamentos: InventoryItem[];
  sintonizacao: AttunedItemSlot[];
  companheiroId: string | null;
  companheiroPvAtual: number;
  moedas: {
    pc: number;
    pp: number;
    pe: number;
    po: number;
    pl: number;
  };

  // Seções dinâmicas
  visibilidade: SubBlockVisibility;

  // Registro reativo interno de bônus concedidos por Classe/Subclasse/Talentos/Origens
  autoGrants?: SheetAutoGrants;
}

export interface RollConditionHint {
  suggestedMode: RollMode;
  reasons: string[];
  autoFail?: boolean;
  autoFailReason?: string;
}

export interface RollRequest {
  title: string;
  subtitle?: string;
  kind: RollKind;
  ability?: AbilityKey;
  skillKey?: SkillKey;
  modifier: number;
  modifierBreakdown: { label: string; value: number; isCustom?: boolean }[];
  diceFormula?: string; // for damage or hit die (e.g. "1d8+3" or "1d10")
  damageType?: string;
  critThreshold?: number; // default 20, Campeão 19 or 18
  followUpDamage?: {
    title: string;
    formula: string;
    bonus: number;
    damageType: string;
    breakdown?: { label: string; value: number; isCustom?: boolean }[];
  };
  onComplete?: (result: RollResult) => void;
}

export interface CombinedDamagePartResult {
  label: string;
  damageType: string;
  total: number;
  expression: string;
  isCustom?: boolean;
}

export interface CombinedDamageResult {
  total: number;
  byType: { damageType: string; total: number }[];
  parts: CombinedDamagePartResult[];
  breakdownText: string;
  critDoubled: boolean;
}

export interface RollResult {
  id: string;
  timestamp: string;
  title: string;
  kind: RollKind;
  mode: RollMode;
  rolls: number[];
  keptRoll: number;
  total: number;
  isCrit: boolean;
  isFumble: boolean;
  breakdownText: string;
  situationalLabel?: string;
  situationalBonus?: number;
  damageType?: string;
  combinedDamage?: CombinedDamageResult;
}

export interface RuntimeCompendiumOverrides {
  spells: SpellDefinition[];
  feats: FeatDefinition[];
  weapons: WeaponDefinition[];
  creatures: CreatureStatBlock[];
  importedFiles: { name: string; importedAt: string; summary: string }[];
}
