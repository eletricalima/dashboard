# Dashboard Comercial — Elétrica Lima

Dashboard web responsivo para analisar **orçamentos em aberto, vendas, conversão e faturamento** por vendedor.

## Como abrir

1. Extraia o arquivo ZIP mantendo a estrutura de pastas.
2. Abra `index.html` no Google Chrome ou Microsoft Edge.
3. É necessário acesso à internet na primeira abertura para carregar Chart.js e SheetJS.

## Atualizar com uma nova planilha

Clique em **Importar Excel** e selecione a planilha atualizada. O arquivo deve manter o mesmo padrão da planilha original:

- uma linha com o mês e os nomes dos vendedores;
- linha de `ORÇAMENTOS`;
- linha de `VENDAS`;
- linha de `TX CONVERSAO`;
- linha de `TOTAL VENDAS`.

O navegador lê a planilha localmente; nenhum dado é enviado para servidores externos.

## Funcionalidades

- filtros por mês e vendedor;
- KPIs de faturamento, conversão, vendas, orçamentos, ticket médio e líder;
- gráficos de evolução, ranking, conversão e volume;
- funil comercial;
- insight gerencial automático;
- tabela detalhada e exportação CSV;
- modo escuro e impressão/PDF.

## Estrutura

```
index.html
css/style.css
js/data.js
js/app.js
dados/vendas.xlsx
```

## Publicação gratuita

O projeto pode ser publicado pelo GitHub Pages em **Settings → Pages → Deploy from a branch → main / root**.
