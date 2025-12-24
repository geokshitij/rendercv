import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import yaml from 'js-yaml'
import archiver from 'archiver'

const execAsync = promisify(exec)

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

Return the tailored cover letter in YAML format:`

    // Get tailored documents from Gemini
    const [cvResult, coverLetterResult] = await Promise.all([
      model.generateContent(cvPrompt),
      model.generateContent(coverLetterPrompt),
    ])

    // Parse responses
    let cvText = cvResult.response.text().trim()
    if (cvText.includes('```yaml')) {
      cvText = cvText.split('```yaml')[1].split('```')[0].trim()
    } else if (cvText.includes('```')) {
      cvText = cvText.split('```')[1].split('```')[0].trim()
    }

    let coverLetterText = coverLetterResult.response.text().trim()
    if (coverLetterText.includes('```yaml')) {
      coverLetterText = coverLetterText.split('```yaml')[1].split('```')[0].trim()
    } else if (coverLetterText.includes('```')) {
      coverLetterText = coverLetterText.split('```')[1].split('```')[0].trim()
    }

    // Create temporary files
    const tmpDir = path.join('/tmp', `rendercv-${Date.now()}`)
    fs.mkdirSync(tmpDir, { recursive: true })
    
    const cvOutputPath = path.join(tmpDir, 'tailored_cv.yaml')
    const coverLetterOutputPath = path.join(tmpDir, 'tailored_cover_letter.yaml')

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
    let cvRenderError: any = null
    try {
      const cvCommand = `cd ${tmpDir} && ${rendercvCommand} render "${cvOutputPath}"`
      const result = await execAsync(cvCommand, { 
        env, 
        cwd: tmpDir,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      })
      console.log('CV render stdout:', result.stdout)
    } catch (error: any) {
      console.log('CV render error, trying Python module:', error.message)
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
        cvRenderError = null
      } catch (pythonError: any) {
        cvRenderError = pythonError
        throw new Error(`Failed to render CV: ${pythonError.message}`)
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
      return NextResponse.json(
        { 
          error: `RenderCV output directory not found. Files in tmpDir: ${JSON.stringify(allFiles)}`,
          debug: { tmpDir, rendercvOutputDir, allFiles }
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
    const cvPdf = pdfFiles.find(f => 
      (f.toLowerCase().includes('cv') && !f.toLowerCase().includes('cover')) ||
      (f.toLowerCase().includes('kshitij') && !f.toLowerCase().includes('cover'))
    )
    
    const coverLetterPdf = pdfFiles.find(f => 
      f.toLowerCase().includes('cover') || 
      f.toLowerCase().includes('letter')
    )

    if (!cvPdf || !coverLetterPdf) {
      return NextResponse.json(
        { 
          error: `Failed to find generated PDFs. Found PDFs: ${JSON.stringify(pdfFiles)}`,
          debug: { rendercvOutputDir, pdfFiles, cvPdf, coverLetterPdf }
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

