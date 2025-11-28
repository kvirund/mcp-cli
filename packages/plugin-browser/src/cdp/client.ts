/**
 * Chrome DevTools Protocol client
 */

import CDP from 'chrome-remote-interface';

export interface TabInfo {
  id: string;
  title: string;
  url: string;
  active: boolean;
}

export interface CDPClient {
  client: CDP.Client;
  target: CDP.Target;
}

export interface ConnectOptions {
  host?: string;
  port?: number;
  target?: string | ((targets: CDP.Target[]) => CDP.Target);
}

let currentClient: CDPClient | null = null;
let connectionInfo: { host: string; port: number } | null = null;

export async function connect(options: ConnectOptions = {}): Promise<CDPClient> {
  const { host = 'localhost', port = 9222 } = options;

  if (currentClient) {
    await disconnect();
  }

  const target =
    options.target ||
    ((targets: CDP.Target[]) => {
      // Prefer page targets, fallback to first available
      return targets.find((t) => t.type === 'page') || targets[0];
    });

  const client = await CDP({ host, port, target });
  const targetInfo = await getTargetInfo(client);

  currentClient = { client, target: targetInfo };
  connectionInfo = { host, port };

  // Enable necessary domains
  await Promise.all([client.Page.enable(), client.Runtime.enable(), client.DOM.enable()]);

  return currentClient;
}

export async function disconnect(): Promise<void> {
  if (currentClient) {
    await currentClient.client.close();
    currentClient = null;
    connectionInfo = null;
  }
}

export function getClient(): CDPClient | null {
  return currentClient;
}

export function isConnected(): boolean {
  return currentClient !== null;
}

export function getConnectionInfo(): { host: string; port: number } | null {
  return connectionInfo;
}

async function getTargetInfo(client: CDP.Client): Promise<CDP.Target> {
  const { targetInfo } = await client.Target.getTargetInfo();
  return targetInfo as CDP.Target;
}

export async function listTargets(host = 'localhost', port = 9222): Promise<CDP.Target[]> {
  const targets = await CDP.List({ host, port });
  return targets;
}

export async function getBrowserVersion(
  host = 'localhost',
  port = 9222
): Promise<{
  browser: string;
  version: string;
  userAgent: string;
}> {
  const version = await CDP.Version({ host, port });
  return {
    browser: version.Browser || 'Unknown',
    version: version['Protocol-Version'] || 'Unknown',
    userAgent: version['User-Agent'] || 'Unknown',
  };
}

export async function getTabs(host = 'localhost', port = 9222): Promise<TabInfo[]> {
  const targets = await listTargets(host, port);
  return targets
    .filter((t) => t.type === 'page')
    .map((t) => ({
      id: t.id,
      title: t.title,
      url: t.url,
      active: currentClient?.target.id === t.id,
    }));
}

