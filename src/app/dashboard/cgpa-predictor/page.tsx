'use client'
import { useState, useEffect, useCallback } from 'react'
import { saveCgpaPrediction, getCgpaPredictions } from '@/lib/actions/cgpa'
import { getUserProfile } from '@/lib/actions/profile'

interface MarkField { key: string; max: number }
interface Subject { id: string; name: string; type: 'theory'|'practical'; credits: number; markFields: MarkField[] }
interface SubjectMarks { [key: string]: string }

const uid = () => Math.random().toString(36).slice(2,9)

const DEFAULT_SUBJECTS: Subject[] = [
  { id: uid(), name: 'Mathematical Foundations for AI & ML', type: 'theory', credits: 3, markFields: [{key:'TAE',max:20},{key:'CAE',max:20},{key:'ESE',max:60}] },
  { id: uid(), name: 'Operating Systems', type: 'theory', credits: 3, markFields: [{key:'TAE',max:20},{key:'CAE',max:20},{key:'ESE',max:60}] },
  { id: uid(), name: 'Operating Systems Lab', type: 'practical', credits: 1, markFields: [{key:'INT',max:25},{key:'EXT',max:25}] },
  { id: uid(), name: 'Computer Networks', type: 'theory', credits: 3, markFields: [{key:'TAE',max:20},{key:'CAE',max:20},{key:'ESE',max:60}] },
  { id: uid(), name: 'Computer Networks Lab', type: 'practical', credits: 1, markFields: [{key:'INT',max:25}] },
  { id: uid(), name: 'Object Oriented Programming Skills', type: 'theory', credits: 3, markFields: [{key:'TAE',max:20},{key:'CAE',max:20},{key:'ESE',max:60}] },
  { id: uid(), name: 'OOP Skills Lab', type: 'practical', credits: 1, markFields: [{key:'INT',max:25}] },
  { id: uid(), name: 'Open Elective - I', type: 'theory', credits: 3, markFields: [{key:'TAE',max:20},{key:'CAE',max:20},{key:'ESE',max:60}] },
  { id: uid(), name: 'Micro Project (Experiential Learning)', type: 'practical', credits: 2, markFields: [{key:'INT',max:25},{key:'EXT',max:25}] },
  { id: uid(), name: 'Life Skill', type: 'practical', credits: 1, markFields: [{key:'EXT',max:25}] },
]

const GRADE_SCALE = [
  { grade:'O', min:80, points:10 }, { grade:'A+', min:70, points:9 }, { grade:'A', min:60, points:8 },
  { grade:'B+', min:55, points:7 }, { grade:'B', min:50, points:6 }, { grade:'C', min:45, points:5 },
  { grade:'P', min:40, points:4 }, { grade:'F', min:0, points:0 },
]
function getGrade(pct: number) { for (const g of GRADE_SCALE) { if (pct >= g.min) return g } return GRADE_SCALE[7] }

const GC: Record<string,string> = {
  'O':'bg-emerald-500/20 text-emerald-400 border-emerald-500/30','A+':'bg-green-500/20 text-green-400 border-green-500/30',
  'A':'bg-teal-500/20 text-teal-400 border-teal-500/30','B+':'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'B':'bg-sky-500/20 text-sky-400 border-sky-500/30','C':'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'P':'bg-orange-500/20 text-orange-400 border-orange-500/30','F':'bg-red-500/20 text-red-400 border-red-500/30',
}

