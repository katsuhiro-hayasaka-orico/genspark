import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const budgetApi = new Hono<{ Bindings: Bindings }>()

// GET /api/budgets/data - Get budget data with filters
// Supports: fiscal_year_id, system_id, expense_item_id, domain_id, category_id
budgetApi.get('/data', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'
  const systemId = c.req.query('system_id')
  const itemId = c.req.query('expense_item_id')
  const domainId = c.req.query('domain_id')
  const categoryId = c.req.query('category_id')

  let sql = `
    SELECT bd.*, s.name as system_name, s.code as system_code,
           sd.name as domain_name, sd.code as domain_code,
           ei.name as item_name, ei.code as item_code,
           ec.name as category_name, ec.code as category_code,
           ei.is_taxable
    FROM budget_data bd
    JOIN systems s ON bd.system_id = s.id
    JOIN system_domains sd ON s.domain_id = sd.id
    JOIN expense_items ei ON bd.expense_item_id = ei.id
    JOIN expense_categories ec ON ei.category_id = ec.id
    WHERE bd.fiscal_year_id = ?`
  const params: any[] = [fyId]

  if (systemId) { sql += ' AND bd.system_id = ?'; params.push(systemId) }
  if (itemId) { sql += ' AND bd.expense_item_id = ?'; params.push(itemId) }
  if (domainId) { sql += ' AND s.domain_id = ?'; params.push(domainId) }
  if (categoryId) { sql += ' AND ei.category_id = ?'; params.push(categoryId) }

  sql += ' ORDER BY sd.sort_order, s.sort_order, ec.sort_order, ei.sort_order, bd.month'

  const result = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ data: result.results })
})

// GET /api/budgets/matrix - Get data in matrix format (system × item with monthly columns)
budgetApi.get('/matrix', async (c) => {
  const fyId = c.req.query('fiscal_year_id') || '1'
  const systemId = c.req.query('system_id')
  const amountType = c.req.query('amount_type') || 'initial_plan' // initial_plan, revised_plan, forecast, actual

  let sql = `
    SELECT bd.system_id, bd.expense_item_id, bd.month,
           bd.initial_plan, bd.revised_plan, bd.forecast, bd.actual,
           bd.contract_partner, bd.notes,
           s.name as system_name, s.code as system_code,
           sd.name as domain_name, sd.id as domain_id,
           ei.name as item_name, ei.code as item_code,
           ec.name as category_name, ec.id as category_id
    FROM budget_data bd
    JOIN systems s ON bd.system_id = s.id
    JOIN system_domains sd ON s.domain_id = sd.id
    JOIN expense_items ei ON bd.expense_item_id = ei.id
    JOIN expense_categories ec ON ei.category_id = ec.id
    WHERE bd.fiscal_year_id = ?`
  const params: any[] = [fyId]

  if (systemId) { sql += ' AND bd.system_id = ?'; params.push(systemId) }
  sql += ' ORDER BY sd.sort_order, s.sort_order, ec.sort_order, ei.sort_order, bd.month'

  const result = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ data: result.results })
})

// POST /api/budgets/upsert - Insert or update a single cell
budgetApi.post('/upsert', async (c) => {
  const body = await c.req.json()
  const { fiscal_year_id, system_id, expense_item_id, month, field, value, contract_partner, notes, updated_by } = body

  if (!fiscal_year_id || !system_id || !expense_item_id || !month || !field) {
    return c.json({ error: '必須項目が不足しています' }, 400)
  }

  const allowedFields = ['initial_plan', 'revised_plan', 'forecast', 'actual']
  if (!allowedFields.includes(field)) {
    return c.json({ error: '無効なフィールド名です' }, 400)
  }

  // Check if record exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM budget_data WHERE fiscal_year_id = ? AND system_id = ? AND expense_item_id = ? AND month = ?'
  ).bind(fiscal_year_id, system_id, expense_item_id, month).first()

  if (existing) {
    let updateSql = `UPDATE budget_data SET ${field} = ?, updated_at = datetime('now')`
    const updateParams: any[] = [value || 0]
    if (contract_partner !== undefined) { updateSql += ', contract_partner = ?'; updateParams.push(contract_partner) }
    if (notes !== undefined) { updateSql += ', notes = ?'; updateParams.push(notes) }
    if (updated_by) { updateSql += ', updated_by = ?'; updateParams.push(updated_by) }
    updateSql += ' WHERE id = ?'
    updateParams.push((existing as any).id)
    await c.env.DB.prepare(updateSql).bind(...updateParams).run()
    return c.json({ message: '更新しました', id: (existing as any).id })
  } else {
    const insertValues: Record<string, number> = { initial_plan: 0, revised_plan: 0, forecast: 0, actual: 0 }
    insertValues[field] = value || 0
    const result = await c.env.DB.prepare(`
      INSERT INTO budget_data (fiscal_year_id, system_id, expense_item_id, month, initial_plan, revised_plan, forecast, actual, contract_partner, notes, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      fiscal_year_id, system_id, expense_item_id, month,
      insertValues.initial_plan, insertValues.revised_plan, insertValues.forecast, insertValues.actual,
      contract_partner || null, notes || null, updated_by || null
    ).run()
    return c.json({ message: '登録しました', id: result.meta.last_row_id }, 201)
  }
})

// POST /api/budgets/bulk-upsert - Bulk upsert multiple cells
budgetApi.post('/bulk-upsert', async (c) => {
  const body = await c.req.json()
  const { records } = body

  if (!records || !Array.isArray(records) || records.length === 0) {
    return c.json({ error: 'レコードが空です' }, 400)
  }

  const stmts: any[] = []
  for (const r of records) {
    stmts.push(
      c.env.DB.prepare(`
        INSERT INTO budget_data (fiscal_year_id, system_id, expense_item_id, month, initial_plan, revised_plan, forecast, actual, contract_partner, notes, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(fiscal_year_id, system_id, expense_item_id, month)
        DO UPDATE SET
          initial_plan = CASE WHEN ? IS NOT NULL THEN ? ELSE initial_plan END,
          revised_plan = CASE WHEN ? IS NOT NULL THEN ? ELSE revised_plan END,
          forecast = CASE WHEN ? IS NOT NULL THEN ? ELSE forecast END,
          actual = CASE WHEN ? IS NOT NULL THEN ? ELSE actual END,
          contract_partner = COALESCE(?, contract_partner),
          notes = COALESCE(?, notes),
          updated_by = COALESCE(?, updated_by),
          updated_at = datetime('now')
      `).bind(
        r.fiscal_year_id, r.system_id, r.expense_item_id, r.month,
        r.initial_plan ?? 0, r.revised_plan ?? 0, r.forecast ?? 0, r.actual ?? 0,
        r.contract_partner || null, r.notes || null, r.updated_by || null,
        r.initial_plan, r.initial_plan,
        r.revised_plan, r.revised_plan,
        r.forecast, r.forecast,
        r.actual, r.actual,
        r.contract_partner || null, r.notes || null, r.updated_by || null
      )
    )
  }

  await c.env.DB.batch(stmts)
  return c.json({ message: `${records.length}件を一括更新しました`, count: records.length })
})

// DELETE /api/budgets/data/:id
budgetApi.delete('/data/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM budget_data WHERE id = ?').bind(id).run()
  return c.json({ message: '削除しました' })
})
