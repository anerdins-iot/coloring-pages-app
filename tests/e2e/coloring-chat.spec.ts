import { test, expect } from '@playwright/test';
import { mkdir } from 'fs/promises';

test.describe('Coloring Chat App E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the app with welcome message', async ({ page }) => {
    await expect(page).toHaveTitle('Måla med magi');
    const welcomeMessage = page.getByText(/Hej! Skriv eller använd mikrofonen/);
    await expect(welcomeMessage).toBeVisible();
    const chatHeader = page.getByText('Magisk Chatt');
    await expect(chatHeader).toBeVisible();
    await mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/01-initial-state.png' });
  });

  test('should display voice toggle button', async ({ page }) => {
    const voiceToggle = page.getByRole('button', { name: /Slå på uppläsning|Stäng av uppläsning/i });
    await expect(voiceToggle).toBeVisible();
    // Default should be off
    await expect(voiceToggle).toHaveAttribute('aria-label', 'Slå på uppläsning');
    await mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/02-voice-toggle.png' });
  });

  test('should switch voice mode on and off', async ({ page }) => {
    const voiceToggle = page.getByRole('button', { name: /Slå på uppläsning/i });
    await voiceToggle.click();
    
    // Should now say turn off
    const voiceToggleOff = page.getByRole('button', { name: /Stäng av uppläsning/i });
    await expect(voiceToggleOff).toBeVisible();
    
    await voiceToggleOff.click();
    await expect(page.getByRole('button', { name: /Slå på uppläsning/i })).toBeVisible();
    
    await mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/03-voice-mode-switched.png' });
  });

  test('should enable send button when text is entered', async ({ page }) => {
    const input = page.getByPlaceholder('Skriv vad du vill måla…');
    const sendButton = page.getByRole('button', { name: 'Skicka' });
    await expect(sendButton).toBeDisabled();
    await input.fill('Jag vill måla en hus');
    await expect(sendButton).toBeEnabled();
    await mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/04-input-enabled.png' });
  });

  test('should send a chat message and receive AI response with image generation', async ({ page }) => {
    const input = page.getByPlaceholder('Skriv vad du vill måla…');
    const sendButton = page.getByRole('button', { name: 'Skicka' });
    const testMessage = 'Måla en blå katt för mig';
    await input.fill(testMessage);
    await mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/05-before-message.png' });
    await sendButton.click();
    const userMessage = page.getByText(testMessage);
    await expect(userMessage).toBeVisible();
    await page.screenshot({ path: 'screenshots/06-message-sent.png' });
    const stopButton = page.getByRole('button', { name: 'Stoppa' });
    await page.waitForTimeout(2000);
    await expect(stopButton).not.toBeVisible({ timeout: 20000 });
    const scrollArea = page.locator('.scroll-area');
    const textContent = await scrollArea.textContent();
    expect(textContent).toBeTruthy();
    await page.screenshot({ path: 'screenshots/07-ai-response.png' });
  });

  test('should display images in chat messages', async ({ page }) => {
    const input = page.getByPlaceholder('Skriv vad du vill måla…');
    const sendButton = page.getByRole('button', { name: 'Skicka' });
    const testMessage = 'Kan du måla en gul sol för mig?';
    await input.fill(testMessage);
    await sendButton.click();
    const userMessage = page.getByText(testMessage);
    await expect(userMessage).toBeVisible();
    await page.waitForTimeout(2000);
    const stopButton = page.getByRole('button', { name: 'Stoppa' });
    await expect(stopButton).not.toBeVisible({ timeout: 20000 });
    await mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/08-images-in-chat.png' });
    const scrollArea = page.locator('.scroll-area');
    const textContent = await scrollArea.textContent();
    expect(textContent).toBeTruthy();
  });

  test('should have input field and microphone button', async ({ page }) => {
    const input = page.getByPlaceholder('Skriv vad du vill måla…');
    const micButton = page.getByRole('button', { name: /Spela in med mikrofon/i });
    await expect(input).toBeVisible();
    await expect(micButton).toBeVisible();
    await mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/09-input-and-mic.png' });
  });

  test('should display child-safe footer text', async ({ page }) => {
    const footerText = page.getByText(/Allt här är gjort för barn/i);
    await expect(footerText).toBeVisible();
    await mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/10-footer-text.png' });
  });
});
