// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect} from 'react';
import {useDispatch} from 'react-redux';

import {openModal, closeModal} from 'actions/views/modals';
import BurnOnReadScreenshotWarningModal from 'components/burn_on_read_screenshot_warning_modal/burn_on_read_screenshot_warning_modal';
import {ModalIdentifiers} from 'utils/constants';
import {screenshotDetectionManager} from 'utils/burn_on_read_screenshot_detection';

import type {ModalData} from 'types/actions';

/**
 * React hook for screenshot detection on Burn-on-Read messages.
 *
 * This hook manages the lifecycle of screenshot detection listeners.
 * When `isVisible` is true (indicating a revealed BoR message is displayed),
 * it registers with the global ScreenshotDetectionManager. When a screenshot
 * attempt is detected, it displays a warning modal.
 *
 * The hook automatically handles cleanup when the component unmounts or
 * when `isVisible` becomes false.
 *
 * @param isVisible - Whether a BoR timer chip (revealed message) is currently visible
 *
 * @example
 * // In a BoR timer chip component:
 * function BurnOnReadTimerChip({ expireAt }) {
 *     useBurnOnReadScreenshotDetection(true);
 *     return <div className="timer">{formatTime(expireAt)}</div>;
 * }
 */
export function useBurnOnReadScreenshotDetection(isVisible: boolean): void {
    const dispatch = useDispatch();

    const handleScreenshotDetected = useCallback(() => {
        const modalData: ModalData = {
            modalId: ModalIdentifiers.BURN_ON_READ_SCREENSHOT_WARNING,
            dialogType: BurnOnReadScreenshotWarningModal,
            dialogProps: {
                show: true,
                onConfirm: () => {
                    dispatch(closeModal(ModalIdentifiers.BURN_ON_READ_SCREENSHOT_WARNING));
                },
            },
        };

        dispatch(openModal(modalData));
    }, [dispatch]);

    useEffect(() => {
        if (!isVisible) {
            return undefined;
        }

        // Register with the global manager
        screenshotDetectionManager.register(handleScreenshotDetected);

        // Cleanup: unregister when component unmounts or isVisible becomes false
        return () => {
            screenshotDetectionManager.unregister();
        };
    }, [isVisible, handleScreenshotDetected]);
}
