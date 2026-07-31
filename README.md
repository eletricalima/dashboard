# Dashboard Comercial 5.0 — Elétrica Lima

Dashboard em HTML, CSS e JavaScript puro, publicado pelo GitHub Pages e alimentado pelo Google Sheets via Apps Script.

## Recursos

- sincronização ao abrir e a cada 30 minutos;
- botão **Atualizar agora**;
- cache local e dados de contingência;
- conexão, fonte ativa e última atualização visíveis;
- alerta para dados com mais de 24 horas;
- metas geral e individuais;
- comparação com o mês anterior;
- ranking, funil, gráficos e insights automáticos;
- importação de Excel, CSV e impressão/PDF;
- temas claro/escuro, responsividade e logomarca oficial.

## Estrutura

- `index.html`: interface;
- `css/style.css`: identidade visual e responsividade;
- `js/config.js`: URL e parâmetros de sincronização;
- `js/api.js`: comunicação, normalização e cache;
- `js/app.js`: indicadores, filtros, gráficos e exportações;
- `js/data.js`: contingência local;
- `assets/logo.png`: logomarca;
- `dados/`: planilha modelo.

## Resposta esperada do Apps Script

```json
{
  "sucesso": true,
  "atualizadoEm": "2026-07-31T12:00:00.000Z",
  "vendas": [
    {
      "mes": "JULHO",
      "vendedor": "Alexandre",
      "orcamentos": 167,
      "vendas": 201,
      "faturamento": 652017.23
    }
  ],
  "metas": [
    {
      "mes": "JULHO",
      "metaLoja": 1550000,
      "vendedores": { "Alexandre": 600000 }
    }
  ]
}
```

As metas também podem vir em cada venda como `metaIndividual` e `metaGeral`.

## Uso e diagnóstico

1. Acesse o GitHub Pages.
2. Aguarde o indicador ficar verde.
3. Use os filtros ou **Atualizar agora**.
4. Verde significa dados online; laranja, cache/importação; vermelho, contingência local.
5. Se a carga válida tiver mais de 24 horas, o painel exibe um alerta.

Para desenvolvimento local, sirva a pasta por HTTP. Abrir `index.html` diretamente pode limitar requisições externas em alguns navegadores.

## GitHub Pages

Configure `Settings → Pages → Deploy from a branch → main → / (root)`.

## Segurança

O Apps Script deve ser somente leitura. Não exponha credenciais ou dados sensíveis no JSON.
