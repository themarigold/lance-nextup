import { expect, type Page } from '@playwright/test'

/** Screenshot at CSS scale so images stay small enough to read back. */
export const shot = (page: Page, name: string) =>
  page.screenshot({ path: `shots/${name}.png`, scale: 'css' })

/** Collect uncaught page errors; assert the list is empty at the end of a test. */
export function trackErrors(page: Page) {
  const errs: string[] = []
  page.on('pageerror', (e) => errs.push(e.message))
  return errs
}

/** Phone rules every screen must pass: no horizontal scroll, no tap target under 48px. */
export async function assertPhoneRules(page: Page) {
  const r = await page.evaluate(() => ({
    hScroll: document.documentElement.scrollWidth > innerWidth,
    small: [...document.querySelectorAll('button,[role=button]')]
      .filter((e) => {
        const h = e.getBoundingClientRect().height
        return h > 0 && h < 48
      })
      .map((e) => e.textContent?.trim()),
  }))
  expect(r.hScroll).toBe(false)
  expect(r.small).toEqual([])
}
