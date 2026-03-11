import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const dashboardApi = new Hono<{ Bindings: Bindings }>()

// GET /api/dashboard/summary - KPI summary for a fiscal year
dashboardApi.get('/summary', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'

  const [fy, totals, monthlyData, categoryData, domainData] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM fiscal_years WHERE id = ?').bind(fyId).first(),
    c.env.DB.prepare(`
      SELECT
        COALESCE(SUM(initial_plan), 0) as total_initial,
        COALESCE(SUM(revised_plan), 0) as total_revised,
        COALESCE(SUM(forecast), 0) as total_forecast,
        COALESCE(SUM(actual), 0) as total_actual
      FROM budget_data WHERE fiscal_year_id = ?
    `).bind(fyId).first(),
    c.env.DB.prepare(`
      SELECT month,
        COALESCE(SUM(initial_plan), 0) as initial_plan,
        COALESCE(SUM(revised_plan), 0) as revised_plan,
        COALESCE(SUM(forecast), 0) as forecast,
        COALESCE(SUM(actual), 0) as actual
      FROM budget_data WHERE fiscal_year_id = ?
      GROUP BY month ORDER BY month
    `).bind(fyId).all(),
    c.env.DB.prepare(`
      SELECT ec.id, ec.name, ec.code,
        COALESCE(SUM(bd.initial_plan), 0) as initial_plan,
        COALESCE(SUM(bd.revised_plan), 0) as revised_plan,
        COALESCE(SUM(bd.forecast), 0) as forecast,
        COALESCE(SUM(bd.actual), 0) as actual
      FROM expense_categories ec
      LEFT JOIN expense_items ei ON ec.id = ei.category_id
      LEFT JOIN budget_data bd ON ei.id = bd.expense_item_id AND bd.fiscal_year_id = ?
      WHERE ec.is_active = 1
      GROUP BY ec.id ORDER BY ec.sort_order
    `).bind(fyId).all(),
    c.env.DB.prepare(`
      SELECT sd.id, sd.name, sd.code,
        COALESCE(SUM(bd.initial_plan), 0) as initial_plan,
        COALESCE(SUM(bd.revised_plan), 0) as revised_plan,
        COALESCE(SUM(bd.forecast), 0) as forecast,
        COALESCE(SUM(bd.actual), 0) as actual
      FROM system_domains sd
      LEFT JOIN systems s ON sd.id = s.domain_id
      LEFT JOIN budget_data bd ON s.id = bd.system_id AND bd.fiscal_year_id = ?
      WHERE sd.is_active = 1
      GROUP BY sd.id ORDER BY sd.sort_order
    `).bind(fyId).all()
  ])

  const t = totals as any
  const revisedPlan = t?.total_revised || 0
  const actual = t?.total_actual || 0
  const forecast = t?.total_forecast || 0
  const remaining = revisedPlan - actual
  const consumptionRate = revisedPlan > 0 ? Math.round((actual / revisedPlan) * 1000) / 10 : 0
  const varianceRate = revisedPlan > 0 ? Math.round(((forecast - revisedPlan) / revisedPlan) * 1000) / 10 : 0

  return c.json({
    fiscalYear: fy,
    kpi: {
      totalInitialPlan: t?.total_initial || 0,
      totalRevisedPlan: revisedPlan,
      totalForecast: forecast,
      totalActual: actual,
      remaining,
      consumptionRate,
      varianceRate,
      forecastVariance: forecast - revisedPlan
    },
    monthlyData: monthlyData.results,
    categoryData: categoryData.results,
    domainData: domainData.results
  })
})

