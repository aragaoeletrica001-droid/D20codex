import type { AbilityKey, FeatDefinition, SkillKey, SpellDefinition } from '../types/dnd';
import { CLASS_MAP } from './classes';
import { WEAPON_MASTERIES } from './equipment';
import {
  CONDITIONS_LIST,
  RULES_GLOSSARY_SECTIONS,
  STANDARD_ACTIONS_GLOSSARY,
} from './glossary';

export interface RuleHelpEntry {
  title: string;
  subtitle?: string;
  body: string;
  tips?: string[];
  keywords?: string[];
}

export interface SearchableGlossaryEntry extends RuleHelpEntry {
  id: string;
  category:
    | 'Propriedade de Arma'
    | 'Maestria em Arma'
    | 'Combate & Ações'
    | 'Condição'
    | 'Tipo de Dano'
    | 'Atributo'
    | 'Perícia'
    | 'Regra da Ficha';
  searchText: string;
}

export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export const CORE_RULE_HELP: Record<string, RuleHelpEntry> = {
  nome: {
    title: 'Nome do Personagem',
    subtitle: 'Identidade da Ficha',
    body: 'Identifica seu personagem no seletor salvo localmente e nas exportações em JSON. Todas as alterações na ficha são gravadas automaticamente no navegador.',
  },
  nivel: {
    title: 'Nível do Personagem (1–20)',
    subtitle: 'Progressão D&D 2024',
    body: 'Determina seu Bônus de Proficiência (+2 a +6), quantidade de Dados de Vida, Pontos de Vida Máximos, Espaços de Magia, Características de Classe/Subclasse e círculos de magia disponíveis.',
    tips: [
      'A partir do Nível 3, todas as classes desbloqueiam sua Subclasse oficial.',
      'Alterar o nível no seletor recalcula imediatamente todos os valores derivados da ficha.',
    ],
  },
  xp: {
    title: 'Pontos de Experiência (XP)',
    subtitle: 'Avanço de Nível',
    body: 'Registra a experiência acumulada em encontros e marcos da campanha. Se a mesa usa evolução por marcos, pode permanecer em 0 ou servir apenas como registro.',
  },
  classe: {
    title: 'Classe',
    subtitle: 'Papel e Progressão Principal',
    body: 'Define seu Dado de Vida, salvaguardas proficientes, treinamentos em armaduras e armas, perícias iniciais, recursos de descanso, conjuração e características do nível 1 ao 20.',
  },
  subclasse: {
    title: 'Subclasse',
    subtitle: 'Especialização (Nível 3+)',
    body: 'Especialização escolhida no 3º nível da classe. Pode conceder novas magias sempre preparadas, treinamentos de armadura/armas, perícias, ferramentas, defesa sem armadura ou recursos exclusivos.',
  },
  especie: {
    title: 'Espécie',
    subtitle: 'Origem Biológica e Traços Inatos',
    body: 'Define seu Tipo de Criatura, Tamanho, Deslocamento base, Visão no Escuro, magias inatas por nível e traços especiais (incluindo usos recuperáveis por Descanso Curto ou Longo).',
  },
  antecedente: {
    title: 'Antecedente',
    subtitle: 'Origem e Formação (D&D 2024)',
    body: 'No D&D 2024, o Antecedente concede bônus em Atributos (+2/+1 ou +1/+1/+1 entre os 3 atributos listados), 1 Talento de Origem, 2 Perícias proficientes, 1 Ferramenta e ouro ou pacote inicial.',
  },
  orientacao: {
    title: 'Orientação (Alinhamento)',
    subtitle: 'Bússola Moral e Ética',
    body: 'Descreve a tendência ética (Leal, Neutro ou Caótico) e moral (Bom, Neutro ou Mau) do personagem, servindo de guia para decisões interpretativas e dilemas em mesa.',
  },
  ca: {
    title: 'Classe de Armadura (CA)',
    subtitle: 'Defesa contra Jogadas de Ataque',
    body: 'Representa o número que um atacante precisa igualar ou superar em uma jogada de ataque para acertar você. Calculada automaticamente pela armadura equipada, fórmula sem armadura (Bárbaro, Monge, Dracônico, Dança, Armadura Arcana), Escudo, estilos de luta e variáveis customizadas.',
    tips: [
      'Sem armadura padrão: 10 + modificador de Destreza.',
      'Armadura Leve: CA base + Mod. DES completo. Armadura Média: CA base + Mod. DES (máx. +2, ou +3 com Mestre em Armadura Média). Armadura Pesada: CA fixa (sem DES).',
      'Usar armadura ou escudo sem treinamento impõe Desvantagem em testes D20 de FOR/DES e impede conjurar magias.',
    ],
  },
  escudo: {
    title: 'Escudo (+2 na CA)',
    subtitle: 'Equipamento Defensivo',
    body: 'Empunhar um escudo concede +2 na Classe de Armadura. Você só se beneficia de um escudo por vez, e habilidades como Defesa Sem Armadura do Monge ou Ginga Fascinante do Bardo da Dança não permitem escudo.',
    tips: [
      'Vestir ou retirar um escudo exige a ação Utilizar (1 Ação).',
    ],
  },
  pv: {
    title: 'Pontos de Vida (PV)',
    subtitle: 'Vitalidade e Sobrevivência',
    body: 'Mede quanto dano você aguenta antes de cair Inconsciente a 0 PV. No 1º nível você recebe o valor máximo do Dado de Vida + modificador de CON; nos níveis seguintes, soma a média fixa (metade do dado + 1) ou a rolagem + CON, além de bônus como Tenacidade Anã, Vigoroso e Feitiçaria Dracônica.',
    tips: [
      'Dano sempre consome PV Temporários antes de reduzir seus PV Atuais.',
      'Se o dano excedente restante após zerar seus PV for igual ou maior que seus PV Máximos, ocorre morte instantânea.',
      'Um Descanso Longo restaura todos os PV Atuais até o Máximo.',
    ],
  },
  pv_temp: {
    title: 'Pontos de Vida Temporários (PV Temp)',
    subtitle: 'Reserva Absorvedora de Dano',
    body: 'Absorvem dano antes dos seus PV Atuais. Pela regra D&D 2024, PV Temporários NÃO se acumulam: ao receber uma nova fonte, mantenha o maior valor. Eles não podem ser curados e expiram ao concluir um Descanso Longo.',
  },
  dados_vida: {
    title: 'Dados de Vida (DV)',
    subtitle: 'Recuperação em Descanso Curto',
    body: 'Você possui uma quantidade de Dados de Vida igual ao seu nível. Durante um Descanso Curto, pode gastar um ou mais Dados de Vida, rolar cada dado e somar seu modificador de Constituição para recuperar PV (mínimo 1 PV por dado).',
    tips: [
      'No D&D 2024, um Descanso Longo recupera TODOS os Dados de Vida gastos.',
      'Você também pode rolar um Dado de Vida rapidamente na aba Ficha → Testes → Armas e Combate.',
    ],
  },
  morte: {
    title: 'Salvaguardas contra Morte',
    subtitle: 'Ao iniciar turno com 0 PV',
    body: 'Quando começar seu turno com 0 PV, role 1d20 puro (na lista Testes → Salvaguarda; sujeito a Exaustão e bônus globais). Resultado 10 ou maior conta como 1 Sucesso; 9 ou menos conta como 1 Falha. Com 3 Sucessos você fica Estável (Inconsciente a 0 PV, sem precisar rolar); com 3 Falhas você morre.',
    tips: [
      '20 natural: você recupera imediatamente 1 PV e volta à consciência.',
      '1 natural: conta como 2 Falhas de uma vez.',
      'Sofrer dano a 0 PV causa 1 Falha automática (ou 2 Falhas se for Acerto Crítico).',
      'Recuperar qualquer quantidade de PV zera imediatamente Sucessos e Falhas.',
    ],
  },
  bp: {
    title: 'Bônus de Proficiência (BP)',
    subtitle: 'Escala de Competência (+2 a +6)',
    body: 'Somado a ataques com armas proficientes, perícias proficientes, salvaguardas proficientes, ferramentas proficientes, ataque mágico e CD de resistência das magias. Sobe nos níveis 5 (+3), 9 (+4), 13 (+5) e 17 (+6).',
    tips: [
      'Você só soma o BP uma única vez em qualquer teste, exceto quando uma regra concede Especialização (2× BP) ou metade do BP.',
    ],
  },
  iniciativa: {
    title: 'Iniciativa',
    subtitle: 'Ordem de Turno no Combate',
    body: 'Teste de Destreza realizado no início do combate para definir a ordem dos turnos (do maior resultado para o menor). Inclui automaticamente talentos como Alerta (+BP), Pau pra Toda Obra do Bardo, Emboscador Sombrio do Guardião e bônus customizados.',
    tips: [
      'Em caso de empate, o Mestre decide entre monstros e jogadores (ou jogadores escolhem entre si).',
      'Se estiver Surpreso no D&D 2024, você tem Desvantagem na rolagem de Iniciativa.',
    ],
  },
  deslocamento: {
    title: 'Deslocamento',
    subtitle: 'Movimento por Turno (em metros)',
    body: 'Distância que você pode percorrer em cada turno, podendo dividir o movimento antes e depois da sua ação. Ajustado automaticamente pela Espécie, Movimento Rápido (Bárbaro), Movimento Sem Armadura (Monge), Errante (Guardião), Veloz, armadura sem Força mínima (-3 m), Exaustão (-1,5 m por nível) e condições que zeram o movimento.',
    tips: [
      'Terreno Difícil: cada 1,5 m percorrido custa 3 m de deslocamento.',
      'Levantar-se da condição Caído custa metade do seu deslocamento máximo.',
    ],
  },
  tamanho: {
    title: 'Tamanho',
    subtitle: 'Espaço Ocupado e Carga',
    body: 'Define o espaço ocupado em combate (Miúdo 0,75 m; Pequeno ou Médio 1,5 m × 1,5 m; Grande 3 m × 3 m) e influencia regras de agarrar, empurrar, montaria e capacidade de carga.',
  },
  percepcao_passiva: {
    title: 'Percepção Passiva (PP)',
    subtitle: '10 + Bônus de Percepção',
    body: 'Valor usado pelo Mestre para verificar se você percebe ameaças ocultas, emboscadas ou detalhes sem precisar declarar um teste ativo. Penalidades de Exaustão também reduzem a Percepção Passiva (-2 por nível); Vantagem/Desvantagem contínua altera em +5/-5.',
  },
  inspiracao: {
    title: 'Inspiração Heroica',
    subtitle: 'Recurso Heroico D&D 2024',
    body: 'No D&D 2024, você pode gastar sua Inspiração Heroica imediatamente após rolar qualquer dado (d20 ou dano) para rolar novamente aquele dado e usar o novo resultado. Você só pode acumular 1 Inspiração Heroica por vez; Humanos (Inventivo) recuperam a cada Descanso Longo.',
  },
  condicoes: {
    title: 'Condições & Exaustão',
    subtitle: 'Estados Ativos de Combate',
    body: 'Condições ativas (como Envenenado, Caído, Invisível, Cego, Atordoado) alteram automaticamente a sugestão de Vantagem/Desvantagem ou falha automática nos testes e o deslocamento.',
    tips: [
      'Exaustão (D&D 2024): cada nível de 1 a 5 aplica -2 em todos os Testes de D20 e -1,5 m de deslocamento; nível 6 causa morte. Um Descanso Longo reduz 1 nível.',
    ],
  },
  concentracao: {
    title: 'Concentração em Magia',
    subtitle: 'Manutenção de Efeitos Contínuos',
    body: 'Você só pode se concentrar em uma magia por vez. Ao sofrer dano, faça uma Salvaguarda de Constituição com CD 10 ou metade do dano sofrido (arredondado para baixo, máximo CD 30 no D&D 2024) para manter o efeito. Ficar Incapacitado ou lançar outra magia de Concentração encerra a anterior imediatamente.',
  },
  descansos: {
    title: 'Descanso Curto e Descanso Longo',
    subtitle: 'Recuperação de Recursos',
    body: 'Descanso Curto (1 hora): permite gastar Dados de Vida para curar PV e recupera recursos de descanso curto (e Espaços de Pacto do Bruxo). Descanso Longo (8 horas): restaura PV ao máximo, todos os Dados de Vida, todos os espaços de magia e recursos, zera PV Temporários e reduz 1 nível de Exaustão.',
  },
  testes: {
    title: 'Lista Geral de Testes',
    subtitle: 'Central Única de Rolagens da Ficha',
    body: 'Centraliza todos os testes roláveis do personagem em um único painel: ataques de arma (com acerto, dano e extras combinados), todas as 18 perícias, 6 salvaguardas + Salvaguarda contra Morte, 6 testes de atributo, magias de ataque/dano/cura, ferramentas proficientes, Iniciativa e Dado de Vida.',
    tips: [
      'Toque no ícone de d20 para abrir imediatamente a janela de rolagem (Normal, Vantagem ou Desvantagem) sem animação.',
      'Marque a caixa de seleção à esquerda de qualquer teste para fixá-lo na aba Seleção.',
      'Todos os bônus de classe, subclasse, talentos e variáveis customizadas são somados automaticamente.',
    ],
  },
  atributos: {
    title: 'Atributos & Perícias',
    subtitle: 'Configuração de Valores e Proficiências',
    body: 'Os 6 Valores de Atributo (FOR, DES, CON, INT, SAB, CAR) geram modificadores pela fórmula floor((valor - 10) / 2). Use esta seção para editar valores base, marcar proficiências em salvaguardas e alternar proficiência/especialização em perícias. As rolagens ficam centralizadas na lista Testes (aba Ficha).',
  },
  salvaguardas: {
    title: 'Salvaguardas (Testes de Resistência)',
    subtitle: 'Resistir a Magias, Armadilhas e Perigos',
    body: 'Soma o modificador do atributo correspondente + Bônus de Proficiência (se proficiente) + bônus de classe (como Aura de Proteção do Paladino) e variáveis customizadas.',
  },
  proficiencias: {
    title: 'Treinamento & Proficiências',
    subtitle: 'Armaduras, Armas e Ferramentas',
    body: 'Lista os treinamentos de combate e as ferramentas nas quais você possui proficiência. Ao realizar um teste com uma ferramenta proficiente, você soma o modificador do atributo apropriado + seu Bônus de Proficiência. No D&D 2024, se você também for proficiente na perícia sinérgica, ganha Vantagem no teste.',
  },
  ataques: {
    title: 'Armas e Truques de Dano',
    subtitle: 'Cadastro e Propriedades de Combate',
    body: 'Gerencie as armas e ataques do personagem. A jogada de ataque soma d20 + modificador de atributo (FOR, DES ou Conjuração) + BP (se proficiente) + estilos de luta (Arquearia) e variáveis customizadas. As rolagens completas de acerto e dano ficam centralizadas na lista Testes (aba Ficha).',
  },
  maestria: {
    title: 'Maestria em Arma (D&D 2024)',
    subtitle: 'Efeito Tático Especial por Arma',
    body: 'Classes marciais desbloqueiam propriedades de Maestria (Afligir, Ágil, Cortar, Derrubar, Drenar, Empurrar, Lentidão e Rente) que ativam efeitos táticos automáticos ao acertar — ou mesmo ao errar (Rente) — um ataque com a arma escolhida.',
  },
  recursos: {
    title: 'Recursos e Contagens',
    subtitle: 'Usos por Descanso e Contagem de Morte',
    body: 'Reúne a Contagem de Morte (Sucessos e Falhas) e todos os contadores de habilidades com usos limitados (Fúria, Inspiração de Bardo, Canalizar Divindade, Pontos de Foco, Dados de Superioridade, Pontos de Sorte, Traços de Espécie). Todos os usos são restaurados automaticamente pelos botões de Descanso Curto e Descanso Longo.',
  },
  caracteristicas: {
    title: 'Características de Classe & Subclasse',
    subtitle: 'Habilidades Desbloqueadas por Nível',
    body: 'Lista completa das habilidades concedidas pela sua classe e subclasse do nível 1 ao 20, com filtro por nível atual, origem e categoria.',
  },
  tracos_especie: {
    title: 'Traços de Espécie',
    subtitle: 'Capacidades Inatas da Origem',
    body: 'Apresenta todos os traços especiais, resistências, sentidos e linhagens da Espécie escolhida.',
  },
  talentos: {
    title: 'Talentos (Oficiais & Manuais)',
    subtitle: 'Origem, Gerais, Estilo de Luta, Dádivas Épicas e Homebrew',
    body: 'Talentos oficiais aplicam seus benefícios automaticamente (atributos, perícias, PV, deslocamento, recursos e magias). Você também pode cadastrar talentos manuais de outros livros ou cenários próprios e vincular variáveis customizadas para que entrem nos cálculos.',
  },
  variaveis_custom: {
    title: 'Variáveis Customizadas (Homebrew / Cenários)',
    subtitle: 'Modificadores Dinâmicos Integrados às Fórmulas',
    body: 'Permite criar bônus ou penalidades personalizadas vindas de talentos manuais, itens mágicos, bênçãos de cenário ou regras da casa. Cada variável ativa é aplicada automaticamente aos testes correspondentes e exibida de forma distinta no detalhamento do cálculo.',
  },
  conjuracao: {
    title: 'Conjuração & Atributos Mágicos',
    subtitle: 'CD de Magia e Bônus de Ataque Mágico',
    body: 'CD de Resistência de Magia = 8 + BP + modificador de conjuração (+ bônus customizados). Ataque Mágico = BP + modificador de conjuração (+ bônus customizados). As rolagens de ataque, dano e cura das magias preparadas ficam centralizadas na lista Testes (aba Ficha).',
  },
  espacos_magia: {
    title: 'Espaços de Magia & Magia de Pacto',
    subtitle: 'Recursos de Lançamento por Círculo',
    body: 'Truques (0º) podem ser conjurados à vontade. Magias de 1º a 9º círculo consomem um espaço de círculo igual ou superior (exceto quando conjuradas como Ritual). Espaços normais retornam no Descanso Longo; Espaços de Pacto do Bruxo retornam no Descanso Curto.',
  },
  moedas: {
    title: 'Moedas & Tesouro',
    subtitle: 'Conversão Padrão D&D 2024',
    body: '1 PL (Platina) = 10 PO (Ouro) · 1 PO = 2 PE (Electro) = 10 PP (Prata) = 100 PC (Cobre). Ao comprar equipamentos no inventário ou no Assistente, o custo é deduzido automaticamente fazendo troco entre denominações. Cada 100 moedas pesa cerca de 1 kg.',
  },
  equipamentos: {
    title: 'Equipamentos, Armadura & Compras',
    subtitle: 'Catálogo Oficial e Itens Manuais',
    body: 'Gerencie sua armadura equipada, itens do catálogo ou itens manuais com quantidade, peso, custo, propriedades e descrição. Ao adicionar um item, você pode marcá-lo como Comprado e definir um fator multiplicador de preço (ex.: 0.5x desconto, 1x padrão, 1.5x ágio) para dedução automática das moedas.',
  },
  carga: {
    title: 'Capacidade de Carga',
    subtitle: 'Peso Carregado vs. Limite Máximo',
    body: 'Calculada como 7,5 kg × valor de Força (multiplicada por 2× para criaturas Grandes ou Golias com Constituição Poderosa). Soma armadura, escudo, itens da mochila e moedas.',
  },
  sintonizacao: {
    title: 'Sintonização de Itens Mágicos',
    subtitle: 'Limite de 3 Itens Simultâneos',
    body: 'Um personagem pode manter sintonização com no máximo 3 itens mágicos ao mesmo tempo. Sintonizar ou encerrar sintonização normalmente exige um Descanso Curto dedicado ao item.',
  },
  idiomas: {
    title: 'Idiomas Conhecidos',
    subtitle: 'Comunicação e Origens',
    body: 'Lista os idiomas que seu personagem fala, lê e escreve. Classes como Druida (Druídico) e Ladino (Gíria de Ladrão) concedem idiomas secretos automaticamente.',
  },
};

