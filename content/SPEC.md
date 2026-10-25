# Especificação do conteúdo — Petit à Petit

App para brasileiros aprenderem francês, do A1 ao B1 (e além). Cada nível é um arquivo JSON
nesta pasta (`a1.json`, `a2.json`, `b1.json`, `mamie.json`), contendo **um array de unidades**.
O app gera exercícios automaticamente a partir dos campos abaixo (revisão espaçada, ditado,
shadowing, tradução PT→FR), então a qualidade do JSON é a qualidade do curso.

Valide sempre com: `node tools/validate.mjs content/<arquivo>.json`

## Princípios pedagógicos (siga à risca)

1. **Frases, não palavras soltas.** Cada card é uma frase ou bloco útil ("Je voudrais un café, s'il vous plaît.").
2. **Frequência primeiro.** Prefira o vocabulário e as estruturas mais comuns do francês falado de hoje.
3. **Francês real e atual**, natural, como um parisiense fala, sem soar como livro antigo. Registro claro:
   `tu` com família e amigos, `vous` com desconhecidos.
4. **Input compreensível.** Cada unidade reaproveita o que veio antes e introduz pouca coisa nova.
   Não use estruturas que ainda não foram vistas (ex.: nada de subjuntivo no A1), exceto como
   bloco fixo explicado ("je voudrais" no A1 é ok como bloco).
5. **O porquê.** As explicações "Pourquoi ?" explicam a lógica e **comparam com o português** sempre que
   ajudar. Português do Brasil, tom de conversa, curto, sem jargão (ou com o jargão explicado).
6. **Pronúncia.** Use o campo `note` dos cards para dicas de pronúncia em aproximação para brasileiros
   (ex.: "'vous avez' liga: [vu-za-vê]"), letras mudas, ligações, nasais, ou nuances de uso.

## Personagens (história contínua)

- **Léo** — brasileiro de ~32 anos, mora em São Paulo, neto de uma parisiense. Está aprendendo francês e vai a Paris visitar a avó.
- **Mamie Hélène** — a avó, 84 anos, nasceu e mora em Paris, no 15e arrondissement. Foi professora de piano. Carinhosa, espirituosa, fala com calma.
- **Camille** — prima de Léo, 28 anos, parisiense, designer gráfica, fala rápido e informal.
- **Monsieur Bernard** — vizinho da Mamie, aposentado, formal (usa `vous`), simpático.
- Outros papéis livres: garçom (`le serveur`), vendedora (`la vendeuse`), farmacêutico, motorista etc.

Léo usa `tu` com Mamie e Camille, `vous` com Monsieur Bernard e desconhecidos.

## Formato de cada unidade

```json
{
  "id": "a1-01",
  "level": "A1",
  "track": "main",
  "title": "Bonjour !",
  "titlePt": "Cumprimentar e se apresentar",
  "goal": "Cumprimentar alguém, dizer seu nome e perguntar como a pessoa está.",
  "dialogue": {
    "title": "Au café",
    "context": "Léo chega a um café perto da casa da avó e encontra a prima Camille.",
    "lines": [
      { "who": "Camille", "fr": "Salut Léo ! Ça va ?", "pt": "Oi, Léo! Tudo bem?" },
      { "who": "Léo", "fr": "Ça va bien, et toi ?", "pt": "Tudo bem, e você?" }
    ]
  },
  "cards": [
    { "id": "a1-01-01", "fr": "Bonjour, je m'appelle Léo.", "pt": "Bom dia, eu me chamo Léo.", "note": "O 'r' francês vem da garganta, parecido com o 'r' de 'carro' no Rio." }
  ],
  "pourquoi": [
    {
      "title": "Tu ou vous ?",
      "body": "Em francês existem duas formas de dizer 'você'...",
      "examples": [ { "fr": "Tu vas bien ?", "pt": "Você está bem? (informal)" } ]
    }
  ],
  "task": {
    "pt": "Apresente-se em 3 frases: seu nome, de onde você é e como você está.",
    "model": "Bonjour ! Je m'appelle Pedro. Je suis brésilien. Ça va très bien !"
  },
  "culture": "Em Paris, ao entrar numa loja, sempre diga 'Bonjour' — é considerado falta de educação não cumprimentar.",
  "glossary": {
    "bonjour": "bom dia / olá",
    "je": "eu",
    "m'": "me (antes de vogal)",
    "appelle": "chamo (s'appeler)",
    "ça": "isso",
    "va": "vai (aller)"
  }
}
```

