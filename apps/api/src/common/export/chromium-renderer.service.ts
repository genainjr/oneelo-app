import { Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright';
import type { Browser } from 'playwright';
import { performance } from 'node:perf_hooks';
import { ExportServiceUnavailableException } from './export-error';
import type {
  DocumentFormat,
  DocumentPageSelection,
  RenderedBatchDocument,
  RenderedBatchFile,
  RenderedDocument,
} from './document-export.types';
import { toMiB } from './document-format.utils';

export const CHROMIUM_LOW_MEMORY_ARGS = [
  '--disable-dev-shm-usage',
  '--disable-gpu',
  ...(process.platform === 'linux' ? ['--no-sandbox', '--no-zygote'] : []),
  '--renderer-process-limit=1',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-default-apps',
  '--disable-sync',
  '--mute-audio',
  '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1',
  '--js-flags=--max-old-space-size=128',
];

export interface ExecuteRenderTaskContext {
  browser: Browser;
}

export interface RenderExecutionOptions {
  format: DocumentFormat;
  pageSelection: DocumentPageSelection;
  queryMs?: number;
  eventName?: string;
}

@Injectable()
export class ChromiumRendererService {
  private readonly logger = new Logger(ChromiumRendererService.name);
  private renderQueue: Promise<void> = Promise.resolve();
  private activeRenders = 0;
  private waitingCount = 0;

  private maxQueueWaiting = 3;
  private renderTimeoutMs = 25_000;

  setLimitsForTesting(limits: {
    maxQueueWaiting?: number;
    renderTimeoutMs?: number;
  }) {
    if (limits.maxQueueWaiting !== undefined) {
      this.maxQueueWaiting = limits.maxQueueWaiting;
    }
    if (limits.renderTimeoutMs !== undefined) {
      this.renderTimeoutMs = limits.renderTimeoutMs;
    }
  }

  getQueueState() {
    return {
      activeRenders: this.activeRenders,
      waitingCount: this.waitingCount,
    };
  }

  async launchBrowser(): Promise<Browser> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const browser = await chromium
        .launch({
          headless: true,
          args: CHROMIUM_LOW_MEMORY_ARGS,
        })
        .catch(() => null);
      if (browser?.isConnected()) return browser;
    }
    throw new Error('Nao foi possivel iniciar o navegador de renderizacao.');
  }

  async waitForImages(page: {
    evaluate?: (fn: () => Promise<void>) => Promise<void>;
  }): Promise<void> {
    if (typeof page.evaluate !== 'function') {
      return;
    }
    await page
      .evaluate(async () => {
        const images = Array.from(document.images);
        await Promise.all(
          images.map(async (img) => {
            if (!img.complete) {
              await new Promise<void>((resolve) => {
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
              });
            }
            if (typeof img.decode === 'function') {
              await img.decode().catch(() => undefined);
            }
          }),
        );
      })
      .catch(() => undefined);
  }

  async runSerialRender<T>(
    options: RenderExecutionOptions,
    renderTask: (browser: Browser, markLaunchMs: () => number) => Promise<T>,
  ): Promise<T> {
    const startedAt = performance.now();
    const rssBeforeMiB = toMiB(process.memoryUsage().rss);
    const eventName = options.eventName ?? 'document_export';

    if (this.activeRenders > 0 && this.waitingCount >= this.maxQueueWaiting) {
      this.logger.warn(
        JSON.stringify({
          event: `${eventName}_rejected_queue_full`,
          format: options.format,
          page: options.pageSelection,
          queueSize: this.waitingCount,
          activeRenders: this.activeRenders,
          rssMiB: rssBeforeMiB,
        }),
      );
      throw new ExportServiceUnavailableException(
        'Muitas exportações simultâneas em andamento. Tente novamente em alguns segundos.',
        5,
      );
    }

    const wasQueued = this.activeRenders > 0;
    if (wasQueued) {
      this.waitingCount += 1;
    } else {
      this.activeRenders = 1;
    }

    const runTask = async () => {
      if (wasQueued) {
        this.waitingCount = Math.max(0, this.waitingCount - 1);
        this.activeRenders = 1;
      }
      try {
        return await this.executeWithTimeout(
          options,
          renderTask,
          rssBeforeMiB,
          startedAt,
          eventName,
        );
      } finally {
        if (this.waitingCount === 0) {
          this.activeRenders = 0;
        }
      }
    };

    const queuedRender = this.renderQueue.then(runTask, runTask);
    this.renderQueue = queuedRender.then(
      () => undefined,
      () => undefined,
    );
    return queuedRender;
  }

  private async executeWithTimeout<T>(
    options: RenderExecutionOptions,
    renderTask: (browser: Browser, markLaunchMs: () => number) => Promise<T>,
    rssBeforeMiB: number,
    startedAt: number,
    eventName: string,
  ): Promise<T> {
    let activeBrowser: Browser | null = null;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        if (activeBrowser) {
          activeBrowser.close().catch(() => undefined);
        }
        reject(
          new ExportServiceUnavailableException(
            'O tempo limite para gerar o documento foi excedido. Tente novamente em instantes.',
            5,
          ),
        );
      }, this.renderTimeoutMs);
      timeoutHandle.unref?.();
    });

    const executionPromise = (async () => {
      const launchStart = performance.now();
      const browser = await this.launchBrowser();
      activeBrowser = browser;
      let launchMs = Math.round(performance.now() - launchStart);

      const markLaunchMs = () => {
        launchMs = Math.round(performance.now() - launchStart);
        return launchMs;
      };

      try {
        return await renderTask(browser, markLaunchMs);
      } finally {
        await browser.close().catch(() => undefined);
      }
    })();

    try {
      return await Promise.race([executionPromise, timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  logRenderMetrics(metrics: {
    eventName?: string;
    format: DocumentFormat;
    page: DocumentPageSelection;
    pageCount: number;
    queryMs: number;
    launchMs: number;
    renderMs: number;
    totalMs: number;
    bufferBytes: number;
    rssBeforeMiB: number;
  }) {
    const rssAfterMiB = toMiB(process.memoryUsage().rss);
    const eventName = metrics.eventName ?? 'document_export';
    this.logger.log(
      JSON.stringify({
        event: eventName,
        format: metrics.format,
        page: metrics.page,
        pageCount: metrics.pageCount,
        queryMs: metrics.queryMs,
        launchMs: metrics.launchMs,
        renderMs: metrics.renderMs,
        totalMs: metrics.totalMs,
        bufferBytes: metrics.bufferBytes,
        rssBeforeMiB: metrics.rssBeforeMiB,
        cache: 'miss',
        rssAfterMiB,
        rssDeltaMiB: Number((rssAfterMiB - metrics.rssBeforeMiB).toFixed(1)),
        queueSize: this.waitingCount,
      }),
    );
  }

  logCacheHitMetrics(metrics: {
    eventName?: string;
    format: DocumentFormat;
    page: DocumentPageSelection;
    pageCount: number;
    queryMs: number;
    totalMs: number;
    bufferBytes: number;
    rssBeforeMiB: number;
    cache: 'hit' | 'etag';
  }) {
    const eventName = metrics.eventName ?? 'document_export';
    this.logger.log(
      JSON.stringify({
        event: eventName,
        format: metrics.format,
        page: metrics.page,
        pageCount: metrics.pageCount,
        cache: metrics.cache,
        queryMs: metrics.queryMs,
        launchMs: 0,
        renderMs: 0,
        totalMs: metrics.totalMs,
        bufferBytes: metrics.bufferBytes,
        rssBeforeMiB: metrics.rssBeforeMiB,
        rssAfterMiB: toMiB(process.memoryUsage().rss),
        queueSize: this.waitingCount,
      }),
    );
  }
}
