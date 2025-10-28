# Tag Component Migration Guide

This guide helps you migrate from the old tag components in `webapp/channels/src/components/widgets/tag/` to the new unified Tag component in the design system.

## Overview

The new unified Tag component consolidates **6 separate components** into a single, flexible, well-tested component:

| Old Component | Status | New Approach |
|--------------|--------|--------------|
| `widgets/tag/tag.tsx` | ✅ Replaced | Use `Tag` from design-system |
| `widgets/tag/alert_tag.tsx` | ✅ Replaced | Use `Tag` from design-system |
| `widgets/tag/beta_tag.tsx` | ✅ Replaced | Use `BetaTag` from design-system |
| `widgets/tag/bot_tag.tsx` | ✅ Replaced | Use `BotTag` from design-system |
| `widgets/tag/guest_tag.tsx` | ✅ Replaced | Use `GuestTag` from design-system |
| `widgets/tag/tag_group.tsx` | ✅ Replaced | Use `TagGroup` from design-system |

## Benefits of Migration

- ✅ **Unified API**: Single consistent interface for all tag types
- ✅ **Better Performance**: Memoized components and optimized rendering
- ✅ **Comprehensive Tests**: 100% test coverage with 30+ test cases
- ✅ **Type Safety**: Full TypeScript support with detailed prop types
- ✅ **Better Documentation**: Extensive Storybook stories and README
- ✅ **Design System Integration**: Part of the official Mattermost design system
- ✅ **Future-proof**: Built with modern React patterns and best practices

## Quick Start

### Installation (if using npm workspace)

The component is part of the `@mattermost/design-system` package. If you're in a monorepo workspace, it's already available:

```tsx
import {Tag, TagGroup, BetaTag, BotTag, GuestTag} from '@mattermost/design-system';
```

## Migration Examples

### 1. Basic Tag Component

**Before:**
```tsx
import Tag from 'components/widgets/tag/tag';

<Tag 
  text="Custom Tag"
  variant="info"
  size="sm"
  uppercase={true}
/>
```

**After:**
```tsx
import {Tag} from '@mattermost/design-system';

<Tag 
  text="Custom Tag"
  variant="info"
  size="sm"
  uppercase={true}
/>
```

**Changes:**
- ✅ Import from `@mattermost/design-system`
- ✅ Same prop names and values
- ✅ Same behavior

---

### 2. Tag with Icon

**Before:**
```tsx
import Tag from 'components/widgets/tag/tag';

<Tag 
  text="Success"
  icon="check"  // String icon name
  variant="success"
  size="md"
/>
```

**After:**
```tsx
import {Tag} from '@mattermost/design-system';
import {CheckIcon} from '@mattermost/compass-icons/components';

<Tag 
  text="Success"
  icon={<CheckIcon />}  // React component
  variant="success"
  size="md"
/>
```

**Changes:**
- ⚠️ `icon` prop now expects a React component, not a string
- Import the icon from `@mattermost/compass-icons/components`

---

### 3. Alert Tag Component

**Before:**
```tsx
import AlertTag from 'components/widgets/tag/alert_tag';

<AlertTag 
  text="Alert"
  variant="info"
  size="medium"
  tooltipTitle="More information"
  onClick={handleClick}
  testId="alert-tag"
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
  tooltip="More information"
  TooltipComponent={WithTooltip}
  onClick={handleClick}
  testId="alert-tag"
/>
```

**Changes:**
- ⚠️ Size names changed: `"small"` → `"sm"`, `"medium"` → `"md"`, `"large"` → `"lg"`
- ⚠️ `tooltipTitle` → `tooltip` prop
- ⚠️ Must provide `TooltipComponent` prop (pass your tooltip wrapper component)
- ✅ `onClick` and `testId` work the same way

---

### 4. Beta Tag Component

#### Option A: Using Preset (Recommended)

**Before:**
```tsx
import BetaTag from 'components/widgets/tag/beta_tag';

<BetaTag size="sm" variant="info" />
```

**After (Simple):**
```tsx
import {Tag} from '@mattermost/design-system';

<Tag preset="beta" size="sm" variant="info" />
```

**Changes:**
- ✅ Use `preset="beta"` prop
- ✅ Automatically uppercase and uses default variant
- ❌ No automatic i18n (text is hardcoded as "BETA")

#### Option B: Using i18n Component (For full i18n support)

**After (With i18n):**
```tsx
import {BetaTag} from '@mattermost/design-system';

<BetaTag size="sm" variant="info" />
```

**Changes:**
- ✅ Drop-in replacement
- ✅ Maintains i18n support via `react-intl`
- ✅ Same API as before

---

