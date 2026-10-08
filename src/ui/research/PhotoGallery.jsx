import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { mediaAt, sourceById } from '../../data/research.js'
export default function PhotoGallery({site,buildingId,buildingIds,research,month,lang,compact=false}) {
  const all=mediaAt(research,site.id,month,buildingId).filter(p=>!buildingIds||p.buildings.some(b=>buildingIds.includes(b))), photos=compact?all.filter(p=>p.kind!=='rendering').slice(0,1):all
  const [selected,setSelected]=useState([]), [open,setOpen]=useState(false)
  const dialog=useRef(null)
  const scopeKey=buildingIds?.join(",")
  useEffect(()=>{setSelected([]);setOpen(false)},[site.id,buildingId,scopeKey,month])
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close()},[open])
  const render=(p,full=false)=>{const source=sourceById(research,p.sourceId);return <figure className="photo-card" key={p.id}>
    {p.rights==='display'?<img src={full?p.full:p.thumbnail} loading="lazy" alt={photoTitle(p,lang)} onError={e=>{e.currentTarget.hidden=true}}/>:<div className="photo-placeholder"><ArrowUpRight size={24} aria-hidden="true"/>{lang==='ko'?'현장 자료를 원문에서 확인':'View imagery in the original source'}</div>}
    <figcaption><span className="research-badge">{p.kind==='rendering'?(lang==='ko'?'조감도':'Rendering'):(lang==='ko'?'현장 사진':'Site photo')}</span><b>{photoTitle(p,lang)}</b><p>{lang==='ko'?'촬영':'Captured'} · {p.captured ?? (lang==='ko'?'미상':'Unknown')}<br/>{lang==='ko'?'게시':'Published'} · {source.published ?? (lang==='ko'?'미상':'Unknown')}{!source.published&&<> · {lang==='ko'?'확인':'Reviewed'} {source.reviewedAt}</>} · {p.locator}</p><a href={source.url} target="_blank" rel="noreferrer">{lang==='ko'?'원문 보기':'View original'}<ArrowUpRight size={12} aria-hidden="true"/></a><small>{p.rightsNote}</small></figcaption>
    {!compact&&!full&&p.rights==='display'&&<div className="photo-actions"><button onClick={()=>{setSelected([p.id]);setOpen(true)}}>{lang==='ko'?'확대':'Enlarge'}</button><label><input type="checkbox" checked={selected.includes(p.id)} disabled={!selected.includes(p.id)&&selected.length===2} onChange={()=>setSelected(s=>s.includes(p.id)?s.filter(id=>id!==p.id):[...s,p.id])}/>{lang==='ko'?'비교':'Compare'}</label></div>}
  </figure>}
  return <section className="photo-gallery">{!photos.length&&<p className="research-empty">{lang==='ko'?'확인된 현장 사진 없음':'No identified site photos at this date'}</p>}{photos.map(p=>render(p))}
    {!compact&&selected.length===2&&<button onClick={()=>setOpen(true)}>{lang==='ko'?'두 사진 비교':'Compare two photos'}</button>}
    <dialog aria-label={lang==='ko'?'사진 확대·비교':'Image preview and comparison'} className="photo-dialog" ref={dialog} onCancel={()=>setOpen(false)}><button autoFocus onClick={()=>setOpen(false)}>{lang==='ko'?'닫기':'Close'}</button><div className="photo-comparison">{open&&all.filter(p=>selected.includes(p.id)).map(p=>render(p,true))}</div></dialog>
  </section>
}

// 사진 제목: 영어 화면이면 title_en (없으면 원래 제목)
const photoTitle = (p, lang) => (lang === 'ko' ? p.title : p.title_en ?? p.title)
