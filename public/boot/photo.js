// =============================================================
// photo.js — 첫 화면 랙·GPU 그림의 "사진 모드" (그림 | 사진 전환에서 사진을 고를 때만 받음)
// -------------------------------------------------------------
// Blender 로 찍은 28초 둘러보기 영상(scripts/blender/boot-photos.py → boot-video.mjs)을 그림 칸 위에 덮고,
// 그림(SVG)은 그 아래에 투명하게 남겨 둡니다 → 말풍선 자리·부품 찾기·수치 줄은 그림 코드가 그대로 맡음
//   (사진 층은 포인터를 통과시키므로, 가리킨 곳의 부품은 여전히 그림에서 찾음 — 사진과 그림은 같은 투영이라 픽셀 단위로 겹침)
//   · 시계: 영상이 둘러보기 시계를 이끎 (__rackView.pace) → 영상이 버벅여도 말풍선이 사진과 어긋나지 않음
//   · 직접 확대: 영상은 멈추고, 고해상도 정지 사진을 그림과 같은 보이는 범위(Z.rect)로 CSS 확대
//       랙 = 트레이를 다 꺼낸 사진, GPU = 냉각판·뚜껑을 걷어 낸 기판 사진 (그림도 확대하면 그렇게 보여 줌)
//   · 움직임 줄이기 설정: 영상 없이 다 연 모습의 정지 사진
//   · 영상을 못 틀면(자동 재생 막힘·코덱 없음·네트워크 오류) 그림으로 돌아감
// 자원 (이 파일과 같은 폴더): rack|gpu .av1.mp4 · .h264.mp4 (가로 1280), rack-960|gpu-960 … (휴대폰용 가로 960),
//   rack-open.avif, gpu-open.avif, gpu-board.avif
// 그림 코드(scripts/anatomy/rack/build.mjs 의 LIVE)가 window.__rackView 로 고리를 내 줌
// =============================================================
(() => {
  const api = window.__rackView;
  if (!api || window.__rackPhoto) return;
  const here = (document.currentScript && document.currentScript.src) || location.origin + "/boot/photo.js";
  const url = (name) => new URL(name, here).href;   // 이 파일 옆의 자원 주소
  const TOUR = api.TOUR;                             // 둘러보기 한 바퀴 (초) = 영상 길이
  const FADE = 400;                                  // 그림 ↔ 사진이 바뀌는 시간 (ms, 아래 CSS 와 같게)

  // ---------- 스타일 (사진 모드를 처음 켤 때 한 번만 넣음 → 첫 화면 HTML 은 가볍게) ----------
  //   사진 층(.rk-photo)은 그림 위·짚는 원과 말풍선 아래. 다 덮은 뒤엔 그림을 투명하게(그리는 비용도 줄음)
  const CSS = `
.rk-photo{position:absolute;inset:0;pointer-events:none;overflow:hidden;opacity:0;transition:opacity ${FADE}ms ease}
.rk-photo[data-show]{opacity:1}
.rk-stage[data-photo]>svg,.rk-stage[data-photo]>canvas{opacity:0!important}
.rk-photo>video,.rk-photo>img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:fill;transform-origin:0 0}
.rk-photo>.rk-near{opacity:0;transition:opacity .25s ease}
.rk-photo>.rk-near[data-on]{opacity:1}
.rk-badge{position:absolute;left:8px;top:8px;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.9);box-shadow:0 0 0 1px rgba(22,33,58,.1);color:#3c4760;font:600 10.5px/1.3 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;white-space:nowrap}
@media (max-width:767px){.rk-badge{left:4px;top:4px;padding:2px 6px;font-size:9.5px}}
.rk-view button[data-wait] .rk-icon{animation:rk-wait 1s ease-in-out infinite}
@keyframes rk-wait{50%{opacity:.3}}
`;

  // ---------- 두 칸 (0 = 랙, 1 = GPU) ----------
  const NEAR = { rack: "rack-open.avif", gpu: "gpu-board.avif" };   // 직접 확대용 고해상도 사진
  const OPEN = { rack: "rack-open.avif", gpu: "gpu-open.avif" };    // 움직임 줄이기용 정지 사진 (다 연 모습)
  const P = ["rack", "gpu"].map((fig, i) => ({
    fig,
    st: api.stages[i],          // 그림 칸 (.rk-stage)
    Z: api.zoom[i],             // 그림의 확대 상태 (on = 직접 확대, rect() = 지금 보이는 범위)
    W: api.size[i][0],          // 그림 크기 (px) — 확대 범위를 비율로 바꿀 때
    H: api.size[i][1],
    box: null,                  // 사진 층 div.rk-photo
    base: null,                 // 둘러보기 영상 (움직임 줄이기면 정지 사진)
    near: null,                 // 직접 확대용 고해상도 사진
    nearOk: false,              // 확대 사진을 다 받았나
  }));
  const photoBtn = document.querySelector('.rk-view [data-view="photo"]');

  let want = false;      // 사진 모드를 고른 상태인가 (단추)
  let full = false;      // 사진이 다 덮어 그림을 감췄나 (켜고 FADE 뒤)
  let quietNow = false;  // 그림의 열 잉크(WebGL)를 껐나
  let turn = 0;          // 켜기·끄기 순번 — 기다리는 사이 상태가 바뀌었으면 하던 일을 그만둠
  let built = false;     // 사진 층을 만들었나
  let styled = false;    // 스타일을 넣었나

  // 어느 영상을 먼저 쓸까: AV1 은 같은 화질에 가장 가볍지만, 하드웨어로 못 푸는 기기(오래된 휴대폰·Intel Mac 등)에선
  // 영상 두 개를 소프트웨어로 푸느라 전지·CPU 를 많이 씀 → 그럴 땐 어디서나 하드웨어로 푸는 H.264 를 먼저
  let codec = null;   // "av1" | "h264"
  async function pickCodec() {
    try {
      const info = await navigator.mediaCapabilities.decodingInfo({
        type: "file",
        video: { contentType: 'video/mp4; codecs="av01.0.08M.08"', width: 1280, height: 1120, bitrate: 800000, framerate: 24 },
      });
      return info.supported && info.powerEfficient ? "av1" : "h264";
    } catch (e) {
      return "av1";   // 물어볼 수 없으면 브라우저가 고르게 (AV1 → H.264 차례)
    }
  }

  // 둘러보기 영상 하나: 고른 코덱 먼저, 못 틀면 다른 쪽. 소리 없음·반복·화면 안에서 재생 (자동 재생 조건)
  //   칸이 화면에서 실제 1000 화소 이하(휴대폰·저해상도 화면)면 가로 960 판 — 받는 양이 약 절반, 그 크기에선 차이가 안 보임
  function movie(p) {
    const small = p.st.clientWidth * (window.devicePixelRatio || 1) <= 1000;
    const fig = small ? p.fig + "-960" : p.fig;
    const v = document.createElement("video");
    v.muted = v.defaultMuted = true;
    v.loop = v.playsInline = true;
    v.preload = "auto";
    v.setAttribute("muted", "");          // 오래된 Safari 는 속성으로도 있어야 자동 재생
    v.setAttribute("playsinline", "");
    v.disablePictureInPicture = true;
    const kinds = [[`${fig}.av1.mp4`, 'video/mp4; codecs="av01.0.08M.08"'], [`${fig}.h264.mp4`, 'video/mp4; codecs="avc1.640028"']];
    if (codec === "h264") kinds.reverse();
    for (const [file, type] of kinds) {
      const s = document.createElement("source");
      s.src = url(file);
      s.type = type;
      v.append(s);
    }
    return v;
  }

  // 재생 시작을 기다림: 재생되면 성공. 소스를 모두 못 쓰거나(파일 없음·코덱 없음) 20초 넘게 걸리면 실패
  //   (<source> 를 쓰면 마지막 소스가 실패해도 play() 가 끝나지 않고 기다리기만 해서 따로 살핌)
  function playing(v) {
    return new Promise((ok, no) => {
      const bad = () => no(new Error("영상을 틀 수 없음"));
      const last = v.querySelector("source:last-of-type");
      if (last) last.addEventListener("error", bad, { once: true });
      v.addEventListener("error", bad, { once: true });
      setTimeout(bad, 20000);
      v.play().then(ok, no);
    });
  }

  function picture(cls) {
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    if (cls) img.className = cls;
    return img;
  }

  // 처음 켤 때 한 번: 칸마다 사진 층 (영상/정지 사진 + 확대 사진 + "3D 렌더" 표시)
  function build() {
    if (built) return;
    built = true;
    const calm = api.still.matches;
    for (const p of P) {
      p.box = document.createElement("div");
      p.box.className = "rk-photo";
      p.box.setAttribute("aria-hidden", "true");
      if (calm) {
        p.base = picture();
        p.base.src = url(OPEN[p.fig]);
      } else {
        p.base = movie(p);
      }
      p.near = picture("rk-near");
      p.near.addEventListener("load", () => { p.nearOk = true; });
      const badge = document.createElement("span");
      badge.className = "rk-badge";
      badge.textContent = "3D 렌더 · 실물 사진 아님";
      p.box.append(p.base, p.near, badge);
      p.st.insertBefore(p.box, p.st.querySelector(".rk-aim"));   // 그림 층들 위, 짚는 원·말풍선 아래
    }
  }

  // 사진 모드 켜기: 영상을 지금 둘러보기 시각에서 틀고, 둘 다 재생되면 그림 위로 서서히 덮음
  async function start() {
    const my = ++turn;
    if (!styled) {
      styled = true;
      const style = document.createElement("style");
      style.textContent = CSS;
      document.head.append(style);
    }
    if (photoBtn) photoBtn.setAttribute("data-wait", "");   // 받는 동안 사진 단추 아이콘이 깜빡임
    if (!codec) codec = await pickCodec();
    if (my !== turn || !want) return;
    build();
    try {
      if (api.still.matches) {
        await Promise.all(P.map((p) => p.base.decode()));
      } else {
        const t = api.phase();
        for (const p of P) p.base.currentTime = t;
        await Promise.all(P.map((p) => playing(p.base)));
      }
    } catch (e) {
      if (my === turn) fail();
      return;
    } finally {
      if (photoBtn && my === turn) photoBtn.removeAttribute("data-wait");
    }
    if (my !== turn || !want) return;
    // 확대 사진은 영상이 돈 뒤에 천천히 받아 둠 (직접 확대를 누르면 바로 보이게)
    for (const p of P) {
      if (!p.near.getAttribute("src")) {
        p.near.fetchPriority = "low";
        p.near.src = url(NEAR[p.fig]);
      }
    }
    if (!api.still.matches) {
      api.seek(P[0].base.currentTime);   // 그림의 시계·따라가는 값들을 영상과 같은 순간·같은 상태로
      prev = null;
      api.pace(pace);
    }
    api.hook(frame);
    setTimeout(() => { if (my === turn && want) full = true; }, FADE);
  }

  // 사진 모드 끄기: 그림을 먼저 되살린 뒤(사진 아래에서) 사진을 걷어 냄
  function stop() {
    const my = ++turn;
    full = false;
    if (photoBtn) photoBtn.removeAttribute("data-wait");
    if (!built) return;
    api.pace(null);
    if (quietNow) { quietNow = false; api.quiet(false); }
    for (const p of P) {
      p.st.removeAttribute("data-photo");
      p.box.removeAttribute("data-show");
      p.near.removeAttribute("data-on");
    }
    setTimeout(() => {
      if (my !== turn) return;
      api.hook(null);
      for (const p of P) if (p.base.pause) p.base.pause();
    }, FADE);
  }

  // 영상을 못 틀면: 그림으로 돌아가고 단추도 그림으로 (고른 것은 저장하지 않음 — 다음엔 다시 시도)
  //   실패한 영상 요소는 버림 → 다시 고르면 새로 만들어 처음부터 받음
  function fail() {
    want = false;
    stop();
    if (photoBtn) photoBtn.removeAttribute("data-wait");
    for (const b of document.querySelectorAll(".rk-view button")) b.setAttribute("aria-pressed", String(b.dataset.view === "draw"));
    turn++;
    api.hook(null);
    for (const p of P) {
      if (p.base && p.base.pause) p.base.pause();
      if (p.box) p.box.remove();
      p.box = p.base = p.near = null;
      p.nearOk = false;
    }
    built = false;
  }

  // 그림 코드가 프레임마다 물음: 이번 프레임에 흐른 영상 시간 (랙 영상이 기준)
  let prev = null;   // 앞 프레임의 영상 시각
  function pace() {
    const t = P[0].base.currentTime;
    if (prev === null) { prev = t; return 0; }
    let d = t - prev;
    prev = t;
    if (d < -TOUR / 2) d += TOUR;                        // 반복: 끝에서 처음으로
    if (d < 0 || d > 0.5) { api.seek(t); return 0; }     // 크게 건너뜀(탭을 가렸다 돌아옴 등) → 영상 순간으로 다시 맞춤
    return d;
  }

  // 그림을 그린 뒤 프레임마다: 확대 사진 자리, 사진·그림 보이기, 영상 멈춤·재생, 두 영상 맞추기
  function frame() {
    if (!want) return;
    let waiting = false;
    for (const p of P) {
      if (p.Z.on) {
        // 그림의 viewBox 와 같은 식: 보이는 범위 r = [왼쪽, 위, 폭, 높이] → 배율 W/폭, 왼쪽 위로 밀기
        const r = p.Z.rect();
        p.near.style.transform = `scale(${(p.W / r[2]).toFixed(4)}) translate(${(-r[0] / p.W * 100).toFixed(3)}%,${(-r[1] / p.H * 100).toFixed(3)}%)`;
      }
      p.near.toggleAttribute("data-on", p.Z.on && p.nearOk);
      const wait = p.Z.on && !p.nearOk;   // 확대 사진을 아직 다 못 받았으면 그동안은 그림으로
      waiting = waiting || wait;
      p.box.toggleAttribute("data-show", !wait);
      p.st.toggleAttribute("data-photo", full && !wait);
    }
    const q = full && !waiting;
    if (q !== quietNow) { quietNow = q; api.quiet(q); }
    if (api.still.matches) return;
    const a = P[0].base, b = P[1].base;
    // 직접 확대 중엔 영상을 멈춤 (그림의 둘러보기 시계도 그동안 멈춤) → 끝나면 멈춘 곳부터 이어서
    if (P[0].Z.on || P[1].Z.on) {
      if (!a.paused) { a.pause(); b.pause(); }
      return;
    }
    if (a.paused) {
      // 재생 요청이 곧바로 멈춤(직접 확대 등)에 끊기면 AbortError — 고장이 아니므로 무시 (다음 프레임에 다시 판단)
      const bad = (e) => { if (!e || e.name !== "AbortError") fail(); };
      a.play().catch(bad);
      b.play().catch(bad);
      api.seek(a.currentTime);   // 확대하는 동안 움직인 따라가는 값들을 영상 상태로 되돌림
      prev = null;
      return;
    }
    // GPU 영상을 랙 영상 시각에 맞춤: 어긋나면 재생 속도를 살짝(±5%) 바꿔 따라잡게 (멈칫하며 건너뛰지 않음)
    //   2초 넘게 어긋났을 때만(오래 버벅임 등) 바로 건너뜀 — 키프레임이 드물어 건너뛰기는 비쌈
    let d = b.currentTime - a.currentTime;
    if (d > TOUR / 2) d -= TOUR;
    else if (d < -TOUR / 2) d += TOUR;
    if (Math.abs(d) > 2) {
      b.currentTime = a.currentTime;
      d = 0;
    }
    const rate = Math.abs(d) < 0.03 ? 1 : d > 0 ? 0.95 : 1.05;
    if (b.playbackRate !== rate) b.playbackRate = rate;
  }

  // 부팅 화면이 끝나면 영상도 멈춤
  const stopBoot = window.__rackStop;
  window.__rackStop = () => {
    if (stopBoot) stopBoot();
    for (const p of P) if (p.base && p.base.pause) p.base.pause();
  };

  // 단추(그림 코드의 view)가 부름. 처음 받았을 땐 지금 단추 상태대로
  window.__rackPhoto = (on) => {
    if (on === want) return;
    want = on;
    if (on) start();
    else stop();
  };
  window.__rackPhoto(!!photoBtn && photoBtn.getAttribute("aria-pressed") === "true");
})();
