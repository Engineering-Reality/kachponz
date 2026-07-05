import os
import re

html_files = [
    'index.html',
    'agents.html',
    'tools.html',
    'agent-creator.html',
    'agent-invoke-stream.html',
    'system-config.html',
    'chat-recommendation.html'
]

# Regex patterns
style_pattern = re.compile(r'<style>.*?</style>', re.DOTALL)
three_script_pattern = re.compile(r'<script>\s*// --- THREE\.JS.*?initThreeBg\(\);.*?(\s*)</script>', re.DOTALL)
index_three_pattern = re.compile(r'<script>\s*const initThree\s*=\s*\(\)\s*=>\s*\{.*?(// Scroll Animation Observer.*?)\s*initThree\(\);\s*</script>', re.DOTALL)

for file in html_files:
    if not os.path.exists(file):
        print(f"Skipping {file} - not found")
        continue
    
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace inline CSS
    content = style_pattern.sub('<link href="css/styles.css" rel="stylesheet">', content)
    
    # Replace inline Three.js
    if file == 'index.html':
        match = index_three_pattern.search(content)
        if match:
            observer_code = match.group(1)
            new_script = f'''<script src="js/tesseract-bg.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {{
            initTesseractBackground('canvas-container', {{ showParticles: true, scale: 5 }});
        }});

        {observer_code}
    </script>'''
            content = index_three_pattern.sub(new_script, content)
        else:
            print(f"Could not match index pattern in {file}")
    else:
        # For other pages, the script is usually at the bottom containing initThreeBg
        # Let's use a generic regex for `<script> ... THREE.JS ... </script>`
        general_three = re.compile(r'<script>\s*(?:// --- THREE\.JS.*?|const initThreeBg = \(\) => \{.*?)\s*(initThreeBg\(\);)?\s*</script>', re.DOTALL)
        
        match = general_three.search(content)
        if match:
            # Determine canvas id based on file content. usually 'canvas-bg'
            canvas_id = 'canvas-bg'
            if 'canvas-container' in content:
                canvas_id = 'canvas-container'
                
            new_script = f'''<script src="js/tesseract-bg.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {{
            initTesseractBackground('{canvas_id}', {{ dimmer: true, scale: 3, cameraZ: 40 }});
        }});
    </script>'''
            content = general_three.sub(new_script, content)
        else:
            print(f"Could not match Three.js script in {file}")

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Refactored {file}")
