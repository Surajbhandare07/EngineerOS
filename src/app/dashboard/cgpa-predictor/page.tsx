'use client'
import { useState, useEffect, useCallback } from 'react'
import { saveCgpaPrediction, getCgpaPredictions } from '@/lib/actions/cgpa'
import { getUserProfile } from '@/lib/actions/profile'

interface MarkField { key: string; max: number }
interface Subject { id: string; name: string; type: 'theory' | 'practical'; credits: number; markFields: MarkField[] }
interface SubjectMarks { [key: string]: string }

const uid = () => Math.random().toString(36).slice(2, 9)

const DEFAULT_SUBJECTS: Subject[] = [
  { id: uid(), name: 'Mathematical Foundations for AI & ML', type: 'theory', credits: 3, markFields: [{ key: 'TAE', max: 20 }, { key: 'CAE', max: 20 }, { key: 'ESE', max: 60 }] },
  { id: uid(), name: 'Operating Systems', type: 'theory', credits: 3, markFields: [{ key: 'TAE', max: 20 }, { key: 'CAE', max: 20 }, { key: 'ESE', max: 60 }] },
  { id: uid(), name: 'Operating Systems Lab', type: 'practical', credits: 1, markFields: [{ key: 'INT', max: 25 }, { key: 'EXT', max: 25 }] },
  { id: uid(), name: 'Computer Networks', type: 'theory', credits: 3, markFields: [{ key: 'TAE', max: 20 }, { key: 'CAE', max: 20 }, { key: 'ESE', max: 60 }] },
  { id: uid(), name: 'Computer Networks Lab', type: 'practical', credits: 1, markFields: [{ key: 'INT', max: 25 }] },
  { id: uid(), name: 'Object Oriented Programming Skills', type: 'theory', credits: 3, markFields: [{ key: 'TAE', max: 20 }, { key: 'CAE', max: 20 }, { key: 'ESE', max: 60 }] },
  { id: uid(), name: 'OOP Skills Lab', type: 'practical', credits: 1, markFields: [{ key: 'INT', max: 25 }] },
  { id: uid(), name: 'Open Elective - I', type: 'theory', credits: 3, markFields: [{ key: 'TAE', max: 20 }, { key: 'CAE', max: 20 }, { key: 'ESE', max: 60 }] },
  { id: uid(), name: 'Micro Project (Experiential Learning)', type: 'practical', credits: 2, markFields: [{ key: 'INT', max: 25 }, { key: 'EXT', max: 25 }] },
  { id: uid(), name: 'Life Skill', type: 'practical', credits: 1, markFields: [{ key: 'EXT', max: 25 }] },
]

const GRADE_SCALE = [
  { grade: 'O', min: 80, points: 10 }, { grade: 'A+', min: 70, points: 9 }, { grade: 'A', min: 60, points: 8 },
  { grade: 'B+', min: 55, points: 7 }, { grade: 'B', min: 50, points: 6 }, { grade: 'C', min: 45, points: 5 },
  { grade: 'P', min: 40, points: 4 }, { grade: 'F', min: 0, points: 0 },
]
function getGrade(pct: number) { for (const g of GRADE_SCALE) { if (pct >= g.min) return g } return GRADE_SCALE[7] }

const GC: Record<string, string> = {
  'O': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', 'A+': 'bg-green-500/20 text-green-400 border-green-500/30',
  'A': 'bg-teal-500/20 text-teal-400 border-teal-500/30', 'B+': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'B': 'bg-sky-500/20 text-sky-400 border-sky-500/30', 'C': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'P': 'bg-orange-500/20 text-orange-400 border-orange-500/30', 'F': 'bg-red-500/20 text-red-400 border-red-500/30',
}

