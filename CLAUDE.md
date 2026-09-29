# 작업 규칙

- **모든 개발은 `main` 브랜치에서 한다.** 기능 브랜치나 PR을 만들지 않고, 변경을 커밋하면 곧바로 `main`에 푸시한다.
- `main`에 푸시되면 `.github/workflows/pages.yml`이 테스트 후 GitHub Pages로 자동 배포한다.
- 푸시 전에 `npm test`를 돌려 통과를 확인한다. (실패하면 배포도 막힌다.)
- 밸런스 수치를 건드렸다면 `npm run sim`으로 원목 도달 시간이 망가지지 않았는지 확인한다. (docs/DESIGN.md 참고)

# 프로젝트 개요

빌드 없는 순수 HTML/JS/Canvas 인크리멘탈 게임. 구조와 실행 방법은 README.md, 밸런스 설계는 docs/DESIGN.md 참고.
- `js/data.js` 수치, `js/game.js` 로직(DOM 무관), `js/render.js` 캔버스, `js/ui.js` 패널, `js/main.js` 입력·루프
