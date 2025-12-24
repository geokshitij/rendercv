import json
import os
import sys
import tempfile
import subprocess
from pathlib import Path
import yaml
from google import generativeai as genai

# Add parent directory to path to import rendercv
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

def handler(request):
    """Vercel serverless function handler"""
    try:
        # Parse request body
        if request.method != 'POST':
            return {
                'statusCode': 405,
                'body': json.dumps({'error': 'Method not allowed'})
            }
        
        body = json.loads(request.body)
        job_ad = body.get('jobAd', '')
        
        if not job_ad:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Job ad is required'})
            }
        
        # Initialize Gemini
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'GEMINI_API_KEY not configured'})
            }
        
        genai.configure(api_key=api_key)
        # Using gemini-2.5-flash for best price-performance (1M token context)
        # Alternative: gemini-3-flash-preview for latest features
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Load base CV and cover letter templates
        base_dir = Path(__file__).parent.parent.parent
        cv_template_path = base_dir / 'Kshitij_Dahal_CV.yaml'
        cover_letter_template_path = base_dir / 'Kshitij_Dahal_Cover_Letter.yaml'
        
        with open(cv_template_path, 'r') as f:
            cv_yaml = yaml.safe_load(f)
        
        with open(cover_letter_template_path, 'r') as f:
            cover_letter_yaml = yaml.safe_load(f)
        
        # Create prompts for Gemini
        cv_prompt = f"""You are a professional CV tailoring expert. Given the following job advertisement and the candidate's base CV, tailor the CV to better match the job requirements.

Job Advertisement:
{job_ad}

Base CV (YAML format):
{yaml.dump(cv_yaml, default_flow_style=False)}

Instructions:
1. Keep all the original information (education, experience, skills, etc.)
2. Modify the summary section to highlight relevant experience for this job
3. Reorder or emphasize relevant skills and experiences
4. Adjust highlights in experience entries to better match job requirements
5. Keep the YAML structure intact
6. Return ONLY the modified YAML, no explanations

Return the tailored CV in YAML format:"""

        cover_letter_prompt = f"""You are a professional cover letter writer. Given the following job advertisement and the candidate's base cover letter template, write a tailored cover letter.

Job Advertisement:
{job_ad}

Base Cover Letter Template (YAML format):
{yaml.dump(cover_letter_yaml, default_flow_style=False)}

Instructions:
1. Extract the position title, company name, and key requirements from the job ad
2. Replace all placeholders like [Date], [Recipient Name], [Company Name], [Position Title], etc. with appropriate values
3. Write compelling paragraphs that connect the candidate's experience to the job requirements
4. Keep the professional tone
5. Maintain the YAML structure with the sections field
6. Return ONLY the modified YAML, no explanations

Return the tailored cover letter in YAML format:"""
        
        # Get tailored documents from Gemini
        cv_response = model.generate_content(cv_prompt)
        cover_letter_response = model.generate_content(cover_letter_prompt)
        
        # Parse responses (Gemini might wrap in markdown code blocks)
        cv_text = cv_response.text.strip()
        if '```yaml' in cv_text:
            cv_text = cv_text.split('```yaml')[1].split('```')[0].strip()
        elif '```' in cv_text:
            cv_text = cv_text.split('```')[1].split('```')[0].strip()
        
        cover_letter_text = cover_letter_response.text.strip()
        if '```yaml' in cover_letter_text:
            cover_letter_text = cover_letter_text.split('```yaml')[1].split('```')[0].strip()
        elif '```' in cover_letter_text:
            cover_letter_text = cover_letter_text.split('```')[1].split('```')[0].strip()
        
        # Create temporary directory for output
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            
            # Write tailored YAML files
            cv_output_path = tmp_path / 'tailored_cv.yaml'
            cover_letter_output_path = tmp_path / 'tailored_cover_letter.yaml'
            
            with open(cv_output_path, 'w') as f:
                f.write(cv_text)
            
            with open(cover_letter_output_path, 'w') as f:
                f.write(cover_letter_text)
            
            # Generate PDFs using RenderCV
            output_dir = tmp_path / 'output'
            output_dir.mkdir()
            
            # Render CV
            cv_result = subprocess.run(
                ['rendercv', 'render', str(cv_output_path)],
                cwd=str(tmp_path),
                capture_output=True,
                text=True
            )
            
            if cv_result.returncode != 0:
                return {
                    'statusCode': 500,
                    'body': json.dumps({
                        'error': f'Failed to generate CV: {cv_result.stderr}'
                    })
                }
            
            # Render Cover Letter
            cover_letter_result = subprocess.run(
                ['rendercv', 'render', str(cover_letter_output_path)],
                cwd=str(tmp_path),
                capture_output=True,
                text=True
            )
            
            if cover_letter_result.returncode != 0:
                return {
                    'statusCode': 500,
                    'body': json.dumps({
                        'error': f'Failed to generate cover letter: {cover_letter_result.stderr}'
                    })
                }
            
            # Find generated PDFs
            cv_pdf = None
            cover_letter_pdf = None
            
            for pdf_file in output_dir.glob('*.pdf'):
                if 'cv' in pdf_file.name.lower() or 'kshitij' in pdf_file.name.lower():
                    cv_pdf = pdf_file
                elif 'cover' in pdf_file.name.lower() or 'letter' in pdf_file.name.lower():
                    cover_letter_pdf = pdf_file
            
            if not cv_pdf or not cover_letter_pdf:
                return {
                    'statusCode': 500,
                    'body': json.dumps({'error': 'Failed to find generated PDFs'})
                }
            
            # Read PDFs and return as base64 (or save to /tmp and return URLs)
            # For Vercel, we'll return base64 encoded PDFs
            import base64
            
            with open(cv_pdf, 'rb') as f:
                cv_base64 = base64.b64encode(f.read()).decode('utf-8')
            
            with open(cover_letter_pdf, 'rb') as f:
                cover_letter_base64 = base64.b64encode(f.read()).decode('utf-8')
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'cvPdf': cv_base64,
                    'coverLetterPdf': cover_letter_base64,
                    'cvFilename': cv_pdf.name,
                    'coverLetterFilename': cover_letter_pdf.name
                })
            }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

