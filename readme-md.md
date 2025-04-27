# LinkedIn Post Generator Chrome Extension

A professional Chrome extension that leverages AI to generate high-quality LinkedIn content. This tool streamlines the post creation process, allowing users to quickly produce engaging professional posts based on simple context prompts.

## Key Features

- Conversational interface for providing post context
- AI-powered content generation with customization options
- One-click insertion directly into LinkedIn's composer
- Options to refine generated content (regenerate, reduce, elaborate)
- Cross-compatibility with LinkedIn feed and article editor
- Fallback clipboard functionality for universal compatibility

## Technical Architecture

The extension is built on a modern JavaScript stack and communicates with a remote API endpoint for content generation. It consists of:

- Popup interface for user interaction
- Content script for LinkedIn page integration
- Background networking component for API communication

## Installation Guide

### Developer Installation

1. Clone or download this repository
2. Navigate to `chrome://extensions/` in Chrome
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. Verify the extension appears in your Chrome toolbar

### User Distribution

For distribution to team members or colleagues:

1. Package the extension directory as a ZIP file
2. Share the ZIP file with intended users
3. Recipients follow the Developer Installation steps above

For public distribution, publish through the Chrome Web Store following Google's developer guidelines.

## Usage Instructions

1. Navigate to LinkedIn in Chrome
2. Click the extension icon in the toolbar
3. Enter context for your desired post in the chat interface
4. Review the generated content
5. Use modification tools if needed:
   - Regenerate: Create a completely new version
   - Reduce: Generate a more concise version
   - Elaborate: Add more detail to the current version
6. Click "Insert into LinkedIn" with the post editor open
7. Review and publish the post on LinkedIn

## API Integration

The extension connects to a dedicated backend service:
- Primary endpoint: `https://linkedin-post-generator-backend.onrender.com`
- Fallback endpoint: `http://linkedin-post-generator-backend.onrender.com`

The API provides three main functions:
- Post generation based on user context
- Post regeneration for alternative versions
- Post modification for length and detail adjustment

## Security Considerations

This extension:
- Requires minimal permissions (activeTab, clipboardWrite)
- Only activates on LinkedIn domains
- Does not collect or store user data
- Performs all AI processing on the server-side

## Troubleshooting

If direct insertion fails:
1. Ensure the LinkedIn post editor is open and focused
2. Check that you're on a supported LinkedIn page
3. Use the automatically copied clipboard content as a fallback
4. Verify your connection to LinkedIn and the generation API

## License

[Include your license information here]

## Support

For issues, feature requests, or contributions, please submit via GitHub or contact [your contact information].

---

© [Year] [Your Name/Company]. All rights reserved.