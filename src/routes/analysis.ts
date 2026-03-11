import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const analysisApi = new Hono<{ Bindings: Bindings }>()

// GET /api/analysis/variance - Variance analysis (plan vs actual, forecast vs actual)
analysisApi.get('/variance', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'
  const groupBy = c.req.query('group_by') || 'system' // system, category, item, domain

  let sql = ''
  if (groupBy === 'system') {
    sql = `
      SELECT s.id as group_id, s.name as group_name, s.code as group_code,
        sd.name as parent_name,
        COALESCE(SUM(bd.initial_plan), 0) as initial_plan,
        COALESCE(SUM(bd.revised_plan), 0) as revised_plan,
        COALESCE(SUM(bd.forecast), 0) as forecast,
        COALESCE(SUM(bd.actual), 0) as actual
      FROM systems s
      JOIN system_domains sd ON s.domain_id = sd.id
      LEFT JOIN budget_data bd ON s.id = bd.system_id AND bd.fiscal_year_id = ?
      WHERE s.is_active = 1
      GROUP BY s.id ORDER BY sd.sort_order, s.sort_order`
  } else if (groupBy === 'category') {
    sql = `
      SELECT ec.id as group_id, ec.name as group_name, ec.code as group_code,
        '' as parent_name,
        COALESCE(SUM(bd.initial_plan), 0) as initial_plan,
        COALESCE(SUM(bd.revised_plan), 0) as revised_plan,
        COALESCE(SUM(bd.forecast), 0) as forecast,
        COALESCE(SUM(bd.actual), 0) as actual
      FROM expense_categories ec
      LEFT JOIN expense_items ei ON ec.id = ei.category_id
      LEFT JOIN budget_data bd ON ei.id = bd.expense_item_id AND bd.fiscal_year_id = ?
      WHERE ec.is_active = 1
      GROUP BY ec.id ORDER BY ec.sort_order`
  } else if (groupBy === 'item') {
    sql = `
      SELECT ei.id as group_id, ei.name as group_name, ei.code as group_code,
        ec.name as parent_name,
        COALESCE(SUM(bd.initial_plan), 0) as initial_plan,
        COALESCE(SUM(bd.revised_plan), 0) as revised_plan,
        COALESCE(SUM(bd.forecast), 0) as forecast,
        COALESCE(SUM(bd.actual), 0) as actual
      FROM expense_items ei
      JOIN expense_categories ec ON ei.category_id = ec.id
      LEFT JOIN budget_data bd ON ei.id = bd.expense_item_id AND bd.fiscal_year_id = ?
      WHERE ei.is_active = 1
      GROUP BY ei.id ORDER BY ec.sort_order, ei.sort_order`
  } else { // domain
    sql = `
      SELECT sd.id as group_id, sd.name as group_name, sd.code as group_code,
        '' as parent_name,
        COALESCE(SUM(bd.initial_plan), 0) as initial_plan,
        COALESCE(SUM(bd.revised_plan), 0) as revised_plan,
        COALESCE(SUM(bd.forecast), 0) as forecast,
        COALESCE(SUM(bd.actual), 0) as actual
      FROM system_domains sd
      LEFT JOIN systems s ON sd.id = s.domain_id
      LEFT JOIN budget_data bd ON s.id = bd.system_id AND bd.fiscal_year_id = ?
      WHERE sd.is_active = 1
      GROUP BY sd.id ORDER BY sd.sort_order`
  }

  const result = await c.env.DB.prepare(sql).bind(fyId).all()

  const rows = (result.results as any[]).map(r => {
    const planVsActual = r.revised_plan - r.actual
    const forecastVsActual = r.forecast - r.actual
    const planVsActualRate = r.revised_plan > 0 ? Math.round(((r.actual - r.revised_plan) / r.revised_plan) * 1000) / 10 : 0
    const forecastVsPlan = r.forecast - r.revised_plan
    const forecastVsPlanRate = r.revised_plan > 0 ? Math.round(((r.forecast - r.revised_plan) / r.revised_plan) * 1000) / 10 : 0
    const consumptionRate = r.revised_plan > 0 ? Math.round((r.actual / r.revised_plan) * 1000) / 10 : 0

    return {
      ...r,
      planVsActual,
      forecastVsActual,
      planVsActualRate,
      forecastVsPlan,
      forecastVsPlanRate,
      consumptionRate
    }
  })

  return c.json({ data: rows })
})

