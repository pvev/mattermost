// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import './burn_on_read_screenshot_warning_modal.scss';

interface Props {
    /** Whether the modal is currently visible */
    show: boolean;

    /** Callback invoked when user acknowledges the warning */
    onConfirm: () => void;
}

/**
 * Modal displayed when a screenshot attempt is detected on a revealed Burn-on-Read message.
 *
 * This modal is intentionally restrictive:
 * - Cannot be closed via backdrop click
 * - Cannot be closed via Escape key
 * - No X close button
 * - Only way to dismiss is clicking "I Understand"
 *
 * The backdrop is fully opaque to prevent viewing the content while the modal is open.
 */
const BurnOnReadScreenshotWarningModal: React.FC<Props> = ({show, onConfirm}) => {
    const {formatMessage} = useIntl();

    const handleConfirm = useCallback(() => {
        onConfirm();
    }, [onConfirm]);

    const title = formatMessage({
        id: 'post.burn_on_read.screenshot_warning.title',
        defaultMessage: 'Screenshots Not Allowed',
    });

    const message = formatMessage({
        id: 'post.burn_on_read.screenshot_warning.body',
        defaultMessage: 'Taking screenshots of Burn-on-Read messages is not permitted. These messages are designed to be temporary and confidential. Please respect the privacy of the conversation.',
    });

    const confirmButtonText = formatMessage({
        id: 'post.burn_on_read.screenshot_warning.acknowledge',
        defaultMessage: 'I Understand',
    });

    // Empty handler to prevent closing via backdrop or escape key
    const preventClose = useCallback((): void => {
        // Intentionally empty - modal can only be closed via confirm button
    }, []);

    return (
        <GenericModal
            id='burnOnReadScreenshotWarningModal'
            className='BurnOnReadScreenshotWarningModal'
            show={show}
            modalHeaderText={title}
            onHide={preventClose}
            backdrop='static'
            keyboardEscape={false}
            backdropClassName='BurnOnReadScreenshotWarningModal__backdrop'
            showCloseButton={false}
            compassDesign={true}
            handleConfirm={handleConfirm}
            confirmButtonText={confirmButtonText}
            autoCloseOnConfirmButton={true}
        >
            <div className='BurnOnReadScreenshotWarningModal__body'>
                {message}
            </div>
        </GenericModal>
    );
};

export default BurnOnReadScreenshotWarningModal;
