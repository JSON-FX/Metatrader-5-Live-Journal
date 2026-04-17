import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  SeriesType,
  Time,
} from 'lightweight-charts';

// fancy-canvas ships as a transitive dep of lightweight-charts and its
// CanvasRenderingTarget2D type isn't re-exported from the main entry. We
// infer the target type from the renderer interface so we never import it.
type DrawTarget = Parameters<IPrimitivePaneRenderer['draw']>[0];

export interface TradeBoxOverlays {
  side: 'buy' | 'sell';
  openTime: number;              // unix seconds UTC
  openPrice: number;
  closeTime?: number;
  closePrice?: number;
  currentPrice?: number;
  sl: number | null;
  tp: number | null;
  profit: number;
  symbol: string;
  /** Bar interval in seconds (e.g. 900 for M15). Used to snap openTime/closeTime to bar boundaries
   *  because timeToCoordinate() only resolves exact bar timestamps. */
  barSeconds: number;
}

export interface TradeBoxColors {
  profit: string;                // rgb() — opacity is applied in the renderer
  loss: string;
  textPrimary: string;
  textMuted: string;
}

class TradeBoxRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly chart: IChartApi,
    private readonly series: ISeriesApi<SeriesType>,
    private readonly overlays: TradeBoxOverlays,
    private readonly colors: TradeBoxColors,
  ) {}

  /** Snap a unix-second timestamp down to the nearest bar boundary so that
   *  timeToCoordinate() returns a valid coordinate.  LWC v5 only maps exact
   *  bar-open timestamps; any mid-bar time returns null. */
  private snapTime(t: number): Time {
    const bs = this.overlays.barSeconds;
    return (Math.floor(t / bs) * bs) as unknown as Time;
  }

  draw(target: DrawTarget) {
    target.useBitmapCoordinateSpace(scope => {
      const ctx = scope.context;
      const { width } = scope.bitmapSize;

      const timeScale = this.chart.timeScale();
      const xOpen = timeScale.timeToCoordinate(this.snapTime(this.overlays.openTime));
      if (xOpen === null) return;
      const xRight = width;                             // extend to chart right edge

      const yOpen = this.series.priceToCoordinate(this.overlays.openPrice);
      if (yOpen === null) return;

      const pxRatio = scope.horizontalPixelRatio;
      const x0 = xOpen * pxRatio;
      const y0 = yOpen * scope.verticalPixelRatio;

      // Reward box (open → tp)
      if (this.overlays.tp !== null) {
        const yTp = this.series.priceToCoordinate(this.overlays.tp);
        if (yTp !== null) {
          const yTpPx = yTp * scope.verticalPixelRatio;
          this.fillRect(ctx, x0, Math.min(y0, yTpPx), xRight - x0, Math.abs(yTpPx - y0),
                        this.rgba(this.colors.profit, 0.12));
        }
      }
      // Risk box (sl → open)
      if (this.overlays.sl !== null) {
        const ySl = this.series.priceToCoordinate(this.overlays.sl);
        if (ySl !== null) {
          const ySlPx = ySl * scope.verticalPixelRatio;
          this.fillRect(ctx, x0, Math.min(y0, ySlPx), xRight - x0, Math.abs(ySlPx - y0),
                        this.rgba(this.colors.loss, 0.12));
        }
      }

      // P&L band: between openPrice and currentPrice/closePrice
      const endPrice = this.overlays.currentPrice ?? this.overlays.closePrice;
      if (endPrice !== undefined) {
        const yEnd = this.series.priceToCoordinate(endPrice);
        if (yEnd !== null) {
          const yEndPx = yEnd * scope.verticalPixelRatio;
          const isWinning = this.overlays.profit >= 0;
          this.fillRect(ctx, x0, Math.min(y0, yEndPx), xRight - x0, Math.abs(yEndPx - y0),
                        this.rgba(isWinning ? this.colors.profit : this.colors.loss, 0.22));

          // Entry → current/close connector: dashed line
          const xEndRaw = this.overlays.closeTime ?? this.overlays.openTime;
          const xEnd = timeScale.timeToCoordinate(this.snapTime(xEndRaw));
          if (xEnd !== null) {
            const xEndPx = xEnd * pxRatio;
            ctx.save();
            ctx.strokeStyle = this.rgba(isWinning ? this.colors.profit : this.colors.loss, 0.9);
            ctx.lineWidth = 1 * pxRatio;
            ctx.setLineDash([4 * pxRatio, 4 * pxRatio]);
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(xEndPx, yEndPx);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    });
  }

  private fillRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  /** Accepts "rgb(r, g, b)" or "#rrggbb"; appends alpha. */
  private rgba(color: string, alpha: number): string {
    const c = color.trim();
    if (c.startsWith('#')) {
      const r = parseInt(c.slice(1, 3), 16);
      const g = parseInt(c.slice(3, 5), 16);
      const b = parseInt(c.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    const m = c.match(/\d+/g);
    if (m && m.length >= 3) {
      return `rgba(${m[0]},${m[1]},${m[2]},${alpha})`;
    }
    return c;
  }
}

class TradeBoxPaneView implements IPrimitivePaneView {
  constructor(
    private readonly chart: IChartApi,
    private readonly series: ISeriesApi<SeriesType>,
    private overlays: TradeBoxOverlays,
    private colors: TradeBoxColors,
  ) {}

  zOrder() { return 'bottom' as const; }

  setOverlays(o: TradeBoxOverlays) { this.overlays = o; }
  setColors(c: TradeBoxColors)     { this.colors = c; }

  renderer(): IPrimitivePaneRenderer {
    return new TradeBoxRenderer(this.chart, this.series, this.overlays, this.colors);
  }
}

export class TradeBoxPrimitive implements ISeriesPrimitive<Time> {
  private readonly view: TradeBoxPaneView;
  private requestUpdate: (() => void) | null = null;

  constructor(
    chart: IChartApi,
    series: ISeriesApi<SeriesType>,
    overlays: TradeBoxOverlays,
    colors: TradeBoxColors,
  ) {
    this.view = new TradeBoxPaneView(chart, series, overlays, colors);
  }

  // lightweight-charts v5 primitive lifecycle hooks
  attached(param: { requestUpdate: () => void }) {
    this.requestUpdate = param.requestUpdate;
  }
  detached() {
    this.requestUpdate = null;
  }

  paneViews() { return [this.view]; }
  updateAllViews() { /* views read from their own fields */ }

  update(overlays: TradeBoxOverlays) {
    this.view.setOverlays(overlays);
    this.requestUpdate?.();
  }
  setColors(colors: TradeBoxColors) {
    this.view.setColors(colors);
    this.requestUpdate?.();
  }
}
