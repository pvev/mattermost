# Mattermost Webapp Storybook Setup - Complete Context

**Last Updated**: October 22, 2025  
**Status**: POC Complete - Ready for Expansion  
**Storybook Version**: 7.6.20  

---

## Executive Summary

This document provides complete context for the Storybook implementation in the Mattermost webapp. It covers initial setup, key decisions, problems solved, current architecture, and guidance for future development.

### Current State
- ✅ Storybook 7.6.20 configured and running on port 6007
- ✅ Webpack 5 builder with full SCSS support
- ✅ Stories co-located with components (best practice)
- ✅ Three component categories with working examples:
  - **Tag components** (BotTag, GuestTag) - Channels package
  - **GenericModal** - Platform/components package
  - **Button** - Platform/design-system package
- ✅ Full Mattermost styling and theming support
- ✅ Monorepo-compatible configuration
- ✅ CI/CD integration ready

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Key Technical Decisions](#key-technical-decisions)
3. [File Structure](#file-structure)
4. [Configuration Details](#configuration-details)
5. [Problems Solved](#problems-solved)
6. [Component Story Examples](#component-story-examples)
7. [Development Workflow](#development-workflow)
8. [CI/CD Integration](#cicd-integration)
9. [Known Limitations](#known-limitations)
10. [Future Work](#future-work)
11. [Troubleshooting Guide](#troubleshooting-guide)

---

## Architecture Overview

### Monorepo Structure

Mattermost webapp uses npm workspaces with multiple packages:

```
mattermost/webapp/
├── package.json (workspace root)
├── package-lock.json (single lock file for all workspaces)
├── channels/ (main webapp)
│   ├── .storybook/ ← STORYBOOK CONFIGURATION HERE
│   ├── src/
│   │   └── components/
│   │       └── widgets/tag/
│   │           ├── tag.tsx
│   │           └── tag.stories.tsx ← Stories co-located with components
│   └── package.json
├── platform/
│   ├── components/
│   │   └── src/generic_modal/
│   │       ├── generic_modal.tsx
│   │       └── generic_modal.stories.tsx
│   └── design-system/
│       └── src/components/primitives/Button/
│           ├── button.tsx
│           └── button.stories.tsx
└── node_modules/ (shared across workspace)
```

### Centralized Configuration

**Important**: Storybook is configured ONCE in `webapp/channels/.storybook/` but discovers stories across the entire monorepo:
- Channels stories: `webapp/channels/src/**/*.stories.tsx`
- Platform components: `webapp/platform/components/src/**/*.stories.tsx`
- Design system: `webapp/platform/design-system/src/**/*.stories.tsx`

---

## Key Technical Decisions

### 1. Builder Choice: Webpack 5 (Not Vite)

**Decision**: Use Webpack 5 instead of Vite  
**Rationale**:
- Full compatibility with existing Mattermost Webpack configuration
- Better SCSS/sass-loader integration with `loadPaths` for `@use` resolution
- No `process.env` polyfilling issues
- Easier to configure for complex monorepo setup

**Initial Attempt**: We tried Vite first but encountered:
- `process.env is not defined` errors requiring manual polyfills
- Difficulty configuring SCSS with proper import paths
- Module resolution issues with workspace packages

### 2. Redux Removed from Global Decorators

**Decision**: Do NOT include Redux Provider in preview decorators  
**Rationale**:
- Current component stories (Tag, GenericModal, Button) are pure presentational components
- No components use `useSelector` or `connect`
- Keeping it simple reduces complexity and startup time
- Can be added per-story if needed for container components

**When to Add Redux Back**:
- If you create stories for components that use `useSelector` or `connect`
- Add it as a story-specific decorator, not globally
- Example pattern in section "Component Story Examples" below

### 3. Stories Co-Located with Components

**Decision**: Place `*.stories.tsx` files in the same directory as components  
**Rationale**:
- Industry best practice (Storybook recommendation)
- Easier maintenance - stories stay with component code
- Better discoverability
- Version control - stories update alongside component changes

**File Naming**: Use snake_case to match component files:
```
component_name.tsx
component_name.stories.tsx
component_name.test.tsx
```

### 4. Single React Instance Enforcement

**Decision**: Alias React packages in Webpack config  
**Problem Solved**: "Invalid hook call" errors in monorepo  
**Solution**: Ensure all packages use the same React instance from root `node_modules`:

```typescript
// In main.ts
resolve: {
  alias: {
    react: path.resolve(__dirname, '../../node_modules/react'),
    'react-dom': path.resolve(__dirname, '../../node_modules/react-dom'),
    'react-redux': path.resolve(__dirname, '../../node_modules/react-redux'),
  }
}
```

### 5. SCSS Compilation Strategy

**Decision**: Import full webapp SCSS (`styles.scss`) + custom CSS variables  
**Approach**:
1. Import main webapp SCSS for comprehensive styling
2. Supplement with `storybook-styles.css` for additional CSS variables
3. Configure `sass-loader` with proper `loadPaths`

**Why This Works**:
- Full Mattermost component styling
- CSS variables for styled-components
- Proper `@use` and `@import` resolution

---

## File Structure

### Storybook Configuration Files

```
webapp/channels/.storybook/
├── main.ts              # Core configuration
├── preview.tsx          # Global decorators and parameters
├── storybook-styles.css # Additional CSS variables
└── README.md            # Technical documentation
```

### Story Files (Examples)

```
webapp/channels/src/components/widgets/tag/
├── tag.tsx
├── tag.stories.tsx      # ← Co-located story
├── bot_tag.tsx
└── guest_tag.tsx

webapp/platform/components/src/generic_modal/
├── generic_modal.tsx
└── generic_modal.stories.tsx

webapp/platform/design-system/src/components/primitives/Button/
├── button.tsx
└── button.stories.tsx
```

### Documentation Files

```
webapp/channels/stories/
└── Introduction.mdx     # Landing page for Storybook UI
```

---

## Configuration Details

### main.ts Configuration

**Location**: `webapp/channels/.storybook/main.ts`

**Key Sections**:

#### 1. Story Discovery Patterns

```typescript
stories: [
    // Channels stories
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../stories/**/*.mdx',
    '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    
    // Platform components
    '../../platform/components/src/**/*.mdx',
    '../../platform/components/src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    
    // Design system
    '../../platform/design-system/src/**/*.mdx',
    '../../platform/design-system/src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
],
```

#### 2. Webpack Configuration

**SCSS Loader Setup**:

```typescript
webpackFinal: async (config) => {
    // Configure sass-loader with proper loadPaths
    filteredRules.push({
        test: /\.scss$/,
        use: [
            'style-loader',
            {
                loader: 'css-loader',
                options: {
                    importLoaders: 2, // Important!
                },
            },
            {
                loader: require.resolve('sass-loader'),
                options: {
                    implementation: require('sass'),
                    sassOptions: {
                        loadPaths: [
                            path.resolve(__dirname, '../src/sass'),
                            path.resolve(__dirname, '../src'),
                            path.resolve(__dirname, '../../node_modules'),
                        ],
                    },
                },
            },
        ],
    });
}
```

**Module Aliases**:

```typescript
resolve: {
    alias: {
        // Single React instance (critical for monorepo)
        react: path.resolve(__dirname, '../../node_modules/react'),
        'react-dom': path.resolve(__dirname, '../../node_modules/react-dom'),
        'react-redux': path.resolve(__dirname, '../../node_modules/react-redux'),
        
        // Mattermost packages
        'mattermost-redux': path.resolve(__dirname, '../src/packages/mattermost-redux/src'),
        '@mattermost/components': path.resolve(__dirname, '../../platform/components'),
        
        // Styled components
        '@mui/styled-engine': path.resolve(__dirname, '../../node_modules/@mui/styled-engine-sc'),
        'styled-components': path.resolve(__dirname, '../../node_modules/styled-components'),
        
        // App paths
        components: path.resolve(__dirname, '../src/components'),
        utils: path.resolve(__dirname, '../src/utils'),
        // ... etc
    }
}
```

#### 3. Monorepo Best Practices

Using `getAbsolutePath` helper for addon resolution:

```typescript
const getAbsolutePath = (packageName: string): any =>
    path.dirname(require.resolve(path.join(packageName, 'package.json')))
        .replace(/^file:\/\//, '');

const config: StorybookConfig = {
    addons: [
        getAbsolutePath('@storybook/addon-essentials'),
        getAbsolutePath('@storybook/addon-interactions'),
        getAbsolutePath('@storybook/addon-a11y'),
    ],
    framework: {
        name: getAbsolutePath('@storybook/react-webpack5'),
        options: {},
    },
};
```

### preview.tsx Configuration

**Location**: `webapp/channels/.storybook/preview.tsx`

**Global Decorators**:

```typescript
import React from 'react';
import {IntlProvider} from 'react-intl';
import {Router} from 'react-router-dom';
import {createMemoryHistory} from 'history';
import en from '../src/i18n/en.json';

// Import full Mattermost styles
import '../src/sass/styles.scss';
import './storybook-styles.css';

export default {
    decorators: [
        (Story) => {
            const history = createMemoryHistory();
            return (
                <IntlProvider locale="en" messages={en} defaultLocale="en">
                    <Router history={history}>
                        <div className="app__body" style={{padding: '20px', minHeight: '100vh'}}>
                            <Story />
                        </div>
                    </Router>
                </IntlProvider>
            );
        },
    ],
    parameters: {
        // ... parameter configuration
    },
};
```

**Why These Decorators**:
- `IntlProvider`: i18n support for translated components
- `Router`: Navigation context for components using routing
- `.app__body` wrapper: Proper CSS scoping (many components scoped to this)
- **No Redux**: Not needed for current presentational components

### storybook-styles.css

**Location**: `webapp/channels/.storybook/storybook-styles.css`

**Purpose**: Essential CSS variables for styled-components and custom styling

**Key Variables**:

```css
:root {
    /* Icon opacity */
    --icon-opacity: 0.64;
    --icon-opacity-hover: 0.8;

    /* Base colors */
    --center-channel-bg: #fff;
    --center-channel-color: #3d3c40;
    --center-channel-bg-rgb: 255, 255, 255;
    --center-channel-color-rgb: 61, 60, 64;

    /* Semantic colors (used by Tag component) */
    --semantic-color-general: var(--center-channel-color-rgb);
    --semantic-color-info: 93, 137, 234;
    --semantic-color-success: 61, 184, 135;
    --semantic-color-warning: 245, 171, 0;
    --semantic-color-danger: 210, 75, 78;

    /* Border radius */
    --radius-xs: 2px;
    --radius-s: 4px;
    --radius-m: 8px;
    /* ... etc */
}
```

**Why Needed**: styled-components in Mattermost rely on CSS custom properties for theming.

---

## Problems Solved

### Problem 1: Process Undefined Error (Vite)

**Error**: `ReferenceError: process is not defined`  
**Context**: Using Vite builder  
**Cause**: Browser doesn't have Node.js `process` global  
**Attempted Fix**: Added polyfill to Vite config  
**Final Solution**: Switched to Webpack 5 (no polyfill needed)

### Problem 2: Tag Components Missing Styles

**Error**: Components rendered but no colors/styling  
**Cause**: styled-components need CSS variables  
**Solution**: Created `storybook-styles.css` with essential CSS variables like `--semantic-color-info`

### Problem 3: SASS Import Resolution

**Error**: `Can't find stylesheet to import. @use "utils/mixins";`  
**Cause**: sass-loader couldn't resolve relative `@use` statements  
**Solution**: Configured `loadPaths` in sass-loader options:

```typescript
sassOptions: {
    loadPaths: [
        path.resolve(__dirname, '../src/sass'),
        path.resolve(__dirname, '../src'),
        path.resolve(__dirname, '../../node_modules'),
    ],
}
```

### Problem 4: Invalid Hook Call Error

**Error**: "Invalid hook call. Hooks can only be called inside of the body of a function component"  
**Cause**: Multiple React instances in monorepo (one per package)  
**Solution**: Webpack aliases to enforce single React instance (see "Single React Instance Enforcement")

### Problem 5: GenericModal Missing Platform Styles

**Error**: Modal rendered but missing proper styling  
**First Attempt**: Create separate Storybook for platform package  
**Problem with Attempt**: Complex SCSS imports, maintenance burden  
**Final Solution**: 
1. Import stories from platform into channels Storybook
2. Add `@mattermost/components` alias
3. Ensure `.app__body` wrapper in decorator
4. Import full webapp SCSS

### Problem 6: Stories Not Excluded from Production Builds

**Problem**: Story files being compiled to `dist/`  
**Solution**: Added exclude patterns to `tsconfig.json`:

```json
{
    "exclude": [
        "./src/**/*.test.tsx",
        "./src/**/*.test.ts",
        "./src/**/*.stories.tsx",
        "./src/**/*.stories.ts",
        "node_modules",
        "dist"
    ]
}
```

**Applied to**:
- `webapp/platform/design-system/tsconfig.json`
- `webapp/platform/components/tsconfig.json`

---

## Component Story Examples

### Example 1: Simple Presentational Component (Tag)

**File**: `webapp/channels/src/components/widgets/tag/tag.stories.tsx`

```typescript
import React from 'react';
import type {Meta, StoryObj} from '@storybook/react';

import Tag from './tag';

const meta: Meta<typeof Tag> = {
    title: 'Widgets/Tag',
    component: Tag,
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['general', 'info', 'success', 'warning', 'danger'],
            description: 'Semantic color variant',
        },
        size: {
            control: 'select',
            options: ['xs', 'sm'],
            description: 'Size of the tag',
        },
    },
};

export default meta;
type Story = StoryObj<typeof Tag>;

export const Success: Story = {
    args: {
        text: 'Success Tag',
        variant: 'success',
    },
};

export const Info: Story = {
    args: {
        text: 'Info Tag',
        variant: 'info',
    },
};
```

**Key Points**:
- Import from `./tag` (relative, co-located)
- Use TypeScript types from `@storybook/react`
- Document props with `argTypes`
- Export multiple story variants

### Example 2: Interactive Component with State (GenericModal)

**File**: `webapp/platform/components/src/generic_modal/generic_modal.stories.tsx`

```typescript
import React, {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react';

import GenericModal from './generic_modal';

const meta: Meta<typeof GenericModal> = {
    title: 'Components/GenericModal',
    component: GenericModal,
    parameters: {
        compassDesign: true, // Enable Compass Design parameter
    },
};

export default meta;
type Story = StoryObj<typeof GenericModal>;

// Interactive story with useState
export const Interactive: Story = {
    render: () => {
        const [isOpen, setIsOpen] = useState(false);
        
        return (
            <>
                <button onClick={() => setIsOpen(true)}>
                    Open Modal
                </button>
                <GenericModal
                    show={isOpen}
                    onHide={() => setIsOpen(false)}
                    modalHeaderText="Interactive Modal"
                    confirmButtonText="Confirm"
                    handleConfirm={() => {
                        alert('Confirmed!');
                        setIsOpen(false);
                    }}
                >
                    <p>This modal demonstrates interactive behavior.</p>
                </GenericModal>
            </>
        );
    },
};
```

**Key Points**:
- Use `render` function for complex interactions
- `useState` works normally in stories
- Custom parameters like `compassDesign` can be added

### Example 3: Component with Redux (Future Pattern)

**If you need Redux for a component**:

```typescript
import React from 'react';
import {Provider} from 'react-redux';
import {createStore} from 'redux';
import type {Meta, StoryObj} from '@storybook/react';

import ConnectedComponent from './connected_component';

// Mock Redux store
const mockReducer = (state = {user: {name: 'John'}}) => state;
const mockStore = createStore(mockReducer);

const meta: Meta<typeof ConnectedComponent> = {
    title: 'Components/ConnectedComponent',
    component: ConnectedComponent,
    decorators: [
        (Story) => (
            <Provider store={mockStore}>
                <Story />
            </Provider>
        ),
    ],
};

export default meta;
```

**Important**: Add Redux decorator **per-story**, not globally in `preview.tsx`.

---

## Development Workflow

### Running Storybook

```bash
# From repository root
npm --prefix webapp/channels run storybook

# Or from webapp/channels directory
npm run storybook
```

**Runs on**: `http://localhost:6007`

### Building Storybook (Static)

```bash
npm --prefix webapp/channels run build-storybook
```

**Output**: `webapp/channels/storybook-static/` - Can be deployed to any static host.

### Creating New Stories

**Checklist**:

1. **Locate component file**:
   ```
   webapp/[package]/src/components/my_component/my_component.tsx
   ```

2. **Create story file in same directory**:
   ```
   webapp/[package]/src/components/my_component/my_component.stories.tsx
   ```

3. **Use story template**:
   ```typescript
   import React from 'react';
   import type {Meta, StoryObj} from '@storybook/react';
   
   import MyComponent from './my_component';
   
   const meta: Meta<typeof MyComponent> = {
       title: 'Category/MyComponent', // Changes sidebar organization
       component: MyComponent,
       tags: ['autodocs'],
   };
   
   export default meta;
   type Story = StoryObj<typeof MyComponent>;
   
   export const Default: Story = {
       args: {
           // component props here
       },
   };
   ```

4. **Verify in Storybook**:
   - Storybook auto-reloads on file changes
   - Check browser console for errors
   - Test all story variants

5. **Validate TypeScript**:
   ```bash
   cd webapp && npm run check-types
   ```

6. **Run linter**:
   ```bash
   cd webapp/channels && npm run lint
   ```

### File Naming Conventions

- **Component**: `my_component.tsx`
- **Story**: `my_component.stories.tsx`
- **Test**: `my_component.test.tsx`
- **Style**: `my_component.scss`

All in same directory (co-location).

---

## CI/CD Integration

### What's Configured

**ESLint**: Story files are linted with normal rules  
**TypeScript**: Story files are type-checked  
**Builds**: Story files are **excluded** from production builds  

### GitHub Actions Integration

**Current CI** (example from `webapp-ci.yml`):

```yaml
- name: Lint and Type Check
  run: |
    cd webapp
    npm run check-types
    cd channels
    npm run lint
```

**Stories are included** in these checks automatically.

### Adding Storybook Build to CI

**If you want to build Storybook in CI** (e.g., for deployment):

```yaml
- name: Build Storybook
  run: npm --prefix webapp/channels run build-storybook

- name: Upload Storybook
  uses: actions/upload-artifact@v3
  with:
    name: storybook-static
    path: webapp/channels/storybook-static
```

### Deployment Options

**Static Hosting** (recommended):
- GitHub Pages
- Netlify
- Vercel
- S3 + CloudFront
- Any static file host

**Example**: Deploy to GitHub Pages:

```yaml
- name: Deploy to GitHub Pages
  uses: peaceiris/actions-gh-pages@v3
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./webapp/channels/storybook-static
```

---

## Known Limitations

### 1. No MDX Stories in Main Directories

**Issue**: Patterns like `src/**/*.mdx` show warnings  
**Why**: No MDX stories created yet  
**Impact**: Harmless warnings, can be ignored  
**Fix**: Remove unused patterns or add MDX stories

### 2. SASS Deprecation Warnings

**Warning**: "Sass's behavior for declarations that appear after nested rules will be changing"  
**File**: `_sidebar-right.scss`  
**Impact**: None currently, will break in Dart Sass 2.0  
**Fix**: Refactor SCSS (webapp-wide, not Storybook-specific)

### 3. Package.json Warning

**Warning**: "unable to find package.json for @mattermost/types"  
**Cause**: Not a published npm package, internal monorepo reference  
**Impact**: None, can be ignored  
**Fix**: Not needed

### 4. Platform Storybook Removed

**Previous**: Separate Storybook in `webapp/platform/components/.storybook/`  
**Decision**: Removed, use single Storybook in channels  
**Why**: Easier maintenance, better style loading  
**Files Deleted**:
- `webapp/platform/components/.storybook/main.ts`
- `webapp/platform/components/.storybook/preview.tsx`
- `webapp/platform/components/.storybook/storybook-styles.css`

### 5. Old Stories Folder Removed

**Previous**: `webapp/channels/stories/widgets/Tag.stories.tsx`  
**Current**: Stories co-located with components  
**Why**: Best practice, easier maintenance  

---

## Future Work

### Immediate Next Steps

1. **Add More Component Stories**:
   - Priority components: Input, Select, Dropdown, Modal variants
   - Design system: Typography, Icons, Colors showcase
   - Form components: validation examples

2. **Add Interaction Testing**:
   ```typescript
   import {within, userEvent} from '@storybook/testing-library';
   import {expect} from '@storybook/jest';
   
   export const ButtonClick: Story = {
       play: async ({canvasElement}) => {
           const canvas = within(canvasElement);
           await userEvent.click(canvas.getByRole('button'));
           await expect(canvas.getByText('Clicked!')).toBeInTheDocument();
       },
   };
   ```

3. **Add Accessibility Testing**:
   - Use `@storybook/addon-a11y` (already installed)
   - Add `parameters.a11y` rules per story
   - Document accessibility patterns

4. **Create Component Templates**:
   - VSCode snippet for story files
   - CLI tool to scaffold stories
   - Story generator script

### Medium-Term Goals

1. **Visual Regression Testing**:
   - Tool: Chromatic or Percy
   - Automate screenshot comparison
   - Catch unintended visual changes

2. **Component Documentation**:
   - Add detailed MDX docs for complex components
   - Usage guidelines
   - Do's and Don'ts

3. **Design Tokens Integration**:
   - Export CSS variables to JSON
   - Document design token usage
   - Link design system to Storybook

4. **Storybook Deployment**:
   - Set up GitHub Pages or Netlify
   - Auto-deploy on main branch
   - Create PR preview deployments

### Long-Term Vision

1. **Component API Documentation**:
   - Auto-generate from TypeScript types
   - Link to actual component code
   - Show component dependencies

2. **Usage Analytics**:
   - Track which components are most viewed
   - Identify documentation gaps
   - Guide component development priorities

3. **Integration with Design Tools**:
   - Figma plugin integration
   - Export components to design library
   - Two-way sync between design and code

---

## Troubleshooting Guide

### Storybook Won't Start

**Error**: Port already in use

```bash
# Kill process on port 6007
lsof -ti:6007 | xargs kill -9

# Restart Storybook
npm --prefix webapp/channels run storybook
```

**Error**: Module not found

```bash
# Clean install dependencies
cd webapp
rm -rf node_modules package-lock.json
npm install
```

### Stories Not Appearing

**Check**:
1. File named `*.stories.tsx`?
2. File matches glob pattern in `main.ts`?
3. Story file exports default meta object?
4. Browser console for errors?

**Debug**:
```bash
# Check Storybook finds the file
grep -r "title.*YourComponent" webapp/
```

### Styles Not Loading

**Issue**: Component renders but looks wrong

**Checklist**:
1. Is `styles.scss` imported in `preview.tsx`?
2. Are CSS variables defined in `storybook-styles.css`?
3. Does component need `.app__body` wrapper?
4. Check browser DevTools for missing CSS files

**Fix**:
```bash
# Restart Storybook to reload styles
lsof -ti:6007 | xargs kill -9
npm --prefix webapp/channels run storybook
```

### Invalid Hook Call

**Error**: "Invalid hook call. Hooks can only be called inside of the body of a function component"

**Cause**: Multiple React instances

**Fix**: Check React aliases in `main.ts`:

```typescript
resolve: {
    alias: {
        react: path.resolve(__dirname, '../../node_modules/react'),
        'react-dom': path.resolve(__dirname, '../../node_modules/react-dom'),
    }
}
```

### TypeScript Errors

**Error**: Story file has type errors

**Common Issues**:
- Missing `@storybook/react` types
- Wrong component prop types
- Missing type exports

**Fix**:
```bash
# Reinstall Storybook types
cd webapp/channels
npm install --save-dev @storybook/react@7.6.20
```

### Build Fails in CI

**Error**: CI build fails but local works

**Check**:
1. Are Storybook dependencies in `package.json`?
2. Is `package-lock.json` committed?
3. TypeScript errors in story files?

**Fix**:
```bash
# Ensure dependencies are tracked
cd webapp/channels
npm install
git add package.json package-lock.json
git commit -m "Add Storybook dependencies"
```

---

## Package Dependencies

### Required in `webapp/channels/package.json`

```json
{
    "devDependencies": {
        "storybook": "7.6.20",
        "@storybook/react-webpack5": "7.6.20",
        "@storybook/addon-essentials": "7.6.20",
        "@storybook/addon-interactions": "7.6.20",
        "@storybook/addon-a11y": "7.6.20",
        "sass": "^1.69.0"
    },
    "scripts": {
        "storybook": "storybook dev -p 6007",
        "build-storybook": "storybook build"
    }
}
```

### Already Installed (Workspace Dependencies)

- `react@18.x`
- `react-dom@18.x`
- `react-intl`
- `react-router-dom`
- `styled-components`
- `@babel/preset-typescript`

---

## Quick Reference Commands

```bash
# Start Storybook
npm --prefix webapp/channels run storybook

# Build static Storybook
npm --prefix webapp/channels run build-storybook

# Kill Storybook process
lsof -ti:6007 | xargs kill -9

# Type check (includes stories)
cd webapp && npm run check-types

# Lint (includes stories)
cd webapp/channels && npm run lint

# Clean reinstall
cd webapp
rm -rf node_modules package-lock.json
npm install

# Find all stories
find webapp -name "*.stories.tsx"

# Search story content
grep -r "title.*" webapp/**/*.stories.tsx
```

---

## Contact and Resources

### Documentation Files

- **Technical README**: `webapp/channels/.storybook/README.md`
- **Introduction (Storybook UI)**: `webapp/channels/stories/Introduction.mdx`
- **This Context Doc**: `ai_context/webapp/storybook/setup-context.md`

### External Resources

- [Storybook Docs](https://storybook.js.org/docs/react/)
- [Storybook Monorepo Setup](https://storybook.js.org/docs/faq#how-do-i-fix-module-resolution-in-special-environments)
- [Webpack Configuration](https://storybook.js.org/docs/react/builders/webpack)
- [React Storybook Best Practices](https://storybook.js.org/docs/react/writing-stories/introduction)

### Version Information

- **Storybook**: 7.6.20
- **React**: 18.x
- **Webpack**: 5.x
- **TypeScript**: Configured in workspace
- **SASS**: Dart Sass (latest)

---

## Glossary

**Addon**: Plugin that extends Storybook functionality  
**Decorator**: Wrapper component that provides context to stories  
**CSF**: Component Story Format (modern Storybook story format)  
**Canvas**: Interactive preview tab in Storybook UI  
**Controls**: Interactive props editor in Storybook UI  
**Actions**: Event logger addon  
**A11y**: Accessibility testing addon  
**Essentials**: Bundle of core Storybook addons  
**Parameters**: Configuration options for stories  
**Args**: Component props values for a story  
**ArgTypes**: Prop type definitions and controls configuration  
**MDX**: Markdown + JSX for documentation  
**CSF3**: Component Story Format v3 (object-based stories)  

---

## Appendix: File Templates

### Story Template (Basic)

Save as `.storybook/templates/story.template.tsx`:

```typescript
import React from 'react';
import type {Meta, StoryObj} from '@storybook/react';

import ComponentName from './component_name';

const meta: Meta<typeof ComponentName> = {
    title: 'Category/ComponentName',
    component: ComponentName,
    tags: ['autodocs'],
    argTypes: {
        // Define prop controls here
    },
};

export default meta;
type Story = StoryObj<typeof ComponentName>;

export const Default: Story = {
    args: {
        // Default prop values
    },
};

export const Variant: Story = {
    args: {
        // Variant prop values
    },
};
```

### Story Template (With Interactions)

```typescript
import React from 'react';
import type {Meta, StoryObj} from '@storybook/react';
import {within, userEvent, expect} from '@storybook/test';

import ComponentName from './component_name';

const meta: Meta<typeof ComponentName> = {
    title: 'Category/ComponentName',
    component: ComponentName,
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ComponentName>;

export const Interactive: Story = {
    args: {
        onClick: () => {},
    },
    play: async ({canvasElement}) => {
        const canvas = within(canvasElement);
        const button = canvas.getByRole('button');
        await userEvent.click(button);
        await expect(button).toHaveClass('clicked');
    },
};
```

---

## Version History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2025-10-22 | 1.0 | AI Assistant | Initial complete context document |

---

**End of Document**

This context should provide enough information for any developer (human or AI) to:
1. Understand the complete Storybook setup
2. Add new component stories
3. Debug common issues
4. Extend functionality
5. Make informed architectural decisions

For questions or updates, modify this document as the implementation evolves.