### Regras dos campos

| Campo | Regra |
|---|---|
| `id` | `a1-01`…`a1-12`, `a2-01`…, `b1-01`…, `m-01`… (trilha Mamie). |
| `level` | `A1`, `A2`, `B1` ou `B2`. |
| `track` | `main` (trilha principal) ou `mamie` (trilha Mamie). |
| `title` | Em francês, curto. `titlePt` em português. |
| `goal` | Em PT, o que o aluno vai conseguir fazer (orientado a ação). |
| `dialogue.lines` | A1: 8–12 falas; A2/B1: 10–14 falas. Cada fala tem `who`, `fr`, `pt`. Natural, com um pouco de humor/afeto. |
| `cards` | **14–16 cards** por unidade. `id` = `<id da unidade>-NN` (01, 02… sequencial). Frases curtas (A1: 2–8 palavras; A2: até 10; B1: até 14). A maioria vem do diálogo ou é variação útil dele. Sem cards duplicados entre unidades. `note` é opcional (até ~140 caracteres); use em ~1/3 dos cards. |
| `pourquoi` | 1–3 itens. `body` com 50–160 palavras em PT-BR, pode usar `**negrito**` e `*itálico*`, quebras com `\n`. 2–4 `examples`. |
| `task` | Missão de produção livre (falar/escrever) em PT + uma resposta-modelo em FR usando o que a unidade ensinou. |
| `culture` | Opcional, 1–2 frases em PT sobre cultura francesa/parisiense ligada ao tema. |
| `glossary` | Chaves em **minúsculas**, exatamente na forma em que aparecem no texto (forma conjugada: `"suis": "sou / estou (être)"`). Valor curto em PT. Deve cobrir **todas** as palavras de `dialogue.lines[].fr`, `cards[].fr` e `pourquoi[].examples[].fr` da unidade, **exceto** as que já estão no glossário de outra unidade do mesmo arquivo. O validador lista as que faltam. |

### Como o glossário é consultado (tokenização)

- Um token é uma sequência de letras, que pode conter `'` e `-` no meio: `j'ai`, `aujourd'hui`, `qu'est-ce`, `appelles-tu`.
- O app procura o token inteiro (minúsculo) primeiro; se não achar, divide após cada apóstrofo e em cada hífen
  (`j'ai` → `j'` + `ai`; `qu'est-ce` → `qu'` + `est` + `ce`) e procura cada parte.
- Então: cadastre elisões **com o apóstrofo** (`"j'"`, `"l'"`, `"d'"`, `"c'"`, `"qu'"`, `"n'"`, `"s'"`, `"m'"`, `"t'"`).
- Expressões que perdem sentido se divididas devem ser cadastradas inteiras: `"aujourd'hui"`, `"peut-être"`, `"grand-mère"`, `"est-ce"` (ou `"est-ce"` dividido funciona também).
- Nomes próprios dos personagens (Léo, Hélène, Camille, Bernard) não precisam de entrada. Outros nomes próprios (Paris, Brésil, Montmartre…) precisam.
- Use apóstrofo reto `'` no JSON. Use espaço normal antes de `? ! : ;` (o app converte para espaço fino).
- Números escritos com algarismos não são tokens; prefira escrever por extenso nos cards quando o objetivo é aprender o número.

## Currículo

