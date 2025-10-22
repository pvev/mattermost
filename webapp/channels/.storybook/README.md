# Mattermost Webapp Storybook Configuration

This directory contains the Storybook configuration for the Mattermost webapp.

## Configuration Files

### `main.ts`
Main Storybook configuration that defines:
- Story file patterns
- Addons (essentials, interactions, a11y, mdx-gfm)
- Vite builder configuration
- Webpack aliases mirrored from the main webpack config
- SCSS preprocessor settings

### `preview.tsx`
Global decorators and parameters:
- Redux Provider with a mock store
- IntlProvider for i18n support
- React Router for navigation
- Global styles and theme configuration

## Running Storybook

```bash
# Development mode
npm run storybook

# Build static Storybook
npm run build-storybook
```

The Storybook will be available at `http://localhost:6006`

## MCP Integration (Optional)

To enable Claude Code integration via MCP:

1. Ensure Storybook is running (`npm run storybook`)
2. Add the Storybook MCP server:
   ```bash
   claude mcp add storybook-mcp --transport http http://localhost:6006/mcp --scope project
   ```
3. Claude Code can now interact with your Storybook components

## Addons Enabled

- **@storybook/addon-essentials**: Includes Controls, Actions, Viewport, Backgrounds, Toolbars, and Docs
- **@storybook/addon-interactions**: Test user interactions
- **@storybook/addon-a11y**: Accessibility testing
- **@storybook/addon-mdx-gfm**: MDX support with GitHub Flavored Markdown

## Writing Stories

Stories are located in:
- `/stories/**/*.stories.@(js|jsx|ts|tsx)` - Organized story files
- `/src/**/*.stories.@(js|jsx|ts|tsx)` - Co-located with components

Example structure:
```
stories/
├── Introduction.mdx
└── widgets/
    ├── Tag.stories.tsx
    └── ...
```

## Aliases and Imports

The Vite configuration mirrors webpack aliases:
- `mattermost-redux` → packages/mattermost-redux/src
- `components` → src/components
- `utils` → src/utils
- `actions` → src/actions
- `stores` → src/stores
- And more...

This allows stories to import components using the same paths as the main app.

## Troubleshooting

### Missing dependencies
If you encounter module resolution issues, ensure all dependencies are installed:
```bash
npm install
```

### SCSS compilation errors
The SCSS preprocessor is configured to use `src/sass` as an include path. If styles don't load:
1. Check that global styles are imported in `preview.tsx`
2. Verify SCSS module syntax is correct

### Redux state issues
The mock store in `preview.tsx` provides a minimal Redux state. If a component requires specific state:
1. Create a story-specific decorator
2. Use `args` to pass props directly
3. Or update the mock store in `preview.tsx`
