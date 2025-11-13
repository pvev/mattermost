// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import BurnOnReadBadge from './burn_on_read_badge';

describe('BurnOnReadBadge', () => {
    const baseProps = {
        postId: 'post123',
        isSender: false,
        revealed: false,
    };

    it('should render flame icon for unrevealed recipient', () => {
        renderWithContext(
            <BurnOnReadBadge {...baseProps}/>,
        );

        const badge = screen.getByTestId('burn-on-read-badge-post123');
        expect(badge).toBeInTheDocument();
        expect(badge.querySelector('.icon-fire')).toBeInTheDocument();
    });

    it('should show "Click to Reveal" tooltip for unrevealed recipient', () => {
        renderWithContext(
            <BurnOnReadBadge {...baseProps}/>,
        );

        const badge = screen.getByTestId('burn-on-read-badge-post123');
        expect(badge).toHaveAttribute('aria-label', 'Click to Reveal');
    });

    it('should show "Not read by X people" tooltip for sender with unrevealed recipients', () => {
        renderWithContext(
            <BurnOnReadBadge
                {...baseProps}
                isSender={true}
                revealedByCount={2}
                totalRecipients={5}
            />,
        );

        const badge = screen.getByTestId('burn-on-read-badge-post123');
        expect(badge).toHaveAttribute('aria-label', expect.stringContaining('Not read by 3 people'));
    });

    it('should show "Not read by 1 person" for single unrevealed recipient', () => {
        renderWithContext(
            <BurnOnReadBadge
                {...baseProps}
                isSender={true}
                revealedByCount={0}
                totalRecipients={1}
            />,
        );

        const badge = screen.getByTestId('burn-on-read-badge-post123');
        expect(badge).toHaveAttribute('aria-label', expect.stringContaining('Not read by 1 person'));
    });

    it('should not render when revealed and no timer (PR #2 feature)', () => {
        const {container} = renderWithContext(
            <BurnOnReadBadge
                {...baseProps}
                revealed={true}
            />,
        );

        expect(container.firstChild).toBeNull();
    });

    it('should not render for sender when all recipients have revealed', () => {
        const {container} = renderWithContext(
            <BurnOnReadBadge
                {...baseProps}
                isSender={true}
                revealed={true}
                revealedByCount={5}
                totalRecipients={5}
            />,
        );

        // Should not render since timer chip will be shown instead (PR #2)
        expect(container.firstChild).toBeNull();
    });

    it('should have correct CSS class for styling', () => {
        renderWithContext(
            <BurnOnReadBadge {...baseProps}/>,
        );

        const badge = screen.getByTestId('burn-on-read-badge-post123');
        expect(badge).toHaveClass('BurnOnReadBadge');
    });
});
