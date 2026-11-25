import { test, expect, type Page } from '@playwright/test'
import { shot, trackErrors, assertPhoneRules } from './helpers'

const nextUp = (page: Page) => page.getByRole('region', { name: 'Next up' })
const big = (page: Page) => page.getByRole('button', { name: /^(Start|Finish) \d+$/ })
const toast = (page: Page) => page.getByRole('status')

/** Tap the big button once it has the expected label and the 500 ms guard has passed. */
async function tapBig(page: Page, label: string) {
  await expect(big(page)).toHaveText(label)
  await expect(big(page)).toBeEnabled()
  await big(page).tap()
}

test('AC 3: Next Up shows 106 with its reason, chips and button; greyed rooms; words and times', async ({ page }) => {
  const errs = trackErrors(page)
  await page.goto('/')
  const card = nextUp(page)
  await expect(card.getByText('106', { exact: true })).toBeVisible() // the plate itself, not "Report problem · 106"
  await expect(card).toContainText('Guest arrives 11:30 am')
  await expect(card).toContainText('VIP')
  await expect(card.getByText('Vacant', { exact: true })).toBeVisible()
  await expect(card.getByText('Dirty', { exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Report problem · 106' })).toBeVisible()
  await expect(big(page)).toHaveText('Start 106')

  // Greyed rooms show their reason and can't be tapped.
  await expect(page.getByText('Do not disturb until 10:45 am')).toBeVisible()
  await expect(page.getByText('Late checkout 12:00 pm')).toBeVisible()
  await expect(page.getByRole('button', { name: /^10[57]\b/ })).toHaveCount(0)
  for (const reason of ['Do not disturb until 10:45 am', 'Late checkout 12:00 pm']) {
    const bg = await page.locator('li', { hasText: reason }).evaluate((e) => getComputedStyle(e).backgroundColor)
    expect(bg).toBe('rgb(238, 238, 238)') // the grey wash, not the white of active rows
  }

  await page.getByText(/^Done \(/).tap() // open Done so its text is checked too
  const text = await page.locator('body').innerText()
  expect(text).not.toMatch(/\bready\b/i)
  const times = text.match(/\d{1,2}:\d{2}(?: ?[ap]m)?/g) ?? []
  expect(times.length).toBeGreaterThan(0)
  for (const t of times) expect(t).toMatch(/^\d{1,2}:\d{2} (am|pm)$/)

  await assertPhoneRules(page)
  await shot(page, '02-maya-load')
  expect(errs).toEqual([])
})

test('AC 4: Start, Finish, toast, Undo, then pick a row', async ({ page }) => {
  const errs = trackErrors(page)
  await page.goto('/')
  await tapBig(page, 'Start 106')
  await expect(big(page)).toHaveText('Finish 106')
  await expect(nextUp(page).getByText('In progress', { exact: true })).toBeVisible()

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)) // she may have scrolled down
  await tapBig(page, 'Finish 106')
  await expect(big(page)).toHaveText('Start 103')
  await expect(toast(page)).toHaveText(/106 clean · 5 left/)
  // Toast text is one line and not cut off.
  const line = await toast(page).locator('span').evaluate((e) => ({ h: e.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(e).lineHeight), cut: e.scrollWidth > e.clientWidth }))
  expect(line.h).toBeLessThan(line.lh * 1.5)
  expect(line.cut).toBe(false)
  const toastBox = (await toast(page).boundingBox())!
  const cardBox = (await nextUp(page).boundingBox())!
  expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(cardBox.y) // toast sits above the Next Up card
  // The new plate is fully on screen and nothing (toast, bottom bar) covers any part of it.
  const plate = nextUp(page).getByText('103', { exact: true })
  await expect(plate).toBeInViewport({ ratio: 1 })
  const uncovered = await plate.evaluate((e) => {
    const r = e.getBoundingClientRect()
    const i = 14 // inside the 12px rounded corners, which hit-test as the row behind
    const pts = [[r.left + i, r.top + i], [r.right - i, r.top + i], [r.left + i, r.bottom - i], [r.right - i, r.bottom - i], [(r.left + r.right) / 2, (r.top + r.bottom) / 2]]
    return pts.every(([x, y]) => e.contains(document.elementFromPoint(x, y)))
  })
  expect(uncovered).toBe(true)
  await expect(big(page)).toBeEnabled() // shot after the plate fade and the 500 ms guard settle
  await shot(page, '03-maya-finished')
  await page.getByText(/^Done \(/).tap()
  await expect(page.locator('details li', { hasText: '106' })).toContainText('Clean')

  await toast(page).getByRole('button', { name: 'Undo' }).tap()
  await expect(big(page)).toHaveText('Finish 106')
  await expect(nextUp(page).getByText('In progress', { exact: true })).toBeVisible()

  await tapBig(page, 'Finish 106')
  await expect(toast(page)).toBeVisible()
  await page.getByRole('button', { name: /^104\b/ }).tap()
  await expect(big(page)).toHaveText('Start 104')
  await expect(toast(page)).toHaveCount(0)

  await assertPhoneRules(page)
  expect(errs).toEqual([])
})

test('AC 6: a second tap 350 ms after Finish 106 does not start 103', async ({ page }) => {
  const errs = trackErrors(page)
  await page.goto('/')
  await tapBig(page, 'Start 106')
  await expect(big(page)).toHaveText('Finish 106')
  await expect(big(page)).toBeEnabled()
  const box = (await big(page).boundingBox())!
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2]
  await page.touchscreen.tap(x, y)
  await page.waitForTimeout(350) // late inside the 500 ms guard, like a hesitant second tap
  await page.touchscreen.tap(x, y) // lands on the button, now "Start 103" and disabled
  await page.waitForTimeout(700) // past the guard: a missed tap would have started 103 by now

  await expect(big(page)).toHaveText('Start 103')
  await expect(nextUp(page).getByText('Dirty', { exact: true })).toBeVisible()
  await page.getByText(/^Done \(/).tap()
  await expect(page.locator('details li', { hasText: '106' })).toContainText('Clean')
  expect(errs).toEqual([])
})

test('AC 6: the guard re-arms after Undo, even though the label comes back unchanged', async ({ page }) => {
  const errs = trackErrors(page)
  await page.goto('/')
  await tapBig(page, 'Start 106')
  await toast(page).getByRole('button', { name: 'Undo' }).tap() // well inside 500 ms of the Start
  await expect(big(page)).toHaveText('Start 106')
  await expect(big(page)).toBeDisabled()
  await expect(big(page)).toBeEnabled() // and it comes back after the guard
  expect(errs).toEqual([])
})

test('AC 12: Reset in the demo bar goes back to the seed and stays there after a reload', async ({ page }) => {
  const errs = trackErrors(page)
  await page.goto('/')
  await tapBig(page, 'Start 106')
  await expect(toast(page)).toHaveCount(0, { timeout: 7000 }) // the toast covers the demo bar for 5 s
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Reset' }).tap()
  await expect(big(page)).toHaveText('Start 106')
  await page.reload()
  await expect(big(page)).toHaveText('Start 106')
  await assertPhoneRules(page)
  expect(errs).toEqual([])
})

test('AC 12: state survives a reload; unreadable saved data loads the seed', async ({ page }) => {
  const errs = trackErrors(page)
  await page.goto('/')
  await tapBig(page, 'Start 106')
  await expect(big(page)).toHaveText('Finish 106')
  await page.reload()
  await expect(big(page)).toHaveText('Finish 106')
  await expect(nextUp(page).getByText('In progress', { exact: true })).toBeVisible()
  await expect(toast(page)).toHaveCount(0) // no Undo comes back after a reload

  await page.evaluate(() => localStorage.setItem('lance-nextup:v1', '{not json'))
  await page.reload()
  await expect(big(page)).toHaveText('Start 106')
  await assertPhoneRules(page)
  expect(errs).toEqual([])
})
