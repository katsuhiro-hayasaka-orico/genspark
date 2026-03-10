import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const masterApi = new Hono<{ Bindings: Bindings }>()

// ===== Fiscal Years =====
masterApi.get('/fiscal-years', async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM fiscal_years ORDER BY year DESC').all()
  return c.json({ fiscalYears: result.results })
})

masterApi.post('/fiscal-years', async (c) => {
  const body = await c.req.json()
  const { year, name, start_date, end_date, total_budget } = body
  const result = await c.env.DB.prepare(
    'INSERT INTO fiscal_years (year, name, start_date, end_date, total_budget) VALUES (?, ?, ?, ?, ?)'
  ).bind(year, name, start_date, end_date, total_budget || 0).run()
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

// ===== Categories =====
masterApi.get('/categories', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM budget_categories WHERE is_active = 1 ORDER BY sort_order, level, name'
  ).all()
  return c.json({ categories: result.results })
})

masterApi.get('/categories/tree', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM budget_categories WHERE is_active = 1 ORDER BY sort_order, level'
  ).all()

  const cats = result.results as any[]
  const map = new Map()
  const tree: any[] = []

  cats.forEach(cat => {
    map.set(cat.id, { ...cat, children: [] })
  })

  cats.forEach(cat => {
    if (cat.parent_id && map.has(cat.parent_id)) {
      map.get(cat.parent_id).children.push(map.get(cat.id))
    } else if (!cat.parent_id) {
      tree.push(map.get(cat.id))
    }
  })

  return c.json({ tree })
})

masterApi.post('/categories', async (c) => {
  const body = await c.req.json()
  const { name, code, parent_id, level, sort_order, description } = body
  const result = await c.env.DB.prepare(
    'INSERT INTO budget_categories (name, code, parent_id, level, sort_order, description) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(name, code, parent_id || null, level || 0, sort_order || 0, description || null).run()
  return c.json({ id: result.meta.last_row_id, message: 'カテゴリを登録しました' }, 201)
})

masterApi.put('/categories/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, code, sort_order, description, is_active } = body
  await c.env.DB.prepare(
    'UPDATE budget_categories SET name = ?, code = ?, sort_order = ?, description = ?, is_active = ? WHERE id = ?'
  ).bind(name, code, sort_order, description || null, is_active ?? 1, id).run()
  return c.json({ message: 'カテゴリを更新しました' })
})

masterApi.delete('/categories/:id', async (c) => {
  const id = c.req.param('id')
  // Soft delete
  await c.env.DB.prepare('UPDATE budget_categories SET is_active = 0 WHERE id = ?').bind(id).run()
  return c.json({ message: 'カテゴリを無効化しました' })
})

// ===== Departments =====
masterApi.get('/departments', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM departments WHERE is_active = 1 ORDER BY name'
  ).all()
  return c.json({ departments: result.results })
})

masterApi.post('/departments', async (c) => {
  const body = await c.req.json()
  const { name, code, manager_name } = body
  const result = await c.env.DB.prepare(
    'INSERT INTO departments (name, code, manager_name) VALUES (?, ?, ?)'
  ).bind(name, code, manager_name || null).run()
  return c.json({ id: result.meta.last_row_id, message: '部門を登録しました' }, 201)
})

masterApi.put('/departments/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, code, manager_name, is_active } = body
  await c.env.DB.prepare(
    'UPDATE departments SET name = ?, code = ?, manager_name = ?, is_active = ? WHERE id = ?'
  ).bind(name, code, manager_name || null, is_active ?? 1, id).run()
  return c.json({ message: '部門を更新しました' })
})

// ===== Projects =====
masterApi.get('/projects', async (c) => {
  const fyId = c.req.query('fiscal_year_id')
  let sql = `
    SELECT p.*, d.name as department_name, fy.name as fiscal_year_name
    FROM projects p
    LEFT JOIN departments d ON p.department_id = d.id
    LEFT JOIN fiscal_years fy ON p.fiscal_year_id = fy.id
    WHERE 1=1`
  const params: any[] = []
  if (fyId) { sql += ' AND p.fiscal_year_id = ?'; params.push(fyId) }
  sql += ' ORDER BY p.created_at DESC'

  const result = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ projects: result.results })
})

masterApi.post('/projects', async (c) => {
  const body = await c.req.json()
  const { name, code, department_id, fiscal_year_id, status, description, start_date, end_date } = body
  const result = await c.env.DB.prepare(
    'INSERT INTO projects (name, code, department_id, fiscal_year_id, status, description, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(name, code, department_id || null, fiscal_year_id || null, status || 'active', description || null, start_date || null, end_date || null).run()
  return c.json({ id: result.meta.last_row_id, message: 'プロジェクトを登録しました' }, 201)
})

masterApi.put('/projects/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, code, department_id, status, description, start_date, end_date } = body
  await c.env.DB.prepare(
    'UPDATE projects SET name = ?, code = ?, department_id = ?, status = ?, description = ?, start_date = ?, end_date = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).bind(name, code, department_id || null, status || 'active', description || null, start_date || null, end_date || null, id).run()
  return c.json({ message: 'プロジェクトを更新しました' })
})

masterApi.delete('/projects/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare("UPDATE projects SET status = 'cancelled' WHERE id = ?").bind(id).run()
  return c.json({ message: 'プロジェクトをキャンセルしました' })
})