export default function CgpaPredictorPage() {
  const [firstName, setFirstName] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>(DEFAULT_SUBJECTS)
  const [marks, setMarks] = useState<SubjectMarks[]>(DEFAULT_SUBJECTS.map(s => Object.fromEntries(s.markFields.map(f => [f.key, '']))))
  const [targetSgpa, setTargetSgpa] = useState('')
  const [whatIfMode, setWhatIfMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'theory' | 'practical'>('theory')
  const [newCredits, setNewCredits] = useState('3')
  const [newHasInt, setNewHasInt] = useState(true)
  const [newHasExt, setNewHasExt] = useState(true)
  const [newIntMax, setNewIntMax] = useState('25')
  const [newExtMax, setNewExtMax] = useState('25')

  useEffect(() => { getUserProfile().then((r: any) => { if (r.success && r.data) setFirstName(r.data.first_name || '') }) }, [])

  const loadHistory = useCallback(async () => { setLoadingHistory(true); const r = await getCgpaPredictions(); if (r.success) setHistory(r.data || []); setLoadingHistory(false) }, [])
  useEffect(() => { if (showHistory) loadHistory() }, [showHistory, loadHistory])

  const totalCredits = subjects.reduce((s, sub) => s + sub.credits, 0)

  const computeSubject = (idx: number) => {
    const s = subjects[idx]; const m = marks[idx]
    const vals = s.markFields.map(f => m[f.key] === '' ? null : Number(m[f.key]))
    if (!vals.some(v => v !== null)) return { total: null, maxTotal: 0, pct: null, grade: null, gradePoints: null }
    const maxTotal = s.markFields.reduce((a, f) => a + f.max, 0)
    const total = vals.reduce((sum, v) => (sum ?? 0) + (v ?? 0), 0) as number
    const pct = (total / maxTotal) * 100; const g = getGrade(pct)
    return { total, maxTotal, pct, grade: g.grade, gradePoints: g.points }
  }
  const results = subjects.map((_, i) => computeSubject(i))

  const sgpa = (() => {
    if (!results.some(r => r.grade !== null)) return null
    let sum = 0; for (let i = 0; i < subjects.length; i++) sum += (results[i].gradePoints ?? 0) * subjects[i].credits
    return totalCredits > 0 ? sum / totalCredits : null
  })()

  const computeWhatIf = () => {
    const target = parseFloat(targetSgpa); if (isNaN(target) || target < 0 || target > 10 || totalCredits === 0) return null
    const targetGP = target * totalCredits; let fixedGP = 0; const blanks: number[] = []
    for (let i = 0; i < subjects.length; i++) {
      const s = subjects[i]; const m = marks[i]
      const lastField = s.markFields[s.markFields.length - 1]
      if (m[lastField.key] === '') blanks.push(i); else fixedGP += (results[i].gradePoints ?? 0) * s.credits
    }
    if (!blanks.length) return null; const remainGP = targetGP - fixedGP
    return blanks.map(bi => {
      const s = subjects[bi]; const m = marks[bi]; const lastF = s.markFields[s.markFields.length - 1]
      const maxTotal = s.markFields.reduce((a, f) => a + f.max, 0)
      const filledSum = s.markFields.filter(f => f.key !== lastF.key).reduce((sum, f) => sum + (m[f.key] === '' ? 0 : Number(m[f.key])), 0)
      let otherBlanksGP = 0
      for (const oi of blanks) {
        if (oi === bi) continue; const os = subjects[oi]; const om = marks[oi]
        const oLast = os.markFields[os.markFields.length - 1]; const oFilled = os.markFields.filter(f => f.key !== oLast.key).reduce((s2, f) => s2 + (om[f.key] === '' ? 0 : Number(om[f.key])), 0)
        const oMax = os.markFields.reduce((a, f) => a + f.max, 0); otherBlanksGP += getGrade((oFilled / oMax) * 100).points * os.credits
      }
      const needed = remainGP - otherBlanksGP; let found: number | 'impossible' = 'impossible'
      for (let mk = 0; mk <= lastF.max; mk++) { if (getGrade(((filledSum + mk) / maxTotal) * 100).points * s.credits >= needed) { found = mk; break } }
      return { idx: bi, neededMarks: found, fieldName: lastF.key }
    })
  }
  const whatIfResults = whatIfMode ? computeWhatIf() : null

  const updateMark = (si: number, key: string, value: string) => {
    const field = subjects[si].markFields.find(f => f.key === key); if (!field) return
    let v = value.replace(/[^0-9]/g, ''); if (v !== '' && Number(v) > field.max) v = String(field.max)
    setMarks(p => { const n = [...p]; n[si] = { ...n[si], [key]: v }; return n })
  }

  const addSubject = () => {
    if (!newName.trim()) return
    const mf: MarkField[] = newType === 'theory'
      ? [{ key: 'TAE', max: 20 }, { key: 'CAE', max: 20 }, { key: 'ESE', max: 60 }]
      : [...(newHasInt ? [{ key: 'INT', max: Number(newIntMax) || 25 }] : []), ...(newHasExt ? [{ key: 'EXT', max: Number(newExtMax) || 25 }] : [])]
    if (newType === 'practical' && !mf.length) return
    const sub: Subject = { id: uid(), name: newName.trim(), type: newType, credits: Number(newCredits) || 1, markFields: mf }
    setSubjects(p => [...p, sub]); setMarks(p => [...p, Object.fromEntries(mf.map(f => [f.key, '']))])
    setNewName(''); setNewType('theory'); setNewCredits('3'); setNewHasInt(true); setNewHasExt(true); setShowAddForm(false)
  }

  const deleteSubject = (idx: number) => {
    setSubjects(p => p.filter((_, i) => i !== idx)); setMarks(p => p.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    if (sgpa === null) return; setSaving(true); setSaveMsg(null)
    const res = await saveCgpaPrediction({
      semester: 'Sem 4',
      subjects_data: subjects.map((s, i) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        credits: s.credits,
        markFields: s.markFields,
        marks: marks[i],
        ...results[i]
      })),
      predicted_sgpa: parseFloat(sgpa.toFixed(2)),
      target_sgpa: targetSgpa ? parseFloat(targetSgpa) : null
    })
    setSaving(false);
    setSaveMsg(res.success ? { type: 'ok', text: 'Saved!' } : { type: 'err', text: res.error || 'Failed' });
    if (res.success) loadHistory();
    setTimeout(() => setSaveMsg(null), 3000)
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
            ? [{ key: 'TAE', max: 20 }, { key: 'CAE', max: 20 }, { key: 'ESE', max: 60 }]
            : [{ key: 'INT', max: 25 }, { key: 'EXT', max: 25 }])
        })));
        setMarks(data.map(s => s.marks || {}));
        if (h.target_sgpa) setTargetSgpa(String(h.target_sgpa));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e) { console.error("Fill error", e) }
  }

  const handleReset = () => {
    setSubjects(DEFAULT_SUBJECTS); setMarks(DEFAULT_SUBJECTS.map(s => Object.fromEntries(s.markFields.map(f => [f.key, ''])))); setTargetSgpa(''); setWhatIfMode(false)
  }

  const sgpaVal = sgpa ?? 0; const circ = 2 * Math.PI * 54; const dash = (sgpaVal / 10) * circ
  const rc = sgpaVal >= 8 ? '#10b981' : sgpaVal >= 6 ? '#3b82f6' : sgpaVal >= 4 ? '#f59e0b' : '#ef4444'

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tighter flex items-center gap-3">
            <span className="p-2 bg-purple-500/10 rounded-xl">📊</span>
            Smart CGPA Predictor
          </h1>
          <p className="text-muted-foreground text-sm mt-2 font-medium">
            {firstName ? <>Hey <span className="text-purple-600 dark:text-purple-400 font-bold">{firstName}</span>! </> : ''}
            G.H. Raisoni — Sem 4 • {subjects.length} subjects • {totalCredits} credits
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowAddForm(!showAddForm)} className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:border-emerald-500 transition-all shadow-sm">{showAddForm ? '✕ Cancel' : '➕ Add Subject'}</button>
          <button onClick={() => setShowHistory(!showHistory)} className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:border-purple-500 transition-all shadow-sm">{showHistory ? '← Back' : '📜 History'}</button>
          <button onClick={handleReset} className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:border-red-500 transition-all shadow-sm">🔄 Reset</button>
        </div>
      </div>

      {showAddForm && !showHistory && (
        <div className="bg-card border border-emerald-500/30 rounded-[2rem] p-8 space-y-6 shadow-xl animate-in fade-in slide-in-from-top-4">
          <h3 className="font-black text-foreground text-xl tracking-tight">Add New Subject</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="sm:col-span-2">
              <label className="text-[10px] text-muted-foreground font-black uppercase tracking-widest block mb-2">Subject Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Data Structures" className="w-full p-4 bg-muted/50 border border-border rounded-2xl text-foreground text-sm focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 focus:outline-none transition-all placeholder:text-muted-foreground/30" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-black uppercase tracking-widest block mb-2">Credits</label>
              <input type="number" min="1" max="10" value={newCredits} onChange={e => setNewCredits(e.target.value)} className="w-full p-4 bg-muted/50 border border-border rounded-2xl text-foreground text-sm focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 focus:outline-none transition-all" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button onClick={() => setNewType('theory')} className={`p-4 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-3 border ${newType === 'theory' ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'}`}>📘 Theory</button>
            <button onClick={() => setNewType('practical')} className={`p-4 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-3 border ${newType === 'practical' ? 'bg-amber-600 text-white border-amber-500 shadow-lg shadow-amber-500/20' : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'}`}>🔧 Practical</button>
          </div>
          {newType === 'theory' ? (
            <p className="text-xs text-muted-foreground font-medium bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">Theory subjects use standard TAE (20) + CAE (20) + ESE (60) = 100 marks distribution.</p>
          ) : (
            <div className="space-y-4 bg-amber-500/5 p-6 rounded-[1.5rem] border border-amber-500/10">
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-black uppercase tracking-widest">Practical Components</p>
              <div className="flex gap-8">
                <label className="flex items-center gap-3 text-sm text-foreground font-semibold cursor-pointer group">
                  <input type="checkbox" checked={newHasInt} onChange={e => setNewHasInt(e.target.checked)} className="accent-purple-600 w-5 h-5 rounded-lg" />
                  <span>Internal (INT)</span>
                  {newHasInt && <input type="number" min="1" max="100" value={newIntMax} onChange={e => setNewIntMax(e.target.value)} className="w-20 p-2 bg-background border border-border rounded-xl text-foreground text-xs text-center font-bold" />}
                </label>
                <label className="flex items-center gap-3 text-sm text-foreground font-semibold cursor-pointer group">
                  <input type="checkbox" checked={newHasExt} onChange={e => setNewHasExt(e.target.checked)} className="accent-purple-600 w-5 h-5 rounded-lg" />
                  <span>External (EXT)</span>
                  {newHasExt && <input type="number" min="1" max="100" value={newExtMax} onChange={e => setNewExtMax(e.target.value)} className="w-20 p-2 bg-background border border-border rounded-xl text-foreground text-xs text-center font-bold" />}
                </label>
              </div>
            </div>
          )}
          <button onClick={addSubject} disabled={!newName.trim() || (newType === 'practical' && !newHasInt && !newHasExt)} className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all disabled:opacity-40 shadow-xl shadow-emerald-500/20 active:scale-[0.98]">✅ Add Subject</button>
        </div>
      )}

      {showHistory ? (
        <div className="bg-card border border-border rounded-[2rem] p-8 shadow-sm">
          <h2 className="text-2xl font-black text-foreground tracking-tight mb-8 flex items-center gap-3">
            <span className="p-2 bg-muted rounded-xl">📜</span>
            Saved Predictions
          </h2>
          {loadingHistory ? <div className="text-center py-20 text-muted-foreground animate-pulse font-bold tracking-widest uppercase text-xs">Accessing Archives...</div>
            : history.length === 0 ? <div className="text-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-[2rem] font-medium italic">No saved predictions yet.</div>
              : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{history.map((h: any) => (
                <div key={h.id} onClick={() => { fillFromHistory(h); setShowHistory(false); }} className="flex items-center justify-between p-6 bg-muted/20 hover:bg-muted/50 rounded-[1.5rem] border border-border cursor-pointer transition-all group">
                  <div>
                    <span className="font-black text-foreground text-sm uppercase tracking-wider">{h.semester}</span>
                    <p className="text-muted-foreground text-[10px] font-bold mt-1 uppercase tracking-widest">{new Date(h.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    {h.target_sgpa && <div className="text-right hidden sm:block"><p className="text-[8px] text-muted-foreground font-black uppercase tracking-widest mb-1">Target</p><p className="text-xs font-bold text-foreground">{h.target_sgpa}</p></div>}
                    <div className="text-right"><p className="text-[8px] text-purple-600 dark:text-purple-400 font-black uppercase tracking-widest mb-1">Achieved</p><p className="text-2xl font-black text-purple-600 dark:text-purple-400 tracking-tighter">{h.predicted_sgpa}</p></div>
                  </div>
                </div>))}</div>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card border border-border rounded-[2.5rem] p-8 flex flex-col items-center justify-center shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500" />
              <div className="relative w-40 h-40">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" className="stroke-muted" strokeWidth="10" />
                  <circle cx="60" cy="60" r="54" fill="none" stroke={rc} strokeWidth="10" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ - dash} className="transition-all duration-1000 ease-out" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-foreground tracking-tighter">{sgpa !== null ? sgpa.toFixed(2) : '—'}</span>
                  <span className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] mt-1">SGPA</span>
                </div>
              </div>
              <p className="text-xs font-bold text-muted-foreground mt-6 uppercase tracking-widest">{sgpa !== null && sgpa >= 8 ? '🎉 Excellent!' : sgpa !== null && sgpa >= 6 ? '👍 Good Job' : sgpa !== null ? '💪 Keep Pushing' : 'Enter Marks'}</p>
            </div>

            <div className="md:col-span-2 bg-card border border-border rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-3">
                    <span className="p-2 bg-purple-500/10 rounded-xl">🔮</span>
                    What-If Analysis
                  </h2>
                  <p className="text-xs text-muted-foreground font-medium mt-1">Leave any final mark field blank to predict required score.</p>
                </div>
                <button
                  onClick={() => setWhatIfMode(!whatIfMode)}
                  className={`relative w-14 h-7 rounded-full transition-all duration-500 ${whatIfMode ? 'bg-purple-600 shadow-lg shadow-purple-600/30' : 'bg-muted border border-border'}`}
                >
                  <span className={`absolute top-1 left-1 w-5 h-5 bg-background rounded-full transition-all duration-500 shadow-sm ${whatIfMode ? 'translate-x-7 bg-white' : 'bg-muted-foreground/30'}`} />
                </button>
              </div>

              {whatIfMode ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <div className="relative group">
                    <label className="text-[10px] text-muted-foreground font-black uppercase tracking-widest block mb-2 ml-1">Target SGPA Goal</label>
                    <input type="number" min="0" max="10" step="0.01" value={targetSgpa} onChange={e => setTargetSgpa(e.target.value)} placeholder="e.g. 8.5" className="w-full p-4 bg-muted/30 border border-border rounded-2xl text-foreground font-bold text-lg focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 focus:outline-none transition-all placeholder:text-muted-foreground/20" />
                  </div>
                  {whatIfResults && whatIfResults.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {whatIfResults.map(w => (
                        <div key={w.idx} className="flex flex-col p-4 bg-muted/20 rounded-2xl border border-border hover:border-purple-500/30 transition-all group">
                          <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-2 truncate">{subjects[w.idx].name}</span>
                          <span className={`text-sm font-bold flex items-center gap-2 ${w.neededMarks === 'impossible' ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {w.neededMarks === 'impossible' ? (
                              <><span className="text-lg">⚠️</span> Impossible</>
                            ) : (
                              <><span className="text-lg">🎯</span> Need ≥ {w.neededMarks} in {w.fieldName}</>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-muted/10 rounded-2xl border border-dashed border-border">
                      <p className="text-xs text-muted-foreground font-medium">Set a target SGPA above your current projected score.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center py-10 opacity-30">
                  <div className="text-center space-y-3">
                    <div className="text-4xl">💭</div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Analysis Engine Standby</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {subjects.map((s, i) => {
              const r = results[i]; const maxTotal = s.markFields.reduce((a, f) => a + f.max, 0)
              return (
                <div key={s.id} className="bg-card border border-border rounded-3xl p-5 space-y-4 hover:shadow-lg transition-all group relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-bold text-foreground text-base truncate tracking-tight">{s.name}</h3>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border ${s.type === 'theory' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>{s.type}</span>
                        <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">{s.credits} Credits</span>
                        <div className="flex gap-1">
                          {s.markFields.map(f => <span key={f.key} className="text-[8px] px-1.5 py-0.5 bg-muted rounded-md text-muted-foreground font-black">{f.key}</span>)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {r.grade && (
                        <div className={`px-3 py-1 rounded-xl text-xs font-black border shadow-sm ${GC[r.grade]}`}>
                          {r.grade}
                        </div>
                      )}
                      <button onClick={() => deleteSubject(i)} className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all" title="Remove subject">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {s.markFields.map(f => (
                      <div key={f.key} className="relative">
                        <label className="text-[9px] text-muted-foreground font-black uppercase tracking-widest block mb-1.5 ml-1">{f.key} <span className="opacity-30">/ {f.max}</span></label>
                        <input type="number" min="0" max={f.max} value={marks[i][f.key]} onChange={e => updateMark(i, f.key, e.target.value)} placeholder="—" className="w-full p-2.5 text-center bg-muted/40 border border-border rounded-xl text-foreground font-black text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:outline-none transition-all placeholder:text-muted-foreground/20" />
                      </div>
                    ))}
                  </div>

                  {r.total !== null && (
                    <div className="flex items-center justify-between text-[11px] pt-3 border-t border-border mt-2">
                      <span className="text-muted-foreground font-medium">Aggregate: <span className="text-foreground font-black">{r.total} <span className="text-muted-foreground/30">/</span> {maxTotal}</span></span>
                      <span className="text-muted-foreground font-medium">{r.pct?.toFixed(1)}% <span className="mx-2 text-muted-foreground/20">|</span> GP: <span className="text-purple-600 dark:text-purple-400 font-black">{r.gradePoints}</span></span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="space-y-6 pt-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button onClick={handleSave} disabled={sgpa === null || saving} className="w-full sm:w-auto px-10 py-4 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl transition-all disabled:opacity-40 shadow-xl shadow-purple-600/30 active:scale-[0.98]">{saving ? 'Persisting...' : '💾 Save Prediction'}</button>
              {saveMsg && (
                <span className={`text-sm font-bold uppercase tracking-widest ${saveMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {saveMsg.type === 'ok' ? '✓ ' : '⚠ '}{saveMsg.text}
                </span>
              )}
            </div>

            <div className="pt-8 border-t border-border">
              <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                <span className="h-[1px] w-8 bg-border" /> Recent Activity <span className="h-[1px] flex-1 bg-border" />
              </h3>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground font-medium italic opacity-50">No historical data available yet. Start by saving a prediction.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {history.slice(0, 4).map((h: any) => (
                    <div key={h.id} onClick={() => fillFromHistory(h)} className="p-5 bg-card border border-border rounded-2xl cursor-pointer hover:border-purple-500/50 hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-black text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors uppercase tracking-widest">{h.semester}</span>
                        <span className="text-[16px] font-black text-purple-600 dark:text-purple-400 tracking-tighter">{h.predicted_sgpa}</span>
                      </div>
                      <p className="text-[9px] text-muted-foreground font-bold tracking-widest uppercase">{new Date(h.created_at).toLocaleDateString()}</p>
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
