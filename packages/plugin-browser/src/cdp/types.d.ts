declare module 'chrome-remote-interface' {
  interface Target {
    id: string;
    type: string;
    title: string;
    url: string;
    webSocketDebuggerUrl?: string;
    devtoolsFrontendUrl?: string;
  }

  interface Client {
    close(): Promise<void>;

    Page: {
      enable(): Promise<void>;
      navigate(params: { url: string }): Promise<{ frameId: string }>;
      loadEventFired(): Promise<void>;
      captureScreenshot(params?: {
        format?: 'png' | 'jpeg' | 'webp';
        quality?: number;
        clip?: { x: number; y: number; width: number; height: number; scale: number };
        captureBeyondViewport?: boolean;
      }): Promise<{ data: string }>;
      getLayoutMetrics(): Promise<{
        contentSize?: { width: number; height: number };
        cssContentSize?: { width: number; height: number };
      }>;
      reload(params?: { ignoreCache?: boolean }): Promise<void>;
      getNavigationHistory(): Promise<{
        currentIndex: number;
        entries: Array<{ id: number; url: string; title: string }>;
      }>;
      navigateToHistoryEntry(params: { entryId: number }): Promise<void>;
    };

    Runtime: {
      enable(): Promise<void>;
      evaluate(params: {
        expression: string;
        returnByValue?: boolean;
        awaitPromise?: boolean;
      }): Promise<{
        result: { value: unknown };
        exceptionDetails?: { text: string };
      }>;
    };

    DOM: {
      enable(): Promise<void>;
      getDocument(): Promise<{ root: { nodeId: number } }>;
      getBoxModel(params: { nodeId: number }): Promise<{ model: unknown }>;
    };

    Target: {
      getTargetInfo(): Promise<{ targetInfo: Target }>;
    };

    Input: {
      dispatchKeyEvent(params: {
        type: 'keyDown' | 'keyUp' | 'char';
        text?: string;
        key?: string;
      }): Promise<void>;
    };
  }

  interface Options {
    host?: string;
    port?: number;
    target?: string | ((targets: Target[]) => Target);
  }

  interface CDPModule {
    (options?: Options): Promise<Client>;
    List(options?: { host?: string; port?: number }): Promise<Target[]>;
    Version(options?: { host?: string; port?: number }): Promise<{
      Browser?: string;
      'Protocol-Version'?: string;
      'User-Agent'?: string;
    }>;
  }

  const CDP: CDPModule;

  namespace CDP {
    export type { Target, Client };
  }

  export = CDP;
}
