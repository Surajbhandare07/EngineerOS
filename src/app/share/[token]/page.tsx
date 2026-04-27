import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { FileText, Download, Shield } from 'lucide-react'

export default async function SharePage({ params }: { params: { token: string } }) {
  const { token } = await params
  const supabase = await createClient()

  // Fetch document by share_token
  const { data: doc, error } = await supabase
    .from('documents')
    .select('*, profiles(full_name)')
    .eq('share_token', token)
    .eq('is_public', true)
    .single()

  if (error || !doc) {
    notFound()
  }

  // Generate a temporary signed URL for the document
  const { data: urlData } = await supabase.storage
    .from('user_documents')
    .createSignedUrl(doc.storage_path, 3600) // 1 hour link

  if (!urlData?.signedUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="text-center space-y-4">
          <Shield className="mx-auto text-destructive" size={48} />
          <h1 className="text-2xl font-black italic tracking-tighter">Access <span className="text-destructive">Denied</span></h1>
          <p className="text-sm text-muted-foreground font-medium">This asset is no longer available or the link has expired.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <header className="h-20 bg-card border-b border-border/50 px-8 flex items-center justify-between backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <FileText className="text-primary" size={24} />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-base font-bold truncate max-w-[300px]">{doc.filename}</h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60">
              Shared by {doc.profiles?.full_name || 'Engineer User'}
            </p>
          </div>
        </div>

        <a 
          href={urlData.signedUrl} 
          download={doc.filename}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all active:scale-95"
        >
          <Download size={16} />
          Download Asset
        </a>
      </header>

      {/* Preview Area */}
      <main className="flex-1 p-8 flex items-center justify-center">
        <div className="w-full max-w-5xl h-[calc(100vh-12rem)] bg-card border border-border/50 rounded-[2.5rem] shadow-2xl overflow-hidden relative">
          <iframe 
            src={urlData.signedUrl} 
            className="w-full h-full border-none"
            title={doc.filename}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-40">
        Secured by EngineerOS Intelligence Protocols
      </footer>
    </div>
  )
}
