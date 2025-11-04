// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useSelector} from 'react-redux';

import {
    isBurnOnReadEnabled,
    getBurnOnReadDurationMinutes,
    canUserSendBurnOnRead,
} from 'selectors/burn_on_read';

import BurnOnReadButton from 'components/burn_on_read/burn_on_read_button';
import BurnOnReadLabel from 'components/burn_on_read/burn_on_read_label';
import BurnOnReadTourTip from 'components/burn_on_read/burn_on_read_tour_tip';

import 'components/burn_on_read/burn_on_read_control.scss';

import type {PostDraft} from 'types/store/draft';

const useBurnOnRead = (
    draft: PostDraft,
    handleDraftChange: (draft: PostDraft, options: {instant?: boolean; show?: boolean}) => void,
    focusTextbox: (keepFocus?: boolean) => void,
    shouldShowPreview: boolean,
    showIndividualCloseButton = true,
) => {
    const rootId = draft.rootId;
    const isEnabled = useSelector(isBurnOnReadEnabled);
    const durationMinutes = useSelector(getBurnOnReadDurationMinutes);
    const canSend = useSelector(canUserSendBurnOnRead);

    // Check if BoR is active in draft
    const hasBurnOnReadSet = isEnabled &&
        draft.metadata?.burn_on_read?.enabled === true;

    // Handler to toggle BoR mode
    const handleBurnOnReadApply = useCallback((enabled: boolean) => {
        const updatedDraft = {
            ...draft,
        };

        if (enabled) {
            updatedDraft.metadata = {
                ...updatedDraft.metadata,
                burn_on_read: {
                    enabled: true,
                },
            };
        } else {
            // Remove burn_on_read from metadata
            const {burn_on_read, ...restMetadata} = updatedDraft.metadata || {};
            updatedDraft.metadata = restMetadata;
        }

        handleDraftChange(updatedDraft, {instant: true});
        focusTextbox();
    }, [draft, handleDraftChange, focusTextbox]);

    const handleRemoveBurnOnRead = useCallback(() => {
        handleBurnOnReadApply(false);
    }, [handleBurnOnReadApply]);

    // Label component (shows above editor when active)
    const labels = useMemo(() => (
        (hasBurnOnReadSet && !rootId) ? (
            <BurnOnReadLabel
                canRemove={showIndividualCloseButton && !shouldShowPreview}
                onRemove={handleRemoveBurnOnRead}
                durationMinutes={durationMinutes}
            />
        ) : undefined
    ), [hasBurnOnReadSet, rootId, showIndividualCloseButton, shouldShowPreview, handleRemoveBurnOnRead, durationMinutes]);

    // Button component with tour tip wrapper (in formatting bar)
    const additionalControl = useMemo(() =>
        !rootId && isEnabled && canSend ? (
            <div key='burn-on-read-control-key' className='BurnOnReadControl'>
                <BurnOnReadButton
                    key='burn-on-read-button-key'
                    enabled={hasBurnOnReadSet}
                    onToggle={handleBurnOnReadApply}
                    disabled={shouldShowPreview}
                    durationMinutes={durationMinutes}
                />
                <BurnOnReadTourTip
                    key='burn-on-read-tour-tip-key'
                    onTryItOut={() => handleBurnOnReadApply(true)}
                />
            </div>
        ) : undefined, [rootId, isEnabled, canSend, hasBurnOnReadSet, handleBurnOnReadApply, shouldShowPreview, durationMinutes]);

    return {
        labels,
        additionalControl,
        handleBurnOnReadApply,
        handleRemoveBurnOnRead,
    };
};

export default useBurnOnRead;