export default function CgpaPredictorPage() {
  const [firstName, setFirstName] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>(DEFAULT_SUBJECTS)
  const [marks, setMarks] = useState<SubjectMarks[]>(DEFAULT_SUBJECTS.map(s => Object.fromEntries(s.markFields.map(f => [f.key, '']))))
  const [targetSgpa, setTargetSgpa] = useState('')
  const [whatIfMode, setWhatIfMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{type:'ok'|'err';text:string}|null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'theory'|'practical'>('theory')
  const [newCredits, setNewCredits] = useState('3')
  const [newHasInt, setNewHasInt] = useState(true)
  const [newHasExt, setNewHasExt] = useState(true)
  const [newIntMax, setNewIntMax] = useState('25')
  const [newExtMax, setNewExtMax] = useState('25')

  useEffect(() => { getUserProfile().then(r => { if (r.success && r.data) setFirstName(r.data.first_name || '') }) }, [])

  const loadHistory = useCallback(async () => { setLoadingHistory(true); const r = await getCgpaPredictions(); if (r.success) setHistory(r.data||[]); setLoadingHistory(false) }, [])
  useEffect(() => { if (showHistory) loadHistory() }, [showHistory, loadHistory])

  const totalCredits = subjects.reduce((s, sub) => s + sub.credits, 0)

  const computeSubject = (idx: number) => {
    const s = subjects[idx]; const m = marks[idx]
    const vals = s.markFields.map(f => m[f.key] === '' ? null : Number(m[f.key]))
    if (!vals.some(v => v !== null)) return { total:null, maxTotal:0, pct:null, grade:null, gradePoints:null }
    const maxTotal = s.markFields.reduce((a,f) => a+f.max, 0)
    const total = vals.reduce((sum,v) => (sum??0)+(v??0), 0) as number
    const pct = (total/maxTotal)*100; const g = getGrade(pct)
    return { total, maxTotal, pct, grade:g.grade, gradePoints:g.points }
  }
  const results = subjects.map((_,i) => computeSubject(i))

  const sgpa = (() => {
    if (!results.some(r => r.grade !== null)) return null
    let sum = 0; for (let i=0;i<subjects.length;i++) sum += (results[i].gradePoints??0)*subjects[i].credits
    return totalCredits > 0 ? sum/totalCredits : null
  })()

  const computeWhatIf = () => {
    const target = parseFloat(targetSgpa); if (isNaN(target)||target<0||target>10||totalCredits===0) return null
    const targetGP = target*totalCredits; let fixedGP = 0; const blanks: number[] = []
    for (let i=0;i<subjects.length;i++) {
      const s = subjects[i]; const m = marks[i]
      const lastField = s.markFields[s.markFields.length-1]
      if (m[lastField.key]==='') blanks.push(i); else fixedGP += (results[i].gradePoints??0)*s.credits
    }
    if (!blanks.length) return null; const remainGP = targetGP - fixedGP
    return blanks.map(bi => {
      const s = subjects[bi]; const m = marks[bi]; const lastF = s.markFields[s.markFields.length-1]
      const maxTotal = s.markFields.reduce((a,f)=>a+f.max,0)
      const filledSum = s.markFields.filter(f=>f.key!==lastF.key).reduce((sum,f)=>sum+(m[f.key]===''?0:Number(m[f.key])),0)
      let otherBlanksGP = 0
      for (const oi of blanks) { if (oi===bi) continue; const os=subjects[oi]; const om=marks[oi]
        const oLast=os.markFields[os.markFields.length-1]; const oFilled=os.markFields.filter(f=>f.key!==oLast.key).reduce((s2,f)=>s2+(om[f.key]===''?0:Number(om[f.key])),0)
        const oMax=os.markFields.reduce((a,f)=>a+f.max,0); otherBlanksGP+=getGrade((oFilled/oMax)*100).points*os.credits
      }
      const needed = remainGP-otherBlanksGP; let found: number|'impossible' = 'impossible'
      for (let mk=0;mk<=lastF.max;mk++) { if (getGrade(((filledSum+mk)/maxTotal)*100).points*s.credits>=needed) { found=mk; break } }
      return { idx:bi, neededMarks:found, fieldName:lastF.key }
    })
  }
  const whatIfResults = whatIfMode ? computeWhatIf() : null

  const updateMark = (si: number, key: string, value: string) => {
    const field = subjects[si].markFields.find(f=>f.key===key); if (!field) return
    let v = value.replace(/[^0-9]/g,''); if (v!==''&&Number(v)>field.max) v=String(field.max)
    setMarks(p => { const n=[...p]; n[si]={...n[si],[key]:v}; return n })
  }

  const addSubject = () => {
    if (!newName.trim()) return
    const mf: MarkField[] = newType==='theory'
      ? [{key:'TAE',max:20},{key:'CAE',max:20},{key:'ESE',max:60}]
      : [...(newHasInt?[{key:'INT',max:Number(newIntMax)||25}]:[]),...(newHasExt?[{key:'EXT',max:Number(newExtMax)||25}]:[])]
    if (newType==='practical'&&!mf.length) return
    const sub: Subject = { id:uid(), name:newName.trim(), type:newType, credits:Number(newCredits)||1, markFields:mf }
    setSubjects(p=>[...p,sub]); setMarks(p=>[...p,Object.fromEntries(mf.map(f=>[f.key,'']))])
    setNewName(''); setNewType('theory'); setNewCredits('3'); setNewHasInt(true); setNewHasExt(true); setShowAddForm(false)
  }

  const deleteSubject = (idx: number) => {
    setSubjects(p=>p.filter((_,i)=>i!==idx)); setMarks(p=>p.filter((_,i)=>i!==idx))
  }

  const handleSave = async () => {
    if (sgpa===null) return; setSaving(true); setSaveMsg(null)
    const res = await saveCgpaPrediction({ 
      semester:'Sem 4', 
      subjects_data:subjects.map((s,i)=>({
        id: s.id,
        name:s.name,
        type:s.type,
        credits:s.credits,
        markFields: s.markFields,
        marks:marks[i],
        ...results[i]
      })), 
      predicted_sgpa:parseFloat(sgpa.toFixed(2)), 
      target_sgpa:targetSgpa?parseFloat(targetSgpa):null 
    })
    setSaving(false); 
    setSaveMsg(res.success?{type:'ok',text:'Saved!'}:{type:'err',text:res.error||'Failed'}); 
    if (res.success) loadHistory();
    setTimeout(()=>setSaveMsg(null),3000)
  }

  const fillFromHistory = (h: any) => {
    try {
      const data = h.subjects_data;
      if (Array.isArray(data)) {
        setSubjects(data.map(s => ({
          id: s.id || uid(),
          name: s.name,
          type: s.type,
          credits: s.credits,
          markFields: s.markFields || (s.type === 'theory' 
            ? [{key:'TAE',max:20},{key:'CAE',max:20},{key:'ESE',max:60}]
            : [{key:'INT',max:25},{key:'EXT',max:25}])
        })));
        setMarks(data.map(s => s.marks || {}));
        if (h.target_sgpa) setTargetSgpa(String(h.target_sgpa));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e) { console.error("Fill error", e) }
  }

  const handleReset = () => {
    setSubjects(DEFAULT_SUBJECTS); setMarks(DEFAULT_SUBJECTS.map(s=>Object.fromEntries(s.markFields.map(f=>[f.key,''])))); setTargetSgpa(''); setWhatIfMode(false)
  }

  const sgpaVal=sgpa??0; const circ=2*Math.PI*54; const dash=(sgpaVal/10)*circ
  const rc = sgpaVal>=8?'#10b981':sgpaVal>=6?'#3b82f6':sgpaVal>=4?'#f59e0b':'#ef4444'

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-purple-400 flex items-center gap-3"><span>📊</span> Smart CGPA Predictor</h1>
          <p className="text-gray-400 text-sm mt-1">
            {firstName ? <>Hey <span className="text-purple-300 font-semibold">{firstName}</span>! </> : ''}
            G.H. Raisoni — Sem 4 • {subjects.length} subjects • {totalCredits} credits
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={()=>setShowAddForm(!showAddForm)} className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-700 bg-gray-800 text-gray-300 hover:text-white hover:border-emerald-500 transition-all">{showAddForm?'✕ Cancel':'➕ Add Subject'}</button>
          <button onClick={()=>setShowHistory(!showHistory)} className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-700 bg-gray-800 text-gray-300 hover:text-white hover:border-purple-500 transition-all">{showHistory?'← Back':'📜 History'}</button>
          <button onClick={handleReset} className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-700 bg-gray-800 text-gray-300 hover:text-white hover:border-red-500 transition-all">🔄 Reset</button>
        </div>
      </div>

      {/* Add Subject Form */}
      {showAddForm && !showHistory && (
        <div className="bg-gray-900 border border-emerald-500/30 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2">
          <h3 className="font-bold text-white text-lg">Add New Subject</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 font-bold uppercase block mb-1">Subject Name</label>
              <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Data Structures" className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 focus:outline-none placeholder-gray-600" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-bold uppercase block mb-1">Credits</label>
              <input type="number" min="1" max="10" value={newCredits} onChange={e=>setNewCredits(e.target.value)} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-bold uppercase block mb-2">Type</label>
            <div className="flex gap-2">
              <button onClick={()=>setNewType('theory')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${newType==='theory'?'bg-blue-600 text-white':'bg-gray-800 text-gray-400 border border-gray-700'}`}>📘 Theory</button>
              <button onClick={()=>setNewType('practical')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${newType==='practical'?'bg-amber-600 text-white':'bg-gray-800 text-gray-400 border border-gray-700'}`}>🔧 Practical</button>
            </div>
          </div>
          {newType==='theory' ? (
            <p className="text-xs text-gray-500">Theory subjects use TAE (20) + CAE (20) + ESE (60) = 100 marks</p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Select which components this practical has:</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={newHasInt} onChange={e=>setNewHasInt(e.target.checked)} className="accent-purple-500 w-4 h-4" /> INT
                  {newHasInt && <input type="number" min="1" max="100" value={newIntMax} onChange={e=>setNewIntMax(e.target.value)} className="w-16 p-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs text-center" />}
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={newHasExt} onChange={e=>setNewHasExt(e.target.checked)} className="accent-purple-500 w-4 h-4" /> EXT
                  {newHasExt && <input type="number" min="1" max="100" value={newExtMax} onChange={e=>setNewExtMax(e.target.value)} className="w-16 p-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs text-center" />}
                </label>
              </div>
            </div>
          )}
          <button onClick={addSubject} disabled={!newName.trim()||(newType==='practical'&&!newHasInt&&!newHasExt)} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white font-bold transition-all disabled:opacity-40 active:scale-[0.97]">✅ Add Subject</button>
        </div>
      )}

      {showHistory ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Saved Predictions</h2>
          {loadingHistory ? <div className="text-center py-12 text-gray-500">Loading...</div>
          : history.length===0 ? <div className="text-center py-12 text-gray-500">No saved predictions yet.</div>
          : <div className="space-y-3">{history.map((h:any)=>(
              <div key={h.id} onClick={() => { fillFromHistory(h); setShowHistory(false); }} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl border border-gray-700 cursor-pointer hover:border-purple-500 transition-all">
                <div><span className="font-bold text-white">{h.semester}</span><span className="text-gray-500 text-sm ml-3">{new Date(h.created_at).toLocaleDateString()}</span></div>
                <div className="flex items-center gap-3">{h.target_sgpa&&<span className="text-xs text-gray-400">Target: {h.target_sgpa}</span>}<span className="text-lg font-bold text-purple-400">{h.predicted_sgpa} SGPA</span></div>
              </div>))}</div>}
        </div>
      ) : (
        <>
          {/* SGPA + What-If */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="#1f2937" strokeWidth="8"/>
                  <circle cx="60" cy="60" r="54" fill="none" stroke={rc} strokeWidth="8" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ-dash} className="transition-all duration-700 ease-out"/>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-white">{sgpa!==null?sgpa.toFixed(2):'—'}</span>
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">SGPA</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">{sgpa!==null&&sgpa>=8?'🎉 Excellent!':sgpa!==null&&sgpa>=6?'👍 Good!':sgpa!==null?'💪 Keep going!':'Enter marks to begin'}</p>
            </div>
            <div className="md:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div><h2 className="text-lg font-bold text-white">🔮 What-If Analysis</h2><p className="text-xs text-gray-500 mt-1">Leave the last mark field blank → see what you need!</p></div>
                <button onClick={()=>setWhatIfMode(!whatIfMode)} className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${whatIfMode?'bg-purple-600':'bg-gray-700'}`}><span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${whatIfMode?'translate-x-6':''}`}/></button>
              </div>
              {whatIfMode&&(<div className="space-y-4">
                <div><label className="text-sm text-gray-400 font-medium">Target SGPA</label><input type="number" min="0" max="10" step="0.01" value={targetSgpa} onChange={e=>setTargetSgpa(e.target.value)} placeholder="e.g. 8.5" className="w-full mt-1 p-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:ring-2 focus:ring-purple-600/30 focus:border-purple-600 focus:outline-none"/></div>
                {whatIfResults&&whatIfResults.length>0&&<div className="space-y-2">{whatIfResults.map(w=>(
                  <div key={w.idx} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                    <span className="text-sm text-gray-300 truncate mr-2">{subjects[w.idx].name}</span>
                    <span className={`text-sm font-bold shrink-0 ${w.neededMarks==='impossible'?'text-red-400':'text-emerald-400'}`}>
                      {w.neededMarks==='impossible'?'❌ Not achievable':`Need ≥ ${w.neededMarks} in ${w.fieldName}`}
                    </span></div>))}</div>}
              </div>)}
            </div>
          </div>

          {/* Subject Cards */}
          <div className="space-y-2">
            {subjects.map((s,i) => {
              const r=results[i]; const maxTotal=s.markFields.reduce((a,f)=>a+f.max,0)
              return (
                <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2 group hover:border-gray-700 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-white text-sm truncate">{s.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${s.type==='theory'?'text-blue-400':'text-amber-400'}`}>{s.type}</span>
                        <span className="text-[10px] text-gray-600">•</span>
                        <span className="text-[10px] text-gray-500 font-bold">{s.credits} Cr</span>
                        <span className="text-[10px] text-gray-600">•</span>
                        <span className="text-[10px] text-gray-500">{s.markFields.map(f=>f.key).join(' + ')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.grade&&<span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${GC[r.grade]}`}>{r.grade}</span>}
                      <button onClick={()=>deleteSubject(i)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all" title="Remove subject">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {s.markFields.map(f=>(
                      <div key={f.key} className="flex-1 min-w-[60px]">
                        <label className="text-[9px] text-gray-500 font-bold uppercase block mb-0.5">{f.key} <span className="text-gray-700">/{f.max}</span></label>
                        <input type="number" min="0" max={f.max} value={marks[i][f.key]} onChange={e=>updateMark(i,f.key,e.target.value)} placeholder="0" className="w-full p-1.5 text-center bg-gray-800 border border-gray-700 rounded-lg text-white text-xs focus:ring-2 focus:ring-purple-600/30 focus:border-purple-600 focus:outline-none transition-all placeholder-gray-700"/>
                      </div>
                    ))}
                  </div>
                  {r.total!==null&&(
                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-gray-800/50">
                      <span className="text-gray-500">Total: <span className="text-white font-bold">{r.total}/{maxTotal}</span></span>
                      <span className="text-gray-500">{r.pct?.toFixed(1)}% • GP: <span className="text-purple-400 font-bold">{r.gradePoints}</span></span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button onClick={handleSave} disabled={sgpa===null||saving} className="w-full sm:w-auto px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl text-white font-bold transition-all disabled:opacity-40 shadow-lg shadow-purple-600/20 active:scale-[0.97]">{saving?'Saving...':'💾 Save Prediction'}</button>
              {saveMsg&&<span className={`text-sm font-medium ${saveMsg.type==='ok'?'text-emerald-400':'text-red-400'}`}>{saveMsg.text}</span>}
            </div>

            {/* Recent Predictions */}
            <div className="pt-4 border-t border-gray-800">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>🕒</span> Recent Predictions
              </h3>
              {history.length === 0 ? (
                <p className="text-xs text-gray-600 italic">No history yet. Save a prediction to see it here.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {history.slice(0, 6).map((h: any) => (
                    <div 
                      key={h.id} 
                      onClick={() => fillFromHistory(h)}
                      className="p-3 bg-gray-900 border border-gray-800 rounded-xl cursor-pointer hover:border-purple-500 transition-all group"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">{h.semester}</p>
                          <p className="text-[10px] text-gray-500">{new Date(h.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-purple-400">{h.predicted_sgpa}</p>
                          <p className="text-[9px] text-gray-500 uppercase font-bold tracking-tighter">SGPA</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