export const WEAPON_PROPERTY_HELP: Record<string, RuleHelpEntry> = {
  acuidade: {
    title: 'Acuidade (Propriedade de Arma)',
    subtitle: 'Escolha entre Força ou Destreza',
    body: 'Ao realizar um ataque com uma arma com a propriedade Acuidade, você escolhe usar seu modificador de Força ou de Destreza nas jogadas de ataque e de dano. Você deve usar o mesmo modificador para ambas as jogadas.',
    tips: [
      'Essencial para Ladinos (Ataque Furtivo exige arma com Acuidade ou arma à distância).',
    ],
    keywords: ['finesse', 'destreza', 'forca', 'ataque furtivo'],
  },
  adaptavel: {
    title: 'Adaptável / Versátil (Propriedade de Arma)',
    subtitle: 'Uso com Uma ou Duas Mãos',
    body: 'Uma arma Adaptável (também chamada Versátil) pode ser empunhada com uma ou duas mãos. O dado indicado entre parênteses (ex.: 1d10 na Espada Longa ou 1d8 no Bordão) é usado quando você realiza um ataque corpo a corpo empunhando-a com as duas mãos.',
    tips: [
      'Alternar entre segurar com uma ou duas mãos para atacar não consome ação extra; você só precisa estar com a outra mão livre (sem escudo ou outra arma).',
      'No D&D 2024, você pode sacar ou guardar uma arma uma vez por ataque durante a ação Atacar.',
    ],
    keywords: ['versatil', 'versátil', 'adaptavel', 'adaptável', 'duas maos', 'uma mao'],
  },
  alcance: {
    title: 'Alcance (Propriedade de Arma)',
    subtitle: '+1,5 m de Alcance Corpo a Corpo',
    body: 'Adiciona 1,5 metro ao seu alcance normal ao atacar com esta arma (passando de 1,5 m para 3 m), inclusive para determinar seu alcance ao realizar Ataques de Oportunidade.',
    keywords: ['reach', '3m', '3 m', 'oportunidade', 'haste'],
  },
  arremesso: {
    title: 'Arremesso (Propriedade de Arma)',
    subtitle: 'Ataque à Distância com Arma Corpo a Corpo',
    body: 'Você pode arremessar a arma para realizar um ataque à distância, usando o mesmo modificador de atributo que usaria em um ataque corpo a corpo (Força, ou Destreza se também possuir Acuidade). No D&D 2024, você pode sacar uma arma de Arremesso como parte do próprio ataque realizado para arremessá-la.',
    tips: [
      'Os dois números entre parênteses indicam Alcance Normal / Alcance Longo em metros (ex.: 6/18m). Atacar além do alcance normal impõe Desvantagem.',
    ],
    keywords: ['thrown', 'distancia', 'sacar', 'azagaia', 'adaga', 'machadinha'],
  },
  duas_maos: {
    title: 'Duas Mãos (Propriedade de Arma)',
    subtitle: 'Exige Ambas as Mãos para Atacar',
    body: 'Esta arma requer o uso das duas mãos quando você realiza um ataque com ela. Enquanto não estiver atacando, você pode segurá-la brevemente com uma mão (por exemplo, para realizar componentes somáticos de uma magia).',
    keywords: ['two-handed', 'duas maos', 'escudo'],
  },
  leve: {
    title: 'Leve (Propriedade de Arma)',
    subtitle: 'Combate com Duas Armas (Ação Bônus)',
    body: 'Quando você usa a ação Atacar no seu turno e ataca com uma arma Leve, pode realizar 1 ataque extra como uma Ação Bônus mais tarde no mesmo turno. Esse ataque extra deve ser feito com uma arma Leve diferente (não precisa estar na outra mão antes se puder sacá-la no ataque) e não soma seu modificador de atributo ao dano, a menos que o modificador seja negativo.',
    tips: [
      'Estilo de Luta (Combate com Duas Armas) permite somar seu modificador de atributo ao dano do ataque extra.',
      'Maestria Ágil permite fazer o ataque extra da propriedade Leve como parte da própria ação Atacar, liberando sua Ação Bônus (máx. 1x por turno).',
    ],
    keywords: ['light', 'duas armas', 'acao bonus', 'ação bônus', 'agil', 'ágil'],
  },
  municao: {
    title: 'Munição (Propriedade de Arma)',
    subtitle: 'Disparo com Flechas, Virotes, Balas ou Dardos',
    body: 'Você só pode fazer um ataque à distância com esta arma se possuir munição compatível (flechas, virotes, balas de funda, balas de arma de fogo). Cada ataque consome 1 munição. Sacar a munição de uma aljava ou bolsa faz parte do ataque (armas de uma mão exigem uma mão livre para carregar).',
    tips: [
      'Ao final do combate, você pode gastar 1 minuto procurando no campo de batalha para recuperar metade das munições disparadas (arredondado para baixo).',
      'Se usar uma arma com Munição para golpear corpo a corpo, ela conta como arma improvisada (1d4 Contundente).',
    ],
    keywords: ['ammunition', 'flecha', 'virote', 'arco', 'besta', 'aljava'],
  },
  pesada: {
    title: 'Pesada (Propriedade de Arma)',
    subtitle: 'Requisito Mínimo de Atributo 13 (D&D 2024)',
    body: 'No D&D 2024, você tem Desvantagem em jogadas de ataque com uma arma Pesada se ela tiver a propriedade Corpo a Corpo e sua Força for menor que 13, ou se for uma arma à Distância e sua Destreza for menor que 13.',
    tips: [
      'Permite ativar o dano extra (+BP) do talento Mestre em Armas Grandes (D&D 2024) em ataques corpo a corpo com armas Pesadas.',
    ],
    keywords: ['heavy', 'forca 13', 'destreza 13', 'mestre em armas grandes'],
  },
  recarga: {
    title: 'Recarga (Propriedade de Arma)',
    subtitle: 'Limite de 1 Disparo por Ação / Bônus / Reação',
    body: 'Devido ao tempo necessário para armar e recarregar esta arma (como bestas, zarabatana e armas de fogo), você só pode disparar 1 munição dela quando usa uma Ação, Ação Bônus ou Reação para atacar — independentemente de quantos ataques (como Ataque Extra) você normalmente poderia fazer.',
    tips: [
      'O talento Especialista em Besta ignora a propriedade Recarga em bestas (permitindo usar todos os ataques de Ataque Extra).',
      'O talento Atirador / Artilheiro (conforme o caso) também interage com armas de disparo e distância.',
    ],
    keywords: ['loading', 'besta', 'ataque extra', 'recarregar', 'arma de fogo'],
  },
  distancia: {
    title: 'Alcance Normal e Longo (Armas à Distância)',
    subtitle: 'Regra de Distância e Combate Próximo',
    body: 'Armas à distância e de arremesso listam dois números (ex.: 24/96 m). Até o primeiro valor (Alcance Normal), o ataque é feito normalmente. Entre o alcance normal e o segundo valor (Alcance Longo), você sofre Desvantagem na jogada de ataque. Alvos além do alcance longo não podem ser acertados.',
    tips: [
      'Ataque à distância em corpo a corpo: se houver um inimigo hostil não-incapacitado a 1,5 m de você que possa vê-lo, seus ataques à distância sofrem Desvantagem (mesmo contra outros alvos).',
    ],
    keywords: ['range', 'alcance normal', 'alcance longo', 'arco', 'desvantagem'],
  },
  especial_lanca: {
    title: 'Lança de Montaria (Regra Especial)',
    subtitle: 'Uso Montado vs. A Pé',
    body: 'A Lança de Montaria possui Alcance (3 m) e exige Duas Mãos quando usada a pé, mas pode ser empunhada com apenas uma mão enquanto você estiver montado (permitindo usar escudo). No D&D 2024, não possui mais desvantagem a 1,5 m conforme a regra atualizada, mantendo a Maestria Derrubar.',
    keywords: ['montaria', 'cavalo', 'lanca'],
  },
};

