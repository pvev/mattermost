// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Tag from './tag';

const meta: Meta<typeof Tag> = {
    title: 'Widgets/Tag',
    component: Tag,
    tags: ['autodocs'],
    argTypes: {
        text: {
            control: 'text',
            description: 'The text content of the tag',
        },
        preset: {
            control: 'select',
            options: ['bot', 'guest', 'beta'],
            description: 'Predefined tag presets (bot, guest, beta)',
        },
        variant: {
            control: 'select',
            options: ['default', 'info', 'success', 'warning', 'danger', 'dangerDim'],
            description: 'Visual color variant',
        },
        size: {
            control: 'select',
            options: ['xs', 'sm', 'md', 'lg'],
            description: 'Size of the tag',
        },
        uppercase: {
            control: 'boolean',
            description: 'Display text in uppercase',
        },
        icon: {
            control: 'text',
            description: 'Icon name from Compass Icons',
        },
        tooltipTitle: {
            control: 'text',
            description: 'Tooltip text to display on hover',
        },
        onClick: {
            action: 'clicked',
            description: 'Click handler for interactive tags',
        },
    },
};

export default meta;
type Story = StoryObj<typeof Tag>;

// Basic example
export const Default: Story = {
    args: {
        text: 'Tag',
        size: 'xs',
    },
};

// Individual variant examples
export const Info: Story = {
    args: {
        text: 'Info',
        variant: 'info',
        size: 'sm',
    },
};

export const Success: Story = {
    args: {
        text: 'Success',
        variant: 'success',
        size: 'sm',
    },
};

export const Warning: Story = {
    args: {
        text: 'Warning',
        variant: 'warning',
        size: 'sm',
    },
};

export const Danger: Story = {
    args: {
        text: 'Danger',
        variant: 'danger',
        size: 'sm',
    },
};

// Show all size variants
export const Sizes: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
            <Tag
                text='Extra Small'
                size='xs'
            />
            <Tag
                text='Small'
                size='sm'
            />
            <Tag
                text='Medium'
                size='md'
            />
            <Tag
                text='Large'
                size='lg'
            />
        </div>
    ),
};

// Show all color variants
export const Variants: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
            <Tag
                text='Default'
                variant='default'
                size='sm'
            />
            <Tag
                text='Info'
                variant='info'
                size='sm'
            />
            <Tag
                text='Success'
                variant='success'
                size='sm'
            />
            <Tag
                text='Warning'
                variant='warning'
                size='sm'
            />
            <Tag
                text='Danger'
                variant='danger'
                size='sm'
            />
            <Tag
                text='Danger Dim'
                variant='dangerDim'
                size='sm'
            />
        </div>
    ),
};

// Tag with icon
export const WithIcon: Story = {
    args: {
        text: 'With Icon',
        variant: 'info',
        size: 'md',
        icon: 'check',
    },
};

// Tag with tooltip (NEW feature)
export const WithTooltip: Story = {
    args: {
        text: 'Hover Me',
        variant: 'info',
        size: 'md',
        tooltipTitle: 'This is a tooltip!',
    },
};

// Interactive clickable tag
export const Clickable: Story = {
    args: {
        text: 'Click Me',
        variant: 'info',
        size: 'md',
        // eslint-disable-next-line no-alert
        onClick: () => alert('Tag clicked!'),
    },
};

// Preset tags: bot, guest, beta
export const Presets: Story = {
    render: () => (
        <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
            <div>
                <strong>{'Bot preset:'}</strong>
                <div style={{marginTop: '8px', display: 'flex', gap: '8px'}}>
                    <Tag preset='bot'/>
                    <Tag
                        preset='bot'
                        size='sm'
                    />
                    <Tag
                        preset='bot'
                        size='md'
                    />
                    <Tag
                        preset='bot'
                        size='lg'
                    />
                </div>
            </div>
            <div>
                <strong>{'Guest preset:'}</strong>
                <div style={{marginTop: '8px', display: 'flex', gap: '8px'}}>
                    <Tag preset='guest'/>
                    <Tag
                        preset='guest'
                        size='sm'
                    />
                    <Tag
                        preset='guest'
                        size='md'
                    />
                    <Tag
                        preset='guest'
                        size='lg'
                    />
                </div>
            </div>
            <div>
                <strong>{'Beta preset:'}</strong>
                <div style={{marginTop: '8px', display: 'flex', gap: '8px'}}>
                    <Tag preset='beta'/>
                    <Tag
                        preset='beta'
                        size='sm'
                    />
                    <Tag
                        preset='beta'
                        size='md'
                    />
                    <Tag
                        preset='beta'
                        size='lg'
                    />
                </div>
            </div>
        </div>
    ),
};

// Preset overrides: customize preset defaults
export const PresetOverrides: Story = {
    render: () => (
        <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
            <div>
                <strong>{'Override preset text:'}</strong>
                <div style={{marginTop: '8px', display: 'flex', gap: '8px'}}>
                    <Tag preset='bot'/>
                    <Tag
                        preset='bot'
                        text='Custom Bot'
                    />
                </div>
            </div>
            <div>
                <strong>{'Override preset variant:'}</strong>
                <div style={{marginTop: '8px', display: 'flex', gap: '8px'}}>
                    <Tag preset='beta'/>
                    <Tag
                        preset='beta'
                        variant='success'
                    />
                    <Tag
                        preset='beta'
                        variant='warning'
                    />
                </div>
            </div>
        </div>
    ),
};