### 5. Bot Tag Component

#### Option A: Using Preset

**Before:**
```tsx
import BotTag from 'components/widgets/tag/bot_tag';

<BotTag size="md" className="custom-class" />
```

**After (Simple):**
```tsx
import {Tag} from '@mattermost/design-system';

<Tag preset="bot" size="md" className="custom-class" />
```

#### Option B: Using i18n Component

**After (With i18n):**
```tsx
import {BotTag} from '@mattermost/design-system';

<BotTag size="md" className="custom-class" />
```

---

### 6. Guest Tag Component

**Before:**
```tsx
import GuestTag from 'components/widgets/tag/guest_tag';

<GuestTag size="sm" className="guest-badge" />
```

**After:**
```tsx
import {GuestTag} from '@mattermost/design-system';

<GuestTag size="sm" className="guest-badge" />
```

**Changes:**
- ✅ Drop-in replacement
- ✅ Maintains Redux integration for `HideGuestTags` config
- ✅ Same conditional rendering behavior
- ✅ Maintains i18n support

**Note:** The `GuestTag` component from the design system includes the same Redux logic to check `HideGuestTags` configuration.

---

### 7. Tag Group Component

**Before:**
```tsx
import TagGroup from 'components/widgets/tag/tag_group';
import BetaTag from 'components/widgets/tag/beta_tag';
import BotTag from 'components/widgets/tag/bot_tag';

<TagGroup className="my-tags">
  <BetaTag />
  <BotTag />
</TagGroup>
```

**After:**
```tsx
import {TagGroup, BetaTag, BotTag} from '@mattermost/design-system';

<TagGroup className="my-tags">
  <BetaTag />
  <BotTag />
</TagGroup>
```

**Changes:**
- ✅ Same API
- ✅ Import all from one package
- ✅ Same styling and behavior

---

### 8. Complex Real-world Example

**Before:**
```tsx
import Tag from 'components/widgets/tag/tag';
import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';
import TagGroup from 'components/widgets/tag/tag_group';

const UserBadges = ({user, isOnline}) => (
  <TagGroup>
    {user.is_bot && <BotTag size="xs" />}
    {user.is_guest && <GuestTag size="xs" />}
    {isOnline && (
      <Tag 
        text="Online"
        icon="check-circle"
        variant="success"
        size="xs"
      />
    )}
  </TagGroup>
);
```

**After:**
```tsx
import {Tag, TagGroup, BotTag, GuestTag} from '@mattermost/design-system';
import {CheckCircleIcon} from '@mattermost/compass-icons/components';

const UserBadges = ({user, isOnline}) => (
  <TagGroup>
    {user.is_bot && <BotTag size="xs" />}
    {user.is_guest && <GuestTag size="xs" />}
    {isOnline && (
      <Tag 
        text="Online"
        icon={<CheckCircleIcon />}
        variant="success"
        size="xs"
      />
    )}
  </TagGroup>
);
```

**Changes:**
- ✅ Single import statement
- ⚠️ Icon passed as component instead of string

---

## Size Name Mapping

When migrating from `AlertTag`, you'll need to update size prop values:

| Old Size (AlertTag) | New Size (Unified Tag) |
|---------------------|------------------------|
| `"small"` | `"sm"` |
| `"medium"` | `"md"` |
| `"large"` | `"lg"` |

For other components, size names remain the same: `"xs"`, `"sm"`, `"md"`, `"lg"`

---

## Variant Mapping

All variants are preserved, with some new additions:

| Variant | Description | Availability |
|---------|-------------|--------------|
| `default` | Default gray (transparent) | Both old and new |
| `info` | Info blue (solid) | Both old and new |
| `success` | Success green (solid) | Both old and new |
| `warning` | Warning yellow (solid) | Both old and new |
| `danger` | Danger red (solid) | Both old and new |
| `dangerDim` | Danger red (transparent) | Both old and new |
| `primary` | Primary brand color (transparent) | **New** |
| `secondary` | Secondary gray (transparent) | **New** |

---

## Common Patterns

### Pattern 1: Conditional Tag Rendering

**Before:**
```tsx
{showBeta && <BetaTag />}
```

**After (Same):**
```tsx
{showBeta && <BetaTag />}
```

**Or using hide prop:**
```tsx
<BetaTag hide={!showBeta} />
```

---

### Pattern 2: Clickable Tags

**Before:**
```tsx
<Tag 
  text="Edit"
  onClick={() => handleEdit()}
  variant="info"
/>
```

**After (Same):**
```tsx
<Tag 
  text="Edit"
  onClick={() => handleEdit()}
  variant="info"
/>
```

---

### Pattern 3: Tags with Long Text