// GET /api/dashboard/alerts - Over-budget alerts
dashboardApi.get('/alerts', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'

  const alerts = await c.env.DB.prepare(`
    SELECT * FROM (
      SELECT
        s.name as system_name, s.code as system_code,
        sd.name as domain_name,
        COALESCE(SUM(bd.revised_plan), 0) as revised_plan,
        COALESCE(SUM(bd.forecast), 0) as forecast,
        COALESCE(SUM(bd.actual), 0) as actual,
        CASE
          WHEN COALESCE(SUM(bd.revised_plan), 0) > 0
          THEN ROUND(COALESCE(SUM(bd.actual), 0) / COALESCE(SUM(bd.revised_plan), 0) * 100, 1)
          ELSE 0
        END as usage_rate,
        CASE
          WHEN COALESCE(SUM(bd.revised_plan), 0) > 0
          THEN ROUND((COALESCE(SUM(bd.forecast), 0) - COALESCE(SUM(bd.revised_plan), 0)) / COALESCE(SUM(bd.revised_plan), 0) * 100, 1)
          ELSE 0
        END as variance_rate
      FROM systems s
      JOIN system_domains sd ON s.domain_id = sd.id
      LEFT JOIN budget_data bd ON s.id = bd.system_id AND bd.fiscal_year_id = ?
      WHERE s.is_active = 1
      GROUP BY s.id
    ) WHERE usage_rate >= 80 OR variance_rate >= 5
    ORDER BY variance_rate DESC, usage_rate DESC
  `).bind(fyId).all()

  return c.json({ alerts: alerts.results })
})

// GET /api/dashboard/trends - Monthly cumulative trends
dashboardApi.get('/trends', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'

  const trends = await c.env.DB.prepare(`
    SELECT month,
      SUM(revised_plan) as revised_plan,
      SUM(forecast) as forecast,
      SUM(actual) as actual,
      SUM(SUM(revised_plan)) OVER (ORDER BY month) as cum_plan,
      SUM(SUM(forecast)) OVER (ORDER BY month) as cum_forecast,
      SUM(SUM(actual)) OVER (ORDER BY month) as cum_actual
    FROM budget_data WHERE fiscal_year_id = ?
    GROUP BY month ORDER BY month
  `).bind(fyId).all()

  return c.json({ trends: trends.results })
})

// GET /api/dashboard/multi-year - Multi-year comparison
dashboardApi.get('/multi-year', async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT fy.id, fy.code, fy.name,
      COALESCE(SUM(bd.initial_plan), 0) as initial_plan,
      COALESCE(SUM(bd.revised_plan), 0) as revised_plan,
      COALESCE(SUM(bd.forecast), 0) as forecast,
      COALESCE(SUM(bd.actual), 0) as actual
    FROM fiscal_years fy
    LEFT JOIN budget_data bd ON fy.id = bd.fiscal_year_id
    GROUP BY fy.id ORDER BY fy.code
  `).all()
  return c.json({ data: result.results })
})

// GET /api/dashboard/system-summary - System-level summary
dashboardApi.get('/system-summary', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'

  const result = await c.env.DB.prepare(`
    SELECT s.id, s.name, s.code,
      sd.name as domain_name, sd.code as domain_code,
      COALESCE(SUM(bd.initial_plan), 0) as initial_plan,
      COALESCE(SUM(bd.revised_plan), 0) as revised_plan,
      COALESCE(SUM(bd.forecast), 0) as forecast,
      COALESCE(SUM(bd.actual), 0) as actual,
      CASE WHEN COALESCE(SUM(bd.revised_plan), 0) > 0
        THEN ROUND(COALESCE(SUM(bd.actual), 0) / COALESCE(SUM(bd.revised_plan), 0) * 100, 1)
        ELSE 0 END as consumption_rate,
      CASE WHEN COALESCE(SUM(bd.revised_plan), 0) > 0
        THEN ROUND((COALESCE(SUM(bd.forecast), 0) - COALESCE(SUM(bd.revised_plan), 0)) / COALESCE(SUM(bd.revised_plan), 0) * 100, 1)
        ELSE 0 END as variance_rate
    FROM systems s
    JOIN system_domains sd ON s.domain_id = sd.id
    LEFT JOIN budget_data bd ON s.id = bd.system_id AND bd.fiscal_year_id = ?
    WHERE s.is_active = 1
    GROUP BY s.id
    ORDER BY sd.sort_order, s.sort_order
  `).bind(fyId).all()

  return c.json({ systems: result.results })
})
