'use strict';

window.DashboardAPI = (() => {
  const config = window.DASHBOARD_CONFIG;

  function normalizeText(value) {
    return String(value ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function number(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const text = String(value ?? '').trim().replace(/[R$\s%]/g, '');
    const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function normalizeSales(payload) {
    const source = payload.vendas || payload.dados || payload.data || [];
    return source.map(row => ({
      data: row.data || '',
      mes: normalizeText(row.mes || row['MÊS'] || row.MES),
      vendedor: String(row.vendedor || row.VENDEDOR || '').trim(),
      orcamentos: number(row.orcamentos ?? row['ORÇAMENTOS'] ?? row.ORCAMENTOS),
      vendas: number(row.vendas ?? row.VENDAS),
      faturamento: number(row.faturamento ?? row.FATURAMENTO),
      metaIndividual: number(row.metaIndividual ?? row['META INDIVIDUAL']),
      metaGeral: number(row.metaGeral ?? row['META GERAL'] ?? row.metaLoja)
    })).filter(row => row.mes && row.vendedor);
  }

  function applyGoals(rows, payload) {
    const goals = Array.isArray(payload.metas) ? payload.metas : [];
    if (!goals.length) return rows;
    const map = new Map(goals.map(goal => [normalizeText(goal.mes), goal]));
    return rows.map(row => {
      const goal = map.get(row.mes) || {};
      const sellers = goal.vendedores || {};
      return {
        ...row,
        metaGeral: row.metaGeral || number(goal.metaLoja ?? goal.metaGeral),
        metaIndividual: row.metaIndividual || number(sellers[row.vendedor] ?? goal[row.vendedor])
      };
    });
  }

  function validate(payload) {
    if (!payload || payload.sucesso === false) throw new Error(payload?.erro || 'A API informou uma falha.');
    const rows = applyGoals(normalizeSales(payload), payload);
    if (!rows.length) throw new Error('Nenhum registro válido foi retornado pelo Google Sheets.');
    return { rows, updatedAt: payload.atualizadoEm || new Date().toISOString() };
  }

  async function fetchOnline() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const separator = config.appsScriptUrl.includes('?') ? '&' : '?';
      const response = await fetch(`${config.appsScriptUrl}${separator}t=${Date.now()}`, {
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Google Sheets respondeu com HTTP ${response.status}.`);
      return validate(await response.json());
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('A atualização excedeu o tempo limite.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function saveCache(result) {
    try { localStorage.setItem(config.cacheKey, JSON.stringify(result)); } catch (error) { console.warn('Cache indisponível:', error); }
  }

  function loadCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(config.cacheKey));
      return cached?.rows?.length ? cached : null;
    } catch { return null; }
  }

  return { fetchOnline, saveCache, loadCache, normalizeText, number };
})();
