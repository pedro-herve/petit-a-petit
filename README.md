# Petit à Petit

**Francês de verdade, um pouco por dia.** App web (PWA) gratuito para brasileiros aprenderem francês, do A1 ao B1, com uma trilha especial para conversar com a família francesa ("Trilha Mamie"). Instala na tela de início do iPhone, funciona offline e não tem custo nenhum: nem para quem mantém, nem para quem usa.

> « Petit à petit, l'oiseau fait son nid. » Pouco a pouco, o passarinho faz seu ninho.

## O método

| Princípio | Como aparece no app |
|---|---|
| Repetição espaçada (FSRS-5, o algoritmo do Anki moderno) | Cada frase volta pouco antes de você esquecer. Você avalia: Errei / Difícil / Bom / Fácil. |
| Recuperação ativa | Você tenta lembrar (ou falar/escrever) antes de ver a resposta. |
| Input compreensível | Diálogos curtos com áudio: primeiro só ouvir, depois ler tocando nas palavras. |
| Frases, não palavras | Os cards são blocos úteis ("Je voudrais un café, s'il vous plaît."). |
| O porquê | Explicações "Pourquoi ?" curtas, sempre comparando com o português. |
| Produção | PT→FR falando ou escrevendo, ditado, missões de escrita e conversa com IA. |
| Ouvido e pronúncia | Shadowing com gravação da sua voz e, quando o aparelho permite, reconhecimento de fala. |
| Hábito | Você escolhe os minutos por dia; o app ajusta quantas frases novas entram (≈ 0,6 por minuto, entre 3 e 30) e reduz as novas quando as revisões acumulam. |

## Conteúdo

| Arquivo | Nível | Unidades |
|---|---|---|
| `content/a1.json` | A1 · Primeiros passos em Paris | 12 |
| `content/mamie.json` | Trilha Mamie (A1–A2) | 6 |
| `content/a2.json` | A2 · Paris au quotidien | 12 |
| `content/b1.json` | B1 · Parler vraiment | 10 |

Cada unidade tem diálogo, 14–16 frases com áudio, explicações "Pourquoi ?", missão de produção, nota cultural e glossário palavra por palavra. A Trilha Mamie é intercalada na ordem principal no momento em que a gramática necessária já foi vista (veja `ORDER` em `js/content.js`).

**B2/C1 e temas extras:** em *Praticar → Criar lição com IA*, o app gera um prompt para a versão gratuita do Claude ou do ChatGPT; a resposta (JSON) é colada de volta e vira uma lição completa em "Minhas lições".

Para escrever lições novas à mão, siga `content/SPEC.md` e valide:

```bash
npm run validate
```

## Rodar localmente

Não há build nem dependências.

```bash
npm run serve
```

Abra http://localhost:5173.

## Publicar de graça (GitHub Pages)

1. Crie um repositório **público** no GitHub (o Pages grátis exige repositório público) e envie este projeto.
2. No repositório: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, pasta `/ (root)`. Salve.
3. Em ~1 minuto o app estará em `https://<seu-usuario>.github.io/petit-a-petit/`.
4. No iPhone, abra esse link no **Safari → Compartilhar → Adicionar à Tela de Início**.

Para mandar para outras pessoas, é só compartilhar o link (há um botão *Compartilhar o app* em Perfil). Cada pessoa tem o seu próprio progresso.

**Ao atualizar o app:** mude `VERSION` em `sw.js` (e em `js/views/profile.js`) para os celulares baixarem a versão nova.

## Ativar login (opcional, grátis)

Sem configuração, o app usa um perfil local (o progresso fica no aparelho; há exportar/importar backup em Perfil). Para ter **conta com e-mail e senha** e progresso sincronizado entre aparelhos, use o Firebase no plano **Spark (gratuito, sem cartão)**:

1. Acesse https://console.firebase.google.com → **Adicionar projeto** (pode desativar o Google Analytics).
2. **Build → Authentication → Get started → Sign-in method → E-mail/senha → Ativar.**
3. **Build → Firestore Database → Criar banco de dados** (modo produção, região `southamerica-east1` ou a mais próxima).
4. Na aba **Regras** do Firestore, cole o conteúdo de `firestore.rules` e publique.
5. **Configurações do projeto (⚙️) → Seus apps → Web (`</>`)** → registre o app → copie o objeto `firebaseConfig`.
6. Cole em `js/config.js` (substituindo `null`) e publique de novo.
7. Em **Authentication → Settings → Authorized domains**, adicione `<seu-usuario>.github.io`.

Pronto: na primeira abertura aparece *Criar conta grátis / Já tenho conta*. Quem já usava sem conta pode levar o progresso para a conta nova.

A configuração do Firebase para apps web é pública por natureza; a segurança vem das regras do Firestore (cada usuário só lê e escreve o próprio documento).

**Limites do plano gratuito** (sobram para uso pessoal e de família/amigos): 1 GB armazenado, 50 mil leituras e 20 mil gravações por dia no Firestore. Cada sincronização usa 1 leitura e 1 gravação.

## Custos

| Item | Solução | Custo |
|---|---|---|
| Hospedagem | GitHub Pages | R$ 0 |
| Áudio | Vozes francesas do próprio aparelho (Web Speech API) | R$ 0 |
| Login e sincronização | Firebase Spark (opcional) | R$ 0 |
| Conversa e correção com IA | Prompt pronto para a conta gratuita do Claude/ChatGPT | R$ 0 |
| Lembrete diário | Evento recorrente no Calendário (.ics) | R$ 0 |

**Dica de áudio no iPhone:** Ajustes → Acessibilidade → Conteúdo Falado → Vozes → Francês → baixe uma voz "Melhorada" ou "Premium" e selecione-a em Perfil → Áudio.

## Estrutura

```
index.html, manifest.webmanifest, sw.js   PWA (instalação e modo offline)
css/app.css                               visual (claro/escuro)
js/app.js                                 inicialização e rotas
js/fsrs.js                                algoritmo de repetição espaçada (FSRS-5)
js/store.js, js/sync.js, js/auth.js       progresso local, backup e sincronização opcional
js/content.js                             carga das lições e ordem de estudo
js/speech.js                              voz, gravação e reconhecimento
js/ai.js                                  prompts para IA gratuita e importação de lições
js/views/*.js                             telas (Hoje, Trilha, Praticar, Caderno, Perfil, sessão)
content/*.json                            lições
tools/validate.mjs, tools/serve.mjs       validação do conteúdo e servidor local
```
