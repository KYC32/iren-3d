// =============================================================
// tools.mjs — 그림 build.mjs 들이 같이 쓰는 그리기 도구 (스위트워터부터 사용)
// -------------------------------------------------------------
// figureTools({ W, P, piece }) 가 이 그림의 투영(P)·작업대(W)에 묶인 도구 묶음을 돌려줌:
//   선·면 도우미(pathOf3·frontSlots·hatch·cutFace …), 관·케이블(cable: 흐름 점선 포함),
//   이음쇠 공(fitting: T·엘보), 도랑 창(trenchWindow: 윗면 윤곽으로 자른 속), 회전체(turned: 애자·부싱 같은 갓 달린 몸통),
//   도장(stamped: 같은 모양은 한 번만 그리고 <use> 로 복사)
// 모든 도구는 그린 것과 같은 3D 모양을 기록 → audit 가 관통·끝점·칠하는 순서를 검사할 수 있음
// =============================================================
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as A from "../kit/audit.mjs";
import { tubePieces, tubeSvg } from "../kit/tube.mjs";

export const r1 = (n) => Math.round(n * 10) / 10;

// ---------- 규모 이름표 (둘러보기 끝: 랙 1대 → 홀·블록 → 캠퍼스, 스위트워터 1·Horizon·전력 블록 그림) ----------
// NVIDIA DSX POD 소개 영상의 연출을 빌림: 장면마다 이름 + 숫자 2개, 숫자 옆 작은 글에 근거(회사 · NVIDIA 사양 · 제3자 관찰 · 추정)
//   그림 오른쪽 위에 여러 장을 겹쳐 두고, 움직임 코드가 그림 칸의 data-plate 를 바꾸면 CSS(power.css)가 그 장만 보여 줌
export const PLATE_BASIS = { company: ["회사", "company"], nvidia: ["NVIDIA 사양", "NVIDIA spec"], observed: ["제3자 관찰", "third-party"], estimate: ["업계 추정", "industry estimate"] };
// cards = [[단계 id, 이름, [[숫자, 설명], [숫자, 설명]]], …] · 숫자와 단위 사이는 줄이 바뀌지 않는 빈칸으로 바꿈
export function platesHtml(cards) {
  const keep = (v) => v.replace(/(\d만?) (?=[A-Za-z%°가-힣])/g, "$1\u00a0");
  return `<div class="rk-plates" aria-hidden="true">${cards.map(([id, name, nums]) =>
    `<div class="rk-plate" data-for="${id}"><b>${name}</b>${nums.map(([v, t]) => `<p><strong>${keep(v)}</strong><span>${t}</span></p>`).join("")}</div>`).join("")}</div>`;
}

