import { GEO, Instances, mat, texMat } from './kit.jsx'
import { Storefront } from './kpop.jsx'
import { getSignTexture } from './textures.js'

// Coordinates are relative to the middle of the 7.4 × 4 m display floor.
// Batch fixtures by geometry so rows of tapes or food don't add draw calls.
const ink = '#252332'
const oak = '#b78158'
const cream = '#fff0d2'
const silver = '#b9bec8'
const colors = ['#d76382', '#57acb2', '#d6a24d', '#8871b0']
const upright = [Math.PI / 2, 0, 0]
const material = mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.08 })

function furnish(wall, arrange) {
  const boxes = [], cylinders = [], labels = []
  arrange({
    box: (x,y,z,w,h,d,c,r) => boxes.push({p:[x,y,z],s:[w,h,d],c,r}),
    cyl: (x,y,z,radius,h,c,r) => cylinders.push({p:[x,y,z],s:[radius,h,radius],c,r}),
    label: (text,x,y,z,w,h,bg,fg) => labels.push({text,x,y,z,w,h,bg,fg}),
  })
  return { wall, boxes, cylinders, labels }
}

const interiors = {
  agencyLobby: furnish('#403247', ({box,cyl,label}) => {
    box(0,.58,-.45,4.8,1.16,1.12,'#886889')
    box(0,1.19,-.45,5,.09,1.24,cream)
    box(.8,1.49,-.51,.76,.44,.12,ink)
    label('SUNGRAY   ENTERTAINMENT',0,2.29,-1.88,6,.6,'#403247','#ffe8eb')
    for(const x of [-8,-6.4,-4.8]){
      box(x,1.67,-1.77,1.24,1.73,.11,oak)
      box(x,1.67,-1.69,1.10,1.59,.05,'#332b40')
      cyl(x,1.81,-1.63,.43,.055,'#e6ba65',upright)
      cyl(x,1.81,-1.59,.12,.035,ink,upright)
      box(x,1.12,-1.61,.5,.11,.035,cream)
    }
    for(const x of [4.25,7.35]){
      box(x,.39,.24,2.55,.65,.93,'#ad8f9a')
      box(x,.88,-.17,2.55,.51,.18,'#c7a9ad')
    }
  }),
  artistLounge: furnish('#ead8c4', ({box,cyl,label}) => {
    box(-3.8,.38,-.54,4.6,.66,1.1,'#86a698')
    box(-3.8,.94,-1.03,4.6,.66,.23,'#64867d')
    for(const x of [-5.1,-3.9,-2.7]) box(x,.87,-.72,.69,.39,.23,cream,[-.15,0,0])
    box(-3.8,.53,.86,2.8,.12,.85,oak)
    for(const x of [-4.85,-2.75]) box(x,.25,.86,.13,.5,.52,oak)
    for(const x of [1.3,3.3,5.3]){
      box(x,.52,-.98,1.95,1.04,1.13,'#bd9475')
      box(x,1.08,-.98,2,.09,1.18,cream)
      box(x,.83,-.39,.42,.05,.04,ink)
    }
    cyl(2.9,1.34,-.89,.25,.41,silver)
    for(const x of [4.7,5.12,5.54]) cyl(x,1.27,-.81,.13,.27,'#8eb5af')
    label('SUNGRAY   /   LOUNGE',-3.8,2.26,-1.88,3.9,.44,'#e6d6bc','#4e665c')
  }),
  soundStudio: furnish('#334854', ({box,cyl,label}) => {
    box(-2.6,.57,-.2,4.9,1.14,1.42,'#39424b')
    box(-2.6,1.20,-.2,4.95,.18,1.44,'#566473')
    for(let i=0;i<14;i++){
      const x=-4.66+i*.31
      box(x,1.30,.09,.045,.025,.52,ink)
      box(x,1.34,.05+.17*Math.sin(i),.14,.06,.11,cream)
    }
    for(const x of [-3.82,-1.40]){
      box(x,1.81,-.76,1.93,.9,.14,ink)
      for(let k=0;k<13;k++) box(x-.79+k*.13,1.8,-.67,.075,.1+.42*Math.abs(Math.sin(k*1.2)),.025,'#64cdbc')
    }
    for(const x of [1.1,2.0,2.9,3.8,4.7,5.6,6.5]) box(x,1.63,-1.8,.61,2.23,.15,'#243441')
    cyl(4.1,.08,.25,.40,.13,ink)
    cyl(4.1,1,.25,.04,1.86,silver)
    cyl(4.1,2.02,.25,.11,.35,silver)
    cyl(4.1,2,.47,.16,.04,ink,upright)
    label('ON AIR',5.75,2.69,-1.62,1.15,.31,'#461e31','#ffb2bd')
  }),
  practiceRoom: furnish('#45435e', ({box,cyl,label}) => {
    // Mirror panels, barre, sprung floor, and a stereo with two speaker cones.
    box(0,.025,0,7.34,.05,3.95,'#cbab87')
    for (const x of [-2.42,-.85,.72]) {
      box(x,1.65,-1.85,1.55,2.3,.09,silver)
      box(x,1.65,-1.78,1.46,2.19,.05,'#a8c5d5')
      cyl(x,.52,-1.35,.04,1,silver)
    }
    box(-.85,1.04,-1.35,4.82,.08,.09,oak)
    box(2.6,.77,-.35,.89,1.54,.63,ink)
    for (const y of [.46,1.03]) cyl(2.6,y,0,.25,.08,'#504862',upright)
    label('STUDIO 24',2.55,2.35,-1.86,1.65,.4,'#262341','#d3c6ff')
    for (const x of [-1.4,0,1.4]) box(x,.059,.55,.38,.012,.045,'#f3dfb6')
  }),
  videoShop: furnish('#514356', ({box,cyl,label}) => {
    for (const y of [.52,1.18,1.84]) {
      box(-1.34,y,-1.32,4.12,.09,.66,oak)
      for(let i=0;i<17;i++) {
        const x=-3.19+i*.23
        box(x,y+.27,-1.33,.195,.45,.36,colors[i%4])
        box(x,y+.32,-1.14,.12,.13,.015,cream)
      }
    }
    box(2.03,.43,.32,1.95,.86,.97,'#955b75')
    box(2.03,1.36,.32,1.43,.98,.72,'#433e4b')
    box(1.94,1.38,.69,1.04,.71,.05,'#9dc2bb')
    cyl(2.62,1.43,.70,.07,.05,silver,upright)
    label('VHS · 대여',-1.34,2.62,-1.8,2.6,.40,ink,'#ffabc6')
  }),
  snackBar: furnish('#ffe0b6', ({box,cyl,label}) => {
    box(-1.5,.51,-.05,3.7,1.02,1.05,'#bf5443')
    box(-1.5,1.06,-.05,3.84,.10,1.15,silver)
    for(const x of [-2.45,-.65]) {
      box(x,1.15,-.05,1.54,.13,.83,'#d4d7dc')
      box(x,1.224,-.05,1.39,.02,.68,x< -1?'#be4027':'#b4894c')
    }
    for(let i=0;i<8;i++) cyl(-2.97+(i%4)*.33,1.26,-.2+Math.floor(i/4)*.33,.057,.21,'#ffdcb4',upright)
    for(let i=0;i<5;i++) cyl(-1.18+i*.25,1.44,-.12,.018,.54,oak,[0,0,-.16])
    box(2.15,.85,-.12,2.1,.11,.85,oak)
    for(const x of [1.42,2.88]) {
      cyl(x,.41,-.12,.07,.82,ink)
      cyl(x,.25,.87,.08,.49,silver)
      cyl(x,.53,.87,.31,.11,'#d9583d')
    }
    label('떡볶이   ·   어묵   ·   순대',-.8,2.3,-1.85,4.45,.58,'#fff2d5','#a63124')
  }),
  coinKaraoke: furnish('#272442', ({box,cyl,label}) => {
    box(-.7,1.93,-1.82,2.88,1.42,.14,ink)
    box(-.7,1.93,-1.73,2.7,1.23,.03,'#504275')
    label('♪  SUNGRAY  ♪',-.7,1.95,-1.69,2.48,.52,'#504275','#b3fffa')
    for(const x of [-2.75,1.34]) {
      box(x,1.85,-1.64,.56,.89,.36,ink)
      cyl(x,1.82,-1.44,.2,.06,'#698798',upright)
    }
    for(const x of [-3.35,3.35]) box(x,1.65,-1.84,.075,2.48,.09,'#72e7ee')
    box(.55,.38,.57,3.20,.6,.8,'#924480')
    box(.55,.86,.18,3.20,.52,.19,'#b85ba0')
    box(-2.32,.65,.42,.88,1.30,.65,'#413653')
    box(-2.32,1.34,.42,.80,.10,.64,'#8892b3')
    for(const x of [-2.55,-2.16]) {
      cyl(x,1.52,.49,.045,.33,ink,[0,0,-.25])
      cyl(x+.045,1.69,.49,.085,.12,silver,[0,0,-.25])
    }
  }),
  recordShop: furnish('#694a41', ({box,cyl,label}) => {
    for(const [i,x] of [-2.45,-.95,.55,2.05].entries()) {
      box(x,1.94,-1.82,1.04,1.04,.08,colors[i])
      cyl(x+.11,1.94,-1.74,.40,.06,ink,upright)
      cyl(x+.11,1.94,-1.70,.105,.025,cream,upright)
    }
    for(const x of [-2.32,-.69]){
      box(x,.43,.38,1.36,.86,1.23,oak)
      for(let i=0;i<5;i++) box(x,.96+i*.045,.80-i*.2,.99,.72,.07,colors[(i+1)%4],[-.15,0,0])
    }
    box(2,.53,.15,1.75,1.06,1.02,'#925f43')
    box(2,1.11,.15,1.52,.13,.9,silver)
    cyl(1.82,1.20,.17,.35,.04,ink)
    cyl(1.82,1.23,.17,.10,.02,'#e4a640')
    box(2.45,1.24,.16,.055,.05,.52,ink,[0,.4,0])
    label('LP  /  33⅓ RPM',0,2.76,-1.84,2.58,.34,'#45312e','#ffe1a5')
  }),
  photoStudio: furnish('#cbdce0', ({box,cyl,label}) => {
    box(-1.02,1.46,-1.72,3.85,2.85,.08,'#99bed4')
    box(-1.02,.025,-.48,3.85,.05,2.56,'#99bed4')
    cyl(-1.02,2.93,-1.69,.09,4.04,cream,[0,0,Math.PI/2])
    cyl(-1,.45,-.78,.065,.90,silver)
    cyl(-1,.94,-.78,.40,.11,cream)
    for (const x of [-3.03,1.29]) {
      cyl(x,.98,-.48,.035,1.96,ink)
      cyl(x,.075,-.48,.29,.10,ink)
      box(x,2.03,-.48,.64,.81,.24,ink)
      box(x,2.03,-.34,.59,.76,.035,'#fff6dd')
    }
    // Camera points across the room towards the portrait stool.
    for(let i=0;i<3;i++){
      const angle=i*2*Math.PI/3
      cyl(2.14+.20*Math.sin(angle),.54,.81+.20*Math.cos(angle),.037,1.15,ink,[-.36,angle,0,'YXZ'])
    }
    box(2.14,1.22,.81,.55,.4,.35,ink,[0,1.08,0])
    cyl(1.87,1.23,.67,.15,.32,'#485463',[Math.PI/2,1.08,0,'YXZ'])
    label('증명 · 프로필',2.53,2.3,-1.83,1.79,.39,'#f4f0dd','#36506c')
  }),
}

export function FilmingAlleyShop({ item }) {
  const { wall, boxes, cylinders, labels } = interiors[item.style]
  return (
    <Storefront item={item} awning={item.signs[0].awning} wallColor={wall}>
      <Instances geometry={GEO.box} material={material} items={boxes} />
      <Instances geometry={GEO.cyl} material={material} items={cylinders} />
      {labels.map(({text,x,y,z,w,h,bg,fg}) => (
        <mesh key={text} geometry={GEO.plane} position={[x,y,z]} scale={[w,h,1]}
          material={texMat(getSignTexture(text,bg,fg,w/h), { emissive: '#ffffff', emissiveIntensity: .38 })} />
      ))}
    </Storefront>
  )
}
