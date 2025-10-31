// src/components/ResumeUpload.tsx
import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function ResumeUpload({ jobId = null }: { jobId?: string | null }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null)
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return alert('Please choose a file')
    setLoading(true); setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const ext = file.name.split('.').pop()
      const filePath = `${user.id}/resume-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file, { cacheControl: '3600', upsert: false })

      if (uploadError) throw uploadError

      // public url (works for public bucket). If private, generate signed URL on demand.
      const { data } = supabase.storage.from('resumes').getPublicUrl(filePath)
      const publicUrl = data.publicUrl

      const { error: dbError } = await supabase.from('applications').insert([{
        user_id: user.id,
        job_id: jobId,
        resume_path: filePath,
        resume_public_url: publicUrl
      }])
      if (dbError) throw dbError

      alert('Resume uploaded successfully!')
    } catch (err: any) {
      setError(err.message ?? String(err))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleUpload} className="resume-upload">
      <input type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} />
      <button type="submit" disabled={loading}>{loading ? 'Uploading...' : 'Upload Resume'}</button>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </form>
  )
}
