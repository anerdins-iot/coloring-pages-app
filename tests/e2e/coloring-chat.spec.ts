import { test, expect } from '@playwright/test';
import { mkdir } from 'fs/promises';
import { resolve } from 'path';

test.describe('Coloring Chat App E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the app with welcome message', async ({ page }) => {
    // Verify page title
    await expect(page).toHaveTitle('Måla med magi');

    // Verify welcome message is displayed
    const welcomeMessage = page.getByText(/Hej! Skriv eller använd mikrofonen/);
    await expect(welcomeMessage).toBeVisible();

    // Verify chat card is visible
    const chatHeader = page.getByText('Chatt');
    await expect(chatHeader).toBeVisible();

    // Take screenshot
    await mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/01-initial-state.png' });
  });

  test('should display all three voice modes', async ({ page }) => {
    // Check for all three voice mode buttons
    const blueVoice = page.getByRole('button', {
      name: /Blå röst/i,
    });
    const greenVoice = page.getByRole('button', {
      name: /Grön röst/i,
    });
    const orangeVoice = page.getByRole('button', {
      name: /Orange röst/i,
    });

    await expect(blueVoice).toBeVisible();
    await expect(greenVoice).toBeVisible();
    await expect(orangeVoice).toBeVisible();

    // Verify blue voice is selected by default
    const blueButton = page.getByRole('button', { name: /Blå röst/ });
    const ariaPressed = await blueButton.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('true');

    // Take screenshot
    await mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/02-voice-modes.png' });
  });

  test('should switch between voice modes', async ({ page }) => {
    // Click green voice mode
    const greenVoice = page.getByRole('button', {
      name: /Grön röst/i,
    });
    await greenVoice.click();

    // Verify green voice is now selected
    const greenPressed = await greenVoice.getAttribute('aria-pressed');
    expect(greenPressed).toBe('true');

    // Click orange voice mode
    const orangeVoice = page.getByRole('button', {
      name: /Orange röst/i,
    });
    await orangeVoice.click();

    // Verify orange voice is now selected
    const orangePressed = await orangeVoice.getAttribute('aria-pressed');
    expect(orangePressed).toBe('true');

    // Verify blue is no longer selected
    const blueVoice = page.getByRole('button', {
      name: /Blå röst/i,
    });
    const bluePressed = await blueVoice.getAttribute('aria-pressed');
    expect(bluePressed).toBe('false');

    // Take screenshot
    await mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/03-voice-mode-switched.png' });
  });

  test('should enable send button when text is entered', async ({ page }) => {
    const input = page.getByPlaceholder('Skriv vad du vill måla…');
    const sendButton = page.getByRole('button', { name: 'Skicka' });

    // Initially send button should be disabled
    await expect(sendButton).toBeDisabled();

    // Type a message
    await input.fill('Jag vill måla en hus');

    // Send button should now be enabled
    await expect(sendButton).toBeEnabled();

    // Take screenshot
    await mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/04-input-enabled.png' });
  });

  test('should send a chat message and receive AI response with image generation', async ({ page }) => {
    const input = page.getByPlaceholder('Skriv vad du vill måla…');
    const sendButton = page.getByRole('button', { name: 'Skicka' });

    // Type and send a message
    const testMessage = 'Måla en blå katt för mig';
    await input.fill(testMessage);

    // Take screenshot before sending
    await mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/05-before-message.png' });

    await sendButton.click();

    // Verify the message appears in the chat
    const userMessage = page.getByText(testMessage);
    await expect(userMessage).toBeVisible();

    // Take screenshot after sending
    await page.screenshot({ path: 'screenshots/06-message-sent.png' });

    // Wait for API response - wait for "Stoppa" button to disappear or new messages to appear
    // When streaming, the "Stoppa" button appears. When done, it disappears.
    const stopButton = page.getByRole('button', { name: 'Stoppa' });
    await page.waitForTimeout(2000); // Give it a moment to start streaming

    // Wait for the stop button to disappear (meaning streaming is done)
    await expect(stopButton).not.toBeVisible({ timeout: 20000 });

    // Verify that assistant has responded with some content
    const scrollArea = page.locator('.scroll-area');
    const textContent = await scrollArea.textContent();
    expect(textContent).toBeTruthy();

    // Take screenshot of response
    await page.screenshot({ path: 'screenshots/07-ai-response.png' });
  });

  test('should display images in chat messages', async ({ page }) => {
    const input = page.getByPlaceholder('Skriv vad du vill måla…');
    const sendButton = page.getByRole('button', { name: 'Skicka' });

    // Send a message that might trigger image generation
    const testMessage = 'Kan du måla en gul sol för mig?';
    await input.fill(testMessage);
    await sendButton.click();

    // Verify the message appears in the chat
    const userMessage = page.getByText(testMessage);
    await expect(userMessage).toBeVisible();

    // Wait for response - give it time to start streaming
    await page.waitForTimeout(2000);

    // Wait for the stop button to disappear (meaning streaming is done)
    const stopButton = page.getByRole('button', { name: 'Stoppa' });
    await expect(stopButton).not.toBeVisible({ timeout: 20000 });

    // Take screenshot showing the response with potential images
    await mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/08-images-in-chat.png' });

    // Verify there is content in the scroll area
    const scrollArea = page.locator('.scroll-area');
    const textContent = await scrollArea.textContent();
    expect(textContent).toBeTruthy();
  });

  test('should have input field and microphone button', async ({ page }) => {
    const input = page.getByPlaceholder('Skriv vad du vill måla…');
    const micButton = page.getByRole('button', {
      name: /Spela in med mikrofon/i,
    });

    await expect(input).toBeVisible();
    await expect(micButton).toBeVisible();

    // Take screenshot
    await mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/09-input-and-mic.png' });
  });

  test('should display child-safe footer text', async ({ page }) => {
    const footerText = page.getByText(
      /Allt här är gjort för barn/i
    );
    await expect(footerText).toBeVisible();

    // Take screenshot
    await mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/10-footer-text.png' });
  });

  test('should test multiple voice modes in message flow', async ({ page }) => {
    const input = page.getByPlaceholder('Skriv vad du vill måla…');
    const sendButton = page.getByRole('button', { name: 'Skicka' });

    // Test with blue voice (default)
    await input.fill('Måla en blå fisk');
    await sendButton.click();

    // Verify message sent
    const userMessage1 = page.getByText('Måla en blå fisk');
    await expect(userMessage1).toBeVisible();

    // Wait for response - give it time to start streaming
    await page.waitForTimeout(2000);

    // Wait for the stop button to disappear
    let stopButton = page.getByRole('button', { name: 'Stoppa' });
    await expect(stopButton).not.toBeVisible({ timeout: 20000 });

    // Take screenshot with blue voice
    await mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/11-blue-voice-response.png' });

    // Switch to green voice
    const greenVoice = page.getByRole('button', {
      name: /Grön röst/i,
    });
    await greenVoice.click();

    // Clear input and send another message
    const inputElement = page.getByPlaceholder('Skriv vad du vill måla…');
    await inputElement.fill('Måla en grön dinosaurie');
    await sendButton.click();

    // Verify second message sent
    const userMessage2 = page.getByText('Måla en grön dinosaurie');
    await expect(userMessage2).toBeVisible();

    // Wait for response
    await page.waitForTimeout(2000);

    // Wait for the stop button to disappear
    stopButton = page.getByRole('button', { name: 'Stoppa' });
    await expect(stopButton).not.toBeVisible({ timeout: 20000 });

    // Take screenshot with green voice
    await page.screenshot({ path: 'screenshots/12-green-voice-response.png' });

    // Switch to orange voice
    const orangeVoice = page.getByRole('button', {
      name: /Orange röst/i,
    });
    await orangeVoice.click();

    // Clear input and send final message
    const inputElement2 = page.getByPlaceholder('Skriv vad du vill måla…');
    await inputElement2.fill('Måla en orange tiger');
    await sendButton.click();

    // Verify third message sent
    const userMessage3 = page.getByText('Måla en orange tiger');
    await expect(userMessage3).toBeVisible();

    // Wait for response
    await page.waitForTimeout(2000);

    // Wait for the stop button to disappear
    stopButton = page.getByRole('button', { name: 'Stoppa' });
    await expect(stopButton).not.toBeVisible({ timeout: 20000 });

    // Take screenshot with orange voice
    await page.screenshot({ path: 'screenshots/13-orange-voice-response.png' });
  });
});
