// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {useEphemeralModeSession} from 'hooks/useEphemeralModeSession';

import type {GlobalState} from 'types/store';

type Props = {
    channelId: string;
    lastMessageAt?: number;
};

/**
 * Renders a banner above the message list when an ephemeral session is active.
 * Uses the same DOM structure and CSS as the native ChannelBanner component for
 * visual consistency, but with a green ephemeral-specific colour.
 * Also mounts the session lifecycle hook (disconnect detection + inactivity timer).
 */
const EphemeralModeBanner = ({channelId, lastMessageAt}: Props) => {
    const {formatMessage} = useIntl();
    const status = useSelector((state: GlobalState) => state.views.ephemeralMode[channelId]?.status);

    useEphemeralModeSession(channelId, lastMessageAt);

    if (status !== 'active') {
        return null;
    }

    return (
        <div
            className='channel_banner ephemeral-mode-channel-banner'
            data-testid='ephemeral_mode_banner'
            style={{backgroundColor: 'rgba(61, 184, 98, 0.15)', borderBottom: '1px solid rgba(61, 184, 98, 0.4)'}}
        >
            <span
                className='channel_banner_text'
                style={{color: 'var(--online-indicator)', fontWeight: 600}}
            >
                {'🔒 '}
                {formatMessage({
                    id: 'ephemeral_dm.banner_active',
                    defaultMessage: 'Ephemeral mode is active — messages are not saved and will disappear when you leave.',
                })}
            </span>
        </div>
    );
};

export default EphemeralModeBanner;
