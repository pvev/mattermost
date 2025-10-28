# Tag Component

A unified, comprehensive Tag component for the Mattermost Design System that consolidates all tag variants previously scattered across the codebase.

## Overview

The Tag component is a versatile primitive that can display labels, badges, statuses, and other categorization indicators. It supports multiple sizes, color variants, icons, tooltips, and preset configurations for common use cases.

## Consolidated Components

This unified Tag component replaces the following components from `webapp/channels/src/components/widgets/tag/`:

- `tag.tsx` - Base tag with styled-components
- `alert_tag.tsx` - Alert tag with SCSS styling
- `beta_tag.tsx` - Beta badge preset
- `bot_tag.tsx` - Bot badge preset
- `guest_tag.tsx` - Guest badge preset
- `tag_group.tsx` - Tag container component

## Features

### Core Features
- ✅ **Multiple Sizes**: xs, sm, md, lg
- ✅ **Color Variants**: default, primary, secondary, info, success, warning, danger, dangerDim
- ✅ **Icon Support**: Display icons with auto-sizing based on tag size
- ✅ **Tooltip Support**: Optional tooltip functionality
- ✅ **Preset Configurations**: Pre-configured tags for common use cases (beta, bot, guest)
- ✅ **Interactive Mode**: Support for click handlers
- ✅ **Text Transformation**: Uppercase option
- ✅ **Conditional Rendering**: Hide prop for dynamic visibility
- ✅ **Accessibility**: Full ARIA support and keyboard navigation
- ✅ **Responsive**: Full-width option for flexible layouts
- ✅ **Text Overflow**: Automatic ellipsis for long text

### Design System Integration
- Uses SCSS following Mattermost design patterns
- Leverages CSS custom properties for theming
- Consistent spacing, typography, and color system
- Follows established component patterns (similar to Button component)

## Installation

```tsx
import {Tag, TagGroup} from '@mattermost/design-system';
import type {TagProps, TagSize, TagVariant} from '@mattermost/design-system';
```

## Basic Usage

### Simple Tag

```tsx
<Tag text="Simple Tag" />
```

### With Variant and Size

```tsx
<Tag 
  text="Info Tag" 
  variant="info" 
  size="sm" 
  uppercase={true}
/>
```

### Preset Tags

```tsx
<Tag preset="beta" />
<Tag preset="bot" size="sm" />
<Tag preset="guest" size="md" />
```

### With Icon

```tsx
import {CheckIcon} from '@mattermost/compass-icons/components';

<Tag 
  text="Success" 
  icon={<CheckIcon />}
  variant="success"
  size="md"
/>
```

### Interactive Tag

```tsx
<Tag 
  text="Click Me" 
  variant="info"
  onClick={() => console.log('clicked')}
/>
```

### With Tooltip

```tsx
import WithTooltip from 'components/with_tooltip';

<Tag 
  text="Hover Me"
  variant="info"
  tooltip="Additional information"
  TooltipComponent={WithTooltip}
/>
```

### Tag Group

```tsx
<TagGroup>
  <Tag preset="beta" />
  <Tag preset="bot" />
  <Tag text="Custom" variant="warning" />
</TagGroup>
```

## Props

### Tag Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `ReactNode` | - | The text content of the tag |
| `preset` | `'custom' \| 'beta' \| 'bot' \| 'guest'` | `'custom'` | Predefined tag type |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg'` | `'xs'` | Size variant |
| `variant` | `'default' \| 'info' \| 'success' \| 'warning' \| 'danger' \| 'dangerDim' \| 'primary' \| 'secondary'` | `'default'` | Color/semantic variant |
| `uppercase` | `boolean` | `false` | Whether to display text in uppercase |
| `icon` | `ReactNode` | - | Icon element to display |
| `iconSize` | `number` | auto | Icon size in pixels (auto-calculated if not provided) |
| `onClick` | `MouseEventHandler` | - | Click handler |
| `className` | `string` | - | Additional CSS classes |
| `testId` | `string` | - | Test ID attribute |
| `tooltip` | `ReactNode` | - | Tooltip content |
| `TooltipComponent` | `ComponentType` | - | Tooltip wrapper component |
| `hide` | `boolean` | `false` | Whether to hide the tag |
| `fullWidth` | `boolean` | `false` | Full width variant |

### TagGroup Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | - | Child tag components |
| `className` | `string` | - | Additional CSS classes |
| `testId` | `string` | - | Test ID attribute |

## Size Reference

| Size | Height | Font Size | Padding | Icon Size |
|------|--------|-----------|---------|-----------|
| `xs` | 16px | 10px | 1px 4px | 10px |
| `sm` | 20px | 12px | 2px 6px | 12px |
| `md` | 24px | 14px | 2px 8px | 14px |
| `lg` | 28px | 16px | 3px 10px | 16px |

## Variant Reference

