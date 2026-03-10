import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const reportApi = new Hono<{ Bindings: Bindings }>()

// GET /api/reports/monthly?fiscal_year_id=1&month=
reportApi.get('/monthly', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'
  const month = c.req.query('month')

  let monthFilter = ''
  const params: any[] = [fyId, fyId, fyId]
  if (month) {
    monthFilter = ' AND bp.month = ?'
    params.push(month, month, month)
  }

  const result = await c.env.DB.prepare(`
    SELECT 
      bc.id as category_id, bc.name as category_name, bc.code as category_code,
      COALESCE(bp_sum.budget, 0) as budget,
      COALESCE(ae_sum.actual, 0) as actual,
      COALESCE(ce_sum.committed, 0) as committed,
      COALESCE(bp_sum.budget, 0) - COALESCE(ae_sum.actual, 0) - COALESCE(ce_sum.committed, 0) as remaining,
      CASE WHEN COALESCE(bp_sum.budget, 0) > 0 
        THEN ROUND(COALESCE(ae_sum.actual, 0) / COALESCE(bp_sum.budget, 0) * 100, 1)
        ELSE 0 END as consumption_rate,
      CASE WHEN COALESCE(bp_sum.budget, 0) > 0 
        THEN ROUND((COALESCE(ae_sum.actual, 0) - COALESCE(bp_sum.budget, 0)), 0)
        ELSE 0 END as variance
    FROM budget_categories bc
    LEFT JOIN (
      SELECT category_id, SUM(amount) as budget FROM budget_plans 
      WHERE fiscal_year_id = ? ${month ? 'AND month = ?' : ''}
      GROUP BY category_id
    ) bp_sum ON bc.id = bp_sum.category_id
    LEFT JOIN (
      SELECT category_id, SUM(amount) as actual FROM actual_expenses 
      WHERE fiscal_year_id = ? ${month ? 'AND month = ?' : ''}
      GROUP BY category_id
    ) ae_sum ON bc.id = ae_sum.category_id
    LEFT JOIN (
      SELECT category_id, SUM(amount) as committed FROM committed_expenses 
      WHERE fiscal_year_id = ? AND status != 'cancelled' ${month ? 'AND month = ?' : ''}
      GROUP BY category_id
    ) ce_sum ON bc.id = ce_sum.category_id
    WHERE bc.parent_id IS NULL AND bc.is_active = 1
    ORDER BY bc.sort_order
  `).bind(...(month ? [fyId, month, fyId, month, fyId, month] : [fyId, fyId, fyId])).all()

  return c.json({ report: result.results })
})

// GET /api/reports/department?fiscal_year_id=1
reportApi.get('/department', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'

  const result = await c.env.DB.prepare(`
    SELECT 
      d.id as department_id, d.name as department_name, d.code as department_code,
      COALESCE(bp_sum.budget, 0) as budget,
      COALESCE(ae_sum.actual, 0) as actual,
      COALESCE(ce_sum.committed, 0) as committed,
      COALESCE(bp_sum.budget, 0) - COALESCE(ae_sum.actual, 0) - COALESCE(ce_sum.committed, 0) as remaining
    FROM departments d
    LEFT JOIN (
      SELECT department_id, SUM(amount) as budget FROM budget_plans WHERE fiscal_year_id = ? GROUP BY department_id
    ) bp_sum ON d.id = bp_sum.department_id
    LEFT JOIN (
      SELECT department_id, SUM(amount) as actual FROM actual_expenses WHERE fiscal_year_id = ? GROUP BY department_id
    ) ae_sum ON d.id = ae_sum.department_id
    LEFT JOIN (
      SELECT department_id, SUM(amount) as committed FROM committed_expenses WHERE fiscal_year_id = ? AND status != 'cancelled' GROUP BY department_id
    ) ce_sum ON d.id = ce_sum.department_id
    WHERE d.is_active = 1
    ORDER BY d.name
  `).bind(fyId, fyId, fyId).all()

  return c.json({ report: result.results })
})

// GET /api/reports/project?fiscal_year_id=1
reportApi.get('/project', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'

  const result = await c.env.DB.prepare(`
    SELECT 
      p.id as project_id, p.name as project_name, p.code as project_code,
      p.status, d.name as department_name,
      COALESCE(bp_sum.budget, 0) as budget,
      COALESCE(ae_sum.actual, 0) as actual,
      COALESCE(ce_sum.committed, 0) as committed,
      COALESCE(bp_sum.budget, 0) - COALESCE(ae_sum.actual, 0) - COALESCE(ce_sum.committed, 0) as remaining
    FROM projects p
    LEFT JOIN departments d ON p.department_id = d.id
    LEFT JOIN (
      SELECT project_id, SUM(amount) as budget FROM budget_plans WHERE fiscal_year_id = ? GROUP BY project_id
    ) bp_sum ON p.id = bp_sum.project_id
    LEFT JOIN (
      SELECT project_id, SUM(amount) as actual FROM actual_expenses WHERE fiscal_year_id = ? GROUP BY project_id
    ) ae_sum ON p.id = ae_sum.project_id
    LEFT JOIN (
      SELECT project_id, SUM(amount) as committed FROM committed_expenses WHERE fiscal_year_id = ? AND status != 'cancelled' GROUP BY project_id
    ) ce_sum ON p.id = ce_sum.project_id
    WHERE p.fiscal_year_id = ?
    ORDER BY p.name
  `).bind(fyId, fyId, fyId, fyId).all()

  return c.json({ report: result.results })
})

// GET /api/reports/export-data?fiscal_year_id=1&type=monthly|category|department
reportApi.get('/export-data', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'
  const type = c.req.query('type') || 'monthly'

  if (type === 'monthly') {
    const result = await c.env.DB.prepare(`
      SELECT 
        bp.month,
        bc.name as category_name,
        d.name as department_name,
        bp.amount as budget,
        COALESCE(ae.actual, 0) as actual,
        COALESCE(ce.committed, 0) as committed
      FROM budget_plans bp
      JOIN budget_categories bc ON bp.category_id = bc.id
      LEFT JOIN departments d ON bp.department_id = d.id
      LEFT JOIN (
        SELECT fiscal_year_id, category_id, department_id, month, SUM(amount) as actual
        FROM actual_expenses GROUP BY fiscal_year_id, category_id, department_id, month
      ) ae ON bp.fiscal_year_id = ae.fiscal_year_id AND bp.category_id = ae.category_id 
        AND COALESCE(bp.department_id, 0) = COALESCE(ae.department_id, 0) AND bp.month = ae.month
      LEFT JOIN (
        SELECT fiscal_year_id, category_id, department_id, month, SUM(amount) as committed
        FROM committed_expenses WHERE status != 'cancelled' GROUP BY fiscal_year_id, category_id, department_id, month
      ) ce ON bp.fiscal_year_id = ce.fiscal_year_id AND bp.category_id = ce.category_id 
        AND COALESCE(bp.department_id, 0) = COALESCE(ce.department_id, 0) AND bp.month = ce.month
      WHERE bp.fiscal_year_id = ?
      ORDER BY bp.month, bc.sort_order
    `).bind(fyId).all()

    return c.json({ data: result.results })
  }

  return c.json({ data: [] })
})
