import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const budgetApi = new Hono<{ Bindings: Bindings }>()

// GET /api/budgets?fiscal_year_id=1&category_id=&department_id=&month=
budgetApi.get('/', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'
  const catId = c.req.query('category_id')
  const deptId = c.req.query('department_id')
  const month = c.req.query('month')

  let sql = `
    SELECT bp.*, bc.name as category_name, bc.code as category_code,
           d.name as department_name, p.name as project_name,
           u.name as created_by_name
    FROM budget_plans bp
    LEFT JOIN budget_categories bc ON bp.category_id = bc.id
    LEFT JOIN departments d ON bp.department_id = d.id
    LEFT JOIN projects p ON bp.project_id = p.id
    LEFT JOIN users u ON bp.created_by = u.id
    WHERE bp.fiscal_year_id = ?`
  const params: any[] = [fyId]

  if (catId) { sql += ' AND bp.category_id = ?'; params.push(catId) }
  if (deptId) { sql += ' AND bp.department_id = ?'; params.push(deptId) }
  if (month) { sql += ' AND bp.month = ?'; params.push(month) }

  sql += ' ORDER BY bp.category_id, bp.month'

  const result = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ budgets: result.results })
})

// GET /api/budgets/summary?fiscal_year_id=1
budgetApi.get('/summary', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'

  const result = await c.env.DB.prepare(`
    SELECT 
      bc.id as category_id, bc.name as category_name, bc.code as category_code,
      d.id as department_id, d.name as department_name,
      SUM(bp.amount) as annual_budget,
      GROUP_CONCAT(bp.month || ':' || bp.amount) as monthly_breakdown
    FROM budget_plans bp
    JOIN budget_categories bc ON bp.category_id = bc.id
    LEFT JOIN departments d ON bp.department_id = d.id
    WHERE bp.fiscal_year_id = ?
    GROUP BY bc.id, d.id
    ORDER BY bc.sort_order, d.name
  `).bind(fyId).all()

  return c.json({ summary: result.results })
})

// POST /api/budgets
budgetApi.post('/', async (c) => {
  const body = await c.req.json()
  const { fiscal_year_id, category_id, department_id, project_id, month, amount, notes, created_by } = body

  if (!fiscal_year_id || !category_id || !month || amount === undefined) {
    return c.json({ error: '必須項目が不足しています' }, 400)
  }

  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO budget_plans (fiscal_year_id, category_id, department_id, project_id, month, amount, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(fiscal_year_id, category_id, department_id || null, project_id || null, month, amount, notes || null, created_by || 1).run()

    return c.json({ id: result.meta.last_row_id, message: '予算を登録しました' }, 201)
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return c.json({ error: '同じ条件の予算が既に登録されています' }, 409)
    }
    throw e
  }
})

// POST /api/budgets/bulk - Bulk create/update monthly budgets
budgetApi.post('/bulk', async (c) => {
  const body = await c.req.json()
  const { fiscal_year_id, category_id, department_id, project_id, monthly_amounts, created_by } = body

  if (!fiscal_year_id || !category_id || !monthly_amounts) {
    return c.json({ error: '必須項目が不足しています' }, 400)
  }

  const stmts = []
  for (const [month, amount] of Object.entries(monthly_amounts)) {
    stmts.push(
      c.env.DB.prepare(`
        INSERT INTO budget_plans (fiscal_year_id, category_id, department_id, project_id, month, amount, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(fiscal_year_id, category_id, department_id, project_id, month) 
        DO UPDATE SET amount = ?, updated_by = ?, updated_at = datetime('now')
      `).bind(fiscal_year_id, category_id, department_id || null, project_id || null, parseInt(month), amount, created_by || 1, amount, created_by || 1)
    )
  }

  await c.env.DB.batch(stmts)
  return c.json({ message: '月別予算を一括登録しました' })
})

// PUT /api/budgets/:id
budgetApi.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { amount, notes, updated_by } = body

  await c.env.DB.prepare(`
    UPDATE budget_plans SET amount = ?, notes = ?, updated_by = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(amount, notes || null, updated_by || 1, id).run()

  return c.json({ message: '予算を更新しました' })
})

// DELETE /api/budgets/:id
budgetApi.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM budget_plans WHERE id = ?').bind(id).run()
  return c.json({ message: '予算を削除しました' })
})
