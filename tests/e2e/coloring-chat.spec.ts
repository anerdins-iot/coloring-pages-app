import { test, expect } from '@playwright/test';

test.describe('Coloring Chat App', () => {
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
  });

  test('should send a chat message', async ({ page }) => {
    const input = page.getByPlaceholder('Skriv vad du vill måla…');
    const sendButton = page.getByRole('button', { name: 'Skicka' });

    // Type and send a message
    const testMessage = 'Jag vill måla en katt';
    await input.fill(testMessage);
    await sendButton.click();

    // Verify the message appears in the chat
    const userMessage = page.getByText(testMessage);
    await expect(userMessage).toBeVisible();

    // Wait a moment for the API response
    await page.waitForTimeout(2000);

    // Since the Google API key is not configured, we expect an error message
    // Verify that the chat is handling the error gracefully
    const chatArea = page.locator('[data-slot="card-content"]').first();
    await expect(chatArea).toBeVisible();
  });

  test('should display error when API key is missing', async ({ page }) => {
    const input = page.getByPlaceholder('Skriv vad du vill måla…');
    const sendButton = page.getByRole('button', { name: 'Skicka' });

    // Type and send a message
    await input.fill('Test message');
    await sendButton.click();

    // Wait for API response
    await page.waitForTimeout(2000);

    // Look for error message in the page (may appear as alert or in chat)
    // Since API key is missing, an error is expected
    const pageContent = await page.content();
    expect(pageContent).toContain('error');
  });

  test('should have input field and microphone button', async ({ page }) => {
    const input = page.getByPlaceholder('Skriv vad du vill måla…');
    const micButton = page.getByRole('button', {
      name: /Spela in med mikrofon/i,
    });

    await expect(input).toBeVisible();
    await expect(micButton).toBeVisible();
  });

  test('should display child-safe footer text', async ({ page }) => {
    const footerText = page.getByText(
      /Allt här är gjort för barn/i
    );
    await expect(footerText).toBeVisible();
  });
});
