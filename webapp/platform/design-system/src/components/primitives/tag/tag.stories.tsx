// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Tag from './tag';
import TagGroup from './tag_group';
import WithTooltip from '../with_tooltip';

// Mock Compass Icon for demonstration
const MockIcon = ({size = 16}: {size?: number}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
);

const meta: Meta<typeof Tag> = {
    title: 'DesignSystem/Primitives/Tag',
    component: Tag,
    tags: ['autodocs'],
    argTypes: {
        text: {
            control: 'text',
            description: 'The text content of the tag',
        },
        preset: {
            control: 'select',
            options: ['custom', 'beta', 'bot', 'guest'],
            description: 'Predefined tag type',
        },
        variant: {
            control: 'select',
            options: ['default', 'info', 'success', 'warning', 'danger', 'dangerDim', 'primary', 'secondary'],
            description: 'The visual variant of the tag',
        },
        size: {
            control: 'select',
            options: ['xs', 'sm', 'md', 'lg'],
            description: 'The size of the tag',
        },
        uppercase: {
            control: 'boolean',
            description: 'Whether to display text in uppercase',
        },
        fullWidth: {
            control: 'boolean',
            description: 'Whether the tag should take full width',
        },
        onClick: {
            action: 'clicked',
            description: 'Click handler for interactive tags',
        },
    },
};

export default meta;
type Story = StoryObj<typeof Tag>;

// Basic Examples
export const Default: Story = {
    render: () => (
        <div style={{padding: '20px', background: '#f0f0f0'}}>
            <Tag text="Default Tag" variant="default" size="xs" />
        </div>
    ),
};

export const Info: Story = {
    render: () => (
        <div style={{padding: '20px', background: '#f0f0f0'}}>
            <Tag text="Info" variant="info" size="sm" uppercase={true} />
        </div>
    ),
};

export const Success: Story = {
    render: () => (
        <div style={{padding: '20px', background: '#f0f0f0'}}>
            <Tag text="Success" variant="success" size="sm" uppercase={true} />
        </div>
    ),
};

export const Warning: Story = {
    render: () => (
        <div style={{padding: '20px', background: '#f0f0f0'}}>
            <Tag text="Warning" variant="warning" size="sm" uppercase={true} />
        </div>
    ),
};

export const Danger: Story = {
    render: () => (
        <div style={{padding: '20px', background: '#f0f0f0'}}>
            <Tag text="Danger" variant="danger" size="sm" uppercase={true} />
        </div>
    ),
};

export const DangerDim: Story = {
    render: () => (
        <div style={{padding: '20px', background: '#f0f0f0'}}>
            <Tag text="Danger Dim" variant="dangerDim" size="sm" uppercase={true} />
        </div>
    ),
};

// Size Variants
export const Sizes: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
            <Tag text="Extra Small" size="xs" variant="info"/>
            <Tag text="Small" size="sm" variant="info"/>
            <Tag text="Medium" size="md" variant="info"/>
            <Tag text="Large" size="lg" variant="info"/>
        </div>
    ),
};

// All Variants
export const AllVariants: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
            <Tag text="Default" variant="default" size="sm" uppercase={true}/>
            <Tag text="Primary" variant="primary" size="sm" uppercase={true}/>
            <Tag text="Info" variant="info" size="sm" uppercase={true}/>
            <Tag text="Success" variant="success" size="sm" uppercase={true}/>
            <Tag text="Warning" variant="warning" size="sm" uppercase={true}/>
            <Tag text="Danger" variant="danger" size="sm" uppercase={true}/>
            <Tag text="Danger Dim" variant="dangerDim" size="sm" uppercase={true}/>
        </div>
    ),
};

// Preset Tags
export const BetaTag: Story = {
    name: 'Preset: Beta',
    render: () => (
        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
            <Tag preset="beta" size="xs"/>
            <Tag preset="beta" size="sm"/>
            <Tag preset="beta" size="md"/>
            <Tag preset="beta" size="lg"/>
        </div>
    ),
};

export const BotTag: Story = {
    name: 'Preset: Bot',
    render: () => (
        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
            <Tag preset="bot" size="xs"/>
            <Tag preset="bot" size="sm"/>
            <Tag preset="bot" size="md"/>
            <Tag preset="bot" size="lg"/>
        </div>
    ),
};

