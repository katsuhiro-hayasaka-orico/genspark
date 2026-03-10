import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const actualApi = new Hono<{ Bindings: Bindings }>()

// GET /api/actuals?fiscal_year_id=1&category_id=&department_id=&month=&status=
actualApi.get('/', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'
  const catId = c.req.query('category_id')
  const deptId = c.req.query('department_id')
  const month = c.req.query('month')
  const status = c.req.query('status')

  let sql = `
    SELECT ae.*, bc.name as category_name, bc.code as category_code,
           d.name as department_name, p.name as project_name,
           u1.name as created_by_name, u2.name as approved_by_name
    FROM actual_expenses ae
    LEFT JOIN budget_categories bc ON ae.category_id = bc.id
    LEFT JOIN departments d ON ae.department_id = d.id
    LEFT JOIN projects p ON ae.project_id = p.id
    LEFT JOIN users u1 ON ae.created_by = u1.id
    LEFT JOIN users u2 ON ae.approved_by = u2.id
    WHERE ae.fiscal_year_id = ?`
  const params: any[] = [fyId]

  if (catId) { sql += ' AND ae.category_id = ?'; params.push(catId) }
  if (deptId) { sql += ' AND ae.department_id = ?'; params.push(deptId) }
  if (month) { sql += ' AND ae.month = ?'; params.push(month) }
  if (status) { sql += ' AND ae.status = ?'; params.push(status) }

  sql += ' ORDER BY ae.month DESC, ae.created_at DESC'

  const result = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ actuals: result.results })
})

// POST /api/actuals
actualApi.post('/', async (c) => {
  const body = await c.req.json()
  const { fiscal_year_id, category_id, department_id, project_id, month, amount, description, vendor, invoice_number, invoice_date, payment_date, status, created_by } = body

  if (!fiscal_year_id || !category_id || !month || amount === undefined) {
    return c.json({ error: '必須項目が不足しています' }, 400)
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO actual_expenses (fiscal_year_id, category_id, department_id, project_id, month, amount, description, vendor, invoice_number, invoice_date, payment_date, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    fiscal_year_id, category_id, department_id || null, project_id || null,
    month, amount, description || null, vendor || null,
    invoice_number || null, invoice_date || null, payment_date || null,
    status || 'recorded', created_by || 1
  ).run()

  return c.json({ id: result.meta.last_row_id, message: '実績を登録しました' }, 201)
})

// POST /api/actuals/import - CSV import
actualApi.post('/import', async (c) => {
  const body = await c.req.json()
  const { fiscal_year_id, records } = body

  if (!records || !Array.isArray(records) || records.length === 0) {
    return c.json({ error: 'インポートデータが空です' }, 400)
  }

  const stmts = records.map((r: any) =>
    c.env.DB.prepare(`
      INSERT INTO actual_expenses (fiscal_year_id, category_id, department_id, month, amount, description, vendor, invoice_number, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'recorded', 1)
    `).bind(fiscal_year_id, r.category_id, r.department_id || null, r.month, r.amount, r.description || null, r.vendor || null, r.invoice_number || null)
  )

  await c.env.DB.batch(stmts)
  return c.json({ message: `${records.length}件の実績データをインポートしました`, count: records.length })
})

// PUT /api/actuals/:id
actualApi.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { category_id, department_id, project_id, month, amount, description, vendor, invoice_number, invoice_date, payment_date, status } = body

  await c.env.DB.prepare(`
    UPDATE actual_expenses 
    SET category_id = ?, department_id = ?, project_id = ?, month = ?, amount = ?,
        description = ?, vendor = ?, invoice_number = ?, invoice_date = ?, payment_date = ?,
        status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(
    category_id, department_id || null, project_id || null, month, amount,
    description || null, vendor || null, invoice_number || null,
    invoice_date || null, payment_date || null, status || 'recorded', id
  ).run()

  return c.json({ message: '実績を更新しました' })
})

// DELETE /api/actuals/:id
actualApi.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM actual_expenses WHERE id = ?').bind(id).run()
  return c.json({ message: '実績を削除しました' })
})
