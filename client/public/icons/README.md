# Install icons

Generated with the built-in imagegen tool. Source: `app-icon-source.png`.
PNG exports: 192px and 512px app icons, 512px maskable icon, 180px Apple touch icon, and 32px favicon. The full-bleed background allows the OS to apply its own icon shape. Keep the crown within the central maskable safe circle.

Prompt:

> Use case: logo-brand. Asset type: square installed PWA app icon for Trivia Clash, a colorful illustrated mobile trivia duel game. Create one polished, friendly golden three-point crown with red, green and blue jewel tips, a simple bold silhouette, thick softly shaded edges, subtle dimensional cartoon-game highlights. Center it on a rich indigo-to-purple full-bleed opaque background with a gentle radial glow. Match a playful illustrated game aesthetic. Crown and all essential details must fit entirely within the central circle of radius 36% of the square, leaving ample solid background around it for Android maskable cropping. Render a flat square image filling the entire canvas, no rounded outer corners, no icon mockup, no phone, no border, no text, no letters, no watermark. Recognizable at very small sizes.

The `*-crown-v1.png` files are byte-identical exports with fresh URLs for install metadata and notification artwork. HTML, manifest, install guidance, and the service worker use these names; older exports remain for older open tabs. The root `apple-touch-icon.png` provides the conventional Apple fallback. When replacing artwork, publish new versioned filenames and bump the worker cache. iOS may retain artwork for an existing installation; remove that Home Screen app and install again, then select the existing profile and re-enable notifications.
