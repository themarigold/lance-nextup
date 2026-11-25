import { test, expect, type Page } from '@playwright/test'
import { shot, trackErrors, assertPhoneRules } from './helpers'

const nextUp = (page: Page) => page.getByRole('region', { name: 'Next up' })
const big = (page: Page) => page.getByRole('button', { name: /^(Start|Finish|Fixed) \d+/ })
const toast = (page: Page) => page.getByRole('status')
const user = (page: Page, name: 'Maya' | 'Sam') => page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') })

async function tapBig(page: Page, label: string) {
  await expect(big(page)).toHaveText(label)
  await expect(big(page)).toBeEnabled()
  await big(page).tap()
}

/** Report problem · 106 → AC: exactly two taps. */
async function report(page: Page, category: 'AC' | 'Plumbing') {
  await page.getByRole('button', { name: 'Report problem · 106' }).tap()
  await page.getByRole('dialog', { name: 'Problem in 106' }).getByRole('button', { name: category, exact: true }).tap()
}
const reportAC = (page: Page) => report(page, 'AC')

test('AC 7: two taps report AC on 106, which goes on hold and stays Next Up', async ({ page }) => {
  const errs = trackErrors(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Report problem · 106' }).tap()
  const sheet = page.getByRole('dialog', { name: 'Problem in 106' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('button')).toHaveText(['✕', 'AC', 'Plumbing', 'Light', 'Broken item'])
  await expect(page.getByRole('textbox')).toHaveCount(0) // no typing
  await expect(page.getByRole('button', { name: /send|submit/i })).toHaveCount(0) // no send button
  await assertPhoneRules(page)
  await shot(page, '04-report-sheet')

  await sheet.getByRole('button', { name: 'AC', exact: true }).tap()
  await expect(sheet).toHaveCount(0) // closed on the first tap
  await expect(toast(page)).toContainText('AC reported on 106')
  await expect(toast(page).getByRole('button', { name: 'Undo' })).toBeVisible()
  await expect(nextUp(page).getByText('On hold · AC')).toBeVisible()
  await expect(nextUp(page)).toContainText('106')
  await expect(big(page)).toHaveText('Start 106')
  expect(errs).toEqual([])
})

/**
 * A real double tap: two raw touches on the same spot, `gap` ms apart, on the button called `name`.
 * Before the second touch it checks which button is actually under the finger (`under`) and that it's
 * disabled, so the test never relies on WebKit snapping a touch that landed in a gap.
 */
async function doubleTap(page: Page, name: string | RegExp, under: string | RegExp, gap = 250) {
  const box = (await page.getByRole('button', { name, exact: typeof name === 'string' }).boundingBox())!
  const [x, y] = [box.x + 40, box.y + box.height / 2] // off-centre: inside a button on both screens, not a gap
  await page.touchscreen.tap(x, y)
  await page.waitForTimeout(100)
  const hit = await page.evaluate(([px, py]) => {
    const b = document.elementFromPoint(px, py)?.closest('button')
    return { text: b?.textContent?.trim(), disabled: b?.disabled }
  }, [x, y])
  expect(hit.text).toMatch(typeof under === 'string' ? new RegExp(`^${RegExp.escape(under)}$`) : under)
  expect(hit.disabled).toBe(true)
  await page.waitForTimeout(gap - 100)
  await page.touchscreen.tap(x, y)
  await page.waitForTimeout(700) // past the guard: a tap that got through has had time to act
}

test('AC 7: a double tap on Report problem opens the sheet but files nothing', async ({ page }) => {
  const errs = trackErrors(page)
  await page.goto('/')
  await doubleTap(page, 'Report problem · 106', 'Light')
  await expect(page.getByRole('dialog', { name: 'Problem in 106' })).toBeVisible()
  await expect(toast(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Close' }).tap()
  await expect(nextUp(page).getByText(/On hold/)).toHaveCount(0)
  await user(page, 'Sam').tap()
  await expect(page.locator('main')).not.toContainText('106') // Sam got nothing
  expect(errs).toEqual([])
})

test('AC 7: a double tap on Light files one report and does not reopen the sheet', async ({ page }) => {
  const errs = trackErrors(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Report problem · 106' }).tap()
  await expect(page.getByRole('button', { name: 'Light', exact: true })).toBeEnabled()
  await doubleTap(page, 'Light', 'Report problem · 106') // the sheet closes; Report is under the finger
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(toast(page)).toContainText('Light reported on 106')
  await expect(page.getByRole('button', { name: 'Report problem · 106' })).toBeEnabled() // and it comes back

  await expect(toast(page)).toHaveCount(0, { timeout: 7000 })
  await user(page, 'Sam').tap()
  await expect(big(page)).toHaveText('Fixed 106 · Light')
  await expect(page.locator('li', { hasText: '106' })).toHaveCount(0) // only one 106 task
  expect(errs).toEqual([])
})

test('AC 7, demo path: Start 106, report AC while cleaning, Finish', async ({ page }) => {
  const errs = trackErrors(page)
  await page.goto('/')
  await tapBig(page, 'Start 106')
  await reportAC(page)

  // 106 stays Next Up, in progress and on hold, until she taps Finish.
  await expect(nextUp(page).getByText('106', { exact: true })).toBeVisible()
  await expect(nextUp(page).getByText('In progress', { exact: true })).toBeVisible()
  await expect(nextUp(page).getByText('On hold · AC')).toBeVisible()
  await expect(page.getByRole('button', { name: /^106\b/ })).toHaveCount(0) // not pushed down into the list
  await expect(big(page)).toHaveText('Finish 106')
  await assertPhoneRules(page)

  await tapBig(page, 'Finish 106')
  await expect(nextUp(page).getByText('103', { exact: true })).toBeVisible()
  await expect(big(page)).toHaveText('Start 103')
  await page.getByText(/^Done \(/).tap()
  await expect(page.locator('details li', { hasText: '106' })).toContainText('Clean · On hold · AC')
  expect(errs).toEqual([])
})

test('AC 7: Undo removes the hold, and Sam never sees the task', async ({ page }) => {
  const errs = trackErrors(page)
  await page.goto('/')
  await reportAC(page)
  await expect(nextUp(page).getByText('On hold · AC')).toBeVisible()
  await toast(page).getByRole('button', { name: 'Undo' }).tap()
  await expect(nextUp(page).getByText('On hold · AC')).toHaveCount(0)
  await expect(toast(page)).toHaveCount(0)

  await user(page, 'Sam').tap()
  await expect(big(page)).toHaveText('Fixed 204 · Light')
  await expect(page.locator('main')).not.toContainText('106')
  expect(errs).toEqual([])
})

test('AC 13: Sam marks 106 Needs part; it waits at the bottom, stays on hold, and Maya is told', async ({ page }) => {
  const errs = trackErrors(page)
  await page.goto('/')
  await reportAC(page)
  await expect(toast(page)).toHaveCount(0, { timeout: 7000 })

  await user(page, 'Sam').tap()
  await page.getByRole('button', { name: 'Needs part · 106' }).tap()
  await expect(big(page)).toHaveText('Fixed 204 · Light') // 106 dropped below 204
  await expect(page.locator('li', { hasText: '106' })).toContainText('Waiting for a part')
  await assertPhoneRules(page)
  await shot(page, '07-sam-needs-part')

  await user(page, 'Maya').tap()
  await expect(page.getByText('106 AC needs a part')).toBeVisible()
  await expect(nextUp(page).getByText('On hold · AC')).toBeVisible() // still held: the task is open-ended

  // Later the part arrives: Sam fixes 204, then Fixed on the waiting 106, and his list is empty.
  await user(page, 'Sam').tap()
  await tapBig(page, 'Fixed 204 · Light')
  await expect(nextUp(page)).toContainText('Waiting for a part')
  await expect(page.getByRole('button', { name: /^Needs part/ })).toHaveCount(0) // already waiting
  await tapBig(page, 'Fixed 106 · AC')
  await expect(nextUp(page)).toContainText('No open problems')
  await expect(big(page)).toHaveCount(0)
  await assertPhoneRules(page)

  await user(page, 'Maya').tap()
  await expect(page.getByText('106 AC fixed by Sam')).toBeVisible()
  await expect(nextUp(page).getByText(/On hold/)).toHaveCount(0) // hold lifted
  expect(errs).toEqual([])
})

test('AC 13: a double tap on Needs part · 106 does not also mark 204', async ({ page }) => {
  const errs = trackErrors(page)
  await page.goto('/')
  await reportAC(page)
  await expect(toast(page)).toHaveCount(0, { timeout: 7000 })
  await user(page, 'Sam').tap()
  await expect(page.getByRole('button', { name: 'Needs part · 106' })).toBeEnabled()
  await doubleTap(page, 'Needs part · 106', 'Needs part · 204')
  await expect(big(page)).toHaveText('Fixed 204 · Light')
  await expect(page.getByRole('button', { name: 'Needs part · 204' })).toBeVisible() // 204 is still open
  expect(errs).toEqual([])
})

test('AC 11: Sam fixes 106 in one tap; Maya gets the banner and the done-row note', async ({ page }) => {
  const errs = trackErrors(page)
  await page.goto('/')
  await reportAC(page)
  await expect(toast(page)).toHaveCount(0, { timeout: 7000 }) // the toast covers the demo bar for 5 s

  await user(page, 'Sam').tap()
  await expect(nextUp(page)).toContainText('106')
  await expect(nextUp(page)).toContainText('Room on hold · guest arrives 11:30 am · from Maya')
  await assertPhoneRules(page)
  await expect(big(page)).toBeEnabled()
  await shot(page, '05-sam-queue')
  await tapBig(page, 'Fixed 106 · AC')
  await expect(big(page)).toHaveText('Fixed 204 · Light')

  await user(page, 'Maya').tap()
  const banner = page.getByText('106 AC fixed by Sam')
  await expect(banner).toBeVisible()
  await expect(nextUp(page).getByText('On hold · AC')).toHaveCount(0) // hold lifted: it came from the open task
  await assertPhoneRules(page)
  await expect(big(page)).toBeEnabled() // shot after the plate fade and the 500 ms guard settle
  await shot(page, '06-maya-notice')

  await page.getByRole('button', { name: 'Dismiss' }).tap()
  await expect(banner).toHaveCount(0)
  await tapBig(page, 'Start 106')
  await tapBig(page, 'Finish 106')
  await page.getByText(/^Done \(/).tap()
  await expect(page.locator('details li', { hasText: '106' })).toContainText('Clean · AC fixed by Sam')
  expect(errs).toEqual([])
})

test('AC 11: AC and Plumbing on 106; a double tap on Fixed 106 · AC fixes only the AC', async ({ page }) => {
  const errs = trackErrors(page)
  await page.goto('/')
  await reportAC(page)
  await report(page, 'Plumbing') // a second holding task on the same room
  await expect(toast(page)).toHaveCount(0, { timeout: 7000 })

  await user(page, 'Sam').tap()
  await expect(big(page)).toHaveText('Fixed 106 · AC')
  await expect(big(page)).toBeEnabled()
  await doubleTap(page, 'Fixed 106 · AC', 'Fixed 106 · Plumbing', 350) // the next task's button, still guarded
  await expect(big(page)).toHaveText('Fixed 106 · Plumbing') // the Plumbing task is still open

  await user(page, 'Maya').tap()
  await expect(nextUp(page).getByText('On hold · Plumbing')).toBeVisible() // still held by the other task
  expect(errs).toEqual([])
})

test('AC 7: a problem already with Sam shows as Reported and cannot be filed again until it is fixed', async ({ page }) => {
  const errs = trackErrors(page)
  await page.goto('/')
  await reportAC(page)
  await page.getByRole('button', { name: 'Report problem · 106' }).tap()
  const sheet = page.getByRole('dialog', { name: 'Problem in 106' })
  await expect(sheet.getByRole('button', { name: 'Plumbing', exact: true })).toBeEnabled() // other categories still work
  const ac = sheet.getByRole('button', { name: /^AC/ })
  await expect(ac).toHaveText('ACReported')
  await expect(ac).toBeDisabled()
  await assertPhoneRules(page)
  await shot(page, '09-report-sheet-reported')
  await page.getByRole('button', { name: 'Close' }).tap()
  await expect(toast(page)).toHaveCount(0, { timeout: 7000 })

  // Needs part still counts as reported; Fixed frees it again.
  await user(page, 'Sam').tap()
  await page.getByRole('button', { name: 'Needs part · 106' }).tap()
  await user(page, 'Maya').tap()
  await page.getByRole('button', { name: 'Report problem · 106' }).tap()
  await expect(sheet.getByRole('button', { name: /^AC/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Close' }).tap()
  await user(page, 'Sam').tap()
  await tapBig(page, 'Fixed 204 · Light') // 106 AC is waiting for a part, so 204 is on top
  await tapBig(page, 'Fixed 106 · AC')
  await user(page, 'Maya').tap()
  await page.getByRole('button', { name: 'Report problem · 106' }).tap()
  await expect(sheet.getByRole('button', { name: 'AC', exact: true })).toBeEnabled()
  expect(errs).toEqual([])
})

test("AC 11: Sam taps a row to make it his Next Up; Fixed then applies to that task", async ({ page }) => {
  const errs = trackErrors(page)
  await page.goto('/')
  await reportAC(page)
  await expect(toast(page)).toHaveCount(0, { timeout: 7000 })

  await user(page, 'Sam').tap()
  await expect(big(page)).toHaveText('Fixed 106 · AC')
  await expect(big(page)).toBeEnabled()
  await page.getByRole('button', { name: /^204\b/ }).tap()
  await expect(nextUp(page)).toContainText('204')
  await expect(big(page)).toHaveText('Fixed 204 · Light')
  await expect(big(page)).toBeDisabled() // the half-second guard still applies after a pick
  await expect(page.getByRole('button', { name: 'Needs part · 204' })).toBeVisible()
  await assertPhoneRules(page)
  await tapBig(page, 'Fixed 204 · Light')
  await expect(big(page)).toHaveText('Fixed 106 · AC') // pick cleared, 106 is next again
  await expect(page.getByRole('button', { name: /^204\b/ })).toHaveCount(0)
  expect(errs).toEqual([])
})

test("AC 11: a double tap on Sam's 204 row doesn't pick the 106 row that moves under the finger", async ({ page }) => {
  const errs = trackErrors(page)
  await page.goto('/')
  await reportAC(page)
  await expect(toast(page)).toHaveCount(0, { timeout: 7000 })
  await user(page, 'Sam').tap()
  await expect(page.getByRole('button', { name: /^204/ })).toBeEnabled()
  await doubleTap(page, /^204/, /^106/) // after the pick, the 106 row sits where 204 was, still guarded
  await expect(big(page)).toHaveText('Fixed 204 · Light')
  expect(errs).toEqual([])
})
