import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const commentApi = new Hono<{ Bindings: Bindings }>()

// GET /api/comments?fiscal_year_id=1&system_id=&period_type=
commentApi.get('/', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'
  const systemId = c.req.query('system_id')
  const periodType = c.req.query('period_type')

  let sql = `
    SELECT bc.*, s.name as system_name, ei.name as item_name,
           u.name as created_by_name
    FROM budget_comments bc
    LEFT JOIN systems s ON bc.system_id = s.id
    LEFT JOIN expense_items ei ON bc.expense_item_id = ei.id
    LEFT JOIN users u ON bc.created_by = u.id
    WHERE bc.fiscal_year_id = ?`
  const params: any[] = [fyId]

  if (systemId) { sql += ' AND bc.system_id = ?'; params.push(systemId) }
  if (periodType) { sql += ' AND bc.period_type = ?'; params.push(periodType) }

  sql += ' ORDER BY bc.created_at DESC'
  const result = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ comments: result.results })
})

// POST /api/comments
commentApi.post('/', async (c) => {
  const body = await c.req.json()
  const { fiscal_year_id, system_id, expense_item_id, period_type, period_value, comment_type, content, created_by } = body

  if (!fiscal_year_id || !content) {
    return c.json({ error: '必須項目が不足しています' }, 400)
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO budget_comments (fiscal_year_id, system_id, expense_item_id, period_type, period_value, comment_type, content, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    fiscal_year_id, system_id || null, expense_item_id || null,
    period_type || 'annual', period_value || null,
    comment_type || 'variance', content, created_by || 1
  ).run()

  return c.json({ id: result.meta.last_row_id, message: 'コメントを登録しました' }, 201)
})

// PUT /api/comments/:id
commentApi.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { content, comment_type } = body

  await c.env.DB.prepare(
    "UPDATE budget_comments SET content = ?, comment_type = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(content, comment_type || 'variance', id).run()

  return c.json({ message: 'コメントを更新しました' })
})

// DELETE /api/comments/:id
commentApi.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM budget_comments WHERE id = ?').bind(id).run()
  return c.json({ message: 'コメントを削除しました' })
})
