'use client'

import { useState } from 'react'

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}

export default function Home() {
  // Get today's date in YYYY-MM-DD format for the date input
  const getTodayDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [jobAd, setJobAd] = useState('')
  const [date, setDate] = useState(getTodayDate())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [cvUrl, setCvUrl] = useState('')
  const [coverLetterUrl, setCoverLetterUrl] = useState('')
  const [zipUrl, setZipUrl] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)
    setCvUrl('')
    setCoverLetterUrl('')

    try {
      const response = await fetch('/api/tailor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobAd, date }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to tailor documents')
      }

      const data = await response.json()
      
      // Create blob URLs from base64 PDFs
      const cvBlob = base64ToBlob(data.cvPdf, 'application/pdf')
      const coverLetterBlob = base64ToBlob(data.coverLetterPdf, 'application/pdf')
      const zipBlob = base64ToBlob(data.zipFile, 'application/zip')
      
      const cvBlobUrl = URL.createObjectURL(cvBlob)
      const coverLetterBlobUrl = URL.createObjectURL(coverLetterBlob)
      const zipBlobUrl = URL.createObjectURL(zipBlob)
      
      setCvUrl(cvBlobUrl)
      setCoverLetterUrl(coverLetterBlobUrl)
      setZipUrl(zipBlobUrl)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>CareerCraft</h1>
      <p style={{ color: '#000000', marginBottom: '2rem', fontStyle: 'italic' }}>
        "Success is where preparation and opportunity meet." — Bobby Unser
      </p>
      <p style={{ color: '#000000', marginBottom: '2rem' }}>
        Paste a job ad below, and we'll tailor your resume and cover letter using AI.
      </p>

      <form onSubmit={handleSubmit}>
        <h2>Job Advertisement</h2>
        <textarea
          value={jobAd}
          onChange={(e) => setJobAd(e.target.value)}
          placeholder="Paste the job advertisement here..."
          required
        />

        <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
          <label htmlFor="date-input" style={{ display: 'block', marginBottom: '0.5rem', color: '#000000', fontWeight: 'bold' }}>
            Date (for cover letter):
          </label>
          <input
            id="date-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #000000',
              fontSize: '1rem',
              fontFamily: "'Times New Roman', Times, serif",
              background: '#ffffff',
              color: '#000000',
              cursor: 'pointer'
            }}
          />
        </div>

        <button type="submit" disabled={loading || !jobAd.trim()}>
          {loading ? 'Tailoring your documents...' : 'Tailor Resume & Cover Letter'}
        </button>
      </form>

      {loading && (
        <div className="loading">
          <p>Processing with AI... This may take a minute.</p>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {success && (
        <div className="success">
          <p>Your tailored documents are ready!</p>
          <div className="download-links">
            {zipUrl && (
              <a 
                href={zipUrl} 
                download="Resume_and_Cover_Letter.zip" 
                className="download-link"
                style={{ background: '#000000', fontSize: '1rem', padding: '0.5rem 1rem' }}
                onClick={() => {
                  // Clean up blob URLs after download
                  setTimeout(() => {
                    URL.revokeObjectURL(zipUrl)
                    URL.revokeObjectURL(cvUrl)
                    URL.revokeObjectURL(coverLetterUrl)
                  }, 100)
                }}
              >
                Download Both (ZIP)
              </a>
            )}
            {cvUrl && (
              <a 
                href={cvUrl} 
                download="Resume.pdf" 
                className="download-link"
                onClick={() => {
                  // Clean up blob URL after download
                  setTimeout(() => URL.revokeObjectURL(cvUrl), 100)
                }}
              >
                Download Resume
              </a>
            )}
            {coverLetterUrl && (
              <a 
                href={coverLetterUrl} 
                download="Cover Letter.pdf" 
                className="download-link"
                onClick={() => {
                  // Clean up blob URL after download
                  setTimeout(() => URL.revokeObjectURL(coverLetterUrl), 100)
                }}
              >
                Download Cover Letter
              </a>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #000000', textAlign: 'center', color: '#000000', fontSize: '0.9rem' }}>
        Developed by Kshitij Dahal
      </div>
    </div>
  )
}

