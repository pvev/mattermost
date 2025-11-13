// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useIntl} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

import './burn_on_read_badge.scss';

type Props = {

    /** The ID of the post */
    postId: string;

    /** Whether the current user is the sender of the post */
    isSender: boolean;

    /** Whether the post content has been revealed (for recipients) */
    revealed: boolean;

    /** Number of recipients who have not yet revealed the post (sender only) */
    revealedByCount?: number;

    /** Total number of recipients (sender only) */
    totalRecipients?: number;
};

function BurnOnReadBadge({
    postId,
    isSender,
    revealed,
    revealedByCount = 0,
    totalRecipients = 0,
}: Props) {
    const {formatMessage} = useIntl();

    const getTooltipContent = () => {
        if (isSender && !revealed) {
            const notReadCount = totalRecipients - revealedByCount;
            return formatMessage(
                {
                    id: 'burn_on_read.badge.sender.not_read',
                    defaultMessage: 'Message will be deleted after all recipients have read it\nNot read by {count, plural, one {# person} other {# people}}',
                },
                {count: notReadCount},
            );
        }

        if (!isSender && !revealed) {
            return formatMessage({
                id: 'burn_on_read.badge.recipient.click_to_reveal',
                defaultMessage: 'Click to Reveal',
            });
        }

        // For revealed posts, timer chip will be shown separately (PR #2)
        return null;
    };

    const tooltipContent = getTooltipContent();

    // Don't render anything if there's no tooltip content
    if (!tooltipContent) {
        return null;
    }

    return (
        <WithTooltip
            id={`burn-on-read-tooltip-${postId}`}
            title={<div style={{whiteSpace: 'pre-line'}}>{tooltipContent}</div>}
            isVertical={true}
        >
            <span
                className='BurnOnReadBadge'
                data-testid={`burn-on-read-badge-${postId}`}
                aria-label={tooltipContent}
            >
                <i
                    className='icon icon-fire'
                    aria-hidden='true'
                />
            </span>
        </WithTooltip>
    );
}

export default memo(BurnOnReadBadge);