export const COMBAT_AND_DAMAGE_GLOSSARY: Array<RuleHelpEntry & { category: SearchableGlossaryEntry['category'] }> = [
  {
    category: 'Combate & Ações',
    title: 'Ação (Economia de Turno)',
    subtitle: '1 por Turno',
    body: 'É a principal atividade do seu turno. Você pode escolher uma ação padrão: Atacar, Conjurar (Magia), Disparada, Desengajar, Esquivar, Ajudar, Esconder, Influenciar, Preparar, Procurar, Estudar ou Utilizar um objeto.',
    keywords: ['turno', 'atacar', 'conjurar', 'disparada', 'esquivar'],
  },
  {
    category: 'Combate & Ações',
    title: 'Ação Bônus',
    subtitle: 'Máx. 1 por Turno (Somente se Habilitada)',
    body: 'Você só possui uma Ação Bônus se uma característica de classe, magia, talento ou propriedade (como arma Leve) disser explicitamente que algo pode ser feito como Ação Bônus. Mesmo que possua várias opções, só pode usar 1 Ação Bônus por turno.',
    keywords: ['bonus', 'acao bonus', 'leve', 'furia', 'passo nebuloso'],
  },
  {
    category: 'Combate & Ações',
    title: 'Reação',
    subtitle: '1 por Rodada (Resposta a um Gatilho)',
    body: 'Resposta instantânea a um gatilho específico, que pode ocorrer no seu turno ou no turno de outra criatura (como Ataque de Oportunidade, Escudo Arcano ou Contramágica). Você recupera sua Reação no início do seu próximo turno.',
    keywords: ['reacao', 'oportunidade', 'escudo arcano', 'contramagica'],
  },
  {
    category: 'Combate & Ações',
    title: 'Ataque de Oportunidade',
    subtitle: 'Reação ao Inimigo Sair do Seu Alcance',
    body: 'Quando uma criatura hostil que você pode ver sai do seu alcance corpo a corpo sem usar Desengajar ou teletransporte, você pode usar sua Reação para fazer 1 ataque corpo a corpo (com arma ou Ataque Desarmado) contra ela antes que ela saia do alcance.',
    keywords: ['reacao', 'desengajar', 'alcance'],
  },
  {
    category: 'Combate & Ações',
    title: 'Vantagem e Desvantagem',
    subtitle: 'Role 2d20 — Maior ou Menor',
    body: 'Com Vantagem, role 2d20 e fique com o maior resultado. Com Desvantagem, role 2d20 e fique com o menor. Múltiplas fontes nunca acumulam (sempre 2d20). Se você tiver qualquer número de Vantagens e qualquer número de Desvantagens simultaneamente, elas se anulam e a rolagem fica Normal (1d20).',
    keywords: ['2d20', 'cancelam', 'normal'],
  },
  {
    category: 'Combate & Ações',
    title: 'Acerto Crítico (20 Natural)',
    subtitle: 'Acerto Automático e Dados de Dano Dobrados',
    body: 'Ao tirar 20 natural no d20 (ou 19–20 / 18–20 para Campeão), o ataque acerta automaticamente independente da CA do alvo e você rola o dobro de TODOS os dados de dano daquele ataque (arma, Ataque Furtivo, Destruição Divina, Marca do Predador, Golpes Terríveis, etc.), somando os bônus fixos apenas uma vez.',
    tips: [
      '1 natural em jogada de ataque sempre erra automaticamente, independente dos bônus.',
    ],
    keywords: ['critico', '20 natural', 'dobrar dados', 'erro critico'],
  },
  {
    category: 'Combate & Ações',
    title: 'Cobertura (Meia, Três Quartos e Total)',
    subtitle: 'Proteção por Obstáculos no Terreno',
    body: 'Meia Cobertura: +2 na CA e em Salvaguardas de Destreza (muro baixo, outra criatura, árvore). Cobertura de Três Quartos: +5 na CA e em Salvaguardas de Destreza (grade, fresta de muralha). Cobertura Total: não pode ser alvo direto de ataques ou magias (mas ainda pode sofrer áreas que contornem o obstáculo).',
    keywords: ['meia cobertura', 'tres quartos', 'cobertura total', '+2 ca', '+5 ca'],
  },
  {
    category: 'Combate & Ações',
    title: 'Ataque Desarmado (D&D 2024)',
    subtitle: 'Dano, Agarrar ou Empurrar',
    body: 'Um Ataque Desarmado pode ser feito com punho, chute, cabeçada ou corpo e oferece 3 opções ao atacar: (1) Dano: jogada de ataque (FOR + BP) causando 1 + Mod. FOR Contundente (ou dado de Artes Marciais do Monge); (2) Agarrar: alvo faz SG FOR ou DES (CD 8 + Mod. FOR + BP) ou fica Agarrado; (3) Empurrar: alvo faz SG FOR ou DES (mesma CD) ou é empurrado 1,5 m ou fica Caído.',
    keywords: ['agarrar', 'empurrar', 'caido', 'monge', 'desarmado'],
  },
  {
    category: 'Combate & Ações',
    title: 'Componentes de Magia (V, S, M) & Ritual',
    subtitle: 'Requisitos de Conjuração',
    body: 'V (Verbal): exige falar palavras místicas (impedido sob Silêncio ou amordaçado). S (Somático): exige ao menos uma mão livre para gestos. M (Material): exige os componentes ou um Foco de Conjuração (a mesma mão do foco pode fazer o gesto S). Se o material tiver custo em PO ou for consumido, não pode ser substituído pelo foco. Ritual: conjurar gastando +10 minutos sem consumir Espaço de Magia.',
    keywords: ['verbal', 'somatico', 'material', 'foco', 'ritual'],
  },
  {
    category: 'Combate & Ações',
    title: 'Visão no Escuro, Penumbra e Escuridão',
    subtitle: 'Iluminação e Sentidos',
    body: 'Penumbra cria área Levemente Obscurecida (Desvantagem em testes de Percepção baseados em visão). Escuridão cria área Fortemente Obscurecida (criaturas sem visão especial sofrem efeitos equivalentes a Cego). Visão no Escuro permite enxergar na Penumbra como Luz Plena e na Escuridão como Penumbra (em tons de cinza) até o alcance indicado.',
    keywords: ['escuridao', 'penumbra', 'obscurecida', 'cego', 'sentidos'],
  },
  {
    category: 'Combate & Ações',
    title: 'Resistência, Vulnerabilidade e Imunidade',
    subtitle: 'Multiplicadores de Dano',
    body: 'Resistência: reduz o dano daquele tipo pela metade (arredondado para baixo) após aplicar modificadores. Vulnerabilidade: dobra o dano daquele tipo. Imunidade: você sofre 0 de dano daquele tipo. Múltiplas fontes de Resistência ou Vulnerabilidade ao mesmo tipo não se acumulam.',
    keywords: ['metade', 'dobro', 'imunidade', 'resistencia', 'vulnerabilidade'],
  },
  {
    category: 'Tipo de Dano',
    title: 'Tipos de Dano (Os 13 Tipos de D&D 2024)',
    subtitle: 'Físicos, Elementais e Místicos',
    body: 'Físicos: Contundente (impacto/esmagamento), Cortante (lâminas/garras) e Perfurante (flechas/lanças/mordidas).\nElementais: Ácido (corrosão), Elétrico (raios), Gélido (frio/gelo), Ígneo (fogo/calor) e Trovejante (ondas de choque sonoras).\nMísticos e Biológicos: Energético / Força (energia arcana pura), Necrótico (dreno vital/decomposição), Psíquico (ataque mental), Radiante (luz divina/solar) e Venenoso (toxinas).',
    keywords: [
      'acido', 'contundente', 'cortante', 'eletrico', 'energetico', 'forca',
      'gelido', 'igneo', 'necrotico', 'perfurante', 'psiquico', 'radiante',
      'trovejante', 'venenoso',
    ],
  },
  {
    category: 'Combate & Ações',
    title: 'Armaduras: Leve, Média, Pesada e Furtividade',
    subtitle: 'Regras de Vestir, Treinamento e Força Mínima',
    body: 'Leve: soma Mod. DES completo na CA (vestir/retirar 1 min). Média: soma Mod. DES até +2 (vestir 5 min / retirar 1 min). Pesada: CA fixa sem DES; algumas exigem Força 13 ou 15 (caso contrário seu deslocamento cai em 3 m) e vestem em 10 min / retiram em 5 min. Armaduras com marcação "Desv. Furtividade" aplicam Desvantagem automática em testes de Furtividade.',
    keywords: ['armadura', 'leve', 'media', 'pesada', 'furtividade', 'forca minima'],
  },
];

