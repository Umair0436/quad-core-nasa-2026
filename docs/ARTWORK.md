# LUNA-01 opening page artwork

Generated with the built-in image generation tool. Both images are copied into the project and used by the opening page.

## Saved assets

- `frontend/public/images/kid-astronauts.png`
- `frontend/public/images/moon-launch.png`

## Character prompt

Use case: stylized-concept. Asset type: character selection sprite strip for LUNA-01, a browser space adventure for children ages 7–12. Create ONE wide landscape image on a genuinely TRANSPARENT background containing exactly FOUR separate full-body child astronauts in a single horizontal row, equally spaced and centered in four identical-width columns. Every character completely visible from helmet to boots, with generous transparent space separating them; no overlapping silhouettes. Order left to right: 1) a smiling girl age 9 with medium brown skin, curly dark brown hair in two small puffs visible inside a clear large round helmet, lavender PURPLE spacesuit; 2) a smiling boy age 10 with light brown skin, short wavy dark hair, clear helmet, saturated cobalt BLUE spacesuit; 3) a smiling girl age 8 with warm fair skin, freckles and red hair in short braids inside clear helmet, warm ORANGE spacesuit; 4) a smiling boy age 11 with dark brown skin, short textured black hair, clear helmet, bright TEAL GREEN spacesuit. They must unmistakably look like kids aged 7 to 12, with youthful faces, short child proportions and slightly oversized helmets, not adults. All wearing detailed but charming padded astronaut uniforms with white gloves and boots, small chest life-support controls, small backpacks, and visible faces. Same scale, consistent framing, all facing camera in friendly adventurous poses; each child fills about 80 percent of their column's height. Polished stylized 3D animated adventure game character art, beautifully rendered tactile fabric and soft rounded forms, cinematic soft studio lighting, subtle violet rim light, lovable expressive faces, high quality. No text, no names, no background, no floor, no rectangular panels, no watermark. Keep transparency between and around all four astronauts. Final composition very wide about 3:1 so the four can be displayed independently by cropping equal-width quarters in CSS.

## Background prompt

Use case: stylized-concept. Asset type: BACKGROUND ART ONLY for the opening character-selection page of a children's Moon adventure game, no interface or text. Wide cinematic 16:9 space scene, enchanting and immersive, sophisticated stylized 3D game environment. View from the Moon at night: a softly illuminated curved lunar horizon occupies only the bottom 20 percent of the frame with detailed cool gray-violet craters and distant rounded mountains; a small lunar habitat with tiny warm windows is tucked far bottom left, a very small distant rocket on far bottom right. Above is deep midnight blue and indigo outer space with many tiny delicate stars and very faint atmospheric-looking violet interstellar dust, not a busy colorful nebula. A beautifully rendered luminous blue Earth with visible continents and white cloud swirls sits in the upper right corner around x88 percent y24 percent, about 12 percent of image width. A subtle pale sun glow at far left horizon. Keep the broad CENTER of the frame DARK and mostly EMPTY so white headlines and four foreground character cards remain legible over it. Soft lavender moonlight, sapphire Earth light, a sense of wonder and exploration for kids age 7–12. High quality art direction, tactile stylized lunar surface, cinematic depth, beautiful clean lighting, restrained navy/purple palette. No people, no astronauts, no lettering, no typography, no logos, no UI, no borders, no watermark.


## Moon outpost map

Generated with the built-in image generation tool.

Saved asset: `frontend/public/images/moon-outpost.png`

### Final generation prompt

Use case: stylized-concept. Asset type: interactive illustrated Moon outpost map for LUNA-01, an adventure game for children ages 7–12. Create a polished wide 16:9 stylized 3D animated game environment seen from an elevated three-quarter isometric camera, a cozy small lunar outpost with THREE DISTINCT main buildings on a beautiful pale violet-gray cratered Moon plain. Layout matters for HTML clickable labels: LEFT area centered x24 percent y52 percent: a rounded white cylindrical HABITAT with cyan-lit windows, a small air tank and life-support pipes, friendly warm interior light. TOP RIGHT area centered x71 percent y38 percent: a low sturdy rounded STORM SHELTER partly covered in protective regolith mounds, warm amber doorway, small antenna. BOTTOM RIGHT area centered x70 percent y72 percent: a clear glass geodesic GREENHOUSE dome with visible lush small green plants and white base. Narrow illuminated paths connect the three. Small dark blue solar arrays near center bottom, a small rover parked off to the far left. No other major buildings. Show the WHOLE three-building base with clear gaps, not cropped. Background upper 18 percent is a deep navy starry space sky with a SMALL beautiful blue Earth near top right. Wholesome high quality art direction: toy-like rounded engineering modules, tactile detailed surfaces, cinematic lavender lunar rim light, cyan and gold navigation lights, charming aspirational real-space aesthetic. Main buildings are large and clearly readable, leave a little clean space just above each building to place a UI label in code. Detailed lunar rocks and craters around the edges, central area uncluttered. Consistent with a children's astronaut adventure game, not photoreal, not pixel art, not low-poly cubes. NO people, NO characters, NO astronauts, NO TEXT OR LETTERS, no labels, no UI, no watermark.

## Playable 3D scene

The active outpost uses code-created Three.js meshes and procedural textures for the lunar terrain, buildings, Earth, and animated astronauts. The selected character determines the suit and helmet color, skin tone, and hairstyle. The generated map above remains the fallback when WebGL is unavailable.