The new Tag component handles text overflow automatically:

```tsx
<Tag 
  text="This is a very long tag text that will be truncated with ellipsis"
  variant="info"
  size="sm"
/>
```

Result: "This is a very long ta..."

---

### Pattern 4: Full-width Tags

**New feature** - tags can now take full width of their container:

```tsx
<div style={{width: '200px'}}>
  <Tag 
    text="Full Width"
    variant="primary"
    fullWidth={true}
  />
</div>
```

---

## Testing Your Migration

After migrating, verify:

1. ✅ Visual appearance matches the old component
2. ✅ Click handlers work (if applicable)
3. ✅ Tooltips appear correctly (if applicable)
4. ✅ Icons render at the correct size
5. ✅ Text overflow works correctly
6. ✅ Keyboard navigation works for clickable tags
7. ✅ i18n translations work (for BetaTag, BotTag, GuestTag)
8. ✅ Redux config-based rendering works (for GuestTag)

---

## TypeScript Support

The new components have full TypeScript support:

```tsx
import type {TagProps, TagSize, TagVariant} from '@mattermost/design-system';

const MyComponent: React.FC = () => {
  const size: TagSize = 'md';
  const variant: TagVariant = 'info';
  
  const tagProps: TagProps = {
    text: 'Custom',
    size,
    variant,
    uppercase: true,
  };
  
  return <Tag {...tagProps} />;
};
```

---

## Troubleshooting

### Issue: Icons not showing

**Problem:**
```tsx
<Tag text="Check" icon="check" />  // ❌ Won't work
```

**Solution:**
```tsx
import {CheckIcon} from '@mattermost/compass-icons/components';
<Tag text="Check" icon={<CheckIcon />} />  // ✅ Works
```

---

### Issue: Tooltip not appearing

**Problem:**
```tsx
<Tag text="Info" tooltip="More info" />  // ❌ Missing TooltipComponent
```

**Solution:**
```tsx
import WithTooltip from 'components/with_tooltip';
<Tag 
  text="Info" 
  tooltip="More info"
  TooltipComponent={WithTooltip}  // ✅ Provide tooltip wrapper
/>
```

---

### Issue: Size names not working (from AlertTag migration)

**Problem:**
```tsx
<Tag text="Test" size="medium" />  // ❌ Old AlertTag size name
```

**Solution:**
```tsx
<Tag text="Test" size="md" />  // ✅ Use new size name
```

---

### Issue: GuestTag not respecting HideGuestTags config

Make sure you're using the `GuestTag` component from the design system, not the base `Tag` with `preset="guest"`:

**Correct:**
```tsx
import {GuestTag} from '@mattermost/design-system';
<GuestTag />  // ✅ Includes Redux logic
```

**Won't work:**
```tsx
import {Tag} from '@mattermost/design-system';
<Tag preset="guest" />  // ❌ Doesn't check config
```

---

## Migration Checklist

- [ ] Identify all usages of old tag components in your codebase
- [ ] Update imports to use `@mattermost/design-system`
- [ ] Update icon props from strings to React components
- [ ] Update AlertTag size props (`small` → `sm`, `medium` → `md`, `large` → `lg`)
- [ ] Update tooltip props (`tooltipTitle` → `tooltip` + `TooltipComponent`)
- [ ] Test visual appearance in all relevant views
- [ ] Test interactive functionality (clicks, keyboard navigation)
- [ ] Test i18n translations (if using BetaTag, BotTag, GuestTag)
- [ ] Test responsive behavior
- [ ] Update unit tests to import from new location
- [ ] Update Storybook stories (if any)
- [ ] Remove old component imports once migration is complete

---

## Need Help?

- 📖 See [README.md](./README.md) for complete API documentation
- 🎨 Check Storybook for visual examples and interactive demos
- 🧪 Review [tag.test.tsx](./tag.test.tsx) for usage examples
- 💬 Ask in the #mattermost-developers channel

---

## Next Steps

After migrating your components:

1. **Remove old imports** - Clean up unused imports from `components/widgets/tag/`
2. **Update tests** - Ensure your component tests use the new imports
3. **Update documentation** - Update any component documentation to reflect the new usage
4. **Consider deprecation** - Once all components are migrated, the old tag components can be deprecated

---

## Version Compatibility

| Version | Status |
|---------|--------|
| Design System v10.12.0+ | ✅ Tag component available |
| Older versions | ❌ Use old widget components |

---

## Feedback

If you encounter any issues during migration or have suggestions for improvements, please:
- Open an issue in the Mattermost repository
- Provide details about the migration challenge
- Include code examples if possible

We're committed to making this migration as smooth as possible!