export const ABILITY_RULE_HELP: Record<AbilityKey, RuleHelpEntry> = {
  for: {
    title: 'Força (FOR)',
    subtitle: 'Potência Física e Combate Corpo a Corpo',
    body: 'Mede poder muscular, capacidade de carga (7,5 kg × FOR), saltos, ataques e dano com armas corpo a corpo (não-acuidade) e armas de arremesso. Também define a CD de Agarrar/Empurrar em Ataques Desarmados e o requisito de armas Pesadas (FOR 13) e armaduras Pesadas. Perícia vinculada: Atletismo.',
  },
  des: {
    title: 'Destreza (DES)',
    subtitle: 'Agilidade, Reflexos e Precisão',
    body: 'Regula sua Iniciativa, contribui para a Classe de Armadura (conforme o limite da armadura) e comanda ataques/dano com armas à distância ou com a propriedade Acuidade. Também define o requisito de armas Pesadas à distância (DES 13). Perícias: Acrobacia, Furtividade e Prestidigitação.',
  },
  con: {
    title: 'Constituição (CON)',
    subtitle: 'Vigor, Pontos de Vida e Concentração',
    body: 'Soma-se aos seus Pontos de Vida em todos os níveis, aos Dados de Vida gastos em Descansos Curtos e rege Salvaguardas de Concentração ao sofrer dano enquanto mantém uma magia, além de resistência a venenos, doenças e ambientes extremos.',
  },
  int: {
    title: 'Inteligência (INT)',
    subtitle: 'Raciocínio, Memória e Conhecimento Arcano',
    body: 'Atributo de conjuração de Magos (e subclasses como Cavaleiro Místico e Trapaceiro Arcano). Usada na ação Estudar para recordar informações técnicas e deduzir pistas. Perícias vinculadas: Arcanismo, História, Investigação, Natureza e Religião.',
  },
  sab: {
    title: 'Sabedoria (SAB)',
    subtitle: 'Percepção, Intuição e Força de Vontade',
    body: 'Atributo de conjuração de Clérigos, Druidas e Guardiões, além de definir Percepção Passiva e defesa mental contra magias de controle e medo. Perícias: Intuição, Lidar com Animais, Medicina, Percepção e Sobrevivência.',
  },
  car: {
    title: 'Carisma (CAR)',
    subtitle: 'Presença, Liderança e Magia Inata',
    body: 'Atributo de conjuração de Bardos, Bruxos, Feiticeiros e Paladinos, além de sustentar a ação Influenciar e a Aura de Proteção do Paladino. Perícias: Atuação, Enganação, Intimidação e Persuasão.',
  },
};

