// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {memo} from 'react';
import styled, {css} from 'styled-components';

// Positioning and spacing constants
const ACTIONS_Z_INDEX = 2;
const ACTIONS_GAP = 2;
const ACTIONS_OFFSET_STANDARD = 7;
const ACTIONS_OFFSET_WITH_SCROLLBAR = 15;
const ACTIONS_TRANSITION_DURATION = '0.3s';

type TexteditorActionsProps = {
    placement: 'top' | 'bottom';
    show?: boolean;
    isScrollbarRendered?: boolean;
}

const TexteditorActions = styled.span<TexteditorActionsProps>`
    z-index: ${ACTIONS_Z_INDEX};
    display: flex;
    place-items: center;
    gap: ${ACTIONS_GAP}px;

    /* define the position based on the placement prop */
    ${({placement, isScrollbarRendered}) => (placement === 'top' ? css`
        position: absolute;
        top: ${ACTIONS_OFFSET_STANDARD}px;
        right: ${isScrollbarRendered ? ACTIONS_OFFSET_WITH_SCROLLBAR : ACTIONS_OFFSET_STANDARD}px;
    ` : css`
        position: absolute;
        right: ${ACTIONS_OFFSET_STANDARD}px;
        bottom: ${ACTIONS_OFFSET_STANDARD}px;
    `)}

    opacity: ${({show = true}) => (show ? 1 : 0)};
    transition: opacity ${ACTIONS_TRANSITION_DURATION} linear;
    visibility: ${({show = true}) => (show ? 'visible' : 'hidden')};

    .btn-file__disabled {
        opacity: 0.1;

        &:hover,
        &:active {
            opacity: 0.1;
        }
    }
`;

export default memo(TexteditorActions);
