// drei <Html> 이름표들이 붙을 고정된 HTML 컨테이너 (Scene.jsx의 바깥 div).
// portal을 지정하지 않으면 캔버스 이벤트가 연결될 때 이름표가 다시 만들어지면서
// 콘솔에 "synchronously unmount a root" 에러가 납니다.
export const labelLayer = { current: null }
