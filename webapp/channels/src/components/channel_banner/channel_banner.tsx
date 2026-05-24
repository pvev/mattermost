// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {AccessControlBypass} from '@mattermost/types/access_control';
import type {ChannelBanner} from '@mattermost/types/channels';

import Client4 from 'mattermost-redux/client/client4';
import {selectShowChannelBanner} from 'mattermost-redux/selectors/entities/channel_banner';
import {getChannel, getChannelBanner} from 'mattermost-redux/selectors/entities/channels';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getContrastingSimpleColor} from 'mattermost-redux/utils/theme_utils';

import useChannelClassificationBanner from 'components/common/hooks/useChannelClassificationBanner';
import Markdown from 'components/markdown';

import {isMinimumEnterpriseAdvancedLicense} from 'utils/license_utils';
import type {TextFormattingOptions} from 'utils/text_formatting';

import type {GlobalState} from 'types/store';

import './style.scss';

const markdownRenderingOptions: Partial<TextFormattingOptions> = {
    singleline: true,
    mentionHighlight: false,
};

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
    const [temporaryAccessBypass, setTemporaryAccessBypass] = useState<AccessControlBypass | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function loadTemporaryAccess() {
            if (!channelId) {
                setTemporaryAccessBypass(null);
                return;
            }
            try {
                const result = await Client4.getMyAccessControlBypasses();
                if (cancelled) {
                    return;
                }
                const matching = result.bypasses.find((bypass) => {
                    if (bypass.resource_type === 'channel' && bypass.resource_id === channelId) {
                        return true;
                    }
                    return Boolean(channel?.team_id && bypass.resource_type === 'team' && bypass.resource_id === channel.team_id);
                });
                setTemporaryAccessBypass(matching || null);
            } catch {
                setTemporaryAccessBypass(null);
            }
        }
        loadTemporaryAccess();
        return () => {
            cancelled = true;
        };
    }, [channel?.team_id, channelId]);

    // Classification property value takes priority over native banner_info
    const temporaryAccessBanner: ChannelBanner | undefined = temporaryAccessBypass ? {
        enabled: true,
        text: intl.formatMessage(
            {id: 'access_control_bypass_banner.text', defaultMessage: 'Temporary access until {expiresAt}'},
            {expiresAt: new Date(temporaryAccessBypass.expires_at).toLocaleString()},
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