export const SKILL_RULE_HELP: Record<SkillKey, RuleHelpEntry> = {
  acrobacia: {
    title: 'Acrobacia (DES)',
    subtitle: 'Perícia de Destreza · Equilíbrio, Manobras e Fuga',
    body: 'Cobre tentativas de permanecer de pé em situações difíceis — como correr sobre gelo, caminhar em corda bamba ou manter o equilíbrio no convés de um navio em tempestade. Também é usada para aterrissar de pé, dar cambalhotas/manobras acrobáticas e escapar da condição Agarrado.',
    tips: [
      'Escapar de Agarrão (D&D 2024): Use sua Ação para fazer um teste de Destreza (Acrobacia) ou Força (Atletismo) contra a CD do agarrador (8 + Mod. FOR + BP).',
      'Regra Geral de Perícias: Soma Mod. DES + BP (se proficiente) ou 2× BP (Especialização). Proficiência simultânea em uma Ferramenta aplicável concede Vantagem.',
    ],
  },
  arcanismo: {
    title: 'Arcanismo (INT)',
    subtitle: 'Perícia de Inteligência · Ação Analisar / Estudar',
    body: 'Mede sua capacidade de recordar conhecimentos sobre magias, itens mágicos, símbolos místicos, tradições arcanas, planos de existência e criaturas extraplanares (como Aberrações, Constructos, Elementais, Fadas e Monstruosidades).',
    tips: [
      'Ação Analisar (Estudar): Em combate ou exploração, use 1 Ação para testar Inteligência (Arcanismo) e identificar efeitos mágicos, runas ou fraquezas de criaturas arcanas.',
      'Também usada para decifrar pergaminhos de magia fora da sua lista ou compreender círculos de teletransporte e armadilhas arcanas.',
    ],
  },
  atletismo: {
    title: 'Atletismo (FOR)',
    subtitle: 'Perícia de Força · Escalada, Natação, Salto e Fuga',
    body: 'Aplica-se a situações difíceis de escalar, saltar ou nadar — como escalar um penhasco íngreme ou escorregadio, nadar contra corredeiras violentas, agarrar-se a algo enquanto cai ou realizar saltos que excedem sua distância normal.',
    tips: [
      'Escapar de Agarrão (D&D 2024): Use sua Ação para testar Força (Atletismo) ou Destreza (Acrobacia) contra a CD do agarrão.',
      'Nota D&D 2024: Iniciar um agarrão ou empurrão agora é feito via Ataque Desarmado (o alvo faz Salvaguarda de FOR ou DES contra CD 8 + Mod. FOR + BP), enquanto Atletismo rege escalada, natação, salto e fuga.',
    ],
  },
  atuacao: {
    title: 'Atuação (CAR)',
    subtitle: 'Perícia de Carisma · Entretenimento e Ação Influenciar',
    body: 'Determina o quão bem você encanta, emociona, distrai ou impressiona uma plateia por meio de música, dança, teatro, narração de histórias, poesia ou qualquer outra forma de apresentação artística.',
    tips: [
      'Sinergia com Instrumentos Musicais: Se você tiver proficiência em Atuação e no Instrumento Musical usado na apresentação, faz o teste com Vantagem (D&D 2024).',
      'Pode ser usada com a Ação Influenciar para conquistar simpatia de uma multidão ou manter um disfarce artístico.',
    ],
  },
  enganacao: {
    title: 'Enganação (CAR)',
    subtitle: 'Perícia de Carisma · Ação Influenciar (Blefe e Disfarce)',
    body: 'Mede sua capacidade de ocultar a verdade de forma convincente, seja verbalmente ou por meio de gestos e postura. Inclui mentir sem demonstrar nervosismo, blefar, criar distrações, falsificar intenções e sustentar identidades falsas.',
    tips: [
      'Ação Influenciar (D&D 2024): Usada para convencer uma criatura Indiferente ou Hostil por meio de engano ou promessa falsa (CD base 15 ou valor de Inteligência da criatura, o que for maior).',
      'Sinergia com Kit de Disfarce: Proficiência em Enganação + Kit de Disfarce concede Vantagem ao se passar por outra pessoa.',
    ],
  },
  furtividade: {
    title: 'Furtividade (DES)',
    subtitle: 'Perícia de Destreza · Ação Esconder (D&D 2024)',
    body: 'Determina sua habilidade de se ocultar de inimigos, mover-se em silêncio, esgueirar-se por sentinelas ou aproximar-se sem ser ouvido ou visto.',
    tips: [
      'Ação Esconder (D&D 2024): Exige estar em Área Totalmente Obscurecida ou atrás de Cobertura de Três Quartos/Total, fora da linha de visão dos inimigos. Faça Destreza (Furtividade) contra CD 15.',
      'Ao passar na CD 15, você ganha a condição Invisível (o resultado do teste vira a CD para inimigos o encontrarem com a Ação Procurar / Sabedoria Percepção). O efeito termina se você fizer som alto, atacar, conjurar magia com componente Verbal ou um inimigo o localizar.',
      'Armaduras ruidosas (marcadas com Desv. Furtividade) impõem Desvantagem automática neste teste.',
    ],
  },
  historia: {
    title: 'História (INT)',
    subtitle: 'Perícia de Inteligência · Ação Analisar / Estudar',
    body: 'Mede sua capacidade de recordar eventos históricos, povos lendários, reinos antigos, disputas políticas, guerras recentes, linhagens nobres, heráldica e civilizações perdidas.',
    tips: [
      'Ação Analisar (Estudar): Use para identificar brasões, datar ruínas, reconhecer figuras históricas e recordar costumes ou tratados relevantes.',
    ],
  },
  intimidacao: {
    title: 'Intimidação (CAR)',
    subtitle: 'Perícia de Carisma · Ação Influenciar (Coerção)',
    body: 'Cobre tentativas de influenciar alguém por meio de ameaças abertas, postura hostil, demonstração de poder ou violência iminente — como interrogar um prisioneiro, desencorajar bandidos ou forçar rendição.',
    tips: [
      'Ação Influenciar (D&D 2024): Usada para coagir criaturas (em geral com Vantagem se você demonstrar vantagem física clara ou com Desvantagem se o alvo estiver em posição superior).',
      'Variação de Atributo: O Mestre pode permitir Força (Intimidação) quando a ameaça depender de puro porte físico.',
    ],
  },
  intuicao: {
    title: 'Intuição (SAB)',
    subtitle: 'Perícia de Sabedoria · Ação Procurar (Leitura Social)',
    body: 'Determina se você consegue discernir as verdadeiras intenções de uma criatura — como perceber uma mentira, detectar nervosismo, identificar manipulação mágica/emocional ou prever o próximo passo de alguém.',
    tips: [
      'Ação Procurar (D&D 2024): Em cena social ou combate, faça Sabedoria (Intuição) para avaliar atitude real, honestidade ou estado emocional de um alvo.',
    ],
  },
  investigacao: {
    title: 'Investigação (INT)',
    subtitle: 'Perícia de Inteligência · Ação Analisar / Estudar (Dedução)',
    body: 'Usada quando você examina pistas de perto e faz deduções lógicas: descobrir onde um objeto está escondido, deduzir o mecanismo de uma armadilha, determinar o ponto fraco estrutural de uma parede, discernir ilusões ou pesquisar registros em livros.',
    tips: [
      'Diferença para Percepção: Percepção nota algo pelos sentidos (ver/ouvir); Investigação analisa pistas, compreende mecanismos e deduz conclusões lógicas.',
      'Muitas magias de Ilusão exigem a Ação Analisar com Inteligência (Investigação) contra a CD de Magia do conjurador para revelar a ilusão.',
    ],
  },
  lidar_com_animais: {
    title: 'Lidar com Animais (SAB)',
    subtitle: 'Perícia de Sabedoria · Ação Influenciar (Feras e Montarias)',
    body: 'Usada para acalmar uma fera assustada ou agressiva, evitar que uma montaria entre em pânico, intuir as intenções de um animal ou conduzir uma montaria ou carroça em manobras arriscadas.',
    tips: [
      'Ação Influenciar (D&D 2024): Aplica-se a Bestas (e certas Monstruosidades animalescas) para acalmar, orientar ou melhorar a atitude do animal.',
    ],
  },
  medicina: {
    title: 'Medicina (SAB)',
    subtitle: 'Perícia de Sabedoria · Estabilizar e Diagnóstico',
    body: 'Permite estabilizar um companheiro moribundo, diagnosticar doenças, identificar venenos, determinar a causa da morte de um corpo ou avaliar a gravidade de ferimentos.',
    tips: [
      'Estabilizar Criatura a 0 PV: Use a Ação Ajudar (ou Usar Objeto com Kit de Curandeiro) e faça um teste de Sabedoria (Medicina) CD 10. Em sucesso, o alvo fica Estável (não precisa mais fazer Salvaguardas contra Morte).',
      'Um Kit de Curandeiro estabiliza automaticamente sem precisar rolar Medicina.',
    ],
  },
  natureza: {
    title: 'Natureza (INT)',
    subtitle: 'Perícia de Inteligência · Ação Analisar / Estudar',
    body: 'Mede sua capacidade de recordar conhecimentos sobre terrenos, plantas, animais, ciclos climáticos, ecossistemas e criaturas naturais (Bestas, Dragões, Gigantes, Gosmas e Plantas).',
    tips: [
      'Ação Analisar (Estudar): Identifica ervas venenosas ou medicinais, vulnerabilidades de monstros naturais e fenômenos ambientais.',
    ],
  },
  percepcao: {
    title: 'Percepção (SAB)',
    subtitle: 'Perícia de Sabedoria · Ação Procurar e Percepção Passiva',
    body: 'Permite avistar, ouvir ou detectar a presença de algo no ambiente usando seus sentidos: localizar criaturas escondidas, notar emboscadas, ouvir conversas atrás de portas ou avistar detalhes sutis à distância.',
    tips: [
      'Ação Procurar (D&D 2024): Use 1 Ação para testar Sabedoria (Percepção) contra o resultado de Furtividade de uma criatura escondida para revelá-la.',
      'Percepção Passiva = 10 + seu bônus de Percepção (alterada em ±5 por Vantagem/Desvantagem contínua e -2 por nível de Exaustão).',
      'Meia-Luz (Parcialmente Obscurecida) impõe Desvantagem em testes de Percepção baseados em visão.',
    ],
  },
  persuasao: {
    title: 'Persuasão (CAR)',
    subtitle: 'Perícia de Carisma · Ação Influenciar (Diplomacia)',
    body: 'Usada quando você tenta convencer alguém de boa-fé usando tato social, etiqueta, argumentos claros ou apelo sincero — como negociar paz, pedir ajuda a autoridades ou conquistar aliados.',
    tips: [
      'Ação Influenciar (D&D 2024): Criaturas Amigáveis concedem Vantagem; Indiferentes usam teste normal; Hostis falham automaticamente se o pedido envolver sacrifício ou risco (CD base 15 ou Inteligência do alvo).',
    ],
  },
  prestidigitacao: {
    title: 'Prestidigitação (DES)',
    subtitle: 'Perícia de Destreza · Destreza Manual e Punga',
    body: 'Cobre atos de agilidade manual e truques sutis: plantar ou furtar pequenos objetos nos bolsos de alguém, esconder um item pequeno nas roupas, fazer truques de mágica mundanos ou desatar nós rapidamente.',
    tips: [
      'Sinergia com Ferramentas de Ladrão: Proficiência em Prestidigitação + Ferramentas de Ladrão ajuda em manipulações delicadas e desarme de mecanismos finos.',
    ],
  },
  religiao: {
    title: 'Religião (INT)',
    subtitle: 'Perícia de Inteligência · Ação Analisar / Estudar',
    body: 'Mede sua capacidade de recordar conhecimentos sobre divindades, ritos, orações, hierarquias eclesiásticas, símbolos sagrados, cultos secretos e criaturas ligadas ao sagrado/profano (Celestiais, Ínferos e Mortos-Vivos).',
    tips: [
      'Ação Analisar (Estudar): Identifica cultos, profecias, rituais profanos e fraquezas de Mortos-Vivos, Ínferos ou Celestiais.',
    ],
  },
  sobrevivencia: {
    title: 'Sobrevivência (SAB)',
    subtitle: 'Perícia de Sabedoria · Ação Procurar (Rastreamento e Ermos)',
    body: 'Permite seguir rastros, caçar animais selvagens, guiar um grupo por terrenos ermos sem se perder, prever mudanças climáticas e identificar sinais de perigos naturais (como areia movediça, avalanches ou covis de monstros).',
    tips: [
      'Ação Procurar (D&D 2024): Usada para localizar pegadas recentes, identificar a direção e o número aproximado de criaturas que passaram por uma área.',
    ],
  },
};

