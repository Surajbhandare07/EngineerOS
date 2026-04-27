'use client'

import { ChevronRight, Home } from 'lucide-react'
import Link from 'next/link'

interface BreadcrumbItem {
  id: string | null
  name: string
}

export default function Breadcrumbs({ items, onNavigate }: { items: BreadcrumbItem[], onNavigate: (id: string | null) => void }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
      {items.map((item, idx) => (
        <div key={item.id || 'root'} className="flex items-center gap-2">
          {idx > 0 && <ChevronRight size={14} className="opacity-40" />}
          <button
            onClick={() => onNavigate(item.id)}
            className={`hover:text-foreground transition-colors font-medium ${idx === items.length - 1 ? 'text-foreground font-bold' : ''} flex items-center gap-1.5`}
          >
            {idx === 0 && <Home size={14} />}
            {item.name}
          </button>
        </div>
      ))}
    </nav>
  )
}
