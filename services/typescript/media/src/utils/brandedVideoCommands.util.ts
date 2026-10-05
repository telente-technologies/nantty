export const endCardDurationSeconds = 1.8;
export const watermarkCornerIntervalSeconds = 4;
const outputFrameRate = 30;

export interface BrandedVideoPlan {
  readonly inputPath: string;
  readonly watermarkPngPath: string;
  readonly endCardLogoPngPath: string;
  readonly endCardSymbolLeftPngPath: string;
  readonly endCardSymbolRightPngPath: string;
  readonly outputPath: string;
  readonly width: number;
  readonly height: number;
  readonly durationSeconds: number;
  readonly margin: number;
  readonly keepSourceAudio: boolean;
}

export function buildWatermarkCornerExpressions(margin: number, intervalSeconds = watermarkCornerIntervalSeconds): { readonly x: string; readonly y: string } {
  const corner = `mod(floor(t/${intervalSeconds}),4)`;
  return {
    x: `if(eq(${corner},0)+eq(${corner},3),${margin},W-w-${margin})`,
    y: `if(lt(${corner},2),${margin},H-h-${margin})`,
  };
}

const rippleSeconds = 0.75;

export function buildEndCardRippleExpressions(side: -1 | 1): { readonly x: string; readonly y: string } {
  const settle = `(1-pow(1-min(1,t/${rippleSeconds}),3))`;
  return {
    x: `(W-w)/2+${side}*W*0.16*(1-${settle})`,
    y: `(H-h)/2+${-side}*H*0.06*sin(t*16)*(1-${settle})`,
  };
}

export function buildBrandedVideoFilterGraph(plan: Pick<BrandedVideoPlan, "width" | "height" | "durationSeconds" | "margin" | "keepSourceAudio">): string {
  const { width, height } = plan;
  const corners = buildWatermarkCornerExpressions(plan.margin);
  const audioFormat = "aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo";
  const duration = plan.durationSeconds.toFixed(3);
  const mainAudio = plan.keepSourceAudio ? `[0:a:0]${audioFormat},apad,atrim=0:${duration}[mainaudio]` : `[6:a]${audioFormat},atrim=0:${duration}[mainaudio]`;
  const left = buildEndCardRippleExpressions(-1);
  const right = buildEndCardRippleExpressions(1);
  return [
    `[0:v:0]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${outputFrameRate},format=yuv420p[base]`,
    `[base][1:v]overlay=x='${corners.x}':y='${corners.y}':shortest=1,format=yuv420p[marked]`,
    `color=c=0x3A2BFF:s=${width}x${height}:r=${outputFrameRate}:d=${endCardDurationSeconds}[cardbase]`,
    `[3:v]format=rgba,fade=t=in:st=0:d=0.25:alpha=1[halfleft]`,
    `[4:v]format=rgba,fade=t=in:st=0:d=0.25:alpha=1[halfright]`,
    `[2:v]format=rgba,fade=t=in:st=${rippleSeconds}:d=0.45:alpha=1[logo]`,
    `[cardbase][halfleft]overlay=x='${left.x}':y='${left.y}':shortest=1[cardleft]`,
    `[cardleft][halfright]overlay=x='${right.x}':y='${right.y}':shortest=1[cardsymbol]`,
    `[cardsymbol][logo]overlay=x=(W-w)/2:y=(H-h)/2:shortest=1,setsar=1,format=yuv420p[card]`,
    mainAudio,
    `[5:a]${audioFormat}[cardaudio]`,
    `[marked][mainaudio][card][cardaudio]concat=n=2:v=1:a=1[outv][outa]`,
  ].join(";");
}

export function buildBrandedVideoArgs(plan: BrandedVideoPlan): string[] {
  const silence = ["-f", "lavfi", "-t", String(endCardDurationSeconds), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];
  const mainSilence = plan.keepSourceAudio ? [] : ["-f", "lavfi", "-t", plan.durationSeconds.toFixed(3), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];
  return [
    "-nostdin", "-hide_banner", "-loglevel", "error", "-protocol_whitelist", "file",
    "-i", plan.inputPath,
    "-loop", "1", "-framerate", String(outputFrameRate), "-i", plan.watermarkPngPath,
    "-loop", "1", "-framerate", String(outputFrameRate), "-t", String(endCardDurationSeconds), "-i", plan.endCardLogoPngPath,
    "-loop", "1", "-framerate", String(outputFrameRate), "-t", String(endCardDurationSeconds), "-i", plan.endCardSymbolLeftPngPath,
    "-loop", "1", "-framerate", String(outputFrameRate), "-t", String(endCardDurationSeconds), "-i", plan.endCardSymbolRightPngPath,
    ...silence,
    ...mainSilence,
    "-filter_complex", buildBrandedVideoFilterGraph(plan),
    "-map", "[outv]", "-map", "[outa]",
    "-map_metadata", "-1", "-map_chapters", "-1",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-profile:v", "main", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-ac", "2",
    "-movflags", "+faststart", "-y", plan.outputPath,
  ];
}

export function evenDimension(value: number): number {
  return Math.max(2, Math.floor(value / 2) * 2);
}
