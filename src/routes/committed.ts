import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const committedApi = new Hono<{ Bindings: Bindings }>()

// GET /api/committed?fiscal_year_id=1&status=
committedApi.get('/', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'
  const status = c.req.query('status')

  let sql = `
    SELECT ce.*, bc.name as category_name, bc.code as category_code,
           d.name as department_name, p.name as project_name,
           u.name as created_by_name
    FROM committed_expenses ce
    LEFT JOIN budget_categories bc ON ce.category_id = bc.id
    LEFT JOIN departments d ON ce.department_id = d.id
    LEFT JOIN projects p ON ce.project_id = p.id
    LEFT JOIN users u ON ce.created_by = u.id
    WHERE ce.fiscal_year_id = ?`
  const params: any[] = [fyId]

  if (status) { sql += ' AND ce.status = ?'; params.push(status) }

  sql += ' ORDER BY ce.created_at DESC'

  const result = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ committed: result.results })
})

// POST /api/committed
committedApi.post('/', async (c) => {
  const body = await c.req.json()
  const { fiscal_year_id, category_id, department_id, project_id, month, amount, description, vendor, order_number, order_date, expected_delivery_date, created_by } = body

  if (!fiscal_year_id || !category_id || !month || amount === undefined) {
    return c.json({ error: '必須項目が不足しています' }, 400)
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO committed_expenses (fiscal_year_id, category_id, department_id, project_id, month, amount, description, vendor, order_number, order_date, expected_delivery_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    fiscal_year_id, category_id, department_id || null, project_id || null,
    month, amount, description || null, vendor || null,
    order_number || null, order_date || null, expected_delivery_date || null,
    created_by || 1
  ).run()

  return c.json({ id: result.meta.last_row_id, message: 'コミット金額を登録しました' }, 201)
})

// PUT /api/committed/:id
committedApi.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { category_id, department_id, project_id, month, amount, description, vendor, order_number, order_date, expected_delivery_date, status } = body

  await c.env.DB.prepare(`
    UPDATE committed_expenses 
    SET category_id = ?, department_id = ?, project_id = ?, month = ?, amount = ?,
        description = ?, vendor = ?, order_number = ?, order_date = ?,
        expected_delivery_date = ?, status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(
    category_id, department_id || null, project_id || null, month, amount,
    description || null, vendor || null, order_number || null,
    order_date || null, expected_delivery_date || null, status || 'ordered', id
  ).run()

  return c.json({ message: 'コミット金額を更新しました' })
})

// DELETE /api/committed/:id
committedApi.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM committed_expenses WHERE id = ?').bind(id).run()
  return c.json({ message: 'コミット金額を削除しました' })
})
