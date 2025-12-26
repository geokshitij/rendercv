import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import yaml from 'js-yaml'
import archiver from 'archiver'

const execAsync = promisify(exec)

function getTodayDateString(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getFormattedDateForCoverLetter(): string {
  const today = new Date()
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`
}

export async function POST(request: NextRequest) {
  try {
    const { jobAd } = await request.json()

    if (!jobAd) {
      return NextResponse.json(
        { error: 'Job ad is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Initialize Gemini
    // Using gemini-2.5-flash for best price-performance (1M token context)
    // Alternative: gemini-3-flash-preview for latest features
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // Load base templates
    // Try multiple possible locations
    const baseDir = process.cwd()
    let cvTemplatePath = path.join(baseDir, 'Kshitij_Dahal_CV.yaml')
    let coverLetterTemplatePath = path.join(baseDir, 'Kshitij_Dahal_Cover_Letter.yaml')
    
    // If not found in current dir, try parent directory
    if (!fs.existsSync(cvTemplatePath)) {
      cvTemplatePath = path.join(baseDir, '..', 'Kshitij_Dahal_CV.yaml')
      coverLetterTemplatePath = path.join(baseDir, '..', 'Kshitij_Dahal_Cover_Letter.yaml')
    }
    
    if (!fs.existsSync(cvTemplatePath)) {
      return NextResponse.json(
        { error: 'CV template file not found. Please ensure Kshitij_Dahal_CV.yaml is in the project directory.' },
        { status: 500 }
      )
    }

    const cvYaml = yaml.load(fs.readFileSync(cvTemplatePath, 'utf8'))
    const coverLetterYaml = yaml.load(fs.readFileSync(coverLetterTemplatePath, 'utf8'))

    // Create prompts
    const cvPrompt = `You are a professional CV tailoring expert. Given the following job advertisement and the candidate's base CV, tailor the CV to better match the job requirements.

Job Advertisement:
${jobAd}

Base CV (YAML format):
${yaml.dump(cvYaml, { indent: 2 })}

Instructions:
1. Keep all the original information (education, experience, skills, etc.)
2. Modify the summary section to highlight relevant experience for this job
3. Reorder or emphasize relevant skills and experiences
4. Adjust highlights in experience entries to better match job requirements
5. Keep the YAML structure intact
6. Return ONLY the modified YAML, no explanations
7. Do not use adjectives like "proven", "expert", "skilled", "enthusiastic", etc. just use the facts and data.
8. Do not use any emojis.
9. Do not use very long sentences and keep it concise and to the point without any fillers like "specifically", "particularly", "greatly", etc.

Return the tailored CV in YAML format:`

    const coverLetterPrompt = `You are a professional cover letter writer. Given the following job advertisement and the candidate's base cover letter template, write a tailored cover letter.

Job Advertisement:
${jobAd}

Base Cover Letter Template (YAML format):
${yaml.dump(coverLetterYaml, { indent: 2 })}

Instructions:
1. Extract the position title, company name, and key requirements from the job ad
2. Replace all placeholders like [Date], [Recipient Name], [Company Name], [Position Title], etc. with appropriate values
3. Write compelling paragraphs that connect the candidate's experience to the job requirements
4. Keep the professional tone
5. Maintain the YAML structure with the sections field
6. Return ONLY the modified YAML, no explanations
7. Do not use adjectives like "proven", "expert", "skilled", "enthusiastic", etc. just use the facts and data.
8. Do not use any emojis.
9. Use active voice and use I.
10. Bold 4-5 relevant words maximum using **text** Markdown syntax. Choose the most important keywords or phrases that align with the job requirements.

Return the tailored cover letter in YAML format:`

    // Generate CV first
    const cvResult = await model.generateContent(cvPrompt)
    
    // Parse CV response
    let cvText = cvResult.response.text().trim()
    if (cvText.includes('```yaml')) {
      cvText = cvText.split('```yaml')[1].split('```')[0].trim()
    } else if (cvText.includes('```')) {
      cvText = cvText.split('```')[1].split('```')[0].trim()
    }

    // Parse the tailored CV to extract key information
    let tailoredCvYaml: any
    try {
      tailoredCvYaml = yaml.load(cvText)
    } catch (e) {
      // If parsing fails, use the text as-is
      tailoredCvYaml = cvText
    }

    // Update cover letter prompt to include the tailored CV
    const coverLetterPromptWithCv = `You are a professional cover letter writer. Given the following job advertisement, the candidate's base cover letter template, and their TAILORED CV (already customized for this job), write a tailored cover letter that references specific details from the tailored CV.

Job Advertisement:
${jobAd}

TAILORED CV (already customized for this job - use this to reference specific experiences and skills):
${yaml.dump(tailoredCvYaml, { indent: 2 })}

Base Cover Letter Template (YAML format):
${yaml.dump(coverLetterYaml, { indent: 2 })}

Instructions:
1. Extract the position title, company name, and key requirements from the job ad
2. Replace all placeholders like [Date], [Recipient Name], [Company Name], [Position Title], etc. with appropriate values
3. Reference specific experiences, skills, or achievements from the TAILORED CV above to make the cover letter more compelling
4. Ensure the cover letter aligns with what's highlighted in the tailored CV
5. Write compelling paragraphs that connect the candidate's experience (from the tailored CV) to the job requirements
6. Keep the professional tone
7. Maintain the YAML structure with the sections field
8. Return ONLY the modified YAML, no explanations
9. Do not use adjectives like "proven", "expert", "skilled", "enthusiastic", etc. just use the facts and data.
10. Do not use any emojis.
11. Bold 5-6 relevant words maximum using **text** Markdown syntax. Choose the most important keywords or phrases that align with the job requirements.
12. Do not repeat the same information from the tailored CV.

Return the tailored cover letter in YAML format:`

    // Generate cover letter using the tailored CV
    const coverLetterResult = await model.generateContent(coverLetterPromptWithCv)

    // Parse cover letter response
    let coverLetterText = coverLetterResult.response.text().trim()
    if (coverLetterText.includes('```yaml')) {
      coverLetterText = coverLetterText.split('```yaml')[1].split('```')[0].trim()
    } else if (coverLetterText.includes('```')) {
      coverLetterText = coverLetterText.split('```')[1].split('```')[0].trim()
    }

    // Programmatically set dates (don't trust AI)
    const todayDate = getTodayDateString()
    const formattedDate = getFormattedDateForCoverLetter()
    console.log('Setting current_date to:', todayDate)
    
    // Update CV YAML to set current_date
    try {
      const cvYamlParsed = yaml.load(cvText) as any
      if (cvYamlParsed && typeof cvYamlParsed === 'object') {
        if (!cvYamlParsed.settings) {
          cvYamlParsed.settings = {}
        }
        // Always overwrite current_date with today's date
        cvYamlParsed.settings.current_date = todayDate
        cvText = yaml.dump(cvYamlParsed, { indent: 2 })
        console.log('CV date updated successfully')
      }
    } catch (e) {
      // If parsing fails, continue with original text
      console.log('Could not update CV date:', e)
    }
    
    // Update cover letter YAML to set current_date and replace [Date] placeholder
    try {
      const coverLetterYamlParsed = yaml.load(coverLetterText) as any
      if (coverLetterYamlParsed && typeof coverLetterYamlParsed === 'object') {
        // Set current_date - always overwrite with today's date
        if (!coverLetterYamlParsed.settings) {
          coverLetterYamlParsed.settings = {}
        }
        coverLetterYamlParsed.settings.current_date = todayDate
        
        // Replace [Date] placeholder in content
        if (coverLetterYamlParsed.cv?.sections?.['']) {
          coverLetterYamlParsed.cv.sections[''] = coverLetterYamlParsed.cv.sections[''].map(
            (line: string) => {
              if (typeof line === 'string' && line.trim() === '[Date]') {
                return formattedDate
              }
              return line
            }
          )
        }
        
        coverLetterText = yaml.dump(coverLetterYamlParsed, { indent: 2 })
        console.log('Cover letter date updated successfully, formatted date:', formattedDate)
      }
    } catch (e) {
      // If parsing fails, continue with original text
      console.log('Could not update cover letter date:', e)
    }

    // Create temporary files
    const tmpDir = path.join('/tmp', `rendercv-${Date.now()}`)
    fs.mkdirSync(tmpDir, { recursive: true })
    
    const cvOutputPath = path.join(tmpDir, 'tailored_cv.yaml')
    const coverLetterOutputPath = path.join(tmpDir, 'tailored_cover_letter.yaml')

    // Validate YAML before writing
    try {
      yaml.load(cvText)
    } catch (yamlError: any) {
      return NextResponse.json(
        { 
          error: `Invalid YAML in tailored CV: ${yamlError.message}`,
          debug: { cvText: cvText.substring(0, 500) } // First 500 chars for debugging
        },
        { status: 500 }
      )
    }
    
    try {
      yaml.load(coverLetterText)
    } catch (yamlError: any) {
      return NextResponse.json(
        { 
          error: `Invalid YAML in tailored cover letter: ${yamlError.message}`,
          debug: { coverLetterText: coverLetterText.substring(0, 500) }
        },
        { status: 500 }
      )
    }

    fs.writeFileSync(cvOutputPath, cvText)
    fs.writeFileSync(coverLetterOutputPath, coverLetterText)

    // Generate PDFs using RenderCV
    // Note: This requires rendercv to be installed and accessible
    // For Vercel, you may need to use a different approach or external service
    
    const env = {
      ...process.env,
      PYTHONPATH: process.env.PYTHONPATH || '',
      PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
    }

    // Try to find rendercv command
    let rendercvCommand = 'rendercv'
    
    // Render CV
    let cvRenderSuccess = false
    let cvRenderError: any = null
    let cvRenderOutput = ''
    let cvRenderStderr = ''
    
    try {
      const cvCommand = `cd ${tmpDir} && ${rendercvCommand} render "${cvOutputPath}"`
      const result = await execAsync(cvCommand, { 
        env, 
        cwd: tmpDir,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      })
      console.log('CV render stdout:', result.stdout)
      cvRenderOutput = result.stdout || ''
      cvRenderStderr = result.stderr || ''
      if (result.stderr) {
        console.log('CV render stderr:', result.stderr)
      }
      cvRenderSuccess = true
    } catch (error: any) {
      console.log('CV render error, trying Python module:', error.message)
      cvRenderStderr = error.stderr || error.message || ''
      console.log('CV render error stderr:', cvRenderStderr)
      cvRenderError = error
      // Fallback: try using python module directly
      try {
        const pythonCommand = `cd ${tmpDir} && python -m rendercv.cli.entry_point render "${cvOutputPath}"`
        const result = await execAsync(pythonCommand, { 
          env, 
          cwd: tmpDir,
          maxBuffer: 10 * 1024 * 1024,
        })
        console.log('CV render (Python) stdout:', result.stdout)
        cvRenderOutput = result.stdout || ''
        cvRenderStderr = result.stderr || ''
        if (result.stderr) {
          console.log('CV render (Python) stderr:', result.stderr)
        }
        cvRenderSuccess = true
        cvRenderError = null
      } catch (pythonError: any) {
        cvRenderError = pythonError
        cvRenderStderr = pythonError.stderr || pythonError.message || ''
        if (pythonError.stderr) {
          console.log('CV render (Python) error stderr:', pythonError.stderr)
        }
        // Don't throw yet - check if PDF was created anyway
      }
    }

    // Render Cover Letter
    let coverLetterRenderError: any = null
    try {
      const coverLetterCommand = `cd ${tmpDir} && ${rendercvCommand} render "${coverLetterOutputPath}"`
      const result = await execAsync(coverLetterCommand, { 
        env, 
        cwd: tmpDir,
        maxBuffer: 10 * 1024 * 1024,
      })
      console.log('Cover letter render stdout:', result.stdout)
    } catch (error: any) {
      console.log('Cover letter render error, trying Python module:', error.message)
      coverLetterRenderError = error
      // Fallback: try using python module directly
      try {
        const pythonCommand = `cd ${tmpDir} && python -m rendercv.cli.entry_point render "${coverLetterOutputPath}"`
        const result = await execAsync(pythonCommand, { 
          env, 
          cwd: tmpDir,
          maxBuffer: 10 * 1024 * 1024,
        })
        console.log('Cover letter render (Python) stdout:', result.stdout)
        coverLetterRenderError = null
      } catch (pythonError: any) {
        coverLetterRenderError = pythonError
        throw new Error(`Failed to render cover letter: ${pythonError.message}`)
      }
    }

    // RenderCV outputs to 'rendercv_output' directory relative to the YAML file location
    const rendercvOutputDir = path.join(tmpDir, 'rendercv_output')
    
    // Check if rendercv_output directory exists
    if (!fs.existsSync(rendercvOutputDir)) {
      // List all files in tmpDir for debugging
      const allFiles = fs.readdirSync(tmpDir, { recursive: true })
      const errorMsg = `RenderCV output directory not found. CV rendering ${cvRenderSuccess ? 'succeeded' : 'failed'}.`
      return NextResponse.json(
        { 
          error: errorMsg,
          cvRenderError: cvRenderStderr || cvRenderError?.message,
          debug: { tmpDir, rendercvOutputDir, allFiles, cvRenderOutput, cvRenderStderr }
        },
        { status: 500 }
      )
    }

    // Find generated PDFs - RenderCV names them based on the CV name in the YAML
    const outputFiles = fs.readdirSync(rendercvOutputDir)
    const pdfFiles = outputFiles.filter(f => f.endsWith('.pdf'))
    
    // Try to find CV and cover letter PDFs
    // CV might be named like "Kshitij_Dahal_CV.pdf" or similar
    // Cover letter might be named like "Kshitij_Dahal_Cover_Letter.pdf" or similar
    // More flexible matching: CV should NOT contain "cover" or "letter"
    const cvPdf = pdfFiles.find(f => {
      const lower = f.toLowerCase()
      return !lower.includes('cover') && !lower.includes('letter')
    })
    
    const coverLetterPdf = pdfFiles.find(f => {
      const lower = f.toLowerCase()
      return lower.includes('cover') || lower.includes('letter')
    })

    // Check if CV PDF was generated
    if (!cvPdf) {
      // Check if there are any other files that might give us clues
      const typFiles = outputFiles.filter(f => f.endsWith('.typ'))
      const mdFiles = outputFiles.filter(f => f.endsWith('.md'))
      const htmlFiles = outputFiles.filter(f => f.endsWith('.html'))
      
      const errorDetails: any = {
        rendercvOutputDir,
        pdfFiles,
        typFiles,
        mdFiles,
        htmlFiles,
        allFiles: outputFiles,
        cvRenderSuccess,
        cvRenderOutput,
        cvRenderStderr
      }
      
      // If CV rendering failed, include the error
      if (cvRenderError || !cvRenderSuccess) {
        errorDetails.cvRenderError = cvRenderStderr || cvRenderError?.message || 'CV rendering failed'
      }
      
      return NextResponse.json(
        { 
          error: `CV PDF not found. Only found cover letter PDF: ${coverLetterPdf || 'none'}. This suggests the CV rendering failed. Found PDFs: ${JSON.stringify(pdfFiles)}`,
          details: errorDetails
        },
        { status: 500 }
      )
    }
    
    if (!coverLetterPdf) {
      return NextResponse.json(
        { 
          error: `Cover letter PDF not found. Found PDFs: ${JSON.stringify(pdfFiles)}`,
          debug: { rendercvOutputDir, pdfFiles, cvPdf, coverLetterPdf, allFiles: outputFiles }
        },
        { status: 500 }
      )
    }

    // Read PDFs
    const cvPdfPath = path.join(rendercvOutputDir, cvPdf)
    const coverLetterPdfPath = path.join(rendercvOutputDir, coverLetterPdf)

    const cvPdfBuffer = fs.readFileSync(cvPdfPath)
    const coverLetterPdfBuffer = fs.readFileSync(coverLetterPdfPath)

    // Create zip file with renamed PDFs
    const zipPath = path.join(tmpDir, 'documents.zip')
    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      archive.on('error', (err) => reject(err))
      output.on('close', () => {
        const buffer = fs.readFileSync(zipPath)
        resolve(buffer)
      })

      archive.pipe(output)
      archive.append(cvPdfBuffer, { name: 'Resume.pdf' })
      archive.append(coverLetterPdfBuffer, { name: 'Cover Letter.pdf' })
      archive.finalize()
    })

    // Return both individual PDFs and zip
    return NextResponse.json({
      cvPdf: cvPdfBuffer.toString('base64'),
      coverLetterPdf: coverLetterPdfBuffer.toString('base64'),
      zipFile: zipBuffer.toString('base64'),
      cvFilename: 'Resume.pdf',
      coverLetterFilename: 'Cover Letter.pdf',
      zipFilename: 'Resume_and_Cover_Letter.zip',
    })
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    )
  }
}