export async function navigate(url: string): Promise<void> {
  if (!currentClient) {
    throw new Error('Not connected to browser');
  }

  // Add protocol if missing
  const fullUrl = url.match(/^https?:\/\//) ? url : `https://${url}`;
  await currentClient.client.Page.navigate({ url: fullUrl });
  await currentClient.client.Page.loadEventFired();
}

export async function switchTab(
  targetId: string,
  host = 'localhost',
  port = 9222
): Promise<void> {
  const targets = await listTargets(host, port);
  const target = targets.find((t) => t.id === targetId || t.title.includes(targetId));

  if (!target) {
    throw new Error(`Tab not found: ${targetId}`);
  }

  await connect({ host, port, target: target.id });
}

export interface ScreenshotOptions {
  fullPage?: boolean;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  clip?: { x: number; y: number; width: number; height: number };
}

export async function screenshot(options: ScreenshotOptions = {}): Promise<Buffer> {
  if (!currentClient) {
    throw new Error('Not connected to browser');
  }

  const { client } = currentClient;
  const { fullPage = false, format = 'png', quality } = options;

  let clip = options.clip;

  if (fullPage && !clip) {
    // Get full page dimensions
    const { root } = await client.DOM.getDocument();
    await client.DOM.getBoxModel({ nodeId: root.nodeId });

    // Get layout metrics for full page
    const metrics = await client.Page.getLayoutMetrics();
    const contentSize = metrics.contentSize || metrics.cssContentSize;

    if (contentSize) {
      clip = {
        x: 0,
        y: 0,
        width: contentSize.width,
        height: contentSize.height,
      };
    }
  }

  const result = await client.Page.captureScreenshot({
    format,
    quality: format === 'png' ? undefined : quality,
    clip: clip ? { ...clip, scale: 1 } : undefined,
    captureBeyondViewport: fullPage,
  });

  return Buffer.from(result.data, 'base64');
}

export async function evaluate<T>(expression: string): Promise<T> {
  if (!currentClient) {
    throw new Error('Not connected to browser');
  }

  const { result, exceptionDetails } = await currentClient.client.Runtime.evaluate({
    expression,
    returnByValue: true,
    awaitPromise: true,
  });

  if (exceptionDetails) {
    throw new Error(exceptionDetails.text || 'Evaluation failed');
  }

  return result.value as T;
}

export async function getPageInfo(): Promise<{
  url: string;
  title: string;
}> {
  if (!currentClient) {
    throw new Error('Not connected to browser');
  }

  const [url, title] = await Promise.all([
    evaluate<string>('window.location.href'),
    evaluate<string>('document.title'),
  ]);

  return { url, title };
}

export async function reload(ignoreCache = false): Promise<void> {
  if (!currentClient) {
    throw new Error('Not connected to browser');
  }

  await currentClient.client.Page.reload({ ignoreCache });
  await currentClient.client.Page.loadEventFired();
}

export async function goBack(): Promise<void> {
  if (!currentClient) {
    throw new Error('Not connected to browser');
  }

  const { currentIndex, entries } = await currentClient.client.Page.getNavigationHistory();
  if (currentIndex > 0) {
    await currentClient.client.Page.navigateToHistoryEntry({
      entryId: entries[currentIndex - 1].id,
    });
    await currentClient.client.Page.loadEventFired();
  }
}

export async function goForward(): Promise<void> {
  if (!currentClient) {
    throw new Error('Not connected to browser');
  }

  const { currentIndex, entries } = await currentClient.client.Page.getNavigationHistory();
  if (currentIndex < entries.length - 1) {
    await currentClient.client.Page.navigateToHistoryEntry({
      entryId: entries[currentIndex + 1].id,
    });
    await currentClient.client.Page.loadEventFired();
  }
}

export async function click(selector: string): Promise<void> {
  if (!currentClient) {
    throw new Error('Not connected to browser');
  }

  await evaluate(`document.querySelector('${selector}')?.click()`);
}

export async function type(selector: string, text: string): Promise<void> {
  if (!currentClient) {
    throw new Error('Not connected to browser');
  }

  // Focus the element
  await evaluate(`document.querySelector('${selector}')?.focus()`);

  // Type each character
  for (const char of text) {
    await currentClient.client.Input.dispatchKeyEvent({
      type: 'keyDown',
      text: char,
    });
    await currentClient.client.Input.dispatchKeyEvent({
      type: 'keyUp',
      text: char,
    });
  }
}

export async function scroll(
  direction: 'up' | 'down' | 'top' | 'bottom',
  amount = 500
): Promise<void> {
  if (!currentClient) {
    throw new Error('Not connected to browser');
  }

  switch (direction) {
    case 'up':
      await evaluate(`window.scrollBy(0, -${amount})`);
      break;
    case 'down':
      await evaluate(`window.scrollBy(0, ${amount})`);
      break;
    case 'top':
      await evaluate('window.scrollTo(0, 0)');
      break;
    case 'bottom':
      await evaluate('window.scrollTo(0, document.body.scrollHeight)');
      break;
  }
}

export async function getHTML(selector?: string): Promise<string> {
  if (!currentClient) {
    throw new Error('Not connected to browser');
  }

  if (selector) {
    return evaluate<string>(`document.querySelector('${selector}')?.outerHTML || ''`);
  }
  return evaluate<string>('document.documentElement.outerHTML');
}

export async function getText(selector?: string): Promise<string> {
  if (!currentClient) {
    throw new Error('Not connected to browser');
  }

  if (selector) {
    return evaluate<string>(`document.querySelector('${selector}')?.textContent || ''`);
  }
  return evaluate<string>('document.body.textContent || ""');
}
