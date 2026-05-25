// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {AccessControlTemporaryAccess} from '@mattermost/types/access_control';
import type {ChannelBanner} from '@mattermost/types/channels';

import {Client4} from 'mattermost-redux/client';
import {selectShowChannelBanner} from 'mattermost-redux/selectors/entities/channel_banner';
import {getChannel, getChannelBanner} from 'mattermost-redux/selectors/entities/channels';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getContrastingSimpleColor} from 'mattermost-redux/utils/theme_utils';

import useChannelClassificationBanner from 'components/common/hooks/useChannelClassificationBanner';
import Markdown from 'components/markdown';

import {useBurnOnReadTimer} from 'hooks/useBurnOnReadTimer';
import {isMinimumEnterpriseAdvancedLicense} from 'utils/license_utils';
import type {TextFormattingOptions} from 'utils/text_formatting';

import type {GlobalState} from 'types/store';

import './style.scss';

const markdownRenderingOptions: Partial<TextFormattingOptions> = {
    singleline: true,
    mentionHighlight: false,
};

function getMyAccessControlTemporaryAccesses() {
    return Client4.getMyAccessControlTemporaryAccesses();
}

function formatTemporaryAccessTimeLeft(remainingMs: number): string {
    const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (days > 0) {
        parts.push(`${days}d`);
    }
    if (days > 0 || hours > 0) {
        parts.push(`${hours}h`);
    }
    parts.push(`${minutes.toString().padStart(2, '0')}m`);
    parts.push(`${seconds.toString().padStart(2, '0')}s`);

    return parts.join(' ');
}

type Props = {
    channelId: string;
}

export default function ChannelBanner({channelId}: Props) {
    const intl = useIntl();
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    const channelBannerInfo = useSelector((state: GlobalState) => getChannelBanner(state, channelId));
    const license = useSelector(getLicense);
    const licenseEnabled = isMinimumEnterpriseAdvancedLicense(license);
    const channelBannerConfigured = useSelector((state: GlobalState) => selectShowChannelBanner(state, channelId));
    const showNativeBanner = licenseEnabled && channelBannerConfigured;

    const classificationBanner = useChannelClassificationBanner(channelId);
    const [temporaryAccess, setTemporaryAccess] = useState<AccessControlTemporaryAccess | null>(null);
    const temporaryAccessTimer = useBurnOnReadTimer({expireAt: temporaryAccess?.expires_at || null});
    const temporaryAccessTimeLeft = formatTemporaryAccessTimeLeft(temporaryAccessTimer.remainingMs);

    useEffect(() => {
        let cancelled = false;
        async function loadTemporaryAccess() {
            if (!channelId) {
                setTemporaryAccess(null);
                return;
            }
            try {
                const result = await getMyAccessControlTemporaryAccesses();
                if (cancelled) {
                    return;
                }
                const matching = result.temporary_accesses.find((temporaryAccess) => {
                    if (temporaryAccess.resource_type === 'channel' && temporaryAccess.resource_id === channelId) {
                        return true;
                    }
                    return Boolean(channel?.team_id && temporaryAccess.resource_type === 'team' && temporaryAccess.resource_id === channel.team_id);
                });
                setTemporaryAccess(matching || null);
            } catch {
                setTemporaryAccess(null);
            }
        }
        loadTemporaryAccess();
        return () => {
            cancelled = true;
        };
    }, [channel?.team_id, channelId]);

    // Classification property value takes priority over native banner_info
    const temporaryAccessBanner: ChannelBanner | undefined = temporaryAccess ? {
        enabled: true,
        text: intl.formatMessage(
            {id: 'access_control_temporary_access_banner.text', defaultMessage: 'Temporary access until {expiresAt}. Time left: {timeLeft}'},
            {
                expiresAt: new Date(temporaryAccess.expires_at).toLocaleString(),
                timeLeft: temporaryAccessTimeLeft,
            },
        ),
        background_color: '#1c58d9',
    } : undefined;

    const effectiveBanner: ChannelBanner | undefined = temporaryAccessBanner || (classificationBanner.hasClassification ?
        classificationBanner.classificationBanner :
        channelBannerInfo);

    const showBanner = Boolean(temporaryAccessBanner) || classificationBanner.hasClassification || showNativeBanner;

    const textContainerRef = useRef<HTMLSpanElement>(null);
    const [tooltipNeeded, setTooltipNeeded] = React.useState<boolean>(false);

    useEffect(() => {
        if (!textContainerRef.current) {
            return;
        }

        const isOverflowingHorizontally = textContainerRef.current.offsetWidth < textContainerRef.current.scrollWidth;
        const isOverflowingVertically = textContainerRef.current.offsetHeight < textContainerRef.current.scrollHeight;

        setTooltipNeeded(isOverflowingHorizontally || isOverflowingVertically);
    }, [effectiveBanner?.text]);

    const channelBannerTextAriaLabel = intl.formatMessage({id: 'channel_banner.aria_label', defaultMessage: 'Channel banner text'});

    const content = (
        <Markdown
            message={effectiveBanner?.text}
            options={markdownRenderingOptions}
        />
    );

    const channelBannerStyle = useMemo(() => {
        return {
            backgroundColor: effectiveBanner?.background_color,
        };
    }, [effectiveBanner]);

    const channelBannerTextStyle = useMemo(() => {
        if (!effectiveBanner || !effectiveBanner.background_color) {
            return {};
        }

        const color = getContrastingSimpleColor(effectiveBanner.background_color);

        // The CSS variable is declared here, and is being used in the stylesheet being imported in this component.
        // This is needed because if the user sets background color a share of blue similar to the default link color,
        // the markdown link will become almost invisible. So, the CSS variable declared here is used
        // to set the color of the text in anchor tag in the stylesheet.
        return {
            color,
            '--channel-banner-text-color': color,
        };
    }, [effectiveBanner]);

    if (!effectiveBanner || !showBanner) {
        return null;
    }

    return (
        <WithTooltip
            title={content}
            className='channelBannerTooltip'
            delayClose={true}
            forcedPlacement='bottom'
            disabled={!tooltipNeeded}
        >
            <div
                className='channel_banner'
                data-testid='channel_banner_container'
                style={channelBannerStyle}
            >
                <span
                    data-testid='channel_banner_text'
                    className='channel_banner_text'
                    aria-label={channelBannerTextAriaLabel}
                    style={channelBannerTextStyle}
                    ref={textContainerRef}
                >
                    {content}
                </span>
            </div>
        </WithTooltip>
    );
}
