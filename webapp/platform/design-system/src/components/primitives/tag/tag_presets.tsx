// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import Tag from './tag';
import type {TagProps, TagSize, TagVariant} from './tag';

/**
 * Internationalized Beta Tag
 * Replacement for beta_tag.tsx with i18n support
 */
interface BetaTagProps {
    className?: string;
    size?: TagSize;
    variant?: TagVariant;
}

export const BetaTag: React.FC<BetaTagProps> = ({
    className = '',
    size = 'xs',
    variant = 'info',
}) => {
    const {formatMessage} = useIntl();
    return (
        <Tag
            text={formatMessage({
                id: 'tag.default.beta',
                defaultMessage: 'BETA',
            })}
            uppercase={true}
            size={size}
            variant={variant}
            className={className}
        />
    );
};

/**
 * Internationalized Bot Tag
 * Replacement for bot_tag.tsx with i18n support
 */
interface BotTagProps {
    className?: string;
    size?: TagSize;
}

export const BotTag: React.FC<BotTagProps> = ({
    className = '',
    size = 'xs',
}) => {
    const {formatMessage} = useIntl();
    return (
        <Tag
            text={formatMessage({
                id: 'tag.default.bot',
                defaultMessage: 'BOT',
            })}
            uppercase={true}
            size={size}
            className={className}
        />
    );
};

/**
 * Internationalized Guest Tag
 * Replacement for guest_tag.tsx with i18n support and config-based visibility
 */
interface GuestTagProps {
    className?: string;
    size?: TagSize;
}

export const GuestTag: React.FC<GuestTagProps> = ({
    className = '',
    size = 'xs',
}) => {
    const {formatMessage} = useIntl();
    
    // This selector function should be imported from the appropriate Redux module
    // For now, we're using a generic approach that works with the Mattermost Redux structure
    const shouldHideTag = useSelector((state: GlobalState) => {
        // Access config from Redux state
        // This assumes the standard Mattermost Redux structure
        const config = (state as any).entities?.general?.config;
        return config?.HideGuestTags === 'true';
    });

    // Don't render if the config says to hide guest tags
    if (shouldHideTag) {
        return null;
    }

    return (
        <Tag
            text={formatMessage({
                id: 'tag.default.guest',
                defaultMessage: 'GUEST',
            })}
            uppercase={true}
            size={size}
            className={className}
        />
    );
};

/**
 * Generic internationalized tag that uses the unified Tag component
 * Useful for creating custom preset tags with i18n support
 */
interface I18nTagProps extends Omit<TagProps, 'text'> {
    /** i18n message ID */
    messageId: string;
    /** Default message for i18n */
    defaultMessage: string;
}

export const I18nTag: React.FC<I18nTagProps> = ({
    messageId,
    defaultMessage,
    ...tagProps
}) => {
    const {formatMessage} = useIntl();
    return (
        <Tag
            text={formatMessage({
                id: messageId,
                defaultMessage,
            })}
            {...tagProps}
        />
    );
};

