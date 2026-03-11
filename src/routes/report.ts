import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const reportApi = new Hono<{ Bindings: Bindings }>()

// GET /api/reports/department-summary - Summary by domain
reportApi.get('/department-summary', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'

  const result = await c.env.DB.prepare(`
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

  return c.json({ data: result.results })
})

// GET /api/reports/system-summary - Summary by system
reportApi.get('/system-summary', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'

  const result = await c.env.DB.prepare(`
    SELECT s.id, s.name, s.code, sd.name as domain_name,
      COALESCE(SUM(bd.initial_plan), 0) as initial_plan,
      COALESCE(SUM(bd.revised_plan), 0) as revised_plan,
      COALESCE(SUM(bd.forecast), 0) as forecast,
      COALESCE(SUM(bd.actual), 0) as actual,
      CASE WHEN COALESCE(SUM(bd.revised_plan), 0) > 0
        THEN ROUND((COALESCE(SUM(bd.forecast), 0) - COALESCE(SUM(bd.revised_plan), 0)) / COALESCE(SUM(bd.revised_plan), 0) * 100, 1)
        ELSE 0 END as variance_rate
    FROM systems s
    JOIN system_domains sd ON s.domain_id = sd.id
    LEFT JOIN budget_data bd ON s.id = bd.system_id AND bd.fiscal_year_id = ?
    WHERE s.is_active = 1
    GROUP BY s.id
    HAVING (initial_plan + revised_plan + forecast + actual) > 0
    ORDER BY sd.sort_order, s.sort_order
  `).bind(fyId).all()

  return c.json({ data: result.results })
})

// GET /api/reports/category-summary - Summary by expense category
reportApi.get('/category-summary', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'

  const result = await c.env.DB.prepare(`
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
  `).bind(fyId).all()

  return c.json({ data: result.results })
})

// GET /api/reports/export-data - Full export data for Excel/PDF
reportApi.get('/export-data', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'
  const type = c.req.query('type') || 'full' // full, system, category

  if (type === 'system') {
    const result = await c.env.DB.prepare(`
      SELECT s.name as system_name, s.code as system_code,
        sd.name as domain_name,
        ei.name as item_name, ec.name as category_name,
        bd.month,
        bd.initial_plan, bd.revised_plan, bd.forecast, bd.actual,
        bd.contract_partner, bd.notes
      FROM budget_data bd
      JOIN systems s ON bd.system_id = s.id
      JOIN system_domains sd ON s.domain_id = sd.id
      JOIN expense_items ei ON bd.expense_item_id = ei.id
      JOIN expense_categories ec ON ei.category_id = ec.id
      WHERE bd.fiscal_year_id = ?
      ORDER BY sd.sort_order, s.sort_order, ec.sort_order, ei.sort_order, bd.month
    `).bind(fyId).all()
    return c.json({ data: result.results })
  }

  if (type === 'category') {
    const result = await c.env.DB.prepare(`
      SELECT ec.name as category_name, ec.code as category_code,
        ei.name as item_name, ei.code as item_code,
        bd.month,
        COALESCE(SUM(bd.initial_plan), 0) as initial_plan,
        COALESCE(SUM(bd.revised_plan), 0) as revised_plan,
        COALESCE(SUM(bd.forecast), 0) as forecast,
        COALESCE(SUM(bd.actual), 0) as actual
      FROM budget_data bd
      JOIN expense_items ei ON bd.expense_item_id = ei.id
      JOIN expense_categories ec ON ei.category_id = ec.id
      WHERE bd.fiscal_year_id = ?
      GROUP BY ec.id, ei.id, bd.month
      ORDER BY ec.sort_order, ei.sort_order, bd.month
    `).bind(fyId).all()
    return c.json({ data: result.results })
  }

  // full - everything
  const result = await c.env.DB.prepare(`
    SELECT bd.*, s.name as system_name, s.code as system_code,
      sd.name as domain_name,
      ei.name as item_name, ei.code as item_code,
      ec.name as category_name, ec.code as category_code,
      bd.contract_partner, bd.notes
    FROM budget_data bd
    JOIN systems s ON bd.system_id = s.id
    JOIN system_domains sd ON s.domain_id = sd.id
    JOIN expense_items ei ON bd.expense_item_id = ei.id
    JOIN expense_categories ec ON ei.category_id = ec.id
    WHERE bd.fiscal_year_id = ?
    ORDER BY sd.sort_order, s.sort_order, ec.sort_order, ei.sort_order, bd.month
  `).bind(fyId).all()

  return c.json({ data: result.results })
})