/**
 * Monta a explicação completa e fiel ao livro para qualquer Magia,
 * sem cortar tempo de conjuração, alcance, componentes, duração, classes, efeito ou escalonamento.
 */
export function buildSpellRuleHelp(sp: SpellDefinition): {
  title: string;
  subtitle: string;
  body: string;
  tips: string[];
} {
  const circleLabel = sp.level === 0 ? 'Truque' : `${sp.level}º Círculo`;
  const tags: string[] = [circleLabel, sp.school];
  if (sp.ritual) tags.push('Ritual');
  if (sp.concentration) tags.push('Concentração');

  const classNames = sp.classes
    .map((id) => CLASS_MAP[id]?.name ?? id)
    .filter(Boolean)
    .join(', ');

  const headerLines = [
    `Tempo de Conjuração: ${sp.castingTime}`,
    `Alcance: ${sp.range}`,
    `Componentes: ${sp.components}`,
    `Duração: ${sp.duration}`,
    ...(classNames ? [`Classes: ${classNames}`] : []),
  ].join('\n');

  const tips: string[] = [];
  if (sp.higherLevels) {
    tips.push(
      `${sp.level === 0 ? 'Aprimoramento de Truque' : 'Em Círculos Superiores'}: ${sp.higherLevels}`
    );
  }

  return {
    title: sp.name,
    subtitle: tags.join(' · '),
    body: `${headerLines}\n\n${sp.description}`,
    tips,
  };
}

