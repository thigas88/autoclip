import os
import sys
import glob
import re
import time
from google import genai

# Check for API key
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("Error: Please set the GEMINI_API_KEY environment variable.")
    print("Example: GEMINI_API_KEY='your-key' python translate_frontend.py")
    sys.exit(1)

client = genai.Client(api_key=api_key)

def has_chinese(text):
    return bool(re.search(r'[\u4e00-\u9fff]', text))

def translate_file(filepath):
    print(f"Processing {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if not has_chinese(content):
        print(f"Skipping {filepath} - no Chinese text found.")
        return False

    prompt = f"""
You are an expert frontend developer and translator.
Translate all Chinese text in the following React/TypeScript/CSS file into Portuguese.
Keep all code syntax, variable names, and formatting EXACTLY the same. Only translate the Chinese strings/comments.
Do NOT wrap the output in markdown code blocks. Output ONLY the raw file content, so it can be safely written to the file.

File content:
{content}
"""
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        
        translated_content = response.text
        # Clean up markdown code blocks if the model ignored the instruction
        if translated_content.startswith("```"):
            lines = translated_content.split('\n')
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            translated_content = '\n'.join(lines)
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(translated_content)
        print(f"Successfully translated {filepath}")
        return True
    except Exception as e:
        print(f"Error translating {filepath}: {e}")
        return False

def main():
    # Find all relevant files in frontend/src
    extensions = ['*.tsx', '*.ts', '*.jsx', '*.js', '*.css']
    files_to_process = []
    
    for ext in extensions:
        files_to_process.extend(glob.glob(f"frontend/src/**/{ext}", recursive=True))
        
    print(f"Found {len(files_to_process)} files to check.")
    
    translated_count = 0
    for filepath in files_to_process:
        if translate_file(filepath):
            translated_count += 1
            # Sleep to avoid rate limits
            time.sleep(2)
            
    print(f"\nDone! Translated {translated_count} files.")

if __name__ == "__main__":
    main()
