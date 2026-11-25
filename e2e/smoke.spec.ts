import { test, expect } from '@playwright/test'
import { shot, trackErrors, assertPhoneRules } from './helpers'

test('shell renders', async ({ page }) => {
  const errs = trackErrors(page)
  await page.goto('/')
  await expect(page.getByText('Next Up')).toBeVisible()
  await assertPhoneRules(page)
  await shot(page, '00-shell')
  expect(errs).toEqual([])
})