### A1 (`a1.json`, track `main`) — "Primeiros passos em Paris"
1. `a1-01` **Bonjour !** — cumprimentos, apresentar-se, ça va ; je suis / je m'appelle. Pourquoi: tu × vous; letras finais mudas.
2. `a1-02` **Je viens du Brésil** — nacionalidade, países, idiomas: je viens de, je parle, j'habite à. Pourquoi: gênero dos adjetivos (brésilien/brésilienne); preposições com países (en France, au Brésil, à Paris).
3. `a1-03` **Ma famille** — família, avoir, possessivos mon/ma/mes, números 1–20, idade. Pourquoi: idade com *avoir* ("j'ai trente ans" — como "tenho" em PT); mon amie antes de vogal.
4. `a1-04` **Au café** — pedir: je voudrais, un/une/des, du/de la, l'addition, números até 100, preços. Pourquoi: o partitivo (du pain), que não existe em PT; "je voudrais" como forma educada.
5. `a1-05` **Dans le métro** — direções, aller (je vais), à + le = au, où est…, c'est loin ?, à gauche/à droite/tout droit. Pourquoi: contrações au/aux/du/des.
6. `a1-06` **Ma journée** — rotina, verbos -er no presente, horas, verbos pronominais (je me lève). Pourquoi: as terminações mudas do -er (parle/parles/parlent soam igual); verbos pronominais como em PT ("eu me levanto").
7. `a1-07` **J'aime, je n'aime pas** — gostos: aimer/adorer/détester + artigo definido, ne…pas, faire du sport, jouer de/à. Pourquoi: negação ne…pas (e o "ne" que some na fala); "j'aime le café" com artigo (ideia geral).
8. `a1-08` **Au marché** — comprar comida, quantidades (un kilo de, un peu de), combien, cores, il y a. Pourquoi: "de" depois de quantidade e de negação (pas de pain).
9. `a1-09` **Ce week-end** — dias, meses, clima (il fait beau), futur proche (aller + infinitivo). Pourquoi: futuro próximo = "vou fazer" exatamente como em PT.
10. `a1-10` **Des questions** — perguntar: entonação, est-ce que, qu'est-ce que, où, quand, comment, pourquoi, combien, quel/quelle. Pourquoi: os três jeitos de perguntar e o registro de cada um.
11. `a1-11` **Hier** — passé composé com avoir (regulares e alguns irregulares comuns: j'ai fait, j'ai pris, j'ai vu, j'ai eu). Pourquoi: passé composé = pretérito perfeito do PT, mas formado com "ter".
12. `a1-12` **Chez Mamie** — passé composé com être (je suis allé(e), arrivé, parti, venu, resté, né), concordância. Pourquoi: por que alguns verbos usam *être* (movimento/mudança de estado).

