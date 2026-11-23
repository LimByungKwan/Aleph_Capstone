import { SPECIAL_IDS } from './specialLocations.js'

function TiledRoof({ x, y, width, color }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${width / 220} 1)`}>
      <path d="M0 1Q14 7 38-19L50-26Q110-22 170-26L182-19Q206 7 220 1Q204 17 110 13Q16 17 0 1Z" fill="#253c3d" />
      <path d="M3 1Q20 5 50-26Q110-22 170-26Q201 5 217 1L203 7Q110 14 17 7Z" fill={color} />
      {Array.from({ length: 19 }, (_, i) => {
        const x = 50 + i * 6.65
        return <path key={i} d={`M${x} -24Q${x} -10 ${110 + (x - 110) * 1.57} 9`} fill="none" stroke="#293e40" strokeWidth="1" opacity=".8" />
      })}
      <path d="M50-26Q110-22 170-26M8 3Q110 25 212 3" fill="none" stroke="#afae92" strokeWidth="2.4" />
      <path d="M4 5Q110 26 216 5" fill="none" stroke="#b88a56" strokeWidth="1" />
      <path d="M47-25l-2-5m128 5 2-5" stroke="#344849" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  )
}

function PalaceGate({ offset = 0, restored }) {
  const pillars = [206, 246, 286, 326, 366, 406]
  return (
    <g transform={`translate(${offset} 0)`}>
      <path d="M164 147v-44h272v44z" fill="#ac9c86" stroke="#76675a" />
      <path d="M164 113h272m-272 9h272m-272 9h272m-272 9h272" stroke="#d1c1a7" strokeWidth="1.2" />
      <path d="M164 104h272" stroke="#e2d1ae" strokeWidth="4" />
      {[242, 300, 358].map((position) => (
        <path key={position} d={`M${position - 15} 147v-17a15 15 0 0 1 30 0v17Z`} fill="#453e37" stroke="#ddccb2" strokeWidth="2.4" />
      ))}
      <path d="M198 102V77h204v25zM229 78V57h142v21z" fill={restored ? '#a7523b' : '#785c4e'} />
      <path d="M195 81h210m-177-19h144" stroke={restored ? '#497365' : '#5e6256'} strokeWidth="7" />
      <path d="M195 86h210m-177-20h144" stroke="#cfa370" strokeWidth="1.5" />
      {pillars.map(position => <path key={position} d={`M${position - 6} 90v11`} stroke="#5e372d" strokeWidth="4" />)}
      <path d="M272 87h56v10h-56z" fill="#3a4541" stroke="#c6a873" strokeWidth="1.4" />
      <TiledRoof x={178} y={76} width={244} color={restored ? '#5a7776' : '#666e67'} />
      <TiledRoof x={216} y={56} width={168} color={restored ? '#5a7776' : '#666e67'} />
    </g>
  )
}

function InnerGate() {
  return (
    <g>
      <path d="M171 145h258l16 8H155z" fill="#cbbca0" stroke="#998b73" />
      <path d="M177 143V93h246v50z" fill="#a55b45" />
      {[209, 300, 391].map(x => (
        <path key={x} d={`M${x - 18} 143V108h36v35Z`} fill="#3d574f" stroke="#ce9a75" strokeWidth="3" />
      ))}
      <path d="M170 94h262m-262 7h262" stroke="#477364" strokeWidth="5" />
      <path d="M202 93V64h196v29z" fill="#9f644b" />
      <path d="M207 81h186m-178-9h170" stroke="#3d594f" strokeWidth="4" />
      <TiledRoof x={157} y={93} width={286} color="#577878" />
      <TiledRoof x={183} y={63} width={234} color="#577878" />
    </g>
  )
}

function GateCourtyard({ restored, inner }) {
  return (
    <>
      <path d="M0 148h600v76H0z" fill={restored ? '#c7bc9c' : '#a6947b'} />
      <path d="M0 133h178v15H0zM421 133h179v15H421z" fill="#ad9273" />
      <path d="M0 131h178m243 0h179" stroke="#555d54" strokeWidth="5" />
      {inner ? <InnerGate /> : <PalaceGate offset={restored ? 0 : 33} restored={restored} />}
      {restored ? (
        <g stroke="#9e8e73">
          <path d="M222 146h156l105 78H117z" fill="#e2d2ad" />
          <path d="M277 146h46l29 78H247z" fill="#eaddc2" />
          <path d="M206 158h188m-206 14h224m-247 17h270m-298 21h326" fill="none" />
          {[0, 1, 2, 3].map(i => <path key={i} d={`M${221 - i * 26} ${149 + i * 20}v-9m${158 + i * 52} 9v-9`} stroke="#716653" strokeWidth="3" />)}
        </g>
      ) : (
        <g fill="none">
          <path d="M-8 170Q132 184 605 159m-613 26q190 12 613-17" stroke="#625b50" strokeWidth="2.8" />
          <path d="M-8 171Q132 185 605 160m-613 26q190 12 613-17" stroke="#ddd0af" strokeWidth=".8" />
          <path d="M72 172V48m412 126V66M62 57h21m391 17h20" stroke="#665845" strokeWidth="3" />
          <path d="M72 56q233 41 412 16" stroke="#7c6f59" strokeWidth="1.2" />
        </g>
      )}
    </>
  )
}

function Pavilion({ restored }) {
  const supports = [167, 205, 243, 281, 319, 357, 395, 433]
  return (
    <>
      <path d="M0 135h600v89H0z" fill={restored ? '#649b9d' : '#868e82'} />
      <path d="M0 130q68-9 138 3h324q72-15 138-3v13q-64-8-137 5H143q-75-13-143-3Z" fill="#768368" />
      <path d="M115 157h362l36 17H85z" fill="#d4c4a8" stroke="#938974" strokeWidth="1.3" />
      <path d="M85 174h428v8H85z" fill="#a69680" />
      <path d="M149 110h302v9H149z" fill="#a89377" />
      {supports.map(x => (
        <g key={x}>
          <path d={`M${x} 118v42`} stroke="#b9b4a7" strokeWidth="8" />
          <path d={`M${x + 3} 119v40`} stroke="#736f65" strokeWidth="2" />
          <path d={`M${x} 92v21`} stroke={restored ? '#a1503c' : '#776554'} strokeWidth="6" />
          <path d={`M${x} 181l4 26`} stroke="#e6d5b4" strokeWidth="4" opacity={restored ? '.46' : '.16'} />
        </g>
      ))}
      <path d="M155 106h290m-290 6h290" stroke="#684c41" strokeWidth="2.2" />
      <path d="M151 98h298" stroke={restored ? '#5b8070' : '#665f4f'} strokeWidth="4.2" />
      <TiledRoof x={119} y={91} width={362} color={restored ? '#546f74' : '#646b60'} />
      <path d="M68 191h65m18 14h62m19-9h52m58-6h53m50 16h68m-419 8h59m123 0h96m88-28h53" fill="none" stroke={restored ? '#cfebdb' : '#b9beaa'} strokeWidth={restored ? 2 : 1} opacity=".8" />
      {!restored && <path d="M0 136l79-6 25 6-25 8H0zM17 125h67v3H17z" fill="#9b9987" />}
    </>
  )
}

function ColonialHall() {
  return (
    <>
      <path d="M0 173h600v51H0z" fill="#b3a38b" />
      <path d="M45 162V99h508v63zM125 99V87h350v12Z" fill="#96887a" stroke="#695e54" strokeWidth="1.5" />
      <path d="M246 88V69h108v19zM261 68q0-28 39-39 39 11 39 39Z" fill="#77796d" stroke="#5e6158" strokeWidth="2" />
      <path d="M261 68h78m-39-39V19" stroke="#615d50" strokeWidth="2" />
      <path d="M53 107h493m-495 43h497" stroke="#c3b69e" strokeWidth="4" />
      <path d="M225 105h150v60H225z" fill="#a89a84" stroke="#726558" />
      <path d="M211 106l89-22 89 22z" fill="#b8aa91" stroke="#776a59" strokeWidth="2" />
      {Array.from({ length: 14 }, (_, i) => {
        const x = i < 7 ? 69 + i * 21 : 405 + (i - 7) * 21
        return <path key={i} d={`M${x} 120h8v19h-8z`} fill="#54534e" stroke="#baae99" />
      })}
      {[243, 265, 335, 357].map(x => <path key={x} d={`M${x} 110v47`} stroke="#dfccb0" strokeWidth="7" />)}
      <path d="M284 162v-25a16 16 0 1 1 32 0v25Z" fill="#574c42" />
      <path d="M45 163h508m-517 6h527m-536 6h545" stroke="#daceb7" strokeWidth="3" />
      <path d="M208 224l59-46h66l59 46" fill="#cabb9e" />
    </>
  )
}

export default function RestorationIllustration({ id, restored = false }) {
  return (
    <svg viewBox="0 0 600 224" aria-hidden="true">
      <path d="M0 0h600v224H0z" fill={restored ? '#dbe9e6' : '#ded4c1'} />
      <path d="M0 102l75-52 79 27 57-28 60 22 53-36 84 42 91-32 101 60v80H0z" fill={restored ? '#a0b4aa' : '#b4ab96'} />
      <path d="M0 121l58-22 82 9 68-16 69 13 51-14 96 20 87-28 89 32v78H0z" fill={restored ? '#758f79' : '#a09b82'} />
      {id === SPECIAL_IDS.pavilion
        ? <Pavilion restored={restored} />
        : id === SPECIAL_IDS.central && !restored
          ? <ColonialHall />
          : <GateCourtyard restored={restored} inner={id === SPECIAL_IDS.central} />}
    </svg>
  )
}
