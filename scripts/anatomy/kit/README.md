# anatomy kit (복사본)

`wheresryan22/anatomy` 스킬의 아이소메트릭 그리기 도구 (MIT, LICENSE 참고).
`scripts/anatomy/rack/build.mjs` 가 첫 화면 로딩 그림(GPU 랙)을 만들 때 씁니다.
- iso-kit.mjs : 카메라·상자·원기둥·선·점·카드 (SVG 문자열)
- iso.css     : 그림의 색 토큰과 선 스타일
- gl.mjs      : 같은 카메라로 보는 WebGL 셰이더 층
- lathe.mjs   : 아무 축의 둥근 부품 (이음쇠·퀵커넥터·엘보 공), 관 경로 다듬기(fillet)
- tube.mjs    : 호스·관을 칠하는 순서대로 자른 조각으로 그리기
- audit.mjs   : 기록한 3D 모양으로 관통·끝점·지지·칠하는 순서를 검사 (빌드 때만, 페이지에 안 들어감)
