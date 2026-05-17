// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, userEvent, screen} from 'tests/react_testing_utils';

import BurnOnReadButton from './burn_on_read_button';

// Mirror the real Menu.Container behaviour for our controlled-open pattern:
// - The icon inside stops propagation, so the button div never gets the click.
// - We drive open/closed exclusively via menu.isMenuOpen (passed from pickerOpen state).
jest.mock('components/menu', () => {
    const Item = ({labels, onClick, leadingElement, trailingElements}: any) => (
        <div onClick={onClick}>
            {leadingElement}
            {labels}
            {trailingElements}
        </div>
    );

    const Separator = () => <hr/>;

    const Container = ({menuButton, menuHeader, children, menu}: any) => {
        const isOpen = menu?.isMenuOpen ?? false;
        return (
            <div>
                <div id={menuButton.id}>
                    {menuButton.children}
                </div>
                {isOpen && (
                    <div data-testid='bor-popup'>
                        {menuHeader}
                        {children}
                    </div>
                )}
            </div>
        );
    };

    return {Container, Item, Separator};
});

describe('BurnOnReadButton', () => {
    const defaultProps = {
        enabled: false,
        onToggle: jest.fn(),
        onSetPinned: jest.fn(),
        pinned: false,
        disabled: false,
        durationMinutes: 10,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render the icon button', () => {
        renderWithContext(<BurnOnReadButton {...defaultProps}/>);
        expect(document.getElementById('burnOnReadButtonIcon')).toBeInTheDocument();
    });

    it('should not show popup by default', () => {
        renderWithContext(<BurnOnReadButton {...defaultProps}/>);
        expect(screen.queryByTestId('bor-popup')).not.toBeInTheDocument();
    });

    it('icon click when OFF: immediately arms BoR and opens popup', async () => {
        const onToggle = jest.fn();
        renderWithContext(
            <BurnOnReadButton
                {...defaultProps}
                onToggle={onToggle}
            />,
        );

        const icon = document.getElementById('burnOnReadButtonIcon') as HTMLButtonElement;
        await userEvent.click(icon);

        expect(onToggle).toHaveBeenCalledWith(true);
        expect(screen.getByTestId('bor-popup')).toBeInTheDocument();
    });

    it('icon click when ON and not pinned: disarms BoR and closes popup', async () => {
        const onToggle = jest.fn();
        renderWithContext(
            <BurnOnReadButton
                {...defaultProps}
                enabled={true}
                pinned={false}
                onToggle={onToggle}
            />,
        );

        const icon = document.getElementById('burnOnReadButtonIcon') as HTMLButtonElement;
        await userEvent.click(icon);

        expect(onToggle).toHaveBeenCalledWith(false);
        expect(screen.queryByTestId('bor-popup')).not.toBeInTheDocument();
    });

    it('icon click when ON and pinned: immediately disarms BoR and does NOT open popup', async () => {
        const onToggle = jest.fn();
        renderWithContext(
            <BurnOnReadButton
                {...defaultProps}
                enabled={true}
                pinned={true}
                onToggle={onToggle}
            />,
        );

        const icon = document.getElementById('burnOnReadButtonIcon') as HTMLButtonElement;
        await userEvent.click(icon);

        expect(onToggle).toHaveBeenCalledWith(false);
        expect(screen.queryByTestId('bor-popup')).not.toBeInTheDocument();
    });

    it('pin toggle calls onSetPinned(false) when currently pinned', async () => {
        const onSetPinned = jest.fn();

        // Open popup from OFF→ON, then simulate parent re-rendering with pinned=true
        const {rerender} = renderWithContext(
            <BurnOnReadButton
                {...defaultProps}
                enabled={false}
                pinned={false}
                onSetPinned={onSetPinned}
            />,
        );

        const icon = document.getElementById('burnOnReadButtonIcon') as HTMLButtonElement;
        await userEvent.click(icon);
        expect(screen.getByTestId('bor-popup')).toBeInTheDocument();

        rerender(
            <BurnOnReadButton
                {...defaultProps}
                enabled={true}
                pinned={true}
                onSetPinned={onSetPinned}
            />,
        );

        const pinToggle = screen.getByRole('button', {name: /Pin Burn on Read for this conversation/i});
        await userEvent.click(pinToggle);

        expect(onSetPinned).toHaveBeenCalledWith(false);
    });

    it('pin toggle calls onSetPinned(true) when currently unpinned (popup opened after arm)', async () => {
        const onToggle = jest.fn();
        const onSetPinned = jest.fn();

        renderWithContext(
            <BurnOnReadButton
                {...defaultProps}
                enabled={false}
                pinned={false}
                onToggle={onToggle}
                onSetPinned={onSetPinned}
            />,
        );

        // Click OFF → arms BoR + opens popup
        const icon = document.getElementById('burnOnReadButtonIcon') as HTMLButtonElement;
        await userEvent.click(icon);

        expect(onToggle).toHaveBeenCalledWith(true);
        expect(screen.getByTestId('bor-popup')).toBeInTheDocument();

        // The pin toggle reflects current pinned=false state (aria-pressed=false)
        const pinToggle = screen.getByRole('button', {name: /Pin Burn on Read for this conversation/i});
        expect(pinToggle).toHaveAttribute('aria-pressed', 'false');

        // Toggle pin on
        await userEvent.click(pinToggle);
        expect(onSetPinned).toHaveBeenCalledWith(true);
    });

    it('should not respond to clicks when disabled', async () => {
        const onToggle = jest.fn();
        renderWithContext(
            <BurnOnReadButton
                {...defaultProps}
                disabled={true}
                onToggle={onToggle}
            />,
        );

        const icon = document.getElementById('burnOnReadButtonIcon') as HTMLButtonElement;
        expect(icon).toBeDisabled();
    });

    it('should apply active class to icon only when BoR is pinned', () => {
        renderWithContext(
            <BurnOnReadButton
                {...defaultProps}
                enabled={true}
                pinned={true}
            />,
        );

        const icon = document.getElementById('burnOnReadButtonIcon');
        expect(icon).toHaveClass('active');
    });

    it('should not apply active class when BoR is enabled but not pinned', () => {
        renderWithContext(
            <BurnOnReadButton
                {...defaultProps}
                enabled={true}
                pinned={false}
            />,
        );

        const icon = document.getElementById('burnOnReadButtonIcon');
        expect(icon).not.toHaveClass('active');
    });

    it('should not apply active class when BoR is disabled', () => {
        renderWithContext(
            <BurnOnReadButton
                {...defaultProps}
                enabled={false}
            />,
        );

        const icon = document.getElementById('burnOnReadButtonIcon');
        expect(icon).not.toHaveClass('active');
    });

    it('pin toggle shows aria-pressed=true when popup is opened while pinned', async () => {
        // Arm BoR first (OFF → ON, opens popup), then simulate parent re-rendering with pinned=true
        // The simpler path: render with enabled=false/pinned=false, click icon to open popup,
        // then check that a pinned=true re-render shows the toggle as pressed.
        const {rerender} = renderWithContext(
            <BurnOnReadButton
                {...defaultProps}
                enabled={false}
                pinned={false}
            />,
        );

        // Click icon: arms BoR and opens popup
        const icon = document.getElementById('burnOnReadButtonIcon') as HTMLButtonElement;
        await userEvent.click(icon);
        expect(screen.getByTestId('bor-popup')).toBeInTheDocument();

        // Parent sets pinned=true (simulating user enabling pin via toggle callback)
        rerender(
            <BurnOnReadButton
                {...defaultProps}
                enabled={true}
                pinned={true}
            />,
        );

        const pinToggle = screen.getByRole('button', {name: /Pin Burn on Read for this conversation/i});
        expect(pinToggle).toHaveAttribute('aria-pressed', 'true');
    });

    it('should display correct duration in tooltip', () => {
        renderWithContext(
            <BurnOnReadButton
                {...defaultProps}
                durationMinutes={15}
            />,
        );

        const icon = document.getElementById('burnOnReadButtonIcon');
        expect(icon).toHaveAttribute('aria-label', expect.stringContaining('15 minutes'));
    });
});
