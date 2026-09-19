# AGENTS.md

## Fluxo de trabalho obrigatório

Este projeto é o **CRM StartGI** e está conectado ao repositório GitHub:

- Repo: `https://github.com/julianomcaldeira/crmstartgi.git`
- Branch: `main` (tracking `origin/main`)

Após **qualquer** alteração no código, o fluxo obrigatório é:

1. `npm run build` (verificar que compila sem erros)
2. `npm run lint` (se houver erros de lint, corrigir)
3. `git add <arquivos alterados>`
4. `git commit -m "<mensagem descritiva da alteração>"`
5. `git push origin main`

O push para o GitHub é o que faz o **Lovable** refletir as mudanças no deploy. Nunca finalizar uma tarefa sem commit + push.

## Comandos

- Instalar deps: `npm install`
- Rodar dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`