/**
 * Monta a explicação completa de um Talento (categoria, pré-requisito, repetibilidade e todos os benefícios).
 */
export function buildFeatRuleHelp(feat: FeatDefinition): {
  title: string;
  subtitle: string;
  body: string;
  tips: string[];
} {
  const subtitleParts = [
    `Talento de ${feat.category}`,
    ...(feat.prerequisite ? [`Pré-requisito: ${feat.prerequisite}`] : []),
    ...(feat.repeatable ? ['Repetível'] : []),
  ];

  const hasMultipleBenefits = feat.benefits && feat.benefits.length > 0;
  return {
    title: feat.name,
    subtitle: subtitleParts.join(' · '),
    body: hasMultipleBenefits ? feat.benefits.join('\n\n') : feat.summary,
    tips: [],
  };
}

/**
 * Resolve a weapon property string (e.g. "Versátil (1d10)", "Arremesso (6/18m)", "Recarga")
 * into its full practical D&D 2024 explanation.
 */
export function resolveWeaponPropertyHelp(prop: string): RuleHelpEntry | null {
  const norm = normalizeSearchText(prop);
  if (norm.includes('acuidade')) return WEAPON_PROPERTY_HELP.acuidade;
  if (norm.includes('versatil') || norm.includes('adaptavel')) return WEAPON_PROPERTY_HELP.adaptavel;
  if (norm.includes('alcance')) return WEAPON_PROPERTY_HELP.alcance;
  if (norm.includes('arremesso')) return WEAPON_PROPERTY_HELP.arremesso;
  if (norm.includes('duas maos')) return WEAPON_PROPERTY_HELP.duas_maos;
  if (norm.includes('leve')) return WEAPON_PROPERTY_HELP.leve;
  if (norm.includes('municao')) return WEAPON_PROPERTY_HELP.municao;
  if (norm.includes('pesada')) return WEAPON_PROPERTY_HELP.pesada;
  if (norm.includes('recarga')) return WEAPON_PROPERTY_HELP.recarga;
  if (norm.includes('distancia')) return WEAPON_PROPERTY_HELP.distancia;
  if (norm.includes('lanca')) return WEAPON_PROPERTY_HELP.especial_lanca;
  return null;
}

