// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {useIntl} from 'react-intl';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import './burn_on_read_concealed_placeholder.scss';

type Props = {

    /** The ID of the post to reveal */
    postId: string;

    /** The author's display name or username for accessibility */
    authorName: string;

    /** Callback function to trigger the reveal action */
    onReveal: (postId: string) => void;

    /** Whether the reveal action is currently in progress */
    loading?: boolean;

    /** Error message to display if reveal failed */
    error?: string | null;
};

function BurnOnReadConcealedPlaceholder({
    postId,
    authorName,
    onReveal,
    loading = false,
    error = null,
}: Props) {
    const {formatMessage} = useIntl();

    const handleClick = useCallback(() => {
        if (!loading) {
            onReveal(postId);
        }
    }, [postId, onReveal, loading]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if ((e.key === 'Enter' || e.key === ' ') && !loading) {
            e.preventDefault();
            onReveal(postId);
        }
    }, [postId, onReveal, loading]);

    const ariaLabel = formatMessage(
        {
            id: 'burn_on_read.concealed.aria_label',
            defaultMessage: 'Burn-on-read message from {author}. Click to reveal content.',
        },
        {author: authorName},
    );

    return (
        <div
            className={`BurnOnReadConcealedPlaceholder ${loading ? 'BurnOnReadConcealedPlaceholder--loading' : ''} ${error ? 'BurnOnReadConcealedPlaceholder--error' : ''}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            role='button'
            tabIndex={0}
            aria-label={ariaLabel}
            data-testid={`burn-on-read-concealed-${postId}`}
        >
            {loading ? (
                <LoadingSpinner/>
            ) : (
                <div
                    className='BurnOnReadConcealedPlaceholder__text'
                    aria-hidden='true'
                >
                    {formatMessage({
                        id: 'post.burn_on_read.concealed_placeholder',
                        defaultMessage: 'This message is concealed and will be revealed when you click on it to view the content',
                    })}
                </div>
            )}

            {error && (
                <div
                    className='BurnOnReadConcealedPlaceholder__error'
                    role='alert'
                >
                    {error}
                </div>
            )}
        </div>
    );
}

export default memo(BurnOnReadConcealedPlaceholder);
