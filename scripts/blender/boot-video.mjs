// =============================================================
// boot-video.mjs — 사진 모드 렌더(PNG)를 웹용 영상·사진으로 줄여 public/boot/ 에 씀
// -------------------------------------------------------------
// 입력: scripts/blender/boot-photos.py 가 만든 폴더
//   <폴더>/rack/f0000.png … f0671.png   둘러보기 28초 × 24 fps (frames 모드)
//   <폴더>/gpu/f0000.png …
//   <폴더>/rack-open.png · gpu-open.png · gpu-board.png   정지 사진 (still 모드, 가로 약 2560 px)
// 출력 (public/boot/, 사진 모드일 때만 받음):
//   rack.av1.mp4 · gpu.av1.mp4     AV1 — 같은 화질에 가장 가벼움 (요즘 브라우저·기기)
//   rack.h264.mp4 · gpu.h264.mp4   H.264 — AV1 을 못 트는 기기용 (오래된 iPhone·Mac 의 Safari 등)
//   rack-960.* · gpu-960.*          가로 960 판 — 휴대폰·저해상도 화면용 (받는 양 약 절반)
//   rack-open.avif · gpu-open.avif  다 연 정지 사진 (움직임 줄이기 설정 · 랙 직접 확대)
//   gpu-board.avif                  냉각판·뚜껑을 걷어 낸 기판 (GPU 직접 확대 — 그림도 확대하면 앞층을 감춤)
// 투명 배경은 그림 카드 색(#fbfbfa) 위에 얹어 굳힘 (영상은 투명을 담기 어려움)
// 실행: node scripts/blender/boot-video.mjs <렌더 폴더> [출력 폴더 — 기본 public/boot, 시험할 때만 바꿈] [--only=big|small|still]
//   --only 없으면 전부. big = 가로 1280 영상, small = 가로 960 영상, still = 정지 사진
// =============================================================
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ARGS = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);   // "" = 전부
const SRC = ARGS[0];
const OUT = ARGS[1] || join(ROOT, "public", "boot");
const CARD = "0xfbfbfa";   // 부팅 화면 그림 카드 배경색 (index.html 의 .boot-card)
const FPS = 24;
if (!SRC) {
  console.error("사용법: node scripts/blender/boot-video.mjs <렌더 폴더>");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

// ffmpeg 실행 (실패하면 바로 멈춤)
function ffmpeg(args) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", ...args], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("ffmpeg 실패: " + args.join(" "));
}

// PNG 크기 읽기 (ffprobe)
function sizeOf(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file], { encoding: "utf8" });
  const [w, h] = r.stdout.trim().split(",").map(Number);
  return { w, h };
}

const kb = (file) => (statSync(file).size / 1024).toFixed(0) + " KB";

// 색 변환: RGB → YUV 는 BT.709 행렬·제한 범위로 하고 같은 값을 꼬리표로 붙임 (브라우저가 같은 식으로 되돌려 카드 색과 맞음)
//   전달 함수는 sRGB(iec61966-2-1) 로 표시 — PNG 가 sRGB 이고, bt709 로 적으면 Safari 가 감마를 달리 풀어 희뿌옇게 보임
const TAGS = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "iec61966-2-1", "-color_range", "tv"];
//   (ffmpeg 8 의 인코더는 꼬리표를 프레임에서 읽으므로 setparams 로 프레임에도 붙임)
const TO_YUV = "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=iec61966-2-1:colorspace=bt709:range=tv";
// 카드 색 위에 얹기: 합치기는 RGB 로만 (ffmpeg 의 color·overlay 가 제멋대로 BT.601 YUV 로 바꾸면 색이 틀어짐)
// 바닥 그림자 손질 — 그림자만 받는 바닥의 픽셀은 "검정 + 반투명"(PNG 는 곱하지 않은 알파)이라 물체와 구별됨
//   ① 랙이 하늘빛을 조금 가려 화면 끝까지 아주 옅은 그늘(불투명도 2~5/255)이 남음 → 6 을 빼고 다시 늘림 (이어지는 값이라 경계선 없음)
//   ② 긴 그림자가 화면 가장자리에서 잘리면 카드 위에 회색 모서리가 생김 → 가장자리 8% 안에서 그림자만 부드럽게 사라지게
//      (물체 픽셀은 불투명해서 건드리지 않음 — 확대 장면에서 화면 끝에 걸친 랙은 그대로)
const SHADOW = "lt(alpha(X,Y),250)*lt(r(X,Y)+g(X,Y)+b(X,Y),9)";
const EDGE = "st(0,clip(min(min(X,W-1-X),min(Y,H-1-Y))/(0.08*W),0,1))*0+ld(0)*ld(0)*(3-2*ld(0))";   // 가장자리 0 → 안쪽 1 (smoothstep)
const TRIM = `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(${SHADOW},clip((alpha(X,Y)-6)*255/249,0,255)*(${EDGE}),alpha(X,Y))'`;
//   width 를 주면 합친 뒤(RGB) 그 폭으로 줄임 (높이는 비율대로, 짝수)
const ON_CARD = (fg, bg, width) => `[${fg}]format=rgba,${TRIM}[fg];[${bg}]format=rgb24[bg];[bg][fg]overlay=format=rgb:shortest=1,${width ? `scale=${width}:-2:flags=lanczos,` : ""}${TO_YUV}`;