/**
 * Builds a complete, practical explanation payload for a weapon or attack entry,
 * expanding its Mastery AND every weapon property (Recarga, Adaptável/Versátil, Leve, Acuidade, etc.).
 */
export function buildWeaponRuleHelp(params: {
  name: string;
  range: string;
  damageLabel: string;
  damageType: string;
  properties: string[];
  mastery?: string;
  notes?: string;
}): { body: string; tips: string[] } {
  const sections: string[] = [];
  const tips: string[] = [];

  if (params.mastery && WEAPON_MASTERIES[params.mastery]) {
    sections.push(`Maestria — ${params.mastery}: ${WEAPON_MASTERIES[params.mastery]}`);
  }

  if (params.notes && params.notes.trim()) {
    sections.push(params.notes.trim());
  }

  const seenHelp = new Set<string>();
  for (const prop of params.properties) {
    const help = resolveWeaponPropertyHelp(prop);
    if (help && !seenHelp.has(help.title)) {
      seenHelp.add(help.title);
      tips.push(`${prop}: ${help.body}`);
    } else if (!help && prop.trim()) {
      tips.push(`Propriedade: ${prop}`);
    }
  }

  if (params.range && params.range.includes('/') && !seenHelp.has(WEAPON_PROPERTY_HELP.distancia.title)) {
    tips.push(`Alcance (${params.range}): ${WEAPON_PROPERTY_HELP.distancia.body}`);
  }

  if (sections.length === 0 && tips.length > 0) {
    sections.push(
      `${params.name} (${params.range}) — Dano ${params.damageLabel} ${params.damageType}. Veja abaixo o funcionamento detalhado de cada propriedade desta arma.`
    );
  }

  return {
    body: sections.join('\n\n'),
    tips,
  };
}

let cachedGlossary: SearchableGlossaryEntry[] | null = null;

export function getSearchableGlossary(): SearchableGlossaryEntry[] {
  if (cachedGlossary) return cachedGlossary;

  const list: SearchableGlossaryEntry[] = [];
  const pushEntry = (
    id: string,
    category: SearchableGlossaryEntry['category'],
    entry: RuleHelpEntry
  ) => {
    const searchText = normalizeSearchText(
      [
        entry.title,
        entry.subtitle ?? '',
        entry.body,
        ...(entry.tips ?? []),
        ...(entry.keywords ?? []),
        category,
      ].join(' ')
    );
    list.push({ id, category, ...entry, searchText });
  };

  for (const [key, entry] of Object.entries(WEAPON_PROPERTY_HELP)) {
    pushEntry(`wp_${key}`, 'Propriedade de Arma', entry);
  }

  for (const [masteryName, masteryDesc] of Object.entries(WEAPON_MASTERIES)) {
    pushEntry(`wm_${normalizeSearchText(masteryName)}`, 'Maestria em Arma', {
      title: `Maestria: ${masteryName}`,
      subtitle: 'Propriedade de Maestria em Arma (D&D 2024)',
      body: masteryDesc,
      keywords: ['maestria', 'arma', masteryName],
    });
  }

  for (let i = 0; i < COMBAT_AND_DAMAGE_GLOSSARY.length; i++) {
    const item = COMBAT_AND_DAMAGE_GLOSSARY[i];
    pushEntry(`combat_${i}`, item.category, item);
  }

  for (const cond of CONDITIONS_LIST) {
    pushEntry(`cond_${cond.id}`, 'Condição', {
      title: `Condição: ${cond.name}`,
      subtitle: 'Estado de Combate (D&D 2024)',
      body: cond.shortEffect,
      tips: cond.rules,
      keywords: ['condicao', 'estado', cond.name],
    });
  }

  for (let i = 0; i < STANDARD_ACTIONS_GLOSSARY.length; i++) {
    const act = STANDARD_ACTIONS_GLOSSARY[i];
    pushEntry(`act_${i}`, 'Combate & Ações', {
      title: `Ação: ${act.name}`,
      subtitle: '1 Ação em Combate',
      body: act.desc,
      keywords: ['acao', 'combate', act.name],
    });
  }

  for (let i = 0; i < RULES_GLOSSARY_SECTIONS.length; i++) {
    const sec = RULES_GLOSSARY_SECTIONS[i];
    pushEntry(`sec_${i}`, 'Combate & Ações', {
      title: sec.title,
      subtitle: 'Referência Rápida D&D 2024',
      body: sec.items.join('\n'),
      keywords: ['glossario', sec.title],
    });
  }

  for (const [key, entry] of Object.entries(ABILITY_RULE_HELP)) {
    pushEntry(`ab_${key}`, 'Atributo', entry);
  }

  for (const [key, entry] of Object.entries(SKILL_RULE_HELP)) {
    pushEntry(`sk_${key}`, 'Perícia', entry);
  }

  for (const [key, entry] of Object.entries(CORE_RULE_HELP)) {
    pushEntry(`core_${key}`, 'Regra da Ficha', entry);
  }

  cachedGlossary = list;
  return list;
}

export function searchGlossaryEntries(query: string, limit = 25): SearchableGlossaryEntry[] {
  const all = getSearchableGlossary();
  const q = normalizeSearchText(query.trim());
  if (!q) return all.slice(0, limit);
  const terms = q.split(/\s+/).filter(Boolean);
  const scored: { entry: SearchableGlossaryEntry; score: number }[] = [];

  for (const entry of all) {
    if (!terms.every((t) => entry.searchText.includes(t))) continue;
    const normTitle = normalizeSearchText(entry.title);
    let score = 1;
    if (normTitle === q) score = 100;
    else if (normTitle.startsWith(q)) score = 60;
    else if (normTitle.includes(q)) score = 35;
    else if (terms.every((t) => normTitle.includes(t))) score = 20;
    scored.push({ entry, score });
  }

  scored.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'pt-BR'));
  return scored.slice(0, limit).map((s) => s.entry);
}
