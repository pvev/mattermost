// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useMemo} from 'react';
import type {MouseEventHandler, ReactNode} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import glyphMap from '@mattermost/compass-icons/components';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';
import WithTooltip from '@mattermost/design-system/src/components/primitives/with_tooltip';
import type {GlobalState} from '@mattermost/types/store';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import './tag.scss';

export type TagVariant = 'info' | 'success' | 'warning' | 'danger' | 'dangerDim' | 'default';

export type TagSize = 'xs' | 'sm' | 'md' | 'lg';

export type TagPreset = 'bot' | 'guest' | 'beta';

type Props = {
    text?: React.ReactNode;
    preset?: TagPreset;
    uppercase?: boolean;
    icon?: IconGlyphTypes;
    variant?: TagVariant;
    size?: TagSize;
    onClick?: MouseEventHandler;
    className?: string;
    tooltipTitle?: string | ReactNode;
};

const Tag = ({
    preset,
    variant: variantProp,
    onClick,
    className: classNameProp,
    text: textProp,
    icon: iconName,
    size: sizeProp = 'xs',
    uppercase: uppercaseProp,
    tooltipTitle,
    ...rest
}: Props) => {
    // All hooks MUST be called unconditionally at the top
    const {formatMessage} = useIntl();
    const shouldHideGuestTag = useSelector((state: GlobalState) => getConfig(state).HideGuestTags === 'true');

    // Determine preset configuration
    const presetConfig = useMemo(() => {
        switch (preset) {
        case 'bot':
            return {
                text: formatMessage({id: 'tag.default.bot', defaultMessage: 'BOT'}),
                uppercase: true,
                className: 'BotTag',
            };
        case 'guest':
            return {
                text: formatMessage({id: 'tag.default.guest', defaultMessage: 'GUEST'}),
                uppercase: false,
                className: 'GuestTag',
            };
        case 'beta':
            return {
                text: formatMessage({id: 'tag.default.beta', defaultMessage: 'BETA'}),
                uppercase: true,
                variant: 'info' as TagVariant,
                className: 'BetaTag',
            };
        default:
            return {};
        }
    }, [preset, formatMessage]);

    const iconSize = useMemo(() => {
        switch (sizeProp) {
        case 'lg':
            return 16;
        case 'md':
            return 14;
        case 'sm':
            return 12;
        case 'xs':
        default:
            return 10;
        }
    }, [sizeProp]);

    // Handle guest preset special case: hide if config says so
    // This conditional return MUST come after all hooks
    if (preset === 'guest' && shouldHideGuestTag) {
        return null;
    }

    // Merge preset config with explicit props (explicit props take precedence)
    const text = textProp ?? presetConfig.text;
    const uppercase = uppercaseProp ?? presetConfig.uppercase ?? false;
    const variant = variantProp ?? presetConfig.variant;
    const size = sizeProp;

    // Build className using BEM convention
    const className = classNames(
        'Tag',
        `Tag--${size}`,
        {
            [`Tag--${variant}`]: variant,
            'Tag--uppercase': uppercase,
            'Tag--clickable': Boolean(onClick),
        },
        presetConfig.className,
        classNameProp,
    );

    const Icon = iconName ? glyphMap[iconName] : null;

    const tagElement = onClick ? (
        <button
            {...rest}
            type='button'
            onClick={onClick}
            className={className}
        >
            {Icon && (
                <span className='Tag__icon'>
                    <Icon size={iconSize}/>
                </span>
            )}
            <span className='Tag__text'>
                {text}
            </span>
        </button>
    ) : (
        <div
            {...rest}
            className={className}
        >
            {Icon && (
                <span className='Tag__icon'>
                    <Icon size={iconSize}/>
                </span>
            )}
            <span className='Tag__text'>
                {text}
            </span>
        </div>
    );

    // Wrap with tooltip if tooltipTitle is provided
    if (tooltipTitle) {
        return (
            <WithTooltip title={tooltipTitle}>
                {tagElement}
            </WithTooltip>
        );
    }

    return tagElement;
};

export default memo(Tag);