export function figureTools({ W, P, piece }) {
  const { R } = W;
  const at = (p) => k.iso(p, P);
  const L = (d, style) => k.lineSvg(d, style);
  const Dt = (points, style) => k.dotsSvg(points, style);
  const seg = (a, b) => k.segment(a, b, P);
  const poly = (pts) => `M${pts.map((p) => at(p).map(r1).join(" ")).join("L")}Z`;   // 3D 다각형 → 화면 경로 (닫힘)
  const pathOf3 = (pts) => `M${pts.map((p) => at(p).map(r1).join(" ")).join("L")}`;   // 3D 꺾은선 → 화면 경로
  const onFront = (Y, pts) => pts.map(([x, z]) => [x, Y, z]);
  const onRight = (X, pts) => pts.map(([y, z]) => [X, y, z]);
  // 닫힌 사각 슬롯들 (환기구·루버): 앞면(y = Y) / 오른쪽 면(x = X)
  const frontSlots = (Y, x0, x1, z0, n, pitch, h) => Array.from({ length: n }, (_, i) => { const a = z0 + i * pitch, b = a + h; return pathOf3(onFront(Y, [[x0, a], [x1, a], [x1, b], [x0, b], [x0, a]])); }).join("");
  const rightSlots = (X, y0, y1, z0, n, pitch, h) => Array.from({ length: n }, (_, i) => { const a = z0 + i * pitch, b = a + h; return pathOf3(onRight(X, [[y0, a], [y1, a], [y1, b], [y0, b], [y0, a]])); }).join("");
  const frontSeams = (Y, xs, z0, z1) => xs.map((x) => seg([x, Y, z0], [x, Y, z1])).join("");
  const rightSeams = (X, ys, z0, z1) => ys.map((y) => seg([X, y, z0], [X, y, z1])).join("");
  const frontRules = (Y, x0, x1, zs) => zs.map((z) => seg([x0, Y, z], [x1, Y, z])).join("");
  const range = (a, b, step) => { const out = []; for (let v = a; v <= b + 1e-9; v += step) out.push(+v.toFixed(3)); return out; };
  // 단면 빗금: 사각형(u 0..w, v 0..h)을 45° 빗금으로 → toW(u, v) 가 3D 점을 돌려줌
  function hatch(w, h, step, toW) {
    const out = [];
    for (let c = -h + step / 2; c < w; c += step) {
      const u0 = Math.max(0, c), v0 = u0 - c, u1 = Math.min(w, c + h), v1 = u1 - c;
      if (u1 - u0 > 0.05) out.push(seg(toW(u0, v0), toW(u1, v1)));
    }
    return out.join("");
  }
  const cutFace = (corners, hatchD) => `<g class="pw-cutface"><path class="pw-cutfill" d="${poly(corners)}"/>${L(hatchD, { tone: "lo" })}<path class="pw-cutedge" d="${poly(corners)}"/></g>`;
  // 직사각형에서 구멍(직사각형들)을 뺀 나머지 → 겹치지 않는 직사각형들
  function minus(rect, holes) {
    const xs = [...new Set([rect.x0, rect.x1, ...holes.flatMap((h) => [h.x0, h.x1])])].filter((x) => x >= rect.x0 && x <= rect.x1).sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const a = xs[i], b = xs[i + 1], mid = (a + b) / 2;
      const cuts = holes.filter((h) => h.x0 < mid && h.x1 > mid).map((h) => [Math.max(rect.y0, h.y0), Math.min(rect.y1, h.y1)]).sort((p, q) => p[0] - q[0]);
      let y = rect.y0;
      for (const [c0, c1] of cuts) { if (c0 > y) out.push({ x0: a, x1: b, y0: y, y1: c0 }); y = Math.max(y, c1); }
      if (y < rect.y1) out.push({ x0: a, x1: b, y0: y, y1: rect.y1 });
    }
    return out;
  }
  // 상태 그림 묶음: 같은 자리에 n 장을 그려 두고 움직임 코드가 하나만 보여 줌 (data-<kind>="i")
  const frames = (kind, list) => list.map((svg, i) => `<g data-${kind}="${i}"${i === 0 ? "" : ' style="display:none"'}>${svg}</g>`).join("");
  // 표시등 (원 하나, 색은 CSS 가 상태에 따라)
  const lamp = (cls, p, r, attr = "") => { const [x, y] = at(p); return `<circle class="${cls}" ${attr} cx="${r1(x)}" cy="${r1(y)}" r="${r}"/>`; };

  // ---------- 도장(stamp): 똑같이 생긴 부품은 처음 하나만 그리고 나머지는 <use> 로 복사 ----------
  //   등각 투영은 3D 평행이동을 화면 평행이동으로 옮기므로 위치 차이만큼 translate 하면 똑같음 → 파일이 작아짐
  //   (모양 기록·칠하는 순서는 부품마다 따로라 그대로 맞음 · 같은 stamp 이름 = 같은 단면·같은 방향이어야 함)
  const stamps = new Map();
  function stamped(stamp, ref, draw) {
    if (!stamp) return draw();
    const first = stamps.get(stamp);
    if (!first) { const id = `st-${piece}-${stamp}`; stamps.set(stamp, { id, ref }); return `<g id="${id}">${draw()}</g>`; }
    const a = at(first.ref), b = at(ref);
    return `<use href="#${first.id}" transform="translate(${(b[0] - a[0]).toFixed(2)} ${(b[1] - a[1]).toFixed(2)})"/>`;
  }

  // ---------- 관·케이블 (흐름 점선 포함) ----------
  //   흐름 이름(flow)은 그림마다 정함 → 움직임 코드가 상태에 따라 켬. 조각마다 그 조각의 시작 위치로 무늬를 이어 붙여 끊김 없음
  //   fw = 흐름 선 굵기 (굵은 관일수록 굵게)
  function cable(name, points, r, { cls = "pw-black", tone = "mid", flow, fw, bend, maxLength = 14, gaps = [], caps = true, bias = 0.02, owner, bundle, info, clip, fillet = true, touch } = {}) {
    const route = fillet ? G.fillet(points, Math.max(bend ?? r * 2.6, r * 2.6), 10, { P, tube: r }) : points;
    R.route(name, route, r, { gaps, owner: owner ?? name, bundle, touch, piece });
    const spacing = fillet ? Math.max(0.5, Math.min(1.6, r)) : Math.max(4, r * 6);
    const pieces = tubePieces(route, r, P, { maxLength, spacing, gaps, caps });
    const dense = G.resample(route, spacing);
    const scr = [0];
    for (let i = 1; i < dense.length; i++) { const a = at(dense[i - 1]), b = at(dense[i]); scr.push(scr[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    const len3 = [0];
    for (let i = 1; i < dense.length; i++) len3.push(len3[i - 1] + G.len3(G.sub3(dense[i], dense[i - 1])));
    const screenAt = (s) => { let i = 1; while (i < len3.length - 1 && len3[i] < s) i++; const t = (s - len3[i - 1]) / Math.max(1e-9, len3[i] - len3[i - 1]); return scr[i - 1] + (scr[i] - scr[i - 1]) * Math.min(1, Math.max(0, t)); };
    pieces.forEach((chunk, index) => {
      let svg = W.wrap(cls, tubeSvg(chunk, { tone }));
      if (flow) {
        const pts = G.cut(dense, chunk.from, chunk.to).map(at);
        if (pts.length > 1) svg += `<path class="pw-flow" data-flow="${flow}" style="--d0:${r1(screenAt(chunk.from))}px${fw ? `;--fw:${fw}` : ""}" d="M${pts.map((p) => p.map(r1).join(" ")).join("L")}"/>`;
      }
      if (clip) svg = clip(svg);
      W.put(`${name}:${index}`, chunk.mid, svg, [A.tube(chunk.points, chunk.radii, { name, owner: owner ?? name, bundle, touch })], { bias, info, route: name, chunk: index });
    });
    return route;
  }
  // 상자 면 위의 흐름 선 (관이 아닌 통로): 점들을 잇는 흐름 점선 하나
  const faceFlow = (flow, pts, fw) => `<path class="pw-flow" data-flow="${flow}" style="--d0:0px${fw ? `;--fw:${fw}` : ""}" d="${pathOf3(pts)}"/>`;
  // 이음쇠(공): 관이 갈라지는 T 자리나 꺾이는 엘보. 본관은 공 자리를 비우고(gap), 가지관은 공 표면에서 끝남
  //   R ≥ √(본관² + 가지관²) 이면 두 관의 테두리가 서로 삐져나오지 않음 (kit 규칙)
  const reach = (Rb, r) => Math.sqrt(Rb * Rb - r * r);    // 공 가운데에서 관 끝(테두리가 공 표면)까지
  const teeGaps = (alongs, Rb, r) => alongs.map((s0) => [s0 - reach(Rb, r), s0 + reach(Rb, r)]);
  function fitting(name, c, Rb, { cls = "hz-alu", owner, info } = {}) {
    const shape = R.solid(A.ball(c, Rb, { name, owner }));
    const steps = Math.max(12, Math.min(32, Math.ceil((2 * Math.PI * Rb * G.scaleOf(P)) / 3)));   // 화면에서 한 조각 ≈ 3 px
    // 같은 반지름·같은 재료의 공은 모양이 같음 → 도장으로 복사
    W.put(name, c, stamped(`ball-${cls}-${Rb}`, c, () => W.wrap(cls, k.solidSvg(G.sphereOf(c, Rb, P, { steps }), { tone: "mid" }))), [shape], { info });
  }
  // 회전체: 축(F) 위 단면(meridian = [[축 위치, 반지름], …])을 돌린 몸통 — 애자·부싱·피뢰기처럼 갓이 달린 것
  function turned(name, F, meridian, { cls = "pw-steel", tone = "mid", info, owner, bias = 0, extra = "", stamp } = {}) {
    const shape = R.solid(A.body(F, meridian, { name, owner }));
    const s0 = meridian[0][0], s1 = meridian[meridian.length - 1][0];
    const mid = G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2));
    const rmax = Math.max(...meridian.map(([, r]) => r));
    const steps = Math.max(12, Math.min(40, Math.ceil((2 * Math.PI * rmax * G.scaleOf(P)) / 3)));
    W.put(name, mid, stamped(stamp, F.o, () => W.wrap(cls, k.solidSvg(G.lathe(meridian, F, P, { steps }), { tone }) + extra)), [shape], { info, bias });
    return shape;
  }
  // 갓 달린 애자 단면: 길이 len, 몸통 r0, 갓 r1, 갓 n 개 (양 끝 쇠 테)
  function shedProfile(len, r0, r1s, n) {
    const pts = [[0, 0], [0, r0 + 0.3], [0.5, r0 + 0.3], [0.5, r0]];
    const pitch = (len - 1) / n;
    for (let i = 0; i < n; i++) {
      const s = 0.5 + i * pitch;
      pts.push([s + pitch * 0.25, r0], [s + pitch * 0.4, r1s], [s + pitch * 0.55, r1s * 0.9], [s + pitch * 0.75, r0]);
    }
    pts.push([len - 0.5, r0], [len - 0.5, r0 + 0.3], [len, r0 + 0.3], [len, 0]);
    return pts;
  }

  // ---------- 도랑 창 (속을 잘라 보여 줌): 바닥 + 안쪽 벽 2면, 모두 창 윤곽으로 자름 ----------
  const clips = [];
  function trenchWindow(id, T, top, info) {
    const PIT = T.pit;
    const rim = [[T.x, T.y, top], [T.x + T.w, T.y, top], [T.x + T.w, T.y + T.d, top], [T.x, T.y + T.d, top]];
    clips.push(`<clipPath id="${id}"><path d="${poly(rim)}"/></clipPath>`);
    const clip = (svg) => `<g clip-path="url(#${id})">${svg}</g>`;
    const floor = [[T.x, T.y, PIT], [T.x + T.w, T.y, PIT], [T.x + T.w, T.y + T.d, PIT], [T.x, T.y + T.d, PIT]];
    const westWall = [[T.x, T.y, PIT], [T.x, T.y + T.d, PIT], [T.x, T.y + T.d, top], [T.x, T.y, top]];
    const northWall = [[T.x, T.y, PIT], [T.x + T.w, T.y, PIT], [T.x + T.w, T.y, top], [T.x, T.y, top]];
    const svg = `<g class="pw-soil"><path class="pw-soilfloor" d="${poly(floor)}"/><path class="pw-soilwall" d="${poly(westWall)}"/><path class="pw-soilwall2" d="${poly(northWall)}"/>${L(seg([T.x, T.y, PIT], [T.x, T.y + T.d, PIT]) + seg([T.x, T.y, PIT], [T.x + T.w, T.y, PIT]), { tone: "mid" })}</g>`;
    const shapes = [
      R.solid(A.box([T.x, T.y, PIT - 0.05], [T.x + T.w, T.y + T.d, PIT], { name: `stand.${id}.floor` })),
      R.solid(A.box([T.x - 0.05, T.y, PIT], [T.x, T.y + T.d, top], { name: `stand.${id}.west` })),
      R.solid(A.box([T.x, T.y - 0.05, PIT], [T.x + T.w, T.y, top], { name: `stand.${id}.north` })),
    ];
    // 앞을 가리는 두 벽(동·남)은 그리지 않음 → 관 끝이 닿는 자리로만 따로 기록
    R.solid(A.box([T.x + T.w, T.y, PIT], [T.x + T.w + 0.05, T.y + T.d, top], { name: `stand.${id}.east` }));
    R.solid(A.box([T.x, T.y + T.d, PIT], [T.x + T.w, T.y + T.d + 0.05, top], { name: `stand.${id}.south` }));
    W.put(`${id}.pit`, [T.x + T.w / 2, T.y + T.d / 2, PIT - 3], clip(svg), shapes, { info, bias: -20 });
    return clip;
  }

  return { R, at, L, Dt, seg, poly, pathOf3, onFront, onRight, frontSlots, rightSlots, frontSeams, rightSeams, frontRules, range, hatch, cutFace, minus, frames, lamp,
    cable, faceFlow, reach, teeGaps, fitting, turned, shedProfile, trenchWindow, clips };
}
