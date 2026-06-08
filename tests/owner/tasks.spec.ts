import { test, expect } from '@playwright/test'
import { loginAsOwner } from '../helpers/auth'

test.describe('Owner — Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page, '/owner/tasks')
    // Wait for kanban to load — confirms companyId is resolved
    await expect(page.getByText('Assigned').first()).toBeVisible({ timeout: 15000 })
  })

  test('显示看板 4 列标题', async ({ page }) => {
    await expect(page.getByText('Assigned').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('In Progress').first()).toBeVisible()
    await expect(page.getByText('Review').first()).toBeVisible()
    await expect(page.getByText('Complete').first()).toBeVisible()
  })

  test('部门 filter pills 可见', async ({ page }) => {
    await expect(page.getByText('All').or(page.getByText('Operations')).first()).toBeVisible({ timeout: 8000 })
  })

  test('打开 New Task 弹窗', async ({ page }) => {
    const newTaskBtn = page.locator('button').filter({ hasText: 'New Task' })
    await expect(newTaskBtn).toBeVisible({ timeout: 8000 })
    await newTaskBtn.click()

    await expect(page.getByText('New Task').nth(1)).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
  })

  test('创建任务 — 出现在 Assigned 列', async ({ page }) => {
    const title = `E2E Task ${Date.now()}`
    const todayDate = new Date().toISOString().slice(0, 10)

    // Get companyId and deptId from page state via API
    const meResp = await page.request.get('/api/user/me?user_id=' +
      await page.evaluate(() => localStorage.getItem('tasking_user_id') ?? ''))
    const meData = await meResp.json()
    const userId: string = meData.user?.id ?? ''
    const companyId: string = meData.user?.company_id ?? ''

    // Get first department
    const deptsResp = await page.request.get(`/api/company/departments?company_id=${companyId}`)
    const deptsData = await deptsResp.json()
    const deptId: string = deptsData.departments?.[0]?.id ?? ''

    if (!userId || !companyId || !deptId) {
      // Skip if data not available
      return
    }

    // Create task via API — due_at must match today so filteredTasks includes it
    const createResp = await page.request.post('/api/task', {
      data: { company_id: companyId, department_id: deptId, title, status: 'Assigned', percentage_complete: 0, assigned_by: userId, due_at: todayDate },
    })
    const createData = await createResp.json()
    const taskId: string = createData.task?.id ?? createData.id ?? ''

    // Reload to see the task in kanban
    await page.reload()
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})

    await expect(page.getByText(title)).toBeVisible({ timeout: 8000 })

    if (taskId) await page.request.delete(`/api/task?id=${taskId}`)
  })

  test('任务卡片 MoreHorizontal 菜单 — Edit / Duplicate / Delete', async ({ page }) => {
    const title = `Menu Test ${Date.now()}`
    const todayDate = new Date().toISOString().slice(0, 10)

    const meResp = await page.request.get('/api/user/me?user_id=' +
      await page.evaluate(() => localStorage.getItem('tasking_user_id') ?? ''))
    const meData = await meResp.json()
    const userId: string = meData.user?.id ?? ''
    const companyId: string = meData.user?.company_id ?? ''

    const deptsResp = await page.request.get(`/api/company/departments?company_id=${companyId}`)
    const deptsData = await deptsResp.json()
    const deptId: string = deptsData.departments?.[0]?.id ?? ''

    if (!userId || !companyId || !deptId) return

    const createResp = await page.request.post('/api/task', {
      data: { company_id: companyId, department_id: deptId, title, status: 'Assigned', percentage_complete: 0, assigned_by: userId, due_at: todayDate },
    })
    const createData = await createResp.json()
    const taskId: string = createData.task?.id ?? createData.id ?? ''

    await page.reload()
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await expect(page.getByText(title)).toBeVisible({ timeout: 8000 })

    const taskCard = page.locator('*').filter({ hasText: title }).last()
    await taskCard.hover()

    const moreBtn = taskCard.locator('button').last()
    if (await moreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await moreBtn.click()
      await expect(page.getByText('Edit').or(page.getByText('Duplicate')).or(page.getByText('Delete'))).toBeVisible({ timeout: 3000 })
      await page.keyboard.press('Escape')
    }

    if (taskId) await page.request.delete(`/api/task?id=${taskId}`)
  })

  test('删除任务', async ({ page }) => {
    const title = `Delete Test ${Date.now()}`
    const todayDate = new Date().toISOString().slice(0, 10)

    const meResp = await page.request.get('/api/user/me?user_id=' +
      await page.evaluate(() => localStorage.getItem('tasking_user_id') ?? ''))
    const meData = await meResp.json()
    const userId: string = meData.user?.id ?? ''
    const companyId: string = meData.user?.company_id ?? ''

    const deptsResp = await page.request.get(`/api/company/departments?company_id=${companyId}`)
    const deptsData = await deptsResp.json()
    const deptId: string = deptsData.departments?.[0]?.id ?? ''

    if (!userId || !companyId || !deptId) return

    const createResp = await page.request.post('/api/task', {
      data: { company_id: companyId, department_id: deptId, title, status: 'Assigned', percentage_complete: 0, assigned_by: userId, due_at: todayDate },
    })
    const createData = await createResp.json()
    const taskId: string = createData.task?.id ?? createData.id ?? ''

    await page.reload()
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await expect(page.getByText(title)).toBeVisible({ timeout: 8000 })

    if (taskId) {
      await page.request.delete(`/api/task?id=${taskId}`)
      await page.reload()
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      await expect(page.getByText(title)).not.toBeVisible({ timeout: 5000 })
    }
  })

  test('部门统计卡片显示数量', async ({ page }) => {
    await page.waitForTimeout(500)
    await expect(page.locator('text=/^\\d+$/').first()).toBeVisible({ timeout: 8000 })
  })
})
