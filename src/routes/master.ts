import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const masterApi = new Hono<{ Bindings: Bindings }>()

// ===== Fiscal Years =====
masterApi.get('/fiscal-years', async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM fiscal_years ORDER BY code').all()
  return c.json({ fiscalYears: result.results })
})

masterApi.post('/fiscal-years', async (c) => {
  const body = await c.req.json()
  const { code, name, start_date, end_date } = body
  const result = await c.env.DB.prepare(
    'INSERT INTO fiscal_years (code, name, start_date, end_date) VALUES (?, ?, ?, ?)'
  ).bind(code, name, start_date, end_date).run()
  return c.json({ id: result.meta.last_row_id, message: '年度を登録しました' }, 201)
})

masterApi.put('/fiscal-years/:id/activate', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE fiscal_years SET is_active = 0'),
    c.env.DB.prepare('UPDATE fiscal_years SET is_active = 1 WHERE id = ?').bind(id)
  ])
  return c.json({ message: 'アクティブ年度を変更しました' })
})

// ===== System Domains =====
masterApi.get('/domains', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM system_domains WHERE is_active = 1 ORDER BY sort_order'
  ).all()
  return c.json({ domains: result.results })
})

masterApi.post('/domains', async (c) => {
  const body = await c.req.json()
  const { code, name, sort_order } = body
  const result = await c.env.DB.prepare(
    'INSERT INTO system_domains (code, name, sort_order) VALUES (?, ?, ?)'
  ).bind(code, name, sort_order || 0).run()
  return c.json({ id: result.meta.last_row_id, message: 'ドメインを登録しました' }, 201)
})

masterApi.put('/domains/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { code, name, sort_order, is_active } = body
  await c.env.DB.prepare(
    'UPDATE system_domains SET code = ?, name = ?, sort_order = ?, is_active = ? WHERE id = ?'
  ).bind(code, name, sort_order || 0, is_active ?? 1, id).run()
  return c.json({ message: 'ドメインを更新しました' })
})

// ===== Systems =====
masterApi.get('/systems', async (c) => {
  const domainId = c.req.query('domain_id')
  let sql = `SELECT s.*, sd.name as domain_name, sd.code as domain_code
    FROM systems s JOIN system_domains sd ON s.domain_id = sd.id
    WHERE s.is_active = 1`
  const params: any[] = []
  if (domainId) { sql += ' AND s.domain_id = ?'; params.push(domainId) }
  sql += ' ORDER BY sd.sort_order, s.sort_order'
  const result = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ systems: result.results })
})

masterApi.get('/systems/tree', async (c) => {
  const domains = await c.env.DB.prepare(
    'SELECT * FROM system_domains WHERE is_active = 1 ORDER BY sort_order'
  ).all()
  const systems = await c.env.DB.prepare(
    'SELECT * FROM systems WHERE is_active = 1 ORDER BY sort_order'
  ).all()
  
  const tree = (domains.results as any[]).map(d => ({
    ...d,
    systems: (systems.results as any[]).filter(s => s.domain_id === d.id)
  }))
  return c.json({ tree })
})

masterApi.post('/systems', async (c) => {
  const body = await c.req.json()
  const { domain_id, code, name, description, sort_order } = body
  const result = await c.env.DB.prepare(
    'INSERT INTO systems (domain_id, code, name, description, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).bind(domain_id, code, name, description || null, sort_order || 0).run()
  return c.json({ id: result.meta.last_row_id, message: 'システムを登録しました' }, 201)
})

masterApi.put('/systems/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { domain_id, code, name, description, sort_order, is_active } = body
  await c.env.DB.prepare(
    'UPDATE systems SET domain_id = ?, code = ?, name = ?, description = ?, sort_order = ?, is_active = ? WHERE id = ?'
  ).bind(domain_id, code, name, description || null, sort_order || 0, is_active ?? 1, id).run()
  return c.json({ message: 'システムを更新しました' })
})

// ===== Expense Categories =====
masterApi.get('/expense-categories', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM expense_categories WHERE is_active = 1 ORDER BY sort_order'
  ).all()
  return c.json({ categories: result.results })
})

masterApi.post('/expense-categories', async (c) => {
  const body = await c.req.json()
  const { code, name, sort_order } = body
  const result = await c.env.DB.prepare(
    'INSERT INTO expense_categories (code, name, sort_order) VALUES (?, ?, ?)'
  ).bind(code, name, sort_order || 0).run()
  return c.json({ id: result.meta.last_row_id, message: '費用カテゴリを登録しました' }, 201)
})

// ===== Expense Items =====
masterApi.get('/expense-items', async (c) => {
  const catId = c.req.query('category_id')
  let sql = `SELECT ei.*, ec.name as category_name, ec.code as category_code
    FROM expense_items ei JOIN expense_categories ec ON ei.category_id = ec.id
    WHERE ei.is_active = 1`
  const params: any[] = []
  if (catId) { sql += ' AND ei.category_id = ?'; params.push(catId) }
  sql += ' ORDER BY ec.sort_order, ei.sort_order'
  const result = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ items: result.results })
})

masterApi.get('/expense-items/tree', async (c) => {
  const categories = await c.env.DB.prepare(
    'SELECT * FROM expense_categories WHERE is_active = 1 ORDER BY sort_order'
  ).all()
  const items = await c.env.DB.prepare(
    'SELECT * FROM expense_items WHERE is_active = 1 ORDER BY sort_order'
  ).all()
  
  const tree = (categories.results as any[]).map(cat => ({
    ...cat,
    items: (items.results as any[]).filter(item => item.category_id === cat.id)
  }))
  return c.json({ tree })
})

masterApi.post('/expense-items', async (c) => {
  const body = await c.req.json()
  const { category_id, code, name, is_taxable, sort_order } = body
  const result = await c.env.DB.prepare(
    'INSERT INTO expense_items (category_id, code, name, is_taxable, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).bind(category_id, code, name, is_taxable ?? 1, sort_order || 0).run()
  return c.json({ id: result.meta.last_row_id, message: '費目を登録しました' }, 201)
})

masterApi.put('/expense-items/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { category_id, code, name, is_taxable, sort_order, is_active } = body
  await c.env.DB.prepare(
    'UPDATE expense_items SET category_id = ?, code = ?, name = ?, is_taxable = ?, sort_order = ?, is_active = ? WHERE id = ?'
  ).bind(category_id, code, name, is_taxable ?? 1, sort_order || 0, is_active ?? 1, id).run()
  return c.json({ message: '費目を更新しました' })
})
