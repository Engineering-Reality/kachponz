import re

# index.html
with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Three.js block
content = re.sub(r'// --- THREE\.JS.*?initThree\(\);', 
'''// --- TESSERACT BACKGROUND ---
        document.addEventListener('DOMContentLoaded', () => {
            initTesseractBackground('canvas-container', { showParticles: true, scale: 5 });
        });''', content, flags=re.DOTALL)

# Insert the script tag for tesseract-bg.js right before the inline script
if 'js/tesseract-bg.js' not in content:
    content = content.replace('<script src="js/feature-sharing.js"></script>', '<script src="js/feature-sharing.js"></script>\n    <script src="js/tesseract-bg.js"></script>')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

# system-config.html
with open('system-config.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'// --- THREE\.JS.*?initThree\(\);',
'''// --- TESSERACT BACKGROUND ---
        document.addEventListener('DOMContentLoaded', () => {
            initTesseractBackground('canvas-bg', { dimmer: true, scale: 3, cameraZ: 40 });
        });''', content, flags=re.DOTALL)

if 'js/tesseract-bg.js' not in content:
    content = content.replace('<script src="js/system-config.js"></script>', '<script src="js/system-config.js"></script>\n    <script src="js/tesseract-bg.js"></script>')

with open('system-config.html', 'w', encoding='utf-8') as f:
    f.write(content)

# chat-recommendation.html
# Need to check if there is three js in chat-recommendation.html
with open('chat-recommendation.html', 'r', encoding='utf-8') as f:
    content = f.read()

if 'canvas-bg' in content:
    content = re.sub(r'// --- THREE\.JS.*?initThreeBg\(\);',
'''// --- TESSERACT BACKGROUND ---
        document.addEventListener('DOMContentLoaded', () => {
            initTesseractBackground('canvas-bg', { dimmer: true, scale: 3, cameraZ: 40 });
        });''', content, flags=re.DOTALL)
    
    # check if initThreeBg was used or maybe something else
    content = re.sub(r'// --- THREE\.JS.*?initThree\(\);',
'''// --- TESSERACT BACKGROUND ---
        document.addEventListener('DOMContentLoaded', () => {
            initTesseractBackground('canvas-bg', { dimmer: true, scale: 3, cameraZ: 40 });
        });''', content, flags=re.DOTALL)
        
    if 'js/tesseract-bg.js' not in content:
        # just put it before the last script tag
        content = content.replace('<script>\n', '<script src="js/tesseract-bg.js"></script>\n    <script>\n')

with open('chat-recommendation.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done index, system-config, chat-recommendation")
