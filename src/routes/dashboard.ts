import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const dashboardApi = new Hono<{ Bindings: Bindings }>()

// GET /api/dashboard/summary?fiscal_year_id=1
dashboardApi.get('/summary', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'

  const [fy, budgetTotal, actualTotal, committedTotal, monthlyData, categoryData] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM fiscal_years WHERE id = ?').bind(fyId).first(),
    c.env.DB.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM budget_plans WHERE fiscal_year_id = ?').bind(fyId).first(),
    c.env.DB.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM actual_expenses WHERE fiscal_year_id = ?').bind(fyId).first(),
    c.env.DB.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM committed_expenses WHERE fiscal_year_id = ? AND status != 'cancelled'").bind(fyId).first(),
    c.env.DB.prepare(`
      SELECT 
        bp.month,
        COALESCE(SUM(bp.amount), 0) as budget,
        COALESCE(ae.actual, 0) as actual,
        COALESCE(ce.committed, 0) as committed
      FROM budget_plans bp
      LEFT JOIN (
        SELECT month, SUM(amount) as actual
        FROM actual_expenses WHERE fiscal_year_id = ?
        GROUP BY month
      ) ae ON bp.month = ae.month
      LEFT JOIN (
        SELECT month, SUM(amount) as committed
        FROM committed_expenses WHERE fiscal_year_id = ? AND status != 'cancelled'
        GROUP BY month
      ) ce ON bp.month = ce.month
      WHERE bp.fiscal_year_id = ?
      GROUP BY bp.month
      ORDER BY bp.month
    `).bind(fyId, fyId, fyId).all(),
    c.env.DB.prepare(`
      SELECT 
        bc.id, bc.name, bc.code,
        COALESCE(bp.budget, 0) as budget,
        COALESCE(ae.actual, 0) as actual,
        COALESCE(ce.committed, 0) as committed
      FROM budget_categories bc
      LEFT JOIN (
        SELECT category_id, SUM(amount) as budget
        FROM budget_plans WHERE fiscal_year_id = ?
        GROUP BY category_id
      ) bp ON bc.id = bp.category_id
      LEFT JOIN (
        SELECT category_id, SUM(amount) as actual
        FROM actual_expenses WHERE fiscal_year_id = ?
        GROUP BY category_id
      ) ae ON bc.id = ae.category_id
      LEFT JOIN (
        SELECT category_id, SUM(amount) as committed
        FROM committed_expenses WHERE fiscal_year_id = ? AND status != 'cancelled'
        GROUP BY category_id
      ) ce ON bc.id = ce.category_id
      WHERE bc.parent_id IS NULL AND bc.is_active = 1
      ORDER BY bc.sort_order
    `).bind(fyId, fyId, fyId).all()
  ])

  const totalBudget = (budgetTotal as any)?.total || 0
  const totalActual = (actualTotal as any)?.total || 0
  const totalCommitted = (committedTotal as any)?.total || 0
  const remaining = totalBudget - totalActual - totalCommitted
  const consumptionRate = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0

  return c.json({
    fiscalYear: fy,
    kpi: {
      totalBudget,
      totalActual,
      totalCommitted,
      remaining,
      consumptionRate: Math.round(consumptionRate * 10) / 10,
      forecastTotal: totalActual + totalCommitted + (remaining > 0 ? remaining * 0.9 : 0)
    },
    monthlyData: monthlyData.results,
    categoryData: categoryData.results
  })
})

// GET /api/dashboard/alerts?fiscal_year_id=1
dashboardApi.get('/alerts', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'

  const alerts = await c.env.DB.prepare(`
    SELECT * FROM (
      SELECT 
        bc.name as category_name,
        bc.code,
        COALESCE(bp.budget, 0) as budget,
        COALESCE(ae.actual, 0) as actual,
        COALESCE(ce.committed, 0) as committed,
        CASE 
          WHEN COALESCE(bp.budget, 0) > 0 
          THEN ROUND((COALESCE(ae.actual, 0) + COALESCE(ce.committed, 0)) / COALESCE(bp.budget, 0) * 100, 1)
          ELSE 0 
        END as usage_rate
      FROM budget_categories bc
      LEFT JOIN (SELECT category_id, SUM(amount) as budget FROM budget_plans WHERE fiscal_year_id = ? GROUP BY category_id) bp ON bc.id = bp.category_id
      LEFT JOIN (SELECT category_id, SUM(amount) as actual FROM actual_expenses WHERE fiscal_year_id = ? GROUP BY category_id) ae ON bc.id = ae.category_id
      LEFT JOIN (SELECT category_id, SUM(amount) as committed FROM committed_expenses WHERE fiscal_year_id = ? AND status != 'cancelled' GROUP BY category_id) ce ON bc.id = ce.category_id
      WHERE bc.parent_id IS NULL AND bc.is_active = 1
    ) WHERE usage_rate >= 80
    ORDER BY usage_rate DESC
  `).bind(fyId, fyId, fyId).all()

  return c.json({ alerts: alerts.results })
})

// GET /api/dashboard/trends?fiscal_year_id=1
dashboardApi.get('/trends', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'

  const trends = await c.env.DB.prepare(`
    WITH monthly AS (
      SELECT month, SUM(amount) as actual FROM actual_expenses WHERE fiscal_year_id = ? GROUP BY month
    ),
    budget_monthly AS (
      SELECT month, SUM(amount) as budget FROM budget_plans WHERE fiscal_year_id = ? GROUP BY month
    )
    SELECT 
      b.month,
      b.budget,
      COALESCE(m.actual, 0) as actual,
      SUM(b.budget) OVER (ORDER BY b.month) as cumulative_budget,
      SUM(COALESCE(m.actual, 0)) OVER (ORDER BY b.month) as cumulative_actual
    FROM budget_monthly b
    LEFT JOIN monthly m ON b.month = m.month
    ORDER BY b.month
  `).bind(fyId, fyId).all()

  return c.json({ trends: trends.results })
})