| Variant | Usage | Background | Text Color |
|---------|-------|------------|------------|
| `default` | Default/neutral state | Transparent gray | Center channel color |
| `primary` | Primary emphasis | Transparent blue | Button background |
| `secondary` | Secondary emphasis | Transparent | Sidebar text |
| `info` | Informational | Solid blue | White |
| `success` | Success state | Solid green | White |
| `warning` | Warning state | Solid yellow | White |
| `danger` | Error/danger state | Solid red | White |
| `dangerDim` | Subdued danger | Transparent red | Error text |

## Preset Reference

| Preset | Text | Uppercase | Default Variant |
|--------|------|-----------|-----------------|
| `beta` | BETA | Yes | info |
| `bot` | BOT | Yes | default |
| `guest` | GUEST | Yes | default |

## Migration Guide

### From Old Tag Component

**Before:**
```tsx
import Tag from 'components/widgets/tag/tag';

<Tag 
  text="Custom"
  variant="info"
  size="sm"
  uppercase={true}
  icon="check"
/>
```

**After:**
```tsx
import {Tag} from '@mattermost/design-system';
import {CheckIcon} from '@mattermost/compass-icons/components';

<Tag 
  text="Custom"
  variant="info"
  size="sm"
  uppercase={true}
  icon={<CheckIcon />}
/>
```

**Key Changes:**
- Import from `@mattermost/design-system` instead of widgets path
- Pass icon as component instead of string name

### From AlertTag Component

**Before:**
```tsx
import AlertTag from 'components/widgets/tag/alert_tag';

<AlertTag 
  text="Alert"
  variant="info"
  size="medium"
  tooltipTitle="Tooltip text"
/>
```

**After:**
```tsx
import {Tag} from '@mattermost/design-system';
import WithTooltip from 'components/with_tooltip';

<Tag 
  text="Alert"
  variant="info"
  size="md"
  tooltip="Tooltip text"
  TooltipComponent={WithTooltip}
/>
```

**Key Changes:**
- Use `md` instead of `"medium"`, `sm` instead of `"small"`
- Use `tooltip` prop instead of `tooltipTitle`
- Pass `TooltipComponent` explicitly

### From BetaTag Component

**Before:**
```tsx
import BetaTag from 'components/widgets/tag/beta_tag';

<BetaTag size="sm" variant="info" />
```

**After:**
```tsx
import {Tag} from '@mattermost/design-system';

<Tag preset="beta" size="sm" variant="info" />
```

### From BotTag Component

**Before:**
```tsx
import BotTag from 'components/widgets/tag/bot_tag';

<BotTag size="md" />
```

**After:**
```tsx
import {Tag} from '@mattermost/design-system';

<Tag preset="bot" size="md" />
```

### From GuestTag Component

**Before:**
```tsx
import GuestTag from 'components/widgets/tag/guest_tag';

<GuestTag size="lg" />
```

**After:**
```tsx
import {Tag} from '@mattermost/design-system';
import {useSelector} from 'react-redux';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

const shouldHideTag = useSelector((state) => 
  getConfig(state).HideGuestTags === 'true'
);

<Tag preset="guest" size="lg" hide={shouldHideTag} />
```

**Note:** The conditional rendering logic needs to be handled externally.

### From TagGroup Component

**Before:**
```tsx
import TagGroup from 'components/widgets/tag/tag_group';

<TagGroup>
  <Tag text="Tag 1" />
  <Tag text="Tag 2" />
</TagGroup>
```

**After:**
```tsx
import {Tag, TagGroup} from '@mattermost/design-system';

<TagGroup>
  <Tag text="Tag 1" />
  <Tag text="Tag 2" />
</TagGroup>
```

**Key Changes:**
- Import both from the same package
- No other changes needed

## Best Practices

### Do's ✅
- Use preset tags for common use cases (beta, bot, guest)
- Use semantic variants (success, warning, danger) to convey meaning
- Keep tag text short and concise
- Use uppercase for labels and acronyms
- Use TagGroup for multiple related tags
- Provide meaningful tooltip text for additional context

### Don'ts ❌
- Don't use overly long text (use tooltips instead)
- Don't mix too many different sizes in the same group
- Don't use danger variant for non-critical information
- Don't forget to provide TooltipComponent when using tooltip prop
- Don't use tags as primary action buttons

## Accessibility

The Tag component follows accessibility best practices:

- Uses semantic HTML (`<button>` for interactive, `<span>` otherwise)
- Provides `aria-label` for string text content
- Supports keyboard navigation for clickable tags
- Includes focus-visible styles for keyboard users
- Icons are marked with `aria-hidden` to avoid duplicate announcements

## Browser Support

The Tag component supports all modern browsers:
- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)

## Examples

See the Storybook stories for comprehensive examples:
- Basic variants
- Size comparisons
- Preset tags
- Icons and tooltips
- Interactive tags
- Real-world use cases

## Contributing

When adding new features or variants:
1. Update this README
2. Add corresponding tests
3. Add Storybook stories
4. Update TypeScript types
5. Follow existing code patterns

## Related Components

- **Button**: For primary actions
- **Badge**: For numerical indicators (future component)
- **Chip**: For removable tags (future component)

