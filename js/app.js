'use strict';

const App = (() => {
  let rawData = [...(window.INITIAL_DATA || [])];
  let charts = {};
  let lastUpdatedAt = null;
  const monthsOrder = ['JANEIRO','FEVEREIRO','MARCO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
  const $ = id => document.getElementById(id);
  const brl = value => Number(value || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  const num = value => Number(value || 0).toLocaleString('pt-BR');
  const pct = value => `${(Number(value || 0) * 100).toLocaleString('pt-BR', { minimumFractionDigits:1, maximumFractionDigits:1 })}%`;
  const css = value => getComputedStyle(document.body).getPropertyValue(value).trim();
  const normalizeMonth = value => window.DashboardAPI.normalizeText(value);

  function toast(message, type = 'success') {
    const item = document.createElement('div');
    item.className = `toast ${type}`;
    item.textContent = message;
    $('toastRegion').appendChild(item);
    setTimeout(() => item.remove(), 4500);
  }

  function setSync(status, message, date = lastUpdatedAt) {
    $('syncDot').className = `sync-dot ${status}`;
    $('syncStatus').textContent = message;
    $('refreshBtn').disabled = status === 'loading';
    $('refreshBtn').classList.toggle('is-loading', status === 'loading');
    if (date) $('updatedAt').textContent = `Última atualização: ${new Date(date).toLocaleString('pt-BR')}`;
    const hours = date ? (Date.now() - new Date(date).getTime()) / 36e5 : Infinity;
    $('staleAlert').hidden = hours <= window.DASHBOARD_CONFIG.staleAfterHours;
  }

  async function synchronize({ notify = false } = {}) {
    setSync('loading', 'Sincronizando com o Google Sheets…');
    try {
      const result = await window.DashboardAPI.fetchOnline();
      rawData = result.rows;
      lastUpdatedAt = result.updatedAt;
      window.DashboardAPI.saveCache(result);
      $('dataSource').textContent = 'Google Sheets — online';
      fillFilters(true);
      render();
      setSync('online', 'Google Sheets conectado', lastUpdatedAt);
      if (notify) toast('Dados atualizados com sucesso.');
    } catch (error) {
      console.error(error);
      const cache = window.DashboardAPI.loadCache();
      if (cache) {
        rawData = cache.rows;
        lastUpdatedAt = cache.updatedAt;
        $('dataSource').textContent = 'Cache local';
        fillFilters(true);
        render();
        setSync('warning', 'Sem conexão — exibindo o último cache', lastUpdatedAt);
        if (notify) toast('Não foi possível acessar o Google Sheets. O cache foi mantido.', 'warning');
      } else {
        $('dataSource').textContent = 'Dados locais de contingência';
        fillFilters(true);
        render();
        setSync('error', 'Google Sheets indisponível — usando dados locais');
        if (notify) toast(error.message, 'error');
      }
    }
  }

  function orderedMonths(rows = rawData) {
    return [...new Set(rows.map(row => normalizeMonth(row.mes)))].sort((a,b) => monthsOrder.indexOf(a) - monthsOrder.indexOf(b));
  }

  function fillFilters(preserve = false) {
    const selectedMonth = preserve ? $('monthFilter').value : 'TODOS';
    const selectedSeller = preserve ? $('sellerFilter').value : 'TODOS';
    const months = orderedMonths();
    const sellers = [...new Set(rawData.map(row => row.vendedor))].sort();
    $('monthFilter').innerHTML = '<option value="TODOS">Todos os meses</option>' + months.map(month => `<option value="${month}">${month}</option>`).join('');
    $('sellerFilter').innerHTML = '<option value="TODOS">Todos</option>' + sellers.map(seller => `<option>${seller}</option>`).join('');
    if ([...$('monthFilter').options].some(option => option.value === selectedMonth)) $('monthFilter').value = selectedMonth;
    if ([...$('sellerFilter').options].some(option => option.value === selectedSeller)) $('sellerFilter').value = selectedSeller;
    const last = months.at(-1);
    $('generalGoalInput').value = rawData.find(row => normalizeMonth(row.mes) === last)?.metaGeral || 0;
  }

  function currentRows() {
    const month = $('monthFilter').value;
    const seller = $('sellerFilter').value;
    return rawData.filter(row => (month === 'TODOS' || normalizeMonth(row.mes) === month) && (seller === 'TODOS' || row.vendedor === seller));
  }

  function sum(rows) {
    return rows.reduce((acc,row) => ({ orcamentos:acc.orcamentos+row.orcamentos, vendas:acc.vendas+row.vendas, faturamento:acc.faturamento+row.faturamento }), { orcamentos:0, vendas:0, faturamento:0 });
  }

  function group(rows, key) {
    const output = {};
    rows.forEach(row => {
      const label = key === 'mes' ? normalizeMonth(row.mes) : row[key];
      output[label] ||= { label, orcamentos:0, vendas:0, faturamento:0, metaIndividual:0, metaGeral:0 };
      Object.assign(output[label], {
        orcamentos: output[label].orcamentos + row.orcamentos,
        vendas: output[label].vendas + row.vendas,
        faturamento: output[label].faturamento + row.faturamento,
        metaIndividual: output[label].metaIndividual + (row.metaIndividual || 0),
        metaGeral: Math.max(output[label].metaGeral, row.metaGeral || 0)
      });
    });
    return Object.values(output).map(item => ({ ...item, conversao:item.vendas/(item.vendas+item.orcamentos)||0, ticket:item.faturamento/item.vendas||0 }));
  }

  function previousTotal(seller = $('sellerFilter').value) {
    const selected = $('monthFilter').value;
    const index = monthsOrder.indexOf(selected);
    if (selected === 'TODOS' || index <= 0) return null;
    return sum(rawData.filter(row => normalizeMonth(row.mes) === monthsOrder[index-1] && (seller === 'TODOS' || row.vendedor === seller)));
  }

  function trend(current, previous, points = false) {
    if (previous === null || previous === undefined) return { text:'Selecione um mês para comparar', cls:'' };
    const delta = points ? current-previous : (previous ? (current-previous)/previous : 0);
    return { text:`${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta*100).toFixed(1)}${points ? ' p.p.' : '%'} vs mês anterior`, cls:delta >= 0 ? 'up' : 'down' };
  }

  function chartBase() {
    return { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ labels:{ color:css('--muted'), usePointStyle:true, boxWidth:8, font:{size:10} } } }, scales:{ x:{ticks:{color:css('--muted'),font:{size:9}},grid:{display:false}}, y:{ticks:{color:css('--muted'),font:{size:9}},grid:{color:css('--border')}} } };
  }
  function kill(name) { charts[name]?.destroy(); }

  function render() {
    const rows = currentRows();
    const total = sum(rows);
    const months = group(rows,'mes').sort((a,b) => monthsOrder.indexOf(a.label)-monthsOrder.indexOf(b.label));
    const sellers = group(rows,'vendedor').sort((a,b) => b.faturamento-a.faturamento);
    const baseGoal = Number($('generalGoalInput').value) || Math.max(...rows.map(row => row.metaGeral || 0),0);
    const monthCount = Math.max(new Set(rows.map(row => normalizeMonth(row.mes))).size,1);
    const effectiveGoal = $('monthFilter').value === 'TODOS' ? baseGoal*monthCount : baseGoal;
    const conversion = total.vendas/(total.vendas+total.orcamentos)||0;
    const attainment = effectiveGoal ? total.faturamento/effectiveGoal : 0;
    const previous = previousTotal();
    const previousConversion = previous ? previous.vendas/(previous.vendas+previous.orcamentos)||0 : null;
    const values = {
      kpiRevenue:brl(total.faturamento), kpiQuotes:num(total.orcamentos), kpiSales:num(total.vendas),
      kpiConversion:pct(conversion), kpiTicket:brl(total.faturamento/total.vendas||0), kpiAttainment:pct(attainment)
    };
    Object.entries(values).forEach(([id,value]) => $(id).textContent = value);
    $('kpiAttainmentText').textContent = attainment >= 1 ? 'Meta atingida' : `${brl(Math.max(effectiveGoal-total.faturamento,0))} restantes`;
    [['kpiRevenueTrend',trend(total.faturamento,previous?.faturamento)],['kpiQuotesTrend',trend(total.orcamentos,previous?.orcamentos)],['kpiSalesTrend',trend(total.vendas,previous?.vendas)],['kpiConversionTrend',trend(conversion,previousConversion,true)]].forEach(([id,item]) => { $(id).textContent=item.text; $(id).className=item.cls; });
    $('sidebarGoal').textContent=brl(effectiveGoal); $('sidebarAttainment').textContent=pct(attainment); $('sidebarProgress').style.width=`${Math.min(attainment*100,100)}%`; $('sidebarRealized').textContent=brl(total.faturamento); $('sidebarGap').textContent=brl(Math.max(effectiveGoal-total.faturamento,0));
    renderCharts(months,sellers,attainment);
    renderTables(sellers);
    renderFunnel(total,conversion);
    renderInsights(sellers,total,effectiveGoal,months);
  }

  function renderCharts(months,sellers,attainment) {
    const orange=css('--orange'), green=css('--green'), blue=css('--blue');
    kill('goalDonut'); charts.goalDonut=new Chart($('goalDonut'),{type:'doughnut',data:{datasets:[{data:[Math.min(attainment,1),Math.max(1-attainment,0)],backgroundColor:[green,css('--border')],borderWidth:0}]},options:{responsive:false,cutout:'72%',plugins:{legend:{display:false},tooltip:{enabled:false}}}});
    const labels=months.map(item=>item.label); const goals=months.map(item=>item.metaGeral||Number($('generalGoalInput').value)||0);
    kill('revenueLine'); charts.revenueLine=new Chart($('revenueLine'),{type:'line',data:{labels,datasets:[{label:'Faturamento',data:months.map(item=>item.faturamento),borderColor:blue,backgroundColor:'rgba(22,119,255,.10)',tension:.35,pointRadius:3},{label:'Meta',data:goals,borderColor:orange,borderDash:[6,5],pointRadius:2}]},options:chartBase()});
    kill('revenueGoal'); charts.revenueGoal=new Chart($('revenueGoal'),{type:'bar',data:{labels,datasets:[{label:'Faturamento',data:months.map(item=>item.faturamento),backgroundColor:blue,borderRadius:4},{label:'Meta',data:goals,backgroundColor:orange,borderRadius:4}]},options:chartBase()});
    kill('conversionLine'); charts.conversionLine=new Chart($('conversionLine'),{type:'line',data:{labels,datasets:[{label:'Conversão',data:months.map(item=>item.conversao*100),borderColor:blue,tension:.35,pointRadius:3},{label:'Referência',data:months.map(()=>50),borderColor:orange,borderDash:[6,5],pointRadius:2}]},options:{...chartBase(),scales:{...chartBase().scales,y:{...chartBase().scales.y,min:0,max:100,ticks:{callback:value=>`${value}%`}}}}});
    kill('sellerGoal'); charts.sellerGoal=new Chart($('sellerGoalChart'),{type:'bar',data:{labels:sellers.map(item=>item.label),datasets:[{data:sellers.map(item=>(item.metaIndividual?item.faturamento/item.metaIndividual:0)*100),backgroundColor:sellers.map(item=>item.faturamento/item.metaIndividual>=1?green:item.faturamento/item.metaIndividual>=.8?orange:'#e5484d'),borderRadius:4}]},options:{...chartBase(),indexAxis:'y',plugins:{legend:{display:false}}}});
  }

  function statusClass(value) { return value>=1?'good':value>=.8?'warn':'bad'; }
  function renderTables(sellers) {
    $('rankingBody').innerHTML=sellers.map((item,index)=>{const goal=item.metaIndividual?item.faturamento/item.metaIndividual:0;return `<tr><td>${index+1}</td><td><strong>${item.label}</strong></td><td>${brl(item.faturamento)}</td><td>${brl(item.metaIndividual)}</td><td class="${statusClass(goal)}">${pct(goal)}</td></tr>`;}).join('');
    $('detailsBody').innerHTML=sellers.map(item=>{const goal=item.metaIndividual?item.faturamento/item.metaIndividual:0; const previous=previousTotal(item.label); const delta=previous?.faturamento?(item.faturamento-previous.faturamento)/previous.faturamento:null; return `<tr><td><strong>${item.label}</strong></td><td>${num(item.orcamentos)}</td><td>${num(item.vendas)}</td><td>${pct(item.conversao)}</td><td>${brl(item.faturamento)}</td><td>${brl(item.ticket)}</td><td>${brl(item.metaIndividual)}</td><td class="${statusClass(goal)}">${pct(goal)}</td><td class="${delta===null?'':delta>=0?'good':'bad'}">${delta===null?'—':`${delta>=0?'↑':'↓'} ${Math.abs(delta*100).toFixed(1)}%`}</td></tr>`;}).join('');
  }

  function renderFunnel(total,conversion) {
    const opportunities=total.orcamentos+total.vendas;
    $('funnel').innerHTML=[['Oportunidades',opportunities,'#0878e8'],['Orçamentos',total.orcamentos,'#2eae55'],['Vendas',total.vendas,'#ff8b00'],['Conversão',pct(conversion),'#e53935']].map((item,index)=>`<div class="funnel-row" style="width:${100-index*12}%;background:${item[2]}"><div><small>${item[0]}</small>${typeof item[1]==='number'?num(item[1]):item[1]}</div></div>`).join('');
  }

  function renderInsights(sellers,total,goal,months) {
    const best=sellers[0]; const efficient=[...sellers].sort((a,b)=>b.conversao-a.conversao)[0]; const below=sellers.filter(item=>item.metaIndividual&&item.faturamento<item.metaIndividual); const latest=months.at(-1), previous=months.at(-2); const growth=previous?.faturamento?(latest.faturamento-previous.faturamento)/previous.faturamento:null;
    const cards=[
      `A loja alcançou <strong>${pct(total.faturamento/goal||0)}</strong> da meta no período selecionado.`,
      `<strong>${best?.label||'—'}</strong> lidera o faturamento com ${brl(best?.faturamento||0)}.`,
      `<strong>${efficient?.label||'—'}</strong> tem a maior conversão: ${pct(efficient?.conversao||0)}.`,
      growth===null?'Selecione um mês para analisar a variação mensal.':`O último mês está <strong class="${growth>=0?'good':'bad'}">${growth>=0?'acima':'abaixo'} ${Math.abs(growth*100).toFixed(1)}%</strong> do anterior.`,
      below.length?`Atenção às metas de <strong>${below.map(item=>item.label).join(', ')}</strong>.`:'Todos os vendedores atingiram suas metas.'
    ];
    $('insightCards').innerHTML=cards.map(text=>`<div class="insight-card">${text}</div>`).join('');
  }

  function exportCSV() {
    const header='Mês;Vendedor;Orçamentos;Vendas;Conversão;Faturamento;Meta Individual;Meta Geral\n';
    const body=currentRows().map(row=>[normalizeMonth(row.mes),row.vendedor,row.orcamentos,row.vendas,((row.vendas/(row.vendas+row.orcamentos)||0)*100).toFixed(2),row.faturamento.toFixed(2),row.metaIndividual.toFixed(2),row.metaGeral.toFixed(2)].join(';')).join('\n');
    const link=document.createElement('a'); link.href=URL.createObjectURL(new Blob(['\ufeff'+header+body],{type:'text/csv;charset=utf-8'})); link.download=`dashboard-eletrica-lima-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  function importWorkbook(file) {
    const reader=new FileReader();
    reader.onload=event=>{
      try {
        const workbook=XLSX.read(event.target.result,{type:'array'}); const sheet=workbook.Sheets['DADOS DASHBOARD'];
        if(!sheet) throw new Error('A aba DADOS DASHBOARD não foi encontrada.');
        const rows=XLSX.utils.sheet_to_json(sheet,{defval:0});
        const payload={vendas:rows.map(row=>({mes:row['MÊS']||row.MES,vendedor:row.VENDEDOR,orcamentos:row['ORÇAMENTOS']||row.ORCAMENTOS,vendas:row.VENDAS,faturamento:row.FATURAMENTO,metaIndividual:row['META INDIVIDUAL'],metaGeral:row['META GERAL']}))};
        const normalized=payload.vendas.map(row=>({...row,mes:normalizeMonth(row.mes),orcamentos:DashboardAPI.number(row.orcamentos),vendas:DashboardAPI.number(row.vendas),faturamento:DashboardAPI.number(row.faturamento),metaIndividual:DashboardAPI.number(row.metaIndividual),metaGeral:DashboardAPI.number(row.metaGeral)})).filter(row=>row.mes&&row.vendedor);
        if(!normalized.length) throw new Error('Nenhuma linha válida foi encontrada.');
        rawData=normalized; lastUpdatedAt=new Date().toISOString(); $('dataSource').textContent='Excel importado'; fillFilters(); render(); setSync('warning','Dados importados manualmente',lastUpdatedAt); toast('Planilha importada com sucesso.');
      } catch(error) { toast(error.message,'error'); }
    };
    reader.readAsArrayBuffer(file);
  }

  function bindEvents() {
    $('monthFilter').addEventListener('change',render); $('sellerFilter').addEventListener('change',render); $('generalGoalInput').addEventListener('input',render);
    $('refreshBtn').addEventListener('click',()=>synchronize({notify:true})); $('printBtn').addEventListener('click',()=>window.print()); $('csvBtn').addEventListener('click',exportCSV);
    $('excelInput').addEventListener('change',event=>event.target.files[0]&&importWorkbook(event.target.files[0]));
    $('themeBtn').addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem('eletrica-lima-theme',document.body.classList.contains('dark')?'dark':'light');render();});
    $('menuBtn').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
  }

  function init() {
    if(localStorage.getItem('eletrica-lima-theme')==='dark') document.body.classList.add('dark');
    fillFilters(); bindEvents(); render(); synchronize();
    setInterval(()=>synchronize(),window.DASHBOARD_CONFIG.refreshIntervalMinutes*60*1000);
  }
  return { init, synchronize };
})();

document.addEventListener('DOMContentLoaded', App.init);
