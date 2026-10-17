import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('1. Navigating to app...');
  await page.goto('http://127.0.0.1:8080/');
  await page.waitForLoadState('networkidle');

  // Go to Incidents
  console.log('2. Navigating to Incidents...');
  await page.click('button:has-text("Incidents"), a:has-text("Incidents")');
  await page.waitForTimeout(1000);

  // Click Report Incident
  console.log('3. Opening Incident Form Modal...');
  const newIncBtn = page.locator('button:has-text("Report Incident"), button:has-text("New Incident")').first();
  await newIncBtn.click();
  await page.waitForTimeout(500);

  // Select City preset
  console.log('4. Testing Location Presets...');
  const modal = page.locator('[role="dialog"]');
  const citySelect = modal.locator('select').first();
  await citySelect.selectOption('Harbor Coastal District');
  await page.waitForTimeout(400);

  // Click Street preset button
  console.log('4b. Clicking Street preset pill button...');
  await modal.locator('button:has-text("Pier 4")').first().click();
  await page.waitForTimeout(500);

  // Take screenshot of Modal with Presets
  await page.screenshot({ path: '/Users/mohith/Downloads/IPbGYXMelczONYhr-grok-workspace/screenshots/incidents-preset-modal.png' });
  console.log('Saved screenshots/incidents-preset-modal.png');

  // Submit Incident
  console.log('5. Submitting Incident...');
  await modal.locator('button:has-text("Save Incident")').click();
  await page.waitForTimeout(1000);

  // Go to Rescue Tasks
  console.log('6. Navigating to Rescue Tasks...');
  await page.click('button:has-text("Rescue Tasks"), a:has-text("Rescue Tasks")');
  await page.waitForTimeout(1000);

  // Click Create Task
  console.log('7. Opening Task Form Modal...');
  const newTaskBtn = page.locator('button:has-text("Create Task"), button:has-text("New Task")').first();
  await newTaskBtn.click();
  await page.waitForTimeout(500);

  // Select City and Street preset for Task
  const taskModal = page.locator('[role="dialog"]');
  const taskCitySelect = taskModal.locator('select').nth(1);
  await taskCitySelect.selectOption('River Valley Basin');
  await page.waitForTimeout(400);

  // Click Street preset pill for Task
  await taskModal.locator('button:has-text("North River")').first().click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: '/Users/mohith/Downloads/IPbGYXMelczONYhr-grok-workspace/screenshots/tasks-preset-modal.png' });
  console.log('Saved screenshots/tasks-preset-modal.png');

  // Submit Task
  console.log('8. Submitting Task...');
  await taskModal.locator('button:has-text("Create Task")').click();
  await page.waitForTimeout(1000);

  // Go to Spatial Map
  console.log('9. Navigating to Map View...');
  await page.click('button:has-text("Map"), a:has-text("Map")');
  await page.waitForTimeout(2000);

  // Check map rendered and markers exist
  const customMarkers = await page.locator('.custom-marker').count();
  console.log(`Found ${customMarkers} markers on tactical map!`);

  await page.screenshot({ path: '/Users/mohith/Downloads/IPbGYXMelczONYhr-grok-workspace/screenshots/mapview-tactical.png' });
  console.log('Saved screenshots/mapview-tactical.png');

  await browser.close();
  console.log('Interactive verification completed successfully!');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