// 영상 한 벌 (AV1 + H.264): 투명 PNG 줄 → 카드 색 위에 얹음 → 28초 반복 영상
//   -g 336 = 키프레임은 14초마다 (0·14초 두 장) — 키프레임이 영상 크기의 대부분이라 드물게.
//     건너뛰기(seek)는 사진 모드를 켤 때 한 번뿐이고(반복·확대 후 이어 보기는 건너뛰지 않음), 그때 최대 14초분만 풀면 됨
//   CRF: AV1 40 · H.264 27 — 원본 PNG 와 나란히 놓고 차이가 안 보이는 가장 가벼운 값 (2026-10-21 비교)
//   +faststart = 파일 앞쪽에 목차를 둬서 다 받기 전에 재생·이동 가능
function video(panel, width) {
  const dir = join(SRC, panel);
  const first = join(dir, "f0000.png");
  if (!existsSync(first)) return console.log(`(${panel}: 프레임 없음 — 건너뜀)`);
  const { w, h } = sizeOf(first);
  const input = ["-framerate", String(FPS), "-i", join(dir, "f%04d.png"), "-f", "lavfi", "-i", `color=c=${CARD}:s=${w}x${h}:r=${FPS}`];
  const graph = ["-filter_complex", `${ON_CARD(0, 1, width)}[v]`, "-map", "[v]", "-an"];
  const name = width ? `${panel}-${width}` : panel;
  const av1 = join(OUT, `${name}.av1.mp4`), h264 = join(OUT, `${name}.h264.mp4`);
  ffmpeg([...input, ...graph, "-c:v", "libsvtav1", "-preset", "4", "-crf", "40", "-g", "336", "-svtav1-params", "tune=0", ...TAGS, "-movflags", "+faststart", av1]);
  ffmpeg([...input, ...graph, "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-profile:v", "high", "-g", "336", ...TAGS, "-movflags", "+faststart", h264]);
  console.log(`${name}: ${width || w} 폭 · AV1 ${kb(av1)} · H.264 ${kb(h264)}`);
}

// 정지 사진 (AVIF): 카드 색 위에 얹어 한 장
function still(name) {
  const src = join(SRC, `${name}.png`);
  if (!existsSync(src)) return console.log(`(${name}: 없음 — 건너뜀)`);
  const { w, h } = sizeOf(src);
  const out = join(OUT, `${name}.avif`);
  ffmpeg(["-f", "lavfi", "-i", `color=c=${CARD}:s=${w}x${h}`, "-i", src, "-filter_complex", ON_CARD(1, 0),
    "-frames:v", "1", "-c:v", "libsvtav1", "-preset", "4", "-crf", "30", ...TAGS, out]);
  console.log(`${name}: ${w}×${h} · ${kb(out)}`);
}

if (!ONLY || ONLY === "big") for (const panel of ["rack", "gpu"]) video(panel);
if (!ONLY || ONLY === "small") for (const panel of ["rack", "gpu"]) video(panel, 960);
if (!ONLY || ONLY === "still") for (const name of ["rack-open", "gpu-open", "gpu-board"]) still(name);
