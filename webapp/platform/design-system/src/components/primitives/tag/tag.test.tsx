// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';

import Tag from './tag';

describe('Tag', () => {
    // Basic rendering tests
    it('should render with text', () => {
        render(<Tag text="Test Tag"/>);
        expect(screen.getByText('Test Tag')).toBeInTheDocument();
    });

    it('should render as span by default', () => {
        const {container} = render(<Tag text="Test"/>);
        expect(container.querySelector('span')).toBeInTheDocument();
    });

    it('should render as button when onClick is provided', () => {
        const handleClick = jest.fn();
        const {container} = render(<Tag text="Test" onClick={handleClick}/>);
        expect(container.querySelector('button')).toBeInTheDocument();
    });

    // Size variants
    it.each(['xs', 'sm', 'md', 'lg'] as const)(
        'should apply correct size class for size="%s"',
        (size) => {
            const {container} = render(<Tag text="Test" size={size}/>);
            const tag = container.firstChild as HTMLElement;
            expect(tag).toHaveClass(`Tag--${size}`);
        },
    );

    // Variant tests
    it.each(['default', 'info', 'success', 'warning', 'danger', 'dangerDim', 'primary', 'secondary'] as const)(
        'should apply correct variant class for variant="%s"',
        (variant) => {
            const {container} = render(<Tag text="Test" variant={variant}/>);
            const tag = container.firstChild as HTMLElement;
            expect(tag).toHaveClass(`Tag--${variant}`);
        },
    );

    // Preset tests
    it('should render beta preset correctly', () => {
        const {container} = render(<Tag preset="beta"/>);
        expect(screen.getByText('BETA')).toBeInTheDocument();
        const tag = container.firstChild as HTMLElement;
        expect(tag).toHaveClass('Tag--uppercase');
        expect(tag).toHaveClass('Tag--info');
    });

    it('should render bot preset correctly', () => {
        const {container} = render(<Tag preset="bot"/>);
        expect(screen.getByText('BOT')).toBeInTheDocument();
        const tag = container.firstChild as HTMLElement;
        expect(tag).toHaveClass('Tag--uppercase');
    });

    it('should render guest preset correctly', () => {
        const {container} = render(<Tag preset="guest"/>);
        expect(screen.getByText('GUEST')).toBeInTheDocument();
        const tag = container.firstChild as HTMLElement;
        expect(tag).toHaveClass('Tag--uppercase');
    });

    // Uppercase tests
    it('should apply uppercase class when uppercase is true', () => {
        const {container} = render(<Tag text="test" uppercase={true}/>);
        const tag = container.firstChild as HTMLElement;
        expect(tag).toHaveClass('Tag--uppercase');
    });

    it('should not apply uppercase class when uppercase is false', () => {
        const {container} = render(<Tag text="test" uppercase={false}/>);
        const tag = container.firstChild as HTMLElement;
        expect(tag).not.toHaveClass('Tag--uppercase');
    });

    // Icon tests
    it('should render with icon', () => {
        const icon = <svg data-testid="test-icon"/>;
        render(<Tag text="Test" icon={icon}/>);
        expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    it('should clone icon element with size prop', () => {
        const MockIcon = ({size}: {size?: number}) => <svg data-testid="icon" width={size} height={size}/>;
        render(<Tag text="Test" icon={<MockIcon/>} size="lg"/>);
        const icon = screen.getByTestId('icon');
        expect(icon).toHaveAttribute('width', '16');
        expect(icon).toHaveAttribute('height', '16');
    });

    it('should use custom icon size when provided', () => {
        const MockIcon = ({size}: {size?: number}) => <svg data-testid="icon" width={size} height={size}/>;
        render(<Tag text="Test" icon={<MockIcon/>} iconSize={24}/>);
        const icon = screen.getByTestId('icon');
        expect(icon).toHaveAttribute('width', '24');
    });

    // Click handler tests
    it('should call onClick when clicked', () => {
        const handleClick = jest.fn();
        render(<Tag text="Clickable" onClick={handleClick}/>);
        fireEvent.click(screen.getByText('Clickable'));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should apply clickable class when onClick is provided', () => {
        const handleClick = jest.fn();
        const {container} = render(<Tag text="Test" onClick={handleClick}/>);
        const tag = container.firstChild as HTMLElement;
        expect(tag).toHaveClass('Tag--clickable');
    });

    // Tooltip tests
    it('should wrap with TooltipComponent when tooltip is provided', () => {
        const MockTooltip = ({title, children}: {title: React.ReactNode; children: React.ReactNode}) => (
            <div data-testid="tooltip-wrapper" title={String(title)}>
                {children}
            </div>
        );
        render(
            <Tag 
                text="Test" 
                tooltip="Tooltip text"
                TooltipComponent={MockTooltip}
            />,
        );
        expect(screen.getByTestId('tooltip-wrapper')).toBeInTheDocument();
        expect(screen.getByTestId('tooltip-wrapper')).toHaveAttribute('title', 'Tooltip text');
    });

    it('should not wrap with tooltip when tooltip is not provided', () => {
        const MockTooltip = ({children}: {title: React.ReactNode; children: React.ReactNode}) => (
            <div data-testid="tooltip-wrapper">
                {children}
            </div>
        );
        render(<Tag text="Test" TooltipComponent={MockTooltip}/>);
        expect(screen.queryByTestId('tooltip-wrapper')).not.toBeInTheDocument();
    });

    // Hide tests
    it('should not render when hide is true', () => {
        const {container} = render(<Tag text="Hidden" hide={true}/>);
        expect(container.firstChild).toBeNull();
    });

    it('should render when hide is false', () => {
        render(<Tag text="Visible" hide={false}/>);
        expect(screen.getByText('Visible')).toBeInTheDocument();
    });

    // Full width tests
    it('should apply full-width class when fullWidth is true', () => {
        const {container} = render(<Tag text="Full Width" fullWidth={true}/>);
        const tag = container.firstChild as HTMLElement;
        expect(tag).toHaveClass('Tag--full-width');
    });

    // Custom className tests
    it('should apply custom className', () => {
        const {container} = render(<Tag text="Test" className="custom-class"/>);
        const tag = container.firstChild as HTMLElement;
        expect(tag).toHaveClass('custom-class');
    });

    // Test ID tests
    it('should apply testId attribute', () => {
        render(<Tag text="Test" testId="my-tag"/>);
        expect(screen.getByTestId('my-tag')).toBeInTheDocument();
    });

    // Accessibility tests
    it('should have aria-label when text is string', () => {
        const {container} = render(<Tag text="Test Tag"/>);
        const tag = container.firstChild as HTMLElement;
        expect(tag).toHaveAttribute('aria-label', 'Test Tag');
    });

    it('should have type="button" when rendered as button', () => {
        const handleClick = jest.fn();
        const {container} = render(<Tag text="Test" onClick={handleClick}/>);
        const button = container.querySelector('button');
        expect(button).toHaveAttribute('type', 'button');
    });

    // Default props tests
    it('should use default size (xs) when not specified', () => {
        const {container} = render(<Tag text="Test"/>);
        const tag = container.firstChild as HTMLElement;
        expect(tag).toHaveClass('Tag--xs');
    });

    it('should use default variant (default) when not specified', () => {
        const {container} = render(<Tag text="Test"/>);
        const tag = container.firstChild as HTMLElement;
        expect(tag).toHaveClass('Tag--default');
    });

    it('should use default preset (custom) when not specified', () => {
        render(<Tag text="Custom Text"/>);
        expect(screen.getByText('Custom Text')).toBeInTheDocument();
    });

    // Edge cases
    it('should handle React node as text', () => {
        render(<Tag text={<span data-testid="custom-content">Custom Content</span>}/>);
        expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    });

    it('should prefer preset text over custom text', () => {
        render(<Tag preset="beta" text="This should be ignored"/>);
        expect(screen.getByText('BETA')).toBeInTheDocument();
        expect(screen.queryByText('This should be ignored')).not.toBeInTheDocument();
    });

    it('should apply preset variant to beta tag', () => {
        const {container} = render(<Tag preset="beta"/>);
        const tag = container.firstChild as HTMLElement;
        expect(tag).toHaveClass('Tag--info');
    });

    it('should allow variant override for beta preset', () => {
        const {container} = render(<Tag preset="beta" variant="success"/>);
        const tag = container.firstChild as HTMLElement;
        expect(tag).toHaveClass('Tag--success');
    });
});

