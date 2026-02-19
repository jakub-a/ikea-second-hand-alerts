import { expect, test } from '@playwright/test';

function mockItemsResponse(storeIds: string) {
  const dataset: Record<string, any[]> = {
    '294': [{ id: 'offer-294', title: 'BILLY Wroclaw', description: 'single store', storeId: '294' }],
    '203': [{ id: 'offer-203', title: 'BILLY Gdansk', description: 'single store', storeId: '203' }]
  };
  if (storeIds === '294,203' || storeIds === '203,294') {
    return { content: [...dataset['294'], ...dataset['203']] };
  }
  return { content: dataset[storeIds] || [] };
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/items?**', async (route) => {
    const url = new URL(route.request().url());
    const payload = mockItemsResponse(url.searchParams.get('storeIds') || '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload)
    });
  });

  await page.route('**/api/meta', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ versionId: 'test' })
    });
  });
});

test('single-city and multi-city searches are consistent', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/Enter one IKEA product name/i).fill('billy');
  await page.locator('.search-button').click();
  await expect(page.getByText(/I found 1 items/i)).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Wrocław/i }).click();
  await page.getByRole('button', { name: /Gdańsk/i }).click();
  await page.getByRole('button', { name: 'Listings' }).click();
  await page.locator('.search-button').click();
  await expect(page.getByText(/I found 1 items/i)).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Wrocław/i }).click();
  await page.getByRole('button', { name: 'Listings' }).click();
  await page.locator('.search-button').click();
  await expect(page.getByText(/I found 2 items/i)).toBeVisible();
});

test('notification deep-link opens alerts and keeps unread increment idempotent', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem(
      'ikea-alerts',
      JSON.stringify([
        { id: 'a1', name: 'Test Alert', keywords: ['billy'], storeIds: ['294'], active: true, unreadCount: 0 }
      ])
    );
  });

  await page.goto('/?tab=alerts&alertId=a1&newCount=2&notificationId=notif-1');
  await expect(page.getByRole('heading', { name: 'Alerts' })).toBeVisible();
  await expect(page.locator('.alert-badge')).toHaveText('2');

  await page.reload();
  await expect(page.locator('.alert-badge')).toHaveText('2');

  await page.getByRole('button', { name: 'Alerts' }).click();
  await page.getByRole('heading', { name: 'Test Alert' }).click();
  await page.getByRole('button', { name: 'Alerts' }).click();
  await expect(page.locator('.alert-badge')).toHaveCount(0);
});