// GET /api/analysis/period - Aggregation by period (quarter, half-year)
analysisApi.get('/period', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'
  const period = c.req.query('period') || 'quarter' // quarter, half

  let periodExpr = ''
  if (period === 'quarter') {
    periodExpr = `CASE
      WHEN month BETWEEN 1 AND 3 THEN 'Q1'
      WHEN month BETWEEN 4 AND 6 THEN 'Q2'
      WHEN month BETWEEN 7 AND 9 THEN 'Q3'
      ELSE 'Q4' END`
  } else {
    periodExpr = `CASE
      WHEN month BETWEEN 1 AND 6 THEN 'H1'
      ELSE 'H2' END`
  }

  const result = await c.env.DB.prepare(`
    SELECT ${periodExpr} as period_label,
      COALESCE(SUM(initial_plan), 0) as initial_plan,
      COALESCE(SUM(revised_plan), 0) as revised_plan,
      COALESCE(SUM(forecast), 0) as forecast,
      COALESCE(SUM(actual), 0) as actual
    FROM budget_data WHERE fiscal_year_id = ?
    GROUP BY period_label ORDER BY period_label
  `).bind(fyId).all()

  return c.json({ data: result.results })
})

// GET /api/analysis/system-detail - Detailed breakdown for a specific system
analysisApi.get('/system-detail', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'
  const systemId = c.req.query('system_id')

  if (!systemId) return c.json({ error: 'system_id is required' }, 400)

  const [system, items, monthly] = await Promise.all([
    c.env.DB.prepare('SELECT s.*, sd.name as domain_name FROM systems s JOIN system_domains sd ON s.domain_id = sd.id WHERE s.id = ?').bind(systemId).first(),
    c.env.DB.prepare(`
      SELECT ei.id, ei.name, ei.code, ec.name as category_name,
        COALESCE(SUM(bd.initial_plan), 0) as initial_plan,
        COALESCE(SUM(bd.revised_plan), 0) as revised_plan,
        COALESCE(SUM(bd.forecast), 0) as forecast,
        COALESCE(SUM(bd.actual), 0) as actual
      FROM expense_items ei
      JOIN expense_categories ec ON ei.category_id = ec.id
      LEFT JOIN budget_data bd ON ei.id = bd.expense_item_id AND bd.system_id = ? AND bd.fiscal_year_id = ?
      WHERE ei.is_active = 1
      GROUP BY ei.id
      HAVING (initial_plan + revised_plan + forecast + actual) > 0
      ORDER BY ec.sort_order, ei.sort_order
    `).bind(systemId, fyId).all(),
    c.env.DB.prepare(`
      SELECT month,
        COALESCE(SUM(initial_plan), 0) as initial_plan,
        COALESCE(SUM(revised_plan), 0) as revised_plan,
        COALESCE(SUM(forecast), 0) as forecast,
        COALESCE(SUM(actual), 0) as actual
      FROM budget_data WHERE system_id = ? AND fiscal_year_id = ?
      GROUP BY month ORDER BY month
    `).bind(systemId, fyId).all()
  ])

  return c.json({ system, items: items.results, monthly: monthly.results })
})

// GET /api/analysis/cross-year - Cross-year comparison for a system
analysisApi.get('/cross-year', async (c) => {
  const systemId = c.req.query('system_id')

  let sql = `
    SELECT fy.id as fiscal_year_id, fy.code, fy.name,
      COALESCE(SUM(bd.initial_plan), 0) as initial_plan,
      COALESCE(SUM(bd.revised_plan), 0) as revised_plan,
      COALESCE(SUM(bd.forecast), 0) as forecast,
      COALESCE(SUM(bd.actual), 0) as actual
    FROM fiscal_years fy
    LEFT JOIN budget_data bd ON fy.id = bd.fiscal_year_id`
  const params: any[] = []

  if (systemId) {
    sql += ' AND bd.system_id = ?'
    params.push(systemId)
  }

  sql += ' GROUP BY fy.id ORDER BY fy.code'
  const result = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ data: result.results })
})
