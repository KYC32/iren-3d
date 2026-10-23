// =============================================================
// shop.mjs — 두 그림(랙·GPU)이 같이 쓰는 "작업대" 도구
// -------------------------------------------------------------
// 부품 하나를 그릴 때 두 가지를 동시에 합니다.
//   1) SVG 문자열을 만든다 (그림)
//   2) 그 부품의 실제 3D 모양을 기록한다 (audit.mjs 가 겹침·관통·칠하는 순서를 계산하는 데 씀)
// 마지막에 settle() 을 부르면, 화면에서 겹치는 부품끼리 "어느 쪽이 앞인지"를 광선으로 재서
// 칠하는 순서(key)를 정해 줍니다. 그래서 순서를 눈대중으로 맞출 필요가 없습니다.
// 층(layer)마다 따로 workshop() 을 만들면, 그 층 안에서만 순서를 정합니다.
// =============================================================
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../kit/tube.mjs";
import * as A from "../kit/audit.mjs";

export function workshop(P, { piece = "fig" } = {}) {
  const R = A.recorder(P);
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const Dt = (points, style) => k.dotsSvg(points, style);
  // 색 묶음 클래스로 감싸기 (.rk-copper 등: 그 안의 모든 토큰 색이 바뀜)
  const wrap = (cls, svg) => (cls ? `<g class="${cls}">${svg}</g>` : svg);

  // 그린 것 하나를 등록: ref = 칠하는 순서의 기준점(3D), shapes = 기록한 실제 모양들
  //   info = 부품 설명 키 (확대 화면에서 포인터 아래 부품의 이름·역할을 찾는 데 씀 → <g data-info="키">)
  function put(name, ref, svg, shapes = [], { bias = 0, info, ...rest } = {}) {
    // 안전장치: 평면에 r 이 빠지는 등 숫자가 깨지면 좌표가 NaN 이 되어 부품이 조용히 사라짐 → 빌드를 멈춤
    if (svg.includes("NaN")) throw new Error(`${name}: 좌표에 NaN — 평면(plan)의 x·y·w·d·r을 확인하세요`);
    if (info) svg = `<g data-info="${info}">${svg}</g>`;
    return R.put({ name: R.nameFor(name), at: ref, bias, svg, shapes, piece, ...rest });
  }
  // 모양만 기록 (그리지 않는 받침·숨은 부품: 호스 끝이 닿는 자리 등)
  const ghost = (shape) => R.solid(shape);
  // 도장(stamp): 똑같이 생긴 부품(인덕터·콘덴서 등)은 처음 하나만 그리고 나머지는 <use> 로 복사
  //   아이소 투영은 평행이동을 그대로 화면 평행이동으로 옮기므로, 위치 차이만큼 translate 하면 똑같음 → 파일이 작아짐
  //   (모양 기록·칠하는 순서는 부품마다 따로라 그대로 맞음)
  const stamps = new Map();
  function stamped(stamp, ref, draw) {
    if (!stamp) return draw();
    const first = stamps.get(stamp);
    if (!first) {
      const id = `rk-${piece}-${stamp}`;
      stamps.set(stamp, { id, ref });
      return `<g id="${id}">${draw()}</g>`;
    }
    const a = at(first.ref), b = at(ref);
    return `<use href="#${first.id}" transform="translate(${(b[0] - a[0]).toFixed(2)} ${(b[1] - a[1]).toFixed(2)})"/>`;
  }

  // 둥근 모서리 상자 (바닥 평면 plan = {x, y, w, d, r}, 높이 z..z+h)
  function box(name, plan, z, h, { cls, tone = "mid", steps = 2, bevel = 0, crease, lit, flat, className, extra = "", inner = "", bias = 0, owner, stamp, info } = {}) {
    const shape = R.solid(A.slab(plan, z, h, { name, owner }, steps));
    const svg = stamped(stamp, [plan.x, plan.y, z], () => wrap(cls, S(k.slabOf(plan, z, h, P, steps, bevel), { tone, crease, lit, flat, className, inner }) + extra));
    put(name, [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], svg, [shape], { bias, info });
    return shape;
  }
  // 세운 원기둥 (축 = z)
  function cyl(name, cx, cy, r, z, h, { cls, tone = "mid", steps = 20, bevel = 0, extra = "", inner = "", bias = 0, owner, stamp, info } = {}) {
    const shape = R.solid(A.cylinder(cx, cy, r, z, h, { name, owner }));
    put(name, [cx, cy, z + h / 2], stamped(stamp, [cx, cy, z], () => wrap(cls, S(k.cylinder(cx, cy, r, z, h, P, steps, bevel), { tone, inner }) + extra)), [shape], { bias, info });
    return shape;
  }
  // 아무 축 방향의 짧은 원통 (F = frameAlong(원점, 축), s0..s1 = 축 위 구간)
  //   면 조각 수 = 화면에서 한 조각이 약 3 px (작은 부품을 32조각 이상으로 그리면 파일만 커짐)
  const stepsOf = (r) => Math.max(10, Math.min(48, Math.ceil((2 * Math.PI * r * G.scaleOf(P)) / 3)));
  function disc(name, F, s0, s1, r, { cls, tone = "mid", extra = "", inner = "", bias = 0, owner, bevel = 0, stamp, info } = {}) {
    const shape = R.solid(A.disc(F, s0, s1, r, { name, owner }));
    const mid = G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2));
    put(name, mid, stamped(stamp, F.o, () => wrap(cls, S(G.disc(s0, s1, r, F, P, { bevel, steps: stepsOf(r) }), { tone, inner }) + extra)), [shape], { bias, info });
    return shape;
  }
  // 공 (꺾이는 이음쇠 = 엘보)
  function ball(name, c, r, { cls, tone = "mid", bias = 0, owner } = {}) {
    const shape = R.solid(A.ball(c, r, { name, owner }));
    put(name, c, wrap(cls, S(G.sphereOf(c, r, P, { steps: 32 }), { tone })), [shape], { bias });
    return shape;
  }
  // 호스·관: 꺾은선 → 모서리를 둥글게(fillet) → 짧은 조각으로 잘라 조각마다 등록
  //   gaps = 그 구간은 그리지 않음 (끝의 쇠고리·연결부가 덮는 자리)
  //   stamp: 길이·방향이 같은 호스끼리는 조각마다 복사 (시작점 차이만큼 평행이동)
  function hose(name, points, r, { cls, tone = "mid", bend = r * 2.6, maxLength = 10, gaps = [], caps = true, bias = 0.02, owner, stamp, info } = {}) {
    const route = G.fillet(points, Math.max(bend, r * 2.6), 10, { P, tube: r });
    R.route(name, route, r, { gaps, owner: owner ?? name, piece });
    tubePieces(route, r, P, { maxLength, spacing: Math.max(0.5, Math.min(1.6, r)), gaps, caps }).forEach((chunk, index) =>
      put(`${name}:${index}`, chunk.mid, stamped(stamp && `${stamp}-${index}`, route[0], () => wrap(cls, tubeSvg(chunk, { tone }))), [A.tube(chunk.points, chunk.radii, { name, owner: owner ?? name })], { bias, info, route: name, chunk: index }),
    );
    return route;
  }
  // 칠하는 순서 정하기 (겹치는 쌍마다 광선으로 앞뒤를 잼) → key 순으로 정렬한 SVG
  function render() {
    A.settle(R, P);
    return [...R.items].sort((a, b) => a.key - b.key).map((item) => item.svg).join("");
  }
  return { R, P, at, S, L, Dt, wrap, put, ghost, box, cyl, disc, ball, hose, render };
}

// 검사: node build.mjs --audit 일 때만 각 층의 기록을 검사해 문제를 출력 (그 외에는 바로 끝)
export function auditAll(shops, options = {}) {
  for (const [label, shop] of Object.entries(shops)) {
    if (!process.argv.includes("--audit")) return;
    console.log(`\n=== audit: ${label} ===`);
    A.auditOrExit(shop.R, shop.P, options[label] ?? {});
  }
}