### A2 (`a2.json`, track `main`) — "Paris au quotidien"
1. `a2-01` **Quand j'étais petit** — imparfait para descrever e hábitos no passado. Pourquoi: imparfait = pretérito imperfeito do PT ("eu brincava").
2. `a2-02` **Il était une fois** — imparfait × passé composé (cenário × acontecimento). Pourquoi: a lógica do "pano de fundo" vs "evento".
3. `a2-03` **Je le vois** — pronomes COD/COI: le, la, les, lui, leur, posição antes do verbo. Pourquoi: posição do pronome (como "eu o vejo" no PT formal).
4. `a2-04` **J'y vais, j'en veux** — os pronomes y e en. Pourquoi: y = "lá / nisso"; en = "disso / dele(s)".
5. `a2-05` **Chez le médecin** — corpo, j'ai mal à, il faut + infinitivo, devoir, pouvoir. Pourquoi: "j'ai mal à la tête" (estrutura com avoir + à).
6. `a2-06` **Des projets** — futur simple (je ferai, j'irai), si + presente → futuro. Pourquoi: futuro simples = infinitivo + terminações de *avoir*, como no PT ("farei").
7. `a2-07` **Au restaurant** — pedir, reclamar com educação, recomendar; pronomes relativos qui, que, où. Pourquoi: qui × que.
8. `a2-08` **Plus ou moins** — comparativo e superlativo; meilleur × mieux. Pourquoi: meilleur (adjetivo) × mieux (advérbio) = melhor × melhor, em PT a mesma palavra.
9. `a2-09` **Chez moi** — moradia, cômodos, preposições de lugar, depuis / il y a / pendant. Pourquoi: "j'habite ici depuis deux ans" (presente + depuis, onde o PT usa "há").
10. `a2-10` **Ce matin, je me suis levé tard** — verbos pronominais no passé composé, emoções e sensações. Pourquoi: pronominais sempre com *être* no passado.
11. `a2-11` **Au téléphone** — ligar, deixar recado, pronomes tônicos (moi, toi, lui…), c'est de la part de qui ? Pourquoi: pronomes tônicos ("c'est moi", "et toi ?").
12. `a2-12` **Si j'étais toi** — conditionnel presente: pedidos educados, conselhos, desejos (je voudrais, tu pourrais, à ta place je…). Pourquoi: conditionnel = futuro do pretérito do PT ("eu faria").

### B1 (`b1.json`, track `main`) — "Parler vraiment"
1. `b1-01` **Il faut que tu viennes** — subjuntivo presente após il faut que, je veux que, avant que. Pourquoi: subjuntivo existe em PT também ("é preciso que você **venha**").
2. `b1-02` **À mon avis** — dar opinião e argumentar: je pense que (indicativo) × je ne pense pas que (subjuntivo); d'abord, ensuite, pourtant, par contre, en fait. Pourquoi: certeza × dúvida.
3. `b1-03` **Si j'avais le temps** — hipóteses: si + imparfait → conditionnel. Pourquoi: igual ao PT ("se eu tivesse… eu faria").
4. `b1-04` **Ce jour-là** — contar histórias: plus-que-parfait, encadeamento de tempos, marcadores (soudain, finalement, au bout d'un moment). Pourquoi: plus-que-parfait = "tinha feito".
5. `b1-05` **Elle m'a dit que…** — discurso indireto, concordância de tempos, il m'a demandé si… Pourquoi: como os tempos "recuam".
6. `b1-06` **Ce dont j'ai besoin** — relativos: dont, ce qui, ce que, lequel/auquel. Pourquoi: dont = "de que / cujo".
7. `b1-07` **En marchant** — gerúndio (en + -ant), simultaneidade e modo. Pourquoi: "en marchant" = "andando" (e por que precisa do "en").
8. `b1-08` **Le français de la rue** — francês falado: on = nous, queda do "ne", "t'as", "y a", ouais, bof, carrément, ça marche, verlan básico (relou, chelou, ouf). Pourquoi: registro escrito × falado; quando usar.
9. `b1-09` **Les infos** — notícias e atualidade: voz passiva, "on" impessoal, nominalizações simples. Pourquoi: passiva × "on".
10. `b1-10` **Si j'avais su** — arrependimento e desejos: conditionnel passé (j'aurais dû, j'aurais aimé), si + plus-que-parfait. Pourquoi: igual ao PT ("eu deveria ter…", "se eu tivesse sabido…").

### Trilha Mamie (`mamie.json`, track `mamie`) — "Parler avec Mamie"
O objetivo é que o aluno consiga conversar com a avó parisiense. Sempre `tu`. Muito afeto, frases que se usam de verdade com avós.
1. `m-01` (A1) **Allô Mamie ?** — telefonar: "Allô Mamie, c'est moi !", "Tu m'entends ?", "Comment tu vas ?", "Tu me manques", despedidas carinhosas. Pourquoi: "tu me manques" = "sinto sua falta" (sujeito invertido!).
2. `m-02` (A1) **Je t'embrasse** — mensagens e cartões: bisous, gros bisous, je pense à toi, prends soin de toi, à bientôt, joyeux anniversaire. Pourquoi: "je t'embrasse" não é literal (despedida carinhosa).
3. `m-03` (A1) **À table chez Mamie** — almoço de família: c'est délicieux, je peux en reprendre ?, tu me donnes la recette ?, bon appétit, santé, j'ai trop mangé. Pourquoi: "en" em "j'en veux bien" como bloco fixo.
4. `m-04` (A2) **Ma vie au Brésil** — contar à avó sobre trabalho, rotina, família, planos (presente, passé composé, futur proche). Pourquoi: como contar novidades usando os 3 tempos básicos.
5. `m-05` (A2) **Raconte-moi, Mamie** — pedir e entender lembranças: "Comment c'était, Paris, quand tu étais jeune ?", imparfait para compreensão. Pourquoi: imparfait como "tempo das lembranças".
6. `m-06` (A2) **Le Paris de Mamie** — o bairro dela, arrondissements, padaria, mercado, metrô, expressões parisienses antigas e atuais. Pourquoi: como os parisienses falam dos lugares ("dans le 15e", "rive gauche").

### B2 (`b2.json`, track `main`) — "Aisance"
Léo agora mora parte do ano em Paris (studio no prédio da Mamie, trabalha remoto como engenheiro). Camille e o namorado Hugo pensam em se mudar para Lyon. Monsieur Bernard é o vizinho de cima. Frases de até ~16 palavras; francês natural e variado.
1. `b2-01` **Je suis ravi que tu sois venu** — subjuntivo passado e sentimentos (être content/désolé/étonné que + subj. passé). Pourquoi: "que você tenha vindo".
2. `b2-02` **Bien que…** — nuançar opinião: il me semble que, j'ai l'impression que, il se peut que, bien que/quoique + subj., même si + indicativo. Pourquoi: bien que × même si.
3. `b2-03` **Au bureau** — registro profissional, e-mails e reuniões: je vous prie de, n'hésitez pas à, ci-joint, je reviens vers vous, faire le point. Pourquoi: fórmulas de cortesia e o "vous" profissional.
4. `b2-04` **Les expressions imagées** — idiomatismes frequentes: coûter les yeux de la tête, poser un lapin, avoir le cafard, tomber dans les pommes, mettre son grain de sel, ce n'est pas la mer à boire. Pourquoi: entender pela imagem, não pela tradução literal.
5. `b2-05` **Il était une fois… le passé simple** — reconhecer o passé simple em contos e livros (il fut, elle alla, ils dirent); Mamie lê um conto para Léo. Pourquoi: passé simple é da escrita; reconhecer, não precisa usar falando.
6. `b2-06` **Pour que tout aille bien** — causa, consequência e finalidade: puisque, comme, étant donné que, si bien que, de sorte que, afin que/pour que + subj. Pourquoi: "para que" pede subjuntivo nas duas línguas.
7. `b2-07` **Je le lui ai dit** — pronomes duplos e ordem: je le lui ai dit, il m'en a parlé, vas-y, donne-le-moi, ne me le dis pas. Pourquoi: a ordem dos pronomes (me/te/se/nous/vous → le/la/les → lui/leur → y → en).
8. `b2-08` **Certes, mais…** — debater com nuance: certes… mais, il n'empêche que, en revanche, quand bien même, je vous l'accorde; interromper com educação. Pourquoi: concessão (admitir para depois discordar).
9. `b2-09` **La France d'aujourd'hui** — sociedade e atualidade: la grève, la hausse des prix, le pouvoir d'achat, l'écologie, les élections; nominalização. Pourquoi: nominalização (augmenter → la hausse).
10. `b2-10` **Quand tu auras fini** — futur antérieur e hipóteses complexas: quand tu auras fini, dès que j'aurai reçu, j'aurais dû, si j'avais su. Pourquoi: futur antérieur = "terei feito".

### C1 (`c1.json`, track `main`) — "Maîtrise"
Léo já conversa com fluência; o foco é nuance, registro, implícito e cultura. Frases de até ~18 palavras.
1. `c1-01` **Les registres** — familier, courant, soutenu: a mesma ideia em três registros (bouquin/livre/ouvrage, bosser/travailler/œuvrer). Pourquoi: quando cada registro cabe.
2. `c1-02` **L'implicite et l'ironie** — litote ("ce n'est pas mal" = é ótimo), antífrase, ironia, o understatement francês. Pourquoi: a litote.
3. `c1-03` **Argumenter avec élégance** — conectores avançados: or, toutefois, néanmoins, en outre, par ailleurs, dès lors, force est de constater. Pourquoi: "or" (= ora) e o encadeamento lógico.
4. `c1-04` **La langue littéraire** — reconhecer subjonctif imparfait (qu'il fût), inversões (peut-être est-il…), ne explétif (avant qu'il ne parte, je crains qu'il ne vienne), ne sozinho (je ne sais). Pourquoi: o "ne" que não nega.
5. `c1-05` **Parler comme un Parisien** — gírias e oral rápido atuais: bosser, kiffer, galérer, avoir le seum, chelou, ouf, tkt, chais pas, t'sais. Pourquoi: por que o francês falado "engole" sílabas.
6. `c1-06` **Références culturelles** — expressões vindas da cultura: la madeleine de Proust, c'est kafkaïen, l'esprit de l'escalier, un dialogue de sourds, Piaf, Brel, le cinéma. Pourquoi: referências que os franceses usam sem explicar.
7. `c1-07` **Négocier et convaincre** — mundo profissional avançado: je me permets de, à cet égard, il conviendrait de, sauf erreur de ma part, atenuação e diplomacia. Pourquoi: a arte de atenuar (hedging).
8. `c1-08` **Les faux amis** — falsos cognatos PT→FR: attendre (esperar), prétendre (afirmar), la salade, la tasse, un costume, sensible, la journée, un rapport. Pourquoi: as armadilhas mais comuns para brasileiros.
9. `c1-09` **Les nuances des émotions** — vocabulário fino de sentimentos: être aux anges, en avoir ras-le-bol, être dépité, avoir le mal du pays, être bouleversé, avoir un pincement au cœur. Pourquoi: intensidade e matiz.
10. `c1-10` **Une lettre pour Mamie** — ler e escrever uma carta longa, afetuosa e cuidada para a avó: lembranças, gratidão, planos; fórmulas de carta (Ma très chère Mamie… Je t'embrasse tendrement). Pourquoi: a estrutura de uma carta francesa. É o fim emocionante da jornada.
