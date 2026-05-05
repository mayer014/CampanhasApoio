export type Seg = { start: number; end: number; text: string; scene: string };

export const SEGMENTS: Seg[] = [
  { start: 0.00, end: 4.50, text: "Resumo direto sobre a plataforma fotodeapoiador.", scene: "title" },
  { start: 4.50, end: 10.20, text: "Muito candidato perde voto porque o eleitor não tem como mostrar apoio público.", scene: "problem" },
  { start: 10.20, end: 17.80, text: "A ferramenta transforma um eleitor comum em máquina de marketing em 30 segundos.", scene: "speed" },
  { start: 17.80, end: 23.10, text: "Um megafone digital automático: o eleitor divulga por você.", scene: "megaphone" },
  { start: 23.10, end: 25.20, text: "A mecânica é super simples.", scene: "stepIntro" },
  { start: 25.20, end: 29.40, text: "A campanha monta um template em 5 camadas.", scene: "editor" },
  { start: 29.40, end: 32.10, text: "Para o eleitor, bastam três toques.", scene: "threeTaps" },
  { start: 32.10, end: 35.00, text: "Acessa o link, manda a foto e pronto.", scene: "phoneFlow" },
  { start: 35.00, end: 39.30, text: "As pessoas usariam isso? Com certeza.", scene: "yes" },
  { start: 39.30, end: 44.80, text: "Sem baixar app: a barreira de entrada é zero.", scene: "noApp" },
  { start: 44.80, end: 50.90, text: "Por ser tão fácil, a coisa viraliza organicamente.", scene: "viralIntro" },
  { start: 50.90, end: 54.70, text: "Cada apoiador que posta alcança mais de 200 contatos.", scene: "viral200" },
  { start: 54.70, end: 60.40, text: "Multiplica a visibilidade sem gastar um centavo a mais.", scene: "freeReach" },
  { start: 60.40, end: 64.50, text: "O verdadeiro ouro é a coleta de dados.", scene: "goldData" },
  { start: 64.50, end: 73.20, text: "Cada pessoa que gera a arte vira contato real no seu CRM.", scene: "crm" },
  { start: 73.20, end: 81.80, text: "Nome, telefone e bairro: planilha pronta para WhatsApp em massa.", scene: "excel" },
  { start: 81.80, end: 87.40, text: "Apartidário, ativado em minutos.", scene: "domain" },
  { start: 87.40, end: 97.27, text: "Likes invisíveis viram um banco de dados poderoso antes da eleição.", scene: "finale" },
];

export const FPS = 30;
export const TOTAL = Math.ceil(97.27 * FPS);
