// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {forwardRef, memo, useMemo} from 'react';
import type {ReactNode, MouseEventHandler} from 'react';

import './tag.scss';

export type TagSize = 'xs' | 'sm' | 'md' | 'lg';

export type TagVariant = 
    | 'default'
    | 'info'
    | 'success'
    | 'warning'
    | 'danger'
    | 'dangerDim'
    | 'primary'
    | 'secondary';

export type TagPreset = 'beta' | 'bot' | 'guest' | 'custom';

export interface TagProps {
    /** The text content of the tag */
    text?: ReactNode;

    /** Predefined tag type (beta, bot, guest, or custom for manual text) */
    preset?: TagPreset;

    /** Size variant of the tag */
    size?: TagSize;

    /** Visual variant/color scheme of the tag */
    variant?: TagVariant;

    /** Whether to display text in uppercase */
    uppercase?: boolean;

    /** Icon element to display before the text (e.g., Compass Icon component) */
    icon?: ReactNode;

    /** Icon size in pixels - will be auto-calculated based on tag size if not provided */
    iconSize?: number;

    /** Click handler for interactive tags */
    onClick?: MouseEventHandler<HTMLElement>;

    /** Additional CSS class names */
    className?: string;

    /** Test ID for testing purposes */
    testId?: string;

    /** Tooltip content to display on hover */
    tooltip?: ReactNode;

    /** Tooltip component to wrap the tag (if tooltip prop is provided) */
    TooltipComponent?: React.ComponentType<{title: ReactNode; children: ReactNode}>;

    /** Whether to hide the tag (useful for conditional rendering like guest tags) */
    hide?: boolean;

    /** Full width variant */
    fullWidth?: boolean;
}

/**
 * A unified Tag component that consolidates all tag variants used in Mattermost.
 * 
 * This component replaces:
 * - Tag (widgets/tag/tag.tsx)
 * - AlertTag (widgets/tag/alert_tag.tsx)
 * - BetaTag (widgets/tag/beta_tag.tsx)
 * - BotTag (widgets/tag/bot_tag.tsx)
 * - GuestTag (widgets/tag/guest_tag.tsx)
 * 
 * Features:
 * - Multiple size variants (xs, sm, md, lg)
 * - Multiple color/semantic variants (default, info, success, warning, danger, etc.)
 * - Icon support with auto-sizing
 * - Optional tooltip support
 * - Preset configurations for common tags (beta, bot, guest)
 * - Uppercase text transformation
 * - Click handling for interactive tags
 * - Full accessibility support
 * 
 * @example
 * // Basic usage
 * <Tag text="Custom" variant="info" size="sm" />
 * 
 * @example
 * // Preset tag
 * <Tag preset="beta" size="md" />
 * 
 * @example
 * // With icon
 * <Tag text="Status" icon={<CheckIcon />} variant="success" />
 * 
 * @example
 * // With tooltip
 * <Tag 
 *   text="Info" 
 *   variant="info"
 *   tooltip="Additional information"
 *   TooltipComponent={WithTooltip}
 * />
 * 
 * @example
 * // Interactive tag
 * <Tag text="Click me" onClick={() => console.log('clicked')} />
 */
const Tag = forwardRef<HTMLElement, TagProps>(
    (
        {
            text,
            preset = 'custom',
            size = 'xs',
            variant = 'default',
            uppercase = false,
            icon,
            iconSize: customIconSize,
            onClick,
            className,
            testId,
            tooltip,
            TooltipComponent,
            hide = false,
            fullWidth = false,
            ...rest
        },
        ref,
    ) => {
        // Don't render if hide is true (useful for conditional tags like guest)
        if (hide) {
            return null;
        }

        // Determine the appropriate HTML element
        const Element = onClick ? 'button' : 'span';

        // Get preset configuration
        const presetConfig = useMemo(() => {
            switch (preset) {
            case 'beta':
                return {
                    text: 'BETA',
                    uppercase: true,
                    variant: variant === 'default' ? 'info' : variant,
                };
            case 'bot':
                return {
                    text: 'BOT',
                    uppercase: true,
                };
            case 'guest':
                return {
                    text: 'GUEST',
                    uppercase: true,
                };
            case 'custom':
            default:
                return null;
            }
        }, [preset, variant]);

        // Use preset text and config if available
        const finalText = presetConfig?.text || text;
        const finalUppercase = presetConfig?.uppercase ?? uppercase;
        const finalVariant = presetConfig?.variant || variant;

        // Calculate icon size based on tag size
        const iconSize = useMemo(() => {
            if (customIconSize) {
                return customIconSize;
            }
            switch (size) {
            case 'lg':
                return 16;
            case 'md':
                return 14;
            case 'sm':
                return 12;
            case 'xs':
            default:
                return 10;
            }
        }, [size, customIconSize]);

        // Build CSS classes
        const tagClasses = useMemo(() => classNames(
            'Tag',
            `Tag--${size}`,
            `Tag--${finalVariant}`,
            {
                'Tag--uppercase': finalUppercase,
                'Tag--clickable': Boolean(onClick),
                'Tag--full-width': fullWidth,
            },
            className,
        ), [size, finalVariant, finalUppercase, onClick, fullWidth, className]);

        // Clone icon with size if it's a React element
        const iconElement = useMemo(() => {
            if (!icon) {
                return null;
            }
            if (React.isValidElement(icon)) {
                return React.cloneElement(icon as React.ReactElement<{size?: number}>, {
                    size: iconSize,
                });
            }
            return icon;
        }, [icon, iconSize]);

        // Build the tag element
        const tagElement = (
            <Element
                ref={ref as any}
                className={tagClasses}
                onClick={onClick}
                data-testid={testId}
                aria-label={typeof finalText === 'string' ? finalText : undefined}
                {...(onClick && Element === 'button' && {type: 'button'})}
                {...rest}
            >
                {iconElement && (
                    <span className="Tag__icon" aria-hidden="true">
                        {iconElement}
                    </span>
                )}
                <span className="Tag__text">
                    {finalText}
                </span>
            </Element>
        );

        // Wrap with tooltip if provided
        if (tooltip && TooltipComponent) {
            return (
                <TooltipComponent title={tooltip}>
                    {tagElement}
                </TooltipComponent>
            );
        }

        return tagElement;
    },
);

Tag.displayName = 'Tag';

const MemoTag = memo(Tag);
MemoTag.displayName = 'Tag';

export default MemoTag;

