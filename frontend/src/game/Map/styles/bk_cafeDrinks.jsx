// (담당: 병관) 소란 커피의 음료 만들기, 토핑 선택, 완성 컵 그림
import { useEffect, useRef, useState } from 'react'

const RECIPES = {
  '바닐라 라테': {
    style: 'latte',
    title: '거품 위에 하트 그리기',
    tip: '잔 가운데에서 시작해 거품 위에 하트를 그려 보세요.',
    color: '#fff0d5',
    points: [[50, 35], [28, 25], [23, 44], [50, 72], [77, 44], [72, 25], [50, 35]],
    toppings: [{ id: 'cinnamon', label: '시나몬 가루', icon: '✦' }, { id: 'sugar', label: '하트 설탕', icon: '♥' }],
  },
  '딸기 우유': {
    style: 'berry',
    title: '딸기 우유 소용돌이',
    tip: '바깥쪽부터 안쪽으로 한 바퀴 저어 딸기 우유를 섞어 보세요.',
    color: '#fff2f7',
    points: [[25, 60], [24, 32], [51, 22], [75, 42], [67, 65], [43, 65], [43, 45], [58, 47]],
    toppings: [{ id: 'strawberry', label: '딸기 한 조각', icon: '🍓' }, { id: 'cream', label: '휘핑크림', icon: '☁' }],
  },
  '유자 에이드': {
    style: 'citrus',
    title: '유자 에이드에 반짝임 더하기',
    tip: '잔 위의 점을 이어 반짝이는 별을 만들어 보세요.',
    color: '#fffbe3',
    points: [[50, 17], [67, 43], [82, 50], [67, 57], [50, 80], [33, 57], [18, 50], [33, 43], [50, 17]],
    toppings: [{ id: 'yuja', label: '유자 슬라이스', icon: '🍋' }, { id: 'mint', label: '민트 잎', icon: '🌿' }],
  },
}

export const CAFE_DRINKS = Object.keys(RECIPES)

function drawPath(ctx, points, smooth) {
  if (!points.length) return
  ctx.beginPath()
  ctx.moveTo(...points[0])
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i]
    const [nextX, nextY] = points[i + 1]
    if (smooth) ctx.quadraticCurveTo(x, y, (x + nextX) / 2, (y + nextY) / 2)
    else ctx.lineTo(x, y)
  }
  ctx.lineTo(...points.at(-1))
  ctx.stroke()
}

function CupArt({ recipe, count, showGuide = false }) {
  const canvas = useRef(null)
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    ctx.setTransform(2.56, 0, 0, 2.56, 0, 0)
    ctx.clearRect(0, 0, 100, 100)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const smooth = recipe.style !== 'citrus'
    if (showGuide) {
      ctx.strokeStyle = '#fff8edb0'
      ctx.lineWidth = 1.2
      ctx.setLineDash([2, 2.5])
      drawPath(ctx, recipe.points, smooth)
    }
    ctx.setLineDash([])
    ctx.lineWidth = 3.4
    ctx.strokeStyle = recipe.color
    drawPath(ctx, recipe.points.slice(0, count), smooth)
  }, [recipe, count, showGuide])
  return <canvas className="date-cup-art" ref={canvas} width="256" height="256" aria-hidden="true" />
}

function CupSurface({ recipe, children, topping, compact = false }) {
  return (
    <div className={`date-cup${compact ? ' date-cup--compact' : ''}`} data-drink={recipe.style}>
      <div className="date-cup-surface">
        {children}
        {topping && <span className="date-cup-topping" aria-hidden="true">{topping.icon}</span>}
      </div>
    </div>
  )
}

export function CafeFinishedCup({ order }) {
  const recipe = Object.hasOwn(RECIPES, order?.drink) ? RECIPES[order.drink] : null
  const topping = recipe?.toppings.find(({ id }) => id === order.topping)
  if (!topping) return null
  return (
    <figure className="date-finished-cup">
      <CupSurface recipe={recipe} topping={topping} compact>
        <CupArt recipe={recipe} count={recipe.points.length} />
      </CupSurface>
      <figcaption>{order.drink} · {topping.label}</figcaption>
    </figure>
  )
}

export function CafePairCups({ cups }) {
  if (!Array.isArray(cups) || cups.length !== 2) return null
  return (
    <section className="date-cafe-pair" aria-label="둘이 만든 한 잔">
      <h3>둘이 만든 한 잔</h3>
      <div className="date-cafe-pair__cups">
        <div><strong>내 음료</strong><CafeFinishedCup order={cups[0]} /></div>
        <div><strong>친구의 음료</strong><CafeFinishedCup order={cups[1]} /></div>
      </div>
    </section>
  )
}