export const GuestTag: Story = {
    name: 'Preset: Guest',
    render: () => (
        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
            <Tag preset="guest" size="xs"/>
            <Tag preset="guest" size="sm"/>
            <Tag preset="guest" size="md"/>
            <Tag preset="guest" size="lg"/>
        </div>
    ),
};

// With Icon
export const WithIcon: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexDirection: 'column', alignItems: 'flex-start'}}>
            <Tag text="With Icon" icon={<MockIcon/>} variant="success" size="xs"/>
            <Tag text="With Icon" icon={<MockIcon/>} variant="success" size="sm"/>
            <Tag text="With Icon" icon={<MockIcon/>} variant="info" size="md"/>
            <Tag text="With Icon" icon={<MockIcon/>} variant="warning" size="lg"/>
        </div>
    ),
};

// Clickable
export const Clickable: Story = {
    render: () => (
        <div style={{padding: '20px', background: '#f0f0f0'}}>
            <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
                <Tag 
                    text="Click Me" 
                    variant="info" 
                    size="sm"
                    uppercase={true}
                    // eslint-disable-next-line no-alert
                    onClick={() => alert('Tag clicked!')}
                />
                <Tag 
                    text="Clickable with Icon" 
                    icon={<MockIcon/>}
                    variant="success" 
                    size="md"
                    uppercase={true}
                    // eslint-disable-next-line no-alert
                    onClick={() => alert('Tag with icon clicked!')}
                />
            </div>
        </div>
    ),
};

// With Tooltip
export const WithTooltipStory: Story = {
    name: 'With Tooltip',
    render: () => (
        <div style={{padding: '20px', background: '#f0f0f0'}}>
            <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                <Tag 
                    text="Hover Me" 
                    variant="info" 
                    size="md"
                    uppercase={true}
                    tooltip="This is additional information about the tag"
                    TooltipComponent={WithTooltip}
                />
                <Tag 
                    text="User Info" 
                    variant="success" 
                    size="sm"
                    tooltip="Additional user context information"
                    TooltipComponent={WithTooltip}
                />
            </div>
        </div>
    ),
};

// Long Text Overflow
export const LongTextOverflow: Story = {
    render: () => (
        <div style={{maxWidth: '200px', padding: '20px', border: '1px dashed #ccc'}}>
            <Tag 
                text="This is a very long tag text that will overflow" 
                variant="info" 
                size="sm"
            />
        </div>
    ),
};

// Full Width
export const FullWidth: Story = {
    render: () => (
        <div style={{width: '300px', padding: '20px', border: '1px dashed #ccc'}}>
            <Tag 
                text="Full Width Tag" 
                variant="primary" 
                size="md"
                fullWidth={true}
            />
        </div>
    ),
};

// Tag Group Examples
export const TagGroupExample: Story = {
    render: () => (
        <TagGroup>
            <Tag preset="beta" size="sm"/>
            <Tag preset="bot" size="sm"/>
            <Tag preset="guest" size="sm"/>
            <Tag text="Custom" variant="warning" size="sm" uppercase={true}/>
        </TagGroup>
    ),
};

export const TagGroupWithIcons: Story = {
    render: () => (
        <TagGroup>
            <Tag text="Active" icon={<MockIcon/>} variant="success" size="sm"/>
            <Tag text="Pending" icon={<MockIcon/>} variant="warning" size="sm"/>
            <Tag text="Error" icon={<MockIcon/>} variant="danger" size="sm"/>
        </TagGroup>
    ),
};

// Mixed Sizes in Group
export const MixedSizesInGroup: Story = {
    render: () => (
        <TagGroup>
            <Tag text="XS" variant="info" size="xs"/>
            <Tag text="Small" variant="success" size="sm"/>
            <Tag text="Medium" variant="warning" size="md"/>
            <Tag text="Large" variant="danger" size="lg"/>
        </TagGroup>
    ),
};

// Example: Status Indicators
export const StatusIndicators: Story = {
    name: 'Status Indicators',
    render: () => (
        <div style={{padding: '20px'}}>
            <TagGroup>
                <Tag text="Online" icon={<MockIcon/>} variant="success" size="sm"/>
                <Tag text="Away" icon={<MockIcon/>} variant="warning" size="sm"/>
                <Tag text="Do Not Disturb" icon={<MockIcon/>} variant="danger" size="sm"/>
                <Tag text="Offline" variant="default" size="sm"/>
            </TagGroup>
        </div>
    ),
};

