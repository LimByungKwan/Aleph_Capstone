// (담당: 병관) 소란 커피 앞 주문 카운터와 음료·디저트 선택 화면
import { useMemo, useState } from 'react'
import { sfx } from '../../../components/sound/sound.js'
import { Box, Cyl, GEO, texMat } from './kit.jsx'
import { getSignTexture } from './textures.js'
import { CAFE_DRINKS, CafeDrinkGame, CafeFinishedCup, CafePairCups } from './bk_cafeDrinks.jsx'
import { useEpisodeRoom } from './bk_episodeRoom.js'

const DESSERTS = ['치즈케이크', '초코 쿠키', '휘낭시에']

export function CafeOrderCounter() {
  const sign = useMemo(() => texMat(getSignTexture('☕ 소란 커피 · 주문', '#583a2d', '#fff2de', 5)), [])

  return (
    <group position={[-3, 0.14, 3.45]}>
      <Box p={[0, 0.53, 0]} s={[1.8, 1.06, 0.58]} c="#885b46" castShadow />
      <Box p={[0, 1.07, 0]} s={[1.9, 0.08, 0.68]} c="#f7dfbe" castShadow />
      <mesh geometry={GEO.plane} material={sign} position={[0, 0.73, 0.295]} scale={[1.56, 0.312, 1]} />
      <Cyl p={[-0.51, 1.19, 0]} rad={0.09} h={0.16} c="#fff0d6" />
      <Cyl p={[-0.28, 1.19, 0]} rad={0.09} h={0.16} c="#eeb2a8" />
      <Box p={[0.47, 1.13, 0]} s={[0.38, 0.045, 0.3]} c="#c06f55" />
    </group>
  )
}

function MenuChoices({ label, name, options, value, onChange }) {
  return (
    <fieldset className="date-cafe-menu">
      <legend>{label}</legend>
      <div className="special-actions">
        {options.map((option) => (
          <label key={option}>
            <input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function CafeOrderMenu({ onOrder, onViewMission, onClose, stamped }) {
  const [drink, setDrink] = useState('')
  const [dessert, setDessert] = useState('')
  const [order, setOrder] = useState(null)
  const [making, setMaking] = useState(false)
  const sharedCups = useEpisodeRoom((s) => s.room?.cups)

  if (order) {
    const mySharedCup = sharedCups?.[0]
    const showSharedTable = mySharedCup?.drink === order.drink && mySharedCup?.topping === order.topping
    return (
      <>
        <div className="special-dialog__body">
          <section className="special-narration" role="status">
            <h3>주문표</h3>
            <p>{order.drink} + {order.dessert}</p>
            {showSharedTable ? <CafePairCups cups={sharedCups} /> : <CafeFinishedCup order={order} />}
            <p className="special-visit">{stamped ? '데이트 스탬프를 이미 받았어요.' : '직접 만든 한 잔이에요. 데이트 스탬프를 받을 수 있어요.'}</p>
          </section>
        </div>
        <footer className="special-dialog__foot">
          <div className="special-actions">
            <button type="button" className="ui-btn" onClick={onClose}>닫기</button>
            <button type="button" className="ui-btn" onClick={() => { setOrder(null); setMaking(false) }}>다른 음료 만들기</button>
          </div>
          {!stamped && <button type="button" className="ui-btn ui-btn--primary" onClick={onViewMission}>스탬프 받으러 가기</button>}
        </footer>
      </>
    )
  }

  if (making) return (
    <CafeDrinkGame drink={drink} dessert={dessert} onBack={() => setMaking(false)} onFinish={(next) => {
      onOrder(next)
      setOrder(next)
      sfx.arrive()
    }} />
  )

  return (
    <form onSubmit={(event) => {
      event.preventDefault()
      if (drink && dessert) setMaking(true)
    }}>
      <div className="special-dialog__body">
        <p className="special-intro">함께 오고 싶은 사람이 좋아할 음료와 디저트를 하나씩 골라 주세요.</p>
        <MenuChoices label="음료" name="bk-cafe-drink" options={CAFE_DRINKS} value={drink} onChange={setDrink} />
        <MenuChoices label="디저트" name="bk-cafe-dessert" options={DESSERTS} value={dessert} onChange={setDessert} />
      </div>
      <footer className="special-dialog__foot">
        <button type="button" className="ui-btn" onClick={onClose}>취소</button>
        <button type="submit" className="ui-btn ui-btn--primary" disabled={!drink || !dessert}>음료 만들기</button>
      </footer>
    </form>
  )
}