// 빠르게 긋는 손가락·마우스도 지나간 선 위의 다음 지점을 감지해요.
function touchesPoint(target, from, to) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = dx * dx + dy * dy
  const t = length ? Math.max(0, Math.min(1, ((target[0] - from.x) * dx + (target[1] - from.y) * dy) / length)) : 0
  return Math.hypot(from.x + dx * t - target[0], from.y + dy * t - target[1]) <= 8
}

export function CafeDrinkGame({ drink, dessert, onBack, onFinish }) {
  const recipe = RECIPES[drink]
  const [count, setCount] = useState(0)
  const [topping, setTopping] = useState('')
  const progress = useRef(0)
  const drag = useRef(null)
  const title = useRef(null)
  const firstTopping = useRef(null)
  const finished = count === recipe.points.length

  useEffect(() => { title.current?.focus() }, [])
  useEffect(() => {
    if (finished) firstTopping.current?.focus()
  }, [finished])

  const advance = (index) => {
    if (progress.current !== index || index >= recipe.points.length) return
    progress.current += 1
    setCount(progress.current)
  }
  const brush = (event, from) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const to = { x: (event.clientX - rect.left) * 100 / rect.width, y: (event.clientY - rect.top) * 100 / rect.height }
    const index = progress.current
    if (index < recipe.points.length && touchesPoint(recipe.points[index], from ?? to, to)) advance(index)
    return to
  }
  const start = (event) => {
    if (finished || event.button !== 0 || drag.current) return
    // 다음 번호를 탭해도 되고, 누른 채로 점을 이어도 돼요.
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id: event.pointerId, point: brush(event) }
  }
  const move = (event) => {
    if (drag.current?.id !== event.pointerId) return
    drag.current.point = brush(event, drag.current.point)
  }
  const stop = (event) => {
    if (drag.current?.id === event.pointerId) drag.current = null
  }
  const selected = recipe.toppings.find(({ id }) => id === topping)

  return (
    <>
      <div className="special-dialog__body date-cafe-game">
        <header className="date-cafe-game__heading">
          <h3 ref={title} tabIndex={-1}>{recipe.title}</h3>
          <p>{finished ? '마지막으로 토핑을 하나 올려 보세요.' : recipe.tip}</p>
        </header>
        <CupSurface recipe={recipe} topping={selected}>
          <CupArt recipe={recipe} count={count} showGuide={!finished} />
          {!finished && (
            <div className="date-cup-points" onPointerDown={start} onPointerMove={move}
              onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>
              {recipe.points.map(([x, y], index) => {
                if (index < count) return null
                // 닫힌 하트·별의 마지막 점은 시작점과 같으므로 마지막 차례에만 보여요.
                if (index === recipe.points.length - 1 && x === recipe.points[0][0] && y === recipe.points[0][1] && index !== count) return null
                return <span key={index} className="date-cup-point" data-next={index === count} style={{ left: `${x}%`, top: `${y}%` }} aria-hidden="true">{index + 1}</span>
              })}
            </div>
          )}
        </CupSurface>
        {finished ? (
          <fieldset className="date-cafe-menu">
            <legend>토핑</legend>
            <div className="special-actions">
              {recipe.toppings.map(({ id, label, icon }, index) => (
                <label key={id}>
                  <input ref={index === 0 ? firstTopping : undefined} type="radio" name="bk-cafe-topping" checked={topping === id} onChange={() => setTopping(id)} />
                  <span aria-hidden="true">{icon}</span> {label}
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <div className="date-cafe-game__progress">
            <progress max={recipe.points.length} value={count} aria-label="음료 만들기 진행률" />
            <span role="status">{count} / {recipe.points.length}</span>
            <button className="ui-btn" type="button" onClick={() => advance(progress.current)}>다음 점 잇기</button>
          </div>
        )}
      </div>
      <footer className="special-dialog__foot">
        <button type="button" className="ui-btn" onClick={onBack}>메뉴로 돌아가기</button>
        <button type="button" className="ui-btn ui-btn--primary" disabled={!finished || !selected}
          onClick={() => onFinish({ drink, dessert, topping })}>완성한 잔 내기</button>
      </footer>
    </>
  )
}
