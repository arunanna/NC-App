const { test, expect } = require('@playwright/test');

test('doctor demo keeps report access, navigation and profile edits isolated from the backend', async ({ page, baseURL }) => {
  const errors = []; const external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  // These regressions run exclusively on localhost with synthetic data.
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== new URL(baseURL).origin) {
      external.push(url.origin); await route.abort();
    } else await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore demo', exact: true }).click();
  await expect(page.getByText('Demo · sample data', { exact: true })).toBeVisible();
  for (const name of ['Patients', 'Updates', 'Profile']) await expect(page.getByRole('tab', { name: new RegExp(name) }).last()).toBeVisible();
  const label = await page.getByText('Updates', { exact: true }).last().boundingBox();
  expect(label.height).toBeGreaterThanOrEqual(12);
  const widths = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth]);
  expect(widths[1]).toBeLessThanOrEqual(widths[0] + 1);
  await expect(page.getByText('NC Studio')).toHaveCount(0);

  const search = page.getByRole('textbox', { name: 'Search patient or MRN', exact: true });
  await search.fill('SAMPLE-003');
  await page.getByRole('button', { name: 'Open Demo Patient 003', exact: true }).click();
  await page.getByRole('tab', { name: /^Reports/ }).click();
  await expect(page.getByText('No released reports yet', { exact: true })).toBeVisible();
  await expect(page.getByText('Unreleased sample draft', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to patients', exact: true }).click();

  await search.fill('SAMPLE-007');
  const reportless = page.getByRole('button', { name: 'Open Demo Patient 007', exact: true });
  await expect(reportless.getByText('Report available', { exact: true })).toHaveCount(0);
  await reportless.click();
  await page.getByRole('tab', { name: /^Reports/ }).click();
  await expect(page.getByText('This case is marked completed. A released report is not available.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to patients', exact: true }).click();

  await search.fill('SAMPLE-001');
  await page.getByRole('button', { name: 'Open Demo Patient 001', exact: true }).click();
  await expect(page.getByText('Full-scale IQ', { exact: true })).toBeVisible();
  await expect(page.getByText('95', { exact: true })).toBeVisible();
  await expect(page.getByText('For EPIC discussion; no procedure selected', { exact: true })).toBeVisible();
  await expect(page.getByText('Surgery 1', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /^Reports/ }).click();
  await expect(page.getByText('Final analysis report', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByText('Sample document', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await page.getByRole('tab', { name: /^Documents/ }).click();
  for (const name of ['Choose files', 'Take photo', 'Photo library']) await expect(page.getByRole('button', {name, exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Take photo', exact: true}).click();
  await expect(page.getByText('Sample attachment', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Got it', exact: true}).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Sample document', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();

  await page.getByRole('tab', { name: /Updates/ }).click();
  await page.getByRole('button', { name: 'View update for Demo Patient 002', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Demo Patient 002', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Profile/ }).click();
  await page.getByRole('button', {name: 'Enable notifications', exact: true}).click();
  await expect(page.getByText('Sample notification preference', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Got it', exact: true}).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('textbox', { name: 'City', exact: true }).fill('Synthetic test city');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByText('Synthetic test city', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Leave demo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Explore demo', exact: true })).toBeVisible();
  await expect(page.getByText('Demo · sample data', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Explore demo', exact: true }).click();
  await page.getByRole('tab', { name: /Profile/ }).click();
  await expect(page.getByText('Synthetic test city', { exact: true })).toHaveCount(0);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